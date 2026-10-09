/* 玩家 / 背包 / 制造 / 交互 / 昼夜 / 存档 */
var P = {
  x: 4000, y: 4000, z: 0, fx: 4000, fy: 4000,
  hp: 100, stam: 100, hunger: 20, xp: 0, lv: 1,
  inv: [], equip: {}, run: false,
  buff: 0, buffT: 0,
  act: null,          /* {type, t, need, target} */
  dead: false, home: null
};

var G = {
  t: 0,               /* 当天已过秒数 */
  day: 1,
  night: false,
  horde: 0,
  msg: [],
  seed: 0
};

function dayLen() { return NUM.DAY_SEC + NUM.NIGHT_SEC; }
function isNight() { return G.t >= NUM.DAY_SEC; }
function nightLeft() { return Math.max(0, dayLen() - G.t); }
function duskLeft() { return Math.max(0, NUM.DAY_SEC - G.t); }

/* ---------- 背包 ---------- */
function invInit() { P.inv = new Array(NUM.INV_SLOTS).fill(null); }
function invCount(id) {
  var n = 0;
  for (var i = 0; i < P.inv.length; i++) if (P.inv[i] && P.inv[i].i === id) n += P.inv[i].q;
  return n;
}
function invAdd(id, q, aff) {
  if (!ITEMS[id]) return 0;
  q = q || 1;
  if (!aff) {
    for (var i = 0; i < P.inv.length; i++) {
      var s = P.inv[i];
      if (s && s.i === id && !s.aff) { s.q += q; return q; }
    }
  }
  for (var j = 0; j < P.inv.length; j++) {
    if (!P.inv[j]) { P.inv[j] = { i: id, q: q, aff: aff || null }; return q; }
  }
  toast('背包已满');
  return 0;
}
function invTake(id, q) {
  q = q || 1;
  for (var i = 0; i < P.inv.length; i++) {
    var s = P.inv[i];
    if (s && s.i === id && !s.aff) {
      var t = Math.min(q, s.q); s.q -= t; if (s.q <= 0) P.inv[i] = null;
      q -= t; if (q <= 0) return true;
    }
  }
  return q <= 0;
}
function invHas(list) {
  for (var i = 0; i < list.length; i++) if (invCount(list[i][0]) < list[i][1]) return false;
  return true;
}

/* ---------- 属性 ---------- */
function affixOf(o) { return o && o.aff ? AFFIXES.filter(function (a) { return a.id === o.aff; })[0] : null; }
function statAdd(stat) {
  var v = 0;
  for (var s in P.equip) {
    var a = affixOf(P.equip[s]);
    if (a && a.stat === stat) v += a.v;
  }
  return v;
}
function atkOf() {
  var w = P.equip.weapon, base = w ? (ITEMS[w.i].dmg || 5) : 4;
  return base + statAdd('dmg') + (P.lv - 1) * 1.5;
}
function defOf() {
  var d = 0;
  ['head', 'chest', 'legs', 'feet'].forEach(function (s) { if (P.equip[s]) d += (ITEMS[P.equip[s].i].def || 0); });
  return d + statAdd('def') + (P.lv - 1) * 0.8;
}
function spdMul() {
  var m = 1 + statAdd('spd') + (P.buffT > 0 ? 0.35 : 0);
  return m * (isNight() ? 1 : 1.05);
}
function hasTool(kind) {
  for (var i = 0; i < P.inv.length; i++) {
    var s = P.inv[i];
    if (s && ITEMS[s.i].c === 'tool' && ITEMS[s.i].tool === kind) return true;
  }
  return false;
}
function leechOf() { return statAdd('leech'); }

/* ---------- 装备 ---------- */
function equipSlot(slotIdx) {
  var s = P.inv[slotIdx];
  if (!s) return;
  var it = ITEMS[s.i];
  var slot = (it.c === 'weap') ? 'weapon' : (it.c === 'arm' ? it.s : null);
  if (!slot) { toast('这个不能装备'); return; }
  var old = P.equip[slot];
  P.equip[slot] = { i: s.i, aff: s.aff };
  P.inv[slotIdx] = old ? { i: old.i, q: 1, aff: old.aff } : null;
}

/* ---------- 使用 ---------- */
function useItem(idx) {
  var s = P.inv[idx];
  if (!s) return;
  var it = ITEMS[s.i];
  if (!it.use) {
    if (it.c === 'weap' || it.c === 'arm') { equipSlot(idx); return; }
    if (it.c === 'build') { toast('按 B 打开建造放置'); return; }
    toast('不能直接使用'); return;
  }
  if (it.use.hp) P.hp = Math.min(NUM.HP_MAX, P.hp + it.use.hp);
  if (it.use.hunger) P.hunger = Math.max(0, P.hunger - it.use.hunger);
  if (it.use.stam) P.stam = Math.min(NUM.STAMINA_MAX, P.stam + it.use.stam);
  if (it.use.buff === 'spd') { P.buff = 1; P.buffT = 25; }
  s.q--; if (s.q <= 0) P.inv[idx] = null;
}

