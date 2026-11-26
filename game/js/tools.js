// ארגז הציד של דן: מלכודת (עולם 1), עקבות (עולם 2), משקפת (עולם 3). נפתחים בהדרגה ונשמרים.
// 🎒 לחיצה קצרה / Q – להשתמש · לחיצה ארוכה / E – להחליף כלי. בלי טוקנים – אלה כלים של דן.
import * as store from './save.js';
import { hud } from './hud.js';
import { audio } from './audio.js';

export const TOOLS = {
  trap: { name: 'מלכודת', icon: '🪤', cd: 4, world: 1, hint: 'אויב שדורך עליה משותק ל-3 שניות. עד 2 בבת אחת.' },
  tracks: { name: 'עקבות', icon: '🐾', cd: 6, world: 2, hint: 'וירוס מסתתר משאיר עקבות. הכלי מאיר אותם ומראה כיוון.' },
  binoc: { name: 'משקפת', icon: '🔭', cd: 8, world: 3, hint: 'זום החוצה ל-3 שניות, ומסמן אויבים וקלטות קרובים.' },
};
export const ORDER = ['trap', 'tracks', 'binoc'];
export const TRAP_STUN = 3, TRAP_MAX = 2, ZOOM_TIME = 3, TRACK_TIME = 8;

export const unlocked = () => ORDER.filter((k) => TOOLS[k].world <= (store.load().toolLvl || 0));
/** בכניסה לעולם 1/2/3 נפתח הכלי שלו */
export function unlockFor(worldId) {
  const s = store.load(); if (!(worldId >= 1 && worldId <= 3) || (s.toolLvl || 0) >= worldId) return null;
  store.save({ toolLvl: worldId }); const k = ORDER[worldId - 1];
  setTimeout(() => { hud.banner(`🎒 כלי חדש: ${TOOLS[k].icon} ${TOOLS[k].name}<small>${TOOLS[k].hint}</small>`, 3.6); audio.sfx('refill'); }, 4800);
  return k;
}
/** לקרוא בכל פריים לכל שחקן. world.useTool(p, key) מבצע את הכלי עצמו */
export function toolTick(world, p, inp, dt) {
  const list = unlocked(); p.cd ||= {}; for (const k in p.cd) p.cd[k] = Math.max(0, p.cd[k] - dt);
  if (!list.length) { p.tool = null; return; }
  if (!p.tool || !list.includes(p.tool)) p.tool = list[list.length - 1];
  if (inp.toolSwitch) { p.tool = list[(list.indexOf(p.tool) + 1) % list.length]; audio.sfx('pixi'); hud.toast(p.id, `${TOOLS[p.tool].icon} ${TOOLS[p.tool].name}`); }
  if (inp.toolPressed) {
    const T = TOOLS[p.tool];
    if ((p.cd[p.tool] || 0) > 0) { audio.sfx('empty'); hud.toast(p.id, `${T.icon} נטען…`); }
    else if (world.useTool(p, p.tool) !== false) p.cd[p.tool] = T.cd;
  }
}
/** מצב ה-HUD / כפתור של שחקן */
export function toolHud(p) {
  if (!p.tool) return null; const T = TOOLS[p.tool];
  return { icon: T.icon, name: T.name, cd: (p.cd?.[p.tool] || 0) / T.cd };
}
