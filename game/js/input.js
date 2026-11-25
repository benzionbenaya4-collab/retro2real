// קלט: מקלדת + ג'ויסטיק מגע + כפתורי A / פיקסי.
// שחקן שני (coop) על אותו מכשיר: שחקן 1 = WASD + J, שחקן 2 = חצים + Enter.
// בטלפון: מסך מפוצל – ג'ויסטיק ו-A משמאל לשחקן 1, ומימין לשחקן 2.
import { $ } from './util.js';

const mk = () => ({ x: 0, y: 0, a: false, aPressed: false });
export const input = { x: 0, y: 0, a: false, aPressed: false, pixiPressed: false, startPressed: false, pausePressed: false, touch: false, coop: false, p2: mk() };
const keys = new Set();
// קודי מקשים → פעולה, לפי מצב
const SOLO = { ArrowLeft: 'l', KeyA: 'l', ArrowRight: 'r', KeyD: 'r', ArrowUp: 'u', KeyW: 'u', ArrowDown: 'd', KeyS: 'd', Space: 'a', KeyJ: 'a', KeyZ: 'a', KeyK: 'p', KeyP: 'p', KeyX: 'p', KeyQ: 'p', Enter: 'start', Escape: 'pause' };
const COOP = { KeyA: 'l', KeyD: 'r', KeyW: 'u', KeyS: 'd', KeyJ: 'a', Space: 'a', KeyK: 'p', KeyP: 'p', KeyQ: 'p', Escape: 'pause',
  ArrowLeft: 'l2', ArrowRight: 'r2', ArrowUp: 'u2', ArrowDown: 'd2', Enter: 'a2', NumpadEnter: 'a2', ShiftRight: 'a2' };
const map = () => (input.coop ? COOP : SOLO);
addEventListener('keydown', (e) => {
  const k = map()[e.code]; if (!k) return;
  if (e.target && e.target.tagName === 'BUTTON' && (k === 'a' || k === 'start' || k === 'a2')) return; // לחיצה על כפתור בתפריט
  e.preventDefault();
  if (!keys.has(k)) {
    if (k === 'a') input.aPressed = true; if (k === 'a2') input.p2.aPressed = true; if (k === 'p') input.pixiPressed = true;
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
    st.x = dx; st.y = dy; knob.style.transform = `translate(${dx * R * 0.6}px, ${dy * R * 0.6}px)`;
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
  const btnP = $('#btn-pixi');
  btnP.addEventListener('pointerdown', (e) => { e.preventDefault(); input.pixiPressed = true; btnP.classList.add('on'); setTimeout(() => btnP.classList.remove('on'), 150); });
}
export function showTouch(on) { $('#touch').hidden = !(on && input.touch); }
export function setCoop(on) { input.coop = !!on; keys.clear(); document.body.classList.toggle('coop', input.coop); }

function axis(l, r, u, d, st) {
  let x = (keys.has(r) ? 1 : 0) - (keys.has(l) ? 1 : 0), y = (keys.has(d) ? 1 : 0) - (keys.has(u) ? 1 : 0);
  if (x && y) { x *= Math.SQRT1_2; y *= Math.SQRT1_2; }
  if (Math.hypot(st.x, st.y) > 0.18) { x = st.x; y = st.y; }
  return [x, y];
}
/** קורא פעם בפריים, לפני העדכון */
export function poll() {
  [input.x, input.y] = axis('l', 'r', 'u', 'd', sticks[0]); input.a = keys.has('a') || aTouch[0];
  const p = input.p2;
  if (input.coop) { [p.x, p.y] = axis('l2', 'r2', 'u2', 'd2', sticks[1]); p.a = keys.has('a2') || aTouch[1]; }
  else { p.x = p.y = 0; p.a = false; }
}
/** אחרי העדכון – מאפס לחיצות חד-פעמיות */
export function endFrame() { input.aPressed = input.pixiPressed = input.startPressed = input.pausePressed = false; input.p2.aPressed = false; }
