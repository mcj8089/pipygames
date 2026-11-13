// ============================================================================
// 主循环：Three.js 场景搭建 + 30fps 逻辑帧累加器 + 60fps 渲染插值。
// match.js 的状态每 tick 应用到 3D 对手 / 第一人称手臂 / 相机 / 特效 / 音频。
// 模块间不互相 import，统一挂 window.G 命名空间（兼容 build_web.py 单文件构建）。
// ============================================================================
import * as THREE from 'three';

G.Game = G.Game || {};

(function () {
  const match = G.Game.match;
  let renderer, scene, camera, env, boxerObj, armsObj;
  let acc = 0, last = 0, camYaw = 0, running = false;
  const STEP = 1000 / 30;

  // ---------- 场景初始化 ----------
  function buildScene() {
    const cfg = G.config.game;
    const holder = document.getElementById('game-canvas');
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    holder.appendChild(renderer.domElement);

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050508);
    scene.fog = new THREE.Fog(0x050508, 18, 55);

    camera = new THREE.PerspectiveCamera(cfg.fov, window.innerWidth / window.innerHeight, 0.05, 60);
    camera.position.set(0, cfg.cameraHeight, 0);
    scene.add(camera);

    env = G.Art.env.build(scene);
    boxerObj = G.Art.boxer.build(G.config.opponents[0].visual);
    boxerObj.root.position.z = -cfg.enemyDistance;
    scene.add(boxerObj.root);
    armsObj = G.Art.arms.build(camera);
    G.Art.fx.init(scene, camera);

    window.addEventListener('resize', onResize);
    // 调试钩子（QA 工具用，不影响游戏）
    G.Game._dbg = () => ({ scene, camera, renderer });
  }

  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    if (G.UI && G.UI.onResize) G.UI.onResize();
  }

  // ---------- 音频/特效事件接线（原作机制 → 原创 sound） ----------
  function wireEvents() {
    const A = G.Core.audio, FX = G.Art.fx, cfg = G.config.game;

    function enemyHead() {
      const r = boxerObj.root.position;
      return new THREE.Vector3(r.x, 1.9, r.z);
    }

    match.on('onPunch', mp => { A.play('whoosh', 0.5, mp >= 6 ? 0.85 : 1.1); });
    match.on('onHit', (u, isHook) => {
      A.play(isHook ? 'hook_hit' : 'jab_hit', 0.95);
      FX.burst('hit', enemyHead(), new THREE.Vector3(0, 0.25, 1));
      FX.sweat(enemyHead().add(new THREE.Vector3(0, 0.25, 0)), new THREE.Vector3(0, 0.4, 1));
    });
    match.on('onClash', () => {
      A.play('hook_hit', 0.7, 1.15);
      FX.burst('clash', enemyHead(), new THREE.Vector3(0, 0.2, 1));
      FX.burst('hit', new THREE.Vector3(0, 1.2, -0.9), new THREE.Vector3(0, 0.2, -1));
    });
    match.on('onPlayerHit', s => {
      A.play('hurt', 0.9, s === 40 ? 0.9 : 1);
      FX.burst('hit', new THREE.Vector3(0, 1.25, -0.7), new THREE.Vector3(0, 0.3, -1));
    });
    match.on('onBlock', () => { A.play('block', 0.8); FX.burst('block', new THREE.Vector3(0, 1.3, -0.7), new THREE.Vector3(0, 0.2, -1)); });
    match.on('onEnemyBlock', () => { A.play('block', 0.6, 1.2); FX.burst('block', enemyHead(), new THREE.Vector3(0, 0.2, 1)); });
    match.on('onStar', () => { A.play('star', 0.85); });
    match.on('onCharge', () => { A.play('charge', 0.55); });
    match.on('onTaunt', () => { A.play('taunt', 0.9); A.play('charge_full', 0.7); });
    match.on('onBell', () => { A.play('bell', 1); A.music('crowd', 0.5); A.music('fight_music', 0.42); });
    match.on('onPlayerDown', () => { A.play('down', 1); });
    match.on('onEnemyDown', () => { A.play('down', 1, 0.92); FX.burst('ko', enemyHead(), new THREE.Vector3(0, 0.5, 1)); });
    match.on('onCount', n => { if (n > 0) A.play('count', 0.9); });
    match.on('onPlayerUp', () => { A.play('getup', 0.9); G.Art.fx.flash(0.55); });
    match.on('onEnemyUp', () => { A.play('getup', 0.9, 1.06); G.Art.fx.flash(0.55); });
    match.on('onFightEnd', (win, score, timeout) => {
      A.stopMusic('fight_music', 1.2); A.stopMusic('crowd', 1.5);
      A.play('bell_end', 1);
      setTimeout(() => { A.play(win ? 'win' : 'lose', 1); if (win) A.play('cheer', 0.9); }, 500);
      if (win) G.Art.fx.flash(0.7);
      G.Core.storage.record(match.M.vsi, score);
      G.SDK.track('fight_end', { vsi: match.M.vsi, win: win, score: score, timeout: !!timeout });
      // 广告插屏判定（每 3 场，可配置）
      G.Core.ads.onFightEnd();
    });
  }

  // ---------- 每逻辑帧：把状态推给 3D（离散值，供插值起点） ----------
  function applyLogic() {
    const M = match.M;
    // 对手外观切换（战斗开始时）
    if (M.gs === 6 && M._spawnedVsi !== M.vsi) {
      M._spawnedVsi = M.vsi;
      if (boxerObj) {
        scene.remove(boxerObj.root);
        boxerObj.root.traverse(o => { if (o.geometry) o.geometry.dispose(); });
      }
      boxerObj = G.Art.boxer.build(G.config.opponents[M.vsi - 1].visual);
      boxerObj.root.position.z = -G.config.game.enemyDistance;
      scene.add(boxerObj.root);
    }
  }

  // ---------- 渲染（alpha 为插值系数） ----------
  function render3D(alpha) {
    const M = match.M, P = match.prev || match.M;
    const cfg = G.config.game;
    const L = (a, b) => a + (b - a) * alpha;   // 线性插值

    const miL = L(P.mi, M.mi), eiL = L(P.ei, M.ei), exL = L(P.ex, M.ex);
    const pdwyL = L(P.pdwy, M.pdwy), edwyL = L(P.edwy, M.edwy);
    const msxL = L(P.msx, M.msx), msyL = L(P.msy, M.msy);
    const esxL = L(P.esx, M.esx), esyL = L(P.esy, M.esy);
    const gdntyL = L(P.gdnty, M.gdnty);

    // —— 对手 ——
    if (boxerObj) {
      const r = boxerObj.root;
      r.position.x = (exL + esxL) * cfg.enemyXScale;
      r.position.y = -(Math.max(-20, esyL) * 0.0022 + edwyL * 0.0021);
      const down = M.edwn === 1 || M.edwn === 2 || M.edwn === 9;
      const hitT = M.esi > 0.1 ? Math.min(M.esi / 25, 1) * 0.6 : 0;
      boxerObj.apply(eiL, { ep: M.ep, egd: M.egd, down: down, downY: edwyL, hitT: hitT });
    }

    // —— 相机（原作镜头：偏航跟随 + 横移 bgb + 倒地下沉 + 抖动） ——
    const yawTarget = -exL * cfg.yawScale;
    const k = 0.03 + Math.abs(M.bgb) * 0.12;
    camYaw += (yawTarget - camYaw) * k;
    camera.rotation.order = 'YXZ';
    camera.rotation.y = camYaw;
    const dropK = Math.min(pdwyL / 161, 1);
    camera.position.y = cfg.cameraHeight - (cfg.cameraHeight - 0.5) * dropK + msyL * 0.004;
    camera.position.x = msxL * 0.004;
    camera.rotation.x = -0.085 + 0.5 * dropK;   // 轻微下俯：站立时可见身前台面
    camera.rotation.z = M.pdwn === 9 ? 0.35 * dropK : 0;

    // —— 第一人称双臂 ——
    armsObj.apply(miL, { taunt: M.gdntm > 0 });
    armsObj.group.position.y = gdntyL * 0.012;
    armsObj.group.position.x = msxL * 0.002;
    armsObj.group.position.z = msyL * 0.002;

    // —— 环境 / 特效 ——
    env.update(1 / 60);
    G.Art.fx.update(1 / 60);

    renderer.render(scene, camera);
  }

  // ---------- 游戏主循环 ----------
  function loop(t) {
    if (!running) return;
    requestAnimationFrame(loop);
    if (!last) last = t;
    let dt = t - last; last = t;
    if (dt > 250) dt = 250;
    acc += dt;
    let stepped = false;
    while (acc >= STEP) {
      match.snapshot();     // 当前状态存为插值起点
      match.tick();         // 30fps 逻辑帧（1:1 原作）
      applyLogic();
      acc -= STEP;
      stepped = true;
    }
    if (stepped || true) {
      const alpha = Math.min(1, acc / STEP);
      render3D(alpha);
      if (G.UI && G.UI.drawHUD) G.UI.drawHUD(match.M, alpha);
    }
  }

  // ---------- 启动 ----------
  function boot() {
    // 移除静态兜底加载层（动画开屏由 G.UI 接管）
    const bl = document.getElementById('boot-loading');
    if (bl) bl.remove();

    // 域名锁：非白名单域名 3 秒后跳转 pipygames.com
    if (G.Core.domainLock.check(u => { if (G.UI) G.UI.showRedirect(u); })) return;

    G.SDK.init();
    G.Core.storage.load();

    buildScene();
    match.init();
    wireEvents();
    G.Game.input.init(match);
    // 分享卡片截图：同步重绘一帧后拷贝 WebGL 画布（须在同一任务内 drawImage）
    G.Game.snapshotInto = function (targetCanvas) {
      render3D(0);
      try {
        targetCanvas.getContext('2d').drawImage(renderer.domElement, 0, 0, targetCanvas.width, targetCanvas.height);
      } catch (e) { /* 忽略截图失败 */ }
    };
    G.UI.init();
    running = true;
    requestAnimationFrame(loop);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
