// אזורי void גדולים: לא נעלמים מעצמם, ושברי קוד לא מחזירים אותם.
// לכל אזור משימה קטנה: להביס גל (wave), למצוא חלק אבוד (part) או להגן על נקודה (defend).
// משימה שהושלמה מחזירה את האזור ומשאירה מטבע קוד.
import { rng, dist } from './util.js';
import { audio } from './audio.js';
import { hud } from './hud.js';
import { pixi } from './pixi.js';

const T = 16, RAD = 2.6, DEFEND_TIME = 20;
const INTRO = {
  wave: 'האזור הזה לא יחזור לבד. משהו זז שם בפנים… תביס את מה שיוצא ממנו!',
  part: 'חסר פה חלק מהקוד של העולם. מצא את החלק האבוד והחזר אותו לכאן.',
  defend: 'בנית לי נקודת שחזור! תגן עליה עד שהיא מסיימת לטעון, והאזור יחזור.',
};

export function createZones(w) {
  const c = w.cfg, types = c.zones || []; w.zones = []; w.zoneOf = new Int8Array(w.W * w.H).fill(-1);
  if (!types.length) return;
  const r = rng(c.seed * 31 + 5), far = (x, y, list, d) => list.every((p) => Math.hypot(p.x / T - x, p.y / T - y) > d);
  for (const type of types) {
    for (let tries = 0; tries < 400; tries++) {
      const cx = 5 + Math.floor(r() * (w.W - 10)), cy = 5 + Math.floor(r() * (w.H - 10));
      if (Math.hypot(cx * T - w.dan.x, cy * T - w.dan.y) < 11 * T) continue;
      if (w.gate && Math.hypot(cx - w.gate.x, cy - w.gate.y) < 7) continue;
      if (!far(cx, cy, w.shards, 5) || !far(cx, cy, w.keep, 5) || w.zones.some((z) => Math.hypot(z.cx - cx, z.cy - cy) < 9)) continue;
      let ok = true;
      for (let y = -4; y <= 4 && ok; y++) for (let x = -4; x <= 4; x++) if (Math.hypot(x, y) <= RAD + 1.5 && ['path', 'castle', 'wall'].includes(w.base[(cy + y) * w.W + cx + x])) { ok = false; break; }
      if (!ok) continue;
      const z = { i: w.zones.length, type, cx, cy, x: cx * T + 8, y: cy * T + 8, state: 'idle', cool: 0, cells: [] };
      for (let y = -3; y <= 3; y++) for (let x = -3; x <= 3; x++) if (Math.hypot(x, y) <= RAD) { const i = (cy + y) * w.W + cx + x; w.map[i] = 'void'; w.zoneOf[i] = z.i; z.cells.push(i); }
      w.zones.push(z); break;
    }
  }
  w.voidMax += w.zones.reduce((n, z) => n + z.cells.length, 0);
}

function begin(w, z) {
  z.state = 'active'; z.t = 0; audio.sfx('wave');
  hud.say(INTRO[z.type], 4); hud.banner('משימה<small>' + { wave: 'הבס את הגל', part: 'מצא את החלק האבוד', defend: 'הגן על הנקודה' }[z.type] + '</small>', 2);
  if (z.type === 'wave') { z.left = 4 + (w.cfg.era === '16bit' ? 2 : 0); z.spawnT = 0.5; }
  if (z.type === 'part') {
    // החלק האבוד: על שביל רחוק מהאזור
    const cand = []; for (let i = 0; i < w.map.length; i++) if (w.map[i] === 'path') { const x = i % w.W, y = (i / w.W) | 0; const d = Math.hypot(x - z.cx, y - z.cy); if (d > 12) cand.push({ x, y, d }); }
    const p = cand.length ? cand[Math.floor(Math.random() * cand.length)] : { x: 4, y: 4 };
    z.part = { x: p.x * T + 8, y: p.y * T + 10, carried: false };
  }
  if (z.type === 'defend') {
    // הנקודה: אריח לא-void צמוד לאזור, בצד הקרוב לדן
    const a = Math.atan2(w.dan.y - z.y, w.dan.x - z.x);
    z.beacon = { x: z.x + Math.cos(a) * (RAD + 1.6) * T, y: z.y + Math.sin(a) * (RAD + 1.6) * T + 4, hp: 6, max: 6, dead: false };
    z.spawnT = 1.5;
  }
}

