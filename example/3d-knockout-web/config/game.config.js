// ============================================================================
// 游戏主配置：全局参数集中管理（语言 / 视觉 / 节奏 / 存档键名）。
// 核心玩法数值（伤害、AI、判定帧）见 opponents.js —— 与原作 1:1 对齐，勿随意改动。
// ============================================================================
window.G = window.G || {};
window.G.config = window.G.config || {};

G.config.game = {
  appId: '3d-knockout',
  title: 'KNOCKOUT ARENA 3D',          // 游戏名（分享/埋点用）
  defaultLang: 'en',                   // 默认英文，由配置控制，游戏内无切换按钮
  // —— 画面 ——
  fov: 62,                             // 第一人称视场角
  cameraHeight: 1.62,                  // 相机（玩家视点）高度（米）
  enemyDistance: 2.05,                 // 对手与玩家的基础距离（米）
  enemyXScale: 0.0125,                 // 原作 320 宽坐标系 ex 像素 -> 3D 世界 X 米
  yawScale: 0.0021,                    // ex 像素 -> 相机偏航弧度（复刻原作镜头横移手感）
  // —— 节奏（与原作一致：30 逻辑帧/秒） ——
  logicFps: 30,
  timerTicks: 180,                     // 回合计时（逻辑秒，显示为 M:SS）
  timerMsPerTick: 600,                 // 每 0.6 真实秒扣 1 逻辑秒
  maxHP: 121,                          // 与原作一致的血量上限
  // —— 存档 ——
  saveKey: 'ko3d_save_v1',
  // —— 分享 ——
  shareSite: 'https://pipygames.com',
  sharePath: '/games/3d-knockout',
  // —— 调试 ——
  debug: false
};
