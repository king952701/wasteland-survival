/* 感染者：生成 / AI / 战斗 / 尸潮 */
var M = {
  list: [],
  spawnT: 0,
  hordeT: 0,
  kills: 0
};

function mobCap() { return isNight() ? NUM.MOB_NIGHT : NUM.MOB_DAY; }

function mobTypes() {
  if (G.day <= 2) return ['walker', 'crawler'];
  if (G.day <= 5) return ['walker', 'walker', 'crawler', 'runner'];
  return ['walker', 'crawler', 'runner', 'runner', 'brute'];
}

function spawnMob(horde) {
  var ang = Math.random() * Math.PI * 2;
  var r = NUM.MOB_SPAWN_R + Math.random() * 10;
  var x = P.x + Math.cos(ang) * r, y = P.y + Math.sin(ang) * r;
  if (x < 1 || y < 1 || x > NUM.WORLD - 1 || y > NUM.WORLD - 1) return null;
  if (W.solid(Math.floor(x), Math.floor(y), 0)) return null;
  var pool = mobTypes();
  var t = pool[Math.floor(Math.random() * pool.length)];
  var d = MOBS[t];
  var m = {
    x: x, y: y, z: 0, t: t, hp: d.hp * (1 + (G.day - 1) * 0.06), max: d.hp,
    spd: d.spd * (horde ? 1.15 : 1), dmg: d.dmg, cd: 0, hurt: 0, horde: !!horde
  };
  M.list.push(m);
  return m;
}

function clearMobs() { M.list.length = 0; }

function updateMobs(dt) {
  var underground = P.z !== 0;
  if (underground) {
    if (M.list.length) M.list.length = 0;
    return;
  }
  /* 维持数量 */
  M.spawnT -= dt;
  if (M.spawnT <= 0 && M.list.length < mobCap()) {
    M.spawnT = isNight() ? 0.7 : 1.8;
    spawnMob(false);
  }
  /* 尸潮波次 */
  if (isNight()) {
    M.hordeT -= dt;
    if (M.hordeT <= 0) {
      M.hordeT = 70;
      var n = NUM.HORDE_SIZE + Math.floor(G.day * 1.5);
      for (var i = 0; i < n; i++) spawnMob(true);
      toast('⚠ 尸潮来了！');
      G.horde++;
    }
  } else M.hordeT = 20;

  for (var k = M.list.length - 1; k >= 0; k--) {
    var m = M.list[k];
    var d = Math.hypot(P.x - m.x, P.y - m.y);
    if (d > NUM.MOB_DESPAWN_R) { M.list.splice(k, 1); continue; }
    if (m.hurt > 0) m.hurt -= dt;
    m.cd -= dt;
    var sp = m.spd * (isNight() ? 1.1 : 1);
    if (d < 1.0) {
      if (m.cd <= 0) {
        m.cd = 1.15;
        var raw = m.dmg * (1 + (G.day - 1) * 0.05);
        var hit = raw * 100 / (100 + defOf());
        P.hp -= hit;
        m.hurt = 0.18;
        if (P.hp <= 0) { die(); }
      }
    } else {
      var dx = (P.x - m.x) / d, dy = (P.y - m.y) / d;
      var nx = m.x + dx * sp * dt, ny = m.y + dy * sp * dt;
      if (!W.solid(Math.floor(nx), Math.floor(m.y), 0)) m.x = nx;
      if (!W.solid(Math.floor(m.x), Math.floor(ny), 0)) m.y = ny;
    }
  }
}

/* ---------- 玩家攻击 ---------- */
var ATK = { cd: 0, swing: 0, dir: 0 };

function attack() {
  if (ATK.cd > 0 || P.dead) return;
  var w = P.equip.weapon;
  var ranged = w && ITEMS[w.i].ranged;
  var base = atkOf();
  var spdF = w ? (ITEMS[w.i].spd || 1) : 1;
  ATK.cd = 0.62 / spdF;
  ATK.swing = 0.2;

  if (ranged) {
    if (invCount('ammo') <= 0) { toast('没有子弹'); return; }
    invTake('ammo', 1);
    var best = null, bd = 9;
    for (var i = 0; i < M.list.length; i++) {
      var m = M.list[i], d = Math.hypot(P.x - m.x, P.y - m.y);
      if (d < bd) { bd = d; best = m; }
    }
    if (!best) { toast('没有目标'); return; }
    hitMob(best, base * 1.2);
    return;
  }

  /* 近战扇形 */
  var dir = aimDir();
  var hits = 0;
  for (var j = 0; j < M.list.length; j++) {
    var mm = M.list[j];
    var d = Math.hypot(P.x - mm.x, P.y - mm.y);
    if (d > NUM.ATTACK_RANGE) continue;
    var ang = Math.atan2(mm.y - P.y, mm.x - P.x);
    var diff = Math.abs(angDiff(ang, dir));
    if (diff <= NUM.ATTACK_ARC / 2) { hitMob(mm, base); hits++; }
  }
  if (!hits) {
    /* 没有敌人时：对可采集目标挥击 */
    var hv = findHarvest();
    if (hv && (hv.kind === 'chop' || hv.kind === 'scav')) {
      P.act = { type: hv.kind, t: 0, need: 1.0, x: hv.x, y: hv.y };
    }
  }
}
function angDiff(a, b) {
  var d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}
function aimDir() {
  if (typeof MOUSE !== 'undefined' && MOUSE.aim != null) return MOUSE.aim;
  return ATK.dir;
}
function hitMob(m, dmg) {
  m.hp -= dmg;
  m.hurt = 0.22;
  var leech = leechOf();
  if (leech > 0) P.hp = Math.min(NUM.HP_MAX, P.hp + dmg * leech);
  if (m.hp <= 0) {
    var d = MOBS[m.t];
    addXp(d.xp);
    M.kills++;
    if (Math.random() < d.dr) invAdd(d.drop, 1);
    if (Math.random() < 0.12) invAdd('cloth', 1);
    var idx = M.list.indexOf(m);
    if (idx >= 0) M.list.splice(idx, 1);
  }
}

function tickAttack(dt) {
  if (ATK.cd > 0) ATK.cd -= dt;
  if (ATK.swing > 0) ATK.swing -= dt;
}
