// קלט: מקלדת + ג'ויסטיק מגע + כפתורי A / פיקסי.
// שחקן שני (coop) על אותו מכשיר: שחקן 1 = WASD + J, שחקן 2 = חצים + Enter.
// בטלפון: מסך מפוצל – ג'ויסטיק ו-A משמאל לשחקן 1, ומימין לשחקן 2.
import { $ } from './util.js';

const mk = () => ({ x: 0, y: 0, a: false, aPressed: false, toolPressed: false, toolSwitch: false, cam: { dx: 0, dy: 0 }, camKey: { x: 0, y: 0 } });
export const input = { x: 0, y: 0, a: false, aPressed: false, toolPressed: false, toolSwitch: false, pixiPressed: false, startPressed: false, pausePressed: false, touch: false, coop: false, coopMode: null, mode3d: false, p2: mk(), cam: { dx: 0, dy: 0 }, camKey: { x: 0, y: 0 } };
const keys = new Set();
// קודי מקשים → פעולה, לפי מצב
// חצים = 'al/ar/au/ad': בדו-ממד הולכים, בתלת-ממד מסובבים מצלמה
const SOLO = { ArrowLeft: 'al', KeyA: 'l', ArrowRight: 'ar', KeyD: 'r', ArrowUp: 'au', KeyW: 'u', ArrowDown: 'ad', KeyS: 'd', Space: 'a', KeyJ: 'a', KeyZ: 'a', KeyK: 'p', KeyP: 'p', KeyX: 'p', KeyQ: 't', KeyE: 'ts', Enter: 'start', Escape: 'pause' };
// ארגז הציד: Q = להשתמש בכלי, E = להחליף כלי
// בשניים: דן – כלי Q/E, מצלמה Z/C · נועם – כלי / ו-', מצלמה , ו-. (או 4/6 במקלדת המספרים)
const COOP = { KeyA: 'l', KeyD: 'r', KeyW: 'u', KeyS: 'd', KeyJ: 'a', Space: 'a', KeyK: 'p', KeyP: 'p', KeyQ: 't', KeyE: 'ts', KeyZ: 'cl', KeyC: 'cr', Escape: 'pause', Slash: 't2', Quote: 'ts2', Backslash: 'p',
  ArrowLeft: 'l2', ArrowRight: 'r2', ArrowUp: 'u2', ArrowDown: 'd2', Enter: 'a2', NumpadEnter: 'a2', ShiftRight: 'a2', Comma: 'cl2', Period: 'cr2', Numpad4: 'cl2', Numpad6: 'cr2', Numpad0: 'p' };
const map = () => (input.coop ? COOP : SOLO);
addEventListener('keydown', (e) => {
  const k = map()[e.code]; if (!k) return;
  if (e.target && e.target.tagName === 'BUTTON' && (k === 'a' || k === 'start' || k === 'a2')) return; // לחיצה על כפתור בתפריט
  e.preventDefault();
  if (!keys.has(k)) {
    if (k === 'a') input.aPressed = true; if (k === 'a2') input.p2.aPressed = true; if (k === 'p') input.pixiPressed = true;
    if (k === 't') input.toolPressed = true; if (k === 'ts') input.toolSwitch = true; if (k === 't2') input.p2.toolPressed = true; if (k === 'ts2') input.p2.toolSwitch = true;
    if (k === 'start') input.startPressed = true; if (k === 'pause') input.pausePressed = true;
  }
  keys.add(k);
});
addEventListener('keyup', (e) => { const k = (SOLO[e.code] && keys.has(SOLO[e.code]) && SOLO[e.code]) || map()[e.code]; if (k) keys.delete(k); const k2 = COOP[e.code]; if (k2) keys.delete(k2); });
addEventListener('blur', () => keys.clear());

const sticks = [{ id: null, x: 0, y: 0 }, { id: null, x: 0, y: 0 }], aTouch = [false, false];
function bindStick(el, st) {
  const knob = el.querySelector('i');
  const move = (e) => {
    const r = el.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, R = r.width / 2;
    let dx = (e.clientX - cx) / R, dy = (e.clientY - cy) / R; const m = Math.hypot(dx, dy); if (m > 1) { dx /= m; dy /= m; }
    const f = flipped(el) ? -1 : 1; st.x = dx * f; st.y = dy * f; // משטח מסובב 180° (מצב שולחן) knob.style.transform = `translate(${dx * R * 0.6}px, ${dy * R * 0.6}px)`;
  };
  el.addEventListener('pointerdown', (e) => { st.id = e.pointerId; el.setPointerCapture(e.pointerId); move(e); });
  el.addEventListener('pointermove', (e) => { if (e.pointerId === st.id) move(e); });
  const up = (e) => { if (e.pointerId !== st.id) return; st.id = null; st.x = st.y = 0; knob.style.transform = ''; };
  el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
}
function bindA(btn, i) {
  btn.addEventListener('pointerdown', (e) => { e.preventDefault(); aTouch[i] = true; if (i) input.p2.aPressed = true; else input.aPressed = true; btn.classList.add('on'); });
  const aUp = () => { aTouch[i] = false; btn.classList.remove('on'); };
  btn.addEventListener('pointerup', aUp); btn.addEventListener('pointercancel', aUp); btn.addEventListener('pointerleave', aUp);
}
export function setupTouch() {
  const show = () => { if (input.touch) return; input.touch = true; document.body.classList.add('touch'); };
  addEventListener('touchstart', show, { passive: true });
  if (matchMedia('(pointer: coarse)').matches) show();
  bindStick($('#stick'), sticks[0]); bindStick($('#stick2'), sticks[1]);
  bindA($('#btn-a'), 0); bindA($('#btn-a2'), 1);
  // 🎒: לחיצה קצרה = להשתמש בכלי, לחיצה ארוכה = להחליף כלי
  [$('#btn-tool'), $('#btn-tool2')].forEach((b, i) => {
    let t0 = 0, timer = 0; const tgt = () => (i ? input.p2 : input);
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); t0 = performance.now(); b.classList.add('on'); clearTimeout(timer); timer = setTimeout(() => { if (t0) { tgt().toolSwitch = true; t0 = 0; b.classList.remove('on'); } }, 450); });
    const up = () => { clearTimeout(timer); b.classList.remove('on'); if (t0) { tgt().toolPressed = true; t0 = 0; } };
    b.addEventListener('pointerup', up); b.addEventListener('pointercancel', () => { clearTimeout(timer); t0 = 0; b.classList.remove('on'); });
  });
  for (const btnP of [$('#btn-pixi'), $('#btn-pixi2')]) btnP.addEventListener('pointerdown', (e) => { e.preventDefault(); input.pixiPressed = true; btnP.classList.add('on'); setTimeout(() => btnP.classList.remove('on'), 150); });
}
const flipped = (el) => input.coopMode === 'table' && !!el.closest('#pad2');
export function showTouch(on) { $('#touch').hidden = !(on && input.touch); }
/** mode: null (לבד) | 'side' (אחד ליד השני) | 'table' (אחד מול השני) */
export function setCoop(mode) {
  input.coopMode = mode || null; input.coop = !!mode; keys.clear();
  const b = document.body.classList; b.toggle('coop', input.coop); b.toggle('side', mode === 'side'); b.toggle('table', mode === 'table');
}

