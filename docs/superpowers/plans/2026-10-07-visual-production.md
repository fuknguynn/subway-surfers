# Visual Production Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Production-grade visuals (GLB character + upgraded procedural env + redesigned UI) with zero gameplay changes, shippable on Vercel Free.

**Architecture:** New `AssetManager` (GLTFLoader + cache + fallback) feeds a `PlayerVisual` adapter (GLB child of the untouched player entity); trains/railway/city/vegetation upgraded procedurally through existing makers/pools; UI rewritten in place.

**Tech Stack:** Vite 5, Three.js 0.160 (`three/addons` GLTFLoader + SkeletonUtils), gltf-transform CLI (local conversion only), vanilla JS/CSS.

**Spec:** `docs/superpowers/specs/2026-10-07-visual-production-design.md`

## Global Constraints

- ZERO gameplay changes: lanes `[-2,0,2]`, physics numbers, `boxesOverlap` shrink 0.15, speed curve, patterns, fairness, scoring, coins, power-ups, touch, quality, pause.
- Hitboxes EXACTLY unchanged: player bounds (stand 1.9 / slide 0.7), obstacle `userData.half`/`elevated` semantics.
- Only CC0/permissive assets with verified source+license recorded in `THIRD_PARTY_ASSETS.md`; no entry = no ship; unclear license = reject.
- Normal Git/GitHub HTTPS only; sparse/selective checkout; never run unknown scripts from asset repos.
- Production payload: ideal <10MB, acceptable <15MB (network payload); no single unoptimized file >2MB in `public/assets/`.
- GLB fetched once and reused; skinned clones via `SkeletonUtils.clone()`; no root motion for gameplay.
- Quality profiles change decor only, never gameplay.

## Review Focus

- GLB stalls/fails on slow 4G: expect procedural fallback engages and game stays playable — pinned in Task 1 (loader timeout → fallback test).
- Retry/game-over duplicates AnimationMixers or models (memory leak): expect stable mixer/model counts across cycles — pinned in Task 2.
- GLB clip names differ from adapter map (e.g. no exact 'Slide'): expect loud dev-time failure listing actual clip names, never silent wrong animation — pinned in Task 2 (clip-name verification against downloaded GLB).
- Denser env occludes coins/power-ups/trains on 390px screen: expect gameplay layer always readable — pinned in Task 5 as manual screenshot gate (cannot be automated headless).
- Shipped payload exceeds budget (unoptimized GLB/textures slip into public/): expect audit blocks it — pinned in Task 0 (size gate) and Task 8 (payload audit).

---

### Task 0: Triage + verified downloads + conversion

**Files:**
- Create: `THIRD_PARTY_ASSETS.md`, `public/assets/character/human_male.glb`, `.gitignore` entry `assets-source/`
- Modify: none (read-only triage of working tree first)

**Interfaces:**
- Consumes: nothing.
- Produces: `public/assets/character/human_male.glb` (WebP-optimized, <8MB); `assets-source/` staging (gitignored); THIRD_PARTY_ASSETS entries with all 7 fields.

- [ ] **Step 1: Triage working tree** — `git diff --stat` + read `src/player.js`, `src/assets.js`; decide per hunk keep/revert in service of this plan; ledger the decision. (Uncommitted simplifications must not be silently destroyed.)
- [ ] **Step 2: Failing gate** — node script asserts `public/assets/character/human_male.glb` exists AND <8MB AND its GLB JSON chunk lists animations including run/jump/slide-or-crouch/idle/hit equivalents. Expected: FAIL (file missing).
- [ ] **Step 3: Download** — sparse checkout ONLY `test/human_male.glb` from NafisRayan repo into `assets-source/` (no full clone); record SHA. Do the same later per-asset, never whole repos.
- [ ] **Step 4: Convert** — `npx @gltf-transform/cli webp` locally to `public/assets/character/human_male.glb`; record before/after sizes; fill THIRD_PARTY_ASSETS.md (Quaternius CC0 origin, rehost provenance, clip list).
- [ ] **Step 5: Verify gate** — rerun Step 2 script. Expected: PASS. If clips missing/mismatch: STOP, report, do not proceed to Task 2.
- [ ] **Step 6: Commit** — `git add THIRD_PARTY_ASSETS.md public/assets/character/human_male.glb .gitignore; git commit -m "assets: quaternius runner glb webp + provenance"`

---

### Task 1: AssetManager + loading pipeline

**Files:**
- Create: `src/assetManager.js`
- Modify: `src/game.js` (progress → `ui.showLoading`), `src/ui.js` (only if progress hook missing)

**Interfaces:**
- Consumes: `ui.showLoading(pct)` / `hideLoading()` (exist).
- Produces: `createAssetManager({ loader }?) -> { loadModel(id,url), getModel(id), cloneModel(id), loadTexture(id,url), getTexture(id), onProgress(cb), dispose(id) }`; loader defaults to GLTFLoader, injectable stub in tests; single fetch per id; failure rejects (caller falls back).

