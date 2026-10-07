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

- `src/main.js` — state menu/playing/gameover, va chạm, điểm, tốc độ tăng dần
- `src/player.js` — đổi làn / nhảy / trượt
- `src/world.js` — đường ray, tàu, rào, xu + tái chế object (pool)
- `src/input.js` — phím + swipe
- `src/ui.js` — HUD, menu, game over, kỷ lục localStorage
