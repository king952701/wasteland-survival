/* 数值常量表 —— 单一数值来源 */
var NUM = {
  WORLD: 8000,            /* 地图边长（格） */
  CHUNK: 64,              /* 分块边长 */
  VIEW_R: 3,              /* 视口加载半径（chunk） */
  TILE_W: 64, TILE_H: 32, /* 等距 2:1 瓦片 */
  Z_H: 40,                /* 每层高度（像素） */

  DAY_SEC: 720,           /* 白天 12 分钟 */
  NIGHT_SEC: 480,         /* 夜晚 8 分钟 */
  DUSK_WARN: 90,          /* 天黑前预警秒数 */

  PLAYER_SPD: 4.2,        /* 格/秒 */
  RUN_SPD: 6.4,
  STAMINA_MAX: 100,
  STAMINA_RUN: 12,        /* 每秒消耗 */
  STAMINA_REGEN: 8,
  HP_MAX: 100,
  HUNGER_MAX: 100,
  HUNGER_RATE: 0.55,      /* 每秒饥饿增长（约 3 分钟掉 100） */

  SEARCH_SEC: 1.5,        /* 容器搜索耗时 */
  MINE_SEC: 2.2,          /* 挖矿耗时 */
  FISH_MIN: 3, FISH_MAX: 9,

  INV_SLOTS: 24,
  REACH: 1.6,             /* 交互距离（格） */
  ATTACK_RANGE: 1.8,
  ATTACK_ARC: 1.9,        /* 扇形弧度 */

  MOB_DAY: 14,            /* 白天同时存活上限 */
  MOB_NIGHT: 46,
  MOB_SPAWN_R: 26,        /* 生成半径 */
  MOB_DESPAWN_R: 60,
  HORDE_SIZE: 26,         /* 尸潮单次波次 */

  SAVE_VER: 1,
  AUTOSAVE: 20            /* 秒 */
};

/* 地形枚举 */
var T = { DEEP: 0, WATER: 1, SAND: 2, GRASS: 3, FOREST: 4, RUBBLE: 5, ROCK: 6, ROAD: 7 };

/* ---------- 确定性随机 ---------- */
function hash2(x, y, s) {
  var h = x * 374761393 + y * 668265263 + (s || 0) * 2147483647;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) / 4294967296;
}
function vnoise(x, y, s) {
  var xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  var u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  var a = hash2(xi, yi, s), b = hash2(xi + 1, yi, s);
  var c = hash2(xi, yi + 1, s), d = hash2(xi + 1, yi + 1, s);
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}
function fbm(x, y, s, oct) {
  var v = 0, amp = 0.5, f = 1, norm = 0;
  for (var i = 0; i < (oct || 4); i++) { v += vnoise(x * f, y * f, s + i * 17) * amp; norm += amp; amp *= 0.5; f *= 2; }
  return v / norm;
}
/* 可播种的伪随机序列（房屋生成等） */
function mkRng(seed) {
  var st = (seed >>> 0) || 1;
  return function () {
    st ^= st << 13; st >>>= 0; st ^= st >> 17; st ^= st << 5; st >>>= 0;
    return st / 4294967296;
  };
}

