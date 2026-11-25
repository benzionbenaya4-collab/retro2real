// צ'יפטיון ב-WebAudio: מוזיקה לפי עידן + אפקטים. נפתח רק אחרי מגע/לחיצה (מדיניות דפדפנים).
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
const SONGS = {
  title: { bpm: 100, mel: [62, 0, 69, 0, 67, 65, 64, 0, 62, 0, 57, 0, 60, 62, 64, 0], bass: [38, 38, 34, 34, 36, 36, 33, 33] },
  valley: { bpm: 132, mel: [64, 67, 71, 67, 72, 71, 67, 64, 62, 66, 69, 66, 71, 69, 66, 62], bass: [40, 40, 43, 43, 38, 38, 42, 42] },
  kingdom: { bpm: 120, mel: [60, 64, 67, 72, 71, 67, 64, 67, 65, 69, 72, 77, 76, 72, 69, 67], bass: [36, 43, 41, 43, 36, 43, 41, 38] },
  polygon: { bpm: 140, mel: [57, 60, 64, 65, 64, 60, 57, 55, 57, 60, 64, 69, 67, 64, 60, 59], bass: [33, 33, 36, 36, 29, 29, 31, 31] },
  boss: { bpm: 156, mel: [62, 63, 62, 69, 68, 62, 63, 66, 62, 63, 62, 70, 69, 66, 63, 61], bass: [38, 38, 39, 39, 38, 38, 37, 37] },
  win: { bpm: 110, mel: [72, 0, 76, 0, 79, 0, 84, 0, 83, 79, 76, 79, 81, 0, 84, 0], bass: [36, 36, 41, 41, 43, 43, 36, 36] },
};

