// קרב הבוס: ההאקר קופץ בין עידנים 8 → 16 → 32 → מודרני. כל שלב הוא עולם קטן (זירה) עם חוקים משלו.
import { audio } from './audio.js';
import { hud } from './hud.js';
import { pixi } from './pixi.js';

export class BossLevel {
  constructor(phases) { this.phases = phases; this.levels = phases.map((p) => p.make()); this.i = 0; }
  get cur() { return this.levels[this.i]; }
  get is3d() { return !!this.cur.is3d; }
  get cfg() { return this.cur.cfg; }
  async load() { await Promise.all(this.levels.map((l) => l.load())); }
  start() { this.i = 0; this.begin(); }
  begin() {
    const P = this.phases[this.i];
    this.cur.start(); this.onChange?.();
    audio.play('boss', P.eraIdx); hud.setWorld(P.name);
    hud.banner(`${this.i ? 'קפיצת עידן!' : 'ההאקר'}<small>${P.tag}</small>`, 2.2);
    if (P.say) setTimeout(() => hud.say(P.say, 3.6), this.i === 3 ? 200 : 1300);
  }
  update(dt, inp) {
    const r = this.cur.update(dt, inp);
    if (r === 'dead') return 'dead';
    if (r === 'win') {
      if (this.i === this.levels.length - 1) return 'win';
      if (pixi.out) pixi.refill();
      audio.sfx('warp'); this.cur.dispose?.(); this.i++; this.begin();
    }
    return null;
  }
  draw(ctx, w, h) { this.cur.draw?.(ctx, w, h); }
  render() { this.cur.render?.(); }
  resize(w, h) { this.cur.resize?.(w, h); }
  dispose() { this.cur.dispose?.(); }
}
