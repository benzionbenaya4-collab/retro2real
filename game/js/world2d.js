// מנוע top-down לעולמות 8 ו-16 ביט (ולשלבי 8/16 של קרב הבוס).
// מפה נוצרת מ-seed (מקורית, לא מועתקת), אריחים 16px, דן + תולעים + חורי void + שברי קוד + פיקסי.
import { loadSprite, loadTiles, drawSpr, SPR, makeWornPixi } from './assets.js';
import { rng, clamp, dist } from './util.js';
import { audio } from './audio.js';
import { hud } from './hud.js';
import { pixi } from './pixi.js';
import { input } from './input.js';
import { createZones, updateZones, drawZones, zoneArrows } from './zones.js';

const T = 16;
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

// ---------- מחולל מפה ----------
function genMap(cfg) {
  const { w: W, h: H } = cfg, r = rng(cfg.seed), g = new Array(W * H).fill('grass');
  const at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? 'tree' : g[y * W + x]);
  const set = (x, y, v) => { if (x >= 0 && y >= 0 && x < W && y < H) g[y * W + x] = v; };
  const start = { x: 4, y: H - 5 };
  if (cfg.arena) { // חדר קרב: קירות, כמה עמודים
    const mx = W >> 1, my = H >> 1;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const ring = Math.abs(Math.hypot((x - mx) / (W / 2 - 3), (y - my) / (H / 2 - 3)) - 0.8) < 0.12; set(x, y, x < 1 || y < 1 || x >= W - 1 || y >= H - 1 ? 'wall' : Math.abs(x - mx) <= 1 || Math.abs(y - my) <= 1 || ring ? 'path' : 'grass'); }
    for (const [x, y] of [[4, 3], [W - 5, 3], [4, H - 4], [W - 5, H - 4]]) set(x, y, 'tree');
    return { g, start: { x: W >> 1, y: H - 3 }, shardSpots: [], gate: null, coinSpots: [], hidden: [] };
  }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (x < 2 || y < 2 || x >= W - 2 || y >= H - 2) set(x, y, 'tree');
  for (let i = 0; i < (W * H) / 70; i++) { const cx = 2 + Math.floor(r() * (W - 4)), cy = 2 + Math.floor(r() * (H - 4)), rad = 1 + r() * 1.6;
    for (let y = -2; y <= 2; y++) for (let x = -2; x <= 2; x++) if (Math.hypot(x, y) <= rad && r() < 0.75) set(cx + x, cy + y, 'tree'); }
  for (let i = 0; i < (W * H) * 0.018; i++) set(2 + Math.floor(r() * (W - 4)), 2 + Math.floor(r() * (H - 4)), 'tree');
  { const cx = 6 + Math.floor(r() * (W * 0.3)), cy = 5 + Math.floor(r() * (H * 0.35)), rx = 2.5 + r() * 1.5, ry = 1.8 + r();
    for (let y = -4; y <= 4; y++) for (let x = -5; x <= 5; x++) if ((x / rx) ** 2 + (y / ry) ** 2 <= 1) set(cx + x, cy + y, 'water'); }
  let rx = Math.floor(W * 0.58);
  for (let y = 2; y < H - 2; y++) { if (r() < 0.35) rx = clamp(rx + (r() < 0.5 ? -1 : 1), Math.floor(W * 0.45), Math.floor(W * 0.7)); set(rx, y, 'water'); set(rx + 1, y, 'water'); }
  const cx = W - 6, cy = 3;
  for (let x = cx - 3; x <= cx + 3; x++) { set(x, cy - 1, 'wall'); set(x, cy, x === cx ? 'castle' : 'wall'); }
  const gate = { x: cx, y: cy + 1 };
  // נקודות שברי קוד
  const spots = []; let tries = 0;
  while (spots.length < cfg.shards && tries++ < 4000) {
    const p = { x: 3 + Math.floor(r() * (W - 6)), y: 3 + Math.floor(r() * (H - 6)) };
    if (Math.hypot(p.x - start.x, p.y - start.y) < 8 || Math.hypot(p.x - gate.x, p.y - gate.y) < 6) continue;
    if (spots.some((s) => Math.hypot(s.x - p.x, s.y - p.y) < Math.max(6, 9 - tries / 500))) continue;
    if (['wall', 'castle'].includes(at(p.x, p.y))) continue;
    spots.push(p);
  }
  // שבילים: התחלה → שבר הכי קרוב → … → שער
  const carve = (a, b) => {
    const hFirst = r() < 0.5; let x = a.x, y = a.y;
    const step = (tx, ty) => { while (x !== tx || y !== ty) { if (x !== tx) x += Math.sign(tx - x); else y += Math.sign(ty - y); if (!['wall', 'castle'].includes(at(x, y))) set(x, y, 'path'); } };
    if (hFirst) { step(b.x, y); step(b.x, b.y); } else { step(x, b.y); step(b.x, b.y); }
  };
  const left = [...spots]; let cur = start;
  while (left.length) { left.sort((p, q) => Math.hypot(p.x - cur.x, p.y - cur.y) - Math.hypot(q.x - cur.x, q.y - cur.y)); const n = left.shift(); carve(cur, n); cur = n; }
  carve(cur, gate);
  for (const p of [start, ...spots]) for (let y = -1; y <= 1; y++) for (let x = -1; x <= 1; x++) if (at(p.x + x, p.y + y) === 'tree' || at(p.x + x, p.y + y) === 'water') set(p.x + x, p.y + y, 'grass');
  set(gate.x, gate.y, 'path');
  // מקומות מחבוא למטבעות קוד: תאי דשא נגישים שמוקפים בעצים (פינות נסתרות)
  const reach = new Uint8Array(W * H), q = [start.y * W + start.x]; reach[q[0]] = 1;
  const pass = (x, y) => ['grass', 'path'].includes(at(x, y));
  while (q.length) { const i = q.pop(), x = i % W, y = (i / W) | 0; for (const [dx, dy] of DIRS) { const nx = x + dx, ny = y + dy, j = ny * W + nx; if (pass(nx, ny) && !reach[j]) { reach[j] = 1; q.push(j); } } }
  const hidden = [];
  for (let y = 3; y < H - 3; y++) for (let x = 3; x < W - 3; x++) {
    if (!reach[y * W + x] || at(x, y) !== 'grass' || Math.hypot(x - start.x, y - start.y) < 8) continue;
    let n = 0; for (let yy = -1; yy <= 1; yy++) for (let xx = -1; xx <= 1; xx++) if (at(x + xx, y + yy) === 'tree' || at(x + xx, y + yy) === 'water') n++;
    if (n >= 4 && !spots.some((p) => Math.abs(p.x - x) + Math.abs(p.y - y) < 3)) hidden.push({ x, y, n });
  }
  hidden.sort((a, b) => b.n - a.n || r() - 0.5);
  const coinSpots = [];
  for (const h of hidden) { if (coinSpots.length >= (cfg.coins || 0)) break; if (coinSpots.every((c) => Math.hypot(c.x - h.x, c.y - h.y) > 10)) coinSpots.push(h); }
  return { g, start, shardSpots: spots, gate, coinSpots, hidden };
}