const k2 = (a, b) => keys.has(a) || (b && keys.has(b));
function axis(l, r, u, d, st, alt) {
  let x = (k2(r, alt && 'ar') ? 1 : 0) - (k2(l, alt && 'al') ? 1 : 0), y = (k2(d, alt && 'ad') ? 1 : 0) - (k2(u, alt && 'au') ? 1 : 0);
  if (x && y) { x *= Math.SQRT1_2; y *= Math.SQRT1_2; }
  if (Math.hypot(st.x, st.y) > 0.18) { x = st.x; y = st.y; }
  return [x, y];
}
/** קורא פעם בפריים, לפני העדכון */
export function poll() {
  const arrowsMove = !input.coop && !input.mode3d;
  [input.x, input.y] = axis('l', 'r', 'u', 'd', sticks[0], arrowsMove); input.a = keys.has('a') || aTouch[0];
  input.camKey.x = !input.coop && input.mode3d ? (keys.has('ar') ? 1 : 0) - (keys.has('al') ? 1 : 0) : 0;
  input.camKey.y = !input.coop && input.mode3d ? (keys.has('ad') ? 1 : 0) - (keys.has('au') ? 1 : 0) : 0;
  const p = input.p2;
  if (input.coop) {
    [p.x, p.y] = axis('l2', 'r2', 'u2', 'd2', sticks[1]); p.a = keys.has('a2') || aTouch[1];
    input.camKey.x = (keys.has('cr') ? 1 : 0) - (keys.has('cl') ? 1 : 0); p.camKey.x = (keys.has('cr2') ? 1 : 0) - (keys.has('cl2') ? 1 : 0);
  } else { p.x = p.y = 0; p.a = false; p.camKey.x = 0; }
}
/** אחרי העדכון – מאפס לחיצות חד-פעמיות */
export function endFrame() {
  input.aPressed = input.pixiPressed = input.startPressed = input.pausePressed = false; input.p2.aPressed = false;
  input.toolPressed = input.toolSwitch = input.p2.toolPressed = input.p2.toolSwitch = false;
  input.cam.dx = input.cam.dy = 0; input.p2.cam.dx = input.p2.cam.dy = 0;
}

// ---------- סיבוב מצלמה בתלת-ממד ----------
// מגע: גרירה בשטח #camzone (החצי הימני, מתחת לכפתורים). עכבר: גרירה על הקנבס, או לחיצה כפולה ל-pointer lock.
export function setupCamDrag() {
  const drag = (el, target, k = 1) => {
    let id = null, lx = 0, ly = 0;
    el.addEventListener('pointerdown', (e) => { if (e.pointerType === 'mouse' && e.button !== 0) return; id = e.pointerId; lx = e.clientX; ly = e.clientY; try { el.setPointerCapture(id); } catch { /* */ } });
    el.addEventListener('pointermove', (e) => { if (e.pointerId !== id) return; const f = flipped(el) ? -k : k; target().dx += (e.clientX - lx) * f; target().dy += (e.clientY - ly) * f; lx = e.clientX; ly = e.clientY; });
    const up = (e) => { if (e.pointerId === id) id = null; };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  };
  drag($('#camzone'), () => input.cam);
  const z2 = $('#camzone2'); if (z2) drag(z2, () => input.p2.cam);
  const gl = $('#gl'); drag(gl, () => input.cam, 0.8);
  gl.addEventListener('dblclick', () => { try { gl.requestPointerLock?.(); } catch { /* */ } });
  addEventListener('mousemove', (e) => { if (document.pointerLockElement === gl) { input.cam.dx += e.movementX * 0.8; input.cam.dy += e.movementY * 0.8; } });
}
export function setMode3d(on) { input.mode3d = !!on; document.body.classList.toggle('mode3d', input.mode3d); if (!on && document.pointerLockElement) document.exitPointerLock?.(); }
