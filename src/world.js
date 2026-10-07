import * as THREE from 'three';
import { LANES } from './player.js';
import { MAT, GEO, part, blobShadow, boxGeo, cylGeo } from './assets.js';
import { createPatternGen } from './patterns.js';

const SPAWN_Z = -85;
const DESPAWN_Z = 12;
const ROW_GAP = 20;
const TRAIN_MIN = 8;
const TRAIN_MAX = 14;
const SLEEPER_COUNT = 60;

// Va chạm AABB với độ co để công bằng cho người chơi.
export function boxesOverlap(a, b, shrink = 0.15) {
  return (
    a.minX < b.maxX - shrink &&
    a.maxX > b.minX + shrink &&
    a.minY < b.maxY - shrink &&
    a.maxY > b.minY + shrink &&
    a.minZ < b.maxZ - shrink &&
    a.maxZ > b.minZ + shrink
  );
}

const dummy = new THREE.Object3D(); // tái dùng cho InstancedMesh, không alloc/frame

// Độ cao terrain tại (x, z) thế giới — dùng chung cho mọi object đặt trên đất.
// Khớp công thức displace ở ground bên dưới; |x|<=4.5 luôn phẳng (gameplay).
export function groundHeightAt(wx, wz) {
  const ax = Math.abs(wx);
  if (ax <= 4.5) return 0;
  const k = Math.min(1, (ax - 4.5) / 8);
  const ly = -(wz + 80);
  return k * (Math.sin(wx * 0.35) * 0.9 + Math.sin(ly * 0.12 + wx) * 1.1);
}

