// UI overlay: menu, HUD, game over. Chạy trong browser (cần document).
export function createUI(handlers = {}) {
  const root = document.getElementById('hud');
  root.style.pointerEvents = 'none';

  root.innerHTML = `
    <div id="ui-score" class="ui-hidden">0m</div>
    <div id="ui-coins" class="ui-hidden">🪙 0</div>
    <div id="ui-paused" class="ui-hidden">Tạm dừng — bấm P để tiếp tục</div>
    <div id="ui-menu" class="ui-overlay">
      <h1>🚇 Subway Mini 3D</h1>
      <p>← → đổi làn &nbsp;•&nbsp; ↑ nhảy &nbsp;•&nbsp; ↓ trượt<br/>Vuốt trên mobile • P tạm dừng</p>
      <p id="ui-menu-best"></p>
      <button id="ui-start">▶ Chơi</button>
    </div>
    <div id="ui-over" class="ui-overlay ui-hidden">
      <h1>💥 Game Over</h1>
      <p id="ui-final"></p>
      <p id="ui-best"></p>
      <button id="ui-retry">↻ Chơi lại</button>
    </div>`;

  const scoreEl = root.querySelector('#ui-score');
  const coinsEl = root.querySelector('#ui-coins');
  const pausedEl = root.querySelector('#ui-paused');
  const menuEl = root.querySelector('#ui-menu');
  const overEl = root.querySelector('#ui-over');

  const show = (el) => el.classList.remove('ui-hidden');
  const hide = (el) => el.classList.add('ui-hidden');

  if (handlers.onStart) {
    root.querySelector('#ui-start').addEventListener('click', handlers.onStart);
    root.querySelector('#ui-retry').addEventListener('click', handlers.onStart);
  }

  return {
    setScore(m, coins) {
      scoreEl.textContent = `${Math.floor(m)}m`;
      coinsEl.textContent = `🪙 ${coins}`;
    },
    setPaused(paused) {
      if (paused) show(pausedEl);
      else hide(pausedEl);
    },
    showMenu(best) {
      hide(overEl);
      hide(scoreEl);
      hide(coinsEl);
      show(menuEl);
      root.querySelector('#ui-menu-best').textContent =
        best > 0 ? `Kỷ lục: ${Math.floor(best)}m` : '';
    },
    showHUD() {
      hide(menuEl);
      hide(overEl);
      show(scoreEl);
      show(coinsEl);
    },
    showGameOver(score, best, isNewBest) {
      hide(menuEl);
      show(overEl);
      root.querySelector('#ui-final').textContent =
        `Bạn chạy được ${Math.floor(score)}m`;
      root.querySelector('#ui-best').textContent = isNewBest
        ? '🎉 Kỷ lục mới!'
        : `Kỷ lục: ${Math.floor(best)}m`;
    },
  };
}