function complete(w, z) {
  z.state = 'done'; audio.sfx('shard'); w.flash = 0.1;
  for (const i of z.cells) { if (w.map[i] === 'void') w.map[i] = w.base[i]; w.zoneOf[i] = -1; for (let k = 0; k < 2; k++) w.part((i % w.W) * T + 8, ((i / w.W) | 0) * T + 8, w.cfg.colors.light, 0.8); }
  hud.banner('האזור חזר!<small>המשימה הושלמה</small>', 2);
  const id = `${w.cfg.key}-z${z.i}`;
  if (!pixi.hasCoin(id)) w.coins.push({ id, x: z.x, y: z.y + 4, taken: false });
  setTimeout(() => hud.say('האזור חזר! ונראה לי שמשהו נוצץ שם באמצע…', 3), 600);
}

function fail(w, z) {
  z.state = 'idle'; z.cool = 4; hud.say('הנקודה נפלה… ננסה שוב? תתקרב לאזור כשאתה מוכן.', 3); audio.sfx('empty');
  for (const e of w.enemies) if (e.zone === z) { e.dead = true; for (let k = 0; k < 6; k++) w.part(e.x, e.y - 4, w.cfg.colors.dark, 0.5); }
  z.beacon = null;
}

export function updateZones(w, dt) {
  if (!w.zones?.length) return;
  for (const z of w.zones) {
    if (z.state === 'done') continue;
    const d = w.nearest ? (w.nearest(z.x, z.y) || w.dan) : w.dan;
    if (z.state === 'idle') { z.cool -= dt; if (z.cool <= 0 && dist(d.x, d.y, z.x, z.y) < (RAD + 3) * T) begin(w, z); continue; }
    z.t += dt;
    const edge = () => { const a = Math.random() * 6.28; return [z.x + Math.cos(a) * RAD * 0.6 * T, z.y + Math.sin(a) * RAD * 0.6 * T + 4]; };
    if (z.type === 'wave') {
      z.spawnT -= dt;
      if (z.left > 0 && z.spawnT <= 0) { const [x, y] = edge(); w.spawnEnemy(x, y, w.cfg.enemy.name, { zone: z }); z.left--; z.spawnT = 0.8; }
      if (z.left === 0 && !w.enemies.some((e) => e.zone === z && !e.dead)) complete(w, z);
    } else if (z.type === 'part') {
      const p = z.part;
      const pk = !p.carried && (w.players || [w.dan]).find((q) => q.hp > 0 && dist(q.x, q.y, p.x, p.y) < 11);
      if (pk) { p.carried = pk; audio.sfx('heart'); hud.say('מצאת! עכשיו תחזיר אותו לאזור.', 2.4); }
      if (p.carried) { const cr = p.carried; p.x = cr.x; p.y = cr.y - 26; if (dist(cr.x, cr.y, z.x, z.y) < (RAD + 1.6) * T) complete(w, z); }
    } else if (z.type === 'defend') {
      const b = z.beacon; z.spawnT -= dt;
      if (z.spawnT <= 0) { const [x, y] = edge(); w.spawnEnemy(x, y, w.cfg.enemy.name, { zone: z, tgt: b, rise: 0.3 }); z.spawnT = w.cfg.era === '16bit' ? 2 : 2.6; }
      for (const e of w.enemies) if (e.zone === z && !e.dead && e.rise <= 0 && dist(e.x, e.y, b.x, b.y) < 10) {
        e.dead = true; b.hp--; w.shake = 0.15; audio.sfx('hurt'); for (let k = 0; k < 6; k++) w.part(b.x, b.y - 6, w.cfg.colors.danger || w.cfg.colors.dark, 0.5);
      }
      if (b.hp <= 0) fail(w, z);
      else if (z.t >= DEFEND_TIME) { for (const e of w.enemies) if (e.zone === z) e.dead = true; complete(w, z); }
    }
  }
}

