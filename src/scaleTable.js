import * as THREE from 'three';

// Chiều cao mục tiêu (m) cho mọi asset — player visual ~1.75m làm chuẩn.
// Không tin scale gốc của file GLB.
export const TARGET_HEIGHTS = {
  // Wildlife (vai/lưng)
  deer: 1.2,
  stag: 1.3,
  fox: 0.45,
  wolf: 0.85,
  // Vegetation
  tree: 12, // cây rừng chuẩn (small 4-7 qua scale riêng từng slot)
  bush: 1.2,
  grass: 0.4,
  rock: 1.5,
  cliff: 9,
  // Props
  tent: 2.2,
  campfire: 0.6,
  bridge: 1.5,
  mountain: 300, // backdrop MASSIVE
  sign: 1.6,
  flower: 0.35,
  mushroom: 0.4,
  stump: 0.7,
  fence: 1.2,
};

// Scale root về đúng chiều cao mục tiêu, đặt chân về y=0. Trả về scale đã áp.
export function normalizeToHeight(root, targetM) {
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  if (!(size.y > 0)) return 1;
  const s = targetM / size.y;
  root.scale.setScalar(s);
  const box2 = new THREE.Box3().setFromObject(root);
  root.position.y -= box2.min.y;
  return s;
}
