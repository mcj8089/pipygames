// ============================================================================
// 对手拳击手 3D 建模：Lathe 躯干 + 球体头部 + 双骨骼解析 IK 手臂 + 腿部姿态。
// 动画由原作帧号驱动（apply(ei, opts)），姿态关键帧与原作敌人帧语义一一对应：
//   待机 1-19 / 攻A(左刺) 20-31(接触25) / 攻B(右勾) 32-46(接触40) /
//   格挡 47-55 / 受击 56-60 / 踉跄 61-65 / 倒地 66-69
// ============================================================================
import * as THREE from 'three';

G.Art = G.Art || {};

G.Art.boxer = (function () {

  // ---------- 通用：单位圆柱肢段（原点在顶端，沿 -Y） ----------
  function limbMesh(radius, material) {
    const g = new THREE.CylinderGeometry(radius * 0.86, radius, 1, 10);
    g.translate(0, -0.5, 0);
    const m = new THREE.Mesh(g, material);
    m.castShadow = false;
    return m;
  }
  const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3();

  // 从 from 朝 to 摆放单位肢段（scale.y = 长度）
  function placeLimb(mesh, from, to) {
    _v1.subVectors(to, from);
    const len = Math.max(0.001, _v1.length());
    mesh.position.copy(from);
    mesh.scale.set(1, len, 1);
    _v2.copy(_v1).normalize();
    mesh.quaternion.setFromUnitVectors(_v3.set(0, -1, 0), _v2);
  }

  // ---------- 双骨骼解析 IK：返回肘部位置 ----------
  function solveElbow(S, T, a, b, pole, out) {
    _v1.subVectors(T, S);
    let d = _v1.length();
    const maxD = (a + b) * 0.999;
    if (d > maxD) { _v1.multiplyScalar(maxD / d); d = maxD; }
    if (d < 1e-4) d = 1e-4;
    _v1.normalize();
    // 余弦定理求肩角
    const cosA = Math.max(-1, Math.min(1, (a * a + d * d - b * b) / (2 * a * d)));
    const sinA = Math.sqrt(1 - cosA * cosA);
    // 极向量 → 垂直于 S→T 的弯曲方向
    _v2.copy(pole).sub(S);
    _v2.addScaledVector(_v1, -_v2.dot(_v1));            // 去掉沿方向分量
    if (_v2.lengthSq() < 1e-6) _v2.set(0, -1, 0);
    _v2.normalize();
    out.copy(S).addScaledVector(_v1, a * cosA).addScaledVector(_v2, a * sinA);
    return out;
  }

  // ---------- 建模一名对手 ----------
  function build(visual) {
    const T = G.Art.textures;
    const root = new THREE.Group();
    const s = visual.body || 1;
    root.scale.set(s, s, s);

    const skinMat = new THREE.MeshStandardMaterial({ map: T.skin(visual.skin), roughness: 0.62, metalness: 0 });
    const faceMat = new THREE.MeshStandardMaterial({ map: T.face(visual), roughness: 0.55 });
    const trunkMat = new THREE.MeshStandardMaterial({ map: T.trunk(Object.assign({ id: visual.id }, visual)), roughness: 0.8 });
    const gloveMat = new THREE.MeshStandardMaterial({ map: T.gloveLeather(visual.glove), roughness: 0.5 });
    const bootMat = new THREE.MeshStandardMaterial({ map: T.bootLeather(visual.boots), roughness: 0.65 });

    // 躯体组（原点 = 髋部，y=0.95）
    const body = new THREE.Group();
    body.position.y = 0.95;
    root.add(body);

    // —— 腿部（静态站姿）：body 局部原点=髋部（世界 y=0.95），腿向下延伸至世界地面 y=0，
    //    即局部 y≈-0.93；大腿→膝（-0.48）→踝（-0.90）→靴底（-0.93） ——
    const legMat = skinMat;
    [[-1, 'L'], [1, 'R']].forEach(([sd]) => {
      const hipX = sd * 0.21;
      const kneeY = -0.48, ankleY = -0.90, soleY = -0.93;
      const kneeX = hipX + sd * 0.04, ankleX = hipX + sd * 0.02;
      // 大腿
      const thigh = limbMesh(0.105, legMat);
      placeLimb(thigh, _v1.set(hipX, -0.02, 0), _v2.set(kneeX, kneeY, 0.02 * sd));
      body.add(thigh);
      // 小腿
      const shin = limbMesh(0.08, legMat);
      placeLimb(shin, _v2.set(kneeX, kneeY, 0.02 * sd), _v3.set(ankleX, ankleY, -0.02));
      body.add(shin);
      // 膝盖
      const knee = new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 8), legMat);
      knee.position.set(kneeX, kneeY, 0.02 * sd);
      body.add(knee);
      // 拳靴（鞋筒 + 鞋头），鞋筒罩住踝部
      const bootTop = new THREE.Mesh(new THREE.CylinderGeometry(0.088, 0.1, 0.34, 12), bootMat);
      bootTop.position.set(ankleX, ankleY + 0.14, -0.02);
      body.add(bootTop);
      const toe = new THREE.Mesh(new THREE.SphereGeometry(0.095, 12, 10), bootMat);
      toe.scale.set(0.9, 0.62, 1.5);
      toe.position.set(ankleX, soleY + 0.05, 0.1);
      body.add(toe);
      // 靴筒金边（鞋口上沿）
      const trim = new THREE.Mesh(new THREE.TorusGeometry(0.092, 0.018, 8, 16), new THREE.MeshStandardMaterial({ color: 0xf2c94c, roughness: 0.35, metalness: 0.6 }));
      trim.rotation.x = Math.PI / 2;
      trim.position.set(ankleX, ankleY + 0.31, -0.02);
      body.add(trim);
    });

    // —— 拳裤 + 腰带 ——
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.205, 0.225, 0.34, 18), trunkMat);
    trunk.position.y = -0.06;
    body.add(trunk);
    const belt = new THREE.Mesh(new THREE.TorusGeometry(0.21, 0.028, 8, 20), new THREE.MeshStandardMaterial({ color: visual.trunkTrim || '#f2c94c', roughness: 0.3, metalness: 0.65 }));
    belt.rotation.x = Math.PI / 2;
    belt.position.y = 0.1;
    body.add(belt);

    // —— 躯干（Lathe，皮肤贴图含腹肌细节；lathe u=0 在 +z，旋转 π 让腹肌朝前） ——
    const prof = [
      [0.205, 0.02], [0.19, 0.12], [0.165, 0.2], [0.185, 0.34],
      [0.245, 0.47], [0.262, 0.55], [0.235, 0.63], [0.12, 0.675]
    ].map(p => new THREE.Vector2(p[0], p[1]));
    const torso = new THREE.Mesh(new THREE.LatheGeometry(prof, 22), skinMat);
    torso.rotation.y = Math.PI;
    body.add(torso);

    // —— 头颈 ——
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.085, 0.12, 12), skinMat);
    neck.position.y = 0.72;
    body.add(neck);
    const headGroup = new THREE.Group();
    headGroup.position.y = 0.9;
    body.add(headGroup);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.155, 26, 20), faceMat);
    head.scale.set(0.94, 1.04, 0.98);
    headGroup.add(head);
    // 鼻子（小凸起，增强侧面轮廓）
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 8), skinMat);
    nose.position.set(0, 0.0, 0.15);
    headGroup.add(nose);
    // 发型
    if (visual.hair === 'buzz') {
      const hairMat = new THREE.MeshStandardMaterial({ color: visual.hairColor, roughness: 0.9 });
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.157, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.42), hairMat);
      cap.position.y = 0.012;
      headGroup.add(cap);
    } else if (visual.hair === 'mohawk') {
      const hairMat = new THREE.MeshStandardMaterial({ color: visual.hairColor, roughness: 0.85 });
      const crest = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), hairMat);
      crest.scale.set(0.045, 0.085, 0.17);
      crest.position.set(0, 0.145, -0.01);
      headGroup.add(crest);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.156, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.3), new THREE.MeshStandardMaterial({ color: 0x241a12, roughness: 0.95 }));
      cap.position.y = 0.01;
      headGroup.add(cap);
    }
    // 耳朵
    [[-1], [1]].forEach(([sd]) => {
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.032, 8, 8), skinMat);
      ear.scale.set(0.5, 1, 0.7);
      ear.position.set(sd * 0.145, 0.0, -0.01);
      headGroup.add(ear);
    });

    // —— 双臂（IK 驱动） ——
    const ARM = { upper: 0.30, fore: 0.29, gloveR: 0.105 };
    const arms = {};
    [[1, 'L'], [-1, 'R']].forEach(([sd, key]) => {
      const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.105, 12, 10), skinMat);
      shoulder.position.set(sd * 0.285, 0.6, 0);
      body.add(shoulder);
      const upper = limbMesh(0.072, skinMat);
      const fore = limbMesh(0.06, skinMat);
      const elbowBall = new THREE.Mesh(new THREE.SphereGeometry(0.062, 8, 8), skinMat);
      const glove = new THREE.Mesh(new THREE.SphereGeometry(ARM.gloveR, 14, 12), gloveMat);
      glove.scale.set(1.05, 0.95, 1.18);
      const wrist = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), skinMat);
      body.add(upper); body.add(fore); body.add(elbowBall); body.add(glove); body.add(wrist);
      arms[key] = { sd, shoulderPos: new THREE.Vector3(sd * 0.285, 0.6, 0), upper, fore, elbowBall, glove, wrist, target: new THREE.Vector3(sd * 0.2, 0.45, 0.3) };
    });

    // —— 地面阴影（假阴影圆盘） ——
    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.42, 20),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32, depthWrite: false })
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.012;
    root.add(shadow);

    // 手部临时向量
    const elbow = new THREE.Vector3(), wristP = new THREE.Vector3(), gloveP = new THREE.Vector3();
    const pole = new THREE.Vector3();

    // ---------- 帧姿态求解 ----------
    // 手部目标点（body 局部空间）：防守 (±0.2, 0.45, 0.30) → 打击 (±0.12, 0.42, 1.5)
    function handTarget(key, ei, ep) {
      const sd = arms[key].sd;
      // 判定当前动作段
      let attacking = 0, prog = 0;
      if (ep === 1 && ei >= 20 && ei <= 31 && key === (sd > 0 ? 'L' : 'R')) { attacking = 1; prog = ei - 20; }
      if (ep === 2 && ei >= 32 && ei <= 46 && key === (sd > 0 ? 'R' : 'L')) { attacking = 2; prog = ei - 32; }

      if (attacking === 1) {
        // 左刺拳：20-23 后摆，24-25 全伸（接触25），26-31 收回
        let ext;
        if (prog <= 3) ext = prog / 5;
        else if (prog <= 5) ext = 1;
        else ext = Math.max(0, 1 - (prog - 5) / 6);
        return [sd * (0.2 - 0.08 * ext), 0.46 - 0.02 * ext, 0.3 + 1.18 * ext];
      }
      if (attacking === 2) {
        // 右勾拳：32-38 侧向蓄力下沉，39-40 横扫至前（接触40），41-46 收回
        let phase;
        if (prog <= 6) phase = prog / 6;                    // 0..1 蓄力
        else if (prog <= 8) phase = 1 + (prog - 6) / 2;     // 1..2 扫出
        else phase = Math.max(1, 2 - (prog - 8) / 7);       // 收回
        if (phase <= 1) {
          const w = phase;
          return [sd * (0.2 + 0.5 * w), 0.4 - 0.08 * w, 0.3 - 0.06 * w];
        }
        const w = phase - 1;                                 // 0..1..(回收)
        const wx = sd * (0.7 - 0.82 * Math.min(1, w));
        return [wx, 0.32 + 0.12 * Math.min(1, w), 0.24 + 1.2 * Math.min(1, w)];
      }
      // 默认：待机护头（呼吸起伏）
      const br = Math.sin(ei * 0.42) * 0.02;
      return [sd * 0.2, 0.45 + br, 0.3];
    }

    // ---------- 每帧应用 ----------
    // opts: { ep, egd, down(0/1), downY(px), hitT(0-1 受击红闪), lean }
    function apply(ei, opts) {
      opts = opts || {};
      const ep = opts.ep || 0;

      // —— 身体基础姿态 ——
      let bodyY = 0.95, pitch = 0, roll = 0, headPitch = 0, headYaw = 0;

      if (opts.down) {
        // 倒地：downY(0..160) → 侧倒（绕 z 轴 roll），髋部沉降、身体贴地，头微垂
        const p = Math.min(1, (opts.downY || 0) / 110);
        roll = p * 1.22;
        pitch = p * 0.22;
        bodyY = 0.95 - p * 0.60;
        headPitch = p * 0.35;
        headYaw = -p * 0.3;
        // 倒地时双臂摊向地面
        arms.L.target.set(0.5, -0.4, 0.28);
        arms.R.target.set(-0.38, -0.55, 0.3);
      } else if (ei >= 66) {
        // 帧语义 66-69（前倾倒地过程）
        const p = (ei - 66) / 3;
        pitch = -p * 0.7;
        bodyY = 0.95 - p * 0.25;
      } else {
        // 待机呼吸
        const br = Math.sin(ei * 0.42);
        bodyY += br * 0.012;
        headPitch = br * 0.05;
        // 受击：后仰 + 低头
        if (ei >= 56 && ei <= 60) {
          const h = 1 - Math.abs(ei - 58) / 2.5;
          pitch = h * 0.22; headPitch = -h * 0.45; roll = h * 0.08;
        }
        // 踉跄 61-65：左右摇摆
        if (ei >= 61 && ei <= 65) {
          roll = Math.sin(ei * 2.4) * 0.16;
          headYaw = Math.sin(ei * 1.8) * 0.3;
        }
        // 攻击前倾
        if ((ep === 1 && ei >= 20 && ei <= 31) || (ep === 2 && ei >= 32 && ei <= 46)) {
          const contact = ep === 1 ? 25 : 40;
          const h = Math.max(0, 1 - Math.abs(ei - contact) / 6);
          pitch = h * 0.14;
          headPitch = h * 0.1;
        }
        // 格挡 47-55：微蹲双臂收紧
        if (ei >= 47 && ei <= 55) {
          bodyY -= 0.03;
        }
      }

      body.position.y = bodyY;
      body.rotation.x = pitch;
      body.rotation.z = roll;
      headGroup.rotation.x = headPitch;
      headGroup.rotation.y = headYaw;

      // —— 受击红闪（面材质自发光） ——
      const hit = opts.hitT || 0;
      faceMat.emissive.setRGB(hit * 0.45, 0, 0);

      // —— 双臂 IK ——
      [[arms.L, 1], [arms.R, -1]].forEach(([arm]) => {
        if (!opts.down) {
          const t = handTarget(arm.sd > 0 ? 'L' : 'R', ei, ep);
          arm.target.set(t[0], t[1], t[2]);
        }
        const S = arm.shoulderPos;
        // 格挡帧：双拳抬到脸前
        if (!opts.down && opts.egd && ei >= 47 && ei <= 55) {
          arm.target.set(arm.sd * 0.13, 0.62, 0.34);
        }
        solveElbow(S, arm.target, 0.30, 0.29, pole.set(arm.sd * 0.9, -0.5, 0.2), elbow);
        placeLimb(arm.upper, S, elbow);
        // 腕 = 肘→目标方向的前臂末端
        _v1.subVectors(arm.target, elbow);
        const fl = _v1.length();
        _v2.copy(_v1).normalize();
        wristP.copy(elbow).addScaledVector(_v2, Math.min(fl, 0.29));
        placeLimb(arm.fore, elbow, wristP);
        arm.elbowBall.position.copy(elbow);
        arm.wrist.position.copy(wristP);
        // 拳套沿前臂方向再前伸一点
        arm.glove.position.copy(wristP).addScaledVector(_v2, 0.07);
        // 拳套朝向（打击时拳峰朝前）
        arm.glove.quaternion.setFromUnitVectors(_v3.set(0, 0, 1), _v2);
      });

      // —— 水平位置由 match 设置 root.position.x ——
    }

    return { root, apply, body, headGroup, arms };
  }

  return { build, solveElbow };
})();
