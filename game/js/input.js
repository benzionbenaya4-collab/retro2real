// קלט: מקלדת + ג'ויסטיק מגע + כפתורי A / פיקסי
import { $ } from './util.js';

export const input = { x: 0, y: 0, a: false, aPressed: false, pixiPressed: false, startPressed: false, pausePressed: false, touch: false };
const keys = new Set();
const KEYMAP = {
  ArrowLeft: 'l', KeyA: 'l', ArrowRight: 'r', KeyD: 'r', ArrowUp: 'u', KeyW: 'u', ArrowDown: 'd', KeyS: 'd',
  Space: 'a', KeyJ: 'a', KeyZ: 'a', KeyK: 'p', KeyP: 'p', KeyX: 'p', KeyQ: 'p', Enter: 'start', Escape: 'pause',
};
addEventListener('keydown', (e) => {
  const k = KEYMAP[e.code]; if (!k) return;
  if (e.target && e.target.tagName === 'BUTTON' && (k === 'a' || k === 'start')) return; // לחיצה על כפתור בתפריט
  e.preventDefault();
  if (!keys.has(k)) { if (k === 'a') input.aPressed = true; if (k === 'p') input.pixiPressed = true; if (k === 'start') input.startPressed = true; if (k === 'pause') input.pausePressed = true; }
  keys.add(k);
});
addEventListener('keyup', (e) => { const k = KEYMAP[e.code]; if (k) keys.delete(k); });
addEventListener('blur', () => keys.clear());

let stick = { id: null, x: 0, y: 0 }, aTouch = false;
export function setupTouch() {
  const el = $('#stick'), knob = el.querySelector('i'), btnA = $('#btn-a'), btnP = $('#btn-pixi');
  const show = () => { if (input.touch) return; input.touch = true; document.body.classList.add('touch'); };
  addEventListener('touchstart', show, { passive: true });
  if (matchMedia('(pointer: coarse)').matches) show();
  const move = (e) => {
    const r = el.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, R = r.width / 2;
    let dx = (e.clientX - cx) / R, dy = (e.clientY - cy) / R; const m = Math.hypot(dx, dy); if (m > 1) { dx /= m; dy /= m; }
    stick.x = dx; stick.y = dy; knob.style.transform = `translate(${dx * R * 0.6}px, ${dy * R * 0.6}px)`;
  };
  el.addEventListener('pointerdown', (e) => { stick.id = e.pointerId; el.setPointerCapture(e.pointerId); move(e); });
  el.addEventListener('pointermove', (e) => { if (e.pointerId === stick.id) move(e); });
  const up = (e) => { if (e.pointerId !== stick.id) return; stick.id = null; stick.x = stick.y = 0; knob.style.transform = ''; };
  el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  btnA.addEventListener('pointerdown', (e) => { e.preventDefault(); aTouch = true; input.aPressed = true; btnA.classList.add('on'); });
  const aUp = () => { aTouch = false; btnA.classList.remove('on'); };
  btnA.addEventListener('pointerup', aUp); btnA.addEventListener('pointercancel', aUp); btnA.addEventListener('pointerleave', aUp);
  btnP.addEventListener('pointerdown', (e) => { e.preventDefault(); input.pixiPressed = true; btnP.classList.add('on'); setTimeout(() => btnP.classList.remove('on'), 150); });
}
export function showTouch(on) { $('#touch').hidden = !(on && input.touch); }

/** קורא פעם בפריים, לפני העדכון */
export function poll() {
  let x = (keys.has('r') ? 1 : 0) - (keys.has('l') ? 1 : 0), y = (keys.has('d') ? 1 : 0) - (keys.has('u') ? 1 : 0);
  if (x && y) { x *= Math.SQRT1_2; y *= Math.SQRT1_2; }
  if (Math.hypot(stick.x, stick.y) > 0.18) { x = stick.x; y = stick.y; }
  input.x = x; input.y = y; input.a = keys.has('a') || aTouch;
}
/** אחרי העדכון – מאפס לחיצות חד-פעמיות */
export function endFrame() { input.aPressed = input.pixiPressed = input.startPressed = input.pausePressed = false; }
