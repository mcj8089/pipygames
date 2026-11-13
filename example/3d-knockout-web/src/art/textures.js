// ============================================================================
// 程序化贴图工厂：所有贴图由 Canvas 实时绘制生成（无外部图片依赖）。
// 皮肤 / 面部 / 拳裤花纹 / 拳台帆布地板 / 围绳裙板 / 观众剪影 / 粒子精灵 等。
// 质量要求：细节丰富、光影层次完整，禁止极简色块。
// ============================================================================
import * as THREE from 'three';

G.Art = G.Art || {};

G.Art.textures = (function () {

  function canvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }

  function tex(c, repeat) {
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
    t.anisotropy = 4;
    return t;
  }

  function hexToRgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function shade(hex, f) {
    const [r, g, b] = hexToRgb(hex);
    const c = v => Math.max(0, Math.min(255, Math.round(v * f)));
    return 'rgb(' + c(r) + ',' + c(g) + ',' + c(b) + ')';
  }

  // ---------- 皮肤（含毛孔噪点与暗部过渡，供躯干 Lathe 使用） ----------
  function skin(base, opts) {
    opts = opts || {};
    const c = canvas(256, 256), x = c.getContext('2d');
    x.fillStyle = base; x.fillRect(0, 0, 256, 256);
    // 柔和噪点（皮肤质感）
    const img = x.getImageData(0, 0, 256, 256);
    for (let i = 0; i < img.data.length; i += 4) {
      const n = (Math.random() - 0.5) * 14;
      img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n;
    }
    x.putImageData(img, 0, 0);
    // 腹肌阴影（画在中央纵向列，对应 Lathe u=0 正前方）
    if (opts.abs !== false) {
      x.save();
      x.globalAlpha = 0.16;
      x.fillStyle = shade(base, 0.55);
      x.fillRect(124, 120, 4, 120);           // 腹白线
      for (let r = 0; r < 3; r++) {           // 三排腹肌分块
        x.fillRect(92, 130 + r * 40, 68, 4);
        x.fillRect(104, 130 + r * 40, 4, 40);
        x.fillRect(148, 130 + r * 40, 4, 40);
      }
      x.restore();
    }
    // 胸口汗珠高光
    x.save();
    x.globalAlpha = 0.22;
    for (let i = 0; i < 14; i++) {
      const px = 40 + Math.random() * 176, py = 40 + Math.random() * 150;
      const g = x.createRadialGradient(px, py, 0, px, py, 3);
      g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g; x.beginPath(); x.arc(px, py, 3, 0, 7); x.fill();
    }
    x.restore();
    return tex(c);
  }

  // ---------- 面部（画在球体 UV 正前方 u=0.25 → x=128/512） ----------
  function face(v) {
    const W = 512, H = 256;
    const c = canvas(W, H), x = c.getContext('2d');
    const cx = W * 0.25;   // 球体 +z 朝向对应 u=0.25
    // 底色皮肤
    x.fillStyle = v.skin; x.fillRect(0, 0, W, H);
    const img = x.getImageData(0, 0, W, H);
    for (let i = 0; i < img.data.length; i += 4) {
      const n = (Math.random() - 0.5) * 10;
      img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n;
    }
    x.putImageData(img, 0, 0);

    const eyeY = H * 0.40, eyeDx = 30, eyeR = 11;
    // 眼窝阴影
    x.save();
    x.globalAlpha = 0.25; x.fillStyle = shade(v.skin, 0.6);
    x.beginPath(); x.ellipse(cx - eyeDx, eyeY - 4, 20, 13, 0, 0, 7); x.fill();
    x.beginPath(); x.ellipse(cx + eyeDx, eyeY - 4, 20, 13, 0, 0, 7); x.fill();
    x.restore();
    // 眼白 + 虹膜 + 瞳孔 + 高光（愤怒紧盯）
    for (const s of [-1, 1]) {
      const ex = cx + s * eyeDx;
      x.fillStyle = '#f4efe6';
      x.beginPath(); x.ellipse(ex, eyeY, eyeR, eyeR * 0.72, 0, 0, 7); x.fill();
      x.strokeStyle = 'rgba(70,40,25,0.55)'; x.lineWidth = 1.4;
      x.beginPath(); x.ellipse(ex, eyeY, eyeR, eyeR * 0.72, 0, 0, 7); x.stroke();
      x.fillStyle = '#5d3a1e';
      x.beginPath(); x.arc(ex, eyeY + 1, 5.6, 0, 7); x.fill();
      x.fillStyle = '#120a05';
      x.beginPath(); x.arc(ex, eyeY + 1, 2.6, 0, 7); x.fill();
      x.fillStyle = 'rgba(255,255,255,0.85)';
      x.beginPath(); x.arc(ex - 2, eyeY - 2, 1.6, 0, 7); x.fill();
      // 怒眉（内压）
      x.strokeStyle = v.browColor || '#241408'; x.lineWidth = 5; x.lineCap = 'round';
      x.beginPath();
      x.moveTo(ex - s * 13, eyeY - 16);
      x.lineTo(ex + s * 10, eyeY - 9);
      x.stroke();
    }
    // 鼻影 + 鼻孔
    x.save(); x.globalAlpha = 0.3; x.fillStyle = shade(v.skin, 0.55);
    x.beginPath(); x.ellipse(cx, eyeY + 22, 7, 13, 0, 0, 7); x.fill();
    x.restore();
    x.fillStyle = 'rgba(40,18,8,0.75)';
    x.beginPath(); x.ellipse(cx - 5, eyeY + 30, 2.6, 1.8, 0.4, 0, 7); x.fill();
    x.beginPath(); x.ellipse(cx + 5, eyeY + 30, 2.6, 1.8, -0.4, 0, 7); x.fill();
    // 嘴（咬牙护齿）
    const my = eyeY + 52;
    x.fillStyle = shade(v.skin, 0.62);
    x.beginPath(); x.ellipse(cx, my, 20, 9, 0, 0, 7); x.fill();
    x.fillStyle = '#e8e3d8';
    x.beginPath(); x.ellipse(cx, my, 14, 4.5, 0, 0, 7); x.fill();
    x.strokeStyle = 'rgba(60,30,15,0.6)'; x.lineWidth = 1;
    for (let i = -2; i <= 2; i++) {
      x.beginPath(); x.moveTo(cx + i * 5.6, my - 4.5); x.lineTo(cx + i * 5.6, my + 4.5); x.stroke();
    }
    // 腮红/颧骨高光
    x.save(); x.globalAlpha = 0.18;
    x.fillStyle = '#d98a6a';
    x.beginPath(); x.ellipse(cx - 46, my - 14, 12, 7, 0, 0, 7); x.fill();
    x.beginPath(); x.ellipse(cx + 46, my - 14, 12, 7, 0, 0, 7); x.fill();
    x.restore();
    // 胡须
    if (v.beard === 'full' || v.beard === 'goatee' || v.beard === 'stubble') {
      x.save();
      x.globalAlpha = v.beard === 'stubble' ? 0.35 : 0.85;
      x.fillStyle = v.hairColor;
      if (v.beard === 'goatee') {
        x.beginPath(); x.ellipse(cx, my + 18, 16, 16, 0, 0, 7); x.fill();
      } else {
        // 下颌一圈
        x.beginPath();
        x.ellipse(cx, my + 22, 52, 30, 0, 0, Math.PI);
        x.fill();
        x.fillRect(cx - 52, my - 2, 104, 22);
        if (v.beard === 'full') {  // 络腮连接鬓角
          x.fillRect(cx - 70, eyeY - 8, 16, 70);
          x.fillRect(cx + 54, eyeY - 8, 16, 70);
        }
      }
      x.restore();
    }
    // 额头晒痕/伤痕细节（每名对手轻微差异）
    x.save(); x.globalAlpha = 0.25;
    x.strokeStyle = shade(v.skin, 0.7); x.lineWidth = 2;
    x.beginPath(); x.moveTo(cx - 60, eyeY - 34); x.lineTo(cx - 20, eyeY - 40); x.stroke();
    x.restore();
    return tex(c);
  }

  // ---------- 拳裤花纹 ----------
  function trunk(v) {
    const c = canvas(256, 256), x = c.getContext('2d');
    x.fillStyle = v.trunk; x.fillRect(0, 0, 256, 256);
    if (v.id === 'vito') {
      // 城市迷彩
      const cols = [v.trunk, shade(v.trunk, 1.3), shade(v.trunk, 0.72), shade(v.trunk, 0.5)];
      for (let i = 0; i < 60; i++) {
        x.fillStyle = cols[i % 4];
        const px = Math.random() * 256, py = Math.random() * 256;
        x.beginPath();
        x.moveTo(px, py);
        for (let k = 0; k < 5; k++) x.lineTo(px + (Math.random() - 0.5) * 60, py + (Math.random() - 0.5) * 40);
        x.closePath(); x.fill();
      }
    } else if (v.id === 'sarge') {
      // 斜纹双条
      x.strokeStyle = v.trunkTrim; x.lineWidth = 14;
      for (let i = -4; i < 10; i++) {
        x.beginPath(); x.moveTo(i * 48, 260); x.lineTo(i * 48 + 120, -10); x.stroke();
      }
    } else if (v.id === 'eltoro') {
      // 侧向火焰纹
      for (let side of [0, 1]) {
        x.save();
        if (side) { x.translate(256, 0); x.scale(-1, 1); }
        const g = x.createLinearGradient(0, 0, 90, 0);
        g.addColorStop(0, v.trunkTrim); g.addColorStop(1, 'rgba(0,0,0,0)');
        x.fillStyle = g;
        x.beginPath();
        x.moveTo(0, 0);
        for (let yy = 0; yy <= 256; yy += 16) {
          x.lineTo(30 + Math.sin(yy * 0.09 + side) * 22, yy);
        }
        x.lineTo(0, 256); x.closePath(); x.fill();
        x.restore();
      }
    } else {
      // 杜克：金边条纹
      x.fillStyle = v.trunkTrim;
      x.fillRect(0, 0, 26, 256); x.fillRect(230, 0, 26, 256);
      x.globalAlpha = 0.35;
      x.fillRect(36, 0, 6, 256); x.fillRect(214, 0, 6, 256);
    }
    // 布纹噪点
    const img = x.getImageData(0, 0, 256, 256);
    for (let i = 0; i < img.data.length; i += 4) {
      const n = (Math.random() - 0.5) * 12;
      img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n;
    }
    x.putImageData(img, 0, 0);
    return tex(c, true);
  }

  // ---------- 拳台帆布地板 ----------
  function ringFloor() {
    const S = 1024;
    const c = canvas(S, S), x = c.getContext('2d');
    // 旧帆布底色
    const g = x.createRadialGradient(S / 2, S / 2, 100, S / 2, S / 2, S * 0.72);
    g.addColorStop(0, '#d8cfc0'); g.addColorStop(0.7, '#c2b7a4'); g.addColorStop(1, '#948a78');
    x.fillStyle = g; x.fillRect(0, 0, S, S);
    // 磨损噪点
    const img = x.getImageData(0, 0, S, S);
    for (let i = 0; i < img.data.length; i += 4) {
      const n = (Math.random() - 0.5) * 18;
      img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n;
    }
    x.putImageData(img, 0, 0);
    // 鞋印磨痕
    x.save();
    x.globalAlpha = 0.08;
    for (let i = 0; i < 70; i++) {
      x.save();
      x.translate(Math.random() * S, Math.random() * S);
      x.rotate(Math.random() * Math.PI);
      x.fillStyle = '#5a5148';
      x.beginPath(); x.ellipse(0, 0, 12 + Math.random() * 20, 6 + Math.random() * 8, 0, 0, 7); x.fill();
      x.restore();
    }
    x.restore();
    // 中央擂台标（金环 + 拳套徽记文字环）
    x.save();
    x.translate(S / 2, S / 2);
    x.strokeStyle = '#8f1d24'; x.lineWidth = 16;
    x.beginPath(); x.arc(0, 0, 190, 0, 7); x.stroke();
    x.strokeStyle = '#f2c94c'; x.lineWidth = 6;
    x.beginPath(); x.arc(0, 0, 172, 0, 7); x.stroke();
    x.fillStyle = '#8f1d24';
    x.font = '900 92px "Arial Black", sans-serif';
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText('K.O.', 0, -8);
    x.font = '700 30px "Arial", sans-serif';
    x.fillText('ARENA', 0, 58);
    x.restore();
    // 边线
    x.strokeStyle = 'rgba(90,30,25,0.5)'; x.lineWidth = 10;
    x.strokeRect(28, 28, S - 56, S - 56);
    return tex(c);
  }

  // ---------- 围裙裙板 ----------
  function apron() {
    const c = canvas(1024, 128), x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 0, 128);
    g.addColorStop(0, '#3d0a10'); g.addColorStop(0.5, '#6b1420'); g.addColorStop(1, '#2a060b');
    x.fillStyle = g; x.fillRect(0, 0, 1024, 128);
    x.font = '900 44px "Arial Black", sans-serif';
    x.textBaseline = 'middle';
    for (let i = 0; i < 4; i++) {
      const cx = 128 + i * 256;
      x.fillStyle = '#f2c94c';
      x.fillText('KNOCKOUT ARENA', cx - 110, 52);
      x.fillStyle = '#e8e2d4';
      x.font = '700 22px "Arial", sans-serif';
      x.fillText('pipygames.com', cx - 60, 92);
      x.font = '900 44px "Arial Black", sans-serif';
    }
    const img = x.getImageData(0, 0, 1024, 128);
    for (let i = 0; i < img.data.length; i += 4) {
      const n = (Math.random() - 0.5) * 10;
      img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n;
    }
    x.putImageData(img, 0, 0);
    return tex(c, true);
  }

  // ---------- 观众剪影（多种换色） ----------
  function crowd(shirt, skinTone) {
    const W = 64, H = 96;
    const c = canvas(W, H), x = c.getContext('2d');
    x.clearRect(0, 0, W, H);
    // 头
    x.fillStyle = skinTone;
    x.beginPath(); x.arc(W / 2, 22, 11, 0, 7); x.fill();
    // 肩身
    x.fillStyle = shirt;
    x.beginPath();
    x.moveTo(W / 2 - 20, H);
    x.quadraticCurveTo(W / 2 - 22, 44, W / 2 - 8, 36);
    x.quadraticCurveTo(W / 2, 32, W / 2 + 8, 36);
    x.quadraticCurveTo(W / 2 + 22, 44, W / 2 + 20, H);
    x.closePath(); x.fill();
    // 颈
    x.fillRect(W / 2 - 4, 30, 8, 8);
    return tex(c);
  }

  // ---------- 粒子精灵 ----------
  function spark() {
    const S = 64, c = canvas(S, S), x = c.getContext('2d');
    const g = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(255,240,190,0.9)');
    g.addColorStop(1, 'rgba(255,200,80,0)');
    x.fillStyle = g; x.fillRect(0, 0, S, S);
    return tex(c);
  }

  function glow() {
    const S = 128, c = canvas(S, S), x = c.getContext('2d');
    const g = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    g.addColorStop(0, 'rgba(255,255,255,0.9)');
    g.addColorStop(0.4, 'rgba(255,255,255,0.25)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, S, S);
    return tex(c);
  }

  function star() {
    const S = 128, c = canvas(S, S), x = c.getContext('2d');
    x.translate(S / 2, S / 2);
    // 外发光
    const g = x.createRadialGradient(0, 0, 4, 0, 0, S / 2);
    g.addColorStop(0, 'rgba(255,240,160,0.95)');
    g.addColorStop(0.5, 'rgba(255,200,60,0.35)');
    g.addColorStop(1, 'rgba(255,180,40,0)');
    x.fillStyle = g; x.beginPath(); x.arc(0, 0, S / 2, 0, 7); x.fill();
    // 五角星
    x.fillStyle = '#ffd75e';
    x.strokeStyle = '#fff3c0'; x.lineWidth = 3;
    x.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? 34 : 14;
      const a = -Math.PI / 2 + i * Math.PI / 5;
      const px = Math.cos(a) * r, py = Math.sin(a) * r;
      i === 0 ? x.moveTo(px, py) : x.lineTo(px, py);
    }
    x.closePath(); x.fill(); x.stroke();
    // 高光
    const g2 = x.createLinearGradient(-30, -30, 20, 20);
    g2.addColorStop(0, 'rgba(255,255,255,0.5)'); g2.addColorStop(0.5, 'rgba(255,255,255,0)');
    x.fillStyle = g2; x.beginPath(); x.arc(0, 0, 34, 0, 7); x.fill();
    return tex(c);
  }

  // ---------- 选人卡片半身肖像（程序化绘制，非几何占位） ----------
  function portrait(v) {
    const W = 512, H = 640, cx = W / 2;
    const c = canvas(W, H), x = c.getContext('2d');
    // 背景：主题色暗调放射渐变 + 顶部聚光 + 斜向光带
    const bg = x.createRadialGradient(cx, 210, 40, cx, 300, 460);
    bg.addColorStop(0, shade(v.trunk, 0.85));
    bg.addColorStop(0.55, shade(v.trunk, 0.4));
    bg.addColorStop(1, '#0d0906');
    x.fillStyle = bg; x.fillRect(0, 0, W, H);
    const spot = x.createRadialGradient(cx, 90, 10, cx, 90, 300);
    spot.addColorStop(0, 'rgba(255,240,200,0.35)');
    spot.addColorStop(1, 'rgba(255,240,200,0)');
    x.fillStyle = spot; x.fillRect(0, 0, W, 380);
    x.save(); x.globalAlpha = 0.1;
    for (let i = -2; i <= 2; i++) {
      x.fillStyle = '#fff';
      x.save(); x.translate(cx + i * 90, 0); x.rotate(0.16);
      x.fillRect(-14, -40, 28, 520); x.restore();
    }
    x.restore();
    // 底部暗角
    const vg = x.createLinearGradient(0, H - 220, 0, H);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.75)');
    x.fillStyle = vg; x.fillRect(0, H - 220, W, 220);

    // —— 躯干（肩胸） ——
    const shY = 356;                       // 肩线
    const tg = x.createLinearGradient(0, shY - 20, 0, H);
    tg.addColorStop(0, shade(v.skin, 1.06));
    tg.addColorStop(0.6, v.skin);
    tg.addColorStop(1, shade(v.skin, 0.62));
    x.fillStyle = tg;
    x.beginPath();
    x.moveTo(cx - 176, H);
    x.bezierCurveTo(cx - 180, shY + 40, cx - 138, shY - 6, cx - 64, shY - 16);
    x.quadraticCurveTo(cx, shY - 30, cx + 64, shY - 16);
    x.bezierCurveTo(cx + 138, shY - 6, cx + 180, shY + 40, cx + 176, H);
    x.closePath(); x.fill();
    // 锁骨与胸肌阴影
    x.save(); x.globalAlpha = 0.22; x.fillStyle = shade(v.skin, 0.5);
    x.beginPath(); x.ellipse(cx - 52, shY + 42, 46, 20, -0.12, 0, 7); x.fill();
    x.beginPath(); x.ellipse(cx + 52, shY + 42, 46, 20, 0.12, 0, 7); x.fill();
    x.fillRect(cx - 3, shY + 30, 6, 70);   // 胸沟
    x.restore();
    // 汗珠高光
    for (let i = 0; i < 10; i++) {
      const px = cx + (Math.random() - 0.5) * 250, py = shY + Math.random() * 120;
      const g = x.createRadialGradient(px, py, 0, px, py, 4);
      g.addColorStop(0, 'rgba(255,255,255,0.8)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g; x.beginPath(); x.arc(px, py, 4, 0, 7); x.fill();
    }

    // —— 头部 ——
    const hy = 226;                        // 头中心
    function headDraw() {
      // 脖子
      x.fillStyle = shade(v.skin, 0.88);
      x.fillRect(cx - 34, hy + 62, 68, 84);
      // 脸型
      const fg = x.createRadialGradient(cx - 20, hy - 30, 20, cx, hy, 130);
      fg.addColorStop(0, shade(v.skin, 1.12));
      fg.addColorStop(0.7, v.skin);
      fg.addColorStop(1, shade(v.skin, 0.78));
      x.fillStyle = fg;
      x.beginPath(); x.ellipse(cx, hy, 92, 108, 0, 0, 7); x.fill();
      // 耳
      x.fillStyle = shade(v.skin, 0.9);
      x.beginPath(); x.ellipse(cx - 94, hy + 14, 16, 26, 0, 0, 7); x.fill();
      x.beginPath(); x.ellipse(cx + 94, hy + 14, 16, 26, 0, 0, 7); x.fill();
      // 怒眉 + 眼
      const eyeY = hy - 12, eyeDx = 38;
      for (const s of [-1, 1]) {
        const ex = cx + s * eyeDx;
        x.fillStyle = '#f4efe6';
        x.beginPath(); x.ellipse(ex, eyeY, 17, 12, 0, 0, 7); x.fill();
        x.strokeStyle = 'rgba(70,40,25,0.55)'; x.lineWidth = 2;
        x.beginPath(); x.ellipse(ex, eyeY, 17, 12, 0, 0, 7); x.stroke();
        x.fillStyle = '#4d2f16';
        x.beginPath(); x.arc(ex + s * 2, eyeY + 1, 7.5, 0, 7); x.fill();
        x.fillStyle = '#100a05';
        x.beginPath(); x.arc(ex + s * 2, eyeY + 1, 3.4, 0, 7); x.fill();
        x.fillStyle = 'rgba(255,255,255,0.9)';
        x.beginPath(); x.arc(ex - s * 3, eyeY - 3, 2.2, 0, 7); x.fill();
        // 怒眉
        x.strokeStyle = v.hairColor; x.lineWidth = 9; x.lineCap = 'round';
        x.beginPath();
        x.moveTo(ex - s * 22, eyeY - 26);
        x.lineTo(ex + s * 16, eyeY - 15);
        x.stroke();
      }
      // 鼻
      x.save(); x.globalAlpha = 0.28; x.fillStyle = shade(v.skin, 0.55);
      x.beginPath(); x.ellipse(cx, eyeY + 30, 10, 18, 0, 0, 7); x.fill();
      x.restore();
      x.fillStyle = 'rgba(40,18,8,0.75)';
      x.beginPath(); x.ellipse(cx - 7, eyeY + 42, 3.4, 2.4, 0.4, 0, 7); x.fill();
      x.beginPath(); x.ellipse(cx + 7, eyeY + 42, 3.4, 2.4, -0.4, 0, 7); x.fill();
      // 咬牙的嘴 + 护齿
      const my = eyeY + 68;
      x.fillStyle = shade(v.skin, 0.6);
      x.beginPath(); x.ellipse(cx, my, 27, 13, 0, 0, 7); x.fill();
      x.fillStyle = '#ece7da';
      x.beginPath(); x.ellipse(cx, my, 19, 6.5, 0, 0, 7); x.fill();
      x.strokeStyle = 'rgba(60,30,15,0.6)'; x.lineWidth = 1.4;
      for (let i = -2; i <= 2; i++) {
        x.beginPath(); x.moveTo(cx + i * 7.5, my - 6.5); x.lineTo(cx + i * 7.5, my + 6.5); x.stroke();
      }
      // 胡子
      x.save();
      x.globalAlpha = v.beard === 'stubble' ? 0.38 : 0.88;
      x.fillStyle = v.hairColor;
      if (v.beard === 'goatee') {
        x.beginPath(); x.ellipse(cx, my + 24, 22, 22, 0, 0, 7); x.fill();
      } else {
        x.beginPath(); x.ellipse(cx, my + 26, 68, 38, 0, 0, Math.PI); x.fill();
        x.fillRect(cx - 68, my - 4, 136, 26);
        if (v.beard === 'full') {
          x.fillRect(cx - 96, eyeY - 12, 20, 84);
          x.fillRect(cx + 76, eyeY - 12, 20, 84);
        }
      }
      x.restore();
      // 发型
      x.fillStyle = v.hairColor;
      if (v.hair === 'none') {
        // 光头：只加头皮高光
        const hg = x.createRadialGradient(cx - 26, hy - 60, 8, cx, hy - 40, 90);
        hg.addColorStop(0, 'rgba(255,255,255,0.22)'); hg.addColorStop(1, 'rgba(255,255,255,0)');
        x.fillStyle = hg; x.beginPath(); x.ellipse(cx, hy - 40, 86, 66, 0, 0, 7); x.fill();
      } else if (v.hair === 'buzz') {
        x.beginPath(); x.ellipse(cx, hy - 44, 90, 62, 0, Math.PI, 0); x.fill();
        x.fillRect(cx - 90, hy - 46, 180, 14);
        x.save(); x.globalAlpha = 0.25; x.fillStyle = '#fff';
        x.beginPath(); x.ellipse(cx - 28, hy - 62, 30, 14, -0.3, 0, 7); x.fill();
        x.restore();
      } else { // mohawk
        x.beginPath(); x.ellipse(cx, hy - 40, 88, 60, 0, Math.PI, 0); x.fill();
        x.save();
        x.beginPath();
        x.moveTo(cx - 22, hy - 62);
        for (let yy = hy - 66; yy >= hy - 150; yy -= 8) {
          x.lineTo(cx - 20 + Math.sin(yy * 0.16) * 5, yy);
        }
        for (let yy = hy - 150; yy <= hy - 66; yy += 8) {
          x.lineTo(cx + 20 + Math.sin(yy * 0.16) * 5, yy);
        }
        x.closePath();
        const mg = x.createLinearGradient(cx - 24, 0, cx + 24, 0);
        mg.addColorStop(0, shade(v.hairColor, 0.7)); mg.addColorStop(0.5, shade(v.hairColor, 1.25)); mg.addColorStop(1, shade(v.hairColor, 0.7));
        x.fillStyle = mg; x.fill();
        x.restore();
      }
    }
    headDraw();

    // —— 双拳套护在胸前 ——
    function glove(dx, dy, rot, sc) {
      x.save();
      x.translate(cx + dx, dy); x.rotate(rot); x.scale(sc, sc);
      // 腕口
      x.fillStyle = shade(v.glove, 0.55);
      x.beginPath(); x.ellipse(0, 62, 46, 26, 0, 0, 7); x.fill();
      x.fillStyle = shade(v.glove, 1.1);
      x.beginPath(); x.ellipse(0, 58, 40, 20, 0, 0, 7); x.fill();
      // 拳体（四指脊）
      const gg = x.createRadialGradient(-24, -30, 10, 0, 0, 84);
      gg.addColorStop(0, shade(v.glove, 1.35));
      gg.addColorStop(0.55, v.glove);
      gg.addColorStop(1, shade(v.glove, 0.5));
      x.fillStyle = gg;
      x.beginPath(); x.ellipse(0, 0, 72, 66, 0, 0, 7); x.fill();
      // 指缝
      x.strokeStyle = 'rgba(0,0,0,0.28)'; x.lineWidth = 4; x.lineCap = 'round';
      for (let i = -1; i <= 1; i++) {
        x.beginPath(); x.moveTo(i * 26, -46); x.quadraticCurveTo(i * 30 + 6, -14, i * 24, 18); x.stroke();
      }
      // 拇指
      x.fillStyle = shade(v.glove, 0.92);
      x.beginPath(); x.ellipse(-52, 6, 20, 30, -0.5, 0, 7); x.fill();
      // 高光
      const hl = x.createRadialGradient(-26, -36, 2, -26, -36, 40);
      hl.addColorStop(0, 'rgba(255,255,255,0.5)'); hl.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = hl; x.beginPath(); x.ellipse(-26, -36, 40, 30, 0, 0, 7); x.fill();
      x.restore();
    }
    glove(-98, 468, -0.3, 1.06);
    glove(98, 452, 0.28, 1.02);

    return c.toDataURL('image/png');
  }

  function gloveLeather(base) {
    const S = 256, c = canvas(S, S), x = c.getContext('2d');
    x.fillStyle = base; x.fillRect(0, 0, S, S);
    const img = x.getImageData(0, 0, S, S);
    for (let i = 0; i < img.data.length; i += 4) {
      const n = (Math.random() - 0.5) * 16;
      img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n;
    }
    x.putImageData(img, 0, 0);
    // 皮革褶皱
    x.strokeStyle = 'rgba(0,0,0,0.18)'; x.lineWidth = 2;
    for (let i = 0; i < 26; i++) {
      x.beginPath();
      const px = Math.random() * S, py = Math.random() * S;
      x.moveTo(px, py);
      x.quadraticCurveTo(px + (Math.random() - 0.5) * 50, py + (Math.random() - 0.5) * 30, px + (Math.random() - 0.5) * 70, py + (Math.random() - 0.5) * 50);
      x.stroke();
    }
    return tex(c);
  }

  function bootLeather(base) {
    const S = 128, c = canvas(S, S), x = c.getContext('2d');
    x.fillStyle = base; x.fillRect(0, 0, S, S);
    const img = x.getImageData(0, 0, S, S);
    for (let i = 0; i < img.data.length; i += 4) {
      const n = (Math.random() - 0.5) * 14;
      img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n;
    }
    x.putImageData(img, 0, 0);
    x.strokeStyle = 'rgba(255,255,255,0.35)'; x.lineWidth = 3;
    for (let r = 0; r < 5; r++) {
      x.beginPath(); x.moveTo(30, 24 + r * 16); x.lineTo(96, 24 + r * 16); x.stroke();
    }
    return tex(c);
  }

  return { skin, face, trunk, ringFloor, apron, crowd, spark, glow, star, gloveLeather, bootLeather, portrait, canvas, tex };
})();