// ---------- העולם ----------
export class World2D {
  constructor(cfg) { this.cfg = cfg; this.SPR = (era, n) => SPR[`${era}/${n}`]; }

  async load() {
    const c = this.cfg, e = c.era, names = new Set(['dan', 'noam', 'pixi', c.enemy.name]);
    if (c.miniboss) names.add(c.miniboss.name); if (c.arena && c.arena.boss !== 'pixi1') names.add(c.arena.boss);
    const [tiles] = await Promise.all([loadTiles(c.tiles), ...[...names].map((n) => loadSprite(e, n))]);
    this.tiles = tiles;
    if (c.arena?.boss === 'pixi1') makeWornPixi(e);
  }

  start() {
    const c = this.cfg;
    const m = genMap(c); this.W = c.w; this.H = c.h;
    this.base = m.g.slice(); this.map = m.g.slice(); this.gate = m.gate;
    this.solid = new Set(this.tiles.j.solid.filter((n) => n !== 'void'));
    const D = c.dan;
    this.dan = { x: m.start.x * T + 8, y: m.start.y * T + 12, face: 'up', hface: 'right', hp: D.hp, inv: 0, atkT: 9, atkCd: 0, moving: false, kx: 0, ky: 0, t: 0, safe: null, fall: 0 };
    this.dan.safe = { x: this.dan.x, y: this.dan.y }; this.dan.sprite = 'dan'; this.dan.id = 1;
    this.players = [this.dan];
    if (input.coop) { // נועם – שחקן 2
      const n = { ...this.dan, x: this.dan.x + 18, sprite: 'noam', id: 2, hface: 'left' }; n.safe = { x: n.x, y: n.y };
      if (this.boxHit(n.x, n.y, 4)) n.x = this.dan.x; this.noam = n; this.players.push(n);
    } else this.noam = null;
    this.shards = m.shardSpots.map((p) => ({ x: p.x * T + 8, y: p.y * T + 10, taken: false }));
    this.coins = m.coinSpots.map((p, i) => ({ id: `${c.key}-c${i}`, x: p.x * T + 8, y: p.y * T + 11, taken: false })).filter((k) => !pixi.hasCoin(k.id));
    // קלטות: רגילות ליד שביל, קלטת הזהב במחבוא
    this.tapes = []; const tr = rng(c.seed * 17 + 3);
    for (const tp of c.tapes || []) {
      let p = null;
      if (tp.gold) p = m.hidden.find((h) => m.coinSpots.every((k) => Math.hypot(k.x - h.x, k.y - h.y) > 6)) || m.hidden.find((h) => m.coinSpots.every((k) => Math.hypot(k.x - h.x, k.y - h.y) > 2));
      else for (let tries = 0; tries < 600 && !p; tries++) {
        const i = Math.floor(tr() * this.map.length), x = i % this.W, y = (i / this.W) | 0; if (this.map[i] !== 'path') continue;
        const [ox, oy] = DIRS[Math.floor(tr() * 4)], nx = x + ox, ny = y + oy;
        if (this.tile(nx, ny) !== 'grass' || Math.hypot(nx - m.start.x, ny - m.start.y) < 9) continue;
        if (this.shards.some((q) => Math.hypot(q.x / T - nx, q.y / T - ny) < 4) || this.tapes.some((q) => Math.hypot(q.x / T - nx, q.y / T - ny) < 10)) continue;
        p = { x: nx, y: ny };
      }
      if (p) this.tapes.push({ ...tp, x: p.x * T + 8, y: p.y * T + 11 });
    }
    this.keep = [...this.coins, ...this.tapes];
    this.got = 0; this.enemies = []; this.items = []; this.bolts = []; this.parts = []; this.fx = [];
    this.t = 0; this.shake = 0; this.flash = 0; this.voidT = 0; this.voidMax = c.voidMax || 0;
    this.wave = -1; this.waveOn = false; this.toSpawn = 0; this.spawnT = 0; this.nextWaveT = 2.5; this.waveKills = 0; this.waveT = 0; this.waveN = 0;
    this.exitOpen = false; this.boss = null; this.result = null; this.endT = 0;
    this.pixi = { x: this.dan.x - 14, y: this.dan.y - 10 };
    this.mini = document.createElement('canvas'); this.mini.width = this.W; this.mini.height = this.H; this.mctx = this.mini.getContext('2d');
    if (!c.arena) { // זרעי void
      const r = rng(c.seed * 7 + 1);
      for (let k = 0; k < (c.voidSeeds || 5); k++) {
        for (let tries = 0; tries < 60; tries++) {
          const x = 3 + Math.floor(r() * (this.W - 6)), y = 3 + Math.floor(r() * (this.H - 6));
          if (Math.hypot(x * T - this.dan.x, y * T - this.dan.y) < 10 * T || this.tile(x, y) !== 'grass' || this.keep.some((k) => Math.hypot(k.x - x * T, k.y - y * T) < 4 * T)) continue;
          this.setVoid(x, y); for (let i = 0; i < 4; i++) this.spreadVoid(true, true); break;
        }
      }
    } else { this.spawnBoss(c.arena.boss, (this.W >> 1) * T + 8, 4 * T); }
    createZones(this);
    pixi.reset(true);
    this.swordMul = c.swordMul || 1;
  }

