// HUD ב-DOM: לבבות, שברי קוד, מד טוקנים, בועת דיבור, באנר, מד בוס.
// במצב "אחד מול השני" יש עותק מסובב 180° בחצי העליון (#top) לנועם – כל עדכון נכתב לשניהם.
import { $ } from './util.js';
import { audio } from './audio.js';

const pick = (root, hud, bubble, banner) => ({
  hud, hearts: hud.querySelector('.hearts'), hearts2: hud.querySelector('.hearts2'), shards: hud.querySelector('.shards'), name: hud.querySelector('.world-name'),
  tk: hud.querySelector('.tokens'), tkBar: hud.querySelector('.tokens .tk-bar i'), tkNum: hud.querySelector('.tokens .tk-num'),
  bubble, bubbleP: bubble.querySelector('p'), banner, boss: hud.querySelector('.boss-bar'), bossName: hud.querySelector('.boss-name'), bossBar: hud.querySelector('.boss-bar .bb i'),
  boost: hud.querySelector('.boost'), boostBar: hud.querySelector('.boost i'),
});
// מסמנים class לפי id, ומשכפלים לחצי העליון
for (const id of ['hearts', 'hearts2', 'shards', 'world-name', 'tokens', 'boss-bar', 'boss-name', 'boost']) $('#' + id).classList.add(id);
const A = pick(document, $('#hud'), $('#bubble'), $('#banner'));
const topEl = $('#top'), hudT = A.hud.cloneNode(true), bubT = A.bubble.cloneNode(true), banT = A.banner.cloneNode(true);
hudT.id = 'hud-top'; bubT.id = ''; bubT.className = 'bubble2'; banT.id = ''; banT.className = 'banner2';
hudT.querySelectorAll('[id]').forEach((n) => n.removeAttribute('id'));
topEl.append(hudT, bubT, banT);
const B = pick(topEl, hudT, bubT, banT);
const both = [A, B];
const isTable = () => document.body.classList.contains('table');
const heartsHtml = (hp, max, cls = '') => Array.from({ length: max }, (_, i) => `<span class="h${i < hp ? '' : ' off'}${cls}">♥</span>`).join('');