- [ ] **Step 1: Failing test** — node imports `src/assetManager.js`. Expected: FAIL (missing).
- [ ] **Step 2: Implement registry** — Map id→{status,promise,scene}; `loadModel` caches in-flight + completed; `cloneModel` uses `SkeletonUtils.clone()` for skinned else `.clone()`; `onProgress` fans out loader progress; `dispose` removes + disposes geometries/materials/textures.
- [ ] **Step 3: Timeout→fallback test** — stub loader that never resolves + 3000ms timeout → `loadModel` rejects with `AssetTimeout`; game-side fallback path (procedural) asserted in Task 2 wiring. Expected: PASS.
- [ ] **Step 4: Wire progress** — game awaits character + essential models with progress into `showLoading`; PLAY enabled when core ready; any rejection → fallback, never blank screen. `npm run build` PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat: asset manager with cache progress fallback"`

---

### Task 2: GLB character + PlayerVisual adapter

**Files:**
- Create: `src/playerVisual.js`
- Modify: `src/player.js` (attach visual child, hide procedural rig when GLB active), `src/game.js` (mixer update + state mapping)

**Interfaces:**
- Consumes: `assetManager.cloneModel('runner')`, player flags (`grounded`, `slideTimer>0`, `justLanded`, lane dx).
- Produces: `createPlayerVisual(scene|parent) -> { setState('idle'|'run'|'jump'|'slide'|'hit'), update(dt), setLean(v), setModel(root, clips)|useFallback(), mixerCount() }`; crossfade 0.2s; no root motion (GLB child at local origin, gameplay moves `group`).

- [ ] **Step 1: Failing test** — node imports `src/playerVisual.js`. Expected: FAIL.
- [ ] **Step 2: Clip-name verification** — node reads shipped GLB JSON chunk, asserts required concepts (run, jump, crouch/slide, idle, hit-ish) each map to an actual clip name; print the chosen mapping. If any concept unmapped: FAIL loud (do not guess silently).
- [ ] **Step 3: Implement adapter** — AnimationMixer, crossfade map, `setLean` tilts visual child only, `update` advances mixer; `useFallback()` shows procedural rig (existing code path kept).
- [ ] **Step 4: Integrate** — player creates visual as child of `group` (position 0,0,0; scale to fit ≤1.9 height); game maps states (run default, jump on !grounded, slide on slideTimer, hit on gameOver, idle in menu); mixer updated in loop; load failure → fallback, game unaffected.
- [ ] **Step 5: No-dup test** — node with stubbed three scene: 5× create/dispose cycles → `mixerCount()` returns to 0, no throw. Hitbox regression: `getBounds()` JSON identical to pre-change. `npm run build` PASS.
- [ ] **Step 6: STOP gate (manual)** — run `npm run dev`, screenshot 390×844: character reads as designed protagonist? If NO: stop, report, pick another asset (do not continue to Task 3).
- [ ] **Step 7: Commit** — `git commit -m "feat: glb runner with visual adapter and fallback"`

---

### Task 3: Logging trains (procedural, adapter-ready)

**Files:**
- Modify: `src/world.js` (train maker only), `src/assets.js` (wood/log materials if needed)

**Interfaces:**
- Consumes: existing `makers.train` slot + pool (`obtain`/`release`), `userData.half` contract.
- Produces: same `userData.half`/`kind` values (2.4 height, lengths 8–14); 2–3 wood-tone variants.

- [ ] **Step 1: Failing check** — node asserts train visual includes log load + undercarriage/wheels (child kinds). Expected: FAIL.
- [ ] **Step 2: Implement** — wooden logging car: log load (cylinders), cabin, headlight emissive pair, undercarriage + wheel suggestions; 2–3 wood liveries; keep `half`/`elevated` EXACT.
- [ ] **Step 3: Verify** — hitbox semantics JSON identical (train [2.4,0]); pool warm-up stable; fairness DP walk still passes (reuse scripts/check-mobile.mjs cases); build PASS.
- [ ] **Step 4: Commit** — `git commit -m "feat: logging train variants, hitbox unchanged"`

---

### Task 4: Railway upgrade

**Files:**
- Modify: `src/world.js` (rails/sleepers/ballast/props), `src/assets.js` (steel/concrete/pole mats if missing)

**Interfaces:** same pool/update/reset contracts; new InstancedMeshes follow sleepers pattern (matrix updates, no alloc).

