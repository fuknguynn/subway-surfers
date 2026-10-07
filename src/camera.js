import * as THREE from 'three';

// Camera rig: follow mượt + bob + lean + FOV theo tốc độ + dip/shake.
// Mọi biên độ đều clamp cho màn hình nhỏ. Không cấp phát trong update.
const BASE_POS = { x: 0, y: 4.0, z: 9.0 };
const PORTRAIT_POS = { x: 0, y: 4.6, z: 10.2 };
const LOOK = { x: 0, y: 1.2, z: -8 };
const FOV_MIN = 60;
const FOV_MAX = 72;
const SPEED_MIN = 12;
const SPEED_MAX = 30;
const BOB_AMP = 0.06;
const LANE_FOLLOW = 0.35;
const LAND_DIP = 0.18;
const HIT_SHAKE = 0.25;
const HIT_TIME = 0.3;

export function createCamera(camera) {
  const lookTarget = new THREE.Vector3(LOOK.x, LOOK.y, LOOK.z);
  const rig = {
    t: 0,
    camX: 0,
    dip: 0,
    shakeT: 0,
    base: { ...BASE_POS },
    lastFov: -1,

    reframe(aspect) {
      const b = aspect < 0.8 ? PORTRAIT_POS : BASE_POS;
      rig.base.x = b.x;
      rig.base.y = b.y;
      rig.base.z = b.z;
    },

    update(dt, s) {
      rig.t += dt;
      const speed = s.speed ?? SPEED_MIN;

      // FOV theo tốc độ
      const k = Math.min(1, Math.max(0, (speed - SPEED_MIN) / (SPEED_MAX - SPEED_MIN)));
      const fov = FOV_MIN + (FOV_MAX - FOV_MIN) * k;
      if (Math.abs(fov - rig.lastFov) > 0.01) {
        camera.fov = fov;
        camera.updateProjectionMatrix();
        rig.lastFov = fov;
      }

      // Follow làn mượt (1 phần, không dính cứng vào player)
      const targetX = (s.laneX ?? 0) * LANE_FOLLOW;
      rig.camX += (targetX - rig.camX) * Math.min(1, 6 * dt);

      // Dip khi tiếp đất (decay), shake khi đâm
      if (s.justLanded) rig.dip = 1;
      rig.dip *= Math.exp(-8 * dt);
      if (s.hit) rig.shakeT = HIT_TIME;
      if (rig.shakeT > 0) rig.shakeT -= dt;
      const shakeK = rig.shakeT > 0 ? rig.shakeT / HIT_TIME : 0;

      const bob = Math.sin(rig.t * 9) * BOB_AMP * (0.4 + 0.6 * k);
      const shakeX = Math.sin(rig.t * 70) * HIT_SHAKE * shakeK;
      const shakeY = Math.cos(rig.t * 55) * HIT_SHAKE * 0.6 * shakeK;

      camera.position.set(
        rig.base.x + rig.camX + shakeX,
        rig.base.y + bob - rig.dip * LAND_DIP + shakeY,
        rig.base.z,
      );
      camera.lookAt(lookTarget);
    },
  };

  return rig;
}
