// ============================================================================
// 音频核心：WebAudio 管理器。加载 assets/audio/*.wav（单文件版走 __AUDIO_DATA__）。
// 提供 play(name, vol, rate) / music(name) 循环 / 主音量控制。
// 全部音效为 AI 原创程序化合成（见 tools/gen_audio.py），不抓取原作资源。
// ============================================================================
window.G = window.G || {};

G.Core = G.Core || {};

G.Core.audio = (function () {
  let ctx = null, master = null, musicGain = null, sfxGain = null;
  const buffers = new Map();          // name -> AudioBuffer
  const musicNodes = new Map();       // name -> {src}
  let unlocked = false;
  let loadFailed = false;

  const FILES = [
    'bell', 'bell_end', 'jab', 'jab_hit', 'hook_hit', 'block', 'whoosh',
    'hurt', 'down', 'count', 'getup', 'ko', 'win', 'lose', 'click', 'select',
    'charge', 'charge_full', 'star', 'taunt', 'crowd', 'cheer',
    'menu_music', 'fight_music'
  ];

  function ensureCtx() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
      musicGain = ctx.createGain(); musicGain.gain.value = 0.55; musicGain.connect(master);
      sfxGain = ctx.createGain(); sfxGain.gain.value = 1.0; sfxGain.connect(master);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  // 首次用户交互解锁
  function unlock() {
    if (unlocked) return;
    ensureCtx();
    unlocked = true;
  }

  function decode(name, arrayBuffer) {
    return new Promise((resolve) => {
      ensureCtx();
      if (!ctx) return resolve(null);
      ctx.decodeAudioData(arrayBuffer, (buf) => {
        buffers.set(name, buf); resolve(buf);
      }, () => { loadFailed = true; resolve(null); });
    });
  }

  async function loadAll(onProgress) {
    ensureCtx();
    if (!ctx) return;
    let done = 0;
    const jobs = FILES.map(async (name) => {
      try {
        const dataURI = window.__AUDIO_DATA__ && window.__AUDIO_DATA__[name];
        let ab;
        if (dataURI) {
          const b64 = dataURI.split(',')[1];
          const bin = atob(b64);
          ab = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) ab[i] = bin.charCodeAt(i);
          ab = ab.buffer;
        } else {
          const res = await fetch('assets/audio/' + name + '.wav');
          if (!res.ok) throw new Error('http ' + res.status);
          ab = await res.arrayBuffer();
        }
        await decode(name, ab);
      } catch (e) { /* 单个缺失不阻断 */ }
      done++;
      if (onProgress) onProgress(done / FILES.length);
    });
    await Promise.all(jobs);
  }

  function play(name, vol, rate) {
    if (!unlocked || loadFailed) return;
    const buf = buffers.get(name);
    if (!buf) return;
    ensureCtx();
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate || 1;
    const g = ctx.createGain();
    g.gain.value = vol == null ? 1 : vol;
    src.connect(g); g.connect(sfxGain);
    src.start();
    return src;
  }

  // 循环音乐（menu_music / fight_music / crowd）
  function music(name, vol) {
    if (!unlocked || loadFailed) return;
    const buf = buffers.get(name);
    if (!buf || musicNodes.has(name)) return;
    ensureCtx();
    const src = ctx.createBufferSource();
    src.buffer = buf; src.loop = true;
    const g = ctx.createGain();
    g.gain.value = vol == null ? 1 : vol;
    src.connect(g); g.connect(musicGain);
    src.start();
    musicNodes.set(name, { src, g });
  }

  function stopMusic(name, fade) {
    const node = musicNodes.get(name);
    if (!node) return;
    musicNodes.delete(name);
    try {
      if (fade && ctx) {
        node.g.gain.setTargetAtTime(0, ctx.currentTime, fade / 3);
        setTimeout(() => { try { node.src.stop(); } catch (e) {} }, fade * 1000 + 100);
      } else {
        node.src.stop();
      }
    } catch (e) { /* ignore */ }
  }

  function stopAllMusic() { for (const k of Array.from(musicNodes.keys())) stopMusic(k); }

  function loadedCount() { return buffers.size; }

  return { unlock, loadAll, play, music, stopMusic, stopAllMusic, loadedCount, FILES };
})();
