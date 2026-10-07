# Mobile-Web-First Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the existing Subway Mini 3D game to mobile-web-first (portrait, touch, stable FPS) through restructure + phases 1–7, playable after every phase.

**Architecture:** Extract a `Game` orchestrator (`src/game.js`) holding loop/state/substeps; keep player/world/input/ui public APIs stable; add one-responsibility modules (camera, quality, patterns, audio, particles, powerups, assets).

**Tech Stack:** Vite 5, Three.js 0.160+ (npm), vanilla JS, procedural WebAudio, zero external assets.

**Spec:** `docs/superpowers/specs/2026-10-07-mobile-upgrade-design.md`

## Global Constraints

- Existing behavior preserved: 3 lanes `LANES = [-2, 0, 2]`, lane/jump/slide physics numbers, AABB `boxesOverlap` shrink 0.15, safe-path rule, pooling, `subway-mini-highscore` key, Vite static `dist/` deploy.
- Mobile DPR cap 1.5, desktop DPR cap 2.0.
- Quality adaptivity: at most one render-scale/quality change per 8s cooldown; step down when avg frame >22ms over ~120 frames; step up only after avg frame <14ms over ~600 frames.
- Touch: threshold 24 CSS px, max gesture 500ms, exactly one action per gesture, gesture locked until touchend/touchcancel, 2nd finger ignored.
- Simulation: delta clamp 0.05; movement + collision in fixed substeps of at most ~1/60s per frame, collision checked per substep.
- Graphics quality NEVER changes gameplay (speed, spawn, collision, difficulty, fairness).
- No external assets (no PNG/GLB/WAV/video); procedural geometry + WebAudio only.
- Portrait-first; HUD respects `env(safe-area-inset-*)`; touch targets >=44px.
- Each phase ends with `npm run build` PASS + playable checkpoint.

## Review Focus

- Rapid consecutive swipes mid-lerp: expect one lane step per swipe, no lost input, no double-step — pinned in Task 2 swipe test.
- Long-press then drag (>500ms hold before moving): expect NO action fires (expired gesture) — pinned in Task 2.
- Orientation flip portrait<->landscape mid-run: expect camera/HUD reframe, no overlap, no state loss — pinned in Task 2 resize/orientation check.
- Phone lock during play (AudioContext suspended): expect resume with no exception and sound working — pinned in Task 6 audio test.
- Power-up timer across pause/hidden tab: expect timers freeze, never free benefit nor instant expiry — pinned in Task 7 power-up test.

---

### Task 0: Extract Game orchestrator (restructure)

**Files:**
- Create: `src/game.js`
- Modify: `src/main.js` (thin bootstrap: loading -> createGame -> menu)

**Interfaces:**
- Consumes: `createPlayer`, `createWorld`, `boxesOverlap`, `bindInput`, `createUI` (unchanged signatures).
- Produces: `createGame(container) -> game`; `game.start()`, `game.getState() -> 'menu'|'playing'|'paused'|'gameover'`; internal `step(dt)` runs substeps of at most 1/60s; `BASE_SPEED=12`, `MAX_SPEED=30`, `SPEED_RAMP=0.35`, `COIN_SCORE=10` move unchanged into game.js.

- [ ] **Step 1: Write the failing check** — node script imports `src/game.js`; Expected: FAIL with "Cannot find module".
- [ ] **Step 2: Implement `createGame`** in `src/game.js`: owns scene/camera/renderer, RAF loop, `menu/playing/paused/gameover` states, `paused` flag, dt clamp 0.05, fixed-substep simulation (slice dt into chunks <=1/60, run player/world/collision per chunk), visibilitychange auto-pause, resize handler, speed/score/coins/best with same `localStorage` guards. Move collision + coin-pickup code verbatim from `main.js:109-144`.
- [ ] **Step 3: Thin `main.js`**: get `#app`, call `createGame`, show menu. Keep `if (typeof document !== 'undefined')` guard.
- [ ] **Step 4: Verify** — node: substep counter test (drive `step(0.05)` with instrumented counter OR assert 0.05s runs 3 substeps via exported `SUBSTEP_MAX=1/60` math); `npm run build` PASS.
- [ ] **Step 5: Anti-tunnel proof** — node sim: obstacle thin in z (0.1) at speed 30, dt 0.05: assert collision detected (would be missed with single-step). Expected: PASS.
- [ ] **Step 6: Commit** — `git add src/game.js src/main.js; git commit -m "refactor: extract game orchestrator with substep loop"`

