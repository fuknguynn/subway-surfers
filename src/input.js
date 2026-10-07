// Input: bàn phím + swipe touch. target mặc định là window,
// truyền target stub để test trong Node.
export const SWIPE_MIN_CSS_PX = 24;
export const SWIPE_MAX_MS = 500;

export function bindInput(player, options = {}) {
  const { onPause } = options;
  const el =
    options.target ||
    (typeof window !== 'undefined' ? window : null);
  if (!el) return () => {};
  // Chỉ chặn scroll/zoom trên canvas game, không đụng browser behavior bên ngoài.
  const canvas = options.canvas || null;

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

  // Một gesture đúng một action: fire ngay khi vượt ngưỡng (touchmove hoặc
  // touchend), lock tới touchend/touchcancel, hết 500ms thì hết hiệu lực.
  // clientX/Y đã là CSS px — so trực tiếp, không nhân DPR.
  let tracking = false;
  let fired = false;
  let startX = 0;
  let startY = 0;
  let t0 = 0;

  function now() {
    return typeof performance !== 'undefined' ? performance.now() : Date.now();
  }

  function fire(dx, dy) {
    if (Math.abs(dx) < SWIPE_MIN_CSS_PX && Math.abs(dy) < SWIPE_MIN_CSS_PX) return;
    if (Math.abs(dx) > Math.abs(dy)) player.moveLane(dx > 0 ? 1 : -1);
    else if (dy < 0) player.jump();
    else player.slide();
  }

  function tryFire(x, y) {
    if (!tracking || fired) return;
    if (now() - t0 > SWIPE_MAX_MS) {
      tracking = false; // gesture hết hạn: không fire gì cả
      return;
    }
    const dx = x - startX;
    const dy = y - startY;
    if (Math.abs(dx) < SWIPE_MIN_CSS_PX && Math.abs(dy) < SWIPE_MIN_CSS_PX) return;
    fired = true;
    fire(dx, dy);
  }

  function onTouchStart(e) {
    if (tracking) return; // bỏ qua ngón thứ hai
    const t = e.touches && e.touches[0];
    if (!t) return;
    tracking = true;
    fired = false;
    startX = t.clientX;
    startY = t.clientY;
    t0 = now();
  }

  function onTouchMove(e) {
    const t = e.touches && e.touches[0];
    if (!t) return;
    tryFire(t.clientX, t.clientY);
  }

  function onTouchEnd(e) {
    const t = e.changedTouches && e.changedTouches[0];
    if (t) tryFire(t.clientX, t.clientY);
    tracking = false;
  }

  function onTouchCancel() {
    tracking = false;
  }

  function onCanvasTouchMove(e) {
    if (e.cancelable && e.preventDefault) e.preventDefault();
  }

  el.addEventListener('keydown', onKeyDown);
  el.addEventListener('touchstart', onTouchStart, { passive: true });
  el.addEventListener('touchmove', onTouchMove, { passive: true });
  el.addEventListener('touchend', onTouchEnd);
  el.addEventListener('touchcancel', onTouchCancel);
  if (canvas && canvas.addEventListener) {
    canvas.addEventListener('touchmove', onCanvasTouchMove, { passive: false });
  }

  return () => {
    el.removeEventListener('keydown', onKeyDown);
    el.removeEventListener('touchstart', onTouchStart);
    el.removeEventListener('touchmove', onTouchMove);
    el.removeEventListener('touchend', onTouchEnd);
    el.removeEventListener('touchcancel', onTouchCancel);
    if (canvas && canvas.removeEventListener) {
      canvas.removeEventListener('touchmove', onCanvasTouchMove);
    }
  };
}
