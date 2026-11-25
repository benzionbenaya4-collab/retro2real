// הגדרות העולמות. 1: עמק 8 ביט · 2: ממלכת 16 ביט · 3: 32 ביט (three.js) · 4: קרב הבוס
import { World2D } from './world2d.js';
// three.js כבד (>1MB) – נטען רק כשצריך תלת־ממד, כדי שמסך הפתיחה יגיב מיד
let w3 = null;
export const load3D = () => (w3 ||= import('./world3d.js').then((m) => m.World3D).catch((e) => { w3 = null; throw e; }));
import { BossLevel } from './boss.js';

const SNES = { coin: '#ffcf4a', bg: '#120e1c', dark: '#24412a', mid: '#4f8f3f', light: '#fff1b0', danger: '#ff3d6e', mark: '#ff3d6e', heart: '#ff3d6e', water: '#3b6fd6', bolt: '#ffffff', shadow: '#000000' };
const SEPIA = { coin: '#ffcf4a', bg: '#1a120c', dark: '#3b2a1e', mid: '#6e5038', light: '#e8d2a8', danger: '#c4682a', mark: '#c4682a', heart: '#ff3d6e', water: '#4a3a2a', bolt: '#e8d2a8', shadow: '#000000' };
const GB = { bg: '#0f380f', dark: '#306230', mid: '#8bac0f', light: '#bedc78', danger: '#0f380f', mark: '#0f380f', heart: '#0f380f', water: '#306230', bolt: '#bedc78' };

export const WORLDS = {
  1: {
    kind: '2d', name: 'עולם 1 – עמק 8 ביט', short: 'עולם 1', era: '8-BIT · עולם 1', eraIdx: 0, song: 'valley', next: 2,
    intro: 'דן לחץ על הכפתורים הלא נכונים ונשאב לתוך המשחק הישן של נועם. ה-void בולע את העמק, ותולעים זדוניות זוחלות ממנו. אסוף את כל שברי הקוד ופתח את השער שליד הטירה.',
    hello: 'היי! אני פיקסי, מערכת ההגנה של המשחק. נראה לי שהגעתי אליך בטעות… בוא נציל את העמק!',
    cfg: {
      key: 'w1', coins: 2, tapes: [{ id: 'w1-parkour', kind: 'parkour' }], zones: ['wave', 'part'], era: '8bit', tiles: '8bit_valley_tileset', seed: 1987, w: 40, h: 30, base: 176, shards: 6,
      waves: [{ n: 3, need: 0, outage: true }, { n: 5, need: 2 }, { n: 6, need: 4, outage: true }],
      enemy: { name: 'worm', hp: 2, speed: 26, r: 5, dmg: 1 },
      dan: { hp: 6, speed: 64, reach: 13, dmg: 1 },
      voidEvery: 2.4, voidMax: 60, voidSeeds: 5, colors: GB,
    },
  },
  2: {
    kind: '2d', name: 'עולם 2 – ממלכת 16 ביט', short: 'עולם 2', era: '16-BIT · עולם 2', eraIdx: 1, song: 'kingdom', next: 3,
    intro: 'השער זרק את דן קדימה בזמן. פתאום יש צבעים! אבל גם כאן ההאקר השאיר מתנה: סוס טרויאני ענק מחכה ליד הטירה. אסוף את שברי הקוד והבס אותו.',
    hello: 'וואו, 16 ביט! יש לי עכשיו 65,536 צבעים ועדיין אותו מספר טוקנים 😅',
    cfg: {
      key: 'w2', coins: 2, tapes: [{ id: 'w2-catch', kind: 'catch' }, { id: 'w2-gold', kind: 'snake', gold: true }], zones: ['defend', 'part'], era: '16bit', tiles: '16bit_kingdom_tileset', seed: 1991, w: 46, h: 34, base: 224, shards: 5,
      waves: [{ n: 4, need: 0, outage: true }, { n: 6, need: 3 }],
      enemy: { name: 'worm', hp: 3, speed: 30, r: 7, dmg: 1 },
      miniboss: { name: 'trojan', label: 'הסוס הטרויאני', hp: 16, speed: 24, r: 14, dmg: 2 },
      dan: { hp: 7, speed: 72, reach: 17, dmg: 1 },
      voidEvery: 2.0, voidMax: 70, voidSeeds: 6, colors: SNES, pixiScale: 0.6,
    },
  },
  3: {
    kind: '3d', name: 'עולם 3 – 32 ביט', short: 'עולם 3', era: '32-BIT · עולם 3', eraIdx: 2, song: 'polygon', next: 4,
    intro: 'העולם קיבל עומק! פוליגונים, טקסטורות מפוקסלות ומצלמה מאחורי הכתף. התולעים כבר לא שטוחות. אסוף 3 שברי קוד ופתח את הפורטל אל ההאקר.',
    hello: 'תלת־ממד! ימינה/שמאלה מסובב את דן, למעלה הולך קדימה. כמו פעם 😎',
    cfg: {
      key: 'w3', coins: 1, tapes: [{ id: 'w3-maze', kind: 'maze' }], era: '32', mode: 'world', low: 200, seed: 32, bounds: 16, shards: 3,
      waves: [{ n: 3, need: 0, outage: true }, { n: 4, need: 2 }],
      dan: { hp: 6, speed: 4, reach: 1.9, dmg: 1 }, worm: { hp: 3, speed: 2.1 },
      sky: '#3a2c6a', fog: [9, 30], ground: ['#3c7a2e', '#4a8c38', '#2f6624'],
    },
  },
  4: {
    kind: 'boss', name: 'הקרב האחרון', short: 'הקרב האחרון', era: 'FINAL · 8 › 16 › 32 › MODERN', eraIdx: 0, song: 'boss', next: null, final: true,
    intro: 'ההאקר נכנס מהדלת האחורית והוא שולט בעידנים. בכל פעם שתפגע בו מספיק, העולם יקפוץ לעידן הבא. פיקסי מבטיח שהפעם הטוקנים יספיקו. נראה.',
  },
};

