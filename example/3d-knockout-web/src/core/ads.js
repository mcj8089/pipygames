// ============================================================================
// 广告核心：读取 config/ads.config.js。总开关关闭时全部跳过。
// 预留插屏/奖励位接入点，渠道实现放在 SDK.showAd 内。
// ============================================================================
window.G = window.G || {};

G.Core = G.Core || {};

G.Core.ads = (function () {
  let lastShown = 0, shownThisSession = 0, fights = 0;

  function cfg() { return window.G.config.ads || { enabled: false }; }

  function canShow() {
    const c = cfg();
    if (!c.enabled) return false;
    if (shownThisSession >= (c.frequency && c.frequency.maxPerSession || 6)) return false;
    if (Date.now() - lastShown < (c.frequency && c.frequency.minIntervalSec || 90) * 1000) return false;
    return true;
  }

  // 每场战斗结束调用：按频率判定插屏
  function onFightEnd() {
    fights++;
    const c = cfg();
    if (!c.enabled) return null;
    const p = c.placements && c.placements.interstitial;
    if (!p || fights % (p.everyFights || 3) !== 0) return null;
    if (!canShow()) return null;
    return show(p);
  }

  function show(placement, onReward, onClose) {
    lastShown = Date.now();
    shownThisSession++;
    if (window.G.SDK && window.G.SDK.showAd) {
      window.G.SDK.showAd(placement, onReward, onClose);
    } else if (onClose) onClose(true);
    return true;
  }

  return { canShow, show, onFightEnd };
})();
