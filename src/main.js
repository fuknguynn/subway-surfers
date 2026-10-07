import * as THREE from 'three';
import './style.css';
import { createPlayer } from './player.js';

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

  // Input tạm để test Task 2 (Task 4 tách ra src/input.js)
  window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') player.moveLane(-1);
    else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') player.moveLane(1);
    else if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W' || e.key === ' ') player.jump();
    else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') player.slide();
  });

  const light = new THREE.HemisphereLight(0xffffff, 0x334455, 1.2);
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
    player.update(dt);
    renderer.render(scene, camera);
  }
  loop();

  return { scene, camera, renderer, player };
}

initGame();