/* ---------- 制造 ---------- */
function stationNear(st) {
  if (st === 'none') return true;
  for (var i = 0; i < W.builds.length; i++) {
    var b = W.builds[i];
    if (b.z !== P.z) continue;
    if (b.t === st && Math.abs(b.x - P.x) < 3 && Math.abs(b.y - P.y) < 3) return true;
  }
  return false;
}
function craft(rid) {
  var r = RECIPES.filter(function (x) { return x.id === rid; })[0];
  if (!r) return false;
  if (!invHas(r.in)) { toast('材料不足'); return false; }
  if (!stationNear(r.st)) { toast('需要靠近' + STATION_N[r.st]); return false; }
  r.in.forEach(function (m) { invTake(m[0], m[1]); });
  invAdd(r.o[0], r.o[1]);
  toast('制作 ' + ITEMS[r.o[0]].n + ' ×' + r.o[1]);
  return true;
}
function enchantItem(invIdx, affId) {
  var s = P.inv[invIdx];
  if (!s || !ITEMS[s.i] || (ITEMS[s.i].c !== 'weap' && ITEMS[s.i].c !== 'arm')) { toast('只能给武器或防具附魔'); return; }
  var a = AFFIXES.filter(function (x) { return x.id === affId; })[0];
  if (!a) return;
  if (!stationNear('enchant')) { toast('需要靠近附魔台'); return; }
  if (invCount('crystal') < a.cost) { toast('晶石不足（需 ' + a.cost + '）'); return; }
  invTake('crystal', a.cost);
  s.aff = a.id;
  toast(ITEMS[s.i].n + ' 获得「' + a.n + '」');
}

