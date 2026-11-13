// ============================================================================
// 存档核心：安全 localStorage 封装。保存各对手最佳成绩与解锁进度。
// ============================================================================
window.G = window.G || {};

G.Core = G.Core || {};

G.Core.storage = (function () {
  const KEY = (window.G.config.game && window.G.config.game.saveKey) || 'ko3d_save_v1';

  let data = { best: [0, 0, 0, 0], unlocked: 1, total: 0, nick: '' };

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const d = JSON.parse(raw);
        if (d && d.best) data = Object.assign(data, d);
      }
    } catch (e) { /* 私隐模式等场景静默降级 */ }
    return data;
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* ignore */ }
  }

  // 记录某对手（1-4）最佳成绩，返回是否刷新纪录
  function record(vsi, score) {
    load();
    const i = vsi - 1;
    if (i < 0 || i > 3) return false;
    let isNew = false;
    if (score > data.best[i]) { data.best[i] = score; isNew = true; }
    data.total += score;
    if (vsi < 4) data.unlocked = Math.max(data.unlocked, vsi + 1);
    save();
    return isNew;
  }

  function best(vsi) { load(); return data.best[vsi - 1] || 0; }
  function unlocked() { load(); return data.unlocked || 1; }
  function getNick() { load(); return data.nick || ''; }
  function setNick(n) { data.nick = (n || '').slice(0, 20); save(); }

  return { load, save, record, best, unlocked, getNick, setNick, data: () => data };
})();