class Audio {
  constructor() { this.ac = null; this.on = true; this.song = null; this.era = 0; this.beat = 0; this.next = 0; }
  unlock() {
    if (this.ac) { if (this.ac.state === 'suspended') this.ac.resume(); return; }
    try {
      this.ac = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ac.createGain(); this.master.gain.value = this.on ? 0.5 : 0; this.master.connect(this.ac.destination);
      this.music = this.ac.createGain(); this.music.gain.value = 0.55; this.music.connect(this.master);
      const len = this.ac.sampleRate * 0.5, b = this.ac.createBuffer(1, len, this.ac.sampleRate), d = b.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1; this.noiseBuf = b;
    } catch (e) { console.warn('no audio', e); this.ac = null; }
  }
  setOn(v) { this.on = v; if (this.master) this.master.gain.value = v ? 0.5 : 0; }
  play(song, era = 0) { if (this.song !== song) { this.song = song; this.beat = 0; if (this.ac) this.next = this.ac.currentTime + 0.05; } this.era = era; }
  stop() { this.song = null; }
  tone(type, f, at, dur, vol, dest = this.master, slide = 0) {
    const o = this.ac.createOscillator(), g = this.ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f, at); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, f * slide), at + dur);
    g.gain.setValueAtTime(vol, at); g.gain.exponentialRampToValueAtTime(0.0008, at + dur);
    o.connect(g).connect(dest); o.start(at); o.stop(at + dur + 0.02);
  }
  noise(at, dur, vol, dest = this.master, hp = 0) {
    const n = this.ac.createBufferSource(), g = this.ac.createGain(); n.buffer = this.noiseBuf;
    g.gain.setValueAtTime(vol, at); g.gain.exponentialRampToValueAtTime(0.0008, at + dur);
    let src = n; if (hp) { const f = this.ac.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp; n.connect(f); src = f; }
    src.connect(g).connect(dest); n.start(at); n.stop(at + dur + 0.02);
  }
  /** לקרוא בכל פריים */
  tick() {
    const ac = this.ac; if (!ac || !this.song || ac.state !== 'running') return;
    const S = SONGS[this.song], spb = 60 / S.bpm / 2, e = this.era, M = this.music;
    if (this.next < ac.currentTime - 0.3) this.next = ac.currentTime + 0.02;
    while (this.next < ac.currentTime + 0.15) {
      const b = this.beat, at = this.next, m = S.mel[b % 16];
      if (m) {
        const lead = e === 0 ? 'square' : e === 1 ? 'square' : e === 2 ? 'triangle' : 'sawtooth';
        this.tone(lead, hz(m + (e === 3 ? 12 : 0)), at, spb * 0.85, e === 3 ? 0.05 : 0.07, M);
        if (e >= 2) this.tone('sine', hz(m + 7), at, spb * 0.8, 0.025, M);
      }
      if (b % 2 === 0) this.tone(e === 0 ? 'square' : 'triangle', hz(S.bass[(b >> 1) % 8] - (e === 0 ? 0 : 12)), at, spb * 1.7, e === 0 ? 0.04 : 0.14, M);
      if (e >= 1) { if (b % 4 === 2) this.noise(at, 0.07, 0.07, M, 1200); }
      if (e >= 2) { if (b % 4 === 0) this.tone('sine', 120, at, 0.16, 0.35, M, 0.3); }
      if (e >= 3 && b % 8 === 4) this.noise(at, 0.15, 0.12, M, 400);
      this.next += spb; this.beat++;
    }
  }
  sfx(name) {
    const ac = this.ac; if (!ac || ac.state !== 'running') return; const t = ac.currentTime;
    switch (name) {
      case 'swing': this.noise(t, 0.09, 0.12, this.master, 2500); this.tone('square', 880, t, 0.08, 0.04, this.master, 0.5); break;
      case 'hit': this.tone('square', 220, t, 0.12, 0.12, this.master, 0.4); this.noise(t, 0.06, 0.1); break;
      case 'kill': this.tone('square', 440, t, 0.25, 0.1, this.master, 0.2); this.noise(t, 0.2, 0.08); break;
      case 'hurt': this.tone('sawtooth', 160, t, 0.3, 0.14, this.master, 0.5); break;
      case 'shard': [72, 76, 79, 84].forEach((m, i) => this.tone('square', hz(m), t + i * 0.06, 0.12, 0.08)); break;
      case 'heart': [67, 72].forEach((m, i) => this.tone('triangle', hz(m), t + i * 0.08, 0.15, 0.12)); break;
      case 'pixi': [84, 88, 91].forEach((m, i) => this.tone('sine', hz(m), t + i * 0.05, 0.1, 0.07)); break;
      case 'scan': this.tone('sine', 400, t, 0.6, 0.06, this.master, 4); break;
      case 'empty': [70, 66, 62, 58].forEach((m, i) => this.tone('square', hz(m), t + i * 0.1, 0.12, 0.06)); break;
      case 'refill': [60, 64, 67, 72, 76].forEach((m, i) => this.tone('sine', hz(m), t + i * 0.06, 0.14, 0.07)); break;
      case 'void': this.tone('sawtooth', 70, t, 0.3, 0.05, this.master, 0.6); break;
      case 'wave': [57, 57, 64].forEach((m, i) => this.tone('square', hz(m), t + i * 0.12, 0.1, 0.07)); break;
      case 'warp': this.tone('sawtooth', 100, t, 0.9, 0.08, this.master, 12); this.noise(t, 0.9, 0.06, this.master, 800); break;
      case 'bolt': this.tone('sawtooth', 900, t, 0.15, 0.05, this.master, 0.3); break;
      case 'boost': [60, 67, 72, 79].forEach((m, i) => this.tone('sawtooth', hz(m), t + i * 0.04, 0.1, 0.05)); this.tone('square', 300, t, 0.4, 0.04, this.master, 3); break;
      case 'start': [60, 67, 72, 79, 84].forEach((m, i) => this.tone('square', hz(m), t + i * 0.07, 0.12, 0.08)); break;
      case 'upgrade': for (let i = 0; i < 12; i++) this.tone(i % 2 ? 'sawtooth' : 'square', hz(60 + i * 2), t + i * 0.08, 0.2, 0.06); break;
    }
  }
}
export const audio = new Audio();
