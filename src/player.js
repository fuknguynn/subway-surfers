import * as THREE from 'three';
import { MAT, part, blobShadow } from './assets.js';

export const LANES = [-2, 0, 2];

// Số vật lý GIỮ NGUYÊN — visual chỉ thay hình, không đụng gameplay.
const LANE_LERP_SPEED = 12;
const JUMP_VELOCITY = 8.5;
const GRAVITY = -26;
const SLIDE_DURATION = 0.7;
const BODY_W = 0.7;
const BODY_H = 1.4;
const BODY_D = 0.5;
const STAND_TOP = 1.7; // đỉnh đầu visual khi đứng (< 1.9 của bounds)
const SLIDE_SCALE = 0.42; // 1.7 * 0.42 ≈ 0.71 ≈ bounds trượt 0.7

export function createPlayer(scene) {
  const group = new THREE.Group();
  const rig = new THREE.Group(); // toàn thân (scale khi slide)
  group.add(rig);

  // --- Chân jogger tách 2 ống + sneaker chunky ---
  function makeLeg(x) {
    const hip = new THREE.Group();
    hip.position.set(x, 0.55, 0);
    const leg = part(0.22, 0.55, 0.26, MAT.pants, 0, -0.275, 0);
    hip.add(leg);
    const shoe = part(0.26, 0.16, 0.6, MAT.shoe, 0, -0.5, 0.08);
    hip.add(shoe);
    const sole = part(0.27, 0.06, 0.62, MAT.shoeAccent, 0, -0.58, 0.08);
    hip.add(sole);
    rig.add(hip);
    return hip;
  }
  const legL = makeLeg(-0.14);
  const legR = makeLeg(0.14);

  // --- Thân hoodie + cổ áo ---
  const torso = part(0.62, 0.55, 0.42, MAT.hoodie, 0, 0.825, 0);
  rig.add(torso);
  const collar = part(0.4, 0.12, 0.3, MAT.hoodie, 0, 1.13, -0.02);
  rig.add(collar);

  // --- Balo (nảy phụ nhẹ) ---
  const pack = part(0.44, 0.4, 0.2, MAT.pack, 0, 0.95, -0.3);
  rig.add(pack);

  // --- Tay: vai hoodie + cẳng tay da + wristband ---
  function makeArm(x) {
    const shoulder = new THREE.Group();
    shoulder.position.set(x, 1.02, 0);
    const upper = part(0.16, 0.3, 0.18, MAT.hoodie, 0, -0.15, 0);
    shoulder.add(upper);
    const fore = part(0.14, 0.26, 0.16, MAT.skin, 0, -0.42, 0);
    shoulder.add(fore);
    const band = part(0.16, 0.06, 0.18, MAT.shoeAccent, 0, -0.34, 0);
    shoulder.add(band);
    rig.add(shoulder);
    return shoulder;
  }
  const armL = makeArm(-0.39);
  const armR = makeArm(0.39);

  // --- Đầu to + tóc + mũ lưỡi trai ngược (vành ra sau, phía camera) ---
  const headG = new THREE.Group();
  headG.position.set(0, 1.36, 0);
  headG.add(part(0.42, 0.42, 0.4, MAT.skin, 0, 0, 0));
  headG.add(part(0.44, 0.16, 0.42, MAT.cap, 0, 0.14, 0.03)); // tóc/vành mũ
  headG.add(part(0.46, 0.14, 0.44, MAT.cap, 0, 0.26, 0.02)); // chóp mũ
  headG.add(part(0.4, 0.06, 0.3, MAT.cap, 0, 0.2, 0.36)); // lưỡi trai ra sau
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
    justLanded: false,
    landTimer: 0,

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
    },

    update(dt) {
      // Đổi làn: lerp x về làn mục tiêu
      const targetX = LANES[this.laneIndex];
      const dx = targetX - group.position.x;
      group.position.x += dx * Math.min(1, LANE_LERP_SPEED * dt);
      if (Math.abs(dx) < 0.01) group.position.x = targetX;
      // Nghiêng người theo hướng đổi làn
      group.rotation.z = THREE.MathUtils.clamp(-dx * 0.12, -0.28, 0.28);

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

      // Chạy tại chỗ: tay chân đối xứng
      this.phase += dt * 11;
      const swing = Math.sin(this.phase);
      if (!this.grounded) {
        // Tuck khi nhảy: chân co, tay giơ
        legL.rotation.x = 0.55;
        legR.rotation.x = -0.3;
        armL.rotation.x = -1.0;
        armR.rotation.x = -1.0;
      } else if (this.slideTimer > 0) {
        legL.rotation.x = 0.9;
        legR.rotation.x = 0.9;
        armL.rotation.x = 0.7;
        armR.rotation.x = 0.7;
      } else {
        legL.rotation.x = swing * 0.75;
        legR.rotation.x = -swing * 0.75;
        armL.rotation.x = -swing * 0.65;
        armR.rotation.x = swing * 0.65;
      }
      pack.position.y = 0.95 + Math.abs(Math.sin(this.phase)) * 0.03;

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
