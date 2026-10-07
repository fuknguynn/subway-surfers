import * as THREE from 'three';
import './style.css';
import { createPlayer } from './player.js';
import { createWorld } from './world.js';
import { bindInput } from './input.js';

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
  let speed = 12; // Task 5: ramp tốc độ theo thời gian
  let paused = false;
  bindInput(player, { onPause: () => { paused = !paused; } });

  const light = new THREE.HemisphereLight(0xffffff, 0x334455, 0.4);
  scene.add(light);

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  const clock = new THREE.Clock();
  function loop() {
    requestAnimationFrame(loop);
    const dt = Math.min(clock.getDelta(), 0.05);
    if (!paused) {
      player.update(dt);
      world.update(dt, speed);
    }
    renderer.render(scene, camera);
  }
  loop();

  return { scene, camera, renderer, player, world };
}

initGame();