/* ---------- 物品 ---------- */
var ITEMS = {
  wood:      { n: '木材', i: '🪵', c: 'mat' },
  stone:     { n: '石块', i: '🪨', c: 'mat' },
  fiber:     { n: '植物纤维', i: '🌿', c: 'mat' },
  scrap:     { n: '废金属', i: '🔩', c: 'mat' },
  iron_ore:  { n: '铁矿石', i: '🟤', c: 'mat' },
  coal:      { n: '煤', i: '⬛', c: 'mat' },
  gold_ore:  { n: '金矿石', i: '🟡', c: 'mat' },
  crystal:   { n: '晶石', i: '💎', c: 'mat' },
  iron_bar:  { n: '铁锭', i: '🧱', c: 'mat' },
  steel_bar: { n: '钢锭', i: '⬜', c: 'mat' },
  leather:   { n: '皮革', i: '🟫', c: 'mat' },
  cloth:     { n: '布片', i: '🧵', c: 'mat' },
  chem:      { n: '化学品', i: '🧪', c: 'mat' },
  herb:      { n: '草药', i: '🌱', c: 'mat' },

  canned:    { n: '罐头', i: '🥫', c: 'food', use: { hp: 12, hunger: 30 } },
  berry:     { n: '浆果', i: '🫐', c: 'food', use: { hp: 5, hunger: 12 } },
  fish_raw:  { n: '生鱼', i: '🐟', c: 'food', use: { hp: 3, hunger: 10 } },
  fish_cook: { n: '烤鱼', i: '🍢', c: 'food', use: { hp: 18, hunger: 38 } },
  water_d:   { n: '脏水', i: '💧', c: 'food', use: { hp: -6, thirst: 20 } },
  water_c:   { n: '净水', i: '🥤', c: 'food', use: { hp: 4, thirst: 40 } },

  bandage:   { n: '绷带', i: '🩹', c: 'use', use: { hp: 25 } },
  medkit:    { n: '医疗包', i: '🧰', c: 'use', use: { hp: 60 } },
  stim:      { n: '兴奋剂', i: '💉', c: 'use', use: { stam: 80, buff: 'spd' } },
  antidote:  { n: '解毒剂', i: '🍶', c: 'use', use: { hp: 10, cure: 1 } },

  axe_stone: { n: '石斧', i: '🪓', c: 'tool', tool: 1, dmg: 8 },
  pick_stone:{ n: '石镐', i: '⛏️', c: 'tool', tool: 2, dmg: 6 },
  axe_iron:  { n: '铁斧', i: '🪓', c: 'tool', tool: 3, dmg: 16 },
  pick_iron: { n: '铁镐', i: '⛏️', c: 'tool', tool: 4, dmg: 13 },
  rod:       { n: '钓竿', i: '🎣', c: 'tool', tool: 5, dmg: 2 },
  torch:     { n: '火把', i: '🔦', c: 'tool', tool: 6, dmg: 4 },

  knife:     { n: '小刀', i: '🔪', c: 'weap', w: 1, dmg: 10, spd: 1.5 },
  bat:       { n: '球棒', i: '🏏', c: 'weap', w: 1, dmg: 14, spd: 0.9 },
  spear:     { n: '长矛', i: '🔱', c: 'weap', w: 1, dmg: 20, spd: 0.8 },
  sword_iron:{ n: '铁剑', i: '🗡️', c: 'weap', w: 1, dmg: 30, spd: 1.0 },
  sword_steel:{n: '钢剑', i: '⚔️', c: 'weap', w: 1, dmg: 46, spd: 1.1 },
  pistol:    { n: '手枪', i: '🔫', c: 'weap', w: 2, dmg: 40, spd: 1.6, ranged: 1 },
  ammo:      { n: '子弹', i: '🎯', c: 'mat' },

  hat_l:     { n: '皮帽', i: '🧢', c: 'arm', s: 'head', def: 4 },
  chest_l:   { n: '皮甲', i: '🧥', c: 'arm', s: 'chest', def: 10 },
  legs_l:    { n: '皮裤', i: '👖', c: 'arm', s: 'legs', def: 7 },
  boots_l:   { n: '皮靴', i: '🥾', c: 'arm', s: 'feet', def: 4 },
  helm_i:    { n: '铁盔', i: '⛑️', c: 'arm', s: 'head', def: 10 },
  chest_i:   { n: '铁甲', i: '🦺', c: 'arm', s: 'chest', def: 24 },
  legs_i:    { n: '铁护腿', i: '🛡️', c: 'arm', s: 'legs', def: 16 },
  boots_i:   { n: '铁靴', i: '👢', c: 'arm', s: 'feet', def: 9 },
  chest_s:   { n: '钢胸甲', i: '🥋', c: 'arm', s: 'chest', def: 40 },

  camp:      { n: '营地', i: '⛺', c: 'build' },
  bench:     { n: '工作台', i: '🪚', c: 'build' },
  forge:     { n: '熔炉', i: '🔥', c: 'build' },
  alchemy:   { n: '炼金台', i: '⚗️', c: 'build' },
  enchant:   { n: '附魔台', i: '✨', c: 'build' },
  wall:      { n: '木墙', i: '🚧', c: 'build' },
  mine_ent:  { n: '矿井入口', i: '🕳️', c: 'build' }
};

