// קלטות: מיני-משחקים במסך מלא. parkour · catch · maze · snake (קלטת הזהב).
// כל משחק: update(dt, inp) → 'win' | 'lose' | null, draw(ctx, W, H). רזולוציה פנימית נמוכה, פיקסלים.
import { SPR, drawSpr } from './assets.js';
import { audio } from './audio.js';
import { clamp, rng } from './util.js';

export const TAPES = {
  parkour: { title: 'פארקור קוד', px: 'TAPE: RUN', hint: 'חצים – ריצה · A – קפיצה. הגע לדגל!' },
  catch: { title: 'גשם שברים', px: 'TAPE: CATCH', hint: 'תפוס 12 שברי קוד. אל תתפוס באגים!' },
  maze: { title: 'מבוך התולעת', px: 'TAPE: MAZE', hint: 'צא מהמבוך לפני שהתולעת תופסת אותך.' },
  snake: { title: 'נחש הבייטים', px: 'GOLD TAPE', hint: 'אסוף 10 בייטים. אל תתנגש בקיר או בזנב.' },
};

const PAL = { bg: '#0b0a14', ink: '#efe9f7', grn: '#7dff9b', dk: '#1f6b3a', red: '#ff3d6e', gold: '#ffcf4a', cyan: '#6fe3ff', grey: '#3a3550' };
const dirOf = (inp) => (Math.hypot(inp.x, inp.y) < 0.35 ? null : Math.abs(inp.x) > Math.abs(inp.y) ? [Math.sign(inp.x), 0] : [0, Math.sign(inp.y)]);

export function makeMini(kind, era) {
  const G = { parkour: Parkour, catch: Catch, maze: Maze, snake: Snake }[kind];
  return new G(era);
}

// ---------- פארקור ----------
class Parkour {
  constructor(era) {
    this.era = era; const r = rng(77); this.plats = []; let x = 0;
    this.plats.push({ x: -40, y: 120, w: 160, h: 60 }); x = 140; let py = 120;
    while (x < 1500) {
      // קפיצה: גובה מקס' ~37px, מרחק ~65px. מדרגה למעלה עד 26px ורווח עד 50px – תמיד אפשרי
      const gap = 24 + r() * 26, w = 40 + r() * 70, y = Math.max(py - 26, Math.min(132, 88 + Math.round(r() * 44))); py = y;
      x += gap; this.plats.push({ x, y, w, h: 200 - y });
      if (r() < 0.35) this.plats.push({ x: x + w * 0.3, y: y - 30, w: 26, h: 8, float: true });
      x += w;
    }
    this.goal = x + 30; this.plats.push({ x: x + 10, y: 110, w: 120, h: 90 });
    this.p = { x: 20, y: 100, vx: 0, vy: 0, on: false, f: 1 }; this.cp = { x: 20, y: 100 }; this.t = 0; this.falls = 0; this.cam = 0;
  }
  update(dt, inp) {
    const p = this.p; this.t += dt;
    p.vx = inp.x * 95; if (inp.x) p.f = Math.sign(inp.x);
    if ((inp.aPressed || inp.y < -0.6 && !this.upHeld) && p.on) { p.vy = -205; p.on = false; audio.sfx('swing'); }
    this.upHeld = inp.y < -0.6;
    p.vy = Math.min(320, p.vy + 560 * dt);
    p.x += p.vx * dt;
    for (const q of this.plats) if (p.x + 5 > q.x && p.x - 5 < q.x + q.w && p.y > q.y && p.y - 14 < q.y + q.h) { p.x = p.vx > 0 ? q.x - 5 : q.x + q.w + 5; }
    p.y += p.vy * dt; p.on = false;
    for (const q of this.plats) if (p.x + 4 > q.x && p.x - 4 < q.x + q.w) {
      if (p.vy >= 0 && p.y >= q.y && p.y - p.vy * dt <= q.y + 1) { p.y = q.y; p.vy = 0; p.on = true; if (!q.float && p.x > this.cp.x + 200) this.cp = { x: q.x + 10, y: q.y }; }
      else if (p.vy < 0 && p.y - 16 < q.y + q.h && p.y - 16 - p.vy * dt >= q.y + q.h && !q.float) { p.vy = 0; }
    }
    if (p.y > 220) { this.falls++; audio.sfx('hurt'); Object.assign(p, { x: this.cp.x, y: this.cp.y - 2, vx: 0, vy: 0 }); }
    p.x = Math.max(0, p.x);
    if (p.x >= this.goal) return 'win';
    return null;
  }
  draw(ctx, W, H) {
    const p = this.p; this.cam += (clamp(p.x - W * 0.35, 0, this.goal + 120 - W) - this.cam) * 0.15;
    const oy = Math.round((H - 180) / 2), cx = Math.round(this.cam);
    ctx.fillStyle = PAL.bg; ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 40; i++) { ctx.fillStyle = i % 3 ? PAL.grey : PAL.dk; ctx.fillRect(((i * 53 - cx * 0.3) % (W + 20) + W + 20) % (W + 20), oy + (i * 37) % 90, 2, 2); }
    ctx.save(); ctx.translate(-cx, oy);
    for (const q of this.plats) { ctx.fillStyle = q.float ? PAL.cyan : PAL.dk; ctx.fillRect(Math.round(q.x), q.y, Math.round(q.w), q.h); ctx.fillStyle = PAL.grn; ctx.fillRect(Math.round(q.x), q.y, Math.round(q.w), 2); }
    ctx.fillStyle = PAL.ink; ctx.fillRect(this.goal, 70, 2, 40); ctx.fillStyle = Math.floor(this.t * 4) % 2 ? PAL.gold : PAL.red; ctx.fillRect(this.goal + 2, 70, 14, 9);
    const S = SPR[`${this.era}/dan`];
    if (S) drawSpr(ctx, S, !p.on ? 'idle' : Math.abs(p.vx) > 1 ? (p.f > 0 ? 'walk_right' : 'walk_left') : 'idle', this.t, p.x, p.y + 1, 1, this.era === '16bit' ? 0.75 : 1);
    else { ctx.fillStyle = PAL.red; ctx.fillRect(p.x - 5, p.y - 14, 10, 14); }
    ctx.restore();
    bar(ctx, W, `${Math.min(100, Math.round(100 * p.x / this.goal))}%`);
  }
}