/* ---------- 交互目标 ---------- */
function findContainer() {
  var best = null, bd = NUM.REACH;
  var r = 2;
  for (var oy = -r; oy <= r; oy++) for (var ox = -r; ox <= r; ox++) {
    var x = Math.round(P.x) + ox, y = Math.round(P.y) + oy;
    var c = W.contAt(x, y, P.z);
    if (!c || W.isSearched(c.id)) continue;
    var d = Math.hypot(x + 0.5 - P.x, y + 0.5 - P.y);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}
function nearMineEntry() {
  var x = Math.round(P.x), y = Math.round(P.y);
  for (var oy = -1; oy <= 1; oy++) for (var ox = -1; ox <= 1; ox++) {
    var e = W.mineEntranceNear(x + ox, y + oy);
    if (e && Math.hypot(e.x + 0.5 - P.x, e.y + 0.5 - P.y) <= NUM.REACH) return e;
  }
  return null;
}
function onStair() {
  if (P.z === 0) {
    var hf = W.houseFloor(Math.round(P.x), Math.round(P.y), 0);
    return (hf && hf.f.cells[hf.idx] === 4) ? 'up' : null;
  }
  var u = W.underAt(Math.round(P.x), Math.round(P.y), P.z);
  if (u === 3) return P.z < -1 ? 'up' : 'surface';
  return null;
}
function nearWater() {
  var x = Math.round(P.x), y = Math.round(P.y);
  for (var oy = -2; oy <= 2; oy++) for (var ox = -2; ox <= 2; ox++) {
    var t = W.tileRaw(x + ox, y + oy);
    if ((t === T.WATER || t === T.DEEP) && Math.hypot(ox, oy) <= 2.5) return true;
  }
  return false;
}
/* 可采集/挖掘的目标格 */
function findHarvest() {
  var r = 1, best = null, bd = NUM.REACH;
  for (var oy = -r; oy <= r; oy++) for (var ox = -r; ox <= r; ox++) {
    var x = Math.round(P.x) + ox, y = Math.round(P.y) + oy;
    var kind = null;
    if (P.z === 0) {
      if (W.houseFloor(x, y, 0)) continue;
      var t = W.tileRaw(x, y);
      if (t === T.FOREST) kind = 'chop';
      else if (t === T.RUBBLE) kind = 'scav';
      else if (t === T.ROCK) kind = 'stone';
    } else {
      var u = W.underAt(x, y, P.z);
      if (u === 0 || u === 2) kind = 'mine';
    }
    if (!kind) continue;
    var d = Math.hypot(x + 0.5 - P.x, y + 0.5 - P.y);
    if (d < bd) { bd = d; best = { x: x, y: y, kind: kind }; }
  }
  return best;
}

/* ---------- 开始一个交互 ---------- */
function startInteract() {
  if (P.act) return;
  var st = onStair();
  if (st) {
    if (st === 'up') { P.z += 1; toast('上楼 Z=' + P.z); }
    else if (st === 'surface') { P.z = 0; toast('回到地表'); }
    else { P.z = -1; toast('下到矿井 Z=-1'); }
    return;
  }
  var e = nearMineEntry();
  if (e && P.z === 0) { P.z = -1; P.x = e.x + 0.5; P.y = e.y + 0.5; toast('下到矿井 Z=-1'); return; }
  var c = findContainer();
  if (c) { P.act = { type: 'search', t: 0, need: NUM.SEARCH_SEC, c: c }; return; }
  if (nearWater() && hasTool(5)) {
    P.act = { type: 'fish', t: 0, need: NUM.FISH_MIN + Math.random() * (NUM.FISH_MAX - NUM.FISH_MIN) };
    return;
  }
  var hv = findHarvest();
  if (hv) {
    var need = hv.kind === 'mine' ? NUM.MINE_SEC : 1.1;
    if (hv.kind === 'mine' && !hasTool(2) && !hasTool(4)) { toast('需要镐'); return; }
    if (hv.kind === 'chop' && !hasTool(1) && !hasTool(3)) need = 2.4;
    P.act = { type: hv.kind, t: 0, need: need, x: hv.x, y: hv.y };
    return;
  }
  toast('附近没有可交互的东西');
}
function cancelAct() { P.act = null; }

function finishAct() {
  var a = P.act;
  if (!a) return;
  P.act = null;
  if (a.type === 'search') {
    W.markSearched(a.c.id);
    rollLoot(a.c.type, a.c.id);
  } else if (a.type === 'chop') {
    invAdd('wood', 2 + Math.floor(Math.random() * 3));
    invAdd('fiber', 1 + Math.floor(Math.random() * 2));
    W.diff.set(a.x + ',' + a.y + ',0', T.GRASS);
  } else if (a.type === 'scav') {
    invAdd('scrap', 1 + Math.floor(Math.random() * 3));
    if (Math.random() < 0.4) invAdd('cloth', 1);
    W.diff.set(a.x + ',' + a.y + ',0', T.SAND);
  } else if (a.type === 'stone') {
    invAdd('stone', 2 + Math.floor(Math.random() * 3));
    W.diff.set(a.x + ',' + a.y + ',0', T.SAND);
  } else if (a.type === 'mine') {
    W.setUnder(a.x, a.y, P.z, 1);
    var o = pickOre(P.z);
    invAdd(o, 1 + (Math.random() < 0.35 ? 1 : 0));
    toast('挖到 ' + ITEMS[o].n);
  } else if (a.type === 'fish') {
    var f = FISH[weightedIdx(FISH)];
    invAdd(f.i, 1);
    toast('钓到 ' + f.n);
  }
}
function weightedIdx(arr) {
  var tot = 0, i;
  for (i = 0; i < arr.length; i++) tot += arr[i].w;
  var r = Math.random() * tot;
  for (i = 0; i < arr.length; i++) { r -= arr[i].w; if (r <= 0) return i; }
  return 0;
}
function pickOre(z) {
  var depth = -z, pool = ORES.slice();
  if (depth >= 2) pool.push({ i: 'gold_ore', w: 14 }, { i: 'crystal', w: 12 });
  if (depth >= 3) pool.push({ i: 'crystal', w: 18 }, { i: 'gold_ore', w: 18 });
  return pool[weightedIdx(pool)].i;
}
function rollLoot(type, seedId) {
  var t = CONT[type] ? CONT[type].loot : 'store';
  var tbl = LOOT[t] || LOOT.store;
  var rng = mkRng(hashStr(seedId) >>> 0);
  var n = 1 + (rng() < 0.45 ? 1 : 0) + (rng() < 0.15 ? 1 : 0);
  var got = [];
  for (var i = 0; i < n; i++) {
    var e = tbl[Math.floor(rng() * tbl.length)];
    var q = e.min + Math.floor(rng() * (e.max - e.min + 1));
    invAdd(e.i, q);
    got.push(ITEMS[e.i].n + '×' + q);
  }
  toast('搜到：' + got.join('、'));
}
function hashStr(s) {
  var h = 2166136261;
  for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = (h * 16777619) >>> 0; }
  return h;
}