export function createWorld(scene) {
  scene.fog = new THREE.Fog(0x87ceeb, 30, 95);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x334455, 1.1));
  const sun = new THREE.DirectionalLight(0xffffff, 1.2);
  sun.position.set(5, 10, 5);
  scene.add(sun);

  // Mặt đất + 3 dải ray (material dùng chung)
  // Terrain gồ ghề ngoài làn chơi (|x|>4.5), giữa ray giữ phẳng gameplay.
  // Mọi object khác PHẢI lấy cao độ qua groundHeightAt (kẻo lơ lửng/chôn chân).
  const groundGeo = new THREE.PlaneGeometry(64, 220, 32, 44);
  {
    const p = groundGeo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const y = p.getY(i); // trước rotate: y là chiều dọc plane
      p.setZ(i, groundHeightAt(x, -80 - y));
    }
    groundGeo.computeVertexNormals();
  }
  const ground = new THREE.Mesh(groundGeo, MAT.ground);
  ground.rotation.x = -Math.PI / 2;
  ground.position.z = -80;
  scene.add(ground);

  // Ballast + ray thép TĨNH (đường ray liên tục, không cần trôi; tà vẹt trôi tạo cảm giác tốc độ)
  const ballast = new THREE.Mesh(new THREE.PlaneGeometry(8.6, 220), MAT.ballast);
  ballast.rotation.x = -Math.PI / 2;
  ballast.position.set(0, 0.005, -80);
  scene.add(ballast);

  for (const x of LANES) {
    for (const off of [-0.55, 0.55]) {
      const rail = new THREE.Mesh(boxGeo(0.12, 0.08, 220), MAT.railSteel);
      rail.position.set(x + off, 0.06, -80);
      scene.add(rail);
    }
  }

  // Tà vẹt: 1 InstancedMesh duy nhất
  const sleeperGeo = new THREE.BoxGeometry(7.5, 0.04, 0.5);
  const sleepers = new THREE.InstancedMesh(sleeperGeo, MAT.sleeper, SLEEPER_COUNT);
  const sleeperZ = [];
  for (let i = 0; i < SLEEPER_COUNT; i++) sleeperZ.push(10 - i * 2);
  scene.add(sleepers);

  // Nhà rừng thay bằng forest chunks (Task 5) — xóa InstancedMesh nhà hộp

  // Hàng rào gỗ 2 bên: cọc + thanh ngang, InstancedMesh, trôi cùng world
  const FENCE_X = 5.2;
  const FENCE_N = 30;
  const postMesh = new THREE.InstancedMesh(boxGeo(0.18, 1.1, 0.18), MAT.houseB, FENCE_N * 2);
  postMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(postMesh);
  const railMesh = new THREE.InstancedMesh(boxGeo(0.1, 0.12, 4.2), MAT.houseB, FENCE_N * 2 * 2);
  railMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(railMesh);
  const fenceZ = [];
  for (let i = 0; i < FENCE_N; i++) fenceZ.push(10 - i * 4);

  // Mảng sỏi/đất xen kẽ 2 bên ray (visual transition, tái chế)
  const PATCH_N = 16;
  const patchMesh = new THREE.InstancedMesh(boxGeo(2.2, 0.03, 3), MAT.ballast, PATCH_N);
  patchMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(patchMesh);
  const patchZ = [];
  for (let i = 0; i < PATCH_N; i++) patchZ.push(10 - i * 7.5);
  const signs = [];
  for (let i = 0; i < 2; i++) {
    const g = new THREE.Group();
    g.add(part(0.15, 1.6, 0.15, MAT.pants, 0, 0.8, 0));
    g.add(part(1.0, 0.5, 0.08, MAT.houseB, 0, 1.6, 0));
    g.add(part(0.7, 0.12, 0.1, MAT.glow, 0, 1.6, 0));
    g.position.set(i === 0 ? -4.2 : 4.2, 0, -20 - i * 55);
    scene.add(g);
    signs.push(g);
  }

  // Pool obstacle/coin theo loại
  const pools = { low: [], high: [], train: [], coin: [] };
  const active = { obstacles: [], coins: [] };

  function obtain(kind, make) {
    const pooled = pools[kind].pop();
    if (pooled) {
      pooled.visible = true;
      return pooled;
    }
    const mesh = make();
    scene.add(mesh);
    return mesh;
  }

  function release(kind, mesh) {
    mesh.visible = false;
    pools[kind].push(mesh);
  }

  function withBlob(group, scale) {
    const b = blobShadow(scale);
    group.add(b);
    return group;
  }

  const makers = {
    // Đá tảng: nhảy qua (lấp đầy hitbox 1.6 x 0.9, đỉnh đúng 0.9)
    low: () => {
      const g = new THREE.Group();
      const rock = part(1.55, 0.72, 0.55, MAT.ballast, 0, 0.36, 0);
      rock.rotation.y = 0.08;
      g.add(rock);
      const top = part(1.1, 0.18, 0.5, MAT.ballast, -0.05, 0.81, 0);
      top.rotation.y = -0.15;
      g.add(top);
      g.add(part(0.3, 0.12, 0.5, MAT.glow, -0.4, 0.84, 0)); // dấu nhảy
      g.add(part(0.3, 0.12, 0.5, MAT.glow, 0.4, 0.84, 0));
      g.userData.half = { x: 0.8, y: 0.45, z: 0.3 };
      return withBlob(g, 1.6);
    },
    // Thân cây đổ trên cao: trượt qua (lấp đầy hitbox 1.1..2.1)
    high: () => {
      const g = new THREE.Group();
      const trunk = new THREE.Mesh(cylGeo(0.5, 0.5, 1.7, 10), MAT.houseB);
      trunk.rotation.z = Math.PI / 2;
      trunk.position.set(0, 1.6, 0); // 1.1 + 0.5: tâm hitbox, visual khít vùng chết
      g.add(trunk);
      g.add(part(0.5, 0.3, 0.3, MAT.ground, -0.55, 1.95, 0)); // tán lá
      g.add(part(0.5, 0.3, 0.3, MAT.ground, 0.55, 1.3, 0));
      g.userData.half = { x: 0.8, y: 0.5, z: 0.3 };
      g.userData.elevated = 1.1;
      return g;
    },
    // Tàu gỗ chở gỗ: toa dài, phải đổi làn (hitbox cao 2.4, dài 8-14)
    train: () => {
      const len = TRAIN_MIN + Math.random() * (TRAIN_MAX - TRAIN_MIN);
      const g = new THREE.Group();
      g.add(part(1.7, 0.3, len, MAT.pants, 0, 0.35, 0)); // khung gầm
      for (const lx of [-0.5, 0, 0.5]) {
        const log = new THREE.Mesh(cylGeo(0.35, 0.35, len - 2, 10), MAT.houseB);
        log.rotation.x = Math.PI / 2;
        log.position.set(lx, 1.0, 0);
        g.add(log); // gỗ chở lớp dưới
      }
      for (const lx of [-0.25, 0.25]) {
        const log2 = new THREE.Mesh(cylGeo(0.33, 0.33, len - 2.5, 10), MAT.houseB);
        log2.rotation.x = Math.PI / 2;
        log2.position.set(lx, 1.62, 0);
        g.add(log2); // gỗ chở lớp trên (đỉnh ~1.95 < 2.4)
      }
      g.add(part(0.1, 2.0, len - 1, MAT.houseB, -0.8, 1.0, 0)); // ván thành xe
      g.add(part(0.1, 2.0, len - 1, MAT.houseB, 0.8, 1.0, 0));
      g.add(part(0.15, 0.9, 0.15, MAT.pants, -0.7, 0.9, len / 2 - 0.5)); // cọc giữ
      g.add(part(0.15, 0.9, 0.15, MAT.pants, 0.7, 0.9, len / 2 - 0.5));
      g.add(part(1.5, 0.7, 1.2, MAT.houseB, 0, 1.9, len / 2 - 0.8)); // cabin
      g.add(part(0.3, 0.3, 0.1, MAT.glow, -0.5, 1.0, len / 2 + 0.01)); // đèn
      g.add(part(0.3, 0.3, 0.1, MAT.glow, 0.5, 1.0, len / 2 + 0.01));
      g.add(part(1.5, 0.25, len - 1, MAT.pants, 0, 0.15, 0)); // gầm
      for (const wz of [-1, 1]) {
        for (const wx of [-0.75, 0.75]) {
          const wheel = new THREE.Mesh(cylGeo(0.3, 0.3, 0.15, 10), MAT.pants);
          wheel.rotation.z = Math.PI / 2;
          wheel.position.set(wx, 0.3, (wz * (len / 2 - 1)));
          g.add(wheel);
        }
      }
      g.userData.half = { x: 0.85, y: 1.2, z: len / 2 };
      return withBlob(g, 2.2);
    },
    coin: () => {
      const m = new THREE.Mesh(GEO.coin, MAT.coin);
      m.rotation.x = Math.PI / 2;
      return m;
    },
  };

  let distance = 0;
  let lastRowAt = 0;
  let rowId = 0;
  const gen = createPatternGen();
  let reachable = [1];
  let pendingRows = [];

  function spawnRow() {
    if (pendingRows.length === 0) {
      const out = gen.next(reachable, distance);
      reachable = out.reachable;
      pendingRows = out.rows;
    }
    const row = pendingRows.shift();
    rowId += 1;

    for (const spec of row.obstacles) {
      const m = obtain(spec.kind, makers[spec.kind]);
      m.position.set(LANES[spec.lane], 0, SPAWN_Z);
      m.visible = true;
      m.userData.lane = spec.lane;
      m.userData.row = rowId;
      m.userData.kind = spec.kind;
      active.obstacles.push(m);
    }

    for (const c of row.coins) {
      const coin = obtain('coin', makers.coin);
      coin.position.set(LANES[c.lane], 1.0, SPAWN_Z + (c.dz || 0));
      coin.visible = true;
      active.coins.push(coin);
    }
  }

  function boundsOf(m) {
    const h = m.userData.half;
    const y0 = m.position.y + (m.userData.elevated ? m.userData.elevated : 0);
    return {
      minX: m.position.x - h.x,
      maxX: m.position.x + h.x,
      minY: y0,
      maxY: y0 + h.y * 2,
      minZ: m.position.z - h.z,
      maxZ: m.position.z + h.z,
    };
  }

  const world = {
    update(dt, speed) {
      const dz = speed * dt;
      distance += dz;

      for (let i = 0; i < SLEEPER_COUNT; i++) {
        let z = sleeperZ[i] + dz;
        if (z > DESPAWN_Z) z -= 120;
        sleeperZ[i] = z;
        dummy.position.set(0, 0.02, z);
        dummy.updateMatrix();
        sleepers.setMatrixAt(i, dummy.matrix);
      }
      sleepers.instanceMatrix.needsUpdate = true;

      // Hàng rào biến thể: đoạn có/không, cọc nghiêng/hỏng, thanh thiếu
      for (let i = 0; i < FENCE_N; i++) {
        let z = fenceZ[i] + dz;
        if (z > DESPAWN_Z) z -= 120;
        fenceZ[i] = z;
        const gap = i % 10 >= 8; // đoạn trống
        const broken = i % 7 === 3; // cọc gãy nghiêng
        for (let s = 0; s < 2; s++) {
          const x = s === 0 ? -FENCE_X : FENCE_X;
          const gy = groundHeightAt(x, z);
          if (gap) {
            dummy.position.set(0, -999, 0);
            dummy.scale.setScalar(0.001);
            dummy.rotation.set(0, 0, 0);
          } else {
            dummy.position.set(x, gy + (broken ? 0.33 : 0.55), z);
            dummy.scale.set(1, broken ? 0.6 : 1, 1);
            dummy.rotation.set(0, 0, broken ? (s === 0 ? 0.35 : -0.35) : 0);
          }
          dummy.updateMatrix();
          postMesh.setMatrixAt(i * 2 + s, dummy.matrix);
          for (let r = 0; r < 2; r++) {
            const missing = gap || (broken && r === 1);
            if (missing) {
              dummy.position.set(0, -999, 0);
              dummy.scale.setScalar(0.001);
              dummy.rotation.set(0, 0, 0);
            } else {
              dummy.position.set(x, gy + 0.45 + r * 0.35, z + 2);
              dummy.scale.set(1, 1, 1);
              dummy.rotation.set(0, 0, 0);
            }
            dummy.updateMatrix();
            railMesh.setMatrixAt((i * 2 + s) * 2 + r, dummy.matrix);
          }
        }
      }
      postMesh.instanceMatrix.needsUpdate = true;
      railMesh.instanceMatrix.needsUpdate = true;

      for (const g of signs) {
        g.position.z += dz;
        if (g.position.z > DESPAWN_Z + 6) {
          g.position.z -= 130;
          g.position.x = -g.position.x; // đổi bên cho đỡ đơn điệu
        }
      }

      for (let i = 0; i < PATCH_N; i++) {
        let z = patchZ[i] + dz;
        if (z > DESPAWN_Z) z -= 120;
        patchZ[i] = z;
        dummy.position.set(i % 2 === 0 ? -3.4 : 3.4, 0.015, z);
        dummy.scale.set(1, 1, 1);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        patchMesh.setMatrixAt(i, dummy.matrix);
      }
      patchMesh.instanceMatrix.needsUpdate = true;

      if (distance - lastRowAt >= ROW_GAP) {
        lastRowAt = distance;
        spawnRow();
      }

      for (let i = active.obstacles.length - 1; i >= 0; i--) {
        const m = active.obstacles[i];
        m.position.z += dz;
        if (m.position.z - m.userData.half.z > DESPAWN_Z) {
          active.obstacles.splice(i, 1);
          release(m.userData.kind, m);
        }
      }
      for (let i = active.coins.length - 1; i >= 0; i--) {
        const c = active.coins[i];
        c.position.z += dz;
        c.rotation.z += dt * 4;
        if (c.position.z > DESPAWN_Z) {
          active.coins.splice(i, 1);
          release('coin', c);
        }
      }
    },

    getObstacles() {
      return active.obstacles;
    },

    getCoins() {
      return active.coins;
    },

    getReachable() {
      return [...reachable];
    },

    collectCoin(coin) {
      const i = active.coins.indexOf(coin);
      if (i >= 0) {
        active.coins.splice(i, 1);
        release('coin', coin);
      }
    },

    obstacleBounds(m) {
      return boundsOf(m);
    },

    reset() {
      for (const m of active.obstacles) release(m.userData.kind, m);
      for (const c of active.coins) release('coin', c);
      active.obstacles.length = 0;
      active.coins.length = 0;
      distance = 0;
      lastRowAt = 0;
      rowId = 0;
      gen.reset();
      reachable = [1];
      pendingRows = [];
    },

    poolSizes() {
      return {
        low: pools.low.length,
        high: pools.high.length,
        train: pools.train.length,
        coin: pools.coin.length,
        activeOb: active.obstacles.length,
        activeCoins: active.coins.length,
      };
    },
  };

  return world;
}
