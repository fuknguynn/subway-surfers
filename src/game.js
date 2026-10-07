import * as THREE from 'three';
import { createPlayer } from './player.js';
import { createWorld, boxesOverlap } from './world.js';
import { bindInput } from './input.js';
import { createUI } from './ui.js';
import { createQuality } from './quality.js';

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

  let state = 'menu'; // menu | playing | paused(hidden) — paused tách riêng
  let paused = false;
  let speed = BASE_SPEED;
  let elapsed = 0;
  let score = 0;
  let coins = 0;
  let best = loadBest();

  const ui = createUI({ onStart: start });
  ui.showMenu(best);

  function start() {
    player.reset();
    world.reset();
    speed = BASE_SPEED;
    elapsed = 0;
    score = 0;
    coins = 0;
    paused = false;
    ui.setPaused(false);
    ui.showHUD();
    ui.setScore(0, 0);
    state = 'playing';
  }

  function gameOver() {
    state = 'gameover';
    const isNewBest = score > best;
    if (isNewBest) {
      best = score;
      saveBest(best);
    }
    ui.showGameOver(score, best, isNewBest);
  }

  function collide() {
    const pb = player.getBounds();
    for (const o of world.getObstacles()) {
      if (boxesOverlap(pb, world.obstacleBounds(o))) {
        gameOver();
        return;
      }
    }
    if (state !== 'playing') return;
    for (const c of [...world.getCoins()]) {
      const cb = {
        minX: c.position.x - 0.4, maxX: c.position.x + 0.4,
        minY: c.position.y - 0.4, maxY: c.position.y + 0.4,
        minZ: c.position.z - 0.4, maxZ: c.position.z + 0.4,
      };
      if (boxesOverlap(pb, cb, 0)) {
        world.collectCoin(c);
        coins += 1;
        score += COIN_SCORE;
      }
    }
    ui.setScore(score, coins);
  }

  function simulate(dt) {
    const { count, h } = splitDt(dt);
    for (let i = 0; i < count && state === 'playing'; i++) {
      elapsed += h;
      speed = Math.min(BASE_SPEED + elapsed * SPEED_RAMP, MAX_SPEED);
      score += speed * h;
      player.update(h);
      world.update(h, speed);
      collide();
    }
  }

  bindInput(player, {
    canvas: renderer.domElement,
    onPause: () => {
      if (state !== 'playing') return;
      paused = !paused;
      ui.setPaused(paused);
    },
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
    updateRotateHint();
  });
  updateRotateHint();

  // Ẩn tab thì tự pause để không bị xuyên obstacle khi quay lại
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state === 'playing' && !paused) {
      paused = true;
      ui.setPaused(true);
    }
  });

  const clock = new THREE.Clock();
  function loop() {
    requestAnimationFrame(loop);
    const dt = Math.min(clock.getDelta(), 0.05);
    quality.noteFrame(dt * 1000);
    if (state === 'playing' && !paused) simulate(dt);
    renderer.render(scene, camera);
  }
  loop();

  return {
    scene, camera, renderer, player, world, ui, quality,
    start,
    getState: () => (paused ? 'paused' : state),
  };
}
