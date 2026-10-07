# Third-Party Assets

Mọi asset bên thứ ba trong `public/assets/` đều có entry ở đây. Không entry
= không ship. License không xác minh được = loại.

## runner-male (character chính)

- Asset: Universal Base Characters — Superhero Male + Universal Animation
  Library 1 & 2 (gộp 8 clips: Idle_Loop, Jog_Fwd_Loop, Jump_Start,
  Jump_Loop, Jump_Land, Slide_Start, Slide_Loop, Hit_Chest)
- Original creator: Quaternius
- Original source: https://quaternius.com/ và https://quaternius.itch.io/
  (Universal Base Characters, Universal Animation Library 1+2)
- GitHub source: https://github.com/NafisRayan/Animate-Rigged-Humanoid-No-Blender
  (rehost tệp gốc; commit `5821923af517ac5fdc82505faa92a0d575fc1b1a`;
  merge script trong repo đó chỉ dùng tham khảo, không chạy code lạ)
- License: CC0-1.0 (Quaternius công bố CC0 cho pack gốc; catalog xác minh
  2026-08-25 tại Free-Game-Dev-Assets)
- Files used: `test/human_male.glb` (35,190,592 bytes) → prune 78 clips thừa
  → WebP textures q85 → `public/assets/character/human_male.glb`
- Modifications: xóa 78 animation clips không dùng, dọn ~30k accessor chết
  (prune), nén texture WebP; không sửa geometry/skeleton/clip giữ lại
- Approx production size: 3.2 MB
