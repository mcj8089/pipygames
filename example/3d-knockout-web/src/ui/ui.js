// ============================================================================
// UI 核心：HUD（canvas 按原作 320x416 坐标等比映射）+ 全部界面面板。
// 界面状态完全由 match.M.gs 驱动（每帧 watchGs 检测迁移）：
//   -1加载 / 0标题 / 1选人 / 2VS过场 / 3战斗 / 4胜 / 5负 / 6黑场淡入 / 7结算
// HUD 元素坐标沿用原作 320x416 逻辑坐标，保证血条/星星/蓄力环/读秒手感一致。
// 面板 DOM 由本模块动态生成（配合 styles.css 的类名）。
// ============================================================================
window.G = window.G || {};

G.UI = (function () {

  const i18n = () => G.Core.i18n;
  const A = () => G.Core.audio;
  const t = (k, v) => G.Core.i18n.t(k, v);

  let hud, hctx;                 // HUD 2D 画布
  let root;                      // #ui-root
  let el = {};                   // 面板元素缓存
  let lastGs = -99;
  let loaded = false;            // 音频加载完成
  let bannerT = 0;               // "FIGHT!" 横幅剩余帧
  let vsTimer = null;
  let uiScore = 0;               // 结算分数快照

  const PLATFORMS = [
    ['facebook', '#1877f2'], ['x', '#14171a'], ['reddit', '#ff4500'],
    ['whatsapp', '#25d366'], ['telegram', '#229ed9'], ['linkedin', '#0a66c2'],
    ['youtube', '#ff0000'], ['tiktok', '#25f4ee'], ['instagram', '#e1306c']
  ];

  // 平台图标（内联 SVG path，24x24 视窗）
  const ICONS = {
    facebook: 'M13.5 22v-8h2.7l.4-3.2h-3.1V8.7c0-.9.3-1.6 1.7-1.6h1.6V4.2c-.3 0-1.3-.1-2.4-.1-2.4 0-4 1.4-4 4.1v2.6H7.6V14h2.8v8h3.1z',
    x: 'M17.8 3h3l-6.7 7.7L22 21h-6.2l-4.8-6.3L5.4 21h-3l7.2-8.2L2 3h6.4l4.4 5.8L17.8 3zm-1 16.2h1.7L7.4 4.7H5.6l11.2 14.5z',
    reddit: 'M22 12c0-1.2-1-2.2-2.2-2.2-.6 0-1.1.2-1.5.6-1.5-1-3.5-1.7-5.7-1.8l1-4.5 3.1.7c0 .9.7 1.6 1.6 1.6.9 0 1.7-.8 1.7-1.7S19.2 3 18.3 3c-.6 0-1.2.4-1.5.9l-3.5-.8c-.2 0-.4.1-.5.4l-1.1 5.1c-2.2.1-4.3.7-5.8 1.8-.4-.4-.9-.6-1.5-.6C3.2 9.8 2.2 10.8 2.2 12c0 .9.5 1.6 1.2 2-.1.3-.1.7-.1 1 0 3.3 3.7 5.9 8.3 5.9s8.3-2.6 8.3-5.9c0-.3 0-.7-.1-1 .7-.4 1.2-1.1 1.2-2zM8 13.6c0-.9.7-1.7 1.7-1.7s1.7.8 1.7 1.7-.7 1.7-1.7 1.7S8 14.5 8 13.6zm7.6 4.6c-1 1-2.9 1.1-3.6 1.1-.7 0-2.6-.1-3.6-1.1-.2-.2-.2-.4 0-.6.2-.2.4-.2.6 0 .6.6 1.9.9 3 .9s2.4-.3 3-.9c.2-.2.4-.2.6 0 .2.2.2.4 0 .6zm-.3-2.9c-.9 0-1.7-.8-1.7-1.7s.8-1.7 1.7-1.7 1.7.8 1.7 1.7-.8 1.7-1.7 1.7z',
    whatsapp: 'M12 2a10 10 0 0 0-8.6 15L2 22l5.2-1.4A10 10 0 1 0 12 2zm5.5 13.9c-.2.7-1.3 1.3-1.9 1.4-.5.1-1.1.1-1.8-.1-.4-.1-1-.3-1.7-.6-2.9-1.3-4.8-4.2-5-4.4-.1-.2-1.2-1.6-1.2-3s.7-2.1 1-2.4c.3-.3.6-.4.8-.4h.6c.2 0 .4 0 .6.5s.8 1.9.8 2c.1.1.1.3 0 .5-.3.7-.7 1-.5 1.4.7 1.2 1.6 2.1 2.8 2.7.3.2.5.1.7-.1l.9-1c.2-.3.4-.2.7-.1l2 1c.3.1.5.2.5.4 0 .1 0 .5-.3 1.2z',
    telegram: 'M21.9 4.6 18.8 19c-.2 1-.8 1.3-1.7.8l-4.6-3.4-2.2 2.1c-.2.3-.5.5-.9.5l.3-4.7L18 6.7c.4-.3-.1-.5-.6-.2L7.3 13l-4.5-1.4c-1-.3-1-1 .2-1.4l17.4-6.7c.8-.3 1.6.2 1.5 1.1z',
    linkedin: 'M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM3 9h4v12H3V9zm7 0h3.8v1.7h.1c.5-1 1.8-2 3.7-2 4 0 4.7 2.6 4.7 6V21h-4v-5.6c0-1.3 0-3.1-1.9-3.1s-2.2 1.5-2.2 3V21h-4V9z',
    youtube: 'M23 12s0-3.3-.4-4.8c-.2-.8-.9-1.5-1.7-1.7C19.4 5 12 5 12 5s-7.4 0-8.9.5c-.8.2-1.5.9-1.7 1.7C1 8.7 1 12 1 12s0 3.3.4 4.8c.2.8.9 1.5 1.7 1.7 1.5.5 8.9.5 8.9.5s7.4 0 8.9-.5c-.8-.2 1.5-.9 1.7-1.7.4-1.5.4-4.8.4-4.8zM9.8 15.5v-7l6.2 3.5-6.2 3.5z',
    tiktok: 'M16.7 2h-3.2v13.6c0 1.6-1.3 3-3 3s-3-1.4-3-3c0-1.6 1.3-3 3-3 .3 0 .7 0 .9.1V9.5c-.3 0-.6-.1-.9-.1-3.4 0-6.2 2.8-6.2 6.2S7.1 21.8 10.5 21.8s6.2-2.8 6.2-6.2V8.9c1.3.9 2.8 1.5 4.5 1.5V7.2c-2.5 0-4.5-2.3-4.5-5.2z',
    instagram: 'M12 4.3c2.5 0 2.8 0 3.8.1 2.5.1 3.7 1.3 3.8 3.8 0 1 .1 1.3.1 3.8s0 2.8-.1 3.8c-.1 2.5-1.3 3.7-3.8 3.8-1 0-1.3.1-3.8.1s-2.8 0-3.8-.1c-2.5-.1-3.7-1.3-3.8-3.8 0-1-.1-1.3-.1-3.8s0-2.8.1-3.8C4.5 5.7 5.7 4.5 8.2 4.4c1-.1 1.3-.1 3.8-.1zM12 2C9.4 2 9.1 2 8.1 2.1 4.7 2.2 2.8 4.1 2.7 7.5 2.6 8.5 2.6 8.8 2.6 12s0 3.5.1 4.5c.1 3.4 2 5.3 5.4 5.4 1 .1 1.3.1 4.5.1s3.5 0 4.5-.1c3.4-.1 5.3-2 5.4-5.4.1-1 .1-1.3.1-4.5s0-3.5-.1-4.5c-.1-3.4-2-5.3-5.4-5.4C15.5 2 15.2 2 12 2zm0 4.9a5.1 5.1 0 1 0 0 10.2 5.1 5.1 0 0 0 0-10.2zm0 8.4a3.3 3.3 0 1 1 0-6.6 3.3 3.3 0 0 1 0 6.6zm5.3-9.8a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4z'
  };

  // ---------------------------------------------------------------------------
  // DOM 构建
  // ---------------------------------------------------------------------------
  function h(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }

  function buildDOM() {
    root = document.getElementById('ui-root');
    if (!root) { root = h('div'); root.id = 'ui-root'; document.body.appendChild(root); }

    // HUD 画布（在最上层但 pointer-events:none，不挡输入）
    hud = h('canvas'); hud.id = 'hud';
    root.appendChild(hud);
    hctx = hud.getContext('2d');

    // —— 开屏加载 ——
    el.loading = h('div', 'scr scr-loading', `
      <div class="ld-spot"></div>
      <div class="ld-logo">pipygames<span>.com</span></div>
      <div class="ld-ring"><i></i><i></i><i></i></div>
      <div class="ld-tip">${t('loading.tip')}</div>
      <div class="ld-bar"><div class="ld-fill"></div></div>
      <div class="ld-pct">0%</div>`);
    root.appendChild(el.loading);

    // —— 标题 ——
    el.title = h('div', 'scr scr-title', `
      <div class="tt-glow"></div>
      <div class="tt-logo">${t('game.title')}</div>
      <div class="tt-sub">${t('game.subtitle')}</div>
      <div class="tt-tap">${t('title.tap')}</div>
      <div class="tt-copy">${t('title.copyright')}</div>`);
    el.title.style.display = 'none';
    root.appendChild(el.title);
    el.title.addEventListener('pointerdown', onTitleTap);

    // —— 选人 ——
    el.select = h('div', 'scr scr-select', `
      <div class="sel-head">${t('select.heading')}</div>
      <div class="sel-cards"></div>`);
    el.select.style.display = 'none';
    root.appendChild(el.select);

    // —— VS 过场 ——
    el.vs = h('div', 'scr scr-vs', `
      <div class="vs-wrap">
        <div class="vs-side vs-l"><span class="vs-name"></span><span class="vs-nick"></span></div>
        <div class="vs-badge">${t('vs.heading')}</div>
        <div class="vs-side vs-r"><span class="vs-name"></span><span class="vs-nick"></span></div>
      </div>
      <div class="vs-round">${t('vs.round')}</div>`);
    el.vs.style.display = 'none';
    root.appendChild(el.vs);

    // —— 结算 ——
    el.result = h('div', 'scr scr-result', `
      <div class="res-head"></div>
      <div class="res-sub"></div>
      <div class="res-score-lab">${t('result.score')}</div>
      <div class="res-score">0</div>
      <div class="res-row">
        <button class="res-btn res-half" data-act="select">${t('btn.select')}</button>
        <button class="res-btn res-half" data-act="rematch">${t('btn.retry')}</button>
      </div>
      <div class="res-row">
        <button class="res-btn res-full" data-act="share">${t('btn.share')}</button>
      </div>`);
    el.result.style.display = 'none';
    root.appendChild(el.result);
    el.result.addEventListener('pointerdown', ev => {
      const b = ev.target.closest('.res-btn');
      if (!b) return;
      A().play('click', 0.8);
      if (b.dataset.act === 'select') G.Game.match.resultToSelect();
      else if (b.dataset.act === 'rematch') G.Game.match.resultRematch();
      else if (b.dataset.act === 'share') openShare();
    });

    // —— 分享面板 ——
    el.share = h('div', 'modal share-modal', `
      <div class="share-panel">
        <div class="share-head">${t('share.heading')}</div>
        <div class="share-nick-lab">${t('share.nick')}</div>
        <input class="share-nick" maxlength="20" placeholder="${t('share.nickPh')}" />
        <div class="share-grid"></div>
        <div class="share-actions">
          <button class="share-btn" data-act="copy">${t('share.copy')}</button>
          <button class="share-btn" data-act="card">${t('share.card')}</button>
          <button class="share-btn share-close" data-act="close">✕</button>
        </div>
      </div>`);
    const grid = el.share.querySelector('.share-grid');
    for (const [id, color] of PLATFORMS) {
      const b = h('button', 'share-plat', `<span class="pl-ico" style="color:${color}"><svg viewBox="0 0 24 24" fill="currentColor"><path d="${ICONS[id]}"/></svg></span><span class="pl-name">${id}</span>`);
      b.dataset.plat = id;
      grid.appendChild(b);
    }
    const nickInput = el.share.querySelector('.share-nick');
    nickInput.value = G.Core.storage.getNick();
    nickInput.addEventListener('change', () => G.Core.storage.setNick(nickInput.value.trim()));
    el.share.addEventListener('pointerdown', ev => {
      const b = ev.target.closest('button');
      if (!b) return;
      const nick = (nickInput.value || '').trim();
      G.Core.storage.setNick(nick);
      const plat = b.dataset.plat;
      if (plat) { doShare(plat, nick); return; }
      A().play('click', 0.8);
      const act = b.dataset.act;
      if (act === 'close') closeShare();
      else if (act === 'copy') {
        G.Core.share.copyLink(nick, uiScore);
        toast(t('share.copy'));
      } else if (act === 'card') {
        downloadCard(nick);
      }
    });
    el.share.style.display = 'none';
    root.appendChild(el.share);

    // —— Toast ——
    el.toast = h('div', 'ui-toast', '');
    root.appendChild(el.toast);

    // —— 旋转提示（竖屏时显示，CSS 控制显隐） ——
    el.rotate = h('div', 'scr rotate-hint', `
      <div class="rot-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="7" y="3" width="10" height="18" rx="2"/><path d="M3 12h-1M22 12h-1" stroke-linecap="round"/><path d="M5 9c-1.2 1.8-1.2 4.2 0 6" stroke-linecap="round"/></svg></div>
      <div class="rot-msg">${t('rotate.msg')}</div>`);
    root.appendChild(el.rotate);

    // —— 域名锁跳转 ——
    el.redirect = h('div', 'scr scr-redirect', `
      <div class="rd-logo">pipygames.com</div>
      <div class="rd-msg"></div>
      <div class="rd-count">3</div>`);
    el.redirect.style.display = 'none';
    root.appendChild(el.redirect);
  }

  // ---------------------------------------------------------------------------
  // 加载流程：音频全部就绪（至少展示 0.9s 开屏动画）→ 标题
  // ---------------------------------------------------------------------------
  function startLoading() {
    const fill = el.loading.querySelector('.ld-fill');
    const pct = el.loading.querySelector('.ld-pct');
    const t0 = performance.now();
    const job = A().loadAll(p => {
      const v = Math.round(p * 100);
      fill.style.width = v + '%';
      pct.textContent = v + '%';
    });
    Promise.all([job, new Promise(r => setTimeout(r, 900))]).then(() => {
      loaded = true;
      el.loading.classList.add('ld-done');
      setTimeout(() => { el.loading.style.display = 'none'; }, 600);
    });
  }

  // 音频解锁（首次交互）+ 菜单音乐
  function bindUnlock() {
    const onFirst = () => {
      A().unlock();
      if (G.Game.match.M.gs === 0 || G.Game.match.M.gs === 1) A().music('menu_music', 0.5);
      document.removeEventListener('pointerdown', onFirst);
    };
    document.addEventListener('pointerdown', onFirst);
  }

  function onTitleTap() {
    if (!loaded) return;
    const M = G.Game.match.M;
    if (M.gs !== 0) return;
    A().play('click', 0.9);
    el.title.classList.add('tt-out');           // 淡出动画（CSS）
    setTimeout(() => { if (G.Game.match.M.gs === 0) G.Game.match.M.gs = 1; }, 380);
  }

  // ---------------------------------------------------------------------------
  // 选人面板
  // ---------------------------------------------------------------------------
  function buildCards() {
    const wrap = el.select.querySelector('.sel-cards');
    wrap.innerHTML = '';
    const opps = G.config.opponents;
    for (let i = 0; i < opps.length; i++) {
      const o = opps[i], v = o.visual, idx = i + 1;
      const card = h('button', 'card card-c' + idx, `
        <span class="card-top" style="background:linear-gradient(160deg,${v.trunk},${v.trunkTrim}22)"></span>
        <img class="card-glove" src="${G.Art.textures.portrait(v)}" alt="">
        <span class="card-name">${t(o.nameKey)}</span>
        <span class="card-nick">"${t(o.nickKey)}"</span>
        <span class="card-diff">${t('select.diff')} ${'★'.repeat(o.diff)}</span>
        <span class="card-best">${t('select.best')} <b>0</b></span>
        <span class="card-lock">${t('select.locked')}</span>
        <span class="card-clear">✓</span>`);
      card.dataset.idx = idx;
      wrap.appendChild(card);
    }
    wrap.addEventListener('pointerdown', ev => {
      const card = ev.target.closest('.card');
      if (!card || card.classList.contains('locked')) {
        A().play('click', 0.4, 0.7);
        if (card) { card.classList.remove('shake'); void card.offsetWidth; card.classList.add('shake'); }
        return;
      }
      A().play('select', 0.9);
      G.Game.match.selectOpponent(+card.dataset.idx);
    });
  }

  function refreshCards() {
    const M = G.Game.match.M;
    const cards = el.select.querySelectorAll('.card');
    cards.forEach((card, i) => {
      const idx = i + 1;
      const beaten = M.vspnt[idx] !== 0;
      let locked = false;
      if (idx < 4) locked = beaten;                       // 已击败不可重选（原作规则）
      else locked = !(M.vspnt[1] && M.vspnt[2] && M.vspnt[3]);  // 4 号需本场连过三人
      card.classList.toggle('locked', locked);
      card.classList.toggle('cleared', beaten);
      card.querySelector('.card-best b').textContent = G.Core.storage.best(idx);
    });
  }

  // ---------------------------------------------------------------------------
  // VS 过场
  // ---------------------------------------------------------------------------
  function showVS() {
    const M = G.Game.match.M;
    const o = G.config.opponents[M.vsi - 1];
    el.vs.querySelector('.vs-l .vs-name').textContent = 'YOU';
    el.vs.querySelector('.vs-l .vs-nick').textContent = t('game.subtitle');
    el.vs.querySelector('.vs-r .vs-name').textContent = t(o.nameKey);
    el.vs.querySelector('.vs-r .vs-nick').textContent = '"' + t(o.nickKey) + '"';
    el.vs.style.display = '';
    el.vs.classList.remove('go'); void el.vs.offsetWidth; el.vs.classList.add('go');
    if (vsTimer) clearTimeout(vsTimer);
    vsTimer = setTimeout(() => {
      vsTimer = null;
      if (G.Game.match.M.gs === 2) G.Game.match.beginFight();
    }, 1500);
  }
  function hideVS() {
    if (vsTimer) { clearTimeout(vsTimer); vsTimer = null; }
    el.vs.style.display = 'none';
  }

  // ---------------------------------------------------------------------------
  // 结算面板
  // ---------------------------------------------------------------------------
  function showResult() {
    const M = G.Game.match.M;
    uiScore = M.scr;
    const isChampion = M.vspnt[4] !== 0 && lastWinVsi === 4;
    el.result.querySelector('.res-head').textContent = isChampion ? t('end.heading') : t('banner.lose');
    el.result.querySelector('.res-sub').textContent = isChampion ? t('end.sub') : '';
    el.result.querySelector('.res-score').textContent = M.scr;
    el.result.style.display = '';
    el.result.classList.remove('res-in'); void el.result.offsetWidth; el.result.classList.add('res-in');
  }
  let lastWinVsi = 0;   // 最近一次胜利的对手号（判定冠军屏）

  // ---------------------------------------------------------------------------
  // 分享
  // ---------------------------------------------------------------------------
  let shareOpen = false;
  function openShare() {
    if (shareOpen) return;
    shareOpen = true;
    el.share.style.display = '';
    requestAnimationFrame(() => el.share.classList.add('open'));
    G.SDK.track('share_open', { score: uiScore });
  }
  function closeShare() {
    shareOpen = false;
    el.share.classList.remove('open');
    setTimeout(() => { if (!shareOpen) el.share.style.display = 'none'; }, 320);
  }

  function snapCanvas() {
    const c = document.createElement('canvas');
    c.width = 640; c.height = 360;
    if (G.Game.snapshotInto) G.Game.snapshotInto(c);
    return c;
  }

  function doShare(plat, nick) {
    A().play('click', 0.8);
    const isMobile = /Android|iPhone|iPad|Mobi/i.test(navigator.userAgent);
    if (isMobile && navigator.share && (plat === 'facebook' || plat === 'x')) {
      if (G.Core.share.webShare(nick, uiScore)) return;
    }
    if (plat === 'tiktok' || plat === 'instagram' || plat === 'youtube') {
      // 无通用网页接口：复制链接 + 生成卡片
      G.Core.share.copyLink(nick, uiScore);
      downloadCard(nick);
      toast(t('share.copy'));
      return;
    }
    G.Core.share.openPlatform(plat, nick, uiScore);
  }

  function downloadCard(nick) {
    try {
      const dataURL = G.Core.share.makeCard(snapCanvas(), nick, uiScore);
      const a = document.createElement('a');
      a.href = dataURL;
      a.download = 'knockout-arena-card.png';
      document.body.appendChild(a); a.click(); a.remove();
    } catch (e) { toast('...'); }
  }

  let toastTimer = null;
  function toast(msg) {
    el.toast.textContent = msg;
    el.toast.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.toast.classList.remove('show'), 1600);
  }

  // ---------------------------------------------------------------------------
  // 状态迁移监听（gs 变化 → 面板显隐 / 音乐 / 横幅）
  // ---------------------------------------------------------------------------
  function onGsChange(gs) {
    const M = G.Game.match.M;
    if (gs === 0) {
      el.title.style.display = '';
      el.title.classList.remove('tt-out');
      el.select.style.display = 'none';
      hideVS(); el.result.style.display = 'none';
      if (loaded && A().loadedCount() > 0) A().music('menu_music', 0.5);
    } else if (gs === 1) {
      refreshCards();
      el.select.style.display = '';
      el.select.classList.remove('sel-in'); void el.select.offsetWidth; el.select.classList.add('sel-in');
      el.title.style.display = 'none';
      if (loaded && A().loadedCount() > 0) A().music('menu_music', 0.5);
    } else if (gs === 2) {
      el.title.style.display = 'none';
      el.select.style.display = 'none';
      A().stopMusic('menu_music', 0.4);
      showVS();
    } else if (gs === 6) {
      hideVS();
      el.result.style.display = 'none';
      bannerT = 0;
    } else if (gs === 3) {
      bannerT = 40;   // 开战横幅
    } else if (gs === 4) {
      lastWinVsi = M.vsi;
    } else if (gs === 7) {
      showResult();
      if (lastWinVsi === 4 && M.vspnt[4] !== 0) { /* 冠军屏 */ }
      else lastWinVsi = 0;
    }
  }

  function watchGs(M) {
    if (M.gs !== lastGs) { onGsChange(M.gs); lastGs = M.gs; }
  }

  // ---------------------------------------------------------------------------
  // HUD 绘制（每帧）：坐标 = 原作 320x416 逻辑系等比映射
  // ---------------------------------------------------------------------------
  function resizeHud() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = window.innerWidth, H = window.innerHeight;
    if (hud.width !== W * dpr || hud.height !== H * dpr) {
      hud.width = W * dpr; hud.height = H * dpr;
    }
    hud._w = W; hud._h = H; hud._dpr = dpr;
  }
  function onResize() { resizeHud(); }

  const L2X = (x, W) => x / 320 * W;
  const L2Y = (y, H) => y / 416 * H;

  function roundRect(x2, x, y, w, hh, r) {
    x2.beginPath();
    x2.moveTo(x + r, y);
    x2.arcTo(x + w, y, x + w, y + hh, r);
    x2.arcTo(x + w, y + hh, x, y + hh, r);
    x2.arcTo(x, y + hh, x, y, r);
    x2.arcTo(x, y, x + w, y, r);
    x2.closePath();
  }

  function drawBar(x2, x, y, w, hgt, frac, colorHi, colorLo, fromRight) {
    const bw = Math.max(0, w * frac);
    const bx = fromRight ? x + w - bw : x;
    if (bw <= 0) return;
    const g = x2.createLinearGradient(0, y, 0, y + hgt);
    g.addColorStop(0, colorHi); g.addColorStop(1, colorLo);
    x2.fillStyle = g;
    x2.fillRect(bx, y, bw, hgt);
    // 高光条
    x2.fillStyle = 'rgba(255,255,255,0.22)';
    x2.fillRect(bx, y, bw, hgt * 0.34);
  }

  function drawStar(x2, cx, cy, r, rot) {
    x2.save();
    x2.translate(cx, cy);
    x2.rotate(rot);
    // 光晕
    const g = x2.createRadialGradient(0, 0, r * 0.2, 0, 0, r * 1.8);
    g.addColorStop(0, 'rgba(255,240,170,0.95)');
    g.addColorStop(0.5, 'rgba(255,200,60,0.35)');
    g.addColorStop(1, 'rgba(255,200,60,0)');
    x2.fillStyle = g;
    x2.beginPath(); x2.arc(0, 0, r * 1.8, 0, 7); x2.fill();
    // 五角星本体
    x2.beginPath();
    for (let i = 0; i < 10; i++) {
      const rr = i % 2 === 0 ? r : r * 0.45;
      const a = -Math.PI / 2 + i * Math.PI / 5;
      i === 0 ? x2.moveTo(Math.cos(a) * rr, Math.sin(a) * rr) : x2.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    x2.closePath();
    const sg = x2.createLinearGradient(0, -r, 0, r);
    sg.addColorStop(0, '#fff6d0'); sg.addColorStop(0.5, '#ffd23e'); sg.addColorStop(1, '#e08a12');
    x2.fillStyle = sg; x2.fill();
    x2.strokeStyle = 'rgba(120,60,0,0.6)'; x2.lineWidth = r * 0.08; x2.stroke();
    x2.restore();
  }

  // 蓄力挑衅拳套小图标
  function drawGloveIcon(x2, cx, cy, s) {
    x2.save();
    x2.translate(cx, cy);
    const g = x2.createRadialGradient(-s * 0.25, -s * 0.3, s * 0.1, 0, 0, s * 0.8);
    g.addColorStop(0, '#ff6a6a'); g.addColorStop(0.6, '#c22530'); g.addColorStop(1, '#7c1018');
    x2.fillStyle = g;
    x2.beginPath(); x2.arc(0, 0, s * 0.52, 0, 7); x2.fill();
    x2.beginPath(); x2.arc(-s * 0.5, s * 0.12, s * 0.2, 0, 7); x2.fill();  // 拇指
    x2.fillStyle = '#e8c94f';
    roundRect(x2, -s * 0.34, s * 0.4, s * 0.68, s * 0.2, s * 0.08); x2.fill(); // 金箍
    x2.restore();
  }

  function drawHUD(M) {
    watchGs(M);
    resizeHud();
    const W = hud._w, H = hud._h, dpr = hud._dpr;
    hctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    hctx.clearRect(0, 0, W, H);
    if (!M) return;

    const gs = M.gs;
    const SC = Math.min(W / 320, H / 416);
    const inFight = gs === 3 || gs === 4 || gs === 5 || gs === 6;

    if (inFight) drawFightHUD(M, W, H, SC, gs);

    // 黑场淡入（gs6：sovbl 1→0）
    if (gs === 6 && M.sovbl > 0) {
      hctx.fillStyle = 'rgba(0,0,0,' + Math.min(1, M.sovbl) + ')';
      hctx.fillRect(0, 0, W, H);
    }

    // 胜负横幅（gs4/5）
    if (gs === 4 || gs === 5) drawEndBanner(M, W, H, SC, gs);
    // 开战横幅
    if (gs === 3 && bannerT > 0) { bannerT--; drawFightBanner(W, H, SC); }
  }

  function drawFightHUD(M, W, H, SC, gs) {
    const x2 = hctx;
    const BAR_H = L2Y(13, H);

    // 顶部信息带背景
    const stripH = L2Y(30, H);
    const sg = x2.createLinearGradient(0, 0, 0, stripH);
    sg.addColorStop(0, 'rgba(8,6,4,0.82)'); sg.addColorStop(1, 'rgba(8,6,4,0)');
    x2.fillStyle = sg;
    x2.fillRect(0, 0, W, stripH);

    // —— 玩家双条（右端对齐 X135；黄=耐久 pmpa，红=血量 phpa，原作叠层） ——
    const pRight = L2X(135, W), pLeft = L2X(135 - 121, W);
    drawBar(x2, pLeft, L2Y(8, H), pRight - pLeft, BAR_H, Math.max(0, M.pmpa) / 121, '#ffd84d', '#b9860f', true);
    drawBar(x2, pLeft, L2Y(8, H), pRight - pLeft, BAR_H, Math.max(0, M.phpa) / 121, '#ff5a4d', '#8f1408', true);
    // —— 敌方双条（左端对齐 X185） ——
    const eLeft = L2X(185, W), eRight = L2X(185 + 121, W);
    drawBar(x2, eLeft, L2Y(8, H), eRight - eLeft, BAR_H, Math.max(0, M.empa) / 121, '#ffd84d', '#b9860f', false);
    drawBar(x2, eLeft, L2Y(8, H), eRight - eLeft, BAR_H, Math.max(0, M.ehpa) / 121, '#ff5a4d', '#8f1408', false);
    // 血条描边
    x2.strokeStyle = 'rgba(240,210,120,0.55)'; x2.lineWidth = Math.max(1, SC * 0.6);
    x2.strokeRect(pLeft, L2Y(8, H), pRight - pLeft, BAR_H);
    x2.strokeRect(eLeft, L2Y(8, H), eRight - eLeft, BAR_H);

    // —— 计时（原作 3 位数字：分 + 十秒 + 秒，M:SS） ——
    const gtm = Math.max(0, M.gtm | 0);
    const mm = gtm / 60 | 0, ss10 = (gtm - 60 * mm) / 10 | 0, ss1 = gtm % 10;
    const timeStr = mm + ':' + ss10 + ss1;
    const tpW = SC * 46, tpH = SC * 17;
    const tpX = W / 2 - tpW / 2, tpY = L2Y(4, H);
    const tg = x2.createLinearGradient(tpX, tpY, tpX, tpY + tpH);
    tg.addColorStop(0, '#f5dc74'); tg.addColorStop(0.5, '#c89b2c'); tg.addColorStop(1, '#8a6410');
    x2.fillStyle = tg;
    roundRect(x2, tpX, tpY, tpW, tpH, tpH * 0.35); x2.fill();
    x2.strokeStyle = 'rgba(60,40,8,0.7)'; x2.lineWidth = 1; x2.stroke();
    x2.fillStyle = '#1c1206';
    x2.font = '900 ' + (SC * 12) + 'px "Arial Black","Trebuchet MS",sans-serif';
    x2.textAlign = 'center'; x2.textBaseline = 'middle';
    x2.fillText(timeStr, W / 2, tpY + tpH / 2 + 1);

    // —— 总分 ——
    if (M.scr > 0) {
      x2.font = '700 ' + (SC * 10) + 'px "Trebuchet MS",sans-serif';
      x2.fillStyle = '#f2c94c';
      x2.textAlign = 'center';
      x2.fillText(t('hud.score') + ' ' + M.scr, W / 2, L2Y(28, H));
    }

    // —— 蓄力挑衅（gdstm>45：拳套图标 + 蓝色进度环，原作 cir） ——
    if (M.thct !== 0 && M.gdstm > 45) {
      const cx = L2X(165, W), cy = L2Y(204, H);
      drawGloveIcon(x2, L2X(160, W), L2Y(194, H), SC * 11);
      const frac = Math.min(1, (M.gdstm - 45) / 64);
      x2.strokeStyle = 'rgba(0,0,0,0.45)';
      x2.lineWidth = SC * 3.4;
      x2.beginPath(); x2.arc(cx, cy, SC * 8, 0, 7); x2.stroke();
      x2.strokeStyle = '#00a5f0';
      x2.lineWidth = SC * 2.6; x2.lineCap = 'round';
      x2.beginPath(); x2.arc(cx, cy, SC * 8, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2); x2.stroke();
    }

    // —— 新手提示 chip（原作三张：格挡 / 出拳 / 星星上勾） ——
    if (M.vtlpd > 0) {
      x2.globalAlpha = Math.min(1, M.vtlpd);
      const chips = [
        [14, 273, t('hint.guard')],
        [119, 315, t('hint.jab')],
        [224, 273, t('hint.star')]
      ];
      for (const [lx, ly, txt] of chips) {
        const cxx = L2X(lx + 45, W), cyy = L2Y(ly + 14, H);
        const cw = SC * 96, ch = SC * 24;
        x2.fillStyle = 'rgba(10,8,6,0.62)';
        roundRect(x2, cxx - cw / 2, cyy - ch / 2, cw, ch, ch * 0.5); x2.fill();
        x2.strokeStyle = 'rgba(242,201,76,0.7)'; x2.lineWidth = 1;
        roundRect(x2, cxx - cw / 2, cyy - ch / 2, cw, ch, ch * 0.5); x2.stroke();
        x2.fillStyle = '#f5ead0';
        x2.font = '600 ' + (SC * 9.5) + 'px "Trebuchet MS",sans-serif';
        x2.textAlign = 'center'; x2.textBaseline = 'middle';
        x2.fillText(txt, cxx, cyy);
      }
      x2.globalAlpha = 1;
    }

    // —— 飞行的星星（原作 fvx/fvy 逻辑坐标 + fvi 透明度） ——
    if (M.fvi > 0) {
      x2.globalAlpha = Math.min(1, M.fvi);
      drawStar(x2, L2X(M.fvx, W), L2Y(M.fvy, H), SC * 15, performance.now() / 500);
      x2.globalAlpha = 1;
    }

    // —— 倒地读秒大数字（dwnc/dwnac 弹跳动画） ——
    if (gs === 3 && M.dwnc > 0) {
      const n = Math.min(9, M.dwnc);
      const a = M.dwnac < 5 ? M.dwnac / 5 : 1;
      const pop = 1 + Math.max(0, 1 - M.dwnac / 8) * 0.45;
      x2.save();
      x2.globalAlpha = a;
      x2.translate(W / 2, L2Y(190, H));
      x2.scale(pop, pop);
      x2.font = '900 ' + (SC * 84) + 'px "Arial Black","Trebuchet MS",sans-serif';
      x2.textAlign = 'center'; x2.textBaseline = 'middle';
      x2.lineWidth = SC * 8; x2.strokeStyle = 'rgba(140,10,10,0.85)';
      x2.strokeText(n, 0, 0);
      x2.fillStyle = '#fff3d6';
      x2.fillText(n, 0, 0);
      x2.restore();
      // "GET UP!" 脉动
      x2.globalAlpha = a * (0.6 + 0.4 * Math.sin(performance.now() / 130));
      x2.font = '800 ' + (SC * 15) + 'px "Trebuchet MS",sans-serif';
      x2.fillStyle = '#ffdd55';
      x2.fillText(t('count.getup'), W / 2, L2Y(248, H));
      x2.globalAlpha = 1;
    }
  }

  function drawFightBanner(W, H, SC) {
    const x2 = hctx;
    const p = 1 - bannerT / 40;                      // 0→1 出场进度
    const pop = p < 0.3 ? (p / 0.3) : 1;
    const alpha = bannerT < 10 ? bannerT / 10 : 1;
    x2.save();
    x2.globalAlpha = alpha;
    x2.translate(W / 2, L2Y(190, H));
    x2.scale(0.6 + pop * 0.4, 0.6 + pop * 0.4);
    x2.font = '900 ' + (SC * 46) + 'px "Arial Black","Trebuchet MS",sans-serif';
    x2.textAlign = 'center'; x2.textBaseline = 'middle';
    x2.lineWidth = SC * 7; x2.strokeStyle = 'rgba(60,30,0,0.9)';
    x2.strokeText(t('banner.fight'), 0, 0);
    const g = x2.createLinearGradient(0, -SC * 26, 0, SC * 26);
    g.addColorStop(0, '#fff3c0'); g.addColorStop(0.5, '#ffb52e'); g.addColorStop(1, '#c2570f');
    x2.fillStyle = g;
    x2.fillText(t('banner.fight'), 0, 0);
    x2.restore();
  }

  function drawEndBanner(M, W, H, SC, gs) {
    const x2 = hctx;
    const rst = M.rstec;
    const pop = 1 + Math.max(0, 1 - Math.min(rst, 12) / 12) * 0.5;
    const win = gs === 4;
    x2.save();
    x2.translate(W / 2, L2Y(160, H));
    x2.scale(pop, pop);
    x2.textAlign = 'center'; x2.textBaseline = 'middle';
    x2.font = '900 ' + (SC * 42) + 'px "Arial Black","Trebuchet MS",sans-serif';
    x2.lineWidth = SC * 8;
    x2.strokeStyle = 'rgba(0,0,0,0.85)';
    const label = win ? t('banner.win') : t('banner.lose');
    x2.strokeText(label, 0, 0);
    x2.fillStyle = win ? '#ffd94d' : '#ff5040';
    x2.fillText(label, 0, 0);
    x2.restore();
    // 本场奖励分
    x2.font = '800 ' + (SC * 17) + 'px "Trebuchet MS",sans-serif';
    x2.textAlign = 'center';
    x2.fillStyle = '#f5ead0';
    x2.fillText(t('result.score') + '  +' + M.gtpnt, W / 2, L2Y(210, H));
    // rstec>28 后提示点击（与原作输入解锁一致）
    if (rst > 28) {
      x2.globalAlpha = 0.6 + 0.4 * Math.sin(performance.now() / 200);
      x2.font = '700 ' + (SC * 13) + 'px "Trebuchet MS",sans-serif';
      x2.fillStyle = '#fff';
      x2.fillText(t('result.tap'), W / 2, L2Y(262, H));
      x2.globalAlpha = 1;
    }
  }

  // ---------------------------------------------------------------------------
  // 域名锁跳转覆盖层
  // ---------------------------------------------------------------------------
  function showRedirect(url) {
    el.redirect.style.display = '';
    el.redirect.querySelector('.rd-msg').textContent =
      (G.Core.i18n.lang() === 'zh' ? '当前域名未授权，即将跳转 ' : 'Unauthorised domain. Redirecting to ') + url;
    let n = 3;
    el.redirect.querySelector('.rd-count').textContent = n;
    const iv = setInterval(() => {
      n--;
      el.redirect.querySelector('.rd-count').textContent = Math.max(0, n);
      if (n <= 0) clearInterval(iv);
    }, 1000);
  }

  // ---------------------------------------------------------------------------
  // 对外
  // ---------------------------------------------------------------------------
  return {
    init() {
      buildDOM();
      resizeHud();
      bindUnlock();
      buildCards();
      startLoading();
    },
    drawHUD(M, alpha) { drawHUD(M, alpha); },
    onResize,
    showRedirect
  };
})();
