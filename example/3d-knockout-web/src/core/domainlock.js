// ============================================================================
// 域名锁：仅允许 config/domains.config.js 中的域名运行。
// 其他域名加载完成后等待 delayMs 自动跳转至 redirect。
// 由 main.js 在启动早期调用 check()。
// ============================================================================
window.G = window.G || {};

G.Core = G.Core || {};

G.Core.domainLock = (function () {
  function isAllowed() {
    const d = (window.G.config && window.G.config.domains) || { allowed: ['localhost'], redirect: 'https://pipygames.com', delayMs: 3000, debugBypass: false };
    if (d.debugBypass) return true;
    const host = (location.host || '').split(':')[0].toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1' || host === '') return true;
    return (d.allowed || []).some(a => host === a.toLowerCase() || host.endsWith('.' + a.toLowerCase()));
  }

  // 返回 true 表示被锁定（需要跳转），false 表示放行
  function check(onRedirect) {
    if (isAllowed()) return false;
    const d = window.G.config.domains;
    const redirect = () => {
      try {
        if (onRedirect) onRedirect(d.redirect);
        location.replace(d.redirect);
      } catch (e) { location.href = d.redirect; }
    };
    setTimeout(redirect, d.delayMs || 3000);
    return true;
  }

  return { check, isAllowed };
})();
