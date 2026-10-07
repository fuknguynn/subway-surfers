// Input: bàn phím + swipe touch. target mặc định là window,
// truyền target stub để test trong Node.
export function bindInput(player, options = {}) {
  const { onPause } = options;
  const el =
    options.target ||
    (typeof window !== 'undefined' ? window : null);
  if (!el) return () => {};

  function onKeyDown(e) {
    if (e.repeat) return;
    const k = e.key;
    if (k === 'ArrowLeft' || k === 'a' || k === 'A') player.moveLane(-1);
    else if (k === 'ArrowRight' || k === 'd' || k === 'D') player.moveLane(1);
    else if (k === 'ArrowUp' || k === 'w' || k === 'W' || k === ' ') {
      player.jump();
      if (e.preventDefault) e.preventDefault();
    } else if (k === 'ArrowDown' || k === 's' || k === 'S') player.slide();
    else if ((k === 'p' || k === 'P' || k === 'Escape') && onPause) onPause();
  }

  let startX = 0;
  let startY = 0;
  const SWIPE_MIN = 24;

  function onTouchStart(e) {
    const t = e.touches && e.touches[0];
    if (!t) return;
    startX = t.clientX;
    startY = t.clientY;
  }

  function onTouchEnd(e) {
    const t = e.changedTouches && e.changedTouches[0];
    if (!t) return;
    const dx = t.clientX - startX;
    const dy = t.clientY - startY;
    if (Math.abs(dx) < SWIPE_MIN && Math.abs(dy) < SWIPE_MIN) return;
    if (Math.abs(dx) > Math.abs(dy)) player.moveLane(dx > 0 ? 1 : -1);
    else if (dy < 0) player.jump();
    else player.slide();
  }

  el.addEventListener('keydown', onKeyDown);
  el.addEventListener('touchstart', onTouchStart, { passive: true });
  el.addEventListener('touchend', onTouchEnd);

  return () => {
    el.removeEventListener('keydown', onKeyDown);
    el.removeEventListener('touchstart', onTouchStart);
    el.removeEventListener('touchend', onTouchEnd);
  };
}
