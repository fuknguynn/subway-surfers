// UI overlay: menu, HUD, game over. Chạy trong browser (cần document).
export function createUI(handlers = {}) {
  const root = document.getElementById('hud');
  root.style.pointerEvents = 'none';

  root.innerHTML = `
    <div id="ui-loading" class="ui-overlay">
      <h1>🚇 Subway Mini 3D</h1>
      <p>Loading...</p>
      <div id="ui-loadbar"><div id="ui-loadfill"></div></div>
    </div>
    <div id="ui-score" class="ui-hidden">0m</div>
    <div id="ui-coins" class="ui-hidden">🪙 0</div>
    <div id="ui-timers" class="ui-hidden"></div>
    <button id="ui-mute" class="ui-hidden">🔊</button>
    <div id="ui-paused" class="ui-hidden">Tạm dừng — bấm P để tiếp tục</div>
    <div id="ui-rotate" class="ui-hidden">📱 Xoay dọc điện thoại để chơi thoải mái hơn</div>
    <div id="ui-flash" class="ui-hidden"></div>
    <div id="ui-menu" class="ui-overlay ui-hidden">
      <h1>🚇 Subway Mini 3D</h1>
      <p>← → đổi làn &nbsp;•&nbsp; ↑ nhảy &nbsp;•&nbsp; ↓ trượt<br/>Vuốt trên mobile • P tạm dừng</p>
      <p id="ui-menu-best"></p>
      <button id="ui-start">▶ Chơi</button>
    </div>
    <div id="ui-over" class="ui-overlay ui-hidden">
      <h1>💥 Game Over</h1>
      <p id="ui-final"></p>
      <p id="ui-best"></p>
      <div class="ui-row">
        <button id="ui-retry">↻ Chơi lại</button>
        <button id="ui-home">🏠 Home</button>
      </div>
    </div>`;

  const scoreEl = root.querySelector('#ui-score');
  const coinsEl = root.querySelector('#ui-coins');
  const pausedEl = root.querySelector('#ui-paused');
  const rotateEl = root.querySelector('#ui-rotate');
  const flashEl = root.querySelector('#ui-flash');
  const loadingEl = root.querySelector('#ui-loading');
  const loadFill = root.querySelector('#ui-loadfill');
  const muteBtn = root.querySelector('#ui-mute');
  const timersEl = root.querySelector('#ui-timers');
  const menuEl = root.querySelector('#ui-menu');
  const overEl = root.querySelector('#ui-over');

  const show = (el) => el.classList.remove('ui-hidden');
  const hide = (el) => el.classList.add('ui-hidden');

  if (handlers.onStart) {
    root.querySelector('#ui-start').addEventListener('click', handlers.onStart);
    root.querySelector('#ui-retry').addEventListener('click', handlers.onStart);
  }
  if (handlers.onHome) {
    root.querySelector('#ui-home').addEventListener('click', handlers.onHome);
  }
  if (handlers.onMute) {
    muteBtn.addEventListener('click', () => {
      const muted = handlers.onMute();
      muteBtn.textContent = muted ? '🔇' : '🔊';
    });
  }
  if (handlers.muted) muteBtn.textContent = handlers.muted() ? '🔇' : '🔊';

  let lastScoreText = '';
  let lastCoinsText = '';

  return {
    setScore(m, coins) {
      // Chỉ chạm DOM khi text đổi (game gọi mỗi substep)
      const s = `${Math.floor(m)}m`;
      const c = `🪙 ${coins}`;
      if (s !== lastScoreText) {
        lastScoreText = s;
        scoreEl.textContent = s;
      }
      if (c !== lastCoinsText) {
        lastCoinsText = c;
        coinsEl.textContent = c;
      }
    },
    setPaused(paused) {
      if (paused) show(pausedEl);
      else hide(pausedEl);
    },
    showRotateHint(showHint) {
      if (showHint) show(rotateEl);
      else hide(rotateEl);
    },
    pulseCoins() {
      coinsEl.style.transform = 'scale(1.35)';
      setTimeout(() => { coinsEl.style.transform = ''; }, 120);
    },
    flashHit() {
      show(flashEl);
      setTimeout(() => hide(flashEl), 150);
    },
    showMenu(best) {
      hide(overEl);
      hide(scoreEl);
      hide(coinsEl);
      hide(timersEl);
      hide(muteBtn);
      show(menuEl);
      root.querySelector('#ui-menu-best').textContent =
        best > 0 ? `Kỷ lục: ${Math.floor(best)}m` : '';
    },
    showHUD() {
      hide(menuEl);
      hide(overEl);
      show(scoreEl);
      show(coinsEl);
      show(timersEl);
      show(muteBtn);
    },
    showGameOver(stats) {
      const { score, best, distance, coins, isNewBest } = stats;
      hide(menuEl);
      show(overEl);
      root.querySelector('#ui-final').textContent =
        `SCORE ${Math.floor(score)} • BEST ${Math.floor(best)}`;
      root.querySelector('#ui-best').textContent =
        `🏃 ${Math.floor(distance)}m • 🪙 ${coins}` +
        (isNewBest ? ' • 🎉 Kỷ lục mới!' : '');
    },
    showLoading(pct) {
      show(loadingEl);
      loadFill.style.width = `${Math.floor(pct * 100)}%`;
    },
    hideLoading() {
      hide(loadingEl);
    },
    setPowerup(name, secondsLeft) {
      let el = timersEl.querySelector(`[data-pu="${name}"]`);
      if (secondsLeft == null) {
        if (el) el.remove();
        return;
      }
      if (!el) {
        el = document.createElement('div');
        el.dataset.pu = name;
        timersEl.appendChild(el);
      }
      const icons = { magnet: '🧲', shield: '🛡️', multi: '✌️' };
      el.textContent = `${icons[name] || name} ${Math.ceil(secondsLeft)}s`;
    },
  };
}
