# 🚇 Subway Surfers Mini 3D

Game endless-runner 3 làn kiểu Subway Surfers bằng Three.js: đổi làn, nhảy, trượt, né tàu, nhặt xu. Không backend — điểm cao lưu trên trình duyệt.

## Chạy local

```bash
npm install
npm run dev
```

Mở URL hiện ra (thường là http://localhost:5173). Điều khiển:

| Phím | Vuốt mobile | Hành động |
|------|-------------|-----------|
| ← / → (A/D) | vuốt ngang | đổi làn |
| ↑ / W / Space | vuốt lên | nhảy |
| ↓ / S | vuốt xuống | trượt |
| P / Esc | — | tạm dừng |

## Build

```bash
npm run build   # ra thư mục dist/ tĩnh
npx vite preview  # kiểm tra bản build trước khi deploy
```

## Deploy miễn phí

`dist/` là web tĩnh, host ở đâu cũng được. 4 cách free phổ biến:

**1. Vercel (khuyên dùng)**
- Push repo lên GitHub → [vercel.com](https://vercel.com) → Import → Framework preset: Vite → Deploy. Mỗi lần push là tự deploy lại.

**2. Netlify**
- Kéo-thả thư mục `dist/` lên [app.netlify.com/drop](https://app.netlify.com/drop), hoặc nối repo GitHub với Build command `npm run build`, Publish directory `dist`.

**3. GitHub Pages**
- Build local, push nội dung `dist/` lên branch `gh-pages` (hoặc dùng GitHub Actions chạy `npm run build`), bật Pages trong Settings → có URL `https://<user>.github.io/<repo>/` (đã set `base: './'` nên chạy được sub-path).

**4. itch.io**
- Zip nội dung thư mục `dist/` → tạo project mới kiểu HTML → upload zip, tick "This file will be played in the browser" → chơi ngay trong trang itch.io.

## Cấu trúc code

- `src/main.js` — bootstrap + loading (mỏng)
- `src/game.js` — orchestrator: loop, state, substep chống tunneling, điểm, va chạm
- `src/player.js` — streetwear runner: đổi làn / nhảy / trượt / animation
- `src/world.js` — đường ray, tàu, rào, xu + tái chế object (pool), InstancedMesh
- `src/patterns.js` — pattern + DifficultyManager, fairness chứng minh được
- `src/input.js` — phím + swipe (1 action/gesture, lock tới touchend)
- `src/camera.js` — rig follow, FOV theo tốc độ, dip/shake clamp cho mobile
- `src/quality.js` — DPR cap (mobile 1.5) + adaptive render scale có hysteresis
- `src/particles.js` — pool burst (xu/tiếp đất/đâm), zero-alloc loop
- `src/audio.js` — SFX WebAudio procedural, lazy sau chạm đầu, có mute
- `src/powerups.js` — magnet / shield / 2x, timer freeze khi pause
- `src/assets.js` — geometry/material dùng chung, palette player nổi bật
- `src/ui.js` — HUD mobile-first, menu, game over, kỷ lục localStorage

## Perf (đo headless + build)

- `dist/` ~490KB (~127KB gzip) — dưới xa budget 5–8MB.
- Draw calls ~115 (shader đơn giản), triangles ~3k — nhẹ.
- Heap phẳng qua 5 chu kỳ play→die→retry (+2.2%, nhiễu).
- Spawn fairness: 2100 proof-case + DP walk qua stream — 0 vi phạm.
- `npm run build` PASS, `vite preview` HTTP 200, console sạch ở mức build.

## Test matrix

Tự động (node headless): touch lock/expiry, quality hysteresis, substep
chống tunneling, pattern proof, pool tái chế, timer freeze — PASS.
Thủ công trên thiết bị thật (360×800, 390×844, 412×915): start, swipe,
jump/slide, gesture nhanh, va chạm, game over, retry, ẩn tab, resize, xoay
màn — cần chơi thử trên điện thoại để xác nhận cuối.
