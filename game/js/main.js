// מרטרו לרגיל – לולאה ראשית, מסך פתיחה, כרטיסי עולם, השהיה, שמירה.
import { $ } from './util.js';
import { input, poll, endFrame, setupTouch, showTouch } from './input.js';
import { audio } from './audio.js';
import { hud } from './hud.js';
import { pixi } from './pixi.js';
import * as store from './save.js';
import { WORLDS, makeLevel } from './worlds.js';

const view = $('#view'), ctx = view.getContext('2d'), glc = $('#gl');
const scr = { title: $('#title'), pause: $('#pause'), card: $('#card') };
let save = store.load(); audio.setOn(save.sound);
let state = 'title', level = null, worldId = 1, VW = 320, VH = 180, busy = false;

function fit() {
  const base = level?.cfg?.base || 176, iw = innerWidth, ih = innerHeight, s = Math.min(iw, ih) / base;
  VW = Math.max(120, Math.round(iw / s)); VH = Math.max(120, Math.round(ih / s));
  if (view.width !== VW || view.height !== VH) { view.width = VW; view.height = VH; }
  ctx.imageSmoothingEnabled = false;
  level?.resize?.(iw, ih);
}
addEventListener('resize', fit);

function screen(name) { for (const [k, el] of Object.entries(scr)) el.hidden = k !== name; }

// ---------- מסך פתיחה ----------
const soundBtn = $('#btn-sound');
const syncSound = () => (soundBtn.textContent = audio.on ? '🔊' : '🔇');
soundBtn.onclick = () => { audio.unlock(); audio.setOn(!audio.on); save = store.save({ sound: audio.on }); syncSound(); }; syncSound();

function showTitle() {
  state = 'title'; screen('title'); hud.show(false); showTouch(false); $('#btn-menu').hidden = true;
  glc.hidden = true; view.hidden = false; level?.dispose?.(); level = null;
  const cont = save.world > 1 && WORLDS[save.world];
  $('#continue-box').hidden = !cont; $('#press-start').hidden = !!cont;
  if (cont) $('#btn-continue span').textContent = WORLDS[save.world].short;
  audio.play('title', 0);
}
function pressStart() { audio.unlock(); audio.sfx('start'); enterWorld(1, true); }
$('#press-start').onclick = pressStart;
$('#btn-continue').onclick = () => { audio.unlock(); audio.sfx('start'); enterWorld(save.world, true); };
$('#btn-new').onclick = () => { audio.unlock(); save = store.save({ world: 1 }); pressStart(); };

// ---------- כרטיס / עולם ----------
function card(era, title, text, btn, onGo) {
  state = 'card'; screen('card'); hud.show(false); showTouch(false); $('#btn-menu').hidden = true;
  const el = scr.card; el.querySelector('.era').textContent = era; el.querySelector('h2').textContent = title; el.querySelector('p').textContent = text;
  const b = el.querySelector('button'); b.textContent = btn; b.onclick = () => { audio.unlock(); onGo(); }; setTimeout(() => b.focus(), 50);
}
async function enterWorld(id, withCard) {
  worldId = id; const W = WORLDS[id];
  if (withCard && W.intro) return card(W.era, W.name, W.intro, 'יאללה', () => enterWorld(id, false));
  if (busy) return; busy = true;
  screen(null); hud.reset(); hud.show(true); hud.setWorld(W.name);
  level?.dispose?.(); level = makeLevel(id);
  try { await level.load(); } catch (e) { console.error(e); }
  busy = false;
  level.start(); fit();
  const is3d = !!level.is3d; glc.hidden = !is3d; view.hidden = is3d;
  state = 'play'; showTouch(true); $('#btn-menu').hidden = false;
  audio.play(W.song, W.eraIdx);
  if (W.hello) setTimeout(() => state === 'play' && hud.say(W.hello, 4), 700);
}
function onResult(r) {
  showTouch(false);
  if (r === 'dead') return card('GAME OVER', 'דן נפל…', 'פיקסי שמר נקודת ביקורת בתחילת העולם. ננסה שוב?', 'נסה שוב', () => enterWorld(worldId, false));
  const next = WORLDS[worldId].next;
  if (!next && WORLDS[worldId].final) return finale();
  if (!next) return card('TO BE CONTINUED', 'המשך יבוא…', 'העמק ניצל! השער מוביל לממלכת 16 ביט, והיא עדיין בבנייה. פיקסי כבר מחמם את השרתים.', 'למסך הפתיחה', showTitle);
  save = store.save({ world: Math.max(save.world, next) });
  const W = WORLDS[next];
  card(W.era, W.name, W.intro, 'יאללה', () => enterWorld(next, false));
}
function finale() {
  save = store.save({ world: 1, best: Math.max(save.best || 0, 1) });
  audio.play('win', 3);
  card('THE END · תודה ששיחקת', 'ניצחת את ההאקר!', 'חרב האינסוף החזירה את העולמות למקום. ופיקסי? עדיין יש לו טוקנים. בינתיים. 😅', 'למסך הפתיחה', showTitle);
}

// ---------- השהיה ----------
function pause(on) {
  if (on && state === 'play') { state = 'pause'; screen('pause'); showTouch(false); setTimeout(() => $('#btn-resume').focus(), 30); }
  else if (!on && state === 'pause') { state = 'play'; screen(null); showTouch(true); }
}
$('#btn-menu').onclick = () => pause(true);
$('#btn-resume').onclick = () => pause(false);
$('#btn-restart').onclick = () => { screen(null); enterWorld(worldId, false); };
$('#btn-quit').onclick = showTitle;
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(true); });

// ---------- לולאה ----------
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  poll();
  if (state === 'title' && (input.startPressed || input.aPressed) && !$('#press-start').hidden) pressStart();
  else if (state === 'play' && level) {
    if (input.pausePressed || input.startPressed) pause(true);
    else {
      const r = level.update(dt, input);
      if (r) { state = 'result'; onResult(r); }
    }
  } else if (state === 'pause' && input.pausePressed) pause(false);
  if (level && (state === 'play' || state === 'result' || state === 'pause')) { if (level.is3d) level.render(); else level.draw(ctx, VW, VH); }
  else drawAttract(now / 1000);
  audio.tick(); endFrame();
  requestAnimationFrame(frame);
}
// רקע מסך פתיחה: גשם קוד ירוק עדין
function drawAttract(t) {
  if (view.hidden) return;
  ctx.fillStyle = '#07060b'; ctx.fillRect(0, 0, VW, VH);
  const cols = Math.ceil(VW / 8);
  for (let i = 0; i < cols; i++) { const y = ((t * (20 + (i * 37) % 30) + i * 53) % (VH + 40)) - 20; ctx.fillStyle = i % 3 ? '#306230' : '#8bac0f'; ctx.fillRect(i * 8 + 3, Math.round(y), 2, 2); ctx.globalAlpha = 0.4; ctx.fillRect(i * 8 + 3, Math.round(y) - 6, 2, 2); ctx.globalAlpha = 1; }
}

// ---------- אתחול ----------
setupTouch(); fit(); showTitle();
requestAnimationFrame(frame);
(async () => {
  try { await Promise.race([document.fonts?.ready, new Promise((r) => setTimeout(r, 2500))]); } catch { /* */ }
  try { await makeLevel(1).load(); } catch (e) { console.error(e); }
  $('#loading').hidden = true; showTitle(); $('#press-start').focus?.();
})();
pixi.update(0);

// וו לבדיקות אוטומטיות (Playwright)
window.__r2r = { get state() { return state; }, get level() { return level; }, enterWorld, pixi, input };
