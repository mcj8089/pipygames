// ============================================================================
// 核心玩法 match.js —— 与原作 gm14.min.js 逐帧 1:1 对齐的移植实现。
// 30fps 逻辑帧；所有数值公式 / 判定帧 / AI 决策 / 计分公式均按原作保留
// （含原作中的无效表达式，以注释标注）。渲染插值由 main.js 驱动。
//
// 原作状态映射：
//   gs  -1加载 0标题 1选人 2VS过场 3战斗 4胜 5负 6黑场淡入 7结算
//   玩家动作 mp: 0待机 1左刺 2右刺 3格挡 4受击A 5受击B 6右上勾 7左上勾
//   敌人动作 ep: 0待机 1攻A(接触25) 2攻B(接触40) 3受击 4格挡 5踉跄 6倒地
// ============================================================================
window.G = window.G || {};
G.Game = G.Game || {};

G.Game.match = (function () {

  // ---- 帧区间表（与原作一致） ----
  const msf = [1, 20, 32, 48, 56, 68, 74, 87];
  const mef = [19, 31, 47, 55, 60, 72, 86, 99];
  const esf = [1, 20, 32, 56, 47, 61, 66];
  const eef = [19, 31, 46, 60, 55, 65, 69];

  const S = {};   // 全部可变状态（渲染层只读）
  let cfg, opp, evts = {};

  // ---------- 每场重置（对应原作 st()；scr/vspnt/vtlpd/vgd 跨场保留） ----------
  function st() {
    S.bp_f = {}; S.bp_fi = 0;
    S.bgi = 15;
    S.mp = S.bgb = 0;
    S.ms = S.mi = 1;
    S.ep = 0; S.uei = -1;
    S.es = S.ei = 1; S.eud = -1;
    S.egd = 0;
    S.etx = S.ex = 14;
    S.epc = 69;
    S.lt = 2; S.th = 0; S.esp = 10;
    S.bgx = 407;
    S.msi = S.msy = S.msx = 0; S.mst = S.mss = 1;
    S.esy = S.esx = 0; S.esi = 1;
    S.ut = S.upps = -1;
    S.vstm = S.stm = 51;
    S.epstc = 0; S.epdtm = 9;
    S.fvi = S.fvt = S.fvj = S.fvy = S.fvx = S.pfv = 0;
    S.ehpa = S.empa = S.ehp = S.emp = S.phpa = S.pmpa = S.php = S.pmp = 121;
    S.pdwy = S.pdwn = 0;
    S.edwn = -1; S.dwnac = S.dwnc = S.edwy = 0;
    S.elg = 119;
    S.ovblk = S.slwa = 0;
    S.gtm = 180; S.rnds = 0;
    S.vsanc = 14;
    S.edwct = S.pdwct = S.ldwtc = S.gtpnt = S.rstec = 0;
    S.estdct = S.pstdct = 2;
    S.sovbl = 1;
    S.gdnty = S.gdntm = S.gdstm = S.jbstm = 0;
    S.gdntj = 2;
    S.onejdg = S.thct = 0;
  }

  // ---------- 全局（跨场） ----------
  function initGlobal() {
    S.gs = -1;
    S.scr = 0;
    S.vspnt = [0, 0, 0, 0, 0];
    S.vtlpd = 0.05;
    S.vgd = 0;
    S.flt = S.mt = S.tm = 0;
  }

  // ---------- 伤害（原作 pdmg/edmg） ----------
  function pdmg(e, t) {
    S.php -= e; S.pmp -= t;
    if (1 > S.php) { S.pdwn = 1; S.pdwy = 0.15; S.php = -30; S.ut = -1; evts.onPlayerDown && evts.onPlayerDown(); }
  }
  function edmg(e, t) {
    S.ehp -= e; S.emp -= t;
    if (1 > S.ehp) { S.edwn = 1; S.edwy = 0.15; S.ehp = -30; S.ut = -1; evts.onEnemyDown && evts.onEnemyDown(); }
  }

  // ---------- 玩家出拳（原作 pchst） ----------
  function pchst(e) {
    if (0 == S.pdwn && 0 == S.edwn && 0 == S.gdntm) {
      S.mp = e; S.ms = 1;
      if (S.mp == 2) S.jbstm = 0;
      else if (S.mp == 6 || S.mp == 7) S.ms = 0.5;
      else { if (20 < S.jbstm) S.ms = 0.3; S.jbstm += 26; }
      S.mi = msf[S.mp];
      S.thct = 0;
      // 音效：出拳呼啸（原作无此文件，映射到原创音效）
      if (evts.onPunch) evts.onPunch(e);
    }
  }

  // ---------- 玩家格挡（原作 grd） ----------
  function grd() {
    if (0 == S.gdntm) { S.mp = 3; S.ms = 1.5; S.mi = msf[S.mp]; S.jbstm = 0; }
  }

  // ---------- 敌人出招（原作 epch） ----------
  function epch() {
    S.ep = Math.random() < opp.epplr ? 1 : 2;
    S.ei = esf[S.ep];
    S.es = S.ep == 1 ? opp.epjbs : opp.epsts;
    S.epc = Math.floor(Math.random() * opp.epitm);
    S.eud = 1;
  }

  // ---------- 选人并进入 VS ----------
  function selectOpponent(vsi) {
    if (S.vspnt[vsi] !== 0 && vsi !== 4) return false;
    if (vsi === 4 && (S.vspnt[1] === 0 || S.vspnt[2] === 0 || S.vspnt[3] === 0)) return false;
    S.vsi = vsi;
    const o = G.config.opponents[vsi - 1];
    opp = o.ai;
    S.gs = 2;
    S.vsanc = 14; S.ldwtc = 0;
    evts.onVS && evts.onVS(vsi);
    return true;
  }

  // ---------- VS 结束 → 黑场淡入（原作 stf） ----------
  function beginFight() {
    st();
    S.vsi = S.vsi || 1;
    opp = G.config.opponents[S.vsi - 1].ai;
    S.gs = 6;
    evts.onFightStart && evts.onFightStart(S.vsi);
  }

  // ---------- 结果页按钮 ----------
  function resultToSelect() { st(); S.gs = 1; evts.onSelect && evts.onSelect(); }
  function resultToEnd() { st(); S.gs = 7; }   // 胜4号 / 落败 → 最终结算页
  function resultRematch() { // 原作结算页"重赛"：清空成绩回选人
    S.scr = 0; S.vspnt = [0, 0, 0, 0, 0];
    st(); S.gs = 1; evts.onSelect && evts.onSelect();
  }

  // ---------- 特效队列（tp0-5，帧数与原作一致） ----------
  function addFx(tp) { S.bp_f['c' + (S.bp_fi++)] = { tp: tp, f: 0, l: 1 }; }

  // ---------- 输入：press(x, y) —— x/y 为原作 320x416 坐标 ----------
  function press(x, y) {
    const t = x, c = y;
    // 原作 case 4/5：战斗结束画面点击 → 推进流程（28 帧锁定后响应）
    if (S.gs === 4 || S.gs === 5) {
      if (28 < S.rstec) {
        if (S.gs === 4 && S.vsi < 4) resultToSelect();   // 胜 1-3 号 → 选下一对手
        else resultToEnd();                              // 胜 4 号 / 落败 → 结算页
      }
      return;
    }
    if (S.gs !== 3) return;
    if (0 == S.mp) {
      if (50 > Math.abs(t - 160)) grd();
      else if (160 > t) { if (160 > S.fvt && 180 < S.fvy) { pchst(7); S.fvj = -99; } else pchst(1); }
      else { if (160 < S.fvt && 180 < S.fvy) { pchst(6); S.fvj = -99; } else pchst(2); }
    } else if (0 == S.pdwn && 0 == S.edwn) {
      S.ut = 50 > Math.abs(t - 160) ? 3 : 160 > t ? 1 : 2;
    }
    if (0 == S.gdntm) S.th = 1;
  }
  function release() { S.th = 0; }

  // ---------- 主逻辑 tick（30fps，对应原作 lp() case 3/4/5/6） ----------
  function tick() {
    if (S.gs === 2 || S.gs === 1 || S.gs === 0 || S.gs === 7) return;

    // 黑场淡入（原作 case 6）
    if (S.gs === 6) {
      S.sovbl -= 0.05;
      if (0 > S.sovbl) { S.gs = 3; addFx(3); evts.onBell && evts.onBell(); }
      return;
    }
    if (S.gs !== 3 && S.gs !== 4 && S.gs !== 5) return;

    const gs3 = S.gs === 3;

    // —— 屏幕抖动衰减（原作 msi/mss/mst 机制） ——
    if (0.1 < S.msi) {
      if (1 == S.mss) {
        S.msx = Math.random() * S.msi * 2 - S.msi;
        S.msy = Math.random() * S.msi * 2 - S.msi;
        S.msi = 1 == S.mst ? S.msi - 1 : S.msi - 2;
      }
      S.mss *= S.mst;
    } else { S.msi = S.msy = S.msx = 0; }

    // —— 星星蓄力衰减 ——
    if (0 < S.pfv) S.pfv--;

    // —— 敌人水平移动 ——
    const e0 = S.etx - S.ex;
    S.ex += e0 / S.esp;

    // —— 相机横移（原作 bgb/bgi 逻辑） ——
    S.bgb = 0 < S.edwn ? 0.8 * S.bgb : -32 > S.ex ? 1 : 60 < S.ex ? -1 : 0.8 * S.bgb;
    if (0.1 > Math.abs(S.bgb)) S.bgb = 0;
    S.bgi += S.bgb;
    if (29 < S.bgi) S.bgi = 0;
    if (0 > S.bgi) S.bgi = 29;

    // —— 敌人帧推进 + 攻击判定 ——
    let s = S.ei | 0;
    if (51 != s || 0 == S.egd) {
      if ((25 == s || 40 == s) && 74 > S.mi) {
        if (s != S.uei) {
          S.gdntm = 0;
          if (48 < S.mi && 55 > S.mi) {
            // 玩家格挡成功：小抖动
            S.msi = 12; S.mss = 1; S.mst = -1;
            evts.onBlock && evts.onBlock();
          } else {
            // 被命中：大抖动 + 伤害（25 敌刺拳→轻伤，40 敌重拳→重伤）
            S.msi = 18; S.mst = S.mss = 1;
            if (25 == s) { S.mp = 4; pdmg(opp.epja1, opp.epja2); }
            else { S.mp = 5; pdmg(opp.epsa1, opp.epsa2); }
            S.ms = 0.25; S.mi = msf[S.mp]; S.pfv = 0;
            if (1 == S.pdwn) S.msi = 24;
            evts.onPlayerHit && evts.onPlayerHit(s);
          }
        }
        S.ei += S.es / 3;   // 接触帧减速（原作一致）
      } else {
        switch (S.edwn) {
          case -1: case 0:
            S.ei += S.es; break;
          case 1:
            if (58 != s && 63 != s) S.ei += S.es;   // 倒地下落帧冻结（原作一致）
            S.edwy += S.edwy / 4;
            if (416 < S.edwy) {
              S.edwy = 417; S.edwn = 9; S.edwct++;
              if (2 < S.edwct) {
                // 3 次击倒 → 胜利计分（原作公式；`2<vsi&&gtpnt*vsi*vsi` 为原作无效表达式，保留行为：无效果）
                S.gtpnt = 10 * (S.pmpa * S.gtm * 60 / 40 + 10 | 0);
                if (249990 < S.gtpnt) S.gtpnt = 249990;
                S.scr += S.gtpnt; S.vspnt[S.vsi] = S.gtpnt;
                S.gs = 4; S.rstec = 0;
                evts.onFightEnd && evts.onFightEnd(true, S.gtpnt);
              } else {
                S.dwnc = 1; S.dwnac = 0;
                if (80 > S.emp) { S.emp += 20; if (121 < S.emp) S.emp = 121; }
              }
            }
            break;
          case 2:
            S.edwy += -S.edwy / 3;
            S.ei += S.es;
            if (1 > S.edwy) { S.edwy = 0; S.edwn = 3; addFx(4); evts.onEnemyUp && evts.onEnemyUp(); }
            break;
          case 3:
            S.ei += S.es; break;
        }
      }
    } else if (0 > S.epc) { S.egd = 0; }

    // —— 敌人动作结束 → 回待机（原作一致，slwa 恒 0） ——
    if (S.ei > eef[S.ep]) {
      S.ep = 0; S.es = 1;
      if (1 == S.slwa) S.es = 0.5;   // 原作保留分支（slwa 全程为 0）
      S.ei = esf[S.ep];
    }
    S.uei = s;

    // —— 敌人 AI 决策（原作 1:1） ——
    S.epc--;
    if (0 > S.epc && 0 == S.ep && 0 == S.pdwn) {
      let n = 0;
      if (14 != S.etx || Math.random() < opp.epstp || 6 < S.epdtm) n = 1;
      if (1 == n) {
        if (100 > Math.abs(e0)) {
          let d = 0;
          switch (S.etx) {
            case -92: d = Math.random() > opp.epovs ? 0 : 2; break;
            case 120: d = Math.random() > opp.epovs ? 0 : 1; break;
            default: d = 0.5 < Math.random() ? 1 : 2;
          }
          if (3 < S.epstc) d = 0;
          switch (d) {
            case 0:
              if (14 != S.etx) {
                S.etx = 14; S.ep = 0; S.es = 1; S.esp = 7;
                if (Math.random() < opp.epmva) {
                  if (3 > S.vsi || Math.random() > opp.epgop) epch();
                  else { S.ep = 4; S.ei = esf[S.ep]; S.egd = S.es = 1; S.epc = Math.floor(17 * Math.random()) + 3; S.eud = 0; }
                }
              }
              S.epstc = 0;
              break;
            case 1: S.etx = -92; S.esp = 10; S.epstc++; S.epc = opp.epslg + Math.floor(20 * Math.random()); break;
            case 2: S.etx = 120; S.esp = 10; S.epstc++; S.epc = opp.epslg + Math.floor(20 * Math.random()); break;
          }
          if (130 < Math.abs(S.ex - S.etx)) S.esp = 12;
        }
        S.epdtm = 0;
      } else {
        if (Math.random() > opp.epgop || 0 == S.eud) epch();
        else {
          S.ep = 4; S.ei = esf[S.ep]; S.egd = S.es = 1;
          S.epc = Math.floor(Math.random() * opp.epgdl) + opp.epgdl;
          if (0.87 < Math.random()) S.epc = 50 + Math.floor(30 * Math.random());
          S.eud = 0;
        }
        S.epdtm++;
      }
    }

    // —— 特效队列推进（tp0-5，帧数与原作一致） ——
    let alive = 0;
    for (const k in S.bp_f) {
      const f = S.bp_f[k];
      if (1 == f.l) {
        f.f++;
        let done = false, fin = null;
        switch (f.tp) {
          case 0: done = f.f > 11; break;            // 格挡火花 12f
          case 1: done = f.f > 15; break;            // 命中火花 16f
          case 2: done = f.f > 15; break;            // 对拼 15f（视觉并入 tp1 处理）
          case 3: done = f.f > 50; fin = () => { S.edwn = 0; S.rnds = 1; S.mt = S.tm = Math.floor(Date.now() / 333); }; break; // 开场 51f
          case 4: done = f.f > 28; fin = () => { if (3 == S.gs) { S.es = S.ms = 1; S.edwn = S.pdwn = 0; } }; break; // 起身白闪 29f
          case 5: done = f.f > 33; break;            // 分数弹出
        }
        if (done) { if (fin) fin(); delete S.bp_f[k]; } else alive++;
      }
    }
    if (0 == alive) { S.bp_f = {}; S.bp_fi = 0; }

    // —— 玩家帧推进 + 命中判定（原作 1:1） ——
    const u = S.mi | 0;
    if (0 == S.gdntm) {
      /* 正常姿态渲染（3D 由 render 处理） */
    } else {
      // 挑衅状态：弹跳 + 强制敌人进攻（原作一致）
      S.gdnty += S.gdntj;
      if (0 > S.gdnty) { S.gdntj += 0.3; if (3 < S.gdntj) S.gdntj = -3; }
      else { S.gdntj -= 0.3; if (-3 > S.gdntj) S.gdntj = 3; }
      S.gdntm--;
      if (20 > S.gdntm && 1 != S.ep && 2 != S.ep) {
        S.etx = 14; S.ep = 0; S.es = 1; S.esp = 7; epch();
      }
      if (1 > S.gdntm) { S.mp = S.gdntm = 0; S.mi = msf[S.mp]; S.ms = 1; }
    }

    if (51 != u || 1 != S.th) {
      if (39 == u || 24 == u || 81 == u || 94 == u) {
        S.mi += 0.3;   // 接触帧减速
        if (30 > Math.abs(S.ex - 14) && S.upps != u) {
          if (47 > s || 55 < s || 73 < u) {
            // —— 命中（敌人未格挡，或玩家上勾破防） ——
            S.esi = 12;
            if ((19 < s && 27 > s || 31 < s && 43 > s) && 74 > u) {
              // 对拼：双方出招重叠 → 双方受伤（原作 tp2）
              addFx(2);
              if (39 == u || 81 == u) edmg(opp.epsd1, opp.epsd2); else edmg(opp.epjd1, opp.epjd2);
              if (0 < S.edwn) { S.ep = 39 == u || 81 == u ? 5 : 3; S.ei = esf[S.ep]; S.es = 0.5; S.eud = 1; }
              evts.onClash && evts.onClash(u);
            } else {
              // —— 干净命中 ——
              S.ep = 39 == u || 81 == u ? 5 : 3; S.ei = esf[S.ep]; S.es = 0.5; S.eud = 1;
              addFx(1);
              if (73 < u) {
                // 上勾拳：1.2 倍奖励伤害 + 大硬直
                S.esi = 25; S.es = 0.2; S.epc = 60;
                edmg(1.2 * opp.epsd1, opp.epsd2);
              } else if (3 == S.ep) edmg(opp.epjd1, opp.epjd2);
              else edmg(opp.epsd1, opp.epsd2);
              if (0 < S.edwn) { S.epc = 60; S.esi = 25; S.es = 0.2; }
              evts.onHit && evts.onHit(u, 73 < u);
            }
          } else {
            // —— 敌人格挡：挡火花 ——
            S.esi = 8;
            addFx(0);
            evts.onEnemyBlock && evts.onEnemyBlock();
          }
          // —— 星星蓄力（原作公式） ——
          if (0 == S.edwn) {
            S.pfv += 25;
            if (0 == S.fvi && 45 < S.pfv) {
              S.pfv = 0; S.fvi = 0.1; S.fvx = 120; S.fvy = 100; S.fvj = -12;
              S.vgd = 1;
              S.fvt = 0.5 < Math.random() ? -10 : 240;
              evts.onStar && evts.onStar();
            }
          }
        }
      } else {
        // —— 非接触帧：按 pdwn 推进（原作 switch(pdwn)） ——
        switch (S.pdwn) {
          case 0: S.mi += S.ms; break;
          case 1:
            if (58 != u && 70 != u) S.mi += S.ms;  // 倒地下落帧冻结
            S.pdwy += S.pdwy / 6;
            if (160 < S.pdwy) {
              S.pdwy = 161; S.pdwn = 9; S.pdwct++;
              if (2 < S.pdwct) {
                // 玩家 3 次倒地 → 落败计分（原作公式）
                S.gtpnt = 10 * ((121 - S.empa) * S.vsi * S.vsi * (S.edwct + 1) * 2 + 10 | 0);
                if (249990 < S.gtpnt) S.gtpnt = 249990;
                S.scr += S.gtpnt; S.vspnt[S.vsi] = S.gtpnt;
                S.gs = 5; S.rstec = 0;
                evts.onFightEnd && evts.onFightEnd(false, S.gtpnt);
              } else {
                S.dwnc = 1; S.dwnac = 0;
                if (80 > S.pmp) { S.pmp += 20; if (121 < S.pmp) S.pmp = 121; }
              }
            }
            break;
          case 2:
            S.pdwy += -S.pdwy / 3;
            S.mi += S.ms;
            if (1 > S.pdwy) { S.pdwy = 0; S.pdwn = 3; addFx(4); evts.onPlayerUp && evts.onPlayerUp(); }
            break;
          case 3: S.mi += S.ms; break;
        }
      }
    }
    // （u==51 && th==1 时玩家帧冻结在格挡帧 —— 原作按住格挡机制）

    // —— 玩家动作结束 → 缓冲输入 / 回待机 ——
    if (S.mi > mef[S.mp]) {
      if (-1 == S.ut) { S.mp = 0; S.mi = msf[S.mp]; S.ms = 1; if (1 == S.slwa) S.ms = 0.3; }
      else {
        if (3 == S.ut) grd();
        else if (1 == S.ut) pchst(1);
        else if (2 == S.ut) pchst(2);
      }
      S.ut = -1;
    }
    S.upps = u;

    // —— 星星飞行（原作公式） ——
    if (0 < S.fvi) {
      if (-99 != S.fvj) {
        S.fvi += 0.065; if (1 < S.fvi) S.fvi = 1;
        S.fvx += (S.fvt - S.fvx) / 20;
        S.fvy += S.fvj;
        S.fvj += 1; if (18 < S.fvj) S.fvj = 18;
        if (417 < S.fvy) { S.fvi = S.fvt = S.fvj = S.fvy = S.fvx = 0; }
      } else {
        S.fvy--; S.fvi -= 0.065;
        if (0.1 > S.fvi) S.fvi = S.fvt = S.fvj = S.fvy = S.fvx = 0;
      }
    }

    // —— 血条平滑（原作） ——
    S.pmpa += (S.pmp - S.pmpa) / 6;
    S.phpa += (S.php - S.phpa) / 12;
    S.empa += (S.emp - S.empa) / 6;
    S.ehpa += (S.ehp - S.ehpa) / 12;

    // —— 挑衅蓄力（原作） ——
    if (1 == S.th) { S.thct += 3; if (4 < S.thct) S.thct = 4; }
    else { S.thct--; if (0 > S.thct) S.thct = 0; }
    if (0 != S.thct) {
      S.gdstm++;
      if (45 < S.gdstm && S.gdstm <= 46) evts.onCharge && evts.onCharge();       // 蓄力开始音
      if (90 < S.gdstm) { S.gdstm = 90; S.gdntm = 55; S.th = 0; evts.onTaunt && evts.onTaunt(); }
    } else S.gdstm = 0;

    // —— 疲劳衰减 ——
    if (0 < S.jbstm) S.jbstm--;

    // —— 新手提示淡入淡出（原作 vtlpd） ——
    if (0 < S.vtlpd) {
      if (175 < S.gtm) { S.vtlpd += 0.075; if (1 < S.vtlpd) S.vtlpd = 1; }
      if (170 > S.gtm || 0 < S.edwct || 1 == S.vgd) {
        S.vtlpd -= 0.04 + 0.05 * S.vgd;
        if (0 > S.vtlpd) S.vtlpd = 0;
      }
      S.gdstm = 0;   // 提示期间禁挑衅
    }

    // —— 回合逻辑（仅 gs==3） ——
    if (gs3) {
      // 血量回复（原作 .6 / eprcv）
      S.php += 0.6; if (S.php > S.pmp) S.php = S.pmp;
      S.ehp += opp.eprcv; if (S.ehp > S.emp) S.ehp = S.emp;

      // —— 读秒（原作 dwnc/dwnac/estdct/pstdct） ——
      if (0 != S.dwnc) {
        S.dwnac++;
        if (33 < S.dwnac) {
          S.dwnac = 0; S.dwnc++;
          let lim = S.pstdct;
          if (0 < S.edwn) lim = S.estdct;
          if (S.dwnc > lim) {
            if (0 < S.edwn) {
              // 敌人起身
              S.estdct++;
              if (0.75 < Math.random()) { S.estdct++; if (0.75 < Math.random()) S.estdct++; }
              S.etx = S.ex = 14; S.dwnc = 0; S.edwn = 2; S.ep = 0; S.ei = esf[S.ep]; S.es = 1;
            } else {
              // 玩家起身
              S.pstdct++;
              if (0.75 < Math.random()) { S.pstdct++; if (0.75 < Math.random()) S.pstdct++; }
              S.dwnc = 0; S.pdwn = 2;
              if (0 != S.mp) { S.mp = 0; S.mi = msf[S.mp]; }
              S.ms = 1;
            }
            S.epc = 40; S.es = S.ms = 1; S.slwa = 0;
          }
          S.php += 3; if (S.php > S.pmp) S.php = S.pmp;
          S.ehp += 3; if (S.ehp > S.emp) S.ehp = S.emp;
          evts.onCount && evts.onCount(S.dwnc);
        }
      }

      // —— 计时（原作墙钟 /600ms；tp3 结束后 rnds=1 才走表） ——
      S.tm = Math.floor(Date.now() / 600);
      if (S.tm != S.mt && 1 < S.tm && 1 == S.rnds) {
        S.gtm--;
        if (1 > S.gtm) {
          S.gtm = 0;
          if (0 == S.onejdg) {
            // 超时 → 点数落败（原作公式）
            S.gtpnt = 10 * ((121 - S.empa) * S.vsi * S.vsi * (S.edwct + 1) * 2 + 10 | 0);
            if (249990 < S.gtpnt) S.gtpnt = 249990;
            S.scr += S.gtpnt; S.vspnt[S.vsi] = S.gtpnt;
            S.gs = 5; S.rstec = 0;
            S.edwn = S.pdwn = 9; S.epc = 99999999; S.onejdg = 1;
            evts.onFightEnd && evts.onFightEnd(false, S.gtpnt, true);
          }
        }
      }
      S.mt = S.tm;
    } else if (S.gs === 4 || S.gs === 5) {
      S.rstec++; if (33 < S.rstec) S.rstec = 33;
    }
  }

  // ---------- 渲染插值快照 ----------
  let prev = null;
  function snapshot() {
    prev = {
      mi: S.mi, ei: S.ei, ex: S.ex, pdwy: S.pdwy, edwy: S.edwy,
      fvx: S.fvx, fvy: S.fvy, fvi: S.fvi, gdnty: S.gdnty,
      msx: S.msx, msy: S.msy, esx: S.esx, esy: S.esy, camYaw: S.camYaw || 0
    };
  }

  // ---------- 对外 ----------
  return {
    init() {
      cfg = G.config.game;
      initGlobal();
      st();
      S.gs = 0;
    },
    tick, press, release, snapshot,
    selectOpponent, beginFight, resultToSelect, resultToEnd, resultRematch,
    get M() { return S; },
    get opp() { return opp; },
    get prev() { return prev; },
    on(e, fn) { evts[e] = fn; }
  };
})();
