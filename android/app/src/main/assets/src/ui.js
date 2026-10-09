/* HUD / 面板 / 触屏控件 */
var UI = {
  panel: null,
  hud: {}, toast: null, lastMsg: 0, dirty: true
};

UI.init = function () {
  var d = document.getElementById('hud');
  d.innerHTML =
    '<div id="stats">' +
    '  <div class="bar"><i id="b_hp"></i><span id="t_hp"></span></div>' +
    '  <div class="bar stam"><i id="b_st"></i><span id="t_st"></span></div>' +
    '  <div class="bar hun"><i id="b_hu"></i><span id="t_hu"></span></div>' +
    '  <div id="lv"></div>' +
    '</div>' +
    '<div id="clock"></div>' +
    '<div id="pos"></div>' +
    '<div id="toast"></div>' +
    '<div id="hotbar"></div>' +
    '<div id="btns">' +
    '  <button data-p="inv">🎒 背包</button>' +
    '  <button data-p="craft">⚒ 制作</button>' +
    '  <button data-p="build">🔨 建造</button>' +
    '  <button data-p="help">❓ 帮助</button>' +
    '</div>' +
    '<div id="actbar"><i></i><span></span></div>' +
    '<div id="panel"></div>' +
    '<div id="stick"><i></i></div>' +
    '<div id="tbtns">' +
    '  <button data-t="e">E</button><button data-t="atk">⚔</button><button data-t="run">🏃</button>' +
    '</div>' +
    '<div id="dead"><div><h2>你倒下了</h2><p id="deadsub"></p><button id="respawn">在营地复活</button></div></div>' +
    '<div id="start"><div><h1>末世废土</h1>' +
    '  <p>8000×8000 格无缝废土 · 搜刮 / 挖矿 / 制造 / 防守尸潮</p>' +
    '  <button id="btn_new">新游戏</button><button id="btn_cont">继续</button>' +
    '  <p class="dim" id="seedrow"></p>' +
    '</div></div>';

  this.hud = {
    hp: document.getElementById('b_hp'), thp: document.getElementById('t_hp'),
    st: document.getElementById('b_st'), tst: document.getElementById('t_st'),
    hu: document.getElementById('b_hu'), thu: document.getElementById('t_hu'),
    lv: document.getElementById('lv'), clock: document.getElementById('clock'),
    pos: document.getElementById('pos'), toast: document.getElementById('toast'),
    hot: document.getElementById('hotbar'), act: document.getElementById('actbar'),
    panel: document.getElementById('panel'), dead: document.getElementById('dead'),
    start: document.getElementById('start')
  };
  var self = this;
  document.getElementById('btns').addEventListener('click', function (e) {
    var p = e.target.getAttribute('data-p');
    if (p) self.toggle(p);
  });
  this.hud.panel.addEventListener('click', function (e) { self.onPanelClick(e); });
  document.getElementById('respawn').addEventListener('click', function () {
    respawn(); self.hud.dead.style.display = 'none';
  });
  document.getElementById('btn_new').addEventListener('click', function () {
    newGame((Math.random() * 1e9) >>> 0); self.hud.start.style.display = 'none';
  });
  document.getElementById('btn_cont').addEventListener('click', function () {
    if (!loadGame()) { newGame((Math.random() * 1e9) >>> 0); }
    self.hud.start.style.display = 'none';
  });
  document.getElementById('seedrow').textContent = '种子：' + G.seed;
  this.hud.start.style.display = hasSave() ? 'flex' : 'flex';
  document.getElementById('btn_cont').disabled = !hasSave();
  if (isTouch()) { document.getElementById('stick').style.display = 'block'; document.getElementById('tbtns').style.display = 'block'; }
};

UI.toggle = function (p) {
  this.panel = (this.panel === p) ? null : p;
  this.dirty = true;
};

