/* 渲染：45° 等距投影 / 深度排序 / 多层 / 昼夜光照 */
var R = {
  cv: null, ctx: null, w: 0, h: 0, dpr: 1,
  tiles: {}, underTiles: {}, light: null, lctx: null
};

var TILE_COL = {
  0: ['#12384f', '#0d2a3c'], 1: ['#1d5e78', '#16485c'], 2: ['#b9a271', '#a08c60'],
  3: ['#4a7a3c', '#3d6631'], 4: ['#2f5c2c', '#254a23'], 5: ['#6b6259', '#565049'],
  6: ['#7b7b7b', '#666666'], 7: ['#4d4d52', '#3f3f44']
};
var UNDER_COL = { 0: ['#4a4642', '#3a3733'], 1: ['#241f1c', '#1b1714'], 2: ['#5a4a3a', '#46392c'], 3: ['#3a3328', '#2c2620'] };

function isoX(x, y) { return (x - y) * (NUM.TILE_W / 2); }
function isoY(x, y, z) { return (x + y) * (NUM.TILE_H / 2) - (z || 0) * NUM.Z_H; }

R.init = function (cv) {
  this.cv = cv;
  this.ctx = cv.getContext('2d');
  this.resize();
  this.light = document.createElement('canvas');
  this.lctx = this.light.getContext('2d');
  this.buildTiles();
  window.addEventListener('resize', function () { R.resize(); });
};
R.resize = function () {
  var d = Math.min(window.devicePixelRatio || 1, 2);
  this.dpr = d;
  this.w = window.innerWidth; this.h = window.innerHeight;
  this.cv.width = this.w * d; this.cv.height = this.h * d;
  this.cv.style.width = this.w + 'px'; this.cv.style.height = this.h + 'px';
  this.ctx.setTransform(d, 0, 0, d, 0, 0);
  if (this.light) { this.light.width = this.w; this.light.height = this.h; }
};

/* 预渲染地形瓦片（比每帧画路径快得多） */
R.buildTiles = function () {
  var self = this;
  function mk(c1, c2, deco) {
    var c = document.createElement('canvas');
    c.width = NUM.TILE_W; c.height = NUM.TILE_H + 2;
    var g = c.getContext('2d');
    g.beginPath();
    g.moveTo(NUM.TILE_W / 2, 0); g.lineTo(NUM.TILE_W, NUM.TILE_H / 2);
    g.lineTo(NUM.TILE_W / 2, NUM.TILE_H); g.lineTo(0, NUM.TILE_H / 2); g.closePath();
    g.fillStyle = c1; g.fill();
    g.strokeStyle = c2; g.lineWidth = 1; g.stroke();
    if (deco) deco(g);
    return c;
  }
  for (var k in TILE_COL) {
    (function (k) {
      var col = TILE_COL[k];
      var deco = null;
      if (+k === T.FOREST) deco = function (g) { g.fillStyle = '#1f3f1d'; g.beginPath(); g.arc(32, 12, 7, 0, 7); g.fill(); };
      if (+k === T.RUBBLE) deco = function (g) { g.fillStyle = '#4a443d'; g.fillRect(24, 12, 8, 6); g.fillRect(36, 18, 6, 5); };
      if (+k === T.ROCK) deco = function (g) { g.fillStyle = '#8e8e8e'; g.beginPath(); g.moveTo(24, 16); g.lineTo(34, 6); g.lineTo(46, 16); g.closePath(); g.fill(); };
      if (+k === T.ROAD) deco = function (g) { g.strokeStyle = '#6d6d72'; g.lineWidth = 3; g.beginPath(); g.moveTo(4, 16); g.lineTo(60, 16); g.stroke(); };
      if (+k === T.WATER || +k === T.DEEP) deco = function (g) { g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = 2; g.beginPath(); g.moveTo(18, 14); g.quadraticCurveTo(32, 8, 46, 14); g.stroke(); };
      self.tiles[k] = mk(col[0], col[1], deco);
    })(k);
  }
  for (var u in UNDER_COL) {
    (function (u) {
      var col = UNDER_COL[u];
      var deco = null;
      if (+u === 2) deco = function (g) { g.fillStyle = '#d8b24a'; g.beginPath(); g.arc(28, 14, 4, 0, 7); g.arc(38, 18, 3, 0, 7); g.fill(); };
      self.underTiles[u] = mk(col[0], col[1], deco);
    })(u);
  }
};

