// ============================================================================
// 拳台环境：帆布擂台 / 围绳三层 / 角柱护垫 / 裙板 / 观众席 / 聚光灯与光锥 /
// LED 环绕广告屏（滚动）。全程程序化建模 + 贴图，细节丰富、光影层次完整。
// 坐标约定：玩家位于原点附近（z≈0），对手在 -z 方向，擂台中心 z=-2.2。
// ============================================================================
import * as THREE from 'three';

G.Art = G.Art || {};

G.Art.env = (function () {

  const RING = 6.1;               // 擂台边长（米）
  const RZ = -2.2;                // 擂台中心 z
  const H = RING / 2;
  const ROPE_H = [0.62, 0.98, 1.34];

  // ---------- LED 广告屏贴图（滚动横幅） ----------
  function ledTexture() {
    const c = G.Art.textures.canvas(1024, 128), x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 0, 128);
    g.addColorStop(0, '#120620'); g.addColorStop(1, '#1d0a30');
    x.fillStyle = g; x.fillRect(0, 0, 1024, 128);
    // LED 像素颗粒
    for (let py = 0; py < 128; py += 4) {
      for (let px = 0; px < 1024; px += 4) {
        x.fillStyle = 'rgba(255,255,255,' + (0.02 + Math.random() * 0.05) + ')';
        x.fillRect(px, py, 2, 2);
      }
    }
    x.font = '900 56px "Arial Black", sans-serif';
    x.textBaseline = 'middle';
    const items = [
      ['KNOCKOUT ARENA', '#f2c94c'],
      ['pipygames.com', '#5ee0ff'],
      ['FIGHT NIGHT', '#ff5e6d']
    ];
    for (let i = 0; i < 4; i++) {
      const it = items[i % 3];
      x.fillStyle = it[1];
      x.shadowColor = it[1]; x.shadowBlur = 18;
      x.fillText(it[0], 40 + i * 256, 64);
      x.shadowBlur = 0;
    }
    return G.Art.textures.tex(c, true);
  }

  // ---------- 混凝土场馆地面 ----------
  function concreteTexture() {
    const S = 512, c = G.Art.textures.canvas(S, S), x = c.getContext('2d');
    const g = x.createRadialGradient(S / 2, S / 2, 60, S / 2, S / 2, S * 0.75);
    g.addColorStop(0, '#2b2b31'); g.addColorStop(1, '#101014');
    x.fillStyle = g; x.fillRect(0, 0, S, S);
    const img = x.getImageData(0, 0, S, S);
    for (let i = 0; i < img.data.length; i += 4) {
      const n = (Math.random() - 0.5) * 16;
      img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n;
    }
    x.putImageData(img, 0, 0);
    x.strokeStyle = 'rgba(0,0,0,0.35)'; x.lineWidth = 3;
    for (let i = 0; i < 14; i++) {   // 混凝土接缝
      x.beginPath();
      if (i % 2 === 0) { x.moveTo(0, i * 38); x.lineTo(S, i * 38 + (Math.random() - 0.5) * 10); }
      else { x.moveTo(i * 38, 0); x.lineTo(i * 38 + (Math.random() - 0.5) * 10, S); }
      x.stroke();
    }
    return G.Art.textures.tex(c, true);
  }

  // ---------- 穹顶贴图（桁架剪影 + 灯串 + 微星点，避免纯黑背景） ----------
  function domeTexture() {
    const W = 1024, H = 512, c = G.Art.textures.canvas(W, H), x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0a0910'); g.addColorStop(0.6, '#0d0b13'); g.addColorStop(1, '#131019');
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    // 微弱星点
    for (let i = 0; i < 130; i++) {
      x.fillStyle = 'rgba(210,220,255,' + (0.04 + Math.random() * 0.14) + ')';
      x.fillRect(Math.random() * W, Math.random() * H * 0.55, 1.6, 1.6);
    }
    // 钢桁架剪影（两排横梁 + 斜撑）
    x.strokeStyle = 'rgba(28,26,34,0.95)'; x.lineWidth = 10;
    [0.30, 0.42].forEach(fy => {
      x.beginPath(); x.moveTo(0, H * fy); x.lineTo(W, H * fy); x.stroke();
      x.lineWidth = 5;
      for (let px = 0; px < W; px += 64) {
        x.beginPath(); x.moveTo(px, H * fy); x.lineTo(px + 40, H * (fy - 0.055)); x.stroke();
      }
      x.lineWidth = 10;
    });
    // 桁架上的灯串（暖光点）
    for (let px = 24; px < W; px += 64) {
      [0.30, 0.42].forEach(fy => {
        const gg = x.createRadialGradient(px, H * fy + 14, 0, px, H * fy + 14, 16);
        gg.addColorStop(0, 'rgba(255,232,180,0.85)');
        gg.addColorStop(0.4, 'rgba(255,210,130,0.28)');
        gg.addColorStop(1, 'rgba(255,200,110,0)');
        x.fillStyle = gg; x.beginPath(); x.arc(px, H * fy + 14, 16, 0, 7); x.fill();
      });
    }
    // 悬挂横幅剪影
    x.fillStyle = 'rgba(20,14,24,0.9)';
    for (let i = 0; i < 5; i++) {
      const bx = 80 + i * 200;
      x.fillRect(bx, H * 0.52, 120, 54);
      x.fillStyle = 'rgba(242,201,76,0.14)';
      x.fillRect(bx + 10, H * 0.52 + 12, 100, 8);
      x.fillRect(bx + 10, H * 0.52 + 30, 70, 6);
      x.fillStyle = 'rgba(20,14,24,0.9)';
    }
    return G.Art.textures.tex(c);
  }

  // ---------- 搭建 ----------
  function build(scene) {
    const group = new THREE.Group();
    scene.add(group);
    const T = G.Art.textures;

    // —— 擂台帆布地板 ——
    const floorTex = T.ringFloor();
    const ring = new THREE.Mesh(
      new THREE.BoxGeometry(RING, 0.24, RING),
      new THREE.MeshStandardMaterial({ roughness: 0.92, metalness: 0 })
    );
    ring.position.set(0, 0.12 - 0.12 + 0.0, RZ);
    ring.position.y = -0.12;             // 台面 y=0
    // 台面贴图单独铺一层（六面体贴图只有顶面用帆布）
    // emissive 保底：任何灯光状态下台面均可读（防止聚光偏移时全黑）
    const topMat = new THREE.MeshStandardMaterial({
      map: floorTex, roughness: 0.94,
      emissive: 0x8a8074, emissiveMap: floorTex, emissiveIntensity: 0.22
    });
    const sideMat = new THREE.MeshStandardMaterial({ color: 0x8a8172, roughness: 0.9 });
    ring.material = [sideMat, sideMat, topMat, sideMat, sideMat, sideMat];
    group.add(ring);

    // —— 围裙裙板（四侧倾斜覆盖） ——
    const apronTex = T.apron();
    const apronMat = new THREE.MeshStandardMaterial({ map: apronTex, roughness: 0.85, side: THREE.DoubleSide });
    const apronGeo = new THREE.PlaneGeometry(RING + 0.3, 0.62);
    const aprons = [];
    for (let i = 0; i < 4; i++) {
      const a = new THREE.Mesh(apronGeo, apronMat.clone());
      a.material.map = apronTex.clone();
      a.material.map.wrapS = a.material.map.wrapT = THREE.RepeatWrapping;
      a.material.map.repeat.set(2, 1);
      a.material.map.needsUpdate = true;
      a.position.y = -0.24;
      if (i === 0) { a.position.set(0, -0.22, RZ - H - 0.14); }                 // 后
      if (i === 1) { a.position.set(0, -0.22, RZ + H + 0.14); a.rotation.y = Math.PI; } // 前（面向玩家内侧）
      if (i === 2) { a.position.set(-H - 0.14, -0.22, RZ); a.rotation.y = Math.PI / 2; }
      if (i === 3) { a.position.set(H + 0.14, -0.22, RZ); a.rotation.y = -Math.PI / 2; }
      a.rotation.x = i === 1 ? 0 : 0;
      a.rotation.z = 0;
      a.rotation.x = -0.12;  // 微微外倾
      aprons.push(a);
      group.add(a);
    }

    // —— 台体基座（暗色） ——
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(RING + 0.8, 0.5, RING + 0.8),
      new THREE.MeshStandardMaterial({ color: 0x1a1216, roughness: 0.95 })
    );
    base.position.set(0, -0.49, RZ);
    group.add(base);

    // —— 场馆地面 ——
    const gTex = concreteTexture();
    gTex.repeat.set(14, 14);
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(40, 48),
      new THREE.MeshStandardMaterial({ map: gTex, roughness: 1 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.74;
    group.add(ground);

    // —— 角柱 + 护垫 + 转角螺盘 ——
    const corners = [
      { x: -H, z: RZ - H, color: 0xb3202a },  // 红角
      { x: H, z: RZ - H, color: 0x2456a8 },   // 蓝角
      { x: -H, z: RZ + H, color: 0x2456a8 },
      { x: H, z: RZ + H, color: 0xb3202a }
    ];
    const padMats = {};
    corners.forEach(cn => {
      // 金属立柱
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.055, 1.72, 12),
        new THREE.MeshStandardMaterial({ color: 0x9aa0a8, metalness: 0.85, roughness: 0.35 })
      );
      post.position.set(cn.x, 0.72, cn.z);
      group.add(post);
      // 护垫（胶囊状红色/蓝色软垫）
      const mat = padMats[cn.color] || (padMats[cn.color] = new THREE.MeshStandardMaterial({ color: cn.color, roughness: 0.6 }));
      const pad = new THREE.Mesh(new THREE.CapsuleGeometry(0.115, 1.16, 6, 14), mat);
      pad.position.set(cn.x, 0.86, cn.z);
      group.add(pad);
      // 顶部金属圆盘
      const disk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.09, 0.09, 0.05, 16),
        new THREE.MeshStandardMaterial({ color: 0xd8dce2, metalness: 0.9, roughness: 0.25 })
      );
      disk.position.set(cn.x, 1.6, cn.z);
      group.add(disk);
    });

    // —— 三层围绳（每侧 3 根，带轻微下垂） ——
    const ropeColors = [0xe8e2d4, 0xb3202a, 0x2456a8];
    const ropeMats = ropeColors.map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.55 }));
    const SAG = 0.045;
    const sides = [
      { a: [-H, RZ - H], b: [H, RZ - H] },
      { a: [-H, RZ + H], b: [H, RZ + H] },
      { a: [-H, RZ - H], b: [-H, RZ + H] },
      { a: [H, RZ - H], b: [H, RZ + H] }
    ];
    sides.forEach(sd => {
      ROPE_H.forEach((hy, ri) => {
        const curve = new THREE.QuadraticBezierCurve3(
          new THREE.Vector3(sd.a[0], hy, sd.a[1]),
          new THREE.Vector3((sd.a[0] + sd.b[0]) / 2, hy - SAG, (sd.a[1] + sd.b[1]) / 2),
          new THREE.Vector3(sd.b[0], hy, sd.b[1])
        );
        const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 20, 0.028, 8), ropeMats[ri]);
        tube.castShadow = false;
        group.add(tube);
        // 绳索白色绑带（每段中点）
      });
    });
    // 绑带（围绳与角柱交点）
    sides.forEach(sd => {
      [sd.a, sd.b].forEach(pt => {
        ROPE_H.forEach(hy => {
          const wrap = new THREE.Mesh(
            new THREE.CylinderGeometry(0.05, 0.05, 0.09, 10),
            new THREE.MeshStandardMaterial({ color: 0xe8e2d4, roughness: 0.7 })
          );
          wrap.position.set(pt[0], hy, pt[1]);
          group.add(wrap);
        });
      });
    });

    // —— 观众席（4 侧三层看台 + Sprite 观众，摆动动画） ——
    const crowdSprites = [];
    const shirtCols = ['#7a3040', '#2f4a6e', '#6e5a2f', '#3c2f5e', '#2f5e46', '#5e2f2f', '#444a52', '#6e4a2a'];
    const skinTones = ['#e3b088', '#c98d5f', '#8a5a38', '#5e3a22', '#f0c8a0'];
    const mats = [];
    for (let i = 0; i < 10; i++) {
      mats.push(new THREE.SpriteMaterial({
        map: T.crowd(shirtCols[i % shirtCols.length], skinTones[i % skinTones.length]),
        transparent: true, opacity: 0.96, depthWrite: false
      }));
    }
    const tierY = [0.1, 0.85, 1.6];      // 三层看台高度
    const tierDist = [7.2, 8.6, 10.0];   // 距擂台中心距离
    function addCrowdSide(axis, sign) {
      for (let tier = 0; tier < 3; tier++) {
        const n = 26;
        for (let i = 0; i < n; i++) {
          const m = mats[(i + tier) % mats.length].clone();
          const s = new THREE.Sprite(m);
          const off = -1 + (i / (n - 1)) * 2;              // -1..1
          const d = tierDist[tier];
          const px = axis === 'x' ? off * d * 0.92 : sign * d;
          const pz = axis === 'z' ? off * d * 0.92 : sign * d;
          s.position.set(px, tierY[tier] + (Math.random() - 0.5) * 0.06, pz);
          const sc = 0.9 + Math.random() * 0.35;
          s.scale.set(0.62 * sc, 0.93 * sc, 1);
          s.userData.phase = Math.random() * Math.PI * 2;
          s.userData.amp = 0.02 + Math.random() * 0.05;
          s.userData.baseY = s.position.y;
          crowdSprites.push(s);
          group.add(s);
        }
        // 看台阶梯（暗色，制造层次）
        const step = new THREE.Mesh(
          new THREE.BoxGeometry(axis === 'x' ? tierDist[tier] * 1.9 : 1.2, 0.4, axis === 'x' ? 1.2 : tierDist[tier] * 1.9),
          new THREE.MeshStandardMaterial({ color: 0x17171c, roughness: 1 })
        );
        step.position.set(axis === 'x' ? 0 : sign * (tierDist[tier] - 0.3), tierY[tier] - 0.42, axis === 'x' ? sign * (tierDist[tier] - 0.3) : 0);
        group.add(step);
      }
    }
    addCrowdSide('x', -1); addCrowdSide('x', 1);
    addCrowdSide('z', -1); addCrowdSide('z', 1);

    // —— LED 环绕广告屏 ——
    const ledMat = new THREE.MeshBasicMaterial({ map: ledTexture(), toneMapped: false });
    ledMat.map.repeat.set(3, 1);
    const ledY = 3.4, ledDist = 11.6;
    const ledPanels = [];
    for (let i = 0; i < 4; i++) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(2 * ledDist * 0.92, 0.85), ledMat.clone());
      if (i === 0) p.position.set(0, ledY, -ledDist);
      if (i === 1) { p.position.set(0, ledY, ledDist); p.rotation.y = Math.PI; }
      if (i === 2) { p.position.set(-ledDist, ledY, 0); p.rotation.y = Math.PI / 2; }
      if (i === 3) { p.position.set(ledDist, ledY, 0); p.rotation.y = -Math.PI / 2; }
      p.material.map = p.material.map.clone();
      p.material.map.wrapS = THREE.RepeatWrapping;
      p.material.map.needsUpdate = true;
      ledPanels.push(p);
      group.add(p);
      // 屏框
      const frame = new THREE.Mesh(
        new THREE.BoxGeometry(i < 2 ? 2 * ledDist * 0.95 : 0.25, 1.0, i < 2 ? 0.25 : 2 * ledDist * 0.95),
        new THREE.MeshStandardMaterial({ color: 0x0a0a0e, roughness: 0.9 })
      );
      frame.position.copy(p.position); frame.position.y -= 0.02;
      group.add(frame);
    }

    // —— 灯光：顶部主聚光 + 两辅光 + 环境光 + 保底定向光 ——
    // 注：ACES 色调映射 + 物理衰减会大幅压暗，强度按实测调校。
    // key 聚光降低强度、扩大光锥，避免台面中心过曝；基础照明靠 hemisphere+dir 稳住。
    const ambient = new THREE.HemisphereLight(0x9aa2c8, 0x2a2018, 1.05);
    group.add(ambient);
    const amb = new THREE.AmbientLight(0x50546a, 0.5);
    group.add(amb);
    // 保底定向光：无论距离衰减如何，台面/围绳/观众至少有基础照明
    const dir = new THREE.DirectionalLight(0xfff0d8, 1.1);
    dir.position.set(2.5, 9, RZ + 5);
    dir.target.position.set(0, 0, RZ);
    group.add(dir); group.add(dir.target);

    const key = new THREE.SpotLight(0xfff2dc, 190, 40, 0.78, 0.55, 1.5);
    key.position.set(0, 11, RZ - 0.5);
    key.target.position.set(0, 0, RZ);
    group.add(key); group.add(key.target);

    const fill1 = new THREE.SpotLight(0xd8e4ff, 150, 40, 0.8, 0.6, 1.6);
    fill1.position.set(-6, 8.5, RZ + 4);
    fill1.target.position.set(-1, 0, RZ);
    group.add(fill1); group.add(fill1.target);

    const fill2 = new THREE.SpotLight(0xffe0c8, 150, 40, 0.8, 0.6, 1.6);
    fill2.position.set(6, 8.5, RZ + 4);
    fill2.target.position.set(1, 0, RZ);
    group.add(fill2); group.add(fill2.target);

    // 玩家正面补光（让对手面部清晰；强度需低——玩家拳套距此灯仅 2m 余，
    // 物理衰减下强度过大会把第一人称拳套打成白色）
    const front = new THREE.PointLight(0xffe8c8, 10, 9, 1.8);
    front.position.set(0, 2.2, RZ + 2.6);
    group.add(front);

    // —— 可见光锥（加性半透明，营造擂台上空的氛围） ——
    const coneMat = new THREE.MeshBasicMaterial({
      color: 0xfff2d8, transparent: true, opacity: 0.055,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
    });
    const cones = [];
    [[0, 11, RZ - 0.5], [-6, 8.5, RZ + 4], [6, 8.5, RZ + 4]].forEach(pos => {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(2.6, 10.5, 24, 1, true), coneMat.clone());
      cone.position.set(pos[0], pos[1] - 5.0, pos[2]);
      group.add(cone);
      cones.push(cone);
    });

    // —— 远景暗幕（桁架+灯串贴图，避免纯黑背景） ——
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(38, 24, 16),
      new THREE.MeshBasicMaterial({ map: domeTexture(), side: THREE.BackSide })
    );
    group.add(dome);

    // —— 漂浮尘埃粒子（氛围，低密度小颗粒） ——
    const dustGeo = new THREE.BufferGeometry();
    const dustN = 48, dpos = new Float32Array(dustN * 3);
    for (let i = 0; i < dustN; i++) {
      dpos[i * 3] = (Math.random() - 0.5) * 14;
      dpos[i * 3 + 1] = Math.random() * 6 + 0.5;
      dpos[i * 3 + 2] = RZ + (Math.random() - 0.5) * 14;
    }
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dpos, 3));
    const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({
      map: T.glow(), size: 0.045, transparent: true, opacity: 0.16,
      blending: THREE.AdditiveBlending, depthWrite: false, color: 0xffe8b0
    }));
    group.add(dust);

    // —— 每帧更新：观众摆动 / LED 滚动 / 光锥呼吸 / 尘埃上浮 ——
    let t = 0;
    function update(dt) {
      t += dt;
      for (let i = 0; i < crowdSprites.length; i++) {
        const s = crowdSprites[i];
        s.position.y = s.userData.baseY + Math.sin(t * 2.1 + s.userData.phase) * s.userData.amp;
      }
      for (let i = 0; i < ledPanels.length; i++) {
        ledPanels[i].material.map.offset.x -= dt * 0.06;
      }
      cones.forEach((c, i) => {
        c.material.opacity = 0.045 + Math.sin(t * 1.3 + i * 2) * 0.018;
      });
      dust.rotation.y += dt * 0.01;
      const dp = dust.geometry.attributes.position;
      for (let i = 0; i < dustN; i++) {
        let y = dp.getY(i) + dt * 0.06;
        if (y > 6.5) y = 0.5;
        dp.setY(i, y);
      }
      dp.needsUpdate = true;
    }

    return { group, update, ringCenter: new THREE.Vector3(0, 0, RZ), RING, H };
  }

  return { build, RING, RZ, H };
})();
