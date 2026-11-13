// ============================================================================
// SDK 接入配置：线上 SDK 地址 + 本地桥接参数。
// ============================================================================
window.G = window.G || {};
window.G.SDK_CONFIG = {
  url: 'https://pipygames.com/sdk/pipysdk.min.js',   // 线上 SDK（本地 sdk 目录存有源码桥接实现）
  appId: '3d-knockout',
  site: 'https://pipygames.com',
  trackEndpoint: '',       // 预留：埋点上报地址
  version: '1.0.0'
};
