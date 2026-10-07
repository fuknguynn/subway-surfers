import * as THREE from 'three';
import { createPlayer } from './player.js';
import { createWorld, boxesOverlap } from './world.js';
import { bindInput } from './input.js';
import { createUI } from './ui.js';
import { createQuality } from './quality.js';
import { createCamera } from './camera.js';
import { createParticles } from './particles.js';
import { createAudio } from './audio.js';
import { createPowerups, MAGNET_RADIUS } from './powerups.js';
import { createAssetManager } from './assetManager.js';
import { LANES } from './player.js';

export const SUBSTEP_MAX = 1 / 60;
export const BASE_SPEED = 12;
export const MAX_SPEED = 30;
export const SPEED_RAMP = 0.35; // m/s nhanh thêm mỗi giây
export const COIN_SCORE = 10;
const BEST_KEY = 'subway-mini-highscore';

// Chia delta thành các substep không quá max để chống tunneling:
// va chạm được kiểm tra mỗi substep, không chỉ ở cuối frame.
export function splitDt(dt, max = SUBSTEP_MAX) {
  const count = Math.max(1, Math.ceil(dt / max));
  return { count, h: dt / count };
}

function loadBest() {
  try {
    if (typeof localStorage === 'undefined') return 0;
    return Number(localStorage.getItem(BEST_KEY)) || 0;
  } catch {
    return 0;
  }
}

function saveBest(v) {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(BEST_KEY, String(Math.floor(v)));
  } catch {
    // bỏ qua: chế độ riêng tư
  }
}