  // ---------- אריחים ----------
  tile(x, y) { return x < 0 || y < 0 || x >= this.W || y >= this.H ? 'tree' : this.map[y * this.W + x]; }
  tileAt(px, py) { return this.tile(Math.floor(px / T), Math.floor(py / T)); }
  blocked(px, py, ghost) { const n = this.tileAt(px, py); return this.solid.has(n) && !(ghost && n === 'tree'); }
  boxHit(x, y, hw, ghost) { return this.blocked(x - hw, y, ghost) || this.blocked(x + hw, y, ghost) || this.blocked(x - hw, y - 5, ghost) || this.blocked(x + hw, y - 5, ghost); }
  move(o, dx, dy, hw, ghost) {
    if (!this.boxHit(o.x + dx, o.y, hw, ghost)) o.x += dx; else o.kx = 0;
    if (!this.boxHit(o.x, o.y + dy, hw, ghost)) o.y += dy; else o.ky = 0;
  }
  setVoid(x, y) { this.map[y * this.W + x] = 'void'; }
  voidCells() { const out = []; for (let i = 0; i < this.map.length; i++) if (this.map[i] === 'void') out.push(i); return out; }
  spreadVoid(force, seed) {
    const cells = this.voidCells(); if (!cells.length || (!force && cells.length >= this.voidMax)) return;
    const dtx = Math.floor(this.dan.x / T), dty = Math.floor(this.dan.y / T);
    for (let tries = 0; tries < 12; tries++) {
      const i = cells[Math.floor(Math.random() * cells.length)], [ox, oy] = DIRS[Math.floor(Math.random() * 4)];
      const x = (i % this.W) + ox, y = Math.floor(i / this.W) + oy, n = this.tile(x, y);
      if (!['grass', 'path', 'tree'].includes(n) || x < 2 || y < 2 || x >= this.W - 2 || y >= this.H - 2) continue;
      if (!seed && Math.max(Math.abs(x - dtx), Math.abs(y - dty)) < 3) continue;
      if (this.gate && Math.abs(x - this.gate.x) + Math.abs(y - this.gate.y) < 3) continue;
      if (this.shards.some((s) => !s.taken && Math.floor(s.x / T) === x && Math.floor(s.y / T) === y)) continue;
      if (this.keep.some((s) => !s.taken && Math.abs(Math.floor(s.x / T) - x) <= 1 && Math.abs(Math.floor(s.y / T) - y) <= 1)) continue;
      this.setVoid(x, y); return true;
    }
  }
  restore(px, py, rad) {
    const cx = Math.floor(px / T), cy = Math.floor(py / T); let n = 0;
    for (let y = cy - rad; y <= cy + rad; y++) for (let x = cx - rad; x <= cx + rad; x++) {
      if (Math.hypot(x - cx, y - cy) > rad + 0.5 || this.tile(x, y) !== 'void' || this.zoneOf[y * this.W + x] >= 0) continue;
      this.map[y * this.W + x] = this.base[y * this.W + x]; n++;
      for (let k = 0; k < 3; k++) this.part(x * T + 8, y * T + 8, this.cfg.colors.light, 0.7);
    }
    return n;
  }

  // ---------- ישויות ----------
  part(x, y, c, life = 0.5, sp = 60) { this.parts.push({ x, y, vx: (Math.random() - 0.5) * sp, vy: (Math.random() - 0.7) * sp, t: 0, life, c }); }
  spawnEnemy(x, y, type = this.cfg.enemy.name, extra = {}) {
    const E = this.cfg.enemy;
    const e = { type, x, y, hp: E.hp, max: E.hp, speed: E.speed * (0.85 + Math.random() * 0.3), r: E.r, dmg: E.dmg, inv: 0.4, kx: 0, ky: 0, t: Math.random() * 3, face: 'walk_down', rise: 0.5, ...extra };
    this.enemies.push(e); return e;
  }
  spawnBoss(type, x, y) {
    const B = type === 'trojan' ? this.cfg.miniboss : this.cfg.arena;
    const e = this.spawnEnemy(x, y, type, { hp: B.hp, max: B.hp, speed: B.speed, r: B.r, dmg: B.dmg || 1, boss: true, ai: 0, aiT: 1.5, rise: 0.8, scale: B.scale || 1 });
    if (B.outageHalf) e.onHalf = true;
    this.boss = e; return e;
  }
  spawnFromVoid() {
    const cells = this.voidCells().filter((i) => { const d = Math.hypot((i % this.W) * T + 8 - this.dan.x, Math.floor(i / this.W) * T + 8 - this.dan.y); return d > 60 && d < 220; });
    let x, y;
    if (cells.length) { const i = cells[Math.floor(Math.random() * cells.length)]; x = (i % this.W) * T + 8; y = Math.floor(i / this.W) * T + 12; }
    else { for (let k = 0; k < 40; k++) { const a = Math.random() * 6.28; x = this.dan.x + Math.cos(a) * 120; y = this.dan.y + Math.sin(a) * 120; if (!this.boxHit(x, y, 5)) break; } }
    for (let k = 0; k < 8; k++) this.part(x, y - 4, this.cfg.colors.dark, 0.5, 80);
    return this.spawnEnemy(x, y);
  }

