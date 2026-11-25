// HUD ב-DOM: לבבות, שברי קוד, מד טוקנים, בועת דיבור, באנר, מד בוס
import { $ } from './util.js';
import { audio } from './audio.js';

const el = { hud: $('#hud'), hearts: $('#hearts'), shards: $('#shards'), name: $('#world-name'), tk: $('#tokens'), tkBar: $('#tokens .tk-bar i'), tkNum: $('#tokens .tk-num'),
  bubble: $('#bubble'), bubbleP: $('#bubble p'), banner: $('#banner'), boss: $('#boss-bar'), bossName: $('#boss-name'), bossBar: $('#boss-bar .bb i'), boost: $('#boost'), boostBar: $('#boost i') };
let last = {};
export const hud = {
  show(on) { el.hud.hidden = !on; if (!on) { this.say(null); this.banner(null); this.bossBar(null); this.boost(0); } },
  setWorld(name) { el.name.textContent = name; },
  hearts(hp, max) {
    const k = hp + '/' + max; if (last.h === k) return; last.h = k;
    el.hearts.innerHTML = Array.from({ length: max }, (_, i) => `<span class="h${i < hp ? '' : ' off'}">♥</span>`).join('');
  },
  shards(n, total) { const k = `◆ ${n}/${total}`; if (last.s === k) return; last.s = k; el.shards.textContent = total ? k : ''; },
  tokens(v, max) {
    const k = Math.round(v); if (last.t === k) return; last.t = k;
    el.tkBar.style.width = (100 * v / max) + '%'; el.tkNum.textContent = k; el.tk.classList.toggle('empty', k <= 0);
  },
  boost(frac) {
    const on = frac > 0; if (el.boost.hidden === on) el.boost.hidden = !on; if (on) el.boostBar.style.width = (frac * 100) + '%';
  },
  bossBar(name, frac) {
    if (!name) { el.boss.hidden = true; last.b = null; return; }
    el.boss.hidden = false; if (last.b !== name) { el.bossName.textContent = name; last.b = name; }
    el.bossBar.style.width = Math.max(0, frac * 100) + '%';
  },
  _sayT: 0,
  say(text, sec = 3.2) {
    clearTimeout(this._sayT);
    if (!text) { el.bubble.hidden = true; return; }
    el.bubbleP.textContent = text; el.bubble.hidden = false;
    el.bubble.style.animation = 'none'; void el.bubble.offsetWidth; el.bubble.style.animation = '';
    audio.sfx('pixi');
    this._sayT = setTimeout(() => (el.bubble.hidden = true), sec * 1000);
  },
  _banT: 0,
  banner(html, sec = 2.2) {
    clearTimeout(this._banT);
    if (!html) { el.banner.hidden = true; return; }
    el.banner.innerHTML = html; el.banner.hidden = false;
    this._banT = setTimeout(() => (el.banner.hidden = true), sec * 1000);
  },
  reset() { last = {}; },
};
