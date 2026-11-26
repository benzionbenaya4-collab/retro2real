// וירוסים חדשים (דו-ממד): פופ-אפ, ספאם, באג.
// popup – קופץ מול השחקן ומכסה לו את המסך עד שמכים בו (כל הנפת חרב פוגעת בו).
// spam  – כשמכים בו הוא מתפצל לשניים, עד 3 דורות.
// bug   – נגיעה בו הופכת את כיווני התנועה ל-4 שניות (אייקון אזהרה מעל השחקן).
import { dist } from './util.js';
import { audio } from './audio.js';
import { hud } from './hud.js';

export const VIRUS = { popup: { hp: 2, speed: 58, r: 6 }, spam: { hp: 1, speed: 34, r: 6 }, bug: { hp: 1, speed: 46, r: 5 } };
export const CONFUSE_TIME = 4;
const said = {};
const LINES = {
  popup: 'פופ-אפ! הוא מכסה לך את המסך – תכה בו כדי לסגור אותו!',
  spam: 'ספאם! כל מכה מפצלת אותו לשניים… תמשיך להכות עד שייגמר.',
  bug: 'זהירות מהבאג! נגיעה בו הופכת לך את הכיוונים.',
};

export function pickVirus(cfg) {
  const list = cfg.viruses || []; if (!list.length || Math.random() > (cfg.virusChance ?? 0.35)) return null;
  return list[Math.floor(Math.random() * list.length)];
}
export function virusStats(type, cfg) { const V = VIRUS[type], k = cfg.era === '16bit' ? 1.15 : 1; return { hp: V.hp, max: V.hp, speed: V.speed * k, r: V.r * k, dmg: 1, virus: true, gen: 0 }; }

/** תנועה + מגע. מחזיר true אם טופל (כדי לדלג על ההתנהגות הרגילה) */
export function updateVirus(w, e, dt) {
  const t = e.attached && e.attached.hp > 0 ? e.attached : w.nearest(e.x, e.y);
  if (!t) return true;
  if (!said[e.type] && dist(e.x, e.y, t.x, t.y) < 120) { said[e.type] = true; hud.say(LINES[e.type], 3.4); }
  if (e.type === 'popup') {
    if (e.attached) { if (e.attached.hp <= 0) { e.attached = null; return true; } e.x = e.attached.x + (e.attached.hface === 'right' ? 10 : -10); e.y = e.attached.y + 1; return true; }
    const dx = t.x - e.x, dy = t.y - e.y, L = Math.hypot(dx, dy) || 1;
    e.vx = (dx / L) * e.speed; e.vy = (dy / L) * e.speed;
    if (L < 12 && !w.players.some((p) => p !== t && e.attached === p)) { e.attached = t; audio.sfx('bolt'); w.shake = 0.15; }
    return false;
  }
  if (e.type === 'bug') { // זז בזיגזג חד
    e.turn = (e.turn ?? 0) - dt;
    if (e.turn <= 0) { e.turn = 0.35 + Math.random() * 0.4; const a = Math.atan2(t.y - e.y, t.x - e.x) + (Math.random() - 0.5) * 2.2; e.vx = Math.cos(a) * e.speed; e.vy = Math.sin(a) * e.speed; }
    for (const p of w.players) if (p.hp > 0 && dist(e.x, e.y - 4, p.x, p.y - 6) < e.r + 6 && !(p.conf > 0)) {
      p.conf = CONFUSE_TIME; audio.sfx('empty'); w.shake = 0.12; hud.say(p.id === 2 ? 'נועם: הכיוונים התהפכו! 😵' : 'הכיוונים התהפכו! 😵 עוד רגע זה עובר.', 2.4);
      const a = Math.random() * 6.28; e.x += Math.cos(a) * 40; e.y += Math.sin(a) * 40; // הבאג קופץ משם
    }
    return false;
  }
  // spam: רודף רגיל, מתנדנד קצת
  const dx = t.x - e.x, dy = t.y - e.y, L = Math.hypot(dx, dy) || 1, wob = Math.sin(e.t * 6) * 0.4;
  e.vx = (dx / L - dy / L * wob) * e.speed; e.vy = (dy / L + dx / L * wob) * e.speed;
  return false;
}
/** פגיעה במגע: רק הספאם פוגע. פופ-אפ ובאג עושים דברים אחרים */
export const virusContactDamage = (e) => e.type === 'spam';

