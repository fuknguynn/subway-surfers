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

## kenney-naturekit (vegetation + cliff + logs)

- Asset: Kenney Nature Kit v2.1 (chọn 11/300+ files: tree_pineTallA,
  tree_pineTallB, tree_oak, plant_bushLarge, plant_bushSmall, grass_large,
  grass_leafs, rock_largeA, rock_smallA, cliff_rock, log_stack)
- Original creator: Kenney (kenney.nl)
- Original source: https://kenney.nl/assets/nature-kit
- GitHub source: https://github.com/ETdoFresh/kenney.nl (mirror, CC0 quoted
  từ kenney.nl; sparse checkout đúng 11 files .glb, không clone cả repo)
- License: CC0-1.0
- Files used: `public/assets/vegetation/*.glb` (11 files, tổng ~90KB)
- Modifications: không (dùng nguyên bản, instance lại trong game)
- Approx production size: 0.1 MB

## quaternius-animated-animals (wildlife)

- Asset: Ultimate Animated Animals (Deer, Stag, Fox, Wolf — mỗi con giữ
  Idle, Walk, Gallop, Eating; Deer/Stag 13→4 clips, Fox/Wolf 12→4 clips)
- Original creator: Quaternius
- Original source: https://quaternius.com/ (Ultimate Animated Animals pack)
- GitHub source: https://github.com/agentkaerf/FreeModels
  (`Ultimate Animated Animals - July 2021/glTF/*.gltf`, License.txt trong
  pack ghi CC0-1.0; sparse checkout đúng 4 files)
- License: CC0-1.0
- Files used: `public/assets/wildlife/{deer,stag,fox,wolf}.glb`
  (1.7–1.9MB mỗi con sau prune)
- Modifications: xóa clips không dùng + prune accessor chết; không sửa
  geometry/skeleton/clip giữ lại
- Approx production size: 7.1 MB

## kenney-props (camp/scenery nhỏ)

- Asset: Nature Kit v2.1 (tent_detailedOpen, campfire_logs, bridge_wood,
  sign, flower_redA, flower_yellowA, mushroom_red, mushroom_tan,
  stump_round, stump_old) + hexagonkit stone_mountain
- Original creator: Kenney (kenney.nl)
- Original source: https://kenney.nl/assets/nature-kit
- GitHub source: https://github.com/ETdoFresh/kenney.nl (mirror, CC0 quoted
  từ kenney.nl; sparse checkout đúng 11 files .glb)
- License: CC0-1.0
- Files used: `public/assets/props/*.glb` (đổi tên ngắn: tent, campfire,
  bridge_wood, sign, flower_red/yellow, mushroom_red/tan, stump_round/old,
  mountain)
- Modifications: không (dùng nguyên bản)
- Approx production size: 0.1 MB

## wanted/missing (chưa có nguồn GLB, KHÔNG fake)

- rabbit, wild boar, birds, squirrel, butterfly (wildlife)
- wooden cabin (camp) — dùng tent thay thế
- railway lamp — bỏ hẳn, không chế cột đèn procedural
- fern — dùng grass/bush thay thế