  // ---------- עדכון ----------
  update(dt, inp) {
    const c = this.cfg, d = this.dan; this.t += dt;
    if (this.result) { this.endT += dt; this.updateParts(dt); return this.endT > 1.4 ? this.result : null; }
    pixi.update(dt, this.enemies.some((e) => !e.dead && e.rise <= 0));
    if (inp.pixiPressed) pixi.tryScan();

    for (const p of this.players) this.updatePlayer(p, p === this.dan ? inp : inp.p2, dt);

    // אויבים
    for (const e of this.enemies) this.updateEnemy(e, dt);
    this.enemies = this.enemies.filter((e) => !e.dead);
    // חיצים / ברקי קוד
    for (const b of this.bolts) {
      b.x += b.vx * dt; b.y += b.vy * dt; b.t += dt;
      if (this.blocked(b.x, b.y, true) || b.t > 3) b.dead = true;
      else { const p = this.alive().find((q) => dist(b.x, b.y, q.x, q.y - 6) < 7); if (p) { b.dead = true; this.hurtPlayer(p, 1, b.vx, b.vy); } }
    }
    this.bolts = this.bolts.filter((b) => !b.dead);
    // פריטים
    for (const it of this.items) { it.t += dt; const p = this.alive().find((q) => dist(it.x, it.y, q.x, q.y) < 10); if (p) { it.dead = true; if (it.kind === 'heart') { p.hp = Math.min(c.dan.hp, p.hp + 1); audio.sfx('heart'); } } if (it.t > 12) it.dead = true; }
    this.items = this.items.filter((i) => !i.dead);
    const touch = (x, y, r) => this.players.some((q) => q.hp > 0 && dist(x, y, q.x, q.y) < r);
    for (const s of this.shards) if (!s.taken && touch(s.x, s.y, 11)) this.takeShard(s);
    for (const k of this.coins) if (!k.taken && touch(k.x, k.y, 10)) { k.taken = true; pixi.collectCoin(k.id); for (let i = 0; i < 12; i++) this.part(k.x, k.y - 4, c.colors.coin || c.colors.light, 0.7, 90); }

    // void מתפשט
    if (this.voidMax > 0) { this.voidT += dt; const every = c.voidEvery * (1 + this.got * 0.25); if (this.voidT > every) { this.voidT = 0; this.spreadVoid(); } }

    this.updateWaves(dt);
    updateZones(this, dt);
    if (this.boss && this.boss.onHalf && this.boss.hp <= this.boss.max / 2 && !this.boss.halfDone) { this.boss.halfDone = true; pixi.runOut(); }
    if (this.exitOpen && this.gate && touch(this.gate.x * T + 8, this.gate.y * T + 12, 12)) { this.result = 'win'; audio.sfx('warp'); }
    if (!this.alive().length) { this.result = 'dead'; audio.sfx('kill'); }

    // פיקסי עוקב
    const lead = d.hp > 0 || !this.noam ? d : this.noam;
    const tx = lead.x + (lead.hface === 'right' ? -16 : 16), ty = lead.y - 18;
    this.pixi.x += (tx - this.pixi.x) * Math.min(1, dt * 4); this.pixi.y += (ty - this.pixi.y) * Math.min(1, dt * 4);
    this.updateParts(dt);
    this.shake = Math.max(0, this.shake - dt); this.flash = Math.max(0, this.flash - dt);
    hud.hearts(Math.max(0, d.hp), c.dan.hp); hud.hearts2(this.noam ? Math.max(0, this.noam.hp) : null, c.dan.hp); hud.shards(this.got, this.shards.length);
    if (this.boss && !this.boss.dead) hud.bossBar(this.cfg.arena ? this.cfg.arena.label : this.cfg.miniboss.label, this.boss.hp / this.boss.max); else hud.bossBar(null);
    return null;
  }
  // ---------- שחקנים ----------
  alive() { return this.players.filter((p) => p.hp > 0); }
  nearest(x, y) { let b = null, bd = Infinity; for (const p of this.players) { if (p.hp <= 0) continue; const q = dist(x, y, p.x, p.y); if (q < bd) { bd = q; b = p; } } return b; }
  updatePlayer(d, inp, dt) {
    const c = this.cfg;
    d.t += dt; d.inv = Math.max(0, d.inv - dt); d.atkCd = Math.max(0, d.atkCd - dt); d.atkT += dt;
    if (d.hp <= 0) { // נפל – קם אחרי כמה שניות אם החבר עדיין עומד
      d.down = (d.down ?? 8) - dt;
      if (d.down <= 0 && this.alive().length) { d.hp = Math.ceil(c.dan.hp / 2); d.inv = 2; d.down = undefined; hud.say(d.id === 2 ? 'נועם חזר! 💪' : 'דן חזר!', 2); audio.sfx('heart'); }
      return;
    }
    const sp = c.dan.speed * pixi.speedMul() * (d.atkT < 0.14 ? 0.45 : 1);
    if (pixi.boost > 0 && d.moving && Math.random() < 0.6) this.part(d.x - inp.x * 6, d.y - 4, c.colors.light, 0.3, 10);
    d.moving = Math.hypot(inp.x, inp.y) > 0.1;
    if (d.moving) {
      if (Math.abs(inp.x) > Math.abs(inp.y)) d.face = inp.x > 0 ? 'right' : 'left'; else d.face = inp.y > 0 ? 'down' : 'up';
      if (Math.abs(inp.x) > 0.25) d.hface = inp.x > 0 ? 'right' : 'left';
    }
    const ox = d.x, oy = d.y;
    this.move(d, (inp.x * sp + d.kx) * dt, (inp.y * sp + d.ky) * dt, 4);
    // בשניים: לא מתרחקים מעבר למסך (המצלמה עוקבת אחרי שניהם)
    const o = this.players.find((q) => q !== d && q.hp > 0);
    if (o && this.vw && input.coopMode !== 'table') { if (Math.abs(d.x - o.x) > this.vw - 40 && Math.abs(d.x - o.x) > Math.abs(ox - o.x)) d.x = ox; if (Math.abs(d.y - o.y) > this.vh - 56 && Math.abs(d.y - o.y) > Math.abs(oy - o.y)) d.y = oy; }
    d.kx *= Math.exp(-10 * dt); d.ky *= Math.exp(-10 * dt);
    // נפילה לחור void
    if (this.tileAt(d.x, d.y - 2) === 'void') {
      this.hurtPlayer(d, 1, 0, 0, true); d.x = d.safe.x; d.y = d.safe.y; audio.sfx('void');
      if (!this.fellOnce) { this.fellOnce = true; hud.say('זהירות! ה-void בולע אריחים. שברי קוד מחזירים אותם.', 3.4); }
    } else if (this.tileAt(d.x - 5, d.y - 2) !== 'void' && this.tileAt(d.x + 5, d.y - 2) !== 'void' && this.tileAt(d.x, d.y + 3) !== 'void' && this.tileAt(d.x, d.y - 8) !== 'void') { d.safe.x = d.x; d.safe.y = d.y; }
    // קלטת
    const tape = this.onTape ? this.tapes.find((t) => dist(t.x, t.y, d.x, d.y) < 15) : null;
    if (d === this.dan || tape) this.nearTape = tape || (this.nearTape && this.players.some((q) => q !== d && dist(this.nearTape.x, this.nearTape.y, q.x, q.y) < 15) ? this.nearTape : null);
    if (inp.aPressed && tape) { inp.aPressed = false; this.onTape(tape); return; }
    // חרב
    if (inp.aPressed && d.atkCd <= 0) {
      d.atkT = 0; d.atkCd = 0.3; audio.sfx('swing');
      const [fx, fy] = { right: [1, 0], left: [-1, 0], down: [0, 1], up: [0, -1] }[d.face];
      const hx = d.x + fx * c.dan.reach, hy = d.y - 6 + fy * c.dan.reach;
      this.fx.push({ kind: 'slash', x: hx, y: hy, fx, fy, t: 0 });
      for (const e of this.enemies) {
        if (e.inv > 0 || e.rise > 0 || e.dead) continue;
        if (dist(hx, hy, e.x, e.y - e.r) < c.dan.reach + e.r) this.hitEnemy(e, c.dan.dmg * (this.swordMul || 1), fx, fy);
      }
    }
  }
  updateParts(dt) {
    for (const p of this.parts) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 120 * dt; }
    this.parts = this.parts.filter((p) => p.t < p.life);
    for (const f of this.fx) f.t += dt; this.fx = this.fx.filter((f) => f.t < 0.18);
  }
  hurtDan(n, kx, ky, ignoreInv) { this.hurtPlayer(this.dan, n, kx, ky, ignoreInv); }
  hurtPlayer(d, n, kx, ky, ignoreInv) {
    if (d.hp <= 0 || (d.inv > 0 && !ignoreInv)) return;
    d.hp -= n; d.inv = 1.1; this.shake = 0.25; this.flash = 0.12; audio.sfx('hurt');
    const m = Math.hypot(kx, ky) || 1; d.kx = (kx / m) * 140; d.ky = (ky / m) * 140;
  }
  hitEnemy(e, dmg, fx, fy) {
    e.hp -= dmg; e.inv = 0.25; const kb = e.boss ? 60 : 170; e.kx = fx * kb; e.ky = fy * kb; this.shake = 0.08; audio.sfx('hit');
    for (let k = 0; k < 4; k++) this.part(e.x, e.y - e.r, this.cfg.colors.light, 0.35);
    if (e.hp <= 0) {
      e.dead = true; audio.sfx('kill'); this.waveKills++;
      for (let k = 0; k < 14; k++) this.part(e.x, e.y - e.r, k % 2 ? this.cfg.colors.dark : this.cfg.colors.light, 0.7, 120);
      if (!e.boss && this.dan.hp < this.cfg.dan.hp && Math.random() < 0.22) this.items.push({ kind: 'heart', x: e.x, y: e.y - 2, t: 0 });
      if (e.boss) this.onBossDown(e);
    }
  }
  updateEnemy(e, dt) {
    const d = this.dan; e.t += dt; e.inv = Math.max(0, e.inv - dt);
    if (e.rise > 0) { e.rise -= dt; return; }
    let vx = 0, vy = 0;
    const tg = e.tgt && !e.tgt.dead && e.tgt.hp > 0 ? e.tgt : (this.nearest(e.x, e.y) || d);
    const dx = tg.x - e.x, dy = tg.y - e.y, L = Math.hypot(dx, dy) || 1;
    if (e.type === 'trojan') vx = this.aiTrojan(e, dt, dx / L, dy / L);
    else if (e.type === 'hacker' || e.type === 'pixi1') vx = this.aiHacker(e, dt, dx / L, dy / L);
    else { // תולעת: מתפתלת לעבר דן
      const wob = Math.sin(e.t * 5) * 0.5, chase = L < 200 ? 1 : 0.35;
      vx = (dx / L + (-dy / L) * wob) * e.speed * chase; vy = (dy / L + (dx / L) * wob) * e.speed * chase;
      e.vx = vx; e.vy = vy;
    }
    if (e.vx !== undefined) { vx = e.vx; vy = e.vy; }
    this.move(e, (vx + e.kx) * dt, (vy + e.ky) * dt, e.boss ? 6 : 4, e.type !== 'trojan');
    e.kx *= Math.exp(-8 * dt); e.ky *= Math.exp(-8 * dt);
    e.face = Math.abs(vx) > Math.abs(vy) ? (vx > 0 ? 'walk_right' : 'walk_left') : 'walk_down';
    if (e.attackAnim > 0) e.attackAnim -= dt;
    for (const p of this.players) if (p.hp > 0 && dist(e.x, e.y - e.r, p.x, p.y - 6) < e.r + 5) this.hurtPlayer(p, e.dmg, p.x - e.x, p.y - e.y);
  }
  aiTrojan(e, dt, ux, uy) { // סוס טרויאני: מתקרב לאט, מסתער, ומוציא תולעים מהבטן
    e.aiT -= dt;
    if (e.ai === 0) { e.vx = ux * e.speed; e.vy = uy * e.speed; if (e.aiT <= 0) { e.ai = 1; e.aiT = 0.55; e.cx = ux; e.cy = uy; audio.sfx('bolt'); } }
    else if (e.ai === 1) { e.vx = e.vy = 0; if (e.aiT <= 0) { e.ai = 2; e.aiT = 0.8; } } // התכוננות
    else if (e.ai === 2) { e.vx = e.cx * e.speed * 4.2; e.vy = e.cy * e.speed * 4.2; if (e.aiT <= 0) { e.ai = 3; e.aiT = 0.7; } }
    else { e.vx = e.vy = 0; if (e.aiT <= 0) {
      e.ai = 0; e.aiT = 2.2 + Math.random();
      if (this.enemies.length < 6) { for (let k = 0; k < 2; k++) this.spawnEnemy(e.x + (k ? 14 : -14), e.y + 6, this.cfg.enemy.name); if (k0(this) && !pixi.out) hud.say('הוא מוציא תולעים מהבטן! קלאסי של סוס טרויאני.', 2.6); }
    } }
    return 0;
  }
  aiHacker(e, dt, ux, uy) { // ההאקר: מתחמק בטלפורט, יורה ברקי קוד, מזמן תולעים
    const A = this.cfg.arena; e.aiT -= dt; e.vx = -uy * 20; e.vy = ux * 20;
    e.boltT = (e.boltT ?? 1.2) - dt; e.tpT = (e.tpT ?? 3.5) - dt; e.sumT = (e.sumT ?? 5) - dt;
    if (e.boltT <= 0) {
      e.boltT = A.boltEvery; audio.sfx('bolt'); e.attackAnim = 0.3;
      const a0 = Math.atan2(uy, ux); for (const da of A.spread) { const a = a0 + da; this.bolts.push({ x: e.x, y: e.y - 10, vx: Math.cos(a) * A.boltSpeed, vy: Math.sin(a) * A.boltSpeed, t: 0 }); }
    }
    if (e.tpT <= 0) {
      e.tpT = 3 + Math.random() * 1.5;
      for (let k = 0; k < 10; k++) this.part(e.x, e.y - 8, this.cfg.colors.dark, 0.4, 90);
      for (let tries = 0; tries < 30; tries++) { const x = (2 + Math.random() * (this.W - 4)) * T, y = (2 + Math.random() * (this.H - 4)) * T; if (!this.boxHit(x, y, 6) && dist(x, y, this.dan.x, this.dan.y) > 60) { e.x = x; e.y = y; break; } }
    }
    if (e.sumT <= 0) { e.sumT = 6; if (this.enemies.length < 4) for (let k = 0; k < 2; k++) this.spawnEnemy(e.x + (k ? 16 : -16), e.y, this.cfg.enemy.name); }
    return 0;
  }
  onBossDown(e) {
    this.shake = 0.6; this.flash = 0.3;
    for (const o of this.enemies) if (!o.boss && !o.dead) { o.dead = true; for (let k = 0; k < 6; k++) this.part(o.x, o.y - 4, this.cfg.colors.light, 0.6); }
    if (this.cfg.arena) { this.result = 'win'; audio.sfx('warp'); return; }
    pixi.refill(); this.openExit();
  }
  takeShard(s) {
    s.taken = true; this.got++; audio.sfx('shard'); this.flash = 0.08;
    const n = this.restore(s.x, s.y, 5); this.voidMax = Math.max(8, this.voidMax - 10);
    hud.banner(`שבר קוד ${this.got}/${this.shards.length}<small>${n ? `${n} אריחים חזרו` : 'הקוד מתייצב'}</small>`, 1.8);
    if (this.got === 1) setTimeout(() => hud.say('יפה! כל שבר קוד מחזיר את האריחים שה-void בלע מסביב.', 3.4), 900);
  }
  updateWaves(dt) {
    const c = this.cfg; if (c.arena) return;
    const W = c.waves;
    if (!this.waveOn) {
      this.nextWaveT -= dt;
      const nxt = W[this.wave + 1];
      if (nxt && this.got >= nxt.need && this.nextWaveT <= 0) {
        this.wave++; this.waveOn = true; this.toSpawn = nxt.n; this.waveN = nxt.n; this.spawnT = 0.3; this.waveKills = 0; this.waveT = 0; this.outed = false;
        audio.sfx('wave'); hud.banner(`גל ${this.wave + 1}<small>תולעים יוצאות מה-void!</small>`, 1.8);
        if (this.wave === 0) setTimeout(() => hud.say('דן! תולעים זדוניות! לחץ על "פיקסי" ואני אסמן לך אותן.', 3.6), 1200);
      } else if (!nxt && !this.exitOpen && this.got >= this.shards.length && !this.boss) {
        if (c.miniboss) this.startMiniboss(); else this.openExit();
      }
      return;
    }
    this.waveT += dt; this.spawnT -= dt;
    if (this.toSpawn > 0 && this.spawnT <= 0) { this.spawnFromVoid(); this.toSpawn--; this.spawnT = 0.9; }
    const wv = W[this.wave];
    if (wv.outage && !this.outed && (this.waveKills >= Math.ceil(this.waveN / 2) || this.waveT > 9)) { this.outed = true; pixi.runOut(); }
    if (this.toSpawn === 0 && this.enemies.length === 0) { this.waveOn = false; this.nextWaveT = 2; if (pixi.out) pixi.refill(); else pixi.tokens = Math.min(pixi.max, pixi.tokens + 40); }
  }
  startMiniboss() {
    const M = this.cfg.miniboss, gx = this.gate.x * T + 8, gy = (this.gate.y + 3) * T;
    this.spawnBoss('trojan', gx, gy); this.shake = 0.5; audio.sfx('warp');
    hud.banner(`${M.label}<small>מיני-בוס</small>`, 2.4);
    setTimeout(() => hud.say('זה סוס טרויאני! מבחוץ מתנה, מבפנים תולעים. תכה אותו כשהוא נעצר אחרי ההסתערות!', 4), 1500);
    this.boss.onHalf = true;
  }
  openExit() {
    if (this.exitOpen) return; this.exitOpen = true; audio.sfx('start');
    hud.banner('השער נפתח!<small>לך לטירה</small>', 2.4);
    setTimeout(() => hud.say('השער לעולם הבא פתוח, ליד הטירה. סמנתי לך חץ 👉', 3.2), 800);
  }

  // ---------- ציור ----------
  draw(ctx, VW, VH, focus = null) {
    const c = this.cfg, d = this.dan, col = c.colors;
    if (!focus) { this.vw = VW; this.vh = VH; }
    const al = focus ? [focus] : this.alive(), fx0 = al.length ? al.reduce((a, p) => a + p.x, 0) / al.length : d.x, fy0 = al.length ? al.reduce((a, p) => a + p.y, 0) / al.length : d.y;
    let camX = clamp(fx0 - VW / 2, 0, Math.max(0, this.W * T - VW)), camY = clamp(fy0 - 8 - VH / 2, 0, Math.max(0, this.H * T - VH));
    if (this.W * T < VW) camX = (this.W * T - VW) / 2; if (this.H * T < VH) camY = (this.H * T - VH) / 2;
    if (this.shake > 0) { camX += (Math.random() - 0.5) * 6; camY += (Math.random() - 0.5) * 6; }
    camX = Math.round(camX); camY = Math.round(camY); this.cam = { x: camX, y: camY };
    ctx.fillStyle = col.bg; ctx.fillRect(0, 0, VW, VH);
    ctx.save(); ctx.translate(-camX, -camY);
    const TS = this.tiles, cols = Math.floor(TS.im.width / T);
    const x0 = Math.max(0, Math.floor(camX / T)), y0 = Math.max(0, Math.floor(camY / T)), x1 = Math.min(this.W - 1, Math.ceil((camX + VW) / T)), y1 = Math.min(this.H - 1, Math.ceil((camY + VH) / T));
    if (c.tint) ctx.filter = c.tint;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const n = this.map[y * this.W + x]; let idx = TS.j.tiles[n]; const an = TS.j.anims?.[n];
      if (an) idx = an.frames[Math.floor((this.t + (x * 7 + y * 3) * 0.13) * an.fps) % an.frames.length];
      ctx.drawImage(TS.im, (idx % cols) * T, Math.floor(idx / cols) * T, T, T, x * T, y * T, T, T);
    }
    if (c.tint) ctx.filter = 'none';
    // שער
    if (this.gate && this.exitOpen) {
      const gx = this.gate.x * T, gy = this.gate.y * T, p = (this.t * 2) % 1;
      for (let k = 0; k < 3; k++) { const s = ((p + k / 3) % 1) * 8; ctx.strokeStyle = k % 2 ? col.light : col.mid; ctx.strokeRect(gx + s + 0.5, gy + s + 0.5, T - 2 * s - 1, T - 2 * s - 1); }
    }
    // שברי קוד
    for (const s of this.shards) if (!s.taken) this.drawShard(ctx, s.x, s.y - 6 + Math.sin(this.t * 3 + s.x) * 2);
    for (const it of this.items) if (it.t < 9 || Math.floor(it.t * 8) % 2) this.drawHeart(ctx, it.x, it.y - 4);
    for (const k of this.coins) if (!k.taken) this.drawCoin(ctx, k.x, k.y);
    drawZones(ctx, this);
    for (const tp of this.tapes) this.drawTape(ctx, tp);
    // ישויות לפי y
    const list = [...this.enemies.map((e) => ({ y: e.y, f: () => this.drawEnemy(ctx, e) })), ...this.players.map((p) => ({ y: p.y, f: () => this.drawPlayer(ctx, p) }))];
    list.sort((a, b) => a.y - b.y).forEach((o) => o.f());
    for (const b of this.bolts) { ctx.fillStyle = col.danger; ctx.fillRect(Math.round(b.x) - 3, Math.round(b.y) - 3, 6, 6); ctx.fillStyle = col.bolt || col.light; ctx.fillRect(Math.round(b.x) - 1, Math.round(b.y) - 1, 2, 2); }
    for (const f of this.fx) this.drawSlash(ctx, f);
    for (const p of this.parts) { ctx.fillStyle = p.c; ctx.fillRect(Math.round(p.x), Math.round(p.y), 2, 2); }
    // פיקסי
    const pa = pixi.out ? (Math.floor(this.t * 3) % 2 ? 0.35 : 0.6) : 1;
    drawSpr(ctx, this.SPR(c.era, 'pixi'), 'idle', this.t, this.pixi.x, this.pixi.y + Math.sin(this.t * 4) * 2 + 8, pa, c.pixiScale || 1);
    if (pixi.out) { ctx.fillStyle = col.light; ctx.fillRect(Math.round(this.pixi.x) + 5, Math.round(this.pixi.y) - 12, 2, 2); ctx.fillRect(Math.round(this.pixi.x) + 8, Math.round(this.pixi.y) - 15, 2, 2); ctx.fillRect(Math.round(this.pixi.x) + 11, Math.round(this.pixi.y) - 18, 2, 2); }
    if (pixi.scan > 0) this.drawScanWorld(ctx);
    ctx.restore();
    // חצים מחוץ למסך + מפה
    if (pixi.scan > 0) this.drawScanHud(ctx, VW, VH);
    zoneArrows(ctx, this, VW, VH);
    if (this.exitOpen && this.gate) this.edgeArrow(ctx, VW, VH, this.gate.x * T + 8, this.gate.y * T + 8, col.light, Math.floor(this.t * 4) % 2 ? 6 : 5);
    if (this.flash > 0) { ctx.fillStyle = col.light; ctx.globalAlpha = this.flash * 3; ctx.fillRect(0, 0, VW, VH); ctx.globalAlpha = 1; }
    if (this.result) { ctx.fillStyle = this.result === 'win' ? col.light : col.bg; ctx.globalAlpha = Math.min(1, this.endT / 1.2); ctx.fillRect(0, 0, VW, VH); ctx.globalAlpha = 1; }
  }
  drawPlayer(ctx, d) {
    const S = this.SPR(this.cfg.era, d.sprite || 'dan');
    if (d.hp <= 0) { // נפל: שקוף ומהבהב, עם ספירה לאחור קטנה
      drawSpr(ctx, S, 'idle', 0, d.x, d.y, Math.floor(this.t * 4) % 2 ? 0.25 : 0.5);
      const col = this.cfg.colors, k = Math.ceil(d.down ?? 0); ctx.fillStyle = col.light;
      for (let i = 0; i < Math.min(8, k); i++) ctx.fillRect(Math.round(d.x) - 8 + i * 2, Math.round(d.y) - (S ? S.j.frameH : 24) - 4, 1, 2);
      return;
    }
    if (d.inv > 0 && Math.floor(d.inv * 14) % 2) return;
    let anim = 'idle';
    if (d.atkT < 0.3) anim = S && S.j.anims['attack_' + d.hface] ? 'attack_' + d.hface : 'walk_' + d.hface;
    else if (d.moving) anim = d.face === 'down' ? 'walk_down' : d.face === 'up' ? 'walk_' + d.hface : 'walk_' + d.face;
    drawSpr(ctx, S, anim, d.atkT < 0.3 && S && S.j.anims['attack_' + d.hface] ? d.atkT : d.t, d.x, d.y);
    if (this.noam) { ctx.fillStyle = d.id === 2 ? '#ffcf4a' : '#6fe3ff'; ctx.fillRect(Math.round(d.x) - 1, Math.round(d.y) - (S ? S.j.frameH : 24) - 3, 3, 2); } // סימון שחקן 1/2
    if (this.swordMul > 1) { ctx.fillStyle = Math.floor(this.t * 10) % 2 ? '#ffcf4a' : '#6fe3ff'; ctx.fillRect(Math.round(d.x) + (d.hface === 'right' ? 6 : -8), Math.round(d.y) - 16, 2, 2); }
  }
  drawEnemy(ctx, e) {
    const S = this.SPR(this.cfg.era, e.type);
    if (e.rise > 0) { // יוצא מה-void
      ctx.save(); ctx.beginPath(); ctx.rect(e.x - 30, e.y - 60, 60, 60); ctx.clip();
      drawSpr(ctx, S, 'idle', e.t, e.x, e.y + e.rise * 40, 0.8); ctx.restore(); return;
    }
    const blink = e.inv > 0 && Math.floor(e.inv * 20) % 2;
    let anim = e.face; if (e.attackAnim > 0) anim = e.vx >= 0 ? 'attack_right' : 'attack_left';
    if (e.type === 'trojan' && e.ai === 1) anim = 'idle';
    if (e.type === 'pixi1') { anim = 'idle'; if (Math.random() < 0.04) { ctx.fillStyle = '#6e5038'; ctx.fillRect(Math.round(e.x - 20 + Math.random() * 40), Math.round(e.y - 60 + Math.random() * 50), 6, 2); } }
    drawSpr(ctx, S, anim, e.t, e.x + (e.type === 'trojan' && e.ai === 1 ? (Math.random() - 0.5) * 2 : 0), e.y - (e.type === 'pixi1' ? 6 + Math.sin(e.t * 2) * 3 : 0), blink ? 0.3 : 1, e.scale || 1);
  }
  drawSlash(ctx, f) {
    const col = this.cfg.colors, a = f.t / 0.18, r = this.cfg.dan.reach * 0.9, base = Math.atan2(f.fy, f.fx);
    ctx.fillStyle = this.swordMul > 1 ? (Math.floor(this.t * 20) % 2 ? '#ffcf4a' : '#6fe3ff') : col.light;
    for (let k = -4; k <= 4; k++) { const ang = base + (k / 4) * 1.1 * (a * 1.4 - 0.2); ctx.fillRect(Math.round(f.x - f.fx * 6 + Math.cos(ang) * r) - 1, Math.round(f.y - f.fy * 6 + Math.sin(ang) * r) - 1, 2, 2); }
  }
  drawShard(ctx, x, y) {
    const col = this.cfg.colors; x = Math.round(x); y = Math.round(y);
    ctx.fillStyle = col.dark; ctx.fillRect(x - 1, y - 5, 2, 10); ctx.fillRect(x - 3, y - 3, 6, 6); ctx.fillRect(x - 5, y - 1, 10, 2);
    ctx.fillStyle = Math.floor(this.t * 5) % 2 ? col.light : col.mid; ctx.fillRect(x - 1, y - 3, 2, 6); ctx.fillRect(x - 3, y - 1, 6, 2);
    ctx.fillStyle = col.shadow || col.dark; ctx.globalAlpha = 0.5; ctx.fillRect(x - 3, y + 9, 6, 2); ctx.globalAlpha = 1;
  }
  drawTape(ctx, tp) { // קלטת קטנה על הרצפה (זהב = נדירה ונוצצת)
    const col = this.cfg.colors, x = Math.round(tp.x), y = Math.round(tp.y - 4), done = pixi.hasCoin('tape-' + tp.id);
    const body = tp.gold ? '#ffcf4a' : col.tape || col.mid;
    ctx.fillStyle = col.dark; ctx.fillRect(x - 7, y - 5, 14, 10);
    ctx.fillStyle = body; ctx.fillRect(x - 6, y - 4, 12, 8);
    ctx.fillStyle = col.dark; ctx.fillRect(x - 4, y - 2, 3, 3); ctx.fillRect(x + 1, y - 2, 3, 3); ctx.fillRect(x - 3, y + 2, 6, 2);
    if (tp.gold && !done) { const k = (this.t * 1.3) % 3; if (k < 0.6) { ctx.fillStyle = '#ffffff'; const sx = x - 8 + Math.round(k * 25); ctx.fillRect(sx, y - 8, 1, 3); ctx.fillRect(sx - 1, y - 7, 3, 1); } }
    if (done) { ctx.fillStyle = col.light; ctx.fillRect(x + 5, y - 8, 2, 2); ctx.fillRect(x + 7, y - 10, 2, 2); }
    if (this.nearTape === tp) { // בועת "A"
      const by = y - 20 + (Math.floor(this.t * 3) % 2); ctx.fillStyle = col.bg; ctx.fillRect(x - 6, by - 6, 12, 11); ctx.fillStyle = col.light; ctx.fillRect(x - 5, by - 5, 10, 9);
      ctx.fillStyle = col.bg; ctx.fillRect(x - 2, by - 3, 4, 1); ctx.fillRect(x - 3, by - 2, 1, 5); ctx.fillRect(x + 2, by - 2, 1, 5); ctx.fillRect(x - 2, by, 4, 1);
    }
  }
  drawCoin(ctx, x, y) { // מטבע קוד: עיגול קטן עם <> ונצנוץ מדי פעם
    const col = this.cfg.colors, w = Math.abs(Math.cos(this.t * 2.5)); x = Math.round(x); y = Math.round(y - 5 + Math.sin(this.t * 2) * 1.5);
    const hw = Math.max(1, Math.round(3 * w));
    ctx.fillStyle = col.dark; ctx.fillRect(x - hw - 1, y - 4, hw * 2 + 2, 8);
    ctx.fillStyle = col.coin || col.light; ctx.fillRect(x - hw, y - 3, hw * 2, 6);
    if (hw > 2) { ctx.fillStyle = col.dark; ctx.fillRect(x - 2, y - 1, 1, 2); ctx.fillRect(x + 1, y - 1, 1, 2); }
    if ((this.t * 0.7 + x * 0.01) % 2 < 0.15) { ctx.fillStyle = '#ffffff'; ctx.fillRect(x + 3, y - 6, 1, 3); ctx.fillRect(x + 2, y - 5, 3, 1); }
  }
  drawHeart(ctx, x, y) {
    const col = this.cfg.colors; x = Math.round(x); y = Math.round(y); ctx.fillStyle = col.heart || col.dark;
    ctx.fillRect(x - 3, y - 2, 2, 2); ctx.fillRect(x + 1, y - 2, 2, 2); ctx.fillRect(x - 4, y, 8, 2); ctx.fillRect(x - 3, y + 2, 6, 1); ctx.fillRect(x - 1, y + 3, 2, 1);
  }
  drawScanWorld(ctx) {
    const col = this.cfg.colors, on = Math.floor(this.t * 6) % 2;
    for (const e of this.enemies) { // מסמן אויב: חץ מעליו
      const S = this.SPR(this.cfg.era, e.type), h = S ? S.j.frameH : 24, x = Math.round(e.x), y = Math.round(e.y - h - 4 - (on ? 1 : 0));
      ctx.fillStyle = col.mark || col.dark; ctx.fillRect(x - 3, y - 4, 7, 2); ctx.fillRect(x - 2, y - 2, 5, 2); ctx.fillRect(x - 1, y, 3, 2);
      ctx.strokeStyle = col.mark || col.dark; ctx.strokeRect(x - 9.5, y + 5.5, 19, h - 2);
    }
  }
  edgeArrow(ctx, VW, VH, wx, wy, color, size = 5) {
    const sx = wx - this.cam.x, sy = wy - this.cam.y; if (sx > 8 && sy > 8 && sx < VW - 8 && sy < VH - 8) return;
    const cx = VW / 2, cy = VH / 2, a = Math.atan2(sy - cy, sx - cx), m = 10;
    const k = Math.min((VW / 2 - m) / Math.abs(Math.cos(a) || 1e-3), (VH / 2 - m) / Math.abs(Math.sin(a) || 1e-3));
    const x = cx + Math.cos(a) * k, y = cy + Math.sin(a) * k;
    ctx.save(); ctx.translate(Math.round(x), Math.round(y)); ctx.rotate(a); ctx.fillStyle = color;
    ctx.beginPath(); ctx.moveTo(size, 0); ctx.lineTo(-size, -size); ctx.lineTo(-size / 2, 0); ctx.lineTo(-size, size); ctx.closePath(); ctx.fill(); ctx.restore();
  }
  drawScanHud(ctx, VW, VH) {
    const col = this.cfg.colors;
    for (const e of this.enemies) this.edgeArrow(ctx, VW, VH, e.x, e.y - 8, col.mark || col.dark, 4);
    for (const s of this.shards) if (!s.taken) this.edgeArrow(ctx, VW, VH, s.x, s.y, col.light, 4);
    // מפה קטנה
    const m = this.mctx, img = m.createImageData(this.W, this.H), P = c2rgb;
    const map = { grass: col.mid, path: col.light, tree: col.dark, water: col.water || col.dark, wall: col.bg, castle: col.light, void: col.bg };
    for (let i = 0; i < this.map.length; i++) { const [r, g, b] = P(map[this.map[i]] || col.mid); img.data.set([r, g, b, 255], i * 4); }
    m.putImageData(img, 0, 0);
    const put = (x, y, c) => { m.fillStyle = c; m.fillRect(Math.floor(x / T), Math.floor(y / T), 1, 1); };
    for (const s of this.shards) if (!s.taken) put(s.x, s.y, col.light);
    for (const e of this.enemies) put(e.x, e.y, '#ff3d6e');
    if (Math.floor(this.t * 4) % 2) put(this.dan.x, this.dan.y, '#ffffff');
    const sc = this.W * 2 + 8 < VW * 0.5 ? 2 : 1, mw = this.W * sc, mh = this.H * sc, mx = Math.round((VW - mw) / 2), my = Math.round(VH * 0.14);
    ctx.globalAlpha = Math.min(1, pixi.scan * 2) * 0.9;
    ctx.fillStyle = col.bg; ctx.fillRect(mx - 2, my - 2, mw + 4, mh + 4);
    ctx.drawImage(this.mini, mx, my, mw, mh); ctx.globalAlpha = 1;
  }
}
const rgbCache = {};
function c2rgb(h) { if (rgbCache[h]) return rgbCache[h]; const n = parseInt(h.slice(1), 16); return (rgbCache[h] = [(n >> 16) & 255, (n >> 8) & 255, n & 255]); }
function k0(w) { if (w._wormLine) return false; w._wormLine = true; return true; }
