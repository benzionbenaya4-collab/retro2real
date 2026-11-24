// הגדרות העולמות. 1: עמק 8 ביט · 2: ממלכת 16 ביט · 3: 32 ביט (three.js) · 4: קרב הבוס
import { World2D } from './world2d.js';

const SNES = { bg: '#120e1c', dark: '#24412a', mid: '#4f8f3f', light: '#fff1b0', danger: '#ff3d6e', mark: '#ff3d6e', heart: '#ff3d6e', water: '#3b6fd6', bolt: '#ffffff', shadow: '#000000' };
const GB = { bg: '#0f380f', dark: '#306230', mid: '#8bac0f', light: '#bedc78', danger: '#0f380f', mark: '#0f380f', heart: '#0f380f', water: '#306230', bolt: '#bedc78' };

export const WORLDS = {
  1: {
    kind: '2d', name: 'עולם 1 – עמק 8 ביט', short: 'עולם 1', era: '8-BIT · עולם 1', eraIdx: 0, song: 'valley', next: 2,
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
  2: {
    kind: '2d', name: 'עולם 2 – ממלכת 16 ביט', short: 'עולם 2', era: '16-BIT · עולם 2', eraIdx: 1, song: 'kingdom', next: null,
    intro: 'השער זרק את דן קדימה בזמן. פתאום יש צבעים! אבל גם כאן ההאקר השאיר מתנה: סוס טרויאני ענק מחכה ליד הטירה. אסוף את שברי הקוד והבס אותו.',
    hello: 'וואו, 16 ביט! יש לי עכשיו 65,536 צבעים ועדיין אותו מספר טוקנים 😅',
    cfg: {
      era: '16bit', tiles: '16bit_kingdom_tileset', seed: 1991, w: 46, h: 34, base: 224, shards: 5,
      waves: [{ n: 4, need: 0, outage: true }, { n: 6, need: 3 }],
      enemy: { name: 'worm', hp: 3, speed: 30, r: 7, dmg: 1 },
      miniboss: { name: 'trojan', label: 'הסוס הטרויאני', hp: 16, speed: 24, r: 14, dmg: 2 },
      dan: { hp: 7, speed: 72, reach: 17, dmg: 1 },
      voidEvery: 2.0, voidMax: 70, voidSeeds: 6, colors: SNES, pixiScale: 0.6,
    },
  },
};

export function makeLevel(id) {
  const W = WORLDS[id];
  if (W.kind === '2d') { const l = new World2D(W.cfg); return l; }
  throw new Error('unknown world ' + id);
}