/* 装备槽 */
var SLOTS = ['weapon', 'head', 'chest', 'legs', 'feet'];
var SLOT_N = { weapon: '武器', head: '头部', chest: '胸甲', legs: '腿部', feet: '足部' };

/* ---------- 配方 ---------- */
/* st: none | bench | forge | alchemy | enchant */
var RECIPES = [
  { id: 'r_plank', o: ['wood', 2], in: [['wood', 1]], st: 'none', t: '劈木材' },
  { id: 'r_rope', o: ['fiber', 1], in: [['fiber', 1]], st: 'none', t: '搓绳（占位）', hide: 1 },
  { id: 'r_cloth', o: ['cloth', 1], in: [['fiber', 3]], st: 'bench' },
  { id: 'r_axe_s', o: ['axe_stone', 1], in: [['wood', 5], ['stone', 4]], st: 'none' },
  { id: 'r_pick_s', o: ['pick_stone', 1], in: [['wood', 5], ['stone', 6]], st: 'none' },
  { id: 'r_axe_i', o: ['axe_iron', 1], in: [['wood', 4], ['iron_bar', 3]], st: 'forge' },
  { id: 'r_pick_i', o: ['pick_iron', 1], in: [['wood', 4], ['iron_bar', 4]], st: 'forge' },
  { id: 'r_rod', o: ['rod', 1], in: [['wood', 6], ['cloth', 2]], st: 'bench' },
  { id: 'r_torch', o: ['torch', 1], in: [['wood', 2], ['cloth', 1]], st: 'none' },

  { id: 'r_iron', o: ['iron_bar', 1], in: [['iron_ore', 2], ['coal', 1]], st: 'forge' },
  { id: 'r_steel', o: ['steel_bar', 1], in: [['iron_bar', 2], ['coal', 2]], st: 'forge' },

  { id: 'r_knife', o: ['knife', 1], in: [['scrap', 3], ['wood', 1]], st: 'bench' },
  { id: 'r_bat', o: ['bat', 1], in: [['wood', 6], ['cloth', 2]], st: 'bench' },
  { id: 'r_spear', o: ['spear', 1], in: [['wood', 5], ['scrap', 3]], st: 'bench' },
  { id: 'r_sword_i', o: ['sword_iron', 1], in: [['iron_bar', 6], ['leather', 2]], st: 'forge' },
  { id: 'r_sword_s', o: ['sword_steel', 1], in: [['steel_bar', 6], ['leather', 3]], st: 'forge' },
  { id: 'r_pistol', o: ['pistol', 1], in: [['scrap', 8], ['steel_bar', 3]], st: 'forge' },
  { id: 'r_ammo', o: ['ammo', 5], in: [['scrap', 2], ['chem', 1]], st: 'forge' },

  { id: 'r_hat', o: ['hat_l', 1], in: [['leather', 3]], st: 'bench' },
  { id: 'r_chest_l', o: ['chest_l', 1], in: [['leather', 8]], st: 'bench' },
  { id: 'r_legs_l', o: ['legs_l', 1], in: [['leather', 6]], st: 'bench' },
  { id: 'r_boots_l', o: ['boots_l', 1], in: [['leather', 4]], st: 'bench' },
  { id: 'r_helm_i', o: ['helm_i', 1], in: [['iron_bar', 4]], st: 'forge' },
  { id: 'r_chest_i', o: ['chest_i', 1], in: [['iron_bar', 10]], st: 'forge' },
  { id: 'r_legs_i', o: ['legs_i', 1], in: [['iron_bar', 7]], st: 'forge' },
  { id: 'r_boots_i', o: ['boots_i', 1], in: [['iron_bar', 4]], st: 'forge' },
  { id: 'r_chest_s', o: ['chest_s', 1], in: [['steel_bar', 10], ['leather', 4]], st: 'forge' },

  { id: 'r_bandage', o: ['bandage', 2], in: [['cloth', 2], ['herb', 1]], st: 'alchemy' },
  { id: 'r_medkit', o: ['medkit', 1], in: [['bandage', 2], ['chem', 2], ['herb', 2]], st: 'alchemy' },
  { id: 'r_stim', o: ['stim', 1], in: [['chem', 3], ['herb', 2]], st: 'alchemy' },
  { id: 'r_antidote', o: ['antidote', 1], in: [['herb', 4], ['chem', 1]], st: 'alchemy' },
  { id: 'r_water', o: ['water_c', 2], in: [['water_d', 2], ['chem', 1]], st: 'alchemy' },
  { id: 'r_cook', o: ['fish_cook', 1], in: [['fish_raw', 1], ['wood', 1]], st: 'forge' },

  { id: 'r_camp', o: ['camp', 1], in: [['wood', 12], ['cloth', 4]], st: 'none' },
  { id: 'r_bench', o: ['bench', 1], in: [['wood', 20], ['scrap', 4]], st: 'none' },
  { id: 'r_forge', o: ['forge', 1], in: [['stone', 20], ['wood', 10]], st: 'bench' },
  { id: 'r_alch', o: ['alchemy', 1], in: [['wood', 8], ['scrap', 6], ['chem', 2]], st: 'bench' },
  { id: 'r_ench', o: ['enchant', 1], in: [['stone', 12], ['crystal', 3]], st: 'bench' },
  { id: 'r_wall', o: ['wall', 3], in: [['wood', 4]], st: 'bench' },
  { id: 'r_mine', o: ['mine_ent', 1], in: [['wood', 10], ['stone', 8]], st: 'bench' }
];
var STATION_N = { none: '徒手', bench: '工作台', forge: '熔炉', alchemy: '炼金台', enchant: '附魔台' };

