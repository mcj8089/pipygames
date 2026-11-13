// ============================================================================
// 战斗特效：命中火花爆点（命中/格挡/对拼三色）、汗水液滴、KO 大爆点、
// 全屏白闪（tp4 起身闪光 / 胜负定格）。单粒子池 Points 实现，加性混合。
// ============================================================================
import * as THREE from 'three';

G.Art = G.Art || {};

G.Art.fx = (function () {

  const MAX = 420;
  let scene, camera, points, flashMesh, flashVal = 0;
  const pos = new Float32Array(MAX * 3);
  const col = new Float32Array(MAX * 3);
  const vel = new Float32Array(MAX * 3);
  const life = new Float32Array(MAX);      // 剩余寿命
  const grav = new Float32Array(MAX);      // 每粒子重力
  let cursor = 0;

  const PALETTES = {
    hit:    [[1, 0.85, 0.35], [1, 0.55, 0.2], [1, 0.95, 0.75], [1, 0.3, 0.12]],
    block:  [[0.85, 0.95, 1], [0.55, 0.75, 1], [1, 1, 1]],
    clash:  [[1, 1, 1], [1, 0.95, 0.7], [0.8, 0.9, 1]],
    sweat:  [[0.65, 0.85, 1], [0.85, 0.95, 1], [0.5, 0.7, 0.95]],
    ko:     [[1, 0.8, 0.3], [1, 0.4, 0.15], [1, 1, 0.9], [1, 0.25, 0.1]]
  };

  function init(sc, cam) {
    scene = sc; camera = cam;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const mat = new THREE.PointsMaterial({
      map: G.Art.textures.spark(), size: 0.065, transparent: true, opacity: 0.9,
      vertexColors: true, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true
    });
    points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    for (let i = 0; i < MAX; i++) life[i] = 0;
    scene.add(points);

    // 全屏白闪面片（挂在相机上）
    flashMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.42, 0.3),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false })
    );
    flashMesh.position.set(0, 0, -0.2);
    flashMesh.renderOrder = 999;
    cam.add(flashMesh);
  }

  function spawn(x, y, z, vx, vy, vz, c, lf, g) {
    const i = cursor; cursor = (cursor + 1) % MAX;
    pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
    vel[i * 3] = vx; vel[i * 3 + 1] = vy; vel[i * 3 + 2] = vz;
    col[i * 3] = c[0]; col[i * 3 + 1] = c[1]; col[i * 3 + 2] = c[2];
    life[i] = lf; grav[i] = g == null ? 3.2 : g;
  }

  // kind: hit / block / clash / sweat / ko
  function burst(kind, p, dir) {
    const pal = PALETTES[kind] || PALETTES.hit;
    const n = kind === 'ko' ? 32 : (kind === 'clash' ? 15 : (kind === 'sweat' ? 5 : 12));
    const speed = kind === 'ko' ? 3.6 : (kind === 'sweat' ? 1.9 : 2.4);
    dir = dir || new THREE.Vector3(0, 0, 1);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const b = (Math.random() - 0.5) * Math.PI;
      const sp = speed * (0.4 + Math.random() * 0.8);
      const v = new THREE.Vector3(
        dir.x + Math.cos(a) * Math.cos(b),
        dir.y + Math.sin(b) * 0.8,
        dir.z + Math.sin(a) * Math.cos(b)
      ).multiplyScalar(sp);
      const c = pal[(Math.random() * pal.length) | 0];
      spawn(p.x, p.y, p.z, v.x, v.y, v.z, c, 0.28 + Math.random() * 0.3, kind === 'sweat' ? 5.5 : 3.0);
    }
  }

  // 汗珠：从对手头部受击方向甩出
  function sweat(p, dir) { burst('sweat', p, dir); }

  // 全屏白闪（strength 0-1）
  function flash(strength) { flashVal = Math.max(flashVal, strength); }

  function update(dt) {
    for (let i = 0; i < MAX; i++) {
      if (life[i] <= 0) { col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = 0; continue; }
      life[i] -= dt;
      vel[i * 3 + 1] -= grav[i] * dt;
      pos[i * 3] += vel[i * 3] * dt;
      pos[i * 3 + 1] += vel[i * 3 + 1] * dt;
      pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
      // 颜色随寿命衰减（加性混合下自然变暗消失）
      const k = Math.max(0, Math.min(1, life[i] * 3.2));
      col[i * 3] *= 0.96 + 0.04 * k; col[i * 3 + 1] *= 0.96 + 0.04 * k; col[i * 3 + 2] *= 0.96 + 0.04 * k;
    }
    points.geometry.attributes.position.needsUpdate = true;
    points.geometry.attributes.color.needsUpdate = true;

    if (flashVal > 0) {
      flashVal = Math.max(0, flashVal - dt * 2.6);
      flashMesh.material.opacity = flashVal;
      flashMesh.visible = flashVal > 0.005;
    }
  }

  return { init, burst, sweat, flash, update };
})();
