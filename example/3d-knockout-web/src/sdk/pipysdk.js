// ============================================================================
// 公共 SDK（pipygames）：埋点 / 广告 / 域名校验 / 存档 / 社媒分享 通用能力。
// 设计目标：无 BUG、离线可用、与游戏解耦。游戏通过 window.G.SDK 调用。
// 接入云端 SDK 时，init() 可动态加载 pipysdk.min.js 并桥接；否则走本地实现。
// ============================================================================
window.G = window.G || {};
G.SDK = (function () {
  const cfg = window.G.SDK_CONFIG || { appId: '3d-knockout', site: 'https://pipygames.com' };
  const queue = [];
  let started = false;
  let cloud = null;

  function init() {
    if (started) return; started = true;
    try {
      const n = parseInt(localStorage.getItem('ko3d_launch_count') || '0', 10) + 1;
      localStorage.setItem('ko3d_launch_count', n);
    } catch (e) {}
    // 尝试桥接线上 SDK（失败则静默走本地实现，不阻塞游戏）
    if (cfg.url) {
      try {
        const s = document.createElement('script');
        s.src = cfg.url;
        s.async = true;
        s.onload = () => { cloud = window.PipySDK || null; if (cloud && cloud.init) { try { cloud.init({ appId: cfg.appId }); } catch (e) {} } };
        s.onerror = () => { cloud = null; };
        document.head.appendChild(s);
      } catch (e) { cloud = null; }
    }
  }

  // 埋点：event 名称 + 任意数据。本地记录计数，便于后续裂变分析。
  function track(event, data) {
    const item = { app: cfg.appId, event: event, data: data || {}, t: Date.now() };
    queue.push(item);
    if (queue.length > 200) queue.shift();
    try {
      const key = 'ko3d_track_' + event;
      localStorage.setItem(key, String((parseInt(localStorage.getItem(key) || '0', 10) + 1)));
    } catch (e) {}
    if (cloud && cloud.track) { try { cloud.track(event, data); } catch (e) {} }
    return item;
  }

  function getEvents() { return queue.slice(); }

  // 广告：由 core/ads 在判定可展示后调用。本地实现为安全的 mock（直接回调成功），
  // 真实环境在此接入渠道 SDK 并返回真实展示结果。
  function showAd(placement, onReward, onClose) {
    if (cloud && cloud.showAd) {
      try { cloud.showAd(placement, onReward, onClose); return true; } catch (e) {}
    }
    if (onReward && placement && placement.type === 'rewarded') onReward(true);
    if (onClose) onClose(true);
    track('ad_show', { id: placement && placement.id, type: placement && placement.type });
    return true;
  }

  // 域名校验（转发到 core/domainlock 的统一入口）
  function checkDomain(onRedirect) {
    if (window.G.Core && window.G.Core.domainLock) return window.G.Core.domainLock.check(onRedirect);
    return false;
  }

  // 社媒分享（转发到 core/share）
  function share(opts) {
    if (!window.G.Core || !window.G.Core.share) return null;
    const s = window.G.Core.share;
    if (opts && opts.platform) return s.openPlatform(opts.platform, opts.nick, opts.score);
    if (opts && opts.card) return s.makeCard(opts.snapshot, opts.nick, opts.score);
    return null;
  }

  return { init, track, getEvents, showAd, checkDomain, share };
})();