function grassDeco(ctx, sx, sy, h) {
  var col = (h % 3 === 0) ? '#c24e7a' : ((h % 3 === 1) ? '#e8c547' : '#6ab04c');
  ctx.fillStyle = col;
  ctx.beginPath(); ctx.arc(sx, sy - 4, 2.5, 0, 7); ctx.fill();
  ctx.strokeStyle = 'rgba(40,80,30,.35)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx - 1, sy - 4); ctx.moveTo(sx, sy); ctx.lineTo(sx + 1, sy - 4); ctx.stroke();
}

/* 画一个立方体（墙 / 建筑） */
function drawBox(ctx, sx, sy, hgt, top, left, right) {
  var hw = NUM.TILE_W / 2, hh = NUM.TILE_H / 2;
  ctx.fillStyle = left;
  ctx.beginPath();
  ctx.moveTo(sx - hw, sy); ctx.lineTo(sx, sy + hh);
  ctx.lineTo(sx, sy + hh - hgt); ctx.lineTo(sx - hw, sy - hgt); ctx.closePath(); ctx.fill();
  ctx.fillStyle = right;
  ctx.beginPath();
  ctx.moveTo(sx + hw, sy); ctx.lineTo(sx, sy + hh);
  ctx.lineTo(sx, sy + hh - hgt); ctx.lineTo(sx + hw, sy - hgt); ctx.closePath(); ctx.fill();
  ctx.fillStyle = top;
  ctx.beginPath();
  ctx.moveTo(sx, sy - hh - hgt); ctx.lineTo(sx + hw, sy - hgt);
  ctx.lineTo(sx, sy + hh - hgt); ctx.lineTo(sx - hw, sy - hgt); ctx.closePath(); ctx.fill();
}

