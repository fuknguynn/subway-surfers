# Subway Surfers Mini 3D Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build endless-runner 3-lane 3D game kiểu Subway Surfers, chạy `npm run dev`, build ra `dist/` deploy free.

**Architecture:** Vite static site + Three.js; player đứng yên z (world di chuyển), object pooling cho obstacle/coin, AABB va chạm, localStorage highscore.

**Tech Stack:** Node 18+, Vite 5, Three.js 0.160+ (npm), vanilla JS, CSS overlay HUD.

**Spec:** `docs/superpowers/specs/2026-10-07-subway-surfers-3d-design.md`

## Global Constraints

- Không backend, không env var, không asset ngoài — hình khối Three.js only.
- 3 làn x = -2, 0, 2.
- Tốc độ khởi đầu 12 m/s, tăng dần, có cap.
- Mỗi pattern obstacle phải chừa ít nhất 1 làn sống sót tới được.
- Build `npm run build` phải pass, output `dist/` tĩnh host được.
- Hỗ trợ phím + swipe touch, clamp delta khi tab ẩn/hiện.

## Review Focus

- Swipe touch trên mobile yếu không nhận / nhận nhầm hướng — mong đợi vuốt lên nhảy, xuống trượt, ngang đổi làn mượt như phím.
- Tab ẩn lâu rồi quay lại game nhảy cóc / xuyên obstacle — mong đợi clamp delta tối đa 0.05s.
- Resize cửa sổ giữa game làm camera méo / HUD lệch — mong đợi scene + HUD tự fit.
- Spawn obstacle không thể tránh (3 làn cùng bị chặn) — mong đợi luôn có đường sống.
- Chạy `npm run build` rồi mở `dist/` trắng trang (base path sai) — mong đợi preview + deploy chạy ngay.

---

### Task 1: Scaffold Vite + Three.js + scene trống

**Files:**
- Create: `package.json`, `vite.config.js`, `index.html`, `src/main.js`, `src/style.css`, `.gitignore`
- Test: manual `npm run dev` + `npm run build`

**Interfaces:**
- Consumes: none
- Produces: `initGame()` trong `src/main.js` khởi tạo scene/camera/renderer + loop rỗng; `vite.config.js` với `base: './'` để deploy sub-path không trắng trang.

- [ ] **Step 1: Khởi tạo Vite + cài three**

Run: `npm create vite@latest . -- --template vanilla; npm install; npm install three`
Expected: `package.json` có `three`, `vite`.

- [ ] **Step 2: Viết `vite.config.js` với base './'**

```js
import { defineConfig } from 'vite';
export default defineConfig({ base: './' });
```

- [ ] **Step 3: Viết `index.html` mount + HUD root trống**

Div `#app` cho canvas, div `#hud` overlay, script `/src/main.js` type module.

- [ ] **Step 4: Viết `src/main.js` scene trống + loop**

Signature: `initGame() -> { scene, camera, renderer }`; loop `requestAnimationFrame` render khối thử (1 box) để xác nhận pipeline.

- [ ] **Step 5: Verify dev + build**

Run: `npm run dev` mở browser thấy box xoay; Run: `npm run build` PASS, `npx vite preview` thấy game.
Expected: không lỗi console, `dist/index.html` tồn tại.

- [ ] **Step 6: Commit**

```bash
git add package.json vite.config.js index.html src/main.js src/style.css .gitignore
git commit -m "feat: scaffold vite three scene"
```

---

### Task 2: Player 3 làn + nhảy + trượt

**Files:**
- Create: `src/player.js`
- Modify: `src/main.js` (gắn player vào scene, gọi update)
- Test: manual play phím trái/phải/nhảy/trượt

**Interfaces:**
- Consumes: `scene` từ Task 1
- Produces: `createPlayer(scene) -> player`; `player.update(dt)`, `player.moveLane(dir)`, `player.jump()`, `player.slide()`; hằng `LANES = [-2, 0, 2]`.

- [ ] **Step 1: Implement `createPlayer` + lane/jump/slide trong `src/player.js`**

Signatures:
```js
export const LANES = [-2, 0, 2];
export function createPlayer(scene) -> player // { mesh, laneIndex, update(dt), moveLane(dir), jump(), slide(), getBounds() }
```
Lerp x về LANES[laneIndex] tốc độ 12/s; nhảy vy=8, gravity -25; trượt scale.y=0.5 trong 0.7s.

- [ ] **Step 2: Gắn vào main loop, verify bằng phím**

Run: `npm run dev`, bấm ←/→ đổi làn mượt, ↑ nhảy, ↓ trượt.
Expected: không kẹt giữa làn, không nhảy đôi trên không (chỉ nhảy khi grounded). Test clamp delta: chuyển tab 5s quay lại không xuyên sàn.

- [ ] **Step 3: Commit**

```bash
git add src/player.js src/main.js
git commit -m "feat: player lane jump slide"
```

---

### Task 3: World — đường ray, obstacle, coin + tái chế

**Files:**
- Create: `src/world.js`
- Modify: `src/main.js` (gắn world update)
- Test: manual chạy thấy tàu/rào/xu trôi về, không leak (FPS ổn định 60s)

