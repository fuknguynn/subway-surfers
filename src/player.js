import * as THREE from 'three';

export const LANES = [-2, 0, 2];

const LANE_LERP_SPEED = 12;
const JUMP_VELOCITY = 8.5;
const GRAVITY = -26;
const SLIDE_DURATION = 0.7;
const BODY_W = 0.7;
const BODY_H = 1.4;
const BODY_D = 0.5;

export function createPlayer(scene) {
  const group = new THREE.Group();

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(BODY_W, BODY_H, BODY_D),
    new THREE.MeshStandardMaterial({ color: 0x2266ff }),
  );
  body.position.y = BODY_H / 2;
  group.add(body);

  const head = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.5, 0.5),
    new THREE.MeshStandardMaterial({ color: 0xffcc99 }),
  );
  head.position.y = BODY_H + 0.25;
  group.add(head);

  group.position.set(0, 0, 0);
  scene.add(group);

  const player = {
    mesh: group,
    laneIndex: 1,
    vy: 0,
    grounded: true,
    slideTimer: 0,
    baseHeight: BODY_H,

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

    update(dt) {
      // Đổi làn: lerp x về làn mục tiêu
      const targetX = LANES[this.laneIndex];
      const dx = targetX - group.position.x;
      group.position.x += dx * Math.min(1, LANE_LERP_SPEED * dt);
      if (Math.abs(dx) < 0.01) group.position.x = targetX;

      // Nhảy: trọng lực
      if (!this.grounded) {
        this.vy += GRAVITY * dt;
        group.position.y += this.vy * dt;
        if (group.position.y <= 0) {
          group.position.y = 0;
          this.vy = 0;
          this.grounded = true;
        }
      }

      // Trượt: hạ chiều cao 1 lúc
      if (this.slideTimer > 0) {
        this.slideTimer -= dt;
        body.scale.y = 0.5;
        body.position.y = (BODY_H * 0.5) / 2;
      } else {
        body.scale.y = 1;
        body.position.y = BODY_H / 2;
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