UI.update = function () {
  var h = this.hud;
  h.hp.style.width = Math.max(0, P.hp / NUM.HP_MAX * 100) + '%';
  h.thp.textContent = 'HP ' + Math.ceil(P.hp);
  h.st.style.width = Math.max(0, P.stam / NUM.STAMINA_MAX * 100) + '%';
  h.tst.textContent = '体力 ' + Math.ceil(P.stam);
  h.hu.style.width = Math.max(0, P.hunger / NUM.HUNGER_MAX * 100) + '%';
  h.thu.textContent = '饥饿 ' + Math.ceil(P.hunger);
  h.lv.textContent = 'Lv.' + P.lv + '  攻 ' + Math.round(atkOf()) + '  防 ' + Math.round(defOf()) + '  击杀 ' + M.kills;

  var phase, left;
  if (isNight()) { phase = '🌙 夜'; left = nightLeft(); }
  else { phase = '☀ 昼'; left = duskLeft(); }
  h.clock.innerHTML = '<b>第 ' + G.day + ' 天 · ' + phase + '</b> 剩余 ' + fmtT(left) +
    (G.horde ? ' · 尸潮 ×' + G.horde : '');
  if (!isNight() && duskLeft() < NUM.DUSK_WARN) h.clock.style.color = '#ff8a5c';
  else h.clock.style.color = '';

  h.pos.textContent = 'X ' + Math.floor(P.x) + '  Y ' + Math.floor(P.y) + '  Z ' + P.z +
    (P.z < 0 ? '（矿井）' : (P.z > 0 ? '（楼层）' : ''));

  if (P.act) {
    h.act.style.display = 'block';
    h.act.querySelector('i').style.width = Math.min(100, P.act.t / P.act.need * 100) + '%';
    h.act.querySelector('span').textContent = actName(P.act.type);
  } else h.act.style.display = 'none';

  /* toast */
  var last = G.msg.length ? G.msg[G.msg.length - 1] : null;
  if (last && last.t !== this.lastMsg) {
    this.lastMsg = last.t;
    h.toast.innerHTML = G.msg.slice(-4).map(function (m) { return '<div>' + m.m + '</div>'; }).join('');
  }
  if (G.msg.length && Date.now() - G.msg[G.msg.length - 1].t > 4200) { G.msg.length = 0; h.toast.innerHTML = ''; }

  /* 快捷栏 */
  var s = '';
  for (var i = 0; i < 8; i++) {
    var it = P.inv[i];
    s += '<div class="slot' + (it ? '' : ' empty') + '" data-i="' + i + '">' +
      (it ? '<span>' + ITEMS[it.i].i + '</span><em>' + it.q + '</em>' : '') + '</div>';
  }
  if (s !== this._hot) { h.hot.innerHTML = s; this._hot = s; }

  if (P.dead && h.dead.style.display !== 'flex') {
    h.dead.style.display = 'flex';
    document.getElementById('deadsub').textContent = '第 ' + G.day + ' 天 · 击杀 ' + M.kills;
  }
  if (!P.dead && h.dead.style.display === 'flex') h.dead.style.display = 'none';

  if (this.dirty) { this.renderPanel(); this.dirty = false; }
};

function actName(t) {
  return { search: '搜索中…', chop: '砍伐中…', scav: '翻找中…', stone: '采石中…', mine: '挖掘中…', fish: '钓鱼中…' }[t] || '进行中…';
}
function fmtT(s) {
  s = Math.max(0, Math.ceil(s));
  var m = Math.floor(s / 60), ss = s % 60;
  return m + ':' + (ss < 10 ? '0' : '') + ss;
}