R.draw = function () {
  var ctx = this.ctx, W2 = this.w / 2, H2 = this.h / 2;
  var camX = isoX(P.x, P.y), camY = isoY(P.x, P.y, P.z);
  var ox = W2 - camX, oy = H2 - camY;
  function S(wx, wy, wz) { return { x: isoX(wx, wy) + ox, y: isoY(wx, wy, wz) + oy }; }

  ctx.fillStyle = P.z === 0 ? (isNight() ? '#0a0f1c' : '#1a1712') : '#000';
  ctx.fillRect(0, 0, this.w, this.h);

  var px = Math.floor(P.x), py = Math.floor(P.y), pz = P.z;
  var RAD = 30;
  var objs = [];

  for (var y = py - RAD; y <= py + RAD; y++) {
    for (var x = px - RAD; x <= px + RAD; x++) {
      if (x < 0 || y < 0 || x >= NUM.WORLD || y >= NUM.WORLD) continue;
      var s = S(x, y, pz);
      if (s.x < -80 || s.x > this.w + 80 || s.y < -120 || s.y > this.h + 120) continue;

      if (pz === 0) {
        var hf = W.houseFloor(x, y, 0);
        if (hf && pz < hf.h.floors.length) {
          var cell = hf.f.cells[hf.idx];
          var tile = this.tiles[T.GRASS];
          if (cell !== 2) ctx.drawImage(tile, s.x - NUM.TILE_W / 2, s.y - NUM.TILE_H / 2);
          if (cell === 2) objs.push({ d: x + y, f: function (sx, sy) { drawBox(ctx, sx, sy, 46, '#8a7a63', '#6d5f4c', '#5c5041'); }, x: s.x, y: s.y });
          else if (cell === 3) objs.push({ d: x + y + 0.1, f: function (sx, sy) { ctx.fillStyle = '#7a5c3a'; ctx.fillRect(sx - 10, sy - 30, 20, 30); }, x: s.x, y: s.y });
          else if (cell === 4) objs.push({ d: x + y + 0.1, f: function (sx, sy) { ctx.fillStyle = '#c9a227'; ctx.font = '18px sans-serif'; ctx.fillText('⇅', sx - 7, sy - 4); }, x: s.x, y: s.y });
        } else {
          var t = W.tileRaw(x, y);
          var img = this.tiles[t] || this.tiles[T.GRASS];
          ctx.drawImage(img, s.x - NUM.TILE_W / 2, s.y - NUM.TILE_H / 2);
          if (t === T.GRASS && ((x * 73856093 ^ y * 19349663) % 7) === 0) grassDeco(ctx, s.x, s.y, x + y);
          if (t === T.FOREST) objs.push({ d: x + y, f: function (sx, sy) { ctx.fillStyle = '#2c4a26'; ctx.beginPath(); ctx.arc(sx, sy - 14, 12, 0, 7); ctx.fill(); ctx.fillStyle = '#5b3f27'; ctx.fillRect(sx - 2, sy - 6, 4, 10); }, x: s.x, y: s.y });
        }
      } else {
        /* 楼上：只画该层 */
        var hf2 = W.houseFloor(x, y, pz);
        if (hf2) {
          var c2 = hf2.f.cells[hf2.idx];
          if (c2 !== 2) ctx.drawImage(this.tiles[T.GRASS], s.x - NUM.TILE_W / 2, s.y - NUM.TILE_H / 2);
          if (c2 === 2) objs.push({ d: x + y, f: function (sx, sy) { drawBox(ctx, sx, sy, 46, '#8a7a63', '#6d5f4c', '#5c5041'); }, x: s.x, y: s.y });
          else if (c2 === 4) objs.push({ d: x + y + 0.1, f: function (sx, sy) { ctx.fillStyle = '#c9a227'; ctx.font = '18px sans-serif'; ctx.fillText('⇅', sx - 7, sy - 4); }, x: s.x, y: s.y });
        } else {
          /* 楼层外：不画地面，留出空洞感 */
        }
        continue;
      }

      /* 地表：容器 / 建造 / 矿井入口 */
      if (pz === 0) {
        var cx = Math.floor(x / NUM.CHUNK), cy = Math.floor(y / NUM.CHUNK);
        var ch = W.chunks.get(W.key(cx, cy));
        if (ch) {
          for (var ei = 0; ei < ch.ents.length; ei++) {
            var e = ch.ents[ei];
            if (e.x !== x || e.y !== y) continue;
            objs.push({ d: x + y + 0.2, x: s.x, y: s.y, f: entSprite(e) });
          }
        }
        var bd = W.buildAt(x, y, 0);
        if (bd) objs.push({ d: x + y + 0.2, x: s.x, y: s.y, f: buildSprite(bd) });
      } else {
        var ct = W.contAt(x, y, pz);
        if (ct) objs.push({ d: x + y + 0.2, x: s.x, y: s.y, f: contSprite(ct) });
      }
    }
  }

  /* 玩家 / 敌人 */
  if (pz === 0) {
    for (var mi = 0; mi < M.list.length; mi++) {
      var m = M.list[mi];
      if (Math.abs(m.x - P.x) > RAD || Math.abs(m.y - P.y) > RAD) continue;
      var ms = S(m.x, m.y, 0);
      objs.push({ d: m.x + m.y + 0.3, x: ms.x, y: ms.y, f: mobSprite(m) });
    }
  }
  var ps = S(P.x, P.y, pz);
  objs.push({ d: P.x + P.y + 0.35, x: ps.x, y: ps.y, f: playerSprite });

  objs.sort(function (a, b) { return a.d - b.d; });
  for (var oi = 0; oi < objs.length; oi++) objs[oi].f(objs[oi].x, objs[oi].y);

  /* 交互提示 */
  var tgt = findContainer() || findHarvest();
  if (tgt) {
    var tx = tgt.x != null ? tgt.x : (tgt.c ? tgt.c.x : 0);
    var ty = tgt.y != null ? tgt.y : (tgt.c ? tgt.c.y : 0);
    var ts = S(tx + 0.5, ty + 0.5, pz);
    ctx.strokeStyle = '#ffd34d'; ctx.lineWidth = 2;
    ctx.strokeRect(ts.x - NUM.TILE_W / 2 + 6, ts.y - NUM.TILE_H / 2 + 2, NUM.TILE_W - 12, NUM.TILE_H - 4);
    ctx.fillStyle = '#ffd34d'; ctx.font = '13px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('E', ts.x, ts.y - 14);
    ctx.textAlign = 'left';
  }

  /* 光照 */
  this.drawLight(ctx);
};

