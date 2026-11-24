// פיקסי – הבינה המלאכותית של מערכת ההגנה. עוזר (מפה/סימון אויבים) ומרוקן טוקנים.
// הבדיחה: באמצע קרב נגמרים לו הטוקנים; בסוף קרב הם חוזרים.
import { hud } from './hud.js';
import { audio } from './audio.js';

export const SCAN_COST = 30, SCAN_TIME = 6;
const OUT_LINES = [
  'סליחה… נגמרו לשרת שלי הטוקנים 😅',
  'אוי. שוב. נגמרו לשרת שלי הטוקנים 😅 תסתדר רגע לבד?',
  'סליחה… השרת שלי עמוס. נגמרו הטוקנים 😅',
];
export class Pixi {
  constructor() { this.max = 100; this.tokens = 100; this.scan = 0; this.outages = 0; this.out = false; }
  reset(full = true) { if (full) this.tokens = this.max; this.scan = 0; this.out = false; }
  /** לחיצה על כפתור פיקסי. מחזיר true אם הסריקה התחילה */
  tryScan() {
    if (this.out || this.tokens < SCAN_COST) {
      hud.say(this.out ? 'אני… עדיין בלי טוקנים 😅 נסה אחרי הקרב.' : `צריך ${SCAN_COST} טוקנים לסריקה. יש לי רק ${Math.floor(this.tokens)}.`, 2.6);
      audio.sfx('empty'); return false;
    }
    this.tokens -= SCAN_COST; this.scan = SCAN_TIME; audio.sfx('scan');
    hud.say('סורק… מסמן אויבים ושברי קוד 🎯', 2.4);
    return true;
  }
  /** באמצע קרב */
  runOut() {
    if (this.out) return;
    this.out = true; this.tokens = 0; this.scan = 0;
    hud.say(OUT_LINES[Math.min(this.outages, OUT_LINES.length - 1)], 3.6); audio.sfx('empty');
    this.outages++;
  }
  /** בסוף קרב */
  refill(msg = 'עדכון: חזרו לי טוקנים!') {
    const was = this.out; this.out = false; this.tokens = this.max;
    if (was) { hud.say(msg, 3); audio.sfx('refill'); }
  }
  update(dt) { if (this.scan > 0) this.scan = Math.max(0, this.scan - dt); hud.tokens(this.tokens, this.max); }
}
export const pixi = new Pixi();
