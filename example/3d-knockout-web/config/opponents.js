// ============================================================================
// 对手（关卡）配置 —— 4 名拳手，AI 参数与原作 1:1 对齐（禁止改动数值）。
// epstp:出招犹豫概率 epgop:主动进攻概率 epgdl:防守时长 epplr:刺拳A概率
// epslg:连击间隔 epjbs/epsts:刺拳A/B动画速度 epmva:移动意愿 epovs:贴边概率
// epitm:出招冷却 epja1/epja2:刺拳伤害/耗蓝 epsa1/epsa2:重拳伤害/耗蓝
// epjd1/epjd2:玩家刺拳伤害 epsd1/epsd2:玩家奖励帧伤害 eprcv:对手回复速度
// visual: 全新原创外观（肤色/发型/裤色/体型），与原作角色无造型关联。
// ============================================================================
window.G = window.G || {};
window.G.config = window.G.config || {};

G.config.opponents = [
  { // 1 号：杜克 "铁颚" —— 节奏慢、爱防守，入门对手
    id: 'duko', nameKey: 'opp.duko.name', nickKey: 'opp.duko.nick',
    diff: 1,
    ai: { epstp: .14, epgop: .9, epgdl: 50, epplr: .5, epslg: 35, epjbs: .5, epsts: .5, epmva: .3, epovs: .2, epitm: 100, epja1: 20, epsa1: 30, epja2: 4, epsa2: 6, epjd1: 30, epsd1: 40, epjd2: 3, epsd2: 4, eprcv: .5 },
    visual: { skin: '#c98d5f', hair: 'buzz', hairColor: '#2a1c12', trunk: '#1e7a3c', trunkTrim: '#f2d24b', glove: '#b3202a', body: 0.92, beard: 'full', boots: '#e8e2d4' }
  },
  { // 2 号：维托 "重锤" —— 激进压迫、伤害更高
    id: 'vito', nameKey: 'opp.vito.name', nickKey: 'opp.vito.nick',
    diff: 2,
    ai: { epstp: .4, epgop: .5, epgdl: 50, epplr: .7, epslg: 25, epjbs: .75, epsts: .5, epmva: .95, epovs: .4, epitm: 70, epja1: 30, epsa1: 40, epja2: 6, epsa2: 8, epjd1: 40, epsd1: 60, epjd2: 8, epsd2: 16, eprcv: .5 },
    visual: { skin: '#e3b088', hair: 'none', hairColor: '#101010', trunk: '#8f1d24', trunkTrim: '#f5f0e6', glove: '#22242c', body: 1.14, beard: 'stubble', boots: '#2c2620' }
  },
  { // 3 号：萨吉 "铁壁" —— 出招极快、重拳疼
    id: 'sarge', nameKey: 'opp.sarge.name', nickKey: 'opp.sarge.nick',
    diff: 3,
    ai: { epstp: .1, epgop: .8, epgdl: 20, epplr: .5, epslg: 35, epjbs: .6, epsts: .6, epmva: .95, epovs: .05, epitm: 25, epja1: 40, epsa1: 70, epja2: 7, epsa2: 14, epjd1: 30, epsd1: 50, epjd2: 6, epsd2: 10, eprcv: .5 },
    visual: { skin: '#8a5a38', hair: 'mohawk', hairColor: '#c8b26a', trunk: '#2456a8', trunkTrim: '#eef2f8', glove: '#2f7d3a', body: 1.0, beard: 'goatee', boots: '#dfe3ea' }
  },
  { // 4 号：埃尔托罗 "终局" —— 冠军战，全属性压制（需击败前三名解锁）
    id: 'eltoro', nameKey: 'opp.eltoro.name', nickKey: 'opp.eltoro.nick',
    diff: 4, boss: true,
    ai: { epstp: .15, epgop: .8, epgdl: 18, epplr: .5, epslg: 35, epjbs: .8, epsts: .7, epmva: .95, epovs: .3, epitm: 15, epja1: 40, epsa1: 70, epja2: 4, epsa2: 5, epjd1: 30, epsd1: 50, epjd2: 2, epsd2: 3, eprcv: .6 },
    visual: { skin: '#b97a4e', hair: 'mohawk', hairColor: '#161318', trunk: '#5c2483', trunkTrim: '#f2c94c', glove: '#e0a52e', body: 1.22, beard: 'full', boots: '#3a2f52' }
  }
];
