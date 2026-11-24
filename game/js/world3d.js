// עולם 3 (32 ביט) וזירות הבוס בתלת־ממד (32 ביט / מודרני).
// דן low-poly עם רִיג glbchar, מצלמה מאחורי הכתף, רינדור ברזולוציה נמוכה עם NearestFilter (מראה 32 ביט).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { buildFromScene } from './vendor/glbchar.js';
import { loadPacked, url } from './assets.js';
import { audio } from './audio.js';
import { hud } from './hud.js';
import { pixi } from './pixi.js';
import { clamp, rng } from './util.js';

const V3 = THREE.Vector3;
let R = null; // רנדרר יחיד לכל המשחק (הקשר WebGL אחד)
const gltfLoader = new GLTFLoader();
const texLoader = new THREE.TextureLoader();
const pixelTex = (t) => { t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.colorSpace = THREE.SRGBColorSpace; return t; };

function canvasTex(w, h, draw, nearest = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  if (nearest) pixelTex(t); return t;
}

export class World3D {
  constructor(cfg) { this.cfg = cfg; this.is3d = true; }

  async load() {
    const c = this.cfg, retro = c.era === '32';
    const fix = (g) => { g.scene.traverse((o) => { if (!o.isMesh) return; for (const m of [].concat(o.material)) { if (retro) { m.flatShading = true; if (m.map) pixelTex(m.map); } m.needsUpdate = true; } }); return g; };
    const jobs = [loadPacked(gltfLoader, `models/${retro ? '32bit' : 'modern'}_dan.gltf.json`).then(fix)];
    if (c.boss) jobs.push(loadPacked(gltfLoader, `models/${c.boss.model}.gltf.json`).then(fix));
    jobs.push(new Promise((res) => texLoader.load(url('assets/sprites/16bit/pixi_sprite.png'), (t) => res(pixelTex(t)), undefined, () => res(null))));
    const [dan, boss, ptex] = await Promise.all(jobs.length === 3 ? jobs : [jobs[0], Promise.resolve(null), jobs[1]]);
    this.danG = dan; this.bossG = boss; this.pixiTex = ptex;
  }

