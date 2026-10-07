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
  sleeper: 0x6b4a35, // gỗ nâu trầm
  ballast: 0x4a4543, // đá dăm track bed
  concrete: 0x9aa0a6, // vỉa hè/sân ga
  steel: 0xb8c0c8, // ray thép sáng
  pole: 0x37474f, // cột điện/trụ tín hiệu
  leaf: 0x43a047, // tán cây
  leafDark: 0x2e7d32,
  trunk: 0x6d4c41,
  roof: 0x8d6e63,
  wall: 0xcfc3b8, // tường nhà sáng ấm
  wallDark: 0x8d9aa5, // nhà công nghiệp xám xanh
  window: 0xfff3c4, // cửa sổ sáng ấm (basic)
  skyTop: 0x3d8fd1,
  skyBottom: 0xcfeef7,
  cloud: 0xffffff,
  skyline: 0x9db8cc, // silhouette xa, tương phản thấp
  fence: 0x78909c,
  signPost: 0x546e7a,
  signBoard: 0xf5f5f5,
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
  road: std(PALETTE.road),
  sleeper: std(PALETTE.sleeper),
  ballast: std(PALETTE.ballast),
  concrete: std(PALETTE.concrete),
  steel: std(PALETTE.steel, { roughness: 0.4, metalness: 0.6 }),
  pole: std(PALETTE.pole),
  leaf: std(PALETTE.leaf),
  leafDark: std(PALETTE.leafDark),
  trunk: std(PALETTE.trunk),
  roof: std(PALETTE.roof),
  wall: std(PALETTE.wall),
  wallDark: std(PALETTE.wallDark),
  window: new THREE.MeshBasicMaterial({ color: PALETTE.window }),
  cloud: new THREE.MeshBasicMaterial({ color: PALETTE.cloud, transparent: true, opacity: 0.9 }),
  skyline: new THREE.MeshBasicMaterial({ color: PALETTE.skyline, fog: true }),
  fence: std(PALETTE.fence),
  signBoard: std(PALETTE.signBoard),
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

// Vòm trời gradient đỉnh-xanh/đáy-sáng, 1 draw call, không texture.
export function buildSky() {
  const geo = new THREE.SphereGeometry(300, 16, 10);
  const top = new THREE.Color(PALETTE.skyTop);
  const bottom = new THREE.Color(PALETTE.skyBottom);
  const colors = [];
  const posA = geo.attributes.position;
  for (let i = 0; i < posA.count; i++) {
    const t = THREE.MathUtils.clamp(posA.getY(i) / 300, 0, 1);
    const c = bottom.clone().lerp(top, Math.pow(t, 0.7));
    colors.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const mat = new THREE.MeshBasicMaterial({
    vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false,
  });
  const sky = new THREE.Mesh(geo, mat);
  sky.renderOrder = -10;
  return sky;
}

// Đám mây từ 3-4 hộp trắng dẹt dùng chung material.
export function buildCloud(scale = 1) {
  const g = new THREE.Group();
  g.add(part(3.2, 0.9, 1.6, MAT.cloud, 0, 0, 0));
  g.add(part(2.0, 0.7, 1.3, MAT.cloud, 1.4, 0.3, 0.2));
  g.add(part(1.6, 0.6, 1.2, MAT.cloud, -1.4, 0.25, -0.1));
  g.scale.setScalar(scale);
  return g;
}

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
