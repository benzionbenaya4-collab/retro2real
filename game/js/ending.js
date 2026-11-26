// סוף פתוח: הקונסולה של נועם נדלקת לבד, מופיעה קלטת שחורה בלי שם. מכניסים – עין אדומה – המסך נכבה – "להמשך…"
import { audio } from './audio.js';

export class Ending {
  constructor() { this.t = 0; this.phase = 'wake'; this.pt = 0; this.ins = 0; this.btn = null; }
  setPhase(p) { this.phase = p; this.pt = 0; }
  /** מחזיר 'done' בסוף */
  update(dt, inp) {
    this.t += dt; this.pt += dt;
    const P = this.phase;
    if (P === 'wake' && this.pt > 1.6) { this.setPhase('on'); audio.sfx('bolt'); this.static(0.8); }
    else if (P === 'on' && this.pt > 1.8) { this.setPhase('tape'); audio.sfx('void'); }
    else if (P === 'tape' && this.pt > 1.2) { this.setPhase('wait'); this.showButton(true); }
    else if (P === 'wait' && (inp.aPressed || this.clicked)) { this.showButton(false); this.setPhase('insert'); audio.sfx('swing'); }
    else if (P === 'insert' && this.pt > 1.1) { this.setPhase('dark'); audio.sfx('warp'); }
    else if (P === 'dark' && this.pt > 0.9) { this.setPhase('eye'); audio.sfx('kill'); }
    else if (P === 'eye' && this.pt > 1.4) { this.setPhase('off'); this.static(0.25); }
    else if (P === 'off' && this.pt > 0.7) { this.setPhase('black'); }
    else if (P === 'black' && this.pt > 1.2) { this.setPhase('cont'); }
    else if (P === 'cont' && this.pt > 3.2 && (inp.aPressed || this.clicked || this.pt > 9)) return 'done';
    this.clicked = false;
    return null;
  }
  static(sec) { try { audio.ac && audio.noise(audio.ac.currentTime, sec, 0.06, audio.master, 1500); } catch { /* */ } }
  showButton(on) {
    if (on && !this.btn) {
      const b = document.createElement('button'); b.className = 'menu-btn end-insert'; b.textContent = '📼 להכניס את הקלטת';
      b.onclick = () => (this.clicked = true); document.getElementById('stage').appendChild(b); this.btn = b; setTimeout(() => b.focus(), 30);
    }
    if (!on && this.btn) { this.btn.remove(); this.btn = null; }
  }
  dispose() { this.showButton(false); }
  draw(ctx, W, H) {
    const P = this.phase, t = this.t, pt = this.pt;
    ctx.fillStyle = '#05040a'; ctx.fillRect(0, 0, W, H);
    if (P === 'black' || P === 'cont') {
      if (P === 'cont') {
        ctx.save(); ctx.globalAlpha = Math.min(1, pt / 1.2); ctx.fillStyle = '#efe9f7'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.direction = 'rtl';
        ctx.font = `900 ${Math.round(Math.min(W, H) * 0.14)}px Rubik, sans-serif`; ctx.fillText('להמשך…', W / 2, H / 2);
        if (pt > 3.2 && Math.floor(t * 2) % 2) { ctx.font = '7px "Press Start 2P", monospace'; ctx.direction = 'ltr'; ctx.fillStyle = '#9a90ad'; ctx.fillText('PRESS A', W / 2, H / 2 + Math.min(W, H) * 0.16); }
        ctx.restore();
      }
      return;
    }
    const cx = Math.round(W / 2), tvW = Math.min(110, Math.round(W * 0.6)), tvH = Math.round(tvW * 0.72), tvX = cx - tvW / 2, tvY = Math.round(H * 0.42 - tvH / 2);
    const on = P !== 'wake';
    // אור מהמסך על הקיר
    if (on && P !== 'off') { const g = ctx.createRadialGradient(cx, tvY + tvH / 2, 4, cx, tvY + tvH / 2, tvW * 1.3); g.addColorStop(0, P === 'eye' ? '#ff3d6e33' : '#6fe3ff22'); g.addColorStop(1, '#0000'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
    // טלוויזיה
    ctx.fillStyle = '#2b2538'; ctx.fillRect(tvX - 6, tvY - 6, tvW + 12, tvH + 12);
    ctx.fillStyle = '#000'; ctx.fillRect(tvX, tvY, tvW, tvH);
    const scr = () => { ctx.save(); ctx.beginPath(); ctx.rect(tvX, tvY, tvW, tvH); ctx.clip(); };
    if (P === 'on' || P === 'tape' || P === 'wait' || P === 'insert') { // רעש/מסך כחלחל
      scr(); for (let i = 0; i < (P === 'on' ? 500 : 120); i++) { ctx.fillStyle = Math.random() < 0.5 ? '#9a90ad' : '#3a3550'; ctx.fillRect(tvX + Math.random() * tvW, tvY + Math.random() * tvH, 2, 1); }
      if (P !== 'on') { ctx.fillStyle = '#efe9f7'; ctx.font = '6px "Press Start 2P", monospace'; ctx.textAlign = 'center'; ctx.direction = 'ltr'; if (Math.floor(t * 2) % 2) ctx.fillText('INSERT TAPE', cx, tvY + tvH / 2); }
      ctx.restore();
    }
    if (P === 'eye') { // עין אדומה נפתחת
      scr(); const open = Math.min(1, pt / 0.35) * (pt > 1.15 ? Math.max(0, 1 - (pt - 1.15) / 0.2) : 1), ew = tvW * 0.42, eh = tvH * 0.34 * open, ey = tvY + tvH / 2;
      ctx.fillStyle = '#1a0006'; ctx.fillRect(tvX, tvY, tvW, tvH);
      ctx.fillStyle = '#e8d2d6'; ctx.beginPath(); ctx.ellipse(cx, ey, ew, Math.max(0.5, eh), 0, 0, Math.PI * 2); ctx.fill();
      const lx = Math.sin(t * 3) * ew * 0.15;
      ctx.fillStyle = '#ff3d6e'; ctx.beginPath(); ctx.arc(cx + lx, ey, Math.min(eh, tvH * 0.16), 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(cx + lx, ey, Math.min(eh, tvH * 0.07), 0, Math.PI * 2); ctx.fill();
      for (let i = 0; i < 6; i++) { ctx.fillStyle = '#ff3d6e'; ctx.fillRect(tvX + Math.random() * tvW, tvY + Math.random() * tvH, 6 + Math.random() * 16, 1); }
      ctx.restore();
    }
    if (P === 'off') { // כיבוי CRT: קו ואז נקודה
      const k = pt / 0.7; scr(); ctx.fillStyle = '#fff';
      if (k < 0.5) { const h = Math.max(1, tvH * (1 - k * 2)); ctx.fillRect(tvX, tvY + tvH / 2 - h / 2, tvW, h); }
      else { const w = Math.max(1, tvW * (1 - (k - 0.5) * 2)); ctx.fillRect(cx - w / 2, tvY + tvH / 2 - 1, w, 2); }
      ctx.restore();
    }
    // קונסולה של נועם
    const cw = Math.round(tvW * 0.7), ch = 16, cX = cx - cw / 2, cY = tvY + tvH + 28;
    ctx.fillStyle = '#3a3550'; ctx.fillRect(cX, cY, cw, ch); ctx.fillStyle = '#2b2538'; ctx.fillRect(cX, cY + ch - 4, cw, 4);
    ctx.fillStyle = '#05040a'; ctx.fillRect(cx - 14, cY + 3, 28, 4); // חריץ
    ctx.fillStyle = on && P !== 'off' ? (Math.floor(t * 3) % 2 || P !== 'on' ? '#ff3d6e' : '#5a1020') : '#2b0a12'; ctx.fillRect(cX + 5, cY + 8, 3, 3); // נורית
    // הקלטת השחורה בלי שם
    if (P === 'tape' || P === 'wait' || P === 'insert') {
      const appear = P === 'tape' ? Math.min(1, pt / 1.2) : 1, sink = P === 'insert' ? Math.min(1, pt / 0.9) : 0;
      // מונחת על הקונסולה ליד החריץ; בהכנסה זזה אל החריץ ושוקעת פנימה
      const slide = P === 'insert' ? Math.min(1, pt / 0.45) : 0, sink2 = P === 'insert' ? Math.max(0, Math.min(1, (pt - 0.45) / 0.5)) : 0;
      const tx = Math.round(cx + cw / 2 - 28 - slide * (cw / 2 - 16)), ty = Math.round(cY - 15 + (1 - appear) * -8 - slide * 4 + sink2 * 18);
      ctx.save(); ctx.globalAlpha = appear; ctx.beginPath(); ctx.rect(0, 0, W, cY + 5); ctx.clip();
      ctx.fillStyle = '#000'; ctx.fillRect(tx, ty, 24, 15); ctx.fillStyle = '#1b1724'; ctx.fillRect(tx + 3, ty + 2, 18, 6); // מדבקה ריקה
      ctx.fillStyle = '#2b2538'; ctx.fillRect(tx + 6, ty + 9, 3, 3); ctx.fillRect(tx + 15, ty + 9, 3, 3);
      if (P === 'wait' && (t * 0.8) % 2 < 0.2) { ctx.fillStyle = '#ff3d6e'; ctx.fillRect(tx + 11, ty + 4, 2, 2); }
      ctx.restore();
    }
  }
}