---

### Task 1: Mobile foundation (touch, viewport, quality)

**Files:**
- Create: `src/quality.js`
- Modify: `src/input.js`, `src/ui.js`, `src/style.css`, `index.html`, `src/game.js` (consume quality)

**Interfaces:**
- Consumes: `game` renderer + resize hook.
- Produces: `createQuality(renderer) -> { profile, applyDPR(), noteFrame(ms), getScale() }`; profiles LOW/MEDIUM/HIGH, default MEDIUM when `matchMedia('(pointer: coarse)')` else HIGH; `bindInput` gains one-action-per-gesture lock + 500ms expiry + touchmove preventDefault on canvas; `ui.showRotateHint(bool)`.

- [ ] **Step 1: Touch failing test** — node with EventTarget stub: two `touchend`s for one `touchstart` both over threshold; Expected: FAIL (currently fires twice).
- [ ] **Step 2: Implement gesture lock in `src/input.js`**: per-touchstart `fired=false` + `t0=performance.now()`; fire on first crossing (check in `touchmove` AND `touchend`): if elapsed>500ms expire silently; after firing, lock until `touchend`/`touchcancel`; threshold against 24 CSS px (`clientX/Y` are already CSS px — assert, don't scale by DPR); non-passive `touchmove` preventDefault bound on `renderer.domElement` (passed via `options.canvas`), removed in unbind.
- [ ] **Step 3: Verify touch** — rerun Step 1 (now one action), plus: sub-threshold tap = no action; 600ms-delayed swipe = no action; diagonal 30x10 locks horizontal. Also Review Focus items 1–2 pinned here. Expected: PASS.
- [ ] **Step 4: Implement `src/quality.js`**: `applyDPR` caps `min(devicePixelRatio, coarse?1.5:2)`; `noteFrame` keeps rolling avg; downscale (`0.85x`, floor 0.6) after >22ms/120 frames, upscale (`1.15x`, ceil cap) after <14ms/600 frames, 8s cooldown between changes; render scale applied via `renderer.setPixelRatio(base*scale)`; never touches game state.
- [ ] **Step 5: Viewport/HUD**: `index.html` add `viewport-fit=cover`; `style.css` `#app canvas{touch-action:none}` + HUD padding with `env(safe-area-inset-*)`; `ui.js` rotate-hint overlay shown when `innerHeight < 420 && landscape`.
- [ ] **Step 6: Wire into game.js loop** (`noteFrame` per RAF, resize re-applies). `npm run build` PASS + manual `npm run dev` checkpoint on desktop + device toolbar 390x844: swipe/jump/slide/pause all work.
- [ ] **Step 7: Commit** — `git commit -m "feat: mobile foundation touch viewport quality"`

---

### Task 2: Visual upgrade (readability-first, pooled)

**Files:**
- Create: `src/assets.js`
- Modify: `src/player.js` (visual only), `src/world.js` (visuals + InstancedMesh sleepers), `src/style.css` (if needed)

**Interfaces:**
- Consumes: existing `createPlayer`/`createWorld` structure.
- Produces: `assets.js` exports shared `GEO` + `MAT` dicts and `blobShadow()`; player `getBounds()` numbers UNCHANGED; obstacle `userData.half`/`elevated` semantics UNCHANGED; sleeper count/behavior same, rendered via one InstancedMesh.

- [ ] **Step 1: Failing check** — node imports `src/assets.js`; Expected: FAIL.
- [ ] **Step 2: Implement `assets.js`**: shared Box/Cylinder geometries; materials: player body/head/limbs, trainBody/trainCabin/trainLight(emissive), barrierLow (warm + chevron via second thin box), barrierHigh, coinGold (emissive-look metalness, no env map), rail/sleeper/house/fence/pole palettes (<=12 materials total); `blobShadow()` returns circle mesh (MeshBasicMaterial, transparent).
- [ ] **Step 3: Player rebuild (visual only)**: torso + head + 2 arms + 2 legs from shared GEO/MAT, run-cycle phase in `update` (limb swing by `sin(t*speedFactor)`), slide pose (reuse 0.45 head rule), keep `BODY_W/H/D`, jump/gravity/lerp numbers, `getBounds`, `reset` untouched in behavior.
- [ ] **Step 4: Obstacle/environment visuals**: train = body + cabin + emissive front/back lights (still one userData.half box); low barrier + chevron stripes; high barrier hangs at `elevated=1.1`; coin keeps cylinder + spin; sleepers -> single InstancedMesh (60 instances, matrix update in loop); houses/poles share 3 materials; blob shadows under player + trains; keep Hemisphere + Directional only.
- [ ] **Step 5: Verify** — node: bounds/half values identical to pre-change (import both, compare sample bounds JSON); pool warm-up test still passes; `npm run build` PASS; dev checkpoint readable silhouettes.
- [ ] **Step 6: Commit** — `git commit -m "feat: readable low-poly visuals with shared assets"`

---

### Task 3: Game feel (camera rig + feedback states)

**Files:**
- Create: `src/camera.js`
- Modify: `src/player.js` (anim states feed), `src/game.js` (consume camera, landing/hit hooks), `src/ui.js` (HUD pop hook `pulseCoins()`)

**Interfaces:**
- Consumes: `player.mesh.position`, `player` state flags (`grounded`, `laneIndex`, `slideTimer`), speed.
- Produces: `createCamera(camera) -> { update(dt, {speed, laneX, grounded, justLanded, hit}) }`; amplitudes: bob 0.06, lane-lean x-follow 0.35, landing dip 0.18 decaying, hit shake 0.25 for 0.3s, FOV 60->72 across speed 12->30; `player.justLanded` boolean set on landing frame; `ui.pulseCoins()` no-op-safe.

- [ ] **Step 1: Failing check** — node imports `src/camera.js`; Expected: FAIL.
- [ ] **Step 2: Implement camera rig** with clamped subtle amplitudes per interface; portrait aspect (w/h<0.8) pulls camera back/up slightly vs landscape (no stretch, recompute on resize).
- [ ] **Step 3: Wire feel**: `justLanded` sets squash (body scale y 0.85 for 0.12s, bounds unchanged) + camera dip; collision sets hit pose + shake + red flash overlay (ui); coin collect calls `pulseCoins`.
- [ ] **Step 4: Verify** — node: rig math pure-function spot checks (FOV at speed 12/30, dip decays to 0); build PASS; dev checkpoint: lane/jump/land/hit feel, no motion sickness amplitudes.
- [ ] **Step 5: Commit** — `git commit -m "feat: camera rig and game feel feedback"`

---

### Task 4: Patterns + difficulty (provable fairness)

**Files:**
- Create: `src/patterns.js`
- Modify: `src/world.js` (delegate row generation to patterns, keep pools/movement/bounds)

**Interfaces:**
- Consumes: `LANES`, speed/distance from world.
- Produces: `createPatternGen() -> { next(prevReachable: [lanes]) -> { obstacles: [{lane,kind}], coins: [{lane,line}], reachable: [lanes] } }`; `createDifficulty(distanceM) -> { speedCap, unlocked:Set }`; pattern list: straightCoins, zigzagCoins, coinArch, trainCorridor, forcedSwitch, jumpBarrier, slideBarrier, jumpCoinLine, doubleTrain, sCurve; each proves >=1 action sequence from `prevReachable` (unit-testable pure function).

- [ ] **Step 1: Failing test** — node: `next([0,1,2])` returns pattern with `reachable.length>=1`; Expected: FAIL (no module).
- [ ] **Step 2: Implement patterns + proof**: each generator takes reachable lanes, emits obstacles/coins + resulting reachable lanes; assert non-empty reachable (throw otherwise — fail loud in dev, caught nowhere in prod path so it surfaces in testing).
- [ ] **Step 3: Difficulty**: unlock table by distance (e.g. sCurve/doubleTrain only after 400m/800m); speed curve unchanged (12 + 0.35t cap 30, owned by game.js — patterns only pick complexity).
- [ ] **Step 4: Wire into world.js**: replace `spawnRow` internals with pattern emitter; keep `obtain/release`, movement, despawn, `poolSizes`, `reset` (reset also resets gen state).
- [ ] **Step 5: Verify fairness at scale** — node: 5000 rows from single-lane starts, assert every `reachable` non-empty AND brute-force walk a greedy agent through 2000 rows without forced collision; build PASS.
- [ ] **Step 6: Commit** — `git commit -m "feat: pattern generator with proven fairness"`

---

### Task 5: Polish (particles, audio, HUD, loading)

**Files:**
- Create: `src/particles.js`, `src/audio.js`
- Modify: `src/ui.js`, `src/style.css`, `src/game.js` (hooks), `index.html` (loading root)

**Interfaces:**
- Produces: `createParticles(scene, budget) -> { burst(kind, pos), update(dt), setBudget(n) }` kinds: coin/land/hit; `createAudio() -> { unlock(), blip/jump/slide/hit/click(), toggleMute() -> bool, suspend(), resume(), isMuted() }` lazy AudioContext; `ui` gains loading screen `showLoading(pct)` + `hideLoading`, power-up timer slots (used in Task 6), game-over SCORE/BEST/DISTANCE/COINS + RETRY/HOME; mute persisted `subway-mini-muted`.

- [ ] **Step 1: Failing checks** — node imports both modules; Expected: FAIL x2.
- [ ] **Step 2: Particles**: fixed pool (e.g. 120 quads via Points or instanced planes), `burst` reuses dead particles, `update` integrates, zero allocation in loop, budget scales counts (LOW 40/HIGH 120). Node: burst 200x, assert pool size constant + no throw without WebGL (guard `scene` stub).
- [ ] **Step 3: Audio**: oscillators + gain envelopes only; `unlock()` creates context inside first PLAY tap handler; all play methods no-op before unlock and when muted/suspended; `suspend/resume` wired to visibility in game.js.
- [ ] **Step 4: UI/menus/loading**: loading overlay with progress (core ready -> PLAY enabled immediately, decor never blocks); HUD score/coins/timers; game-over stats; buttons >=44px; safe-area respected.
- [ ] **Step 5: Verify** — node audio state machine (muted/unlocked transitions, no-throw pre-unlock); Review Focus audio item pinned: simulate suspend->resume cycle; build PASS; dev checkpoint full menu->play->gameover->retry loop with sound + mute.
- [ ] **Step 6: Commit** — `git commit -m "feat: particles audio hud loading polish"`

---

### Task 6: Power-ups (fair by construction)

**Files:**
- Create: `src/powerups.js`
- Modify: `src/world.js` (spawn hook), `src/game.js` (effects + timers), `src/ui.js` (timer slots from Task 5)

**Interfaces:**
- Produces: `createPowerups() -> { maybeSpawn(reachable) -> pickup|null, update(dt, player, world), hasShield(), coinMultiplier(), isMagnet() }`; spawn at most 1 per ~45s on survivable lanes only; durations: magnet 8s, shield until hit or 12s, 2x 10s; timers advance only while `state==='playing' && !paused`.

- [ ] **Step 1: Failing check** — node import; Expected: FAIL.
- [ ] **Step 2: Implement**: magnet pulls coins within 3m (uses existing `collectCoin`), shield absorbs one `gameOver` trigger then breaks with feedback, 2x doubles distance+coin score.
- [ ] **Step 3: Verify** — node: timer freeze when paused (advance paused 5s, remaining unchanged — Review Focus item 5); shield absorbs exactly 1 hit; magnet collects only reachable coins; spawn never on blocked lanes (1000 samples); build PASS.
- [ ] **Step 4: Commit** — `git commit -m "feat: magnet shield 2x power-ups"`

---

### Task 7: Performance pass + test matrix + deploy

**Files:**
- Modify: whatever bottlenecks found (keep gameplay untouched)
- Create/extend: `README.md` (perf table + test matrix results)

**Interfaces:** none new.

- [ ] **Step 1: Measure** — dev build: record `renderer.info` (calls/tris) at 390x844 MEDIUM, FPS avg over 60s run, heap snapshots across 5x play->die->retry (assert flat +/-10%), `dist/` size.
- [ ] **Step 2: Fix top bottlenecks only** (instancing already done; candidates: pixelRatio floor, coin spin batching, HUD DOM writes throttled to 4Hz). Re-measure after each fix.
- [ ] **Step 3: Test matrix** — 360x800, 390x844, 412x915 device toolbar + desktop: start/swipes/jump/slide/rapid gestures/collision/gameover/retry/hide-tab/resume/resize/rotate; log PASS/FAIL per cell into README.
- [ ] **Step 4: Final `npm run build` + `npx vite preview`** PASS, zero console errors.
- [ ] **Step 5: Commit** — `git commit -m "chore: perf pass test matrix readme"`
