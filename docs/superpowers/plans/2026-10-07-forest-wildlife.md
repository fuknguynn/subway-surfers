# Forest Final Upgrade + Wildlife Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dense, correctly-scaled forest with GLB scenery, background mountains, 6 themes, and visual-only wildlife — zero gameplay changes.

**Architecture:** Extend `forest.js` (depth layers, themes, terrain) with new GLB sets via existing `AssetManager`; new `wildlife.js` manager (pooled, capped animated instances); procedural cabin/lamp statics removed in favor of GLB tents/campfire.

**Tech Stack:** Vite 5, Three.js 0.160, gltf-transform CLI (local conversion), vanilla JS.

**Spec:** `docs/superpowers/specs/2026-10-07-forest-wildlife-design.md`

## Global Constraints

- ZERO gameplay changes: physics, lanes, collision, hitboxes, speed, difficulty, generation, fairness, scoring, coins, power-ups, touch, quality, pause.
- Player visual reference ~1.75m; normalize EVERY GLB via runtime Box3: fence 1–1.5m, bush 0.5–2m, small tree 4–7m, forest tree 8–15m, large tree 15–25m+, signs/poles human-relative, rocks 0.3m–several m, hills hundreds of m, mountains MASSIVE and far.
- Only verified CC0 assets with THIRD_PARTY_ASSETS.md entries (7 fields); sparse checkout; no unknown scripts; missing = reported (rabbit/boar/birds/squirrel/butterfly/cabin/lamp/fern), never faked.
- Major visible props GLB-only; procedural only for tiny secondary decor.
- Wildlife visual-only: no collision, |x|≥6, never blocks track/gameplay.
- Mixers: one per actively animated animal instance when required; global cap (LOW stricter); pool/reuse with instances.
- Payload: ideal <10MB, acceptable <15MB; no unoptimized file >2MB in public/.

## Review Focus

- Animal GLB loads but clips missing/misnamed: expect loud dev failure listing actual clips, game runs without that species — pinned in Task 0 (clip inspection gate).
- Wolf/fox wanders into lanes (|x|<6) via bad slot: expect placement assertion blocks it — pinned in Task 3 (slot x-range test).
- Theme switch pops fog locked mid-fade: expect fog transitions smooth, no hard cut visible in normal play — pinned in Task 2 (fog-lerp test).
- Distant mountain GLB renders tiny/near (wrong scale): expect scale audit pins every backdrop asset ≥ thresholds — pinned in Task 1.
- Dense veg + animals tank LOW-end FPS: expect LOW density halves counts and disables distant anim — pinned in Task 4 (budget test).

---

### Task 0: Downloads + scale table + clip inspection

**Files:**
- Create: `public/assets/wildlife/{deer,strag,fox,wolf}.glb` (+.bin if separate), `public/assets/props/{tent,campfire,bridge,mountain,sign,flowers,mushrooms,stumps}.glb`, THIRD_PARTY_ASSETS entries
- Stage in: `assets-source/` (gitignored)

**Interfaces:**
- Consumes: FreeModels + Kenney mirror (sparse checkout).
- Produces: shipped files + `SCALE_TABLE` (id → target height m) recorded in THIRD_PARTY_ASSETS + `scripts/check-assets.mjs` gate (exists, size caps, clip names listed).

- [ ] **Step 1: Failing gate** — `node scripts/check-assets.mjs` asserts each planned file exists, each <2MB, total <15MB, animal GLBs list ≥1 animation. Expected: FAIL (files missing).
- [ ] **Step 2: Download** — sparse checkout ONLY: `Ultimate Animated Animals - July 2021/glTF/{Deer,Stag,Fox,Wolf}.gltf` (+bin), natureKit `{tent_detailedOpen,campfire_logs,bridge_wood,sign,flower_redA,flower_yellowA,mushroom_red,mushroom_tan,stump_round,stump_old}.glb`, hexagonkit `stone_mountain.glb`; record SHAs.
- [ ] **Step 3: Convert/optimize** — webp textures where needed; prune nothing gameplay-relevant; record before/after + clip names per animal (inspect JSON chunk).
- [ ] **Step 4: Verify gate** — rerun Step 1. Expected: PASS. Missing animations for a species → record + that species static-or-skipped (loud, not silent).
- [ ] **Step 5: Commit** — `git add public/assets THIRD_PARTY_ASSETS.md scripts/check-assets.mjs; git commit -m "assets: wildlife props mountains provenance"`

---

### Task 1: Scale normalization + deployment helper

**Files:**
- Create: `src/scaleTable.js` (id → target height m + notes)
- Modify: `src/assetManager.js` (only if a `getSize()` helper is needed; else untouched)

**Interfaces:**
- Produces: `TARGET_HEIGHTS = { deer: 1.2, stag: 1.3, fox: 0.45, wolf: 0.85, tree: 8-15 bands, mountain: 300, ... }`; `normalizeToHeight(root, targetM) -> appliedScale` (Box3 measure, feet to y=0).

