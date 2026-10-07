# Mobile-Web-First Upgrade — Design Spec

Date: 2026-10-07
Mode: continuous run through all 7 phases, playable after every phase.
Base: existing Lab project (Three.js + Vite, 3 lanes, player/world/input/ui).
Prior spec: `docs/superpowers/specs/2026-10-07-subway-surfers-3d-design.md`

## 0. Non-goals & constraints

- Improve THIS project; no rebuild. Keep public APIs of player/world/input/ui stable.
- Preserve: 3 lanes, lane switch, jump, slide, keyboard + swipe, obstacles, trains,
  coins, AABB collision, endless generation, safe-path rule, pooling, difficulty ramp,
  localStorage best score, Vite static deploy on Vercel Free.
- Subway Surfers is feel-reference only. No copied assets, characters, maps, UI, branding.
- Priority: mobile responsiveness > stable FPS > readability > feel > visual quality >
  graphical complexity.
- Graphics quality must NEVER change gameplay (speed, spawn, collision, difficulty).

## 1. Restructure first (light)

- New `src/game.js`: `createGame()` owns renderer/scene/camera, RAF loop, states
  (menu/playing/paused/gameover), delta clamp 0.05, visibilitychange auto-pause
  (gameplay + timers + audio), speed/score accounting.
- `src/main.js` becomes thin bootstrap: loading screen -> createGame -> menu.
- Gameplay systems keep behavior; only wiring moves into Game.
- New modules, one responsibility each:
  - `src/camera.js` — follow rig (smooth follow, bob, lane lean, FOV by speed,
    landing dip, hit shake; all subtle, clamped amplitudes).
  - `src/quality.js` — LOW/MEDIUM/HIGH profiles (default MEDIUM on mobile);
    DPR cap (mobile <=1.5, desktop <=2, adaptive render scale down when avg frame
    >22ms over ~120 frames).
  - `src/patterns.js` — pattern table + DifficultyManager (unlock harder patterns
    over time/distance; every pattern declares a survivable path).
  - `src/audio.js` — procedural WebAudio SFX (coin, jump, slide, hit, UI),
    init/resume only after first user gesture, mute toggle, suspend on hidden tab.
  - `src/particles.js` — pooled bursts (coin pickup, landing puff, hit spark),
    counts scaled by quality, zero per-frame allocation.
  - `src/powerups.js` — magnet, shield (absorbs 1 hit), 2x score; sparse spawns
    on safe lanes only; HUD timers.
  - `src/assets.js` — shared geometries/materials palette (trains, barriers, coins,
    environment) to cut draw calls; emissive-look instead of dynamic lights.
- Animation is visual-only: player hitbox numbers in `getBounds()` stay as today.

## 2. Phase 1 — Mobile foundation

- Canvas `touch-action: none`; non-passive touchmove preventDefault on canvas only.
- Keep viewport meta + add `viewport-fit=cover`; HUD respects
  `env(safe-area-inset-*)`; no hardcoded resolutions.
- Portrait-first; landscape with very short height shows lightweight rotate hint.
- Touch: threshold ~24px, max duration ~500ms, dominant-axis lock at threshold
  (act without waiting for touchend), ignore 2nd finger, no double-trigger.
- Camera aspect/FOV adapts to narrow screens; player + upcoming obstacles readable.
- Delta clamp + visibility pause centralized in Game (already exist, move as-is).

## 3. Phase 2 — Visual upgrade (mobile budget)

- Player: procedural low-poly runner (torso/head/arms/legs boxes); run cycle by
  speed phase; slide pose; lean on lane change. Visual only.
- Obstacles with strong silhouettes: train (long body + cabin + emissive lights),
  low barrier warm color + chevrons = JUMP, high hanging barrier = SLIDE.
- Coins: gold emissive-look, spin; visible at small sizes.
- Environment: rails + InstancedMesh sleepers, pooled poles/fences/houses with
  shared materials, fog hides far plane; decor never crowds lanes.
- Lights: 1 Hemisphere + 1 Directional (as today). Blob shadows under player/trains;
  no realtime shadow maps on mobile (MEDIUM/LOW); HIGH desktop may enable cheap
  single-caster shadow only if budget allows.

## 4. Phase 3 — Game feel

- Camera: smooth lane follow, subtle bob, lean with lane change, jump rise +
  landing dip, tiny hit shake, speed-based FOV. Clamped for small screens.
- Feedback: coin (spin -> burst + blip + HUD pop), landing (squash + dip),
  collision (flash + shake + hit pose), lane change (lean + follow).
- Easing on all transitions; feel via timing, not polygons.

## 5. Phase 4 — Gameplay variety

- Replace pure-random rows with pattern list: straight/zigzag/arch coins, train
  corridor, forced lane switch, jump barrier, slide barrier, jump-coin line,
  double train, S-curve. Each pattern has a guaranteed survivable lane reachable
  from any previous safe lane.
- DifficultyManager: speed ramp (keep current curve shape) + pattern unlock +
  tighter reaction windows. Never unbeatable by construction.

## 6. Phase 5 — Polish

- Loading screen (logo + progress, PLAY enabled when core ready, decor deferred).
- HUD mobile-first: big score top, coins + power-up timers compact, touch targets
  >=44px. Menu (PLAY), Game Over (SCORE/BEST/DISTANCE/COINS, RETRY/HOME).
- Audio per section 1; mute persisted in localStorage.
- Zero external assets: bundle stays a few MB, first paint fast on 4G.

## 7. Phase 6 — Power-ups (see section 1 + 4)

- magnet / shield / 2x as in `src/powerups.js`; spawn cadence sparse and only on
  survivable lanes; timers pause with game; quality never affects spawn fairness.

## 8. Phase 7 — Performance pass & testing

- Measure: FPS/frame time, `renderer.info` draw calls + triangles, JS heap over
  repeated play->die->retry cycles (must stay flat), bundle size.
- Fix major bottlenecks only; no gameplay changes.
- Test matrix: 360x800, 390x844, 412x915 + desktop; script: start, swipes,
  jump/slide, rapid gestures, collision, game over, retry, background tab,
  resume, resize, orientation change.
- Finish with `npm run build` + `vite preview` of `dist/`.

## 9. Execution

- Single implementation plan organized by phase (restructure = phase 0); each
  phase ends with build + playable checkpoint. Continuous execution, one final
  review at the end.