// ---------- גשם שברים ----------
class Catch {
  constructor() { this.x = 0.5; this.items = []; this.t = 0; this.spawn = 0.6; this.got = 0; this.lives = 3; this.need = 12; this.r = rng(5); }
  update(dt, inp) {
    this.t += dt; this.x = clamp(this.x + inp.x * dt * 0.75, 0.05, 0.95); this.spawn -= dt;
    if (this.spawn <= 0) { this.spawn = Math.max(0.35, 0.8 - this.t * 0.012); const bug = this.r() < 0.28; this.items.push({ x: 0.05 + this.r() * 0.9, y: -0.05, v: 0.28 + this.r() * 0.18 + this.t * 0.004, bug }); }
    for (const it of this.items) {
      it.y += it.v * dt;
      if (!it.done && it.y > 0.86 && it.y < 0.94 && Math.abs(it.x - this.x) < 0.075) { it.done = true; if (it.bug) { this.lives--; audio.sfx('hurt'); } else { this.got++; audio.sfx('heart'); } }
      if (!it.done && it.y > 1.02) { it.done = true; if (!it.bug) { this.lives--; audio.sfx('empty'); } }
    }
    this.items = this.items.filter((i) => !i.done);
    if (this.got >= this.need) return 'win';
    if (this.lives <= 0) return 'lose';
    return null;
  }
  draw(ctx, W, H) {
    ctx.fillStyle = PAL.bg; ctx.fillRect(0, 0, W, H);
    for (const it of this.items) {
      const x = Math.round(it.x * W), y = Math.round(it.y * H);
      if (it.bug) { ctx.fillStyle = PAL.red; ctx.fillRect(x - 4, y - 3, 8, 6); ctx.fillStyle = PAL.bg; ctx.fillRect(x - 2, y - 1, 1, 1); ctx.fillRect(x + 1, y - 1, 1, 1); ctx.fillStyle = PAL.red; ctx.fillRect(x - 6, y - 4, 2, 1); ctx.fillRect(x + 4, y - 4, 2, 1); }
      else { ctx.fillStyle = PAL.grn; ctx.fillRect(x - 1, y - 5, 2, 10); ctx.fillRect(x - 3, y - 3, 6, 6); ctx.fillRect(x - 5, y - 1, 10, 2); }
    }
    const bx = Math.round(this.x * W), by = Math.round(H * 0.9);
    ctx.fillStyle = PAL.cyan; ctx.fillRect(bx - 12, by, 24, 3); ctx.fillRect(bx - 12, by - 6, 2, 6); ctx.fillRect(bx + 10, by - 6, 2, 6);
    const S = SPR['16bit/pixi']; if (S) drawSpr(ctx, S, 'idle', this.t, bx, by + 2 - 6, 1, 0.5);
    bar(ctx, W, `◆ ${this.got}/${this.need}   ${'♥'.repeat(Math.max(0, this.lives))}`);
  }
}