/* ---------- 附魔词缀 ---------- */
var AFFIXES = [
  { id: 'sharp', n: '锋利', stat: 'dmg', v: 5, cost: 1 },
  { id: 'heavy', n: '沉重', stat: 'dmg', v: 10, cost: 2 },
  { id: 'guard', n: '守护', stat: 'def', v: 5, cost: 1 },
  { id: 'bulwark', n: '壁垒', stat: 'def', v: 11, cost: 2 },
  { id: 'swift', n: '迅捷', stat: 'spd', v: 0.12, cost: 1 },
  { id: 'vamp', n: '吸血', stat: 'leech', v: 0.08, cost: 3 }
];

/* ---------- 容器类型与 loot ---------- */
var CONT = {
  cabinet: { n: '橱柜', i: '🗄️', loot: 'kitchen' },
  fridge:  { n: '冰箱', i: '🧊', loot: 'kitchen' },
  crate:   { n: '木箱', i: '📦', loot: 'store' },
  drawer:  { n: '抽屉', i: '🗃️', loot: 'bedroom' },
  locker:  { n: '储物柜', i: '🔐', loot: 'tool' },
  medbox:  { n: '医药箱', i: '🧰', loot: 'med' },
  safe:    { n: '保险箱', i: '💰', loot: 'rare' },
  car:     { n: '废弃车辆', i: '🚗', loot: 'car' },
  barrel:  { n: '油桶', i: '🛢️', loot: 'store' }
};
/* loot 表：[{i:物品, w:权重, min, max}] */
var LOOT = {
  kitchen: [
    { i: 'canned', w: 30, min: 1, max: 2 }, { i: 'water_d', w: 22, min: 1, max: 2 },
    { i: 'berry', w: 14, min: 1, max: 3 }, { i: 'herb', w: 10, min: 1, max: 2 },
    { i: 'cloth', w: 12, min: 1, max: 2 }, { i: 'scrap', w: 8, min: 1, max: 1 }
  ],
  bedroom: [
    { i: 'cloth', w: 28, min: 1, max: 3 }, { i: 'leather', w: 14, min: 1, max: 2 },
    { i: 'berry', w: 10, min: 1, max: 2 }, { i: 'ammo', w: 8, min: 1, max: 5 },
    { i: 'bandage', w: 10, min: 1, max: 1 }, { i: 'canned', w: 12, min: 1, max: 1 }
  ],
  store: [
    { i: 'wood', w: 26, min: 2, max: 5 }, { i: 'scrap', w: 24, min: 1, max: 4 },
    { i: 'stone', w: 18, min: 2, max: 4 }, { i: 'coal', w: 12, min: 1, max: 3 },
    { i: 'chem', w: 10, min: 1, max: 2 }, { i: 'herb', w: 10, min: 1, max: 2 }
  ],
  tool: [
    { i: 'scrap', w: 26, min: 1, max: 4 }, { i: 'axe_stone', w: 8, min: 1, max: 1 },
    { i: 'pick_stone', w: 8, min: 1, max: 1 }, { i: 'knife', w: 7, min: 1, max: 1 },
    { i: 'bat', w: 7, min: 1, max: 1 }, { i: 'ammo', w: 14, min: 2, max: 8 },
    { i: 'iron_ore', w: 12, min: 1, max: 3 }
  ],
  med: [
    { i: 'bandage', w: 30, min: 1, max: 2 }, { i: 'medkit', w: 12, min: 1, max: 1 },
    { i: 'antidote', w: 14, min: 1, max: 1 }, { i: 'chem', w: 18, min: 1, max: 2 },
    { i: 'herb', w: 20, min: 1, max: 3 }
  ],
  rare: [
    { i: 'crystal', w: 24, min: 1, max: 2 }, { i: 'gold_ore', w: 24, min: 1, max: 3 },
    { i: 'pistol', w: 8, min: 1, max: 1 }, { i: 'sword_iron', w: 10, min: 1, max: 1 },
    { i: 'medkit', w: 16, min: 1, max: 2 }, { i: 'ammo', w: 18, min: 5, max: 14 }
  ],
  car: [
    { i: 'scrap', w: 32, min: 1, max: 4 }, { i: 'chem', w: 16, min: 1, max: 2 },
    { i: 'ammo', w: 12, min: 1, max: 6 }, { i: 'canned', w: 14, min: 1, max: 1 },
    { i: 'coal', w: 12, min: 1, max: 2 }, { i: 'torch', w: 6, min: 1, max: 1 }
  ]
};