**Interfaces:**
- Consumes: `player` (để né spawn đè player), scene
- Produces: `createWorld(scene) -> world`; `world.update(dt, speed)`; `world.getObstacles() -> [mesh]`, `world.getCoins() -> [mesh]`; `world.collectCoin(coin)`.

- [ ] **Step 1: Implement track + fog + lighting + pool trong `src/world.js`**

Signature: `createWorld(scene)`. Đường 3 ray dài lặp, 2 bên nhà/cột trang trí bằng box, fog che xa, hemisphere + directional light.

- [ ] **Step 2: Implement spawn pattern bảo đảm đường sống**

Thuật toán: mỗi 20m sinh pattern; chọn `safeLane` ngẫu nhiên kề được từ vị trí trước; 2 làn còn lại đặt obstacle ngẫu nhiên (low/high/train); rải coin dọc safeLane. Object pool tối đa 60 obstacle + 100 coin, tái chế thay vì dispose.

- [ ] **Step 3: Verify không spawn chết + không leak**

Run: `npm run dev` chạy 60s quan sát: luôn có đường qua, FPS không tụt dần (pool hoạt động), coin xoay.
Expected: PASS. Test resize: kéo cửa sổ méo rồi trả lại, scene không vỡ.

- [ ] **Step 4: Commit**

```bash
git add src/world.js src/main.js
git commit -m "feat: world track obstacles coins pool"
```

---

### Task 4: Input phím + swipe + pause

**Files:**
- Create: `src/input.js`
- Modify: `src/main.js` (bind input tới player + pause)
- Test: manual keyboard + device toolbar swipe

**Interfaces:**
- Consumes: `player`, callbacks `onPause`
- Produces: `bindInput(player, { onPause }) -> unbind`; hỗ trợ ArrowLeft/Right/A/D, ArrowUp/W/Space, ArrowDown/S, P/Esc pause.

- [ ] **Step 1: Implement `bindInput` phím + touch swipe**

Swipe: touchstart/touchend, ngưỡng 24px, phân biệt ngang/dọc. Chặn scroll mặc định trên canvas.

- [ ] **Step 2: Verify phím + swipe**

Run: `npm run dev` + device toolbar: vuốt trái/phải/lên/xuống ăn đúng hành động, P pause/resume.
Expected: PASS, không double-trigger.

- [ ] **Step 3: Commit**

```bash
git add src/input.js src/main.js
git commit -m "feat: keyboard touch input pause"
```

---

### Task 5: Game state + va chạm + điểm + UI/HUD

**Files:**
- Create: `src/ui.js`
- Modify: `src/main.js` (state menu/playing/gameover, collision, score, speed ramp), `index.html` (menu/gameover overlay), `src/style.css`
- Test: manual chơi → chết → chơi lại, highscore persists

**Interfaces:**
- Consumes: `player.getBounds()`, `world.getObstacles()`, `world.getCoins()`, `world.collectCoin()`
- Produces: `createUI() -> { setScore, setCoins, showMenu, showGameOver(score, best), showHUD }`; key `subway-mini-highscore`.

- [ ] **Step 1: Implement state + AABB collision + scoring trong `main.js`**

Mỗi frame khi playing: `speed = min(12 + elapsed*0.3, 30)`; `score += dt*speed` (1đ/m) + coin 10đ; AABB player vs obstacles → gameover; player vs coin (khoảng cách < 1) → collect.

- [ ] **Step 2: Implement `ui.js` + overlay HTML/CSS**

Start menu (tên game + hướng dẫn + nút Chơi), HUD (điểm, xu, best), Game Over (điểm, best, nút Chơi lại). Highscore localStorage.

- [ ] **Step 3: Verify full loop**

Run: `npm run dev`: menu → chơi → va chạm → game over → chơi lại; reload vẫn giữ best.
Expected: PASS. Test build trắng trang: `npm run build; npx vite preview` vẫn chơi được (pin Review Focus dòng 5).

- [ ] **Step 4: Commit**

```bash
git add src/ui.js src/main.js index.html src/style.css
git commit -m "feat: game state collision score UI"
```

---

### Task 6: Polish + hướng dẫn deploy free

**Files:**
- Create: `README.md` (cách chạy + deploy Vercel/Netlify/GitHub Pages/itch.io)
- Modify: `src/main.js`, `src/world.js` (fog/màu/ánh sáng tinh chỉnh, clamp delta 0.05)
- Test: `npm run build` + preview cuối

**Interfaces:**
- Consumes: toàn bộ tasks trên
- Produces: README deploy được, game 60fps, `dist/` sẵn sàng.

- [ ] **Step 1: Polish + clamp delta + pause khi ẩn tab**

`dt = min(clock.getDelta(), 0.05)`; `visibilitychange` tự pause.

- [ ] **Step 2: Viết README deploy**

Nội dung: `npm install; npm run dev`; build; 4 option free: Vercel (import repo, framework Vite), Netlify (build `npm run build`, publish `dist`), GitHub Pages (vite plugin hoặc branch dist), itch.io (zip dist).

- [ ] **Step 3: Final verify**

Run: `npm run build; npx vite preview` chơi 1 vòng full không lỗi console.
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add README.md src/main.js src/world.js
git commit -m "chore: polish and deploy docs"
```