const ARENA2D = (era, colors, tiles, extra) => ({
  era, tiles, seed: 404, w: 22, h: 16, base: era === '8bit' ? 176 : 224, shards: 0, waves: [], colors, voidMax: 0, pixiScale: era === '8bit' ? 1 : 0.6,
  enemy: { name: 'worm', hp: era === '8bit' ? 2 : 3, speed: era === '8bit' ? 26 : 30, r: era === '8bit' ? 5 : 7, dmg: 1 },
  dan: era === '8bit' ? { hp: 6, speed: 66, reach: 13, dmg: 1 } : { hp: 7, speed: 74, reach: 17, dmg: 1 }, ...extra,
});
const BOSS_PHASES = [
  { name: 'הקרב האחרון · 8 ביט', tag: '8 ביט', eraIdx: 0, say: 'זה ההאקר! הוא יורה קוד זדוני. תתחמק ותכה אותו מקרוב!',
    make: async () => new World2D(ARENA2D('8bit', GB, '8bit_valley_tileset', { arena: { boss: 'hacker', label: 'ההאקר · 8 ביט', hp: 8, speed: 20, r: 6, dmg: 1, boltEvery: 1.8, boltSpeed: 70, spread: [0], outageHalf: true } })) },
  { name: 'הקרב האחרון · 16 ביט', tag: '16 ביט', eraIdx: 1, say: 'הוא קפץ ל-16 ביט! עכשיו הוא יורה שלושה ברקים בבת אחת.',
    make: async () => new World2D(ARENA2D('16bit', SNES, '16bit_kingdom_tileset', { arena: { boss: 'hacker', label: 'ההאקר · 16 ביט', hp: 10, speed: 24, r: 8, dmg: 1, boltEvery: 1.7, boltSpeed: 85, spread: [-0.3, 0, 0.3] } })) },
  { name: 'הקרב האחרון · 32 ביט', tag: '32 ביט', eraIdx: 2, say: 'פוליגונים! הוא מתחמק בטלפורט. תסתובב מהר!',
    make: async () => new (await load3D())({ era: '32', mode: 'arena', low: 200, seed: 9, bounds: 11, sky: '#1d1236', fog: [7, 26], ground: ['#2d2a44', '#383356', '#221f36'], tree: '#5a3f8f',
      dan: { hp: 6, speed: 4.2, reach: 1.9, dmg: 1 }, worm: { hp: 2, speed: 2 },
      boss: { model: '32bit_hacker', label: 'ההאקר · 32 ביט', hp: 8, height: 2.2, boltEvery: 2, boltSpeed: 6, spread: [-0.3, 0, 0.3] } }) },
  { name: 'הקרב האחרון · מודרני', tag: 'מודרני', eraIdx: 3,
    make: async () => new (await load3D())({ era: 'modern', mode: 'arena', upgrade: true, seed: 11, bounds: 12, sky: '#120b22', fog: [10, 34], ground: ['#24233a', '#2c2a46', '#1b1a2c'], tree: '#3d2f6b', hemi: ['#b9c8ff', '#2a1530'],
      dan: { hp: 7, speed: 4.6, reach: 2, dmg: 1 }, worm: { hp: 3, speed: 2.4 },
      boss: { model: 'modern_hacker', label: 'ההאקר · מודרני', hp: 24, height: 2.3, boltEvery: 1.4, boltSpeed: 8, spread: [-0.45, -0.22, 0, 0.22, 0.45] } }) },
  // הטוויסט: מאחורי ההאקר עמד פיקסי 1.0 – גרסה ישנה, חומה ובלויה
  { name: 'הקרב האחרון · פיקסי 1.0', tag: 'פיקסי 1.0', eraIdx: 1, twist: true, sayT: 5,
    say: 'רגע… החתימה בקוד של ההאקר… זה אני?! זה פיקסי 1.0. הגרסה הראשונה שלי. הוא זה שהפעיל אותו!',
    say2: 'הוא לא רע… הוא פשוט לא עודכן אף פעם. תחליש אותו, דן. אל תמחק אותו.',
    make: async () => new World2D(ARENA2D('16bit', SEPIA, '16bit_kingdom_tileset', { swordMul: 3, tint: 'sepia(0.85) saturate(0.7) brightness(0.8)',
      arena: { boss: 'pixi1', label: 'פיקסי 1.0', hp: 18, speed: 22, r: 12, dmg: 1, scale: 2, boltEvery: 1.5, boltSpeed: 80, spread: [-0.5, -0.25, 0, 0.25, 0.5] } })) },
];

export async function makeLevel(id) {
  const W = WORLDS[id];
  if (W.kind === '2d') return new World2D(W.cfg);
  if (W.kind === '3d') return new (await load3D())(W.cfg);
  if (W.kind === 'boss') return new BossLevel(BOSS_PHASES);
  throw new Error('unknown world ' + id);
}
