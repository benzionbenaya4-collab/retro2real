// ארגז הציד בדו-ממד: מלכודות, משקפת (זום החוצה + סימון), ווירוס מסתתר שמשאיר עקבות פיקסלים.
import { dist, rng } from './util.js';
import { audio } from './audio.js';
import { hud } from './hud.js';
import { pixi } from './pixi.js';
import { TRAP_STUN, TRAP_MAX, ZOOM_TIME, TRACK_TIME } from './tools.js';

const T = 16;
const PASS = ['grass', 'path'];

export function initHunt(w, m) {
  w.traps = []; w.trackT = 0; w.zoomK = 1; w.lurker = null; w.prints = [];
  const c = w.cfg; if (c.arena || !c.key) return;
  const id = `${c.key}-lurk`; if (pixi.hasCoin(id)) return;
  // מחבוא: פינה נסתרת שלא תפוסה ע"י מטבע/קלטת
  const r = rng(c.seed * 53 + 9);
  const spot = (m.hidden || []).find((h) => w.keep.every((k) => Math.hypot(k.x / T - h.x, k.y / T - h.y) > 6) && Math.hypot(h.x * T - w.dan.x, h.y * T - w.dan.y) > 14 * T);
  if (!spot) return;
  // עקבות: מסלול BFS מנקודה על השביל (8–20 אריחים מהמחבוא) עד המחבוא
  const W = w.W, H = w.H, goal = spot.y * W + spot.x;
  const starts = []; for (let i = 0; i < w.map.length; i++) { if (w.map[i] !== 'path') continue; const d = Math.hypot((i % W) - spot.x, ((i / W) | 0) - spot.y); if (d > 12 && d < 26) starts.push(i); }
  if (!starts.length) return;
  const s0 = starts[Math.floor(r() * starts.length)], prev = new Int32Array(W * H).fill(-1), q = [s0]; prev[s0] = s0;
  while (q.length) { const i = q.shift(); if (i === goal) break; const x = i % W, y = (i / W) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy, j = ny * W + nx; if (nx < 0 || ny < 0 || nx >= W || ny >= H || prev[j] >= 0 || !PASS.includes(w.base[j])) continue; prev[j] = i; q.push(j); } }
  if (prev[goal] < 0) return;
  const path = []; for (let i = goal; i !== s0; i = prev[i]) path.push(i); path.push(s0); path.reverse();
  path.forEach((i, k) => { if (k % 2 === 0 && k < path.length - 1) { const nx = path[Math.min(k + 1, path.length - 1)]; const ang = Math.atan2(((nx / W) | 0) - ((i / W) | 0), (nx % W) - (i % W)); w.prints.push({ x: (i % W) * T + 8, y: ((i / W) | 0) * T + 8, a: ang, side: (k / 2) % 2 ? 1 : -1 }); } });
  w.lurker = { id, x: spot.x * T + 8, y: spot.y * T + 10, seen: false, t: 0, caught: false };
}

export function useTool2d(w, p, key) {
  if (key === 'trap') {
    const mine = w.traps.filter((t) => t.owner === p); if (mine.length >= TRAP_MAX) w.traps.splice(w.traps.indexOf(mine[0]), 1);
    const [fx, fy] = { right: [1, 0], left: [-1, 0], down: [0, 1], up: [0, -1] }[p.face] || [0, 1];
    w.traps.push({ x: p.x + fx * 12, y: p.y + fy * 10, owner: p, t: 0 }); audio.sfx('swing'); return true;
  }
  if (key === 'binoc') { p.zoom = ZOOM_TIME; audio.sfx('scan'); return true; }
  if (key === 'tracks') {
    if (!w.lurker || w.lurker.caught) { hud.toast(p.id, '🐾 אין פה עקבות'); audio.sfx('empty'); return false; }
    w.trackT = TRACK_TIME; audio.sfx('scan'); hud.toast(p.id, '🐾 עוקבים…'); return true;
  }
  return false;
}

export function updateHunt(w, dt) {
  w.trackT = Math.max(0, (w.trackT || 0) - dt);
  for (const p of w.players) if (p.zoom > 0) p.zoom -= dt;
  // מלכודות
  for (const t of w.traps) { t.t += dt; for (const e of w.enemies) if (!e.dead && e.rise <= 0 && !(e.stun > 0) && !e.attached && dist(e.x, e.y, t.x, t.y) < 9 + e.r * 0.5) {
    e.stun = e.boss ? 1.2 : TRAP_STUN; t.used = true; audio.sfx('hit'); w.shake = 0.1; for (let k = 0; k < 8; k++) w.part(t.x, t.y - 3, w.cfg.colors.light, 0.4); break; } }
  w.traps = w.traps.filter((t) => !t.used);
  // הווירוס המסתתר: מתגלה כשמתקרבים, בורח לאט, נתפס במגע
  const L = w.lurker; if (!L || L.caught) return;
  L.t += dt; const n = w.nearest(L.x, L.y); if (!n) return;
  const d = dist(n.x, n.y, L.x, L.y);
  if (d < 56 && !L.seen) { L.seen = true; hud.say('הנה הוא! הווירוס המסתתר – תתפוס אותו!', 2.6); audio.sfx('wave'); }
  if (L.seen && d < 70) { const ax = (L.x - n.x) / (d || 1), ay = (L.y - n.y) / (d || 1); const o = { x: L.x, y: L.y, kx: 0, ky: 0 }; w.move(o, ax * 34 * dt, ay * 34 * dt, 4); L.x = o.x; L.y = o.y; }
  if (d < 11) {
    L.caught = true; audio.sfx('shard'); w.flash = 0.1; for (let k = 0; k < 16; k++) w.part(L.x, L.y - 5, w.cfg.colors.coin || w.cfg.colors.light, 0.7, 90);
    hud.banner('תפסת את הווירוס המסתתר!<small>דן, צייד אמיתי 🎯</small>', 2.2); setTimeout(() => pixi.collectCoin(L.id), 900);
  }
}