/** אחרי שהאויב מת: ספאם מתפצל */
export function onVirusDead(w, e) {
  if (e.type !== 'spam' || e.gen >= 2) return;
  for (const s of [-1, 1]) {
    const k = w.spawnEnemy(e.x + s * 8, e.y, 'spam', { ...virusStats('spam', w.cfg), gen: e.gen + 1, rise: 0, inv: 0.35 });
    k.r = e.r * 0.8; k.speed = e.speed * 1.15; k.kx = s * 120;
  }
}

/** ציור בפיקסלים לפי פלטת העולם */
export function drawVirus(ctx, w, e, alpha = 1) {
  const col = w.cfg.colors, x = Math.round(e.x), y = Math.round(e.y), on = Math.floor(e.t * 6) % 2;
  ctx.save(); ctx.globalAlpha = alpha;
  if (e.type === 'popup') { // חלון קטן עם X
    const bob = e.attached ? 0 : Math.round(Math.sin(e.t * 8) * 2);
    ctx.fillStyle = col.dark; ctx.fillRect(x - 8, y - 18 + bob, 16, 13);
    ctx.fillStyle = col.light; ctx.fillRect(x - 7, y - 14 + bob, 14, 8);
    ctx.fillStyle = col.danger || col.dark; ctx.fillRect(x - 7, y - 17 + bob, 14, 3);
    ctx.fillStyle = col.light; ctx.fillRect(x + 4, y - 17 + bob, 2, 2);
    ctx.fillStyle = on ? (col.coin || col.mid) : col.dark; ctx.fillRect(x - 5, y - 12 + bob, 10, 2); ctx.fillRect(x - 5, y - 9 + bob, 6, 1);
  } else if (e.type === 'spam') { // מעטפה, קטנה יותר בכל דור
    const s = [1, 0.8, 0.62][e.gen || 0], hw = Math.round(7 * s), hh = Math.round(5 * s), cy = y - 6 - Math.abs(Math.round(Math.sin(e.t * 9) * 2));
    ctx.fillStyle = col.dark; ctx.fillRect(x - hw - 1, cy - hh - 1, hw * 2 + 2, hh * 2 + 2);
    ctx.fillStyle = col.light; ctx.fillRect(x - hw, cy - hh, hw * 2, hh * 2);
    ctx.fillStyle = col.danger || col.dark; for (let i = 0; i < hw; i++) { ctx.fillRect(x - hw + i, cy - hh + Math.round(i * hh / hw), 1, 1); ctx.fillRect(x + hw - 1 - i, cy - hh + Math.round(i * hh / hw), 1, 1); }
    ctx.fillStyle = col.coin || col.mid; ctx.fillRect(x + hw - 3, cy - hh + 1, 2, 2);
  } else if (e.type === 'bug') { // חיפושית עם רגליים
    const cy = y - 5;
    ctx.fillStyle = col.dark; ctx.fillRect(x - 4, cy - 4, 8, 8);
    ctx.fillStyle = col.danger || col.mid; ctx.fillRect(x - 3, cy - 3, 6, 6);
    ctx.fillStyle = col.dark; ctx.fillRect(x, cy - 3, 1, 6); ctx.fillRect(x - 2, cy - 6, 4, 2);
    for (const sy of [-2, 0, 2]) { const l = on ? 1 : 0; ctx.fillRect(x - 6, cy + sy + l, 2, 1); ctx.fillRect(x + 4, cy + sy - l, 2, 1); }
  }
  ctx.restore();
}
/** אייקון אזהרה מעל שחקן מבולבל */
export function drawConfused(ctx, w, p, h) {
  const col = w.cfg.colors, x = Math.round(p.x), y = Math.round(p.y - h - 10 + Math.sin(w.t * 8));
  ctx.fillStyle = col.dark; ctx.beginPath(); ctx.moveTo(x, y - 7); ctx.lineTo(x + 7, y + 5); ctx.lineTo(x - 7, y + 5); ctx.closePath(); ctx.fill();
  ctx.fillStyle = col.coin || col.light; ctx.beginPath(); ctx.moveTo(x, y - 5); ctx.lineTo(x + 5, y + 4); ctx.lineTo(x - 5, y + 4); ctx.closePath(); ctx.fill();
  ctx.fillStyle = col.dark; ctx.fillRect(x - 1, y - 2, 2, 4); ctx.fillRect(x - 1, y + 3, 2, 1);
}
