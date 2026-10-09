/* 输入 / 主循环 / 装配 */
var MOUSE = { x: 0, y: 0, aim: 0 };
var KEY = {};
var TOUCH = { on: false, dx: 0, dy: 0, e: false, atk: false, run: false };
var started = false;
var lastCx = -1, lastCy = -1, lastCz = 0, saveT = 0;
var running = false;

function isTouch() { return ('ontouchstart' in window) || navigator.maxTouchPoints > 0; }

function newGame(seed) {
  G.seed = seed >>> 0;
  W.init(G.seed);
  invInit();
  P.x = 4000; P.y = 4000; P.z = 0;
  P.hp = NUM.HP_MAX; P.stam = NUM.STAMINA_MAX; P.hunger = 20;
  P.xp = 0; P.lv = 1; P.equip = {}; P.dead = false; P.home = null; P.act = null;
  G.t = 0; G.day = 1; G.horde = 0;
  clearMobs(); M.kills = 0;
  G.msg.length = 0;
  /* 出生点：全局搜索大陆且附近有房屋 */
  var spawn = findSpawn();
  P.x = spawn.x + 0.5; P.y = spawn.y + 0.5;
  invAdd('bandage', 2); invAdd('canned', 2); invAdd('water_c', 1);
  toast('你在废土上醒来。按 E 搜索附近的容器。');
  started = true;
  lastCx = -1;
}

function findSpawn() {
  var rng = mkRng(G.seed + 777), best = null, bestD = 1e9;
  for (var k = 0; k < 1600; k++) {
    var x = Math.floor(rng() * NUM.WORLD), y = Math.floor(rng() * NUM.WORLD);
    if (!W.walkable(x, y) || W.houseFloor(x, y, 0)) continue;
    var t = W.tileRaw(x, y);
    if (t !== T.GRASS && t !== T.FOREST && t !== T.RUBBLE && t !== T.ROAD) continue;
    var cx = Math.floor(x / NUM.CHUNK), cy = Math.floor(y / NUM.CHUNK);
    W.makeChunk(cx, cy);
    var d = 1e9;
    for (var ox = -1; ox <= 1; ox++) for (var oy = -1; oy <= 1; oy++) {
      var ch = W.chunks.get(W.key(cx + ox, cy + oy));
      if (!ch) continue;
      for (var hi = 0; hi < ch.houses.length; hi++) {
        var hh = ch.houses[hi], wx = (cx + ox) * NUM.CHUNK + hh.x + hh.w / 2, wy = (cy + oy) * NUM.CHUNK + hh.y + hh.h / 2;
        d = Math.min(d, Math.hypot(wx - x, wy - y));
      }
    }
    if (d < bestD) { bestD = d; best = { x: x, y: y, d: d }; if (d < 45) break; }
  }
  if (best) return best;
  /* 兜底：随机大陆 */
  for (var i = 0; i < 2000; i++) {
    var x = Math.floor(Math.random() * NUM.WORLD), y = Math.floor(Math.random() * NUM.WORLD);
    if (W.walkable(x, y)) return { x: x, y: y };
  }
  return { x: 4000, y: 4000 };
}