let last = {};
export const hud = {
  show(on) { for (const e of both) e.hud.hidden = !on; if (!on) { this.say(null); this.banner(null); this.bossBar(null); this.boost(0); this.popup(1, false); this.popup(2, false); this.tool(1, null); this.tool(2, null); } },
  setWorld(name) { for (const e of both) e.name.textContent = name; },
  hearts(hp, max) {
    const k = hp + '/' + max; if (last.h === k) return; last.h = k;
    A.hearts.innerHTML = heartsHtml(hp, max);
  },
  /** נועם: בשולחן – הלבבות בחצי שלו (למעלה). אחרת – ליד הלבבות של דן */
  hearts2(hp, max) {
    const k = (hp == null ? 'none' : hp + '/' + max) + isTable(); if (last.h2 === k) return; last.h2 = k;
    const html = hp == null ? '' : heartsHtml(hp, max, ' gold');
    if (isTable()) { A.hearts2.innerHTML = ''; B.hearts2.innerHTML = ''; B.hearts.innerHTML = html; }
    else { A.hearts2.innerHTML = html; B.hearts.innerHTML = ''; }
  },
  shards(n, total) { const k = `◆ ${n}/${total}`; if (last.s === k) return; last.s = k; for (const e of both) e.shards.textContent = total ? k : ''; },
  tokens(v, max) {
    const k = Math.round(v); if (last.t === k) return; last.t = k;
    for (const e of both) { e.tkBar.style.width = (100 * v / max) + '%'; e.tkNum.textContent = k; e.tk.classList.toggle('empty', k <= 0); }
  },
  boost(frac) {
    const on = frac > 0;
    for (const e of both) { if (e.boost.hidden === on) e.boost.hidden = !on; if (on) e.boostBar.style.width = (frac * 100) + '%'; }
  },
  bossBar(name, frac) {
    if (!name) { for (const e of both) e.boss.hidden = true; last.b = null; return; }
    for (const e of both) { e.boss.hidden = false; if (last.b !== name) e.bossName.textContent = name; e.bossBar.style.width = Math.max(0, frac * 100) + '%'; }
    last.b = name;
  },
  _sayT: 0,
  say(text, sec = 3.2) {
    clearTimeout(this._sayT);
    if (!text) { for (const e of both) e.bubble.hidden = true; return; }
    for (const e of both) { e.bubbleP.textContent = text; e.bubble.hidden = false; e.bubble.style.animation = 'none'; void e.bubble.offsetWidth; e.bubble.style.animation = ''; }
    audio.sfx('pixi');
    this._sayT = setTimeout(() => { for (const e of both) e.bubble.hidden = true; }, sec * 1000);
  },
  _banT: 0,
  banner(html, sec = 2.2) {
    clearTimeout(this._banT);
    if (!html) { for (const e of both) e.banner.hidden = true; return; }
    for (const e of both) { e.banner.innerHTML = html; e.banner.hidden = false; }
    this._banT = setTimeout(() => { for (const e of both) e.banner.hidden = true; }, sec * 1000);
  },
  /** חלון פופ-אפ שמכסה את המסך של שחקן (1/2) עד שמכים בו */
  popup(id, on) {
    const k = 'pop' + id; if (last[k] === on) return; last[k] = on;
    let el = document.getElementById('popup' + id);
    if (!el) {
      el = document.createElement('div'); el.id = 'popup' + id; el.className = 'popup-win p' + id; el.hidden = true;
      el.innerHTML = '<div class="pw-bar"><span>הודעה חשובה!!!</span><b>✕</b></div><div class="pw-body"><div class="pw-big">🎉 מזל טוב! 🎉</div><p>זכית ב-1,000,000 טוקנים חינם!<br>רק תלחץ כאן… ותן לנו את כל הקוד שלך</p><div class="pw-btn">לחץ A כדי לסגור</div></div>';
      $('#stage').insertBefore(el, $('#touch'));
    }
    el.hidden = !on; if (on) audio.sfx('bolt');
  },
  /** ארגז הציד: כלי נבחר + טעינה, בכפתור 🎒 וב-HUD. st = toolHud(p) או null */
  _tu: {},
  tool(id, st) {
    const toasting = performance.now() < (this._tu[id] || 0);
    const k = 'tool' + id, v = st ? `${st.icon}${st.name}${Math.ceil(st.cd * 10)}${toasting}` : 'none'; if (last[k] === v) return; last[k] = v;
    const btn = document.getElementById(id === 2 ? 'btn-tool2' : 'btn-tool');
    if (btn) { btn.hidden = !st; if (st) { btn.querySelector('span').textContent = st.icon; btn.querySelector('small').textContent = st.cd > 0 ? '…' : st.name; btn.style.opacity = st.cd > 0 ? 0.55 : 1; } }
    const host = id === 2 && document.body.classList.contains('table') ? B.hud : A.hud;
    let el = host.querySelector('.tool-hud.t' + id);
    if (!el) { el = document.createElement('div'); el.className = 'tool-hud t' + id; el.innerHTML = '<b></b><span></span><div class="cd"><i></i></div>'; host.appendChild(el); if (id === 2 && host === A.hud) el.style.top = 'calc(max(10px, env(safe-area-inset-top)) + 106px)'; }
    el.hidden = !st; if (!st) return;
    el.querySelector('b').textContent = st.icon;
    if (!toasting) { el.querySelector('span').textContent = (id === 2 ? 'נועם: ' : '') + st.name; el.querySelector('span').className = id === 2 ? 'p2t' : ''; }
    el.querySelector('.cd i').style.width = (100 * (1 - st.cd)) + '%';
  },
  /** הודעה קצרה ליד הכלי */
  toast(id, text) {
    const el = document.querySelector('.tool-hud.t' + id + ' span'); if (!el) return;
    el.textContent = text; this._tu[id] = performance.now() + 900;
  },
  reset() { last = {}; },
};