/** בתוך translate של המצלמה */
export function drawHunt(ctx, w) {
  const col = w.cfg.colors, lit = w.trackT > 0, on = Math.floor(w.t * 4) % 2;
  // עקבות: חלשות תמיד, מוארות עם הכלי
  if (w.lurker && !w.lurker.caught) for (const p of w.prints) {
    ctx.fillStyle = lit ? (on ? col.coin || col.light : col.light) : col.dark; ctx.globalAlpha = lit ? 1 : 0.45;
    const ox = Math.round(Math.cos(p.a + Math.PI / 2) * 2 * p.side), oy = Math.round(Math.sin(p.a + Math.PI / 2) * 2 * p.side);
    ctx.fillRect(Math.round(p.x) + ox - 1, Math.round(p.y) + oy - 1, 2, 2); ctx.fillRect(Math.round(p.x + Math.cos(p.a) * 2) + ox, Math.round(p.y + Math.sin(p.a) * 2) + oy, 1, 1);
  }
  ctx.globalAlpha = 1;
  // מלכודות
  for (const t of w.traps) { const x = Math.round(t.x), y = Math.round(t.y); ctx.fillStyle = col.dark; ctx.fillRect(x - 5, y - 2, 10, 4); ctx.fillStyle = col.light; for (let i = -4; i <= 3; i += 2) ctx.fillRect(x + i, y - 3 - (i % 4 === 0 ? 1 : 0), 1, 2); ctx.fillStyle = col.coin || col.mid; ctx.fillRect(x - 1, y - 1, 2, 2); }
  // הווירוס המסתתר: מהבהב חלש עד שמתגלה
  const L = w.lurker;
  if (L && !L.caught) {
    const vis = L.seen ? 1 : (Math.sin(L.t * 2) > 0.85 ? 0.35 : 0);
    if (vis > 0) { const x = Math.round(L.x), y = Math.round(L.y - 6 + Math.sin(L.t * 5) * 1.5); ctx.globalAlpha = vis;
      ctx.fillStyle = col.dark; ctx.fillRect(x - 5, y - 5, 10, 9); ctx.fillStyle = on ? col.coin || col.light : col.light; ctx.fillRect(x - 4, y - 4, 8, 6);
      ctx.fillStyle = col.dark; ctx.fillRect(x - 2, y - 2, 1, 2); ctx.fillRect(x + 1, y - 2, 1, 2); for (let i = -4; i < 4; i += 2) ctx.fillRect(x + i, y + 2, 1, 2); ctx.globalAlpha = 1; }
  }
}
/** כוכבים מעל אויב משותק */
export function drawStun(ctx, w, e, h) {
  const col = w.cfg.colors, x = Math.round(e.x), y = Math.round(e.y - h - 3);
  for (let i = 0; i < 3; i++) { const a = w.t * 5 + i * 2.1; ctx.fillStyle = i % 2 ? col.light : col.coin || col.light; ctx.fillRect(Math.round(x + Math.cos(a) * 6), Math.round(y + Math.sin(a) * 2), 2, 2); }
}
/** מסך: משקפת – סימון אויבים וקלטות קרובים; עקבות – חץ לכיוון המחבוא */
export function drawHuntHud(ctx, w, VW, VH, focus) {
  const col = w.cfg.colors, ps = focus ? [focus] : w.players;
  if (ps.some((p) => p.zoom > 0)) {
    const near = (x, y) => ps.some((p) => dist(p.x, p.y, x, y) < 260);
    for (const e of w.enemies) if (!e.dead && near(e.x, e.y)) { const sx = e.x - w.cam.x, sy = e.y - w.cam.y - 30; ctx.strokeStyle = col.mark || col.dark; ctx.strokeRect(Math.round(sx) - 8.5, Math.round(sy) + 8.5, 17, 20); }
    for (const t of w.tapes) if (near(t.x, t.y)) { const sx = t.x - w.cam.x, sy = t.y - w.cam.y; ctx.strokeStyle = col.coin || col.light; ctx.strokeRect(Math.round(sx) - 9.5, Math.round(sy) - 11.5, 19, 15); w.edgeArrow(ctx, VW, VH, t.x, t.y, col.coin || col.light, 4); }
  }
  if (w.trackT > 0 && w.lurker && !w.lurker.caught) w.edgeArrow(ctx, VW, VH, w.lurker.x, w.lurker.y, col.coin || col.light, 5);
}
