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

export function createWorld(scene) {
  scene.fog = new THREE.Fog(0x87ceeb, 30, 95);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x334455, 1.1));
  const sun = new THREE.DirectionalLight(0xffffff, 1.2);
  sun.position.set(5, 10, 5);
  scene.add(sun);

  // Mặt đất + 3 dải ray (material dùng chung)
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(30, 220),
    MAT.ground,
  );
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

  // Nhà 2 bên: 2 InstancedMesh (1 draw call mỗi loại thay vì 24 mesh)
  // Nhà phải TO vượt trội nhân vật (cao 6-14m, chân đế 5x6m) để đúng tỷ lệ
  const HOUSE_COUNT = 24;
  const houseGeo = boxGeo(5, 1, 6);
  const houseMeshes = [MAT.houseA, MAT.houseB].map(
    (mat) => new THREE.InstancedMesh(houseGeo, mat, HOUSE_COUNT / 2),
  );
  const houseH = [];
  const houseZ = [];
  const houseX = [];
  for (let i = 0; i < HOUSE_COUNT; i++) {
    houseH.push(6 + (i % 5) * 2); // 6..14m
    houseZ.push(10 - i * 8);
    houseX.push((i % 2 === 0 ? -1 : 1) * (9 + (i % 3) * 2)); // xa làn chơi
  }
  for (const hm of houseMeshes) {
    hm.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(hm);
  }

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

  // Biển đường mòn: 2 cái tái chế (cột + bảng + dạ quang)
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
    // Rào thấp: nhảy qua (hitbox cao 0.9, visual tương đương)
    low: () => {
      const g = new THREE.Group();
      g.add(part(1.6, 0.9, 0.5, MAT.barrierLow, 0, 0.45, 0));
      g.add(part(0.25, 0.7, 0.54, MAT.glow, -0.4, 0.45, 0)); // chevron
      g.add(part(0.25, 0.7, 0.54, MAT.glow, 0.4, 0.45, 0));
      g.userData.half = { x: 0.8, y: 0.45, z: 0.3 };
      return withBlob(g, 1.6);
    },
    // Rào cao: trượt qua (hitbox đáy y=1.1, đỉnh 2.1)
    high: () => {
      const g = new THREE.Group();
      g.add(part(1.6, 1.0, 0.5, MAT.barrierHigh, 0, 0, 0));
      g.add(part(0.2, 1.0, 0.54, MAT.glow, -0.5, 0, 0));
      g.add(part(0.2, 1.0, 0.54, MAT.glow, 0.5, 0, 0));
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
        g.add(log); // gỗ chở
      }
      g.add(part(0.15, 0.9, 0.15, MAT.pants, -0.7, 0.9, len / 2 - 0.5)); // cọc giữ
      g.add(part(0.15, 0.9, 0.15, MAT.pants, 0.7, 0.9, len / 2 - 0.5));
      g.add(part(1.5, 0.7, 1.2, MAT.houseB, 0, 1.9, len / 2 - 0.8)); // cabin
      g.add(part(0.3, 0.3, 0.1, MAT.glow, -0.5, 1.0, len / 2 + 0.01)); // đèn
      g.add(part(0.3, 0.3, 0.1, MAT.glow, 0.5, 1.0, len / 2 + 0.01));
      g.add(part(1.5, 0.25, len - 1, MAT.pants, 0, 0.15, 0)); // gầm
      for (const wz of [-1, 1]) {
        for (const wx of [-0.8, 0.8]) {
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

      for (let i = 0; i < HOUSE_COUNT; i++) {
        let z = houseZ[i] + dz;
        if (z > DESPAWN_Z + 6) z -= 192;
        houseZ[i] = z;
        const h = houseH[i];
        dummy.position.set(houseX[i], h / 2, z);
        dummy.scale.set(1, h, 1);
        dummy.updateMatrix();
        houseMeshes[i % 2].setMatrixAt(i >> 1, dummy.matrix);
      }
      dummy.scale.set(1, 1, 1);
      houseMeshes[0].instanceMatrix.needsUpdate = true;
      houseMeshes[1].instanceMatrix.needsUpdate = true;

      for (let i = 0; i < FENCE_N; i++) {
        let z = fenceZ[i] + dz;
        if (z > DESPAWN_Z) z -= 120;
        fenceZ[i] = z;
        for (let s = 0; s < 2; s++) {
          const x = s === 0 ? -FENCE_X : FENCE_X;
          dummy.position.set(x, 0.55, z);
          dummy.scale.set(1, 1, 1);
          dummy.updateMatrix();
          postMesh.setMatrixAt(i * 2 + s, dummy.matrix);
          for (let r = 0; r < 2; r++) {
            dummy.position.set(x, 0.45 + r * 0.35, z + 2);
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