UI.renderPanel = function () {
  var p = this.panel, el = this.hud.panel;
  if (!p) { el.style.display = 'none'; return; }
  el.style.display = 'block';
  var h = '<div class="pw"><div class="ph"><b>' +
    ({ inv: '背包', craft: '制作', build: '建造', help: '帮助', enchant: '附魔' }[p]) +
    '</b><button data-close="1">✕</button></div><div class="pb">';

  if (p === 'inv') {
    h += '<div class="eq">';
    SLOTS.forEach(function (s) {
      var e = P.equip[s];
      h += '<div class="es"><span>' + SLOT_N[s] + '</span>' + (e ? '<b>' + ITEMS[e.i].i + ' ' + ITEMS[e.i].n + (e.aff ? ' ·' + affixName(e.aff) : '') + '</b>' : '<i>空</i>') + '</div>';
    });
    h += '</div><div class="grid">';
    for (var i = 0; i < P.inv.length; i++) {
      var it = P.inv[i];
      h += '<div class="cell' + (it ? '' : ' empty') + '" data-use="' + i + '">' +
        (it ? '<span>' + ITEMS[it.i].i + '</span><em>' + ITEMS[it.i].n + '</em>' +
          (it.q > 1 ? '<u>×' + it.q + '</u>' : '') + (it.aff ? '<i class="af">' + affixName(it.aff) + '</i>' : '') : '') + '</div>';
    }
    h += '</div>';
  } else if (p === 'craft' || p === 'build') {
    var list = RECIPES.filter(function (r) {
      var it = ITEMS[r.o[0]];
      if (!it || r.hide) return false;
      return p === 'build' ? it.c === 'build' : it.c !== 'build';
    });
    h += '<div class="recipes">';
    list.forEach(function (r) {
      var ok = invHas(r.in), st = stationNear(r.st);
      h += '<div class="rec' + (ok && st ? '' : ' no') + '" data-craft="' + r.id + '">' +
        '<b>' + ITEMS[r.o[0]].i + ' ' + ITEMS[r.o[0]].n + (r.o[1] > 1 ? ' ×' + r.o[1] : '') + '</b>' +
        '<div class="cost">' + r.in.map(function (m) {
          var cur = invCount(m[0]);
          return '<span class="' + (cur >= m[1] ? 'ok' : 'lack') + '">' + ITEMS[m[0]].n + ' ' + cur + '/' + m[1] + '</span>';
        }).join(' · ') + '</div>' +
        '<div class="st">' + STATION_N[r.st] + (st ? '' : '（不在附近）') + '</div></div>';
    });
    h += '</div>';
    if (p === 'craft') h += '<div class="tip">附魔需靠近附魔台：在背包里点武器/防具可附魔</div>';
  } else if (p === 'enchant') {
    h += '<div class="recipes">';
    AFFIXES.forEach(function (a) {
      h += '<div class="rec" data-aff="' + a.id + '" data-ensel="1"><b>' + a.n + '</b>' +
        '<div class="cost">晶石 ' + invCount('crystal') + '/' + a.cost + ' · ' +
        ({ dmg: '攻击 +' + a.v, def: '防御 +' + a.v, spd: '移速 +' + Math.round(a.v * 100) + '%', leech: '吸血 ' + Math.round(a.v * 100) + '%' }[a.stat]) +
        '</div></div>';
    });
    h += '</div><div class="tip">先点这里选词缀，再在背包里点要附魔的装备</div>';
  } else if (p === 'help') {
    h += '<div class="help">' +
      '<p><b>WASD / 方向键</b> 移动 · <b>Shift</b> 奔跑 · <b>E</b> 交互（搜索容器、采集、挖矿、钓鱼、上下楼）</p>' +
      '<p><b>空格 / 鼠标左键</b> 攻击 · <b>I</b> 背包 · <b>C</b> 制作 · <b>B</b> 建造 · <b>1-8</b> 快捷使用</p>' +
      '<p>昼夜：白天 ' + (NUM.DAY_SEC / 60) + ' 分钟搜刮，夜晚 ' + (NUM.NIGHT_SEC / 60) + ' 分钟尸潮。天黑前回据点。</p>' +
      '<p>地图 8000×8000 格无缝生成；房屋随机生成，内部容器全部可按 E 搜索；矿井可挖到 Z-3。</p>' +
      '<p>做工作台 → 熔炉 → 炼金台 → 附魔台，解锁全部制造链。</p>' +
      '<p class="dim">进度自动存档到浏览器本地。</p></div>';
  }
  h += '</div></div>';
  el.innerHTML = h;
};

function affixName(id) {
  var a = AFFIXES.filter(function (x) { return x.id === id; })[0];
  return a ? a.n : '';
}
UI.ensel = null;
UI.onPanelClick = function (e) {
  var t = e.target.closest('[data-use],[data-craft],[data-close],[data-aff]');
  if (!t) return;
  if (t.getAttribute('data-close')) { this.panel = null; this.dirty = true; return; }
  var u = t.getAttribute('data-use');
  if (u !== null) {
    var idx = +u;
    if (UI.ensel && P.inv[idx] && (ITEMS[P.inv[idx].i].c === 'weap' || ITEMS[P.inv[idx].i].c === 'arm')) {
      enchantItem(idx, UI.ensel); UI.ensel = null; this.dirty = true; return;
    }
    useItem(idx); this.dirty = true; return;
  }
  var c = t.getAttribute('data-craft');
  if (c) {
    var r = RECIPES.filter(function (x) { return x.id === c; })[0];
    if (r && ITEMS[r.o[0]].c === 'build') placeBuild(c);
    else craft(c);
    this.dirty = true; return;
  }
  var af = t.getAttribute('data-aff');
  if (af) { UI.ensel = af; toast('已选「' + affixName(af) + '」，去背包点装备'); this.panel = 'inv'; this.dirty = true; }
};