// ---------- מבוך עם תולעת רודפת ----------
class Maze {
  constructor() {
    const C = 13, R = 9, r = rng(1313); this.C = C; this.R = R;
    this.walls = Array.from({ length: C * R }, () => [1, 1, 1, 1]); // N E S W
    const seen = new Uint8Array(C * R), st = [0]; seen[0] = 1;
    const D = [[0, -1, 0, 2], [1, 0, 1, 3], [0, 1, 2, 0], [-1, 0, 3, 1]];
    while (st.length) {
      const c = st[st.length - 1], x = c % C, y = (c / C) | 0;
      const n = D.filter(([dx, dy]) => { const nx = x + dx, ny = y + dy; return nx >= 0 && ny >= 0 && nx < C && ny < R && !seen[ny * C + nx]; });
      if (!n.length) { st.pop(); continue; }
      const [dx, dy, a, b] = n[Math.floor(r() * n.length)], j = (y + dy) * C + x + dx;
      this.walls[c][a] = 0; this.walls[j][b] = 0; seen[j] = 1; st.push(j);
    }
    for (let k = 0; k < 10; k++) { const c = Math.floor(r() * C * R), x = c % C; if (x < C - 1) { this.walls[c][1] = 0; this.walls[c + 1][3] = 0; } } // לולאות קטנות
    this.p = { cx: 0, cy: 0, x: 0, y: 0 }; this.w = { cx: C - 1, cy: 0, x: C - 1, y: 0, wait: 2.2 }; this.exit = { cx: C - 1, cy: R - 1 }; this.t = 0; this.pd = null;
  }
  open(cx, cy, dx, dy) { const w = this.walls[cy * this.C + cx]; return !(dx === 1 ? w[1] : dx === -1 ? w[3] : dy === 1 ? w[2] : w[0]); }
  step(o, dir, sp, dt) { // תזוזה רציפה בין תאים
    if (o.mv) { o.k += sp * dt; if (o.k >= 1) { o.cx += o.mv[0]; o.cy += o.mv[1]; o.mv = null; } }
    if (!o.mv && dir && this.open(o.cx, o.cy, dir[0], dir[1])) { o.mv = dir; o.k = 0; }
    o.x = o.cx + (o.mv ? o.mv[0] * o.k : 0); o.y = o.cy + (o.mv ? o.mv[1] * o.k : 0);
  }
  chaseDir() { // BFS מהתולעת לשחקן
    const C = this.C, R = this.R, prev = new Int16Array(C * R).fill(-1), s = this.w.cy * C + this.w.cx, g = this.p.cy * C + this.p.cx, q = [s]; prev[s] = s;
    while (q.length) { const c = q.shift(); if (c === g) break; const x = c % C, y = (c / C) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= C || ny >= R || !this.open(x, y, dx, dy)) continue; const j = ny * C + nx; if (prev[j] < 0) { prev[j] = c; q.push(j); } } }
    let c = g; if (prev[g] < 0) return null; while (prev[c] !== s && c !== s) c = prev[c];
    return [(c % C) - this.w.cx, ((c / C) | 0) - this.w.cy];
  }
  update(dt, inp) {
    this.t += dt; const d = dirOf(inp); if (d) this.pd = d;
    this.step(this.p, d || null, 5, dt);
    if (this.w.wait > 0) this.w.wait -= dt; else this.step(this.w, this.chaseDir(), 2.9 + this.t * 0.03, dt);
    if (Math.hypot(this.p.x - this.w.x, this.p.y - this.w.y) < 0.55) return 'lose';
    if (this.p.cx === this.exit.cx && this.p.cy === this.exit.cy && !this.p.mv) return 'win';
    return null;
  }
  draw(ctx, W, H) {
    ctx.fillStyle = PAL.bg; ctx.fillRect(0, 0, W, H);
    const s = Math.floor(Math.min((W - 8) / this.C, (H - 40) / this.R)), ox = Math.round((W - s * this.C) / 2), oy = Math.round((H - s * this.R) / 2) + 14;
    ctx.fillStyle = PAL.dk;
    for (let y = 0; y < this.R; y++) for (let x = 0; x < this.C; x++) { const w = this.walls[y * this.C + x], X = ox + x * s, Y = oy + y * s; if (w[0]) ctx.fillRect(X, Y, s + 1, 1); if (w[3]) ctx.fillRect(X, Y, 1, s + 1); if (x === this.C - 1 && w[1]) ctx.fillRect(X + s, Y, 1, s + 1); if (y === this.R - 1 && w[2]) ctx.fillRect(X, Y + s, s + 1, 1); }
    ctx.fillStyle = Math.floor(this.t * 4) % 2 ? PAL.gold : PAL.grn; ctx.fillRect(ox + this.exit.cx * s + 2, oy + this.exit.cy * s + 2, s - 3, s - 3);
    const dot = (o, c, r) => { ctx.fillStyle = c; ctx.fillRect(Math.round(ox + (o.x + 0.5) * s - r), Math.round(oy + (o.y + 0.5) * s - r), r * 2, r * 2); };
    dot(this.w, PAL.red, Math.max(2, s / 3)); ctx.fillStyle = PAL.bg; ctx.fillRect(Math.round(ox + (this.w.x + 0.5) * s) - 1, Math.round(oy + (this.w.y + 0.5) * s) - 1, 2, 1);
    dot(this.p, PAL.cyan, Math.max(2, s / 3.2));
    bar(ctx, W, this.w.wait > 0 ? 'התולעת מתעוררת…' : 'רוץ!');
  }
}

