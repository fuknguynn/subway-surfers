import * as THREE from 'three';

export const VISUAL_STATES = ['idle', 'run', 'jump', 'slide', 'hit'];

// Map state gameplay -> clip name thật trong human_male.glb (đã xác minh).
export const DEFAULT_CLIP_MAP = {
  idle: 'Idle_Loop',
  run: 'Jog_Fwd_Loop',
  jump: 'Jump_Loop',
  slide: 'Slide_Loop',
  hit: 'Hit_Chest',
};
export const VISUAL_HEIGHT = 1.75; // scale GLB về chiều cao này (vừa bounds)

// assets: clipNames (mảng string từ GLB). Thiếu concept nào -> throw liệt kê.
export function resolveClipMap(clipNames, wanted = DEFAULT_CLIP_MAP) {
  const missing = [];
  const map = {};
  for (const [state, clip] of Object.entries(wanted)) {
    if (clipNames.includes(clip)) map[state] = clip;
    else missing.push(`${state} (want "${clip}")`);
  }
  if (missing.length) {
    throw new Error(
      `Unmapped visual states: ${missing.join(', ')}. Available: ${clipNames.join(', ')}`,
    );
  }
  return map;
}

let liveMixers = 0;

export function createPlayerVisual() {
  const holder = new THREE.Group(); // GLB là con visual, gameplay di chuyển group cha
  let mixer = null;
  let actions = {};
  let current = 'idle';
  let clipMap = { ...DEFAULT_CLIP_MAP };

  const v = {
    holder,
    current: () => current,
    mixerCount: () => liveMixers,

    setModel(root, clips, wanted) {
      v.clearModel();
      clipMap = resolveClipMap(clips.map((c) => c.name), wanted);
      holder.add(root);
      // Scale về chiều cao chuẩn (đo Box3 runtime, không đoán trước)
      const box = new THREE.Box3().setFromObject(root);
      const size = box.getSize(new THREE.Vector3());
      if (size.y > 0) {
        const s = VISUAL_HEIGHT / size.y;
        root.scale.setScalar(s);
        // Đặt chân về y=0 (Box3 min.y có thể lệch)
        const box2 = new THREE.Box3().setFromObject(root);
        root.position.y -= box2.min.y;
      }
      mixer = new THREE.AnimationMixer(root);
      liveMixers += 1;
      actions = {};
      for (const c of clips) {
        if (Object.values(clipMap).includes(c.name)) actions[c.name] = mixer.clipAction(c);
      }
      v.setState(current, true);
    },

    useFallback() {
      v.clearModel();
      holder.clear();
    },

    clearModel() {
      if (mixer) {
        mixer.stopAllAction();
        liveMixers = Math.max(0, liveMixers - 1);
        mixer = null;
      }
      actions = {};
      holder.clear();
    },

    setState(state, force = false) {
      if (!VISUAL_STATES.includes(state)) return;
      if (state === current && !force) return;
      current = state;
      const clip = clipMap[state];
      const next = clip && actions[clip];
      if (!next) return;
      for (const k of Object.keys(actions)) {
        const a = actions[k];
        if (a === next) continue;
        if (a.isRunning()) a.fadeOut(0.2);
      }
      next.reset().fadeIn(0.2).play();
    },

    // Nghiêng visual phụ thêm (group gameplay đã lean, đây chỉ là nhấn nhẹ)
    setLean(x) {
      holder.rotation.z = THREE.MathUtils.clamp(x, -0.12, 0.12);
    },

    update(dt) {
      if (mixer) mixer.update(dt);
    },
  };

  return v;
}
