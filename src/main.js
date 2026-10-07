import './style.css';
import { createGame } from './game.js';

export function initGame() {
  const container = document.getElementById('app');
  return createGame(container);
}

if (typeof document !== 'undefined') {
  // Vẽ loading trước 1 frame để user mobile không nhìn màn hình trắng
  // trong lúc parse three.js; createGame thay toàn bộ #hud ngay sau đó.
  document.getElementById('hud').innerHTML =
    '<div class="ui-overlay"><h1>🚇 Subway Mini 3D</h1><p>Loading...</p></div>';
  requestAnimationFrame(() => initGame());
}