- [ ] **Step 1: Implement** — steel rails (metalness 0.6), ballast bed strip, signals, electrical cabinets, track signs, fences, maintenance props; repeated items instanced; horizon perspective via fog-tuned spacing.
- [ ] **Step 2: Verify** — draw-call delta ≤+10 vs Task 3 baseline (headless traverse); no gameplay file touched except visuals; build PASS.
- [ ] **Step 3: Commit** — `git commit -m "feat: railway detail with instancing"`

---

### Task 5: Forest chunks + themes + vegetation

**Files:**
- Create: `src/forest.js` (chunk builders + theme composer)
- Modify: `src/world.js` (consume chunks instead of houseMeshes), `src/assets.js` (wood/rock/leaf mats)
- Download (this task): Kenney natureKit subset (3 trees, 2 bushes, 2 grass, 2 rocks GLBs) → `public/assets/vegetation/` + THIRD_PARTY_ASSETS entry

**Interfaces:**
- Consumes: world scroll (`dz`), distance, quality profile.
- Produces: `createForest(scene) -> { update(dz, distanceM, density), setTheme(name) }`; chunks ForestDenseA/B, LoggingCampA, CliffPassA, MeadowOutskirtsA; themes Downtown/Industrial/Station/Green switch by distance band (visual only); forest themes instead; vegetation counts scale by profile (LOW fewer); nothing occludes lanes (max height near lanes <1.2m except at |x|>4).

- [ ] **Step 1: Failing check** — node imports `src/forest.js`. Expected: FAIL.
- [ ] **Step 2: Download + record** — sparse checkout ONLY the 9 named natureKit GLBs; sizes recorded; any file >500KB → webp/compress or reject.
- [ ] **Step 3: Implement chunks + themes** — forest chunks from shared parts + natureKit GLBs; instanced repetition; theme composer picks chunk mix per distance band (visual only).
- [ ] **Step 4: Verify** — occlusion rule test (near-lane props height check); build PASS; manual screenshot gate at 390×844: 6 depth layers visible, gameplay readable (Review Focus item 4 pinned here as manual PASS/FAIL in commit message).
- [ ] **Step 5: Commit** — `git commit -m "feat: forest chunks themes vegetation"`
- Barriers reskin: low = boulder/log (jump), high = fallen trunk overhead (slide); hitbox EXACT (implemented in Task 5 Step 3).

---

### Task 6: Lighting + camera composition + materials

**Files:**
- Modify: `src/world.js` (lights/fog numbers), `src/camera.js` (base pos/FOV), `src/assets.js` (roughness/metalness/emissive pass)

**Interfaces:** light count stays 2; camera API unchanged; gameplay untouched.

- [ ] **Step 1: Implement** — tune sky/ground/light/fog; camera base closer/taller for 390×844 (player ~25–40% larger, lanes + next obstacle still visible); material differentiation pass.
- [ ] **Step 2: Verify** — node: light count == 2, no `shadowMap.enabled`, FOV math spot checks; build PASS; manual screenshot gate (focal hierarchy, empty sky reduced).
- [ ] **Step 3: Commit** — `git commit -m "feat: lighting camera materials retune"`

---

### Task 7: UI redesign

**Files:**
- Modify: `src/ui.js`, `src/style.css`, `index.html` (only if roots needed)

**Interfaces:** `createUI` handler contract unchanged (`onStart/onHome/onMute/muted/onPauseBtn`); method names unchanged; safe-area kept.

- [ ] **Step 1: Implement** — HUD (big score, coin icon+counter, compact timers, 48px pause, small mute), menu (title + PLAY + best + backdrop), game-over (stats + RETRY/HOME); type hierarchy, rounded, gradients, press animation, spacing.
- [ ] **Step 2: Verify** — build PASS; manual 390×844 gate: looks like a real mobile game HUD, no crowding, buttons ≥44px.
- [ ] **Step 3: Commit** — `git commit -m "feat: redesigned mobile game ui"`

---

### Task 8: Perf pass + payload audit + final test

**Files:**
- Modify: bottlenecks only (never gameplay); extend `scripts/check-mobile.mjs`; `README.md` results.

**Interfaces:** none new.

- [ ] **Step 1: Measure** — headless draws/tris/heap-cycles (extend existing script), `dist/` + `public/assets/` payload audit vs <10MB ideal/<15MB max; degrade order respected (decor→veg→distance→particles→resolution).
- [ ] **Step 2: Fix top bottlenecks only**, re-measure after each.
- [ ] **Step 3: Test matrix** — §26 checklist (loading, no missing assets, no console errors, anim transitions, no mixer/model dup on retry, memory flat, collision/swipe/DPR/quality unchanged, FPS ok); 360×800/390×844/412×915.
- [ ] **Step 4: Screenshot gate** — 390×844 representative shot vs the 10 §27 questions; NO = continue visual pass (new commits, not scope creep).
- [ ] **Step 5: Final `npm run build` + preview PASS; commit** — `git commit -m "chore: perf audit final test"`
