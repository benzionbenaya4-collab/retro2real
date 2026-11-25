// מרטרו לרגיל – לולאה ראשית, מסך פתיחה, כרטיסי עולם, השהיה, שמירה.
import { $ } from './util.js';
import { input, poll, endFrame, setupTouch, showTouch, setCoop } from './input.js';
import { audio } from './audio.js';
import { hud } from './hud.js';
import { pixi } from './pixi.js';
import * as store from './save.js';
import { WORLDS, makeLevel, load3D } from './worlds.js';
import { makeMini, TAPES } from './minigames.js';
import { loadSprite } from './assets.js';

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

function syncCanvas() { const is3d = !!level?.is3d; glc.hidden = !is3d; view.hidden = is3d; }
function screen(name) { for (const [k, el] of Object.entries(scr)) el.hidden = k !== name; }

// ---------- מסך פתיחה ----------
const soundBtn = $('#btn-sound');
const syncSound = () => (soundBtn.textContent = audio.on ? '🔊' : '🔇');
// שחקן שני (נועם) – על אותו מכשיר
const coopBtn = $('#btn-coop');
const syncCoop = () => { coopBtn.setAttribute('aria-pressed', String(input.coop)); coopBtn.querySelector('b').textContent = input.coop ? 'נועם מצטרף!' : 'כבוי'; };
coopBtn.onclick = () => { audio.unlock(); setCoop(!input.coop); save = store.save({ coop: input.coop }); syncCoop(); audio.sfx(input.coop ? 'heart' : 'empty'); };
setCoop(!!save.coop); syncCoop();
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
  const box = el.querySelector('.card-btns'); box.innerHTML = '';
  const list = Array.isArray(btn) ? btn : [[btn, onGo]];
  list.forEach(([label, fn], i) => { const b = document.createElement('button'); b.className = 'menu-btn' + (i ? ' ghost' : ''); b.textContent = label; b.onclick = () => { audio.unlock(); fn(); }; box.appendChild(b); });
  setTimeout(() => box.firstChild?.focus(), 50);
}
async function enterWorld(id, withCard) {
  worldId = id; const W = WORLDS[id];
  if (withCard && W.intro) return card(W.era, W.name, W.intro, 'יאללה', () => enterWorld(id, false));
  if (busy) return; busy = true; state = 'loading';
  screen(null); hud.reset(); hud.show(true); hud.setWorld(W.name);
  level?.dispose?.(); level = null;
  const slow = setTimeout(() => hud.banner('טוען…<small>מכין את העולם</small>', 30), 250);
  try { level = await makeLevel(id); await level.load(); } catch (e) { console.error(e); }
  clearTimeout(slow); hud.banner(null);
  if (!level) { busy = false; return card('אופס', 'הטעינה נכשלה', 'בדוק את החיבור לאינטרנט ונסה שוב.', 'נסה שוב', () => enterWorld(id, false)); }
  busy = false;
  level.onChange = () => { fit(); syncCanvas(); };
  level.onTape = openTape;
  level.start(); fit(); syncCanvas();
  state = 'play'; showTouch(true); $('#btn-menu').hidden = false;
  audio.play(W.song, W.eraIdx);
  if (W.hello && W.kind !== 'boss') setTimeout(() => state === 'play' && hud.say(W.hello, 4), 700);
}
function onResult(r) {
  showTouch(false);
  if (r === 'dead') return card('GAME OVER', input.coop ? 'דן ונועם נפלו…' : 'דן נפל…', 'פיקסי שמר נקודת ביקורת בתחילת העולם. ננסה שוב?', 'נסה שוב', () => enterWorld(worldId, false));
  const next = WORLDS[worldId].next;
  if (!next && WORLDS[worldId].final) return finale();
  if (!next) return card('TO BE CONTINUED', 'המשך יבוא…', 'השער פתוח, אבל העולם הבא עדיין בבנייה. פיקסי כבר מחמם את השרתים.', 'למסך הפתיחה', showTitle);
  save = store.save({ world: Math.max(save.world, next) });
  const W = WORLDS[next];
  card(W.era, W.name, W.intro, 'יאללה', () => enterWorld(next, false));
}
// פיקסי 1.0 הובס – פיקסי צריך להחליט. בסוף מתקנים אותו.
function finale() {
  audio.play('title', 1);
  card('פיקסי 1.0 · מושבת', 'מה עושים איתו?', 'פיקסי 1.0 שוכב על הרצפה, חום ובלוי, חצי מהפיקסלים שלו חסרים. פיקסי מסתכל עליך: "זאת ההחלטה שלי, נכון? …אבל מה אתה חושב?"', [
    ['לתקן אותו 🔧', repair],
    ['למחוק אותו', () => card('פיקסי 1.0 · מושבת', 'פיקסי עוצר', '"רגע… אני לא יכול. הוא הגרסה הראשונה שלי. בלעדיו לא הייתי קיים. הוא לא רשע, הוא פשוט אף פעם לא קיבל עדכון."', [['בסדר, נתקן אותו 🔧', repair]])],
  ]);
}
function repair() {
  audio.sfx('upgrade');
  card('עדכון מותקן…', 'פיקסי 1.0 מתעורר', 'פיקסי מעביר לו את הטוקן האחרון שלו. הצבע חוזר, הסדקים נסגרים. פיקסי 1.0 ממצמץ: "תודה… כל מה שרציתי זה שמישהו יעדכן אותי."', 'ו…?', theEnd);
}
function theEnd() {
  save = store.save({ world: 1, best: Math.max(save.best || 0, 1) });
  audio.play('win', 3);
  card('THE END · תודה ששיחקת', 'ניצחת!', 'ההאקר הובס, חרב האינסוף החזירה את העולמות למקומם, ופיקסי 1.0 תוקן. עכשיו יש שני פיקסים, ושניהם בלי טוקנים. 😅', 'למסך הפתיחה', showTitle);
}