// ---------- קלטת הזהב: נחש הבייטים ----------
class Snake {
  constructor() { this.C = 20; this.R = 13; this.body = [[6, 6], [5, 6], [4, 6]]; this.dir = [1, 0]; this.next = [1, 0]; this.tick = 0; this.t = 0; this.need = 10; this.ate = 0; this.r = rng(99); this.place(); }
  place() { do { this.food = [Math.floor(this.r() * this.C), Math.floor(this.r() * this.R)]; } while (this.body.some((b) => b[0] === this.food[0] && b[1] === this.food[1])); this.bit = this.r() < 0.5 ? '0' : '1'; }
  update(dt, inp) {
    this.t += dt; const d = dirOf(inp);
    if (d && !(d[0] === -this.dir[0] && d[1] === -this.dir[1])) this.next = d;
    this.tick += dt; const sp = Math.max(0.08, 0.16 - this.ate * 0.006);
    if (this.tick < sp) return null; this.tick = 0; this.dir = this.next;
    const h = [this.body[0][0] + this.dir[0], this.body[0][1] + this.dir[1]];
    if (h[0] < 0 || h[1] < 0 || h[0] >= this.C || h[1] >= this.R || this.body.some((b) => b[0] === h[0] && b[1] === h[1])) return 'lose';
    this.body.unshift(h);
    if (h[0] === this.food[0] && h[1] === this.food[1]) { this.ate++; audio.sfx('shard'); if (this.ate >= this.need) return 'win'; this.place(); } else this.body.pop();
    return null;
  }
  draw(ctx, W, H) {
    ctx.fillStyle = '#120c02'; ctx.fillRect(0, 0, W, H);
    const s = Math.floor(Math.min((W - 8) / this.C, (H - 40) / this.R)), ox = Math.round((W - s * this.C) / 2), oy = Math.round((H - s * this.R) / 2) + 14;
    ctx.strokeStyle = PAL.gold; ctx.strokeRect(ox - 1.5, oy - 1.5, s * this.C + 3, s * this.R + 3);
    for (let y = 0; y < this.R; y++) for (let x = 0; x < this.C; x++) if ((x + y) % 2) { ctx.fillStyle = '#1c1404'; ctx.fillRect(ox + x * s, oy + y * s, s, s); }
    this.body.forEach(([x, y], i) => { ctx.fillStyle = i === 0 ? PAL.gold : i % 2 ? '#c99a1e' : '#e8b83a'; ctx.fillRect(ox + x * s + 1, oy + y * s + 1, s - 2, s - 2); });
    const [hx, hy] = this.body[0]; ctx.fillStyle = '#120c02'; ctx.fillRect(ox + hx * s + Math.floor(s / 2) - 2 + this.dir[0] * 2, oy + hy * s + Math.floor(s / 2) - 2 + this.dir[1] * 2, 2, 2);
    ctx.fillStyle = Math.floor(this.t * 5) % 2 ? PAL.cyan : '#ffffff'; ctx.font = `${s}px "Press Start 2P", monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(this.bit, ox + this.food[0] * s + s / 2, oy + this.food[1] * s + s / 2 + 1);
    bar(ctx, W, `BYTES ${this.ate}/${this.need}`, PAL.gold);
  }
}

function bar(ctx, W, text, color = PAL.ink) {
  ctx.save(); ctx.font = '8px "Press Start 2P", monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.direction = 'ltr';
  ctx.fillStyle = '#000'; ctx.fillText(text, W / 2 + 1, 19); ctx.fillStyle = color; ctx.fillText(text, W / 2, 18); ctx.restore();
}
