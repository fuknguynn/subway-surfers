import './style.css';
import { createGame } from './game.js';

export function initGame() {
  const container = document.getElementById('app');
  return createGame(container);
}

if (typeof document !== 'undefined') initGame();
