import * as THREE from 'three';
import { MAT, part, cylGeo, blobShadow } from './assets.js';

export const LANES = [-2, 0, 2];

// Số vật lý GIỮ NGUYÊN — visual chỉ thay hình, không đụng gameplay.
const LANE_LERP_SPEED = 12;
const JUMP_VELOCITY = 8.5;
const GRAVITY = -26;
const SLIDE_DURATION = 0.7;
const BODY_W = 0.7;
const BODY_H = 1.4;
const BODY_D = 0.5;
const SLIDE_SCALE = 0.42; // đỉnh visual ≈ bounds trượt 0.7

function limb(r, len, mat) {
  const m = new THREE.Mesh(cylGeo(r, r * 0.85, len, 8), mat);
  m.position.y = -len / 2;
  return m;
}

export function createPlayer(scene) {
  const group = new THREE.Group();
  const rig = new THREE.Group(); // toàn thân (scale khi slide)
  group.add(rig);

  // --- Chân jogger: ống trụ + sneaker chunky đế tương phản ---
  function makeLeg(x) {
    const hip = new THREE.Group();
    hip.position.set(x, 0.55, 0);
    hip.add(limb(0.13, 0.5, MAT.pants));
    const shoe = part(0.26, 0.16, 0.62, MAT.shoe, 0, -0.52, 0.1);
    hip.add(shoe);
    hip.add(part(0.28, 0.07, 0.64, MAT.shoeAccent, 0, -0.6, 0.1)); // đế
    hip.add(part(0.27, 0.1, 0.2, MAT.shoeAccent, 0, -0.45, -0.18)); // gót accent
    rig.add(hip);
    return hip;
  }
  const legL = makeLeg(-0.14);
  const legR = makeLeg(0.14);

  // --- Hoodie rộng vai + cổ + mũ trùm sau gáy ---
  const torso = part(0.6, 0.52, 0.4, MAT.hoodie, 0, 0.82, 0);
  rig.add(torso);
  rig.add(part(0.78, 0.2, 0.44, MAT.hoodie, 0, 1.02, 0)); // vai rộng
  rig.add(part(0.36, 0.14, 0.3, MAT.hoodie, 0, 1.12, -0.04)); // cổ áo
  rig.add(part(0.4, 0.3, 0.18, MAT.hoodie, 0, 0.98, -0.28)); // mũ trùm sau lưng
  rig.add(part(0.5, 0.12, 0.34, MAT.shoeAccent, 0, 0.58, 0)); // lai áo accent

  // --- Balo (nảy phụ nhẹ) ---
  const pack = part(0.42, 0.38, 0.2, MAT.pack, 0, 0.92, -0.3);
  rig.add(pack);
  rig.add(part(0.3, 0.1, 0.21, MAT.shoeAccent, 0, 1.06, -0.3)); // quai/nắp balo

  // --- Tay trụ: vai hoodie + cẳng tay da + bàn tay + wristband ---
  function makeArm(x) {
    const shoulder = new THREE.Group();
    shoulder.position.set(x, 1.0, 0);
    shoulder.add(limb(0.1, 0.28, MAT.hoodie));
    const fore = new THREE.Group();
    fore.position.y = -0.28;
    fore.add(limb(0.085, 0.24, MAT.skin));
    fore.add(part(0.17, 0.07, 0.17, MAT.shoeAccent, 0, -0.1, 0)); // wristband
    fore.add(part(0.13, 0.14, 0.14, MAT.skin, 0, -0.3, 0)); // bàn tay
    shoulder.add(fore);
    rig.add(shoulder);
    return { shoulder, fore };
  }
  const armL = makeArm(-0.43);
  const armR = makeArm(0.43);

  // --- Đầu to + tóc + mũ lưỡi trai ngược ---
  const headG = new THREE.Group();
  headG.position.set(0, 1.38, 0);
  headG.add(part(0.44, 0.44, 0.42, MAT.skin, 0, 0, 0));
  headG.add(part(0.46, 0.2, 0.2, MAT.cap, 0, 0.1, 0.2)); // tóc sau gáy
  headG.add(part(0.46, 0.1, 0.44, MAT.skin, 0, -0.2, 0.05)); // cằm/cổ
  headG.add(part(0.48, 0.16, 0.46, MAT.cap, 0, 0.26, 0.02)); // chóp mũ
  headG.add(part(0.42, 0.06, 0.32, MAT.cap, 0, 0.2, 0.38)); // lưỡi trai ra sau
  headG.add(part(0.1, 0.12, 0.06, MAT.skin, -0.25, 0, 0)); // tai
  headG.add(part(0.1, 0.12, 0.06, MAT.skin, 0.25, 0, 0));
  rig.add(headG);

  const shadow = blobShadow(0.9);
  group.add(shadow);

  group.position.set(0, 0, 0);
  scene.add(group);

  const player = {
    mesh: group,
    laneIndex: 1,
    vy: 0,
    grounded: true,
    slideTimer: 0,
    baseHeight: BODY_H,
    phase: 0,

    moveLane(dir) {
      const next = this.laneIndex + dir;
      if (next >= 0 && next < LANES.length) this.laneIndex = next;
    },

    jump() {
      if (this.grounded && this.slideTimer <= 0) {
        this.vy = JUMP_VELOCITY;
        this.grounded = false;
      }
    },

    slide() {
      if (this.grounded) this.slideTimer = SLIDE_DURATION;
    },

    reset() {
      this.laneIndex = 1;
      this.vy = 0;
      this.grounded = true;
      this.slideTimer = 0;
      this.phase = 0;
      this.justLanded = false;
      this.landTimer = 0;
      group.position.set(0, 0, 0);
      group.rotation.set(0, 0, 0);
      rig.scale.set(1, 1, 1);
      rig.position.y = 0;
    },

    update(dt) {
      // Đổi làn: lerp x về làn mục tiêu
      const targetX = LANES[this.laneIndex];
      const dx = targetX - group.position.x;
      group.position.x += dx * Math.min(1, LANE_LERP_SPEED * dt);
      if (Math.abs(dx) < 0.01) group.position.x = targetX;
      // Nghiêng người + xoay vai theo hướng đổi làn
      group.rotation.z = THREE.MathUtils.clamp(-dx * 0.12, -0.28, 0.28);
      group.rotation.y = THREE.MathUtils.clamp(-dx * 0.06, -0.15, 0.15);

      // Nhảy: trọng lực
      if (!this.grounded) {
        this.vy += GRAVITY * dt;
        group.position.y += this.vy * dt;
        if (group.position.y <= 0) {
          group.position.y = 0;
          this.vy = 0;
          this.grounded = true;
          this.justLanded = true; // game đọc rồi clear
          this.landTimer = 0.12; // squash visual, không đụng bounds
        }
      }

      // Chạy tại chỗ: tay chân đối xứng + bounce thân + gật đầu nhẹ
      this.phase += dt * 11;
      const swing = Math.sin(this.phase);
      if (!this.grounded) {
        legL.rotation.x = 0.55;
        legR.rotation.x = -0.3;
        armL.shoulder.rotation.x = -1.0;
        armR.shoulder.rotation.x = -1.0;
        armL.fore.rotation.x = -0.4;
        armR.fore.rotation.x = -0.4;
        rig.position.y = 0;
        headG.rotation.x = -0.12;
      } else if (this.slideTimer > 0) {
        legL.rotation.x = 0.9;
        legR.rotation.x = 0.9;
        armL.shoulder.rotation.x = 0.7;
        armR.shoulder.rotation.x = 0.7;
        rig.position.y = 0;
        headG.rotation.x = 0.15;
      } else {
        legL.rotation.x = swing * 0.75;
        legR.rotation.x = -swing * 0.75;
        armL.shoulder.rotation.x = -swing * 0.65;
        armR.shoulder.rotation.x = swing * 0.65;
        armL.fore.rotation.x = -0.35 - Math.max(0, swing) * 0.25;
        armR.fore.rotation.x = -0.35 - Math.max(0, -swing) * 0.25;
        rig.position.y = Math.abs(Math.sin(this.phase)) * 0.045;
        headG.rotation.x = Math.sin(this.phase - 0.6) * 0.06;
      }
      pack.position.y = 0.92 + Math.abs(Math.sin(this.phase)) * 0.03;

      // Trượt: scale cả rig (đỉnh visual ≈ bounds trượt)
      // Squash tiếp đất nhân thêm 0.9 — visual only, bounds giữ nguyên.
      if (this.landTimer > 0) this.landTimer -= dt;
      const squash = this.landTimer > 0 ? 0.9 : 1;
      if (this.slideTimer > 0) {
        this.slideTimer -= dt;
        rig.scale.set(1, SLIDE_SCALE * squash, 1);
      } else {
        rig.scale.set(1, squash, 1);
      }
    },

    getBounds() {
      const h = this.slideTimer > 0 ? BODY_H * 0.5 : BODY_H + 0.5;
      const y0 = group.position.y;
      return {
        minX: group.position.x - BODY_W / 2,
        maxX: group.position.x + BODY_W / 2,
        minY: y0,
        maxY: y0 + h,
        minZ: group.position.z - BODY_D / 2,
        maxZ: group.position.z + BODY_D / 2,
      };
    },
  };

  return player;
}