export function createGame(container) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87ceeb);

  const camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.1,
    200,
  );
  camera.position.set(0, 3.2, 6.5);
  camera.lookAt(0, 1, -6);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  container.appendChild(renderer.domElement);

  const player = createPlayer(scene);
  const world = createWorld(scene);
  const quality = createQuality(renderer);
  const camRig = createCamera(camera);
  camRig.reframe(window.innerWidth / window.innerHeight);
  const particles = createParticles(scene, quality.profile === 'HIGH' ? 120 : 80);
  const audio = createAudio();
  const powerups = createPowerups(scene);
  const assets = createAssetManager();
  let hitFlag = false;

  let state = 'menu'; // menu | playing | gameover (paused tách riêng)
  let paused = false;
  let speed = BASE_SPEED;
  let elapsed = 0;
  let distance = 0;
  let score = 0;
  let coins = 0;
  let best = loadBest();
  let wasGrounded = true;
  let wasSliding = false;

  const ui = createUI({
    onStart: () => {
      audio.unlock();
      audio.click();
      start();
    },
    onPauseBtn: () => togglePause(),
    onHome: () => {
      audio.click();
      state = 'menu';
      paused = false;
      ui.setPaused(false);
      ui.showMenu(best);
    },
    onMute: () => audio.toggleMute(),
    muted: () => audio.isMuted(),
  });
  ui.showMenu(best);
  ui.hideLoading(); // core đã sẵn sàng: gỡ overlay loading, nếu không nó che HUD + chặn touch

  // GLB character tải nền: xong thì thay procedural, lỗi thì giữ fallback.
  // Gameplay không chờ asset (menu/PLAY sẵn sàng ngay).
  assets.onProgress((id, loaded, total) => {
    if (total > 0) ui.showLoading(loaded / total);
  });
  assets.loadModel('runner', `${import.meta.env.BASE_URL}assets/character/human_male.glb`)
    .then(() => {
      player.setGLBModel(assets.cloneModel('runner'), assets.getClips('runner'));
    })
    .catch(() => player.useProcedural());

  function start() {
    player.reset();
    world.reset();
    powerups.reset();
    speed = BASE_SPEED;
    elapsed = 0;
    distance = 0;
    score = 0;
    coins = 0;
    wasGrounded = true;
    wasSliding = false;
    paused = false;
    ui.setPaused(false);
    ui.showHUD();
    ui.setScore(0, 0);
    state = 'playing';
  }

  function gameOver() {
    state = 'gameover';
    hitFlag = true;
    ui.flashHit();
    audio.hit();
    particles.burst('hit', player.mesh.position.x, 1.2, 0);
    const isNewBest = score > best;
    if (isNewBest) {
      best = score;
      saveBest(best);
    }
    ui.showGameOver({ score, best, distance, coins, isNewBest });
  }

  function collide() {
    const pb = player.getBounds();
    for (const o of world.getObstacles()) {
      if (boxesOverlap(pb, world.obstacleBounds(o))) {
        if (powerups.isInvulnerable()) continue;
        if (powerups.absorbHit()) {
          audio.power();
          particles.burst('hit', pb.minX + 0.35, 1.2, 0);
          continue;
        }
        gameOver();
        return;
      }
    }
    if (state !== 'playing') return;
    const r = powerups.isMagnet() ? MAGNET_RADIUS : 0.4;
    for (const c of [...world.getCoins()]) {
      const cb = {
        minX: c.position.x - r, maxX: c.position.x + r,
        minY: c.position.y - r, maxY: c.position.y + r,
        minZ: c.position.z - r, maxZ: c.position.z + r,
      };
      if (boxesOverlap(pb, cb, 0)) {
        world.collectCoin(c);
        coins += 1;
        score += COIN_SCORE * powerups.coinMultiplier();
        ui.pulseCoins();
        audio.coin();
        particles.burst('coin', c.position.x, c.position.y, c.position.z);
      }
    }
    ui.setScore(score, coins);
  }

  function simulate(dt) {
    const { count, h } = splitDt(dt);
    for (let i = 0; i < count && state === 'playing'; i++) {
      elapsed += h;
      speed = Math.min(BASE_SPEED + elapsed * SPEED_RAMP, MAX_SPEED);
      const mult = powerups.coinMultiplier();
      score += speed * h * mult;
      distance += speed * h;
      player.update(h);
      if (wasGrounded && !player.grounded) audio.jump();
      const sliding = player.slideTimer > 0;
      if (!wasSliding && sliding) audio.slide();
      wasGrounded = player.grounded;
      wasSliding = sliding;
      if (player.justLanded) {
        particles.burst('land', player.mesh.position.x, 0.1, 0);
      }
      world.update(h, speed);
      powerups.update(h, speed, player.getBounds(), world.getReachable(), (kind) => {
        audio.power();
        particles.burst('coin', player.mesh.position.x, 1.5, 0);
      });
      collide();
    }
  }

  function togglePause() {
    if (state !== 'playing') return;
    paused = !paused;
    ui.setPaused(paused);
  }

  bindInput(player, {
    canvas: renderer.domElement,
    onPause: () => togglePause(),
  });

  function updateRotateHint() {
    ui.showRotateHint(
      window.innerWidth > window.innerHeight && window.innerHeight < 420,
    );
  }

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    quality.applyDPR();
    camRig.reframe(camera.aspect);
    updateRotateHint();
  });
  updateRotateHint();

  // Ẩn tab thì tự pause để không bị xuyên obstacle khi quay lại
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      audio.suspend();
      if (state === 'playing' && !paused) {
        paused = true;
        ui.setPaused(true);
      }
    } else {
      audio.resume();
    }
  });

  function visualState() {
    if (state !== 'playing') return state === 'gameover' ? 'hit' : 'idle';
    if (!player.grounded) return 'jump';
    if (player.slideTimer > 0) return 'slide';
    return 'run';
  }

  const clock = new THREE.Clock();
  function loop() {
    requestAnimationFrame(loop);
    const dt = Math.min(clock.getDelta(), 0.05);
    quality.noteFrame(dt * 1000);
    if (state === 'playing' && !paused) simulate(dt);
    player.visual.setState(visualState());
    player.visual.setLean(
      (LANES[player.laneIndex] - player.mesh.position.x) * 0.1,
    );
    player.visual.update(dt);
    // Timer HUD: 1 lần/frame (không gọi trong substep để tránh spam DOM)
    for (const k of powerups.kinds) {
      const left = powerups.timers[k];
      ui.setPowerup(k, left > 0 ? left : null);
    }
    particles.update(dt);
    camRig.update(dt, {
      speed,
      laneX: player.mesh.position.x,
      grounded: player.grounded,
      justLanded: player.justLanded,
      hit: hitFlag,
    });
    player.justLanded = false;
    hitFlag = false; // rig đã latch shake 0.3s, chỉ cần báo 1 frame
    renderer.render(scene, camera);
  }
  loop();

  return {
    scene, camera, renderer, player, world, ui, quality,
    start,
    getState: () => (paused ? 'paused' : state),
  };
}
