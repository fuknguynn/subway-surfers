# Visual Production Upgrade (Third-Party Assets) — Design Spec

Date: 2026-10-07
Mode: full upfront, ONE spec + ONE plan for all 9 stages, continuous execution.
Base: existing Lab project on `feat/mobile-upgrade` (working tree has uncommitted
simplifications to player/assets/checks — implementation starts by reading actual files).
Prior specs: `2026-10-07-subway-surfers-3d-design.md`, `2026-10-07-mobile-upgrade-design.md`

## 0. Absolute rules (non-negotiable)

- ZERO gameplay changes: lanes, movement/jump/slide physics, collision logic,
  hitboxes, speed progression, difficulty, generation, safe-path/fairness,
  scoring, coins, power-ups, touch controls, quality system, pause/resume.
- Graphics strictly independent from gameplay. GLB visuals are children of
  existing entities; original collision dimensions untouched.
- Subway Surfers = feel/density/readability reference ONLY. No copied assets,
  characters, maps, branding, level designs, UI.
- Mobile-web-first priority order kept: responsiveness > FPS > readability >
  feel > visual quality > complexity.
- No bypassing corporate filtering; normal Git/GitHub HTTPS only.

## 1. Verified asset sources (scouted, not assumed)

- Character: `NafisRayan/Animate-Rigged-Humanoid-No-Blender/test/human_male.glb`
  (~35MB) + `human_female.glb` — Quaternius CC0-origin rehost, rigged humanoid
  + 86 animation clips. MUST convert to WebP locally (`gltf-transform webp`)
  to ~4–8MB before shipping. Provenance recorded in THIRD_PARTY_ASSETS.md;
  verify skeleton/clip count after download, reject on mismatch.
- Nature/props: `ETdoFresh/kenney.nl` mirror (Kenney CC0) — natureKit GLBs
  (trees/rocks/bushes), fantasy-town fences. Selective sparse checkout only.
- NOT available on GitHub (verified): official Quaternius packs (site/itch
  blocked), modern train kit, 3D city kit, KayKit org. Consequence: trains,
  railway detail, city use upgraded procedural visuals in matching low-poly
  style (Sections 3–4), built through the same adapters so future verified
  GLBs drop in without touching gameplay.
- dcc-asset-quaternius = MCP skill only, no files. Rejected as source.

## 2. Asset pipeline (Stage 1)

- New `src/assetManager.js`: `loadModel(id, url)`, `getModel(id)`,
  `cloneModel(id)` (SkeletonUtils.clone for skinned), `loadTexture(id, url)`,
  `getTexture(id)`; async + cache (never fetch same GLB twice) + progress +
  errors with graceful fallback + texture cache + AnimationMixer support +
  lifecycle/disposal.
- `THIRD_PARTY_ASSETS.md`: Asset, Original creator, Original source, GitHub
  source, License, Files used, Modifications, Approx production size. No
  entry = no ship. Unclear license = reject.
- Layout: `assets-source/` (temp, gitignored) → `public/assets/{character,
  trains,railway,buildings,industrial,vegetation,props,textures}/` with ONLY
  used files. No Blender sources, unused FBX/textures, preview renders,
  duplicate formats, full packs. Production asset budget: ideal <10MB,
  acceptable <15MB (network payload, not source repos).
- Loading screen shows real progress; PLAY enabled when core ready; fallback
  procedural visuals if any GLB fails — game always playable.

## 3. Character (Stage 2, priority #1)

- `human_male.glb` (WebP-optimized) as visual child of player entity.
- New `src/playerVisual.js` adapter: `setState(idle|run|jump|slide|hit)`,
  `update(dt)`, `setLean(v)`; AnimationMixer crossfades; NO root motion —
  gameplay owns X/Y/Z, jump, lanes, collision; hitbox EXACTLY unchanged.
- Clip mapping: Run→run, Jump→jump, Crouch/Slide-nearest→slide, Hit/flinch→hit,
  Idle→idle; closest compatible clip when exact missing, recorded.
- Procedural streetwear character remains as FALLBACK only, not the target.
- No duplicated mixers/models on retry/game-over (cache + dispose discipline).
- Gate: visual inspect at 390×844; if the character still looks poor, STOP and
  pick another asset before continuing (plan encodes this as a gate).

## 4. Trains, railway, city, vegetation (Stages 3–6)

- Trains (2–3 variants): shaped body + windshield + windows + doors +
  headlights (emissive) + roof + undercarriage/wheel suggestion; original
  collision boxes kept; loaded models reused, never one GLB per spawn.
- Railway: steel rails (metalness), sleepers, ballast, signals, cabinets,
  signs, fences, equipment — InstancedMesh; strong horizon perspective.
- City: reusable chunks (CityBlockA/B/C, IndustrialBlockA, StationBlockA,
  GreenBlockA), each with near/mid/background layers; buildings get windows,
  doors, roofs, ledges, signs, awnings, rooftop details — never plain boxes
  as final look. 4 themes (Downtown/Industrial/Station/Green) change ONLY
  palette + chunk composition by distance, never gameplay.
- Vegetation: ~3 trees + 2 bushes + 2 grass + 2 rocks (Kenney natureKit),
  InstancedMesh, never occluding lanes/coins/power-ups.
- 6 depth layers: gameplay → rails/equipment → near props → midground →
  skyline → fog/sky. Detail outside lanes; gameplay area stays clean.

## 5. Lighting, camera, materials, textures (Stage 7)

- 1 Hemisphere + 1 Directional + fog + blob shadows; tune sky/ground colors,
  direction, intensity; emissive for lights/coins/signs; no SSAO/bloom/dynamic
  shadow maps on MEDIUM/LOW.
- Camera retune visual-only for 390×844: player ~25–40% more prominent, less
  empty sky, all 3 lanes + next obstacle + coins + power-ups visible; speed
  untouched.
- Materials: distinguish metal/painted/glass/concrete/fabric/skin/rubber/
  vegetation/gold via roughness/metalness/emissive on shared MAT; no dynamic
  PointLights for glow.
- Textures: WebP atlases 256–512 (1024 only justified); no 2K/4K; don't
  upscale sources.

## 6. UI redesign (Stage 8)

- HTML/CSS only: HUD (big score, coin icon+counter, compact power-up timers,
  48px circular pause, small mute), menu (title + big PLAY + best + world
  backdrop), game-over (GAME OVER, score, best, distance, coins, RETRY, HOME).
- Strong type hierarchy, rounded elements, subtle gradients, press animation,
  spacing, safe-area kept. No generic buttons, no crowding.

## 7. Quality profiles + perf order (Stage 9)

- HIGH/MEDIUM/LOW change ONLY decor/vegetation/distance/particles; existing
  DPR/quality/pooling/instancing/pause kept.
- Degrade order: decor → vegetation → distant env → particles → resolution →
  material features. Never gameplay.
- Tests: 360×800/390×844/412×915 + §26 checklist (loading, no missing assets,
  no console errors, anim transitions, no mixer/model dup on retry, memory
  flat, collision/swipe/DPR/quality unchanged, FPS ok, build passes).
- Final: screenshot review at 390×844 against the 10 §27 questions. Done =
  SUBSTANTIALLY better visuals AND acceptable mobile perf — never build-pass
  alone.

## 8. Execution

- Single plan, stages 0–9 (0 = working-tree triage: read actual files, keep or
  re-apply uncommitted simplifications deliberately, never silently).
- Reuse `npm run check:mobile`; extend with asset checks (THIRD_PARTY_ASSETS
  entries match shipped files, no file >2MB unoptimized, GLB clip counts).
