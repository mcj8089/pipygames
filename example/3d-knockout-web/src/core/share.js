// ============================================================================
// 社媒分享核心：
//  ① 移动端：优先 navigator.share（系统分享面板，覆盖所有已装 App）
//  ② 桌面端：点击平台按钮打开官方分享 URL（新标签页，自动带入链接与文案）
//  ③ TikTok / Instagram / YouTube 无通用网页接口：生成"分享卡片 + 复制链接"
// 分享卡片：实时截取游戏画面，叠加昵称、logo、站点网址，导出 PNG。
// 每次分享触发 window.G.SDK.track('share', {...}) 埋点。
// ============================================================================
window.G = window.G || {};

G.Core = G.Core || {};

G.Core.share = (function () {
  const SITE = 'https://pipygames.com';

  function gameName() {
    return (window.G.config.game && window.G.config.game.title) || 'KNOCKOUT ARENA 3D';
  }

  function shareUrl() {
    const host = (location.host || '').split(':')[0].toLowerCase();
    if (host === 'pipygames.com') return location.origin + (window.G.config.game.sharePath || '');
    return SITE + (window.G.config.game.sharePath || '');
  }

  function inviteText(nick) {
    const i18n = window.G.Core.i18n;
    const base = i18n.t('share.invite');
    return nick ? ('@' + nick + ' ' + base) : base;
  }
  function scoreText(score) {
    return window.G.Core.i18n.t('share.text', { score: score });
  }

  // ① 系统分享
  function webShare(nick, score) {
    const url = shareUrl();
    const text = (nick ? ('@' + nick + ' ') : '') + scoreText(score);
    if (navigator.share) {
      navigator.share({ title: gameName(), text: text, url: url })
        .then(() => track('system', true))
        .catch(() => track('system', false));
      return true;
    }
    return false;
  }

  // ② 平台分享链接
  function openPlatform(platform, nick, score) {
    const url = encodeURIComponent(shareUrl());
    const text = encodeURIComponent((nick ? ('@' + nick + ' ') : '') + scoreText(score));
    let link = null;
    switch (platform) {
      case 'facebook': link = 'https://www.facebook.com/sharer/sharer.php?u=' + url; break;
      case 'x':        link = 'https://twitter.com/intent/tweet?url=' + url + '&text=' + text; break;
      case 'reddit':   link = 'https://www.reddit.com/submit?url=' + url + '&title=' + text; break;
      case 'whatsapp': link = 'https://api.whatsapp.com/send?text=' + text + '%20' + url; break;
      case 'telegram': link = 'https://t.me/share/url?url=' + url + '&text=' + text; break;
      case 'linkedin': link = 'https://www.linkedin.com/sharing/share-offsite/?url=' + url; break;
      case 'youtube':  link = 'https://www.youtube.com/'; break;
      default: break;
    }
    if (link) {
      window.open(link, '_blank', 'noopener');
      track(platform, true);
    }
    return link;
  }

  // ③ 分享卡片：snapshotCanvas 为游戏画面；返回 dataURL(PNG)
  function makeCard(snapshotCanvas, nick, score) {
    const W = 640, H = 800;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const x = c.getContext('2d');

    // 背景：暗色擂台聚光渐变 + 金色粒子
    const g = x.createRadialGradient(W / 2, 250, 40, W / 2, 250, 720);
    g.addColorStop(0, '#5a3212'); g.addColorStop(0.45, '#2b1608'); g.addColorStop(1, '#0c0705');
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    x.save();
    for (let i = 0; i < 70; i++) {
      x.globalAlpha = 0.1 + Math.random() * 0.55;
      x.fillStyle = i % 3 === 0 ? '#f2c94c' : (i % 3 === 1 ? '#b3202a' : '#f5f0e6');
      const r = Math.random() * 2.4 + 0.6;
      x.beginPath(); x.arc(Math.random() * W, Math.random() * H, r, 0, 7); x.fill();
    }
    x.restore();

    // 顶部品牌（金属字效果）
    const grd = x.createLinearGradient(0, 30, 0, 86);
    grd.addColorStop(0, '#fff6d8'); grd.addColorStop(0.5, '#f2c94c'); grd.addColorStop(1, '#9a6b16');
    x.textAlign = 'center';
    x.font = '800 44px "Arial Black", "Trebuchet MS", sans-serif';
    x.fillStyle = grd;
    x.shadowColor = '#000'; x.shadowBlur = 10; x.shadowOffsetY = 3;
    x.fillText(gameName(), W / 2, 74);
    x.shadowBlur = 0; x.shadowOffsetY = 0;
    x.font = '500 19px "Trebuchet MS", sans-serif';
    x.fillStyle = '#d8c9a8';
    x.fillText(window.G.Core.i18n.t('game.subtitle'), W / 2, 102);

    // 中部游戏截图（圆角）
    const sx = 40, sy = 132, sw = W - 80, sh = 380;
    x.save();
    roundRect(x, sx, sy, sw, sh, 22); x.clip();
    if (snapshotCanvas) {
      const sc = Math.max(sw / snapshotCanvas.width, sh / snapshotCanvas.height);
      const dw = snapshotCanvas.width * sc, dh = snapshotCanvas.height * sc;
      x.drawImage(snapshotCanvas, sx + (sw - dw) / 2, sy + (sh - dh) / 2, dw, dh);
    } else {
      x.fillStyle = '#160d08'; x.fillRect(sx, sy, sw, sh);
    }
    x.restore();
    const bg = x.createLinearGradient(0, sy, 0, sy + sh);
    bg.addColorStop(0, '#f2c94c'); bg.addColorStop(1, '#7a5a14');
    x.strokeStyle = bg; x.lineWidth = 3;
    roundRect(x, sx, sy, sw, sh, 22); x.stroke();

    // 分数
    x.fillStyle = '#f2c94c'; x.font = '700 34px "Trebuchet MS", sans-serif';
    x.fillText('SCORE  ' + (score || 0), W / 2, sy + sh + 62);

    // 昵称 / 邀请语
    x.fillStyle = '#fff'; x.font = '600 23px "Trebuchet MS", sans-serif';
    x.fillText(inviteText(nick || ''), W / 2, sy + sh + 106);

    // 底部网址胶囊
    x.fillStyle = 'rgba(242,201,76,0.12)';
    roundRect(x, W / 2 - 130, H - 64, 260, 42, 21); x.fill();
    x.fillStyle = '#f2c94c'; x.font = '700 22px "Trebuchet MS", sans-serif';
    x.fillText('pipygames.com', W / 2, H - 35);

    return c.toDataURL('image/png');
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function copyLink(nick, score) {
    const text = (nick ? ('@' + nick + ' ') : '') + scoreText(score) + ' ' + shareUrl();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => track('copy', true)).catch(() => track('copy', false));
      return true;
    }
    return false;
  }

  function track(platform, ok) {
    if (window.G.SDK && window.G.SDK.track) window.G.SDK.track('share', { platform: platform, result: ok ? 'ok' : 'cancel' });
  }

  return { shareUrl, webShare, openPlatform, makeCard, copyLink, inviteText };
})();