/* ---------- 鱼类 ---------- */
var FISH = [
  { i: 'fish_raw', n: '鲫鱼', w: 40 }, { i: 'fish_raw', n: '鲈鱼', w: 26 },
  { i: 'fish_raw', n: '鲶鱼', w: 16 }, { i: 'crystal', n: '发光晶簇', w: 6 },
  { i: 'scrap', n: '沉底铁皮', w: 12 }
];

/* ---------- 敌人 ---------- */
var MOBS = {
  walker:  { n: '行尸', i: '🧟', hp: 42, dmg: 9, spd: 1.5, xp: 6, drop: 'cloth', dr: 0.35 },
  runner:  { n: '疾行者', i: '🏃', hp: 30, dmg: 12, spd: 3.1, xp: 11, drop: 'scrap', dr: 0.3 },
  brute:   { n: '暴徒', i: '👹', hp: 130, dmg: 24, spd: 1.2, xp: 30, drop: 'iron_bar', dr: 0.5 },
  crawler: { n: '爬行者', i: '🐍', hp: 24, dmg: 7, spd: 2.2, xp: 8, drop: 'herb', dr: 0.25 }
};

/* ---------- 地下矿脉 ---------- */
var ORES = [
  { i: 'stone', w: 34 }, { i: 'coal', w: 24 }, { i: 'iron_ore', w: 22 },
  { i: 'gold_ore', w: 11 }, { i: 'crystal', w: 9 }
];
