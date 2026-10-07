# Subway Surfers Mini 3D — Design Spec

Date: 2026-10-07
Approach: B — Vite + Three.js (npm), static site deploy free

## 1. Mục tiêu
- Game endless-runner 3 làn kiểu Subway Surfers, góc nhìn thứ 3 sau lưng.
- Đơn giản: 1 người chơi, không backend, không tài khoản.
- Deploy miễn phí (Vercel / Netlify / GitHub Pages / itch.io) từ thư mục `dist/`.

## 2. Kiến trúc
- Vite + Three.js (npm dependency, không dùng CDN lúc runtime).
- Cấu trúc:
  - `index.html` — mount point, HUD overlay, menu.
  - `src/main.js` — khởi tạo scene/camera/renderer, game loop, quản lý state (menu/playing/gameover/pause).
  - `src/player.js` — nhân vật (box/capsule), đổi làn (lerp x), nhảy (vận tốc y + trọng lực), trượt (scale y + timer).
  - `src/world.js` — đường ray, tàu/rào (obstacle), xu (coin); spawn theo đoạn, tái chế object (pool), dọn rác sau camera.
  - `src/input.js` — bàn phím (←/→/A/D đổi làn, ↑/W/Space nhảy, ↓/S trượt, P pause) + swipe touch.
  - `src/ui.js` — HUD điểm/xu, màn hình start/game-over, nút chơi lại, highscore.
- Điểm cao lưu `localStorage` key `subway-mini-highscore`.

## 3. Gameplay
- 3 làn: x = -2, 0, 2. Player đứng yên z, thế giới/obstacle di chuyển về phía camera (hoặc player tiến z, camera follow — chọn 1 và giữ nhất quán).
- Tốc độ khởi đầu ~12 m/s, tăng dần theo thời gian, cap tối đa.
- Spawn: mỗi đoạn 20m sinh 1 pattern obstacle, đảm bảo ít nhất 1 làn trống có thể tới được từ vị trí hiện tại.
- Obstacle loại: rào thấp (nhảy qua), rào cao (trượt qua), tàu dài (phải đổi làn).
- Coin: hàng dọc theo làn trống, ăn được +10 điểm, hiệu ứng xoay.
- Va chạm: AABB đơn giản (Box3 hoặc so sánh khoảng cách). Va chạm = game over.
- Điểm: quãng đường (1đ/m) + xu. Hiển thị realtime.

## 4. Đồ họa / Âm thanh
- Three.js: đèn hemisphere + directional, sương mù (fog) che cuối đường, màu sắc tươi.
- Không model ngoài — dùng hình khối (box/cylinder) để giữ repo nhẹ, zero asset.
- Không âm thanh ở bản đầu (để đơn giản, tránh asset). Có thể thêm WebAudio beep sau.

## 5. Deploy miễn phí
- `npm run build` → `dist/` tĩnh.
- Vercel (khuyên dùng): import repo → framework Vite → deploy tự động. Hoặc Netlify / GitHub Pages / itch.io (upload zip `dist/`).
- Không cần env var, không server.

## 6. Test / Nghiệm thu
- `npm run dev` chơi được bằng phím, swipe test bằng device toolbar.
- Không crash khi tab ẩn/hiện (clamp delta time).
- `npm run build` thành công, preview `dist/` chạy được.
- Tốc độ 60fps trên laptop phổ thông, không rớt dưới 30fps.

## 7. Ngoài phạm vi (v1 không làm)
- Multiplayer, leaderboard online, nhân vật/ván trượt mua được, âm nhạc, model 3D chi tiết.