/* ---------- 输入 ---------- */
function bindInput() {
  window.addEventListener('keydown', function (e) {
    var k = e.key.toLowerCase();
    KEY[k] = true;
    if (k === ' ') { e.preventDefault(); attack(); }
    if (k === 'e') startInteract();
    if (k === 'i') UI.toggle('inv');
    if (k === 'c') UI.toggle('craft');
    if (k === 'b') UI.toggle('build');
    if (k === 'h') UI.toggle('help');
    if (k === 'escape') { UI.panel = null; UI.dirty = true; }
    if (k >= '1' && k <= '8') useItem(+k - 1);
  });
  window.addEventListener('keyup', function (e) { KEY[e.key.toLowerCase()] = false; });
  window.addEventListener('blur', function () { KEY = {}; });

  var cv = document.getElementById('game');
  window.addEventListener('mousemove', function (e) {
    MOUSE.x = e.clientX; MOUSE.y = e.clientY;
    var dx = e.clientX - window.innerWidth / 2, dy = e.clientY - window.innerHeight / 2;
    var wx = (dx / (NUM.TILE_W / 2) + dy / (NUM.TILE_H / 2)) / 2;
    var wy = (dy / (NUM.TILE_H / 2) - dx / (NUM.TILE_W / 2)) / 2;
    MOUSE.aim = Math.atan2(wy, wx);
  });
  cv.addEventListener('mousedown', function () { attack(); });
  cv.addEventListener('contextmenu', function (e) { e.preventDefault(); });

  /* 触屏摇杆 */
  var st = document.getElementById('stick'), kn = st.querySelector('i');
  var cx0 = 0, cy0 = 0, stickId = null;
  function stickStart(e) {
    var t = e.changedTouches[0];
    stickId = t.identifier;
    var r = st.getBoundingClientRect();
    cx0 = r.left + r.width / 2; cy0 = r.top + r.height / 2;
    TOUCH.on = true;
    e.preventDefault();
  }
  function stickMove(e) {
    for (var i = 0; i < e.changedTouches.length; i++) {
      var t = e.changedTouches[i];
      if (t.identifier !== stickId) continue;
      var dx = t.clientX - cx0, dy = t.clientY - cy0, d = Math.hypot(dx, dy);
      var lim = 46;
      if (d > lim) { dx = dx / d * lim; dy = dy / d * lim; d = lim; }
      kn.style.transform = 'translate(' + (dx - 20) + 'px,' + (dy - 20) + 'px)';
      TOUCH.dx = dx / lim; TOUCH.dy = dy / lim;
      MOUSE.aim = Math.atan2(TOUCH.dy, TOUCH.dx);
      e.preventDefault();
    }
  }
  function stickEnd(e) {
    for (var i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === stickId) {
        TOUCH.on = false; TOUCH.dx = 0; TOUCH.dy = 0; stickId = null;
        kn.style.transform = 'translate(-20px,-20px)';
      }
    }
  }
  st.addEventListener('touchstart', stickStart, { passive: false });
  st.addEventListener('touchmove', stickMove, { passive: false });
  st.addEventListener('touchend', stickEnd);
  st.addEventListener('touchcancel', stickEnd);

  var tb = document.getElementById('tbtns');
  tb.addEventListener('touchstart', function (e) {
    var b = e.target.getAttribute('data-t');
    if (b === 'e') { startInteract(); TOUCH.e = true; }
    if (b === 'atk') attack();
    if (b === 'run') { TOUCH.run = !TOUCH.run; e.target.classList.toggle('on', TOUCH.run); }
    e.preventDefault();
  }, { passive: false });
  tb.addEventListener('touchend', function (e) {
    if (e.target.getAttribute('data-t') === 'e') TOUCH.e = false;
  });
}

function moveInput() {
  var dx = 0, dy = 0, s = 0.7071;
  if (KEY['w'] || KEY['arrowup']) { dx -= s; dy -= s; }
  if (KEY['s'] || KEY['arrowdown']) { dx += s; dy += s; }
  if (KEY['a'] || KEY['arrowleft']) { dx -= s; dy += s; }
  if (KEY['d'] || KEY['arrowright']) { dx += s; dy -= s; }
  if (TOUCH.on) { dx += TOUCH.dx; dy += TOUCH.dy; }
  var len = Math.hypot(dx, dy);
  if (len > 1) { dx /= len; dy /= len; }
  return { dx: dx, dy: dy, moved: len > 0.05 };
}

/* ---------- 主循环 ---------- */
function update(dt) {
  if (!started || P.dead) return;
  var mv = moveInput();
  P.run = !!(KEY['shift'] || TOUCH.run) && P.stam > 1;
  if (mv.moved) {
    if (P.act) P.act = null;
    tryMove(mv.dx, mv.dy, dt);
  }
  if (P.act) {
    P.act.t += dt;
    if (P.act.t >= P.act.need) finishAct();
  }
  tickTime(dt);
  tickAttack(dt);
  updateMobs(dt);

  var cx = Math.floor(P.x / NUM.CHUNK), cy = Math.floor(P.y / NUM.CHUNK);
  if (cx !== lastCx || cy !== lastCy || P.z !== lastCz) {
    W.ensureAround(P.x, P.y, P.z);
    lastCx = cx; lastCy = cy; lastCz = P.z;
  }
  W.pump(5);

  saveT += dt;
  if (saveT > NUM.AUTOSAVE) { saveT = 0; saveGame(); }
}

var lastTs = 0;
function loop(ts) {
  var dt = lastTs ? Math.min(0.05, (ts - lastTs) / 1000) : 0;
  lastTs = ts;
  update(dt);
  R.draw();
  UI.update();
  requestAnimationFrame(loop);
}

window.addEventListener('load', function () {
  R.init(document.getElementById('game'));
  UI.init();
  bindInput();
  /* 起始世界：先给出可看的画面（开始界面背景） */
  W.init((Math.random() * 1e9) >>> 0);
  G.seed = W.seed;
  W.ensureAround(4000, 4000, 0);
  while (W.genQueue.length) W.pump(1000);
  lastCx = Math.floor(4000 / NUM.CHUNK); lastCy = lastCx;
  /* ?auto=1：跳过开始界面直接开局（自动化截图与调试用） */
  if (location.search.indexOf('auto') >= 0) {
    newGame(20261010);
    var st = document.getElementById('start');
    if (st) st.style.display = 'none';
  }
  requestAnimationFrame(loop);
});
window.addEventListener('beforeunload', function () { if (started) saveGame(); });

/* 暴露给控制台便于调试 */
window.__w = { W: W, P: P, G: G, M: M, NUM: NUM, save: saveGame, wipe: wipeSave };
