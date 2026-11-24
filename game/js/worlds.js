// הגדרות העולמות. 1: עמק 8 ביט · 2: ממלכת 16 ביט · 3: 32 ביט (three.js) · 4: קרב הבוס
import { World2D } from './world2d.js';

const GB = { bg: '#0f380f', dark: '#306230', mid: '#8bac0f', light: '#bedc78', danger: '#0f380f', mark: '#0f380f', heart: '#0f380f', water: '#306230', bolt: '#bedc78' };

export const WORLDS = {
  1: {
    kind: '2d', name: 'עולם 1 – עמק 8 ביט', short: 'עולם 1', era: '8-BIT · עולם 1', eraIdx: 0, song: 'valley', next: null,
    intro: 'דן לחץ על הכפתורים הלא נכונים ונשאב לתוך המשחק הישן של נועם. ה-void בולע את העמק, ותולעים זדוניות זוחלות ממנו. אסוף את כל שברי הקוד ופתח את השער שליד הטירה.',
    hello: 'היי! אני פיקסי, מערכת ההגנה של המשחק. נראה לי שהגעתי אליך בטעות… בוא נציל את העמק!',
    cfg: {
      era: '8bit', tiles: '8bit_valley_tileset', seed: 1987, w: 40, h: 30, base: 176, shards: 6,
      waves: [{ n: 3, need: 0, outage: true }, { n: 5, need: 2 }, { n: 6, need: 4, outage: true }],
      enemy: { name: 'worm', hp: 2, speed: 26, r: 5, dmg: 1 },
      dan: { hp: 6, speed: 64, reach: 13, dmg: 1 },
      voidEvery: 2.4, voidMax: 60, voidSeeds: 5, colors: GB,
    },
  },
};

export function makeLevel(id) {
  const W = WORLDS[id];
  if (W.kind === '2d') { const l = new World2D(W.cfg); return l; }
  throw new Error('unknown world ' + id);
}
