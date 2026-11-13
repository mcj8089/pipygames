// ============================================================================
// 输入层：鼠标 / 触控 / 键盘 → 原作 320×416 坐标空间 press(x, y)。
// 区域语义与原作完全一致：
//   |x-160| < 50 → 格挡（按住持续格挡并蓄力挑衅）
//   x < 160      → 左拳（星星在左侧且升空时为左上勾）
//   x > 160      → 右拳（星星在右侧且升空时为右上勾）
// 键盘：A/← 左拳，D/→ 右拳，S/↓/空格 格挡（按住生效）
// ============================================================================
window.G = window.G || {};
G.Game = G.Game || {};

G.Game.input = (function () {
  let match = null, held = new Set();

  function toOrig(clientX, clientY) {
    return {
      x: Math.max(0, Math.min(319, clientX / window.innerWidth * 320)),
      y: Math.max(0, Math.min(415, clientY / window.innerHeight * 416))
    };
  }

  function firePress(x, y) {
    if (match) match.press(x, y);
  }
  function fireRelease() { if (match) match.release(); }

  function pointerDown(e) {
    const p = toOrig(e.clientX, e.clientY);
    firePress(p.x, p.y);
  }
  function pointerUp() { fireRelease(); }

  // 键盘：单次触发（按住不重复 press，与原作触控一致）
  function keyDown(e) {
    const k = e.key;
    let zone = null;
    if (k === 'a' || k === 'A' || k === 'ArrowLeft') zone = 'L';
    else if (k === 'd' || k === 'D' || k === 'ArrowRight') zone = 'R';
    else if (k === 's' || k === 'S' || k === 'ArrowDown' || k === ' ') zone = 'B';
    else return;
    e.preventDefault();
    if (held.has(zone)) return;
    held.add(zone);
    if (zone === 'L') firePress(80, 208);
    else if (zone === 'R') firePress(240, 208);
    else firePress(160, 208);
  }
  function keyUp(e) {
    const k = e.key;
    if (k === 'a' || k === 'A' || k === 'ArrowLeft') held.delete('L');
    else if (k === 'd' || k === 'D' || k === 'ArrowRight') held.delete('R');
    else if (k === 's' || k === 'S' || k === 'ArrowDown' || k === ' ') held.delete('B');
    else return;
    if (held.size === 0) fireRelease();
  }

  function init(m) {
    match = m;
    const el = document.getElementById('game-canvas');
    el.addEventListener('pointerdown', pointerDown);
    window.addEventListener('pointerup', pointerUp);
    window.addEventListener('pointercancel', pointerUp);
    window.addEventListener('keydown', keyDown);
    window.addEventListener('keyup', keyUp);
    // 触屏防滚动
    document.addEventListener('touchmove', e => { if (e.touches.length) e.preventDefault(); }, { passive: false });
  }

  return { init };
})();