  // ---------- בניית סצנה ----------
  start() {
    const c = this.cfg, retro = c.era === '32';
    if (!R) {
      R = new THREE.WebGLRenderer({ canvas: document.getElementById('gl'), antialias: false, powerPreference: 'high-performance' });
      R.setPixelRatio(1);
    }
    R.outputColorSpace = THREE.SRGBColorSpace;
    R.toneMapping = retro ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping;
    R.shadowMap.enabled = !retro; R.shadowMap.type = THREE.PCFSoftShadowMap;
    const S = (this.scene = new THREE.Scene());
    S.background = new THREE.Color(c.sky); S.fog = new THREE.Fog(c.sky, c.fog[0], c.fog[1]);
    this.cam = new THREE.PerspectiveCamera(retro ? 62 : 55, 16 / 9, 0.1, 120);
    S.add(new THREE.HemisphereLight(c.hemi?.[0] || '#cfe8ff', c.hemi?.[1] || '#3a2a20', retro ? 1.4 : 1.5));
    const sun = new THREE.DirectionalLight('#fff2d6', retro ? 1.6 : 3.2); sun.position.set(8, 14, 6); S.add(sun);
    if (!retro) { sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16 }); }
    this.sun = sun;
    const Mat = (o) => (retro ? new THREE.MeshLambertMaterial({ flatShading: true, ...o }) : new THREE.MeshStandardMaterial({ roughness: 0.85, ...o }));
    this.Mat = Mat;
    // רצפה
    const B = c.bounds, gcol = c.ground;
    const gtex = canvasTex(retro ? 32 : 256, retro ? 32 : 256, (x, w, h) => {
      const r = rng(7); x.fillStyle = gcol[0]; x.fillRect(0, 0, w, h); const s = w / 2;
      x.fillStyle = gcol[1]; x.fillRect(0, 0, s, s); x.fillRect(s, s, s, s);
      for (let i = 0; i < w * h * 0.05; i++) { x.fillStyle = r() < 0.5 ? gcol[2] : gcol[0]; x.fillRect(Math.floor(r() * w), Math.floor(r() * h), retro ? 1 : 2, retro ? 1 : 2); }
    }, retro);
    gtex.wrapS = gtex.wrapT = THREE.RepeatWrapping; gtex.repeat.set(B, B); if (!retro) gtex.anisotropy = 4;
    const floor = new THREE.Mesh(new THREE.CircleGeometry(B + 14, retro ? 24 : 64), Mat({ map: gtex }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; S.add(floor);
    // גבול: טבעת עמודי גליץ'
    this.solids = []; const r = rng(c.seed || 3);
    const edgeM = new THREE.LineBasicMaterial({ color: '#ff3d6e' }), voidM = new THREE.MeshBasicMaterial({ color: '#05030a' });
    const pillarG = new THREE.BoxGeometry(1, 3, 1), edgeG = new THREE.EdgesGeometry(pillarG);
    this.pillars = [];
    const ring = Math.round(B * 1.6);
    for (let i = 0; i < ring; i++) {
      const a = (i / ring) * Math.PI * 2, p = new THREE.Group();
      p.add(new THREE.Mesh(pillarG, voidM)); p.add(new THREE.LineSegments(edgeG, edgeM));
      const h = 1 + r() * 2.5; p.scale.set(1 + r(), h, 1 + r()); p.position.set(Math.cos(a) * (B + 1.5), h * 1.5 - 0.2, Math.sin(a) * (B + 1.5)); p.rotation.y = r() * 3;
      S.add(p); this.pillars.push(p);
    }
    // עצים וסלעים
    const treeTop = Mat({ color: c.tree || '#3f8f3a' }), trunk = Mat({ color: '#6b4a2b' }), rockM = Mat({ color: '#8a8794' });
    const nTrees = c.mode === 'arena' ? 4 : Math.round(B * 1.5);
    for (let i = 0; i < nTrees; i++) {
      let x, z; for (let k = 0; k < 30; k++) { const a = r() * 6.28, d = (c.mode === 'arena' ? 6 : 4) + r() * (B - 5); x = Math.cos(a) * d; z = Math.sin(a) * d; if (Math.hypot(x, z + B * 0.6) > 4) break; }
      const g = new THREE.Group();
      if (r() < 0.75) {
        const t = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 1, 5), trunk); t.position.y = 0.5;
        const top = new THREE.Mesh(new THREE.ConeGeometry(0.9, 2.2, retro ? 5 : 9), treeTop); top.position.y = 2;
        g.add(t, top); this.solids.push({ x, z, r: 0.55 });
      } else { const s = new THREE.Mesh(new THREE.DodecahedronGeometry(0.7, 0), rockM); s.position.y = 0.35; s.scale.y = 0.7; g.add(s); this.solids.push({ x, z, r: 0.75 }); }
      g.position.set(x, 0, z); g.rotation.y = r() * 6; g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); S.add(g);
    }
    // דן
    const D = c.dan;
    this.dan = { hp: D.hp, inv: 0, yaw: 0, pos: new V3(0, 0, -B * 0.6), speed: 0, atkT: 9, atkCd: 0, hitDone: true, kb: new V3() };
    this.danC = buildFromScene(this.danG.scene, { height: 1.75 });
    this.danC.root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    S.add(this.danC.root);
    this.setSword(false);
    // פיקסי
    this.pixiS = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.pixiTex, transparent: true }));
    this.pixiS.scale.set(0.4, 0.4, 1); S.add(this.pixiS); this.pixiS.position.set(0.6, 2, -B * 0.6);
    if (!retro) { this.pixiL = new THREE.PointLight('#6fe3ff', 3, 4); S.add(this.pixiL); }
    // מצב
    this.t = 0; this.enemies = []; this.bolts = []; this.parts = []; this.markers = []; this.result = null; this.endT = 0; this.got = 0;
    this.wave = -1; this.waveOn = false; this.toSpawn = 0; this.spawnT = 0; this.nextWaveT = 2; this.waveKills = 0; this.waveT = 0;
    this.exitOpen = false; this.portal = null; this.boss = null; this.cine = 0; this.swordMul = 1;
    this.shards = [];
    const shardM = new THREE.MeshStandardMaterial({ color: '#7dff9b', emissive: '#2bd46a', emissiveIntensity: 1.2, flatShading: true });
    for (let i = 0; i < (c.shards || 0); i++) {
      const a = (i / c.shards) * Math.PI * 2 + 0.6, d = B * 0.55;
      const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.35, 0), shardM); m.position.set(Math.cos(a) * d, 0.9, Math.sin(a) * d);
      this.solids = this.solids.filter((s) => Math.hypot(s.x - m.position.x, s.z - m.position.z) > 1.6);
      S.add(m); this.shards.push({ m, taken: false });
    }
    // סמנים לסריקה
    this.markTex = canvasTex(16, 16, (x) => { x.fillStyle = '#ff3d6e'; x.beginPath(); x.moveTo(2, 2); x.lineTo(14, 2); x.lineTo(8, 13); x.closePath(); x.fill(); x.fillStyle = '#fff'; x.fillRect(7, 4, 2, 4); });
    this.shardMarkTex = canvasTex(16, 16, (x) => { x.fillStyle = '#7dff9b'; x.beginPath(); x.moveTo(8, 1); x.lineTo(15, 8); x.lineTo(8, 15); x.lineTo(1, 8); x.closePath(); x.fill(); });
    if (c.mode === 'arena') this.startArena();
    pixi.reset(true);
    this.resize(innerWidth, innerHeight);
  }

  setSword(infinite) {
    const g = new THREE.Group();
    if (!infinite) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.06, 0.03), this.Mat({ color: '#d8dde6' })); blade.position.x = 0.5;
      const guard = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.22, 0.06), this.Mat({ color: '#8a6a2a' })); guard.position.x = 0.1;
      const grip = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.05, 0.05), this.Mat({ color: '#4a2f1a' }));
      g.add(blade, guard, grip);
    } else {
      const bm = new THREE.MeshStandardMaterial({ color: '#bff6ff', emissive: '#4fd8ff', emissiveIntensity: 2.2, flatShading: true });
      const blade = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.09, 0.04), bm); blade.position.x = 0.7;
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.2, 4), bm); tip.rotation.z = -Math.PI / 2; tip.position.x = 1.37;
      const guard = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.03, 6, 12), new THREE.MeshStandardMaterial({ color: '#ffcf4a', emissive: '#ffb000', emissiveIntensity: 1.5 })); guard.rotation.y = Math.PI / 2; guard.position.x = 0.1;
      const grip = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.05, 0.05), this.Mat({ color: '#2a1a3a' }));
      const light = new THREE.PointLight('#6fe3ff', 4, 3); light.position.x = 0.8;
      g.add(blade, tip, guard, grip, light); this.swordBlade = bm;
    }
    g.userData.gripPoint = new V3(0, 0, 0);
    this.danC.setWeapon(g, 'knife');
  }

  startArena() {
    const c = this.cfg, B = c.boss;
    const h = buildFromScene(this.bossG.scene, { height: B.height || 2.2, fit: { skirt: 1.1, sleeve: 1.6 } });
    h.root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    h.root.position.set(0, 0, 4); this.scene.add(h.root);
    this.boss = { c: h, hp: B.hp, max: B.hp, inv: 0, pos: h.root.position, yaw: Math.PI, boltT: 2, tpT: 4, sumT: 6 };
    const eye = new THREE.PointLight('#ff3d6e', 3, 5); eye.position.set(0, 2, 0.3); h.root.add(eye);
    if (c.upgrade) { this.cine = 5.2; this.cineStep = 0; }
  }

  resize(iw, ih) {
    if (!R) return;
    const retro = this.cfg.era === '32', short = retro ? this.cfg.low || 200 : Math.min(900, Math.min(iw, ih) * Math.min(2, devicePixelRatio || 1));
    const s = short / Math.min(iw, ih), w = Math.round(iw * s), h = Math.round(ih * s);
    R.setSize(w, h, false); this.cam.aspect = w / h; this.cam.updateProjectionMatrix();
    R.domElement.style.imageRendering = retro ? 'pixelated' : 'auto';
  }

  // ---------- ישויות ----------
  spawnWorm(pos) {
    const c = this.cfg, W = c.worm, g = new THREE.Group(), segs = [];
    const m1 = this.Mat({ color: '#5fbf3a' }), m2 = this.Mat({ color: '#3e8a2a' }), eyeM = new THREE.MeshBasicMaterial({ color: '#ff3d6e' });
    for (let i = 0; i < 6; i++) {
      const s = new THREE.Mesh(new THREE.IcosahedronGeometry(0.32 - i * 0.03, c.era === '32' ? 0 : 1), i % 2 ? m2 : m1);
      s.castShadow = true; s.position.copy(pos); s.position.y = 0.3; this.scene.add(s); segs.push(s);
    }
    for (const sx of [-0.12, 0.12]) { const e = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.05), eyeM); e.position.set(sx, 0.1, 0.27); segs[0].add(e); }
    const e = { segs, pos: segs[0].position, hp: W.hp, inv: 0.6, speed: W.speed * (0.85 + Math.random() * 0.3), t: Math.random() * 5, kb: new V3(), rise: 0.6 };
    this.enemies.push(e); this.burst(pos, '#ff3d6e', 10); return e;
  }
  spawnFromEdge() {
    for (let k = 0; k < 20; k++) {
      const a = Math.random() * 6.28, d = this.cfg.bounds * (0.6 + Math.random() * 0.3), p = new V3(Math.cos(a) * d, 0, Math.sin(a) * d);
      if (p.distanceTo(this.dan.pos) > 6) return this.spawnWorm(p);
    }
    return this.spawnWorm(new V3(0, 0, 0));
  }
  burst(p, color, n = 8, sp = 4) {
    const m = new THREE.MeshBasicMaterial({ color });
    for (let i = 0; i < n; i++) {
      const q = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), m); q.position.copy(p); q.position.y += 0.5;
      this.scene.add(q); this.parts.push({ q, v: new V3((Math.random() - 0.5) * sp, Math.random() * sp, (Math.random() - 0.5) * sp), t: 0 });
    }
  }

  // ---------- עדכון ----------
  update(dt, inp) {
    const c = this.cfg, d = this.dan, B = c.bounds; this.t += dt;
    if (this.result) { this.endT += dt; this.tickParts(dt); this.danC.anim.update(dt, { speed: 0 }); return this.endT > 1.4 ? this.result : null; }
    pixi.update(dt);
    if (this.cine > 0) return this.cinematic(dt);
    if (inp.pixiPressed && pixi.tryScan()) this.showMarkers();
    // דן – שליטת טנק (כמו פעם): ימינה/שמאלה מסובב, למעלה/למטה הולך
    d.inv = Math.max(0, d.inv - dt); d.atkCd = Math.max(0, d.atkCd - dt); d.atkT += dt;
    d.yaw -= inp.x * 2.6 * dt;
    const fwd = new V3(Math.sin(d.yaw), 0, Math.cos(d.yaw));
    const mv = -inp.y * c.dan.speed * (d.atkT < 0.25 ? 0.4 : 1);
    d.pos.addScaledVector(fwd, mv * dt).addScaledVector(d.kb, dt); d.kb.multiplyScalar(Math.exp(-8 * dt));
    this.collide(d.pos, 0.4);
    const L = Math.hypot(d.pos.x, d.pos.z); if (L > B) d.pos.multiplyScalar(B / L);
    this.danC.root.position.copy(d.pos); this.danC.root.rotation.y = d.yaw;
    this.danC.anim.update(dt, { speed: Math.abs(mv) / c.dan.speed * 0.9, yawRate: -inp.x * 2.6 });
    this.danC.root.visible = !(d.inv > 0 && Math.floor(d.inv * 14) % 2);
    // חרב
    if (inp.aPressed && d.atkCd <= 0) { d.atkT = 0; d.atkCd = 0.42; d.hitDone = false; this.danC.anim.trigger('slash'); audio.sfx('swing'); }
    if (!d.hitDone && d.atkT > 0.14) {
      d.hitDone = true; const reach = c.dan.reach * (this.swordMul > 1 ? 1.25 : 1);
      const hit = (p, r = 0.4) => { const v = new V3(p.x - d.pos.x, 0, p.z - d.pos.z), l = v.length(); return l < reach + r && (l < 0.8 || v.normalize().dot(fwd) > 0.25); };
      for (const e of this.enemies) if (e.inv <= 0 && e.rise <= 0 && hit(e.pos)) this.hitWorm(e, fwd);
      if (this.boss && this.boss.hp > 0 && this.boss.inv <= 0 && hit(this.boss.pos, 0.7)) this.hitBoss(fwd);
      if (this.swordMul > 1) this.burst(d.pos.clone().addScaledVector(fwd, 1.4), '#6fe3ff', 6, 3);
    }
    // תולעים
    for (const e of this.enemies) this.updateWorm(e, dt);
    this.enemies = this.enemies.filter((e) => !e.dead);
    if (this.boss) this.updateBoss(dt);
    // ברקי קוד
    for (const b of this.bolts) {
      b.m.position.addScaledVector(b.v, dt); b.t += dt; b.m.rotation.x += dt * 8;
      const chest = d.pos.clone(); chest.y = 1.1;
      if (b.m.position.distanceTo(chest) < 0.6) { b.dead = true; this.hurt(1, b.v); }
      if (b.t > 4) b.dead = true;
      if (b.dead) this.scene.remove(b.m);
    }
    this.bolts = this.bolts.filter((b) => !b.dead);
    // שברי קוד
    for (const s of this.shards) {
      if (s.taken) continue; s.m.rotation.y += dt * 2; s.m.position.y = 0.9 + Math.sin(this.t * 3 + s.m.position.x) * 0.15;
      if (s.m.position.distanceTo(new V3(d.pos.x, 0.9, d.pos.z)) < 1) {
        s.taken = true; this.got++; this.scene.remove(s.m); audio.sfx('shard'); this.burst(s.m.position, '#7dff9b', 14);
        hud.banner(`שבר קוד ${this.got}/${this.shards.length}`, 1.6);
      }
    }
    if (c.mode !== 'arena') this.updateWaves(dt);
    if (this.portal) {
      this.portal.rotation.z += dt * 2; this.portal.children[0].material.opacity = 0.5 + Math.sin(this.t * 6) * 0.2;
      if (this.portal.position.distanceTo(new V3(d.pos.x, 1.3, d.pos.z)) < 1.4) { this.result = 'win'; audio.sfx('warp'); this.flash('#ffffff'); }
    }
    if (d.hp <= 0) { this.result = 'dead'; audio.sfx('kill'); this.flash('#000000'); }
    this.tickParts(dt);
    for (const p of this.pillars) p.children[1].visible = Math.random() > 0.03;
    // סמנים
    if (pixi.scan > 0) for (const mk of this.markers) { if (mk.e && (mk.e.dead || !mk.e.pos)) { mk.s.visible = false; continue; } const p = mk.e ? mk.e.pos : mk.p; mk.s.position.set(p.x, (mk.h || 1.2) + Math.sin(this.t * 6) * 0.1, p.z); }
    else if (this.markers.length) { for (const mk of this.markers) this.scene.remove(mk.s); this.markers = []; }
    hud.hearts(d.hp, c.dan.hp); hud.shards(this.got, this.shards.length);
    if (this.boss && this.boss.hp > 0) hud.bossBar(c.boss.label, this.boss.hp / this.boss.max); else hud.bossBar(null);
    return null;
  }
  collide(p, r) { for (const s of this.solids) { const dx = p.x - s.x, dz = p.z - s.z, l = Math.hypot(dx, dz), m = s.r + r; if (l < m && l > 1e-4) { p.x = s.x + (dx / l) * m; p.z = s.z + (dz / l) * m; } } }
  hurt(n, dir) {
    const d = this.dan; if (d.inv > 0) return; d.hp -= n; d.inv = 1.1; audio.sfx('hurt'); this.flash('#ff3d6e');
    const v = new V3(dir.x, 0, dir.z); if (v.lengthSq() > 0) d.kb.copy(v.normalize().multiplyScalar(6));
  }
  flash(color) { const el = document.getElementById('stage'); el.style.boxShadow = `inset 0 0 0 100vmax ${color}55`; clearTimeout(this._fl); this._fl = setTimeout(() => (el.style.boxShadow = ''), 110); }
  hitWorm(e, fwd) {
    e.hp -= this.cfg.dan.dmg * this.swordMul; e.inv = 0.3; e.kb.copy(fwd).multiplyScalar(7); audio.sfx('hit'); this.burst(e.pos, '#bedc78', 5);
    if (e.hp <= 0) { e.dead = true; this.waveKills++; audio.sfx('kill'); for (const s of e.segs) { this.burst(s.position, '#5fbf3a', 3); this.scene.remove(s); } }
  }
  updateWorm(e, dt) {
    const d = this.dan; e.t += dt; e.inv = Math.max(0, e.inv - dt);
    if (e.rise > 0) { e.rise -= dt; e.segs.forEach((s) => (s.position.y = 0.3 - e.rise)); return; }
    const to = new V3(d.pos.x - e.pos.x, 0, d.pos.z - e.pos.z), L = to.length() || 1; to.divideScalar(L);
    const side = new V3(-to.z, 0, to.x).multiplyScalar(Math.sin(e.t * 4) * 0.6);
    e.pos.addScaledVector(to.add(side).normalize(), e.speed * dt).addScaledVector(e.kb, dt); e.kb.multiplyScalar(Math.exp(-6 * dt));
    this.collide(e.pos, 0.3); e.pos.y = 0.3 + Math.abs(Math.sin(e.t * 8)) * 0.08;
    e.segs[0].lookAt(d.pos.x, 0.3, d.pos.z);
    for (let i = 1; i < e.segs.length; i++) { const a = e.segs[i - 1].position, b = e.segs[i].position, v = b.clone().sub(a); v.y = 0; const l = v.length(); if (l > 0.33) b.copy(a).add(v.multiplyScalar(0.33 / l)); b.y = 0.27 - i * 0.025 + Math.sin(e.t * 8 - i) * 0.05; }
    if (e.segs.some((s) => e.inv <= 0 && Math.hypot(s.position.x - d.pos.x, s.position.z - d.pos.z) < 0.6)) this.hurt(1, new V3(d.pos.x - e.pos.x, 0, d.pos.z - e.pos.z));
    for (const s of e.segs) s.visible = !(e.inv > 0 && Math.floor(e.inv * 20) % 2);
  }
  hitBoss(fwd) {
    const b = this.boss; b.hp -= this.cfg.dan.dmg * this.swordMul; b.inv = 0.35; audio.sfx('hit'); this.burst(b.pos, '#ff3d6e', 10);
    b.pos.addScaledVector(fwd, 1.2);
    if (b.hp <= 0) {
      audio.sfx('kill'); this.burst(b.pos, '#ffffff', 30, 7); this.scene.remove(b.c.root); this.result = 'win'; this.flash('#ffffff');
      for (const e of this.enemies) { e.dead = true; e.segs.forEach((s) => this.scene.remove(s)); }
    }
  }
  updateBoss(dt) {
    const b = this.boss, d = this.dan, B = this.cfg.boss; if (b.hp <= 0) return;
    b.inv = Math.max(0, b.inv - dt); b.boltT -= dt; b.tpT -= dt; b.sumT -= dt;
    const to = new V3(d.pos.x - b.pos.x, 0, d.pos.z - b.pos.z), L = to.length() || 1;
    b.yaw = Math.atan2(to.x, to.z); b.c.root.rotation.y = b.yaw;
    const side = new V3(-to.z / L, 0, to.x / L); b.pos.addScaledVector(side, Math.sin(this.t * 0.8) * 1.2 * dt);
    if (L > 5) b.pos.addScaledVector(to, 0.6 * dt / L * 1.2);
    b.pos.y = 0.15 + Math.sin(this.t * 2) * 0.12;
    b.c.anim.update(dt, { speed: 0.15 });
    b.c.root.visible = !(b.inv > 0 && Math.floor(b.inv * 20) % 2);
    if (b.boltT <= 0) {
      b.boltT = B.boltEvery; audio.sfx('bolt'); b.c.anim.trigger('shoot');
      const bm = new THREE.MeshBasicMaterial({ color: '#ff3d6e' });
      for (const da of B.spread) {
        const a = Math.atan2(to.x, to.z) + da, m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22, 0), bm);
        m.position.set(b.pos.x, 1.3, b.pos.z); this.scene.add(m);
        const target = new V3(Math.sin(a), 0, Math.cos(a)); this.bolts.push({ m, v: target.multiplyScalar(B.boltSpeed).setY(-0.1), t: 0 });
      }
    }
    if (b.tpT <= 0 || (L < 1.6 && b.inv <= 0 && Math.random() < dt)) {
      b.tpT = 3.5 + Math.random() * 1.5; this.burst(b.pos, '#ff3d6e', 14, 5);
      for (let k = 0; k < 20; k++) { const a = Math.random() * 6.28, r = 3 + Math.random() * (this.cfg.bounds - 4), x = Math.cos(a) * r, z = Math.sin(a) * r; if (Math.hypot(x - d.pos.x, z - d.pos.z) > 4.5) { b.pos.x = x; b.pos.z = z; break; } }
      this.burst(b.pos, '#ff3d6e', 14, 5);
    }
    if (b.sumT <= 0) { b.sumT = 7; if (this.enemies.length < 3) { const p = b.pos.clone(); p.x += 1; this.spawnWorm(p); } }
  }
  cinematic(dt) { // רגע השדרוג: לפיקסי יש סוף־סוף מספיק טוקנים
    const before = this.cine; this.cine -= dt; const d = this.dan;
    this.danC.root.position.copy(d.pos); this.danC.anim.update(dt, { speed: 0 });
    const at = (s) => before > s && this.cine <= s;
    if (at(5.1)) { pixi.tokens = pixi.max; hud.say('רגע… בדקתי. יש לי מספיק טוקנים! סוף־סוף! 🤩', 2.8); }
    if (at(2.6)) { hud.say('משדרג את החרב… שורף את כל הטוקנים… עכשיו!', 2.4); audio.sfx('upgrade'); }
    if (this.cine < 2.6) { pixi.tokens = Math.max(0, pixi.max * (this.cine / 2.6)); this.burst(this.pixiS.position, '#6fe3ff', 2, 2); }
    if (at(1.0)) { this.setSword(true); this.swordMul = 3; hud.banner('חרב האינסוף!<small>כוח ×3</small>', 2.4); this.flash('#6fe3ff'); this.burst(d.pos, '#ffcf4a', 30, 6); }
    if (this.cine <= 0) { pixi.out = true; pixi.tokens = 0; }
    this.camFollow(dt); this.tickParts(dt);
    hud.hearts(d.hp, this.cfg.dan.hp); hud.bossBar(this.cfg.boss.label, 1);
    return null;
  }
  updateWaves(dt) {
    const W = this.cfg.waves;
    if (!this.waveOn) {
      this.nextWaveT -= dt; const nxt = W[this.wave + 1];
      if (nxt && this.nextWaveT <= 0 && this.got >= (nxt.need || 0)) {
        this.wave++; this.waveOn = true; this.toSpawn = nxt.n; this.waveN = nxt.n; this.spawnT = 0.4; this.waveKills = 0; this.waveT = 0; this.outed = false;
        audio.sfx('wave'); hud.banner(`גל ${this.wave + 1}<small>תולעים בתלת־ממד!</small>`, 1.8);
      } else if (!nxt && !this.exitOpen && this.got >= this.shards.length) this.openPortal();
      return;
    }
    this.waveT += dt; this.spawnT -= dt;
    if (this.toSpawn > 0 && this.spawnT <= 0) { this.spawnFromEdge(); this.toSpawn--; this.spawnT = 1.1; }
    if (W[this.wave].outage && !this.outed && (this.waveKills >= Math.ceil(this.waveN / 2) || this.waveT > 10)) { this.outed = true; pixi.runOut(); }
    if (this.toSpawn === 0 && this.enemies.length === 0) { this.waveOn = false; this.nextWaveT = 2; if (pixi.out) pixi.refill(); }
  }
  openPortal() {
    this.exitOpen = true; audio.sfx('start');
    const g = new THREE.Group(), ring = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.12, 6, 16), new THREE.MeshBasicMaterial({ color: '#6fe3ff' }));
    const disc = new THREE.Mesh(new THREE.CircleGeometry(1.05, 16), new THREE.MeshBasicMaterial({ color: '#ff3d6e', transparent: true, opacity: 0.6, side: THREE.DoubleSide }));
    g.add(disc, ring); g.position.set(0, 1.3, this.cfg.bounds * 0.6); this.scene.add(g); this.portal = g;
    hud.banner('פורטל נפתח!<small>הוא מוביל אל ההאקר</small>', 2.4);
    setTimeout(() => hud.say('הפורטל פתוח, בצד השני של הזירה. ההאקר מחכה שם… 😬', 3.4), 900);
    this.markers.push(); // (הפורטל זוהר – לא צריך סמן)
  }
  showMarkers() {
    for (const mk of this.markers) this.scene.remove(mk.s); this.markers = [];
    const add = (tex, e, p, h) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true })); s.scale.set(0.5, 0.5, 1); s.renderOrder = 10; this.scene.add(s); this.markers.push({ s, e, p, h }); };
    for (const e of this.enemies) add(this.markTex, e, null, 1.2);
    if (this.boss && this.boss.hp > 0) add(this.markTex, this.boss, null, 2.8);
    for (const s of this.shards) if (!s.taken) add(this.shardMarkTex, null, s.m.position, 1.8);
  }
  tickParts(dt) {
    for (const p of this.parts) { p.t += dt; p.q.position.addScaledVector(p.v, dt); p.v.y -= 9 * dt; p.q.rotation.x += dt * 5; if (p.t > 0.8) { p.dead = true; this.scene.remove(p.q); } }
    this.parts = this.parts.filter((p) => !p.dead);
  }
  camFollow(dt) {
    const d = this.dan, c = this.cam, s = Math.sin(d.yaw), co = Math.cos(d.yaw);
    const nar = c.aspect < 1, D = nar ? 4.8 : 3.7, sh = nar ? -0.3 : -0.8;
    const want = new V3(d.pos.x - s * D + co * sh, nar ? 2.9 : 2.45, d.pos.z - co * D - s * sh);
    if (!this.camInit) { c.position.copy(want); this.camInit = true; }
    c.position.lerp(want, 1 - Math.exp(-8 * dt));
    c.lookAt(d.pos.x + s * 4 + co * -0.4, 1.3, d.pos.z + co * 4 - s * -0.4);
    // פיקסי ליד הכתף
    const pp = new V3(d.pos.x + co * 0.7 - s * 0.3, 2.05 + Math.sin(this.t * 4) * 0.08, d.pos.z - s * 0.7 - co * 0.3);
    this.pixiS.position.lerp(pp, 1 - Math.exp(-6 * dt));
    this.pixiS.material.opacity = pixi.out ? (Math.floor(this.t * 3) % 2 ? 0.35 : 0.65) : 1;
    if (this.pixiL) { this.pixiL.position.copy(this.pixiS.position); this.pixiL.intensity = pixi.out ? 0.3 : 3; }
    if (this.sun.castShadow) { this.sun.position.set(d.pos.x + 8, 14, d.pos.z + 6); this.sun.target.position.copy(d.pos); this.sun.target.updateMatrixWorld(); }
  }
  render() {
    if (!R) return;
    if (!this.result || this.endT < 1.4) this.camFollow(1 / 60);
    R.render(this.scene, this.cam);
  }
  dispose() {
    this.scene?.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    document.getElementById('stage').style.boxShadow = '';
  }
}