function entSprite(e) {
  return function (sx, sy) {
    var ctx = R.ctx;
    if (e.type === 'tree') {
      ctx.fillStyle = '#5c3f1f'; ctx.fillRect(sx - 3, sy - 30, 6, 18);
      ctx.fillStyle = '#2d6e34'; ctx.beginPath(); ctx.arc(sx, sy - 38, 22, 0, 7); ctx.fill();
      ctx.fillStyle = '#3e8e46'; ctx.beginPath(); ctx.arc(sx - 8, sy - 44, 14, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.arc(sx + 9, sy - 34, 12, 0, 7); ctx.fill();
      return;
    }
    if (e.type === 'stone') {
      ctx.fillStyle = '#777'; ctx.beginPath(); ctx.ellipse(sx, sy - 3, 11, 5, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#999'; ctx.beginPath(); ctx.ellipse(sx - 3, sy - 5, 5, 3, -0.3, 0, 7); ctx.fill();
      ctx.fillStyle = '#555'; ctx.beginPath(); ctx.ellipse(sx + 3, sy - 2, 4, 2.5, 0.2, 0, 7); ctx.fill();
      return;
    }
    if (e.type === 'herb') {
      ctx.strokeStyle = '#4caf50'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx - 5, sy - 14); ctx.moveTo(sx, sy); ctx.lineTo(sx + 5, sy - 12); ctx.moveTo(sx, sy); ctx.lineTo(sx, sy - 16); ctx.stroke();
      ctx.fillStyle = '#e91e63'; ctx.beginPath(); ctx.arc(sx, sy - 16, 3, 0, 7); ctx.fill();
      return;
    }
    if (e.type === 'cactus') {
      ctx.fillStyle = '#6b8c42'; ctx.fillRect(sx - 5, sy - 26, 10, 22); ctx.fillRect(sx - 10, sy - 18, 6, 5); ctx.fillRect(sx + 4, sy - 22, 6, 5);
      return;
    }
    if (e.type === 'scrapheap') {
      drawBox(ctx, sx, sy, 16, '#6d5c4a', '#4f4234', '#3f3529');
      ctx.strokeStyle = '#8c7b63'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(sx - 8, sy - 8); ctx.lineTo(sx + 8, sy - 4); ctx.stroke();
      return;
    }
    if (e.type === 'mine_ent') {
      ctx.fillStyle = '#0b0b0b';
      ctx.beginPath(); ctx.ellipse(sx, sy, 26, 13, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#8a6a3a'; ctx.fillRect(sx - 26, sy - 8, 52, 5);
      ctx.fillStyle = '#ffd34d'; ctx.font = '12px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('矿井', sx, sy - 16); ctx.textAlign = 'left';
      return;
    }
    if (e.type === 'car') {
      drawBox(R.ctx, sx, sy, 22, '#6b7f8c', '#4a5a66', '#3d4b55'); return;
    }
    var c = CONT[e.type] || CONT.crate;
    var done = W.isSearched(e.id);
    drawBox(ctx, sx, sy, 24, done ? '#5a5348' : '#a8823f', done ? '#453f37' : '#7d5f2c', done ? '#39342d' : '#6a5024');
    if (!done) {
      ctx.fillStyle = '#ffd34d'; ctx.font = '15px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(c.i, sx, sy - 12); ctx.textAlign = 'left';
    }
  };
}
function contSprite(ct) {
  return function (sx, sy) {
    var c = CONT[ct.type] || CONT.crate;
    var done = W.isSearched(ct.id);
    drawBox(R.ctx, sx, sy, 24, done ? '#5a5348' : '#a8823f', done ? '#453f37' : '#7d5f2c', done ? '#39342d' : '#6a5024');
    if (!done) {
      R.ctx.fillStyle = '#ffd34d'; R.ctx.font = '15px sans-serif'; R.ctx.textAlign = 'center';
      R.ctx.fillText(c.i, sx, sy - 12); R.ctx.textAlign = 'left';
    }
  };
}
function buildSprite(b) {
  return function (sx, sy) {
    var ctx = R.ctx;
    var it = ITEMS[b.t];
    if (b.t === 'wall') { drawBox(ctx, sx, sy, 40, '#8a6a3f', '#6b5230', '#5a452a'); return; }
    drawBox(ctx, sx, sy, 18, '#7a6a55', '#5d5040', '#4e4335');
    ctx.font = '20px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(it ? it.i : '?', sx, sy - 8); ctx.textAlign = 'left';
  };
}
function mobSprite(m) {
  return function (sx, sy) {
    var ctx = R.ctx;
    var d = MOBS[m.t];
    ctx.fillStyle = 'rgba(0,0,0,.35)';
    ctx.beginPath(); ctx.ellipse(sx, sy, 12, 6, 0, 0, 7); ctx.fill();
    ctx.font = '22px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(m.hurt > 0 ? '💥' : d.i, sx, sy - 6);
    ctx.textAlign = 'left';
    var w = 26;
    ctx.fillStyle = '#000'; ctx.fillRect(sx - w / 2, sy - 32, w, 4);
    ctx.fillStyle = m.horde ? '#ff6b4a' : '#c0392b';
    ctx.fillRect(sx - w / 2, sy - 32, w * Math.max(0, m.hp / m.max), 4);
  };
}
function playerSprite(sx, sy) {
  var ctx = R.ctx;
  ctx.fillStyle = 'rgba(0,0,0,.4)';
  ctx.beginPath(); ctx.ellipse(sx, sy, 13, 7, 0, 0, 7); ctx.fill();
  ctx.font = '26px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('🧑‍🌾', sx, sy - 8);
  ctx.textAlign = 'left';
  if (ATK.swing > 0) {
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(sx, sy - 10, 26, aimDir() - 0.9, aimDir() + 0.9); ctx.stroke();
  }
}

/* 昼夜光照层 */
R.drawLight = function (ctx) {
  var dark = 0;
  if (P.z < 0) dark = 0.86;
  else if (isNight()) dark = 0.66;
  else if (duskLeft() < NUM.DUSK_WARN) dark = 0.3 * (1 - duskLeft() / NUM.DUSK_WARN);
  if (dark <= 0.02) return;

  var lc = this.lctx;
  if (this.light.width !== this.w || this.light.height !== this.h) {
    this.light.width = this.w; this.light.height = this.h;
  }
  lc.setTransform(1, 0, 0, 1, 0, 0);
  lc.clearRect(0, 0, this.w, this.h);
  lc.fillStyle = P.z < 0 ? 'rgba(0,0,0,1)' : 'rgba(8,12,32,1)';
  lc.fillRect(0, 0, this.w, this.h);

  /* 光圈：玩家（火把/白天视野） */
  lc.globalCompositeOperation = 'destination-out';
  function hole(x, y, r) {
    var g = lc.createRadialGradient(x, y, r * 0.25, x, y, r);
    g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    lc.fillStyle = g;
    lc.beginPath(); lc.arc(x, y, r, 0, 7); lc.fill();
  }
  var W2 = this.w / 2, H2 = this.h / 2;
  var torchR = 210 + (hasTool(6) ? 130 : 0);
  hole(W2, H2 - 20, P.z < 0 ? torchR * 1.15 : torchR);
  /* 营火与熔炉 */
  var camX = isoX(P.x, P.y), camY = isoY(P.x, P.y, P.z);
  for (var i = 0; i < W.builds.length; i++) {
    var b = W.builds[i];
    if (b.z !== P.z) continue;
    var rr = (b.t === 'forge' || b.t === 'camp') ? 150 : 90;
    var bx = isoX(b.x + 0.5, b.y + 0.5) - camX + W2;
    var by = isoY(b.x + 0.5, b.y + 0.5, b.z) - camY + H2;
    if (bx > -rr && bx < this.w + rr && by > -rr && by < this.h + rr) hole(bx, by, rr);
  }
  lc.globalCompositeOperation = 'source-over';

  ctx.save();
  ctx.globalAlpha = dark;
  ctx.drawImage(this.light, 0, 0);
  ctx.restore();
};
