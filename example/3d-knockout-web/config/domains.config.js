// ============================================================================
// 域名锁配置：仅允许本地与 pipygames.com 运行；
// 其他域名加载完成后等待 delayMs 自动跳转至 redirect。
// ============================================================================
window.G = window.G || {};
window.G.config = window.G.config || {};

G.config.domains = {
  allowed: ['localhost', '127.0.0.1', 'pipygames.com'],
  redirect: 'https://pipygames.com',
  delayMs: 3000,
  debugBypass: false
};
