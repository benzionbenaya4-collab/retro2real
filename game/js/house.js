// פרק 2 – החיים האמיתיים: הבית של דן (תלת-ממד מודרני).
// הווירוס יצא מהקונסולה אל הבית. מכשירים נגועים: טלוויזיה (יורה פופ-אפים), מקרר (זורק קוביות קרח),
// שואבי אבק רובוטיים (רודפים), ובסוף הבוס – הנתב, שממנו הכול מתפשט. פיקסי כמעט בלי קליטה.
import * as THREE from 'three';
import { World3D } from './world3d.js';
import { audio } from './audio.js';
import { hud } from './hud.js';
import { pixi } from './pixi.js';

const V3 = THREE.Vector3;
// הבית: x ∈ [-13,13], z ∈ [-9,9]. סלון (x<0, z<1), מטבח (x>0, z<1), החדר של נועם (z>1)
const HX = 13, HZ = 9, WALL_H = 1.15, WT = 0.2;

function tex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }

export class House extends World3D {
  // ---------- בנייה ----------
  buildEnv(S, Mat) {
    S.background = new THREE.Color('#120d1c'); S.fog = null;
    this.sun.intensity = 0.55; this.sun.color.set('#9fb4ff'); this.sun.position.set(-10, 12, -14); // אור ירח מהחלון
    S.children.filter((o) => o.isHemisphereLight).forEach((h) => { h.color.set('#ffe2c4'); h.groundColor.set('#3a2a20'); h.intensity = 0.55; });
    const box = (w, h, d, color, x, y, z, opt = {}) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), opt.mat || Mat({ color, ...(opt.m || {}) })); m.position.set(x, y, z); m.castShadow = opt.shadow !== false; m.receiveShadow = true; S.add(m); if (opt.solid) this.boxes.push({ x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2 }); return m; };
    this.box = box;
    // רצפות
    const wood = tex(256, 256, (x, w, h) => { for (let i = 0; i < 8; i++) { x.fillStyle = ['#8a5a32', '#7a4e2b', '#93633a', '#83552f'][i % 4]; x.fillRect(0, i * 32, w, 32); x.fillStyle = '#5e3a1e'; x.fillRect(0, i * 32, w, 2); x.fillRect(((i * 97) % 200) + 20, i * 32, 2, 32); } });
    wood.wrapS = wood.wrapT = THREE.RepeatWrapping; wood.repeat.set(4, 4);
    const tiles = tex(128, 128, (x) => { for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { x.fillStyle = (i + j) % 2 ? '#e8e4dc' : '#c9c2b6'; x.fillRect(i * 32, j * 32, 32, 32); } });
    tiles.wrapS = tiles.wrapT = THREE.RepeatWrapping; tiles.repeat.set(6, 5);
    const carpet = tex(128, 128, (x) => { x.fillStyle = '#3b5a8a'; x.fillRect(0, 0, 128, 128); for (let i = 0; i < 400; i++) { x.fillStyle = Math.random() < 0.5 ? '#33507c' : '#4366a0'; x.fillRect(Math.random() * 128, Math.random() * 128, 2, 2); } });
    carpet.wrapS = carpet.wrapT = THREE.RepeatWrapping; carpet.repeat.set(6, 3);
    const floor = (w, d, x, z, map) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), Mat({ map, roughness: 0.7 })); m.rotation.x = -Math.PI / 2; m.position.set(x, 0, z); m.receiveShadow = true; S.add(m); };
    floor(13, 10, -6.5, -4, wood); floor(13, 10, 6.5, -4, tiles); floor(26, 8, 0, 5, carpet);
    // קירות נמוכים (בית בובות – המצלמה רואה מעליהם)
    const wallM = Mat({ color: '#e9dcc8' }), trimM = Mat({ color: '#a07850' });
    const wall = (x0, z0, x1, z1) => {
      const w = Math.max(WT, Math.abs(x1 - x0)), d = Math.max(WT, Math.abs(z1 - z0)), cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
      box(w, WALL_H, d, null, cx, WALL_H / 2, cz, { mat: wallM, solid: true }); box(w + 0.02, 0.06, d + 0.02, null, cx, WALL_H + 0.03, cz, { mat: trimM, shadow: false });
    };
    wall(-HX, -HZ, HX, -HZ); wall(-HX, HZ, HX, HZ); wall(-HX, -HZ, -HX, HZ); wall(HX, -HZ, HX, HZ);
    wall(-HX, 1, -8, 1); wall(-5, 1, 5, 1); wall(8, 1, HX, 1); // דלתות לחדר של נועם
    wall(0, -HZ, 0, -4.5); wall(0, -1.5, 0, 1);               // דלת בין סלון למטבח
    // חלונות (אור ירח)
    for (const x of [-9, -4, 4, 9]) { const g = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.6), new THREE.MeshBasicMaterial({ color: '#9fb4ff' })); g.position.set(x, 0.75, -HZ + 0.11); S.add(g); }
    // ---- סלון ----
    const sofaM = Mat({ color: '#6a4a8a' });
    box(3.2, 0.45, 1.0, null, -6.5, 0.22, -2.6, { mat: sofaM, solid: true }); box(3.2, 0.6, 0.25, null, -6.5, 0.6, -2.15, { mat: sofaM }); box(0.25, 0.55, 1.0, null, -8.0, 0.45, -2.6, { mat: sofaM }); box(0.25, 0.55, 1.0, null, -5.0, 0.45, -2.6, { mat: sofaM });
    box(1.6, 0.35, 0.8, '#7a4e2b', -6.5, 0.18, -5.2, { solid: true });
    const rug = new THREE.Mesh(new THREE.CircleGeometry(2.2, 32), Mat({ color: '#b8543a', roughness: 1 })); rug.rotation.x = -Math.PI / 2; rug.position.set(-6.5, 0.01, -4.6); rug.receiveShadow = true; S.add(rug);
    box(0.3, 1.6, 0.3, '#3a3550', -11.8, 0.8, -7.8, { solid: true }); const lampShade = box(0.6, 0.4, 0.6, '#ffe2a8', -11.8, 1.75, -7.8, { m: { emissive: '#ffcf8a', emissiveIntensity: 0.8 } }); lampShade.castShadow = false;
    box(0.8, 1.4, 0.4, '#5e3a1e', -11.9, 0.7, -2, { solid: true }); // מדף ספרים
    // ---- מטבח ----
    box(6.4, 0.9, 0.7, '#d8d0c4', 6, 0.45, -8.45, { solid: true }); box(6.4, 0.05, 0.75, '#4a4258', 6, 0.92, -8.45, { shadow: false });
    box(0.7, 0.9, 3.5, '#d8d0c4', 12.45, 0.45, -5.8, { solid: true });
    box(2.2, 0.08, 1.2, '#93633a', 6.5, 0.75, -3.2, { solid: false }); for (const [x, z] of [[-0.95, -0.5], [0.95, -0.5], [-0.95, 0.5], [0.95, 0.5]]) box(0.08, 0.75, 0.08, '#5e3a1e', 6.5 + x, 0.37, -3.2 + z, { shadow: false });
    this.boxes.push({ x0: 5.4, x1: 7.6, z0: -3.8, z1: -2.6 });
    for (const [x, z] of [[5.3, -3.2], [7.7, -3.2]]) box(0.45, 0.45, 0.45, '#b8543a', x, 0.23, z);
    // ---- החדר של נועם ----
    box(2.2, 0.5, 3.4, '#3b6fd6', -10.8, 0.25, 6.8, { solid: true }); box(2.2, 0.15, 0.9, '#efe9f7', -10.8, 0.55, 8.1);
    const poster = (x, color, label) => { const t = tex(64, 80, (c) => { c.fillStyle = color; c.fillRect(0, 0, 64, 80); c.fillStyle = '#fff'; c.font = 'bold 10px sans-serif'; c.textAlign = 'center'; c.fillText(label, 32, 70); c.fillStyle = '#ffcf4a'; c.fillRect(16, 14, 32, 32); c.fillStyle = '#1b1724'; c.fillRect(24, 24, 5, 5); c.fillRect(36, 24, 5, 5); }); const m = new THREE.Mesh(new THREE.PlaneGeometry(0.64, 0.8), new THREE.MeshBasicMaterial({ map: t })); m.position.set(x, 0.75, HZ - 0.11); m.rotation.y = Math.PI; S.add(m); };
    poster(-6, '#ff3d6e', 'RETRO'); poster(-3.5, '#3b6fd6', 'PIXI'); poster(11.5, '#2bd46a', 'LEVEL 1');
    for (let i = 0; i < 3; i++) box(1.6, 0.06, 0.35, '#7a4e2b', -6.5, 0.45 + i * 0.35, 8.65, { shadow: false });
    for (let i = 0; i < 5; i++) box(0.22, 0.22, 0.22, ['#ff3d6e', '#ffcf4a', '#6fe3ff', '#7dff9b', '#efe9f7'][i], -7.2 + i * 0.35, 0.6 + (i % 3) * 0.35, 8.65);
    // שולחן הנתב (אמצע) + שולחן הקונסולה
    box(2.4, 0.7, 0.9, '#5e3a1e', 0, 0.35, 8.25, { solid: true });
    box(2.4, 0.7, 0.9, '#5e3a1e', 8.5, 0.35, 8.25, { solid: true });
    const ctv = box(1.0, 0.65, 0.12, '#1b1724', 8.5, 1.05, 8.45); const ctvS = new THREE.Mesh(new THREE.PlaneGeometry(0.88, 0.52), new THREE.MeshBasicMaterial({ color: '#05040a' })); ctvS.position.set(8.5, 1.05, 8.38); ctvS.rotation.y = Math.PI; S.add(ctvS); ctv.castShadow = false;
    box(0.6, 0.1, 0.35, '#3a3550', 8.5, 0.75, 8.0); // הקונסולה של נועם
    this.consoleLed = box(0.05, 0.03, 0.02, null, 8.3, 0.76, 7.82, { mat: new THREE.MeshBasicMaterial({ color: '#2b0a12' }), shadow: false });
    // תאורה ביתית חמה
    for (const [x, z, i] of [[-6.5, -4, 30], [6.5, -4, 30], [-6, 5, 26], [6, 5, 26]]) { const L = new THREE.PointLight('#ffcf8a', i, 16, 1.6); L.position.set(x, 2.6, z); S.add(L); this.roomLights ||= []; this.roomLights.push(L); }
    this.solids.push({ x: -11.8, z: -7.8, r: 0.3 });
  }
  clampPos(p) { p.x = Math.max(-HX + 0.4, Math.min(HX - 0.4, p.x)); p.z = Math.max(-HZ + 0.4, Math.min(HZ - 0.4, p.z)); }

  start() {
    super.start();
    // פיקסי: אין וויי-פיי
    pixi.noWifi = true; pixi.out = true; pixi.tokens = 0;
    setTimeout(() => hud.say('אין פה וויי-פיי… 😅 בבית אני כמעט בלי קליטה. אבל אני איתך!', 4), 2200);
    this.stage = 0; this.winT = 0; this.barOwner = true;
    this.makeTV(); this.makeFridge(); this.makeRouter(); this.vacuums = [];
    // סמן יעד "!"
    const t = tex(32, 32, (x) => { x.fillStyle = '#ffcf4a'; x.beginPath(); x.arc(16, 16, 14, 0, 7); x.fill(); x.fillStyle = '#1b1724'; x.fillRect(14, 6, 4, 13); x.fillRect(14, 22, 4, 4); });
    this.goalMark = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false })); this.goalMark.scale.set(0.5, 0.5, 1); this.goalMark.renderOrder = 11; this.scene.add(this.goalMark);
    this.activate(this.tv, 'הטלוויזיה נגועה! היא יורה פופ-אפים. תכה בה!');
  }
  app(type, g, hp, name, extra = {}) { const e = { app: type, segs: [g], pos: g.position, hp, max: hp, inv: extra.dormant === false ? 0 : 1e9, t: 0, kb: new V3(), rise: 0, keepMesh: true, name, dormant: true, ...extra }; this.enemies.push(e); return e; }
  activate(e, line) { e.dormant = false; e.inv = 0; hud.banner(`${e.name}<small>${e.app === 'router' ? 'הבוס' : 'מכשיר נגוע'}</small>`, 2.2); audio.sfx('wave'); if (line) setTimeout(() => hud.say(line, 3.4), 900); }

  makeTV() {
    const g = new THREE.Group(), M = this.Mat;
    const stand = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.5, 0.5), M({ color: '#3a3550' })); stand.position.y = 0.25; g.add(stand);
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.92, 0.1), M({ color: '#111018' })); body.position.y = 1.0; g.add(body);
    this.tvCanvas = document.createElement('canvas'); this.tvCanvas.width = 64; this.tvCanvas.height = 36; this.tvTex = new THREE.CanvasTexture(this.tvCanvas); this.tvTex.colorSpace = THREE.SRGBColorSpace; this.tvTex.magFilter = THREE.NearestFilter;
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(1.48, 0.82), new THREE.MeshBasicMaterial({ map: this.tvTex })); scr.position.set(0, 1.0, 0.06); g.add(scr); this.tvScreen = scr;
    this.tvLight = new THREE.PointLight('#8fb4ff', 6, 6, 1.6); this.tvLight.position.set(0, 1, 0.8); g.add(this.tvLight);
    g.position.set(-6.5, 0, -8.35); g.traverse((o) => { if (o.isMesh) o.castShadow = true; }); this.scene.add(g);
    this.boxes.push({ x0: -7.4, x1: -5.6, z0: -8.7, z1: -8.0 });
    this.tv = this.app('tv', g, 10, 'הטלוויזיה הנגועה', { fireT: 2, popT: 1.5 });
    this.tv.onDie = () => { this.tvDead = true; this.tvLight.intensity = 0; this.burst(new V3(-6.5, 1, -8), '#bff6ff', 24, 5); this.next(); };
  }
  makeFridge() {
    const g = new THREE.Group(), M = this.Mat({ color: '#e8eef4', roughness: 0.4, metalness: 0.2 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.0, 2.0, 0.8), M); body.position.y = 1.0; g.add(body);
    const pivot = new THREE.Group(); pivot.position.set(-0.5, 0, 0.41); g.add(pivot);
    const door = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.2, 0.06), M); door.position.set(0.5, 1.35, 0.03); pivot.add(door);
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.5, 0.06), this.Mat({ color: '#8a8794' })); handle.position.set(0.88, 1.35, 0.09); pivot.add(handle);
    const eye = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.12), new THREE.MeshBasicMaterial({ color: '#ff3d6e' })); eye.position.set(0, 0.55, 0.42); g.add(eye);
    g.position.set(10.6, 0, -8.25); g.traverse((o) => { if (o.isMesh) o.castShadow = true; }); this.scene.add(g);
    this.boxes.push({ x0: 10.1, x1: 11.1, z0: -8.7, z1: -7.85 });
    this.fridge = this.app('fridge', g, 12, 'המקרר הנגוע', { throwT: 2, pivot, eye });
    this.fridge.onDie = () => { this.fridge.pivot.rotation.y = -1.2; this.fridge.eye.material.color.set('#2b2538'); this.burst(new V3(10.6, 1.4, -7.8), '#bff6ff', 24, 5); this.next(); };
  }
  makeRouter() {
    const g = new THREE.Group(), M = this.Mat;
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.18, 0.5), M({ color: '#16131f', roughness: 0.4 })); body.position.y = 0.09; g.add(body);
    this.routerLeds = [];
    for (let i = 0; i < 5; i++) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.03, 0.02), new THREE.MeshBasicMaterial({ color: '#2bd46a' })); l.position.set(-0.24 + i * 0.12, 0.12, -0.26); g.add(l); this.routerLeds.push(l); }
    this.antennas = [];
    for (const x of [-0.3, 0, 0.3]) { const a = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 0.6, 6), M({ color: '#16131f' })); a.position.set(x, 0.45, 0.18); g.add(a); this.antennas.push(a); }
    this.routerLight = new THREE.PointLight('#ff3d6e', 0, 5, 1.6); this.routerLight.position.set(0, 0.6, -0.4); g.add(this.routerLight);
    g.position.set(0, 0.7, 8.2); g.rotation.y = Math.PI; g.traverse((o) => { if (o.isMesh) o.castShadow = true; }); this.scene.add(g);
    this.router = this.app('router', g, 30, 'הנתב', { ringT: 2.5, sumT: 5, spin: 0 });
    this.router.onDie = () => {
      this.routerDead = true; this.routerLight.intensity = 0; this.routerLeds.forEach((l) => l.material.color.set('#2bd46a'));
      for (const e of this.enemies) if (!e.dead && !e.app) { e.dead = true; e.segs.forEach((s) => this.scene.remove(s)); }
      for (const v of this.vacuums) v.dead = true;
      this.burst(new V3(0, 1, 8), '#6fe3ff', 40, 6); this.flash('#ffffff'); audio.sfx('upgrade');
      hud.banner('הבית חזר לשגרה!<small>הנתב נוקה</small>', 3);
      pixi.noWifi = false; setTimeout(() => pixi.refill('עדכון: חזר הוויי-פיי! 📶 וגם הטוקנים!'), 1200);
      this.winT = 4;
    };
  }
  spawnVacuum(x, z) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.38, 0.13, 20), this.Mat({ color: '#2b2538', roughness: 0.4 })); body.position.y = 0.08; g.add(body);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.025, 6, 20), new THREE.MeshBasicMaterial({ color: '#ff3d6e' })); ring.rotation.x = Math.PI / 2; ring.position.y = 0.15; g.add(ring);
    const bump = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.06, 0.08), this.Mat({ color: '#16131f' })); bump.position.set(0, 0.1, 0.34); g.add(bump);
    g.position.set(x, 0, z); g.traverse((o) => { if (o.isMesh) o.castShadow = true; }); this.scene.add(g);
    const e = this.app('vac', g, 3, 'שואב אבק רובוטי', { dormant: false, keepMesh: false, speed: 2.7, vel: new V3(), ring }); e.pos.y = 0; this.vacuums.push(e); this.burst(g.position, '#ff3d6e', 8); return e;
  }
  /** סדר המשימות: טלוויזיה → מקרר → שואבי אבק → הנתב */
  next() {
    this.stage++;
    if (this.stage === 1) setTimeout(() => this.activate(this.fridge, 'עכשיו המקרר! הוא זורק קוביות קרח – תזוז כשהדלת נפתחת.'), 1500);
    if (this.stage === 2) setTimeout(() => { for (const [x, z] of [[-8, 4], [-3, 6.5], [4, 4.5]]) this.spawnVacuum(x, z); hud.banner('שואבי אבק רובוטיים!<small>בחדר של נועם</small>', 2.2); audio.sfx('wave'); setTimeout(() => hud.say('השואבים של נועם נדבקו! שלושה, בחדר שלו.', 3.2), 900); }, 1500);
    if (this.stage === 3) setTimeout(() => this.activate(this.router, 'זה הנתב! ממנו הכול מתפשט. תכה בו – ותתחמק מהחבילות שהוא יורה!'), 1500);
  }
  // ---------- עדכון ----------
  extraUpdate(dt) {
    // שלב שואבים: כשכולם הושמדו → הנתב
    if (this.stage === 2 && this.vacuums.length && this.vacuums.every((v) => v.dead)) this.next();
    // סמן יעד
    const tgt = this.stage === 0 ? this.tv : this.stage === 1 ? this.fridge : this.stage === 2 ? this.vacuums.find((v) => !v.dead) : this.router;
    this.goalMark.visible = !!tgt && !tgt.dead && !tgt.dormant;
    if (this.goalMark.visible) this.goalMark.position.set(tgt.pos.x, (tgt.app === 'vac' ? 0.9 : tgt.app === 'router' ? 1.9 : 2.5) + Math.sin(this.t * 4) * 0.1, tgt.pos.z);
    // מד בוס
    if (tgt && !tgt.dormant && !tgt.dead) { if (this.stage === 2) { const left = this.vacuums.filter((v) => !v.dead).length; hud.bossBar(`שואבי אבק (${left})`, left / 3); } else hud.bossBar(tgt.name, tgt.hp / tgt.max); }
    else hud.bossBar(null);
    // מסך הטלוויזיה
    if (!this.tvDead && (this.tvT = (this.tvT || 0) - dt) <= 0) { this.tvT = 0.12; const x = this.tvCanvas.getContext('2d'); x.fillStyle = '#111'; x.fillRect(0, 0, 64, 36); for (let i = 0; i < 160; i++) { x.fillStyle = Math.random() < 0.5 ? '#9a90ad' : '#3a3550'; x.fillRect(Math.random() * 64, Math.random() * 36, 2, 1); } if (!this.tv.dormant && Math.random() < 0.3) { x.fillStyle = '#ff3d6e'; x.beginPath(); x.ellipse(32, 18, 12, 5, 0, 0, 7); x.fill(); x.fillStyle = '#000'; x.beginPath(); x.arc(32, 18, 3, 0, 7); x.fill(); } this.tvTex.needsUpdate = true; this.tvLight.intensity = 4 + Math.random() * 4; }
    else if (this.tvDead && !this.tvBlack) { this.tvBlack = true; const x = this.tvCanvas.getContext('2d'); x.fillStyle = '#05040a'; x.fillRect(0, 0, 64, 36); x.strokeStyle = '#555'; x.beginPath(); x.moveTo(20, 4); x.lineTo(30, 18); x.lineTo(26, 32); x.moveTo(30, 18); x.lineTo(46, 22); x.stroke(); this.tvTex.needsUpdate = true; }
    // ניצחון
    if (this.winT > 0) { this.winT -= dt; this.roomLights.forEach((L, i) => (L.intensity = 26 + Math.sin(this.t * 6 + i) * 4)); if (this.winT <= 0 && !this.result) { this.result = 'win'; audio.sfx('warp'); } }
  }
  updateApp(e, dt) {
    if (e.dead) return; e.t += dt; e.inv = Math.max(0, e.inv - dt);
    if (e.stun > 0) { e.stun -= dt; return; }
    if (e.dormant) return;
    const t = this.nearest(e.pos); if (!t) return;
    const to = new V3(t.pos.x - e.pos.x, 0, t.pos.z - e.pos.z), L = to.length() || 1; to.divideScalar(L);
    e.segs[0].visible = !(e.inv > 0 && Math.floor(e.inv * 20) % 2);
    if (e.app === 'tv') {
      e.fireT -= dt; e.popT -= dt;
      if (e.popT <= 0) { e.popT = e.hp < e.max / 2 ? 2.2 : 3.2; if (this.enemies.filter((o) => o.type === 'popup' && !o.dead).length < 2) { const p = new V3(-6.5, 0, -7.4); const v = this.spawnVirus('popup', p); v.rise = 0.2; audio.sfx('bolt'); } }
      if (e.fireT <= 0) { e.fireT = 2.6; this.fireBolts(new V3(-6.5, 1, -7.9), to, [-0.25, 0, 0.25], 6.5, '#bff6ff'); }
    } else if (e.app === 'fridge') {
      e.throwT -= dt; e.pivot.rotation.y = e.throwT < 0.5 ? -1.0 * (1 - e.throwT / 0.5) : Math.max(0, e.pivot.rotation.y - dt * 3);
      if (e.throwT <= 0) { e.throwT = e.hp < e.max / 2 ? 1.3 : 1.8; const n = e.hp < e.max / 2 ? 3 : 1; for (let i = 0; i < n; i++) this.throwIce(new V3(10.6, 1.5, -7.6), t.pos, i ? (i === 1 ? 1.1 : -1.1) : 0); }
    } else if (e.app === 'vac') {
      e.vel.lerp(to.multiplyScalar(e.speed), Math.min(1, dt * 2.5)); e.pos.addScaledVector(e.vel, dt).addScaledVector(e.kb, dt); e.kb.multiplyScalar(Math.exp(-6 * dt));
      this.collide(e.pos, 0.36); this.clampPos(e.pos); e.segs[0].rotation.y = Math.atan2(e.vel.x, e.vel.z); e.ring.material.color.set(Math.floor(e.t * 6) % 2 ? '#ff3d6e' : '#6fe3ff');
      for (const p of this.alive()) if (Math.hypot(p.pos.x - e.pos.x, p.pos.z - e.pos.z) < 0.6) { this.hurt(p, 1, new V3(p.pos.x - e.pos.x, 0, p.pos.z - e.pos.z)); e.kb.copy(e.vel).multiplyScalar(-1.5); }
    } else if (e.app === 'router') {
      e.ringT -= dt; e.sumT -= dt; e.spin += dt * 0.7;
      this.routerLeds.forEach((l, i) => l.material.color.set(Math.floor(this.t * 8 + i) % 2 ? '#ff3d6e' : '#2b0a12')); this.routerLight.intensity = 3 + Math.sin(this.t * 10) * 2;
      this.antennas.forEach((a, i) => (a.rotation.z = Math.sin(this.t * 3 + i) * 0.15));
      if (e.ringT <= 0) { e.ringT = e.hp < e.max / 2 ? 1.6 : 2.2; const dirs = []; for (let i = 0; i < 9; i++) dirs.push(e.spin + (i / 9) * Math.PI); this.fireRing(new V3(0, 1.0, 7.7), dirs); }
      if (e.sumT <= 0) { e.sumT = 6; if (this.enemies.filter((o) => o.virus && !o.dead).length < 3) { const p = new V3((Math.random() - 0.5) * 6, 0, 6); this.spawnVirus(Math.random() < 0.5 ? 'spam' : 'bug', p); } }
      if (e.hp < e.max / 2 && !e.vacs) { e.vacs = true; this.spawnVacuum(-4, 4); this.spawnVacuum(4, 4); hud.say('הוא הזמין עוד שואבים! 😬', 2.4); }
    }
  }
  fireBolts(from, dir, spread, speed, color) {
    const m0 = new THREE.MeshBasicMaterial({ color }); audio.sfx('bolt');
    for (const da of spread) { const a = Math.atan2(dir.x, dir.z) + da, m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 0), m0); m.position.copy(from); this.scene.add(m); this.bolts.push({ m, v: new V3(Math.sin(a), 0, Math.cos(a)).multiplyScalar(speed), t: 0 }); }
  }
  fireRing(from, angles) { // "חבילות" מהנתב בחצי מעגל קדימה (לעבר החדר)
    const m0 = new THREE.MeshBasicMaterial({ color: '#ff3d6e' }); audio.sfx('bolt');
    for (const a of angles) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.22), m0); m.position.copy(from); this.scene.add(m); this.bolts.push({ m, v: new V3(Math.cos(a), 0, -Math.abs(Math.sin(a))).multiplyScalar(4.2), t: 0 }); }
  }
  throwIce(from, target, side) { // בקשת – נוחת ליד המטרה
    const T = 0.95, tgt = target.clone(); tgt.x += side; const m = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.26, 0.26), new THREE.MeshStandardMaterial({ color: '#bff6ff', transparent: true, opacity: 0.85, roughness: 0.1 }));
    m.position.copy(from); this.scene.add(m); audio.sfx('swing');
    this.bolts.push({ m, v: new V3((tgt.x - from.x) / T, (0.1 - from.y + 0.5 * 9.8 * T * T) / T, (tgt.z - from.z) / T), t: 0, grav: true });
  }
}