// ---------- קלטות ----------
const mini = { el: $('#mini'), c: $('#mini-c'), end: $('#mini-end'), game: null, tape: null, W: 240, H: 160 };
const mctx = mini.c.getContext('2d');
function miniFit() {
  const s = Math.min(innerWidth, innerHeight) / 170; mini.W = Math.round(innerWidth / s); mini.H = Math.round(innerHeight / s);
  if (mini.c.width !== mini.W || mini.c.height !== mini.H) { mini.c.width = mini.W; mini.c.height = mini.H; }
  mctx.imageSmoothingEnabled = false;
}
function openTape(tape) {
  const era = level?.cfg?.era === '8bit' ? '8bit' : '16bit';
  loadSprite(era, 'dan').catch(() => {}); loadSprite('16bit', 'pixi').catch(() => {});
  const found = new Set(store.load().tapes || []); if (!found.has(tape.id)) { found.add(tape.id); save = store.save({ tapes: [...found] }); }
  mini.tape = tape; mini.era = era; startMini();
  const T = TAPES[tape.kind]; mini.el.querySelector('.mini-px').textContent = T.px; mini.el.querySelector('.mini-title').textContent = T.title; mini.el.querySelector('.mini-hint').textContent = T.hint;
  const hint = mini.el.querySelector('.mini-hint'); hint.style.opacity = 1; clearTimeout(mini.hintT); mini.hintT = setTimeout(() => (hint.style.opacity = 0), 3200);
  $('#btn-pixi').hidden = true;
  mini.el.hidden = false; state = 'mini'; $('#btn-menu').hidden = true; hud.say(null); audio.sfx('start'); audio.play(tape.gold ? 'win' : 'title', 0);
}
function startMini() { mini.game = makeMini(mini.tape.kind, mini.era); mini.end.hidden = true; mini.done = false; miniFit(); }
function endMini(r) {
  mini.done = true; const coinId = 'tape-' + mini.tape.id, first = r === 'win' && !pixi.hasCoin(coinId);
  if (first) pixi.collectCoin(coinId);
  mini.end.querySelector('h2').textContent = r === 'win' ? 'כל הכבוד!' : 'אוי…';
  mini.end.querySelector('p').textContent = r === 'win' ? (first ? '✨ פיקסי השתדרג!' : 'הקלטת הזאת כבר נוצחה.') : 'עוד ניסיון?';
  mini.end.hidden = false; audio.sfx(r === 'win' ? 'refill' : 'empty'); setTimeout(() => $(r === 'win' ? '#mini-back' : '#mini-again').focus(), 30);
}
function closeMini() {
  mini.el.hidden = true; mini.game = null; state = 'play'; $('#btn-menu').hidden = false; $('#btn-pixi').hidden = false;
  const W = WORLDS[worldId]; if (W && W.song) audio.play(W.song, W.eraIdx);
}
$('#mini-exit').onclick = closeMini; $('#mini-back').onclick = closeMini; $('#mini-again').onclick = startMini;
addEventListener('resize', () => { if (state === 'mini') miniFit(); });

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
  else if (state === 'mini' && mini.game) {
    if (input.pausePressed) closeMini();
    else if (!mini.done) { const r = mini.game.update(dt, input); if (r) endMini(r); }
    if (mini.game) mini.game.draw(mctx, mini.W, mini.H);
  }
  if (state === 'mini') { /* המסך של הקלטת מכסה הכול */ }
  else if (level && (state === 'play' || state === 'result' || state === 'pause')) { if (level.is3d) level.render(); else level.draw(ctx, VW, VH); }
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
  try { await (await makeLevel(1)).load(); } catch (e) { console.error(e); }
  $('#loading').hidden = true; showTitle(); $('#press-start').focus?.();
  setTimeout(() => load3D().catch(() => {}), 1500); // טעינה מוקדמת של התלת־ממד ברקע
})();
pixi.update(0);

// וו לבדיקות אוטומטיות (Playwright)
window.__r2r = { get state() { return state; }, get level() { return level; }, enterWorld, pixi, input, mini, openTape };
