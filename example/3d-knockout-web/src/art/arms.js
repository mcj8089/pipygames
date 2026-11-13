// ============================================================================
// 第一人称双臂：相机空间肩部锚点 + 双骨骼解析 IK（允许出拳时手臂前伸拉长，
// 复刻原作 sprite 出拳的冲拉伸视觉）。姿态由原作玩家帧号 mi 驱动：
//   待机 1-19 / 左刺 20-31(接触24) / 右刺 32-47(接触39) / 格挡 48-55 /
//   受击A 56-60 / 受击B 68-72 / 右上勾 74-86(接触81) / 左上勾 87-99(接触94) /
//   挑衅摆手 118
// ============================================================================
import * as THREE from 'three';

G.Art = G.Art || {};

G.Art.arms = (function () {

  const SHOULDER = { L: new THREE.Vector3(0.32, -0.42, -0.25), R: new THREE.Vector3(-0.32, -0.42, -0.25) };
  const UPPER = 0.30, FORE = 0.30, GLOVE_R = 0.076;
  const STRETCH_MAX = 1.45;   // 出拳时手臂最大拉长倍率

  let group, gloves, limbMats, skinColor = '#d9a06b', gloveColor = '#c22432';

  // 单位圆柱肢段（原点在顶端，沿 -Y）
  function limbMesh(radius, material) {
    const g = new THREE.CylinderGeometry(radius * 0.85, radius, 1, 10);
    g.translate(0, -0.5, 0);
    return new THREE.Mesh(g, material);
  }
  const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3();

  function placeLimb(mesh, from, to) {
    _v1.subVectors(to, from);
    const len = Math.max(0.001, _v1.length());
    mesh.position.copy(from);
    mesh.scale.set(1, len, 1);
    _v2.copy(_v1).normalize();
    mesh.quaternion.setFromUnitVectors(_v3.set(0, -1, 0), _v2);
  }

  function build(camera) {
    const T = G.Art.textures;
    group = new THREE.Group();
    const skinMat = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.78 });
    const gloveMat = new THREE.MeshStandardMaterial({ map: T.gloveLeather(gloveColor), color: 0xb0b0b0, roughness: 0.82 });
    limbMats = { skin: skinMat, glove: gloveMat };

    gloves = {};
    [['L', SHOULDER.L, 1], ['R', SHOULDER.R, -1]].forEach(([key, S, sd]) => {
      const upper = limbMesh(0.062, skinMat);
      const fore = limbMesh(0.052, skinMat);
      const elbowBall = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 8), skinMat);
      const glove = new THREE.Mesh(new THREE.SphereGeometry(GLOVE_R, 16, 14), gloveMat);
      glove.scale.set(1.02, 0.9, 1.18);
      // 拇指凸起（拳套内侧，随拳套旋转）
      const thumb = new THREE.Mesh(new THREE.SphereGeometry(GLOVE_R * 0.42, 10, 8), gloveMat);
      thumb.scale.set(0.9, 0.85, 1.35);
      thumb.position.set(sd * -GLOVE_R * 0.78, -GLOVE_R * 0.1, GLOVE_R * 0.32);
      glove.add(thumb);
      // 拳峰缝线（顶部细凹槽，增强皮革立体感）
      const seam = new THREE.Mesh(
        new THREE.TorusGeometry(GLOVE_R * 0.62, GLOVE_R * 0.055, 6, 18, Math.PI),
        new THREE.MeshStandardMaterial({ color: 0x6e1218, roughness: 0.6 })
      );
      seam.rotation.x = Math.PI / 2;
      seam.position.set(0, GLOVE_R * 0.32, 0);
      glove.add(seam);
      const wrist = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), skinMat);
      // 拳套腕口（皮革收口环 + 金色细环细节）
      const cuff = new THREE.Mesh(
        new THREE.CylinderGeometry(GLOVE_R * 0.6, GLOVE_R * 0.68, 0.055, 12),
        new THREE.MeshStandardMaterial({ map: T.gloveLeather('#8e1a24'), color: 0xb0b0b0, roughness: 0.8 })
      );
      const cuffRing = new THREE.Mesh(
        new THREE.TorusGeometry(GLOVE_R * 0.62, 0.009, 6, 14),
        new THREE.MeshStandardMaterial({ color: 0xf2c94c, roughness: 0.3, metalness: 0.6 })
      );
      group.add(upper); group.add(fore); group.add(elbowBall); group.add(glove); group.add(wrist);
      group.add(cuff); group.add(cuffRing);
      gloves[key] = { S: S.clone(), sd, upper, fore, elbowBall, glove, wrist, cuff, cuffRing, target: new THREE.Vector3(sd * 0.28, -0.27, -0.55) };
    });

    camera.add(group);
    apply(1, {});
    return { group, apply };
  }

  // ---------- 姿态关键帧：返回 {L:[x,y,z], R:[x,y,z], gloveScale} ----------
  // 相机空间：x 右正，y 上正，z 前负
  function poseFor(mi, opts) {
    const P = {
      L: [0.28, -0.27, -0.55],
      R: [-0.28, -0.29, -0.52]
    };
    // 待机呼吸（1-19 循环）
    const br = Math.sin((mi % 19) * 0.36);
    P.L[1] += br * 0.015; P.R[1] -= br * 0.012;

    // 挑衅姿态 118：双拳外张前后摆动
    if (opts && opts.taunt) {
      const w = Math.sin(performance.now() * 0.006);
      P.L = [0.4 + w * 0.04, -0.18 + w * 0.05, -0.5 - w * 0.08];
      P.R = [-0.4 - w * 0.04, -0.18 - w * 0.05, -0.5 + w * 0.08];
      return P;
    }

    const seg = (f, a, b) => Math.max(0, Math.min(1, (f - a) / (b - a)));
    const lerp3 = (o, k, tx, ty, tz, w) => {
      o[k][0] += (tx - o[k][0]) * w;
      o[k][1] += (ty - o[k][1]) * w;
      o[k][2] += (tz - o[k][2]) * w;
    };

    // —— 左刺拳 20-31（接触 24） ——
    if (mi >= 20 && mi <= 31) {
      const f = mi - 20;
      if (f <= 3) lerp3(P, 'L', 0.3, -0.28, -0.5, f / 3);            // 后摆蓄力
      else if (f <= 4) lerp3(P, 'L', 0.05, -0.1, -1.3, 1);            // 全伸（接触）
      else if (f <= 11) lerp3(P, 'L', 0.26, -0.24, -0.62, seg(f, 5, 11)); // 收回
    }
    // —— 右刺拳 32-47（接触 39） ——
    if (mi >= 32 && mi <= 47) {
      const f = mi - 32;
      if (f <= 5) lerp3(P, 'R', -0.3, -0.3, -0.48, f / 5);
      else if (f <= 7) lerp3(P, 'R', -0.05, -0.1, -1.3, 1);
      else if (f <= 15) lerp3(P, 'R', -0.26, -0.26, -0.58, seg(f, 8, 15));
    }
    // —— 格挡 48-55：双拳收拢护脸 ——
    if (mi >= 48 && mi <= 55) {
      P.L = [0.15, -0.03, -0.42];
      P.R = [-0.15, -0.04, -0.42];
    }
    // —— 受击 A 56-60 / B 68-72：双臂下垂张开 ——
    if ((mi >= 56 && mi <= 60) || (mi >= 68 && mi <= 72)) {
      const h = mi >= 56 && mi <= 60 ? 1 - Math.abs(mi - 58) / 2.5 : 1 - Math.abs(mi - 70) / 2.5;
      P.L = [0.38 + h * 0.06, -0.42 - h * 0.05, -0.5];
      P.R = [-0.4 - h * 0.06, -0.4 - h * 0.05, -0.48];
    }
    // —— 右上勾 74-86（接触 81）：右拳由下向上撩 ——
    if (mi >= 74 && mi <= 86) {
      const f = mi - 74;
      if (f <= 4) lerp3(P, 'R', -0.2, -0.55, -0.72, f / 4);           // 下沉蓄力
      else if (f <= 7) {
        const w = seg(f, 5, 7);
        P.R = [-0.2 + 0.18 * w, -0.55 + 0.62 * w, -0.72 - 0.28 * w]; // 上撩
      } else if (f <= 12) lerp3(P, 'R', -0.26, -0.26, -0.58, seg(f, 8, 12));
    }
    // —— 左上勾 87-99（接触 94） ——
    if (mi >= 87 && mi <= 99) {
      const f = mi - 87;
      if (f <= 4) lerp3(P, 'L', 0.2, -0.55, -0.72, f / 4);
      else if (f <= 7) {
        const w = seg(f, 5, 7);
        P.L = [0.2 - 0.18 * w, -0.55 + 0.62 * w, -0.72 - 0.28 * w];
      } else if (f <= 12) lerp3(P, 'L', 0.26, -0.24, -0.62, seg(f, 8, 12));
    }
    // 格挡键按住（未处于攻击帧时）强制护脸
    if (opts && opts.block && !(mi >= 20 && mi <= 47) && !(mi >= 74 && mi <= 99)) {
      P.L = [0.15, -0.03, -0.42];
      P.R = [-0.15, -0.04, -0.42];
    }
    return P;
  }

  // ---------- 每帧应用 ----------
  function apply(mi, opts) {
    if (!group) return;
    const P = poseFor(mi, opts);
    ['L', 'R'].forEach(key => {
      const g = gloves[key];
      g.target.set(P[key][0], P[key][1], P[key][2]);

      // 肩→拳距离（允许超程拉长）
      _v1.subVectors(g.target, g.S);
      const d = _v1.length();
      const reach = UPPER + FORE;
      const f = Math.min(STRETCH_MAX, Math.max(0.55, d / reach));
      const a = UPPER * f, b = FORE * f;
      _v1.normalize();

      // 肘部：近距用解析 IK 弯曲，远距沿直线伸直
      const cosA = Math.max(-1, Math.min(1, (a * a + Math.min(d, a + b) * Math.min(d, a + b) - b * b) / (2 * a * Math.min(d, a + b))));
      const sinA = Math.sqrt(1 - cosA * cosA);
      const dd = Math.min(d, a + b);
      const elbow = new THREE.Vector3().copy(g.S).addScaledVector(_v1, a * cosA);
      // 极向量：肘向下外（格挡时肘外张）
      _v2.set(g.sd * 0.8, -1, 0.2);
      _v2.addScaledVector(_v1, -_v2.dot(_v1)).normalize();
      elbow.addScaledVector(_v2, a * sinA * (d > reach * 1.05 ? 0.15 : 1));

      placeLimb(g.upper, g.S, elbow);
      const wrist = new THREE.Vector3().copy(elbow).addScaledVector(_v1, b);
      placeLimb(g.fore, elbow, wrist);
      g.elbowBall.position.copy(elbow);
      g.wrist.position.copy(wrist);
      g.glove.position.copy(wrist).addScaledVector(_v1, 0.05);
      g.glove.quaternion.setFromUnitVectors(_v3.set(0, 0, 1), _v1);
      // 皮革腕口：圆筒 Y 轴对齐手臂方向，贴在拳套后方
      g.cuff.position.copy(g.glove.position).addScaledVector(_v1, -0.042);
      g.cuff.quaternion.setFromUnitVectors(_v3.set(0, 1, 0), _v1);
      // 金环：套在腕口外沿
      g.cuffRing.position.copy(g.cuff.position).addScaledVector(_v1, -0.02);
      g.cuffRing.quaternion.copy(g.glove.quaternion);
    });
  }

  return { build, apply };
})();
