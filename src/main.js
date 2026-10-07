import * as THREE from 'three';
import './style.css';
import { createPlayer } from './player.js';
import { createWorld, boxesOverlap } from './world.js';
import { bindInput } from './input.js';
import { createUI } from './ui.js';

const BEST_KEY = 'subway-mini-highscore';
const BASE_SPEED = 12;
const MAX_SPEED = 30;
const SPEED_RAMP = 0.35; // m/s nhanh thêm mỗi giây
const COIN_SCORE = 10;

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

export function initGame() {
  const container = document.getElementById('app');
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

  let state = 'menu'; // menu | playing | gameover
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

  bindInput(player, {
    onPause: () => {
      if (state !== 'playing') return;
      paused = !paused;
      ui.setPaused(paused);
    },
  });

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

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

    if (state === 'playing' && !paused) {
      elapsed += dt;
      speed = Math.min(BASE_SPEED + elapsed * SPEED_RAMP, MAX_SPEED);
      score += speed * dt;

      player.update(dt);
      world.update(dt, speed);

      const pb = player.getBounds();
      for (const o of world.getObstacles()) {
        if (boxesOverlap(pb, world.obstacleBounds(o))) {
          gameOver();
          break;
        }
      }
      if (state === 'playing') {
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
    }

    renderer.render(scene, camera);
  }
  loop();

  return { scene, camera, renderer, player, world };
}

if (typeof document !== 'undefined') initGame();
