// ============================================================================
// 广告预设：预留广告 SDK 配置位，支持后续快速接入广告账号。
// enabled=false 时游戏内所有广告调用直接跳过（不影响体验）。
// ============================================================================
window.G = window.G || {};
window.G.config = window.G.config || {};

G.config.ads = {
  enabled: false,                 // 广告总开关（接入账号后改 true）
  channel: 'pipygames',           // 渠道标识：pipygames / y8bridge / custom
  placements: {
    interstitial: { id: 'adm_inter_001', type: 'interstitial', everyFights: 3 }, // 每 3 场插屏
    rewarded:    { id: 'adm_reward_001', type: 'rewarded' },                     // 复活/翻倍奖励位（预留）
    banner:      { id: 'adm_banner_001', type: 'banner' }                        // 预留
  },
  frequency: { minIntervalSec: 90, maxPerSession: 6 }
};
