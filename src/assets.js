import * as THREE from 'three';

// Bảng màu: player tương phản cao, môi trường trầm để player luôn là focal point.
export const PALETTE = {
  skin: 0xe8b98a,
  cap: 0x1f2a5a, // navy đậm
  hoodie: 0xe4572e, // đỏ-cam ấm (tái dùng cho accent giày)
  pants: 0x2b2f3a, // charcoal (tái dùng nhà A)
  shoe: 0xf2ede4, // trắng ngà
  pack: 0x3a3f4a, // trung tính đậm
  train: 0x2e6fb0,
  trainDark: 0x1f2a5a, // tái dùng cap
  glow: 0xffd94d, // emissive-look: đèn tàu + xu + chevron
  barrierLow: 0xf0a030,
  barrierHigh: 0xd43a2a,
  ground: 0x3a7d44,
  road: 0x555555,
  sleeper: 0x777777,
  steel: 0xb8c0c8, // ray thép sáng
  ballast: 0x4a4543, // đá dăm track bed
  houseB: 0x8a6f55,
};

const geoCache = new Map();
export function boxGeo(w, h, d) {
  const key = `${w}|${h}|${d}`;
  let g = geoCache.get(key);
  if (!g) {
    g = new THREE.BoxGeometry(w, h, d);
    geoCache.set(key, g);
  }
  return g;
}

const cylCache = new Map();
export function cylGeo(rt, rb, h, seg = 10) {
  const key = `${rt}|${rb}|${h}|${seg}`;
  let g = cylCache.get(key);
  if (!g) {
    g = new THREE.CylinderGeometry(rt, rb, h, seg);
    cylCache.set(key, g);
  }
  return g;
}

function std(color, opts = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, ...opts });
}

export const MAT = {
  skin: std(PALETTE.skin),
  cap: std(PALETTE.cap),
  hoodie: std(PALETTE.hoodie),
  pants: std(PALETTE.pants),
  shoe: std(PALETTE.shoe),
  shoeAccent: null, // alias bên dưới -> hoodie (cùng hex)
  pack: std(PALETTE.pack),
  train: std(PALETTE.train),
  trainDark: null, // alias -> cap (cùng hex)
  glow: new THREE.MeshBasicMaterial({ color: PALETTE.glow }),
  coin: new THREE.MeshStandardMaterial({
    color: PALETTE.glow, metalness: 0.6, roughness: 0.3,
  }),
  barrierLow: std(PALETTE.barrierLow),
  barrierHigh: std(PALETTE.barrierHigh),
  ground: std(PALETTE.ground),
  railSteel: std(PALETTE.steel, { roughness: 0.35, metalness: 0.65 }),
  ballast: std(PALETTE.ballast),
  sleeper: std(PALETTE.sleeper),
  houseA: null, // alias -> pants (cùng hex)
  houseB: std(PALETTE.houseB),
};

MAT.shoeAccent = MAT.hoodie;
MAT.trainDark = MAT.cap;
MAT.houseA = MAT.pants;

export const GEO = {
  coin: new THREE.CylinderGeometry(0.35, 0.35, 0.12, 16),
  blob: new THREE.CircleGeometry(0.5, 20),
};
const blobMat = new THREE.MeshBasicMaterial({
  color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false,
});

// Dựng mesh box nhanh từ geo/material dùng chung.
export function part(w, h, d, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(boxGeo(w, h, d), mat);
  m.position.set(x, y, z);
  return m;
}

export function blobShadow(scale = 1) {
  const m = new THREE.Mesh(GEO.blob, blobMat);
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.02;
  m.scale.setScalar(scale);
  return m;
}

export function materialCount() {
  return new Set(Object.values(MAT)).size; // đếm instance duy nhất (alias không tính 2 lần)
}
