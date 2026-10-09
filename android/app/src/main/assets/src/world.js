/* 世界：分块流式生成 / 房屋 / 容器 / 地下矿井 / 差异持久化
   6400 万格不驻留内存：世界由种子推演，只存玩家改动过的差异（diff）。 */
var W = {
  seed: 12345,
  chunks: new Map(),     /* "cx,cy"      -> 地表块 */
  under: new Map(),      /* "cx,cy,z"    -> 地下块 */
  diff: new Map(),       /* "x,y,z"      -> tile 值（地表采集/地下挖掘的改动） */
  searched: new Set(),   /* 已搜索容器 id */
  builds: [],            /* 玩家建造 [{x,y,z,t}] */
  genQueue: [],
  stats: { chunkGen: 0, chunks: 0 },

  init: function (seed) {
    this.seed = seed >>> 0;
    this.chunks.clear(); this.under.clear(); this.diff.clear();
    this.searched.clear(); this.builds = []; this.genQueue = [];
    this.stats.chunkGen = 0;
  },

  key: function (cx, cy) { return cx + ',' + cy; },

  /* ---------- 地形 ---------- */
  genTile: function (x, y) {
    var e = fbm(x / 62, y / 62, this.seed, 4);
    var m = fbm((x + 900) / 46, (y + 900) / 46, this.seed + 77, 3);
    /* 世界中心隆起：半径 900 的大陆，确保出生点不在孤岛上 */
    var d = Math.hypot(x - NUM.WORLD / 2, y - NUM.WORLD / 2);
    e += Math.max(0, 1 - d / 900) * 0.28;
    if (e < 0.33) return T.DEEP;
    if (e < 0.385) return T.WATER;
    if (e < 0.44) return T.SAND;
    if (e > 0.715) return T.ROCK;
    if ((x % 96 === 0 || y % 96 === 0) && m > 0.42) return T.ROAD;
    if (m > 0.35) return T.FOREST;
    if (m > 0.18) return T.GRASS;
    return T.RUBBLE;
  },
  tileRaw: function (x, y) {
    if (x < 0 || y < 0 || x >= NUM.WORLD || y >= NUM.WORLD) return T.ROCK;
    var d = this.diff.get(x + ',' + y + ',0');
    if (d !== undefined) return d;
    var c = this.chunk(Math.floor(x / NUM.CHUNK), Math.floor(y / NUM.CHUNK));
    if (!c) return this.genTile(x, y);
    return c.tiles[(y % NUM.CHUNK) * NUM.CHUNK + (x % NUM.CHUNK)];
  },
  /* 地表可站立 */
  walkable: function (x, y) {
    var t = this.tileRaw(x, y);
    return t !== T.DEEP && t !== T.WATER && t !== T.ROCK;
  },

  /* ---------- 地表块 ---------- */
  chunk: function (cx, cy) {
    var k = this.key(cx, cy), c = this.chunks.get(k);
    if (c) return c;
    if (cx < 0 || cy < 0 || cx * NUM.CHUNK >= NUM.WORLD || cy * NUM.CHUNK >= NUM.WORLD) return null;
    return null; /* 由 ensure 预生成，避免同步生成造成卡顿 */
  },
  makeChunk: function (cx, cy) {
    var k = this.key(cx, cy);
    var c = this.chunks.get(k);
    if (c) return c;
    var n = NUM.CHUNK, tiles = new Uint8Array(n * n), bx = cx * n, by = cy * n;
    for (var y = 0; y < n; y++) for (var x = 0; x < n; x++) tiles[y * n + x] = this.genTile(bx + x, by + y);
    c = { cx: cx, cy: cy, tiles: tiles, houses: [], ents: [] };
    this.genHouses(c);
    this.genEnts(c);
    this.chunks.set(k, c);
    this.stats.chunkGen++; this.stats.chunks = this.chunks.size;
    return c;
  },

  /* ---------- 房屋随机生成 ---------- */
  genHouses: function (c) {
    var rng = mkRng((c.cx * 73856093 ^ c.cy * 19349663 ^ this.seed) >>> 0);
    var n = NUM.CHUNK, count = rng() < 0.62 ? (rng() < 0.35 ? 2 : 1) : 0;
    if (count === 0) count = 1; /* 每块至少尝试一幢房子 */
    for (var i = 0; i < count; i++) {
      var w = 5 + Math.floor(rng() * 4), h = 5 + Math.floor(rng() * 4);
      var hx = 2 + Math.floor(rng() * (n - w - 4)), hy = 2 + Math.floor(rng() * (n - h - 4));
      var ok = true;
      for (var yy = -1; yy <= h && ok; yy++) for (var xx = -1; xx <= w && ok; xx++) {
        var tt = this.genTile(c.cx * n + hx + xx, c.cy * n + hy + yy);
        if (tt === T.DEEP || tt === T.WATER || tt === T.ROCK) ok = false;
      }
      if (!ok) continue;
      var floors = 1 + (rng() < 0.45 ? 1 : 0) + (rng() < 0.18 ? 1 : 0);
      c.houses.push(this.makeHouse(c, hx, hy, w, h, floors, rng, i));
    }
  },
  makeHouse: function (c, hx, hy, w, h, floors, rng, hi) {
    var fl = [];
    for (var z = 0; z < floors; z++) {
      var cells = new Uint8Array(w * h), conts = [];
      for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
        var edge = (x === 0 || y === 0 || x === w - 1 || y === h - 1);
        cells[y * w + x] = edge ? 2 : 1;
      }
      /* 门：底层外边中间 */
      if (z === 0) {
        var side = Math.floor(rng() * 4), dx, dy;
        if (side === 0) { dx = 1 + Math.floor(rng() * (w - 2)); dy = h - 1; }
        else if (side === 1) { dx = 1 + Math.floor(rng() * (w - 2)); dy = 0; }
        else if (side === 2) { dx = w - 1; dy = 1 + Math.floor(rng() * (h - 2)); }
        else { dx = 0; dy = 1 + Math.floor(rng() * (h - 2)); }
        cells[dy * w + dx] = 3;
      }
      /* 楼梯：非顶层放置上楼梯；非底层同一位置放标识 */
      var stair = -1;
      if (floors > 1) {
        var sx = 1 + Math.floor(rng() * (w - 2)), sy = 1 + Math.floor(rng() * (h - 2));
        if (z < floors - 1) { cells[sy * w + sx] = 4; stair = sy * w + sx; }
        else stair = sy * w + sx;
      }
      /* 容器 */
      var cn = 2 + Math.floor(rng() * 4);
      for (var ci = 0; ci < cn; ci++) {
        var px = 1 + Math.floor(rng() * (w - 2)), py = 1 + Math.floor(rng() * (h - 2));
        var idx = py * w + px;
        if (cells[idx] !== 1) continue;
        var pool = ['cabinet', 'fridge', 'crate', 'drawer', 'locker', 'medbox'];
        if (rng() < 0.12) pool = ['safe'];
        var type = pool[Math.floor(rng() * pool.length)];
        conts.push({ idx: idx, x: px, y: py, type: type, id: 'H' + c.cx + '_' + c.cy + '_' + hi + '_' + z + '_' + idx });
      }
      fl.push({ w: w, h: h, cells: cells, conts: conts, stair: stair });
    }
    return { x: hx, y: hy, w: w, h: h, floors: fl };
  },
  genEnts: function (c) {
    var rng = mkRng((c.cx * 83492791 ^ c.cy * 2971215073 ^ this.seed + 5) >>> 0);
    var n = NUM.CHUNK, cnt = 2 + Math.floor(rng() * 4);
    for (var i = 0; i < cnt; i++) {
      var x = c.cx * n + Math.floor(rng() * n), y = c.cy * n + Math.floor(rng() * n);
      var t = this.genTile(x, y);
      if (t === T.DEEP || t === T.WATER) continue;
      if (this.houseFloor(x, y, 0)) continue; /* 不要和房屋 footprint 重叠 */
      var pool = t === T.RUBBLE ? ['crate', 'barrel', 'car', 'scrapheap'] : ['barrel', 'crate'];
      c.ents.push({ x: x, y: y, type: pool[Math.floor(rng() * pool.length)], id: 'E' + c.cx + '_' + c.cy + '_' + i });
    }
    /* 矿井入口 */
    if (rng() < 0.22) {
      var mx = c.cx * n + 4 + Math.floor(rng() * (n - 8)), my = c.cy * n + 4 + Math.floor(rng() * (n - 8));
      var mt = this.genTile(mx, my);
      if (mt !== T.DEEP && mt !== T.WATER && mt !== T.ROCK) {
        c.ents.push({ x: mx, y: my, type: 'mine_ent', id: 'M' + c.cx + '_' + c.cy });
      }
    }
    /* 地表资源节点：树、石、草药、废料堆、仙人掌 */
    for (var ry = 0; ry < n; ry++) for (var rx = 0; rx < n; rx++) {
      var tx = c.cx * n + rx, ty = c.cy * n + ry;
      var tt = c.tiles[ry * n + rx];
      if (tt === T.DEEP || tt === T.WATER || tt === T.ROCK) continue;
      if (this.houseFloor(tx, ty, 0)) continue;
      var kind = null;
      if (tt === T.FOREST && rng() < 0.26) kind = 'tree';
      else if (tt === T.GRASS && rng() < 0.022) kind = rng() < 0.45 ? 'stone' : 'herb';
      else if (tt === T.RUBBLE && rng() < 0.012) kind = 'scrapheap';
      else if (tt === T.SAND && rng() < 0.04) kind = 'cactus';
      if (!kind) continue;
      c.ents.push({ x: tx, y: ty, type: kind, id: 'R' + c.cx + '_' + c.cy + '_' + rx + '_' + ry + '_' + kind });
    }
  },

  /* ---------- 房屋查询 ---------- */
  houseFloor: function (x, y, z) {
    var cx = Math.floor(x / NUM.CHUNK), cy = Math.floor(y / NUM.CHUNK);
    var c = this.chunks.get(this.key(cx, cy));
    if (!c) return null;
    for (var i = 0; i < c.houses.length; i++) {
      var h = c.houses[i], lx = x - (cx * NUM.CHUNK + h.x), ly = y - (cy * NUM.CHUNK + h.y);
      if (lx >= 0 && ly >= 0 && lx < h.w && ly < h.h) {
        if (z < 0 || z >= h.floors.length) return null;
        return { h: h, f: h.floors[z], lx: lx, ly: ly, idx: ly * h.w + lx, hi: i };
      }
    }
    return null;
  },
  contAt: function (x, y, z) {
    if (z === 0) {
      var cx = Math.floor(x / NUM.CHUNK), cy = Math.floor(y / NUM.CHUNK);
      var c = this.chunks.get(this.key(cx, cy));
      if (!c) return null;
      for (var i = 0; i < c.ents.length; i++) {
        var e = c.ents[i];
        if (e.x === x && e.y === y && e.type !== 'mine_ent') return { id: e.id, type: e.type, x: x, y: y, z: 0 };
      }
      for (var b = 0; b < this.builds.length; b++) {
        var bd = this.builds[b];
        if (bd.x === x && bd.y === y && bd.z === 0 && bd.t !== 'mine_ent' && bd.t !== 'camp' &&
            bd.t !== 'bench' && bd.t !== 'forge' && bd.t !== 'alchemy' && bd.t !== 'enchant' && bd.t !== 'wall') {
          return { id: 'B' + b, type: bd.t, x: x, y: y, z: 0 };
        }
      }
      return null;
    }
    var hf = this.houseFloor(x, y, z);
    if (!hf) return null;
    for (var k = 0; k < hf.f.conts.length; k++) {
      var ct = hf.f.conts[k];
      if (ct.idx === hf.idx) return { id: ct.id, type: ct.type, x: x, y: y, z: z };
    }
    return null;
  },
  isSearched: function (id) { return this.searched.has(id); },
  markSearched: function (id) { this.searched.add(id); },

  /* ---------- 地下 ---------- */
  underChunk: function (cx, cy, z) {
    var k = cx + ',' + cy + ',' + z, c = this.under.get(k);
    if (c) return c;
    var n = NUM.CHUNK, cells = new Uint8Array(n * n), bx = cx * n, by = cy * n;
    var depth = -z;
    for (var y = 0; y < n; y++) for (var x = 0; x < n; x++) {
      var v = fbm((bx + x) / 22, (by + y) / 22, this.seed + 400 + depth * 31, 3);
      var ore = v > 0.74;
      var cave = fbm((bx + x + 500) / 30, (by + y + 500) / 30, this.seed + 900, 2) > 0.78;
      cells[y * n + x] = ore ? 2 : (cave ? 1 : 0);
    }
    c = { cx: cx, cy: cy, z: z, cells: cells };
    this.under.set(k, c);
    return c;
  },
  /* 地下格：0 岩石 1 通道 2 矿脉 3 竖井 */
  underAt: function (x, y, z) {
    var d = this.diff.get(x + ',' + y + ',' + z);
    if (d !== undefined) return d;
    var c = this.underChunk(Math.floor(x / NUM.CHUNK), Math.floor(y / NUM.CHUNK), z);
    var v = c.cells[(y % NUM.CHUNK) * NUM.CHUNK + (x % NUM.CHUNK)];
    /* 矿井入口正下方是竖井 */
    var ent = this.mineEntranceNear(x, y);
    if (ent && ent.x === x && ent.y === y) return 3;
    return v;
  },
  setUnder: function (x, y, z, v) {
    this.diff.set(x + ',' + y + ',' + z, v);
    var c = this.under.get(Math.floor(x / NUM.CHUNK) + ',' + Math.floor(y / NUM.CHUNK) + ',' + z);
    if (c) c.cells[(y % NUM.CHUNK) * NUM.CHUNK + (x % NUM.CHUNK)] = v;
  },
  mineEntranceNear: function (x, y) {
    var cx = Math.floor(x / NUM.CHUNK), cy = Math.floor(y / NUM.CHUNK);
    for (var ox = -1; ox <= 1; ox++) for (var oy = -1; oy <= 1; oy++) {
      var c = this.chunks.get(this.key(cx + ox, cy + oy));
      if (!c) continue;
      for (var i = 0; i < c.ents.length; i++) if (c.ents[i].type === 'mine_ent' && c.ents[i].x === x && c.ents[i].y === y) return c.ents[i];
    }
    for (var b = 0; b < this.builds.length; b++) if (this.builds[b].t === 'mine_ent' && this.builds[b].x === x && this.builds[b].y === y) return this.builds[b];
    return null;
  },

  /* ---------- 建造 ---------- */
  buildAt: function (x, y, z) {
    for (var i = 0; i < this.builds.length; i++) {
      var b = this.builds[i];
      if (b.x === x && b.y === y && b.z === z) return b;
    }
    return null;
  },
  addBuild: function (x, y, z, t) {
    this.builds.push({ x: x, y: y, z: z, t: t });
  },
  removeEnt: function (x, y, z) {
    if (z === 0) {
      var cx = Math.floor(x / NUM.CHUNK), cy = Math.floor(y / NUM.CHUNK);
      var c = this.chunks.get(this.key(cx, cy));
      if (c) for (var i = 0; i < c.ents.length; i++) {
        if (c.ents[i].x === x && c.ents[i].y === y) { c.ents.splice(i, 1); return; }
      }
    } else {
      var hf = this.houseFloor(x, y, z);
      if (hf) for (var k = 0; k < hf.f.conts.length; k++) {
        var ct = hf.f.conts[k];
        if (ct.x === x && ct.y === y) { hf.f.conts.splice(k, 1); return; }
      }
    }
  },

  /* ---------- 通行判定 ---------- */
  solid: function (x, y, z) {
    if (z === 0) {
      if (!this.walkable(x, y)) return true;
      var b = this.buildAt(x, y, 0);
      if (b && b.t === 'wall') return true;
      var hf = this.houseFloor(x, y, 0);
      if (hf) {
        var v = hf.f.cells[hf.idx];
        return v === 2; /* 墙不可通行 */
      }
      return false;
    }
    var u = this.underAt(x, y, z);
    return u === 0 || u === 2; /* 岩石/矿脉未挖开 */
  },

  /* ---------- 分帧流式生成 ---------- */
  ensureAround: function (px, py, pz) {
    var cx = Math.floor(px / NUM.CHUNK), cy = Math.floor(py / NUM.CHUNK), r = NUM.VIEW_R;
    this.genQueue.length = 0;
    for (var oy = -r; oy <= r; oy++) for (var ox = -r; ox <= r; ox++) {
      var x = cx + ox, y = cy + oy;
      if (x < 0 || y < 0 || x * NUM.CHUNK >= NUM.WORLD || y * NUM.CHUNK >= NUM.WORLD) continue;
      if (!this.chunks.has(this.key(x, y))) this.genQueue.push([x, y]);
    }
    if (pz < 0) {
      for (var d = 1; d <= 3; d++) {
        var k = cx + ',' + cy + ',' + (-d);
        if (!this.under.has(k)) this.underChunk(cx, cy, -d);
      }
    }
    /* 卸载远距离块，控制内存 */
    if (this.chunks.size > 260) {
      var lim = (r + 3) * (r + 3);
      for (var kk of this.chunks.keys()) {
        var p = kk.split(','), dx = (+p[0]) - cx, dy = (+p[1]) - cy;
        if (dx * dx + dy * dy > lim) this.chunks.delete(kk);
      }
    }
  },
  /* 每帧最多生成 2 块，避免卡顿 */
  pump: function (budgetMs) {
    var t0 = (performance && performance.now) ? performance.now() : Date.now();
    while (this.genQueue.length) {
      var it = this.genQueue.shift();
      this.makeChunk(it[0], it[1]);
      var now = (performance && performance.now) ? performance.now() : Date.now();
      if (now - t0 > (budgetMs || 6)) break;
    }
  },

  /* ---------- 存档（只存差异） ---------- */
  save: function () {
    var d = {}, n = 0;
    this.diff.forEach(function (v, k) { d[k] = v; n++; });
    return {
      seed: this.seed, diff: d, diffN: n,
      searched: Array.from(this.searched), builds: this.builds
    };
  },
  load: function (o) {
    if (!o) return;
    this.init(o.seed);
    this.builds = o.builds || [];
    (o.searched || []).forEach(function (id) { W.searched.add(id); });
    for (var k in (o.diff || {})) this.diff.set(k, o.diff[k]);
  }
};