/** ציור על המפה (בתוך translate של המצלמה) */
export function drawZones(ctx, w) {
  if (!w.zones?.length) return;
  const col = w.cfg.colors, on = Math.floor(w.t * 3) % 2;
  for (const z of w.zones) {
    if (z.state === 'done') continue;
    const x = Math.round(z.x), y = Math.round(z.y - RAD * T - 6 + Math.sin(w.t * 3) * 2);
    if (z.state === 'idle') { // סימן קריאה מעל האזור
      ctx.fillStyle = col.dark; ctx.fillRect(x - 3, y - 10, 6, 14);
      ctx.fillStyle = on ? col.light : (col.coin || col.mid); ctx.fillRect(x - 1, y - 8, 2, 6); ctx.fillRect(x - 1, y, 2, 2);
    }
    if (z.state === 'active' && z.type === 'part' && !z.part.carried) drawPart(ctx, w, z.part.x, z.part.y);
    if (z.state === 'active' && z.type === 'part' && z.part.carried) drawPart(ctx, w, z.part.x, z.part.y);
    if (z.state === 'active' && z.type === 'defend') {
      const b = z.beacon, bx = Math.round(b.x), by = Math.round(b.y);
      ctx.fillStyle = col.dark; ctx.fillRect(bx - 5, by - 14, 10, 14); ctx.fillStyle = on ? col.light : col.mid; ctx.fillRect(bx - 3, by - 12, 6, 4);
      ctx.fillStyle = col.light; ctx.fillRect(bx - 1, by - 22 - (on ? 1 : 0), 2, 6);
      // התקדמות + חיים
      const pw = 18; ctx.fillStyle = col.bg; ctx.fillRect(bx - pw / 2 - 1, by - 30, pw + 2, 6);
      ctx.fillStyle = col.light; ctx.fillRect(bx - pw / 2, by - 29, Math.round(pw * Math.min(1, z.t / DEFEND_TIME)), 2);
      ctx.fillStyle = col.danger || col.dark; ctx.fillRect(bx - pw / 2, by - 26, Math.round(pw * b.hp / b.max), 1);
    }
  }
}
function drawPart(ctx, w, x, y) { // חלק אבוד: גלגל שיניים קטן
  const col = w.cfg.colors; x = Math.round(x); y = Math.round(y - 6 + Math.sin(w.t * 4) * 1.5);
  ctx.fillStyle = col.dark; ctx.fillRect(x - 4, y - 4, 8, 8); ctx.fillRect(x - 6, y - 1, 12, 2); ctx.fillRect(x - 1, y - 6, 2, 12);
  ctx.fillStyle = col.coin || col.light; ctx.fillRect(x - 3, y - 3, 6, 6); ctx.fillStyle = col.dark; ctx.fillRect(x - 1, y - 1, 2, 2);
}

/** חצים בקצה המסך: אל החלק האבוד / אל האזור כשנושאים אותו / אל הנקודה */
export function zoneArrows(ctx, w, VW, VH) {
  if (!w.zones?.length) return;
  const col = w.cfg.colors;
  for (const z of w.zones) {
    if (z.state !== 'active') continue;
    if (z.type === 'part') { const p = z.part; if (p.carried) w.edgeArrow(ctx, VW, VH, z.x, z.y, col.coin || col.light, 5); else w.edgeArrow(ctx, VW, VH, p.x, p.y, col.coin || col.light, 5); }
    if (z.type === 'defend') w.edgeArrow(ctx, VW, VH, z.beacon.x, z.beacon.y, col.light, 5);
  }
}