- [ ] **Step 1: Failing test** — node imports `src/scaleTable.js` + asserts mountain entry ≥200 and fence entry ≤1.5. Expected: FAIL (missing).
- [ ] **Step 2: Implement** table + helper (pure three math, headless-testable).
- [ ] **Step 3: Verify** — every shipped GLB id has an entry; backdrop assets pass minimum scale audit (mountain ≥200m, hills ≥80m). `npm run build` PASS.
- [ ] **Step 4: Commit** — `git commit -m "feat: asset scale normalization table"`

---

### Task 2: Depth layers + background + terrain + fences

**Files:**
- Modify: `src/forest.js` (layers L2–L6, background rig, terrain), `src/world.js` (fence variation sections only), `src/assets.js` (only if tiny decor mats needed)

**Interfaces:** `forest.update(dt, speed, distanceM)` signature unchanged; new internal layers; fog control via existing `scene.fog` (+ density param for misty theme).

- [ ] **Step 1: Implement background rig** — mountain instances far (scale per table), hill silhouettes, haze via fog; L2 near trees tower (8–15m); terrain displacement outside lanes (gameplay-flat kept).
- [ ] **Step 2: Fog-lerp test** — node: theme switch over 60 simulated frames never jumps color distance > ε per frame. Expected: PASS.
- [ ] **Step 3: Fence variation** — sections on/off/broken (tilt/offset instances)/overgrowth/signs interleave; all recycled, no alloc.
- [ ] **Step 4: Verify** — headless draw/tris delta recorded; occlusion rule still passes; build PASS; manual 390×844 gate (sky reduced, horizon continuous).
- [ ] **Step 5: Commit** — `git commit -m "feat: forest depth background terrain"`

---

### Task 3: Themes + railway + camp GLB swap

**Files:**
- Modify: `src/forest.js` (6 themes, misty fog density), `src/world.js` (remove procedural cabin/lamp/pole statics; railway gravel/dirt/grass transitions)

**Interfaces:** `themeAt()` gains bridge/river + misty bands; `forest.setTheme` unchanged signature.

- [ ] **Step 1: Implement** — 6 themes (dense/rocky/mountain/cabin/bridge-river/misty); camp = tent + campfire + log GLBs; bridge scene with water strip + rocks on river theme bands; railway bed transitions.
- [ ] **Step 2: Verify** — theme rotation over 2000m hits all 6; slot x-range test (|x|≥6 for wildlife-adjacent props; gameplay corridor |x|<4.5 untouched); build PASS; manual screenshot gate per theme.
- [ ] **Step 3: Commit** — `git commit -m "feat: six forest themes railway camp"`

---

### Task 4: Wildlife system

**Files:**
- Create: `src/wildlife.js`
- Modify: `src/game.js` (create/update wiring only), `THIRD_PARTY_ASSETS.md` (missing list)

**Interfaces:**
- Consumes: `assetManager` (load once, clone per instance), player z (despawn ahead/behind), quality profile.
- Produces: `createWildlife(scene, assets, {quality}) -> { update(dt, speed, playerBounds), counts(), animatedCount() }`; species deer/stag (uncommon), fox (rare), wolf (very rare); graze/idle + slow walk; |x|≥6 enforced at spawn; global animated-instance cap (MEDIUM 4, LOW 2, HIGH 6); mixers pooled with instances, disposed on recycle.

- [ ] **Step 1: Failing test** — node imports `src/wildlife.js`. Expected: FAIL.
- [ ] **Step 2: Implement** — load-once/clone-per-instance, rarity scheduler, graze/walk states, parallel drift + despawn, scale normalize at load, mixer cap + pooling, LOW reductions.
- [ ] **Step 3: Verify** — 2000 simulated spawns: zero with |x|<6; animatedCount never exceeds cap; 10 create/dispose cycles mixer-balanced; missing-clip species degrades to static (loud log); suite + build PASS.
- [ ] **Step 4: Commit** — `git commit -m "feat: visual-only forest wildlife"`

---

### Task 5: Perf + validation + gates

**Files:**
- Modify: `scripts/check-mobile.mjs` (extend), `README.md` (results)
- Manual: 390×844 screenshot vs 10 §18 questions; 360×800/412×915 sanity; §26-style checklist.

**Interfaces:** none new.

- [ ] **Step 1: Measure** — draws/tris headless, heap cycles, payload audit (now incl. new assets), FPS notes from device playtest.
- [ ] **Step 2: Fix bottlenecks per degrade order** (decor→veg→distance→particles→resolution), re-measure.
- [ ] **Step 3: Screenshot gate** — 10 questions all YES or continue visual pass (new commits, same task).
- [ ] **Step 4: Final `npm run build` + preview PASS; commit** — `git commit -m "chore: forest final perf validation"`