/* ---------- 建造 ---------- */
function placeBuild(rid) {
  var r = RECIPES.filter(function (x) { return x.id === rid; })[0];
  if (!r || !ITEMS[r.o[0]] || ITEMS[r.o[0]].c !== 'build') return;
  if (!invHas(r.in)) { toast('材料不足'); return; }
  var x = Math.round(P.x), y = Math.round(P.y);
  if (P.z !== 0) { toast('只能在地表建造'); return; }
  if (!W.walkable(x, y) || W.buildAt(x, y, 0) || W.houseFloor(x, y, 0)) { toast('这里放不下'); return; }
  r.in.forEach(function (m) { invTake(m[0], m[1]); });
  W.addBuild(x, y, 0, r.o[0]);
  if (r.o[0] === 'camp') { P.home = { x: x, y: y }; toast('营地已设立（复活点）'); }
  else toast('建成 ' + ITEMS[r.o[0]].n);
}

/* ---------- 移动 ---------- */
function tryMove(dx, dy, dt) {
  var spd = (P.run ? NUM.RUN_SPD : NUM.PLAYER_SPD) * spdMul();
  var nx = P.x + dx * spd * dt, ny = P.y + dy * spd * dt;
  if (P.z === 0) {
    if (!solidAt(nx, P.y, P.z)) P.x = nx;
    if (!solidAt(P.x, ny, P.z)) P.y = ny;
  } else {
    if (!solidAt(nx, P.y, P.z)) P.x = nx;
    if (!solidAt(P.x, ny, P.z)) P.y = ny;
  }
  P.x = Math.max(1, Math.min(NUM.WORLD - 1, P.x));
  P.y = Math.max(1, Math.min(NUM.WORLD - 1, P.y));
}
function solidAt(x, y, z) { return W.solid(Math.floor(x), Math.floor(y), z); }

/* ---------- 时间与生存 ---------- */
function tickTime(dt) {
  G.t += dt;
  if (G.t >= dayLen()) { G.t = 0; G.day++; G.horde = 0; toast('第 ' + G.day + ' 天，天亮了'); }
  var n = isNight();
  if (n !== G.night) {
    G.night = n;
    if (n) toast('天黑了——感染者变多了');
  }
  P.hunger = Math.min(NUM.HUNGER_MAX, P.hunger + NUM.HUNGER_RATE * dt * (P.run ? 1.6 : 1));
  if (P.hunger >= NUM.HUNGER_MAX) P.hp -= 1.2 * dt;
  if (P.buffT > 0) P.buffT -= dt;
  if (P.run && (P.stam > 0)) P.stam -= NUM.STAMINA_RUN * dt;
  else P.stam = Math.min(NUM.STAMINA_MAX, P.stam + NUM.STAMINA_REGEN * dt);
  if (P.stam <= 0) P.run = false;
  if (P.hp > 0) P.hp = Math.min(NUM.HP_MAX, P.hp + 0.35 * dt);
}
function addXp(n) {
  P.xp += n;
  var need = 40 + P.lv * 32;
  if (P.xp >= need) { P.xp -= need; P.lv++; toast('升级！Lv.' + P.lv); }
}

/* ---------- 死亡与复活 ---------- */
function die() {
  P.dead = true;
  P.hp = 0;
  P.act = null;
}
function respawn() {
  P.dead = false;
  P.hp = NUM.HP_MAX * 0.6;
  P.hunger = 30; P.stam = NUM.STAMINA_MAX;
  if (P.home) { P.x = P.home.x + 0.5; P.y = P.home.y + 0.5; }
  else { P.x = 4000; P.y = 4000; }
  P.z = 0;
  toast('在营地醒来');
}

/* ---------- 存档 ---------- */
var SAVE_KEY = 'wasteland_save_v1';
function saveGame() {
  try {
    var o = {
      v: NUM.SAVE_VER, p: {
        x: P.x, y: P.y, z: P.z, hp: P.hp, stam: P.stam, hunger: P.hunger,
        xp: P.xp, lv: P.lv, inv: P.inv, equip: P.equip, home: P.home
      },
      g: { t: G.t, day: G.day }, w: W.save()
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(o));
    return true;
  } catch (e) { return false; }
}
function loadGame() {
  try {
    var s = localStorage.getItem(SAVE_KEY);
    if (!s) return false;
    var o = JSON.parse(s);
    W.load(o.w);
    var p = o.p;
    P.x = p.x; P.y = p.y; P.z = p.z; P.hp = p.hp; P.stam = p.stam;
    P.hunger = p.hunger; P.xp = p.xp; P.lv = p.lv;
    P.inv = p.inv || new Array(NUM.INV_SLOTS).fill(null);
    P.equip = p.equip || {}; P.home = p.home || null; P.dead = false;
    G.t = o.g.t; G.day = o.g.day;
    return true;
  } catch (e) { return false; }
}
function hasSave() { try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; } }
function wipeSave() { try { localStorage.removeItem(SAVE_KEY); } catch (e) {} }

/* ---------- 提示 ---------- */
function toast(m) {
  G.msg.push({ t: Date.now(), m: m });
  if (G.msg.length > 5) G.msg.shift();
}
