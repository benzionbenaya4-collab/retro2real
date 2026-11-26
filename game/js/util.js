// כלים קטנים משותפים
export const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));
export const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
export function rng(seed) { // mulberry32 – מפות דטרמיניסטיות
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
export const $ = (s) => document.querySelector(s);

/** האם מכולת המשחק מסובבת 90° (טלפון נעול בכיוון הלא נכון למצב השניים) */
export const rotated = () => document.body.classList.contains('rot90');
/** גודל המסך כפי שהמשחק רואה אותו (אחרי סיבוב) */
export const viewW = () => (rotated() ? innerHeight : innerWidth);
export const viewH = () => (rotated() ? innerWidth : innerHeight);
/** הזזה במסך → הזזה בתוך המכולה המסובבת (סיבוב 90° עם כיוון השעון) */
export const mapDelta = (dx, dy) => (rotated() ? [dy, -dx] : [dx, dy]);
