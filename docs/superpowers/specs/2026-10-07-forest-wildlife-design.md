# Forest Environment Final Upgrade + Wildlife — Design Spec

Date: 2026-10-07
Mode: full upfront, ONE spec + ONE plan, continuous execution.
Base: Lab project on `feat/mobile-upgrade` (forest concept, GLB runner live).
Prior specs: visual-production-design (forest concept), mobile-upgrade-design.

## 0. Absolute rules

- ZERO gameplay changes (physics, lanes, collision, hitboxes, speed,
  difficulty, generation, fairness, scoring, coins, power-ups, touch,
  quality, pause). Visual-only pass.
- GLB required for major visible scenery; primitives only for invisible
  helpers/debug/tiny details. No fake cone-trees.
- Normal Git/GitHub HTTPS only; sparse checkout; never run unknown repo scripts.
- Unverified license = reject. Missing asset = report, never ugly placeholder.

## 1. Verified sources (scouted)

- `agentkaerf/FreeModels` (Quaternius CC0 rehost, README + per-pack
  License.txt state CC0-1.0): `Ultimate Animated Animals - July 2021/glTF/`
  `Deer.gltf`, `Stag.gltf`, `Fox.gltf`, `Wolf.gltf` (+ .bin). Animations
  assumed (pack name) — VERIFY clip names after download, adapt mapping.
- Same repo fallback: `Stylized Nature MegaKit[Standard]`,
  `Ultimate Stylized Nature - May 2022` (only if Kenney gaps hurt).
- Kenney mirror (CC0): natureKit trees/rocks/bushes/grass/flowers/tents/
  bridges/logs/stumps/mushrooms, `stone_mountain.glb` (hexagonkit),
  `sign.glb`, `fence_*` as needed. Selective files only.
- MISSING (reported, not faked): rabbit, boar, birds, squirrel, butterfly
  GLBs; wooden cabin GLB; railway lamp GLB; fern GLB. Recorded as
  wanted/missing in THIRD_PARTY_ASSETS.md.

## 2. Scale (player = reference, ~1.75m visual)

- Normalize EVERY GLB via runtime Box3: fence 1–1.5m, bush 0.5–2m, small
  tree 4–7m, forest tree 8–15m, large tree 15–25m+, cabin/tent human-sized,
  signs/poles human-relative, rocks 0.3m–several m, hills hundreds of m,
  mountains MASSIVE and far. Never trust source units; consistent across packs.

## 3. Depth layers + background + terrain

- L1 trackside (fence/grass/bush/rock/sign/equipment/fallen log, detailed).
- L2 near forest (large trees framing view, believable scale).
- L3 mid forest (dense groups, lower detail). L4 distant masses (low contrast).
- L5 hills/rock formations. L6 mountain ranges + haze + sky.
- `stone_mountain.glb` scaled huge + far; atmospheric perspective
  near-strong → far-hazy via fog; sky reduced but present.
- Terrain variation outside lanes (slopes/hills/rocky/dirt banks) via displaced
  ground geometry (terrain, not an object) dressed with GLB rocks/cliffs/
  vegetation; railway stays gameplay-flat. No flat-green-plane look.
- Fences varied: sections on/off, broken/tilted posts, overgrowth, signs
  interleaved. Camp: tents + campfire + log stacks + procedural lamp posts
  (minor detail exception) + wooden signs.

## 4. Themes (visual only, rotate by distance)

- Dense Forest, Rocky Forest, Mountain Forest, Cabin Area, Bridge/River
  (natureKit wood bridge + water strip visual + rocks), Misty Forest
  (denser fog + desat). Never touch difficulty/spawn/fairness.
- Railway embedded: gravel/dirt/grass transition, bushes, scattered rocks,
  equipment, signs.

## 5. Wildlife (`src/wildlife.js`, visual-only)

- Species: deer + stag (uncommon), fox (rare), wolf (very rare). No collision,
  no lane entry (|x|≥6), never blocks gameplay/coins.
- Behaviors: graze/idle between trees, slow walk parallel then despawn.
  Animations idle/walk/run/eat where clips exist, crossfaded; else static.
- One mixer per species max; LOW quality halves counts + disables distant
  anim. Load once, cache, pool 2–3 per species, recycle out of range.
- Scale normalized at load (deer/stag shoulder ~1.2m, fox ~0.4m, wolf ~0.8m).

## 6. Perf + readability + done

- GLB cache/shared/instancing (veg already instanced; animals pooled clones),
  frustum culling default, quality density, distant = simple.
- Degrade order unchanged (decor→veg→distance→particles→resolution).
- Corridor stays clean; density outside lanes; readability over count.
- Tests: 360×800/390×844/412×915 + loading/assets/console/anim/retry-leak/
  memory/collision/swipe/DPR/quality/FPS + `npm run build`.
- Done = 390×844 screenshot YES to all 10 §18 questions (dense, scaled,
  layered, no green plane, horizon continues, massive mountains, less sky,
  embedded railway, readable gameplay, smooth). Build-pass alone ≠ done.

## 7. Execution

- Single plan: assets+scale → depth/background/terrain → themes/railway →
  wildlife → perf/test/gates. Reuse `npm run check:mobile`, extend with
  wildlife/scale/payload checks.
