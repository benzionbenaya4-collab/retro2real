// עותק מ-projects/strike3d/js/models/glbchar.js (רִיג אוטומטי ל-GLB). לעדכן שם ולהעתיק לכאן.
// דמות מקובץ GLB שזזה עם השלד של core/anim.js (makeRig + Animator).
// איך זה עובד:
// 1. טוענים GLB, מנרמלים לגובה (ברירת מחדל 1.75 מ'), רגליים על y=0, פנים ל-+Z.
// 2. מתאימים שלד למש: מוצאים כתפיים/מרפקים/פרקי ידיים/ברכיים/קרסוליים מתוך הקודקודים (או opts.fit).
// 3. משקלים אוטומטיים: מרחק מכל קודקוד למקטעי העצמות, מעבר רך בין 2 הקרובים.
// 4. בכל פריים מעתיקים את הסיבובים של קבוצות ה-rig לעצמות של ה-SkinnedMesh.
//    כל עצם מוגדרת כך ש--Y שלה לאורך האיבר (כמו ב-rig), לכן הסיבוב המקומי זהה ל-rig, והאורכים נשארים של המש.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { makeRig, Animator, DIM } from './anim.js';

const V = THREE.Vector3;
const DOWN = new V(0, -1, 0);
const BONES = ['hips', 'spine', 'chest', 'neck', 'head',
  'upperArmL', 'foreArmL', 'handL', 'upperArmR', 'foreArmR', 'handR',
  'thighL', 'shinL', 'footL', 'thighR', 'shinR', 'footR'];
const PARENT = { spine: 'hips', chest: 'spine', neck: 'chest', head: 'neck' };
for (const s of ['L', 'R']) Object.assign(PARENT, {
  ['upperArm' + s]: 'chest', ['foreArm' + s]: 'upperArm' + s, ['hand' + s]: 'foreArm' + s,
  ['thigh' + s]: 'hips', ['shin' + s]: 'thigh' + s, ['foot' + s]: 'shin' + s,
});
// עובי בערך של כל מקטע (בגובה 1.75), לנרמול המרחק
const RADIUS = { hips: 0.13, spine: 0.13, chest: 0.13, neck: 0.06, head: 0.1, upperArm: 0.05, foreArm: 0.045, hand: 0.04, thigh: 0.08, shin: 0.055, foot: 0.045 };

const loader = new GLTFLoader();
const cache = new Map();

/**
 * @param {string} url  קובץ GLB
 * @param {object} opts { height=1.75, fit:{ handFrac, elbowFrac, landmarks:{ shoulderL:[x,y,z], ... } }, debug }
 * @returns {Promise<{root, j, anim, meshes, skeleton, fit, setWeapon, sync}>} – תואם ל-buildCharacter
 */
export async function loadGLBCharacter(url, opts = {}) {
  if (!cache.has(url)) cache.set(url, loader.loadAsync(url));
  const gltf = await cache.get(url);
  return buildFromScene(gltf.scene, opts);
}

export function buildFromScene(scene, opts = {}) {
  const height = opts.height ?? 1.75;
  // ---- 1. איסוף רשתות עם טרנספורם אפוי ----
  scene.updateMatrixWorld(true);
  const parts = [];
  scene.traverse((o) => {
    if (!o.isMesh) return;
    const g = o.geometry.clone();
    g.applyMatrix4(o.matrixWorld);
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) g.deleteAttribute(k);
    parts.push({ g, mat: o.material });
  });
  const box = new THREE.Box3();
  parts.forEach((p) => { p.g.computeBoundingBox(); box.union(p.g.boundingBox); });
  const sc = height / (box.max.y - box.min.y);
  const cx = (box.min.x + box.max.x) / 2;
  const norm = new THREE.Matrix4().makeScale(sc, sc, sc).multiply(new THREE.Matrix4().makeTranslation(-cx, -box.min.y, 0));
  parts.forEach((p) => { p.g.applyMatrix4(norm); if (!p.g.attributes.normal) p.g.computeVertexNormals(); });
  // z: מרכז הגו בגובה האגן
  const all = [];
  parts.forEach((p) => { const a = p.g.attributes.position.array; for (let i = 0; i < a.length; i += 3) all.push(a[i], a[i + 1], a[i + 2]); });
  const k = height / 1.75;
  const zc = median(filterPts(all, (x, y) => Math.abs(x) < 0.12 * k && y > 0.85 * k && y < 1.2 * k).map((p) => p[2]));
  if (Number.isFinite(zc) && Math.abs(zc) > 1e-4) {
    parts.forEach((p) => p.g.translate(0, 0, -zc));
    for (let i = 2; i < all.length; i += 3) all[i] -= zc;
  }

  // ---- 2. התאמת שלד ----
  const fit = fitSkeleton(all, k, opts.fit || {});

  // ---- 3. עצמות (תנוחת קשירה) ----
  const bindQ = {};
  const tip = { hips: fit.spine, spine: fit.chest, chest: fit.neck, neck: fit.head, head: fit.top };
  for (const s of ['L', 'R']) Object.assign(tip, {
    ['upperArm' + s]: fit['elbow' + s], ['foreArm' + s]: fit['wrist' + s], ['hand' + s]: fit['fingers' + s],
    ['thigh' + s]: fit['knee' + s], ['shin' + s]: fit['ankle' + s], ['foot' + s]: fit['toe' + s],
  });
  const start = { hips: fit.hips, spine: fit.spine, chest: fit.chest, neck: fit.neck, head: fit.head };
  for (const s of ['L', 'R']) Object.assign(start, {
    ['upperArm' + s]: fit['shoulder' + s], ['foreArm' + s]: fit['elbow' + s], ['hand' + s]: fit['wrist' + s],
    ['thigh' + s]: fit['hip' + s], ['shin' + s]: fit['knee' + s], ['foot' + s]: fit['ankle' + s],
  });
  for (const n of BONES) {
    const limb = /Arm|hand|thigh|shin/.test(n);
    bindQ[n] = limb ? new THREE.Quaternion().setFromUnitVectors(DOWN, tip[n].clone().sub(start[n]).normalize()) : new THREE.Quaternion();
  }
  const bones = {}, bindW = {};
  for (const n of BONES) {
    const b = new THREE.Bone(); b.name = n; bones[n] = b;
    bindW[n] = new THREE.Matrix4().compose(start[n], bindQ[n], new V(1, 1, 1));
  }
  for (const n of BONES) {
    const p = PARENT[n];
    const local = p ? new THREE.Matrix4().copy(bindW[p]).invert().multiply(bindW[n]) : bindW[n].clone();
    local.decompose(bones[n].position, bones[n].quaternion, bones[n].scale);
    if (p) bones[p].add(bones[n]);
  }
  const boneList = BONES.map((n) => bones[n]);
  const inverses = BONES.map((n) => bindW[n].clone().invert());
  const skeleton = new THREE.Skeleton(boneList, inverses);

  // ---- 4. משקלים ----
  const segStart = { ...start, hips: fit.hips.clone().add(new V(0, -0.1 * k, 0)) };
  const segs = BONES.map((n, i) => ({ i, a: segStart[n], b: tip[n], r: RADIUS[n.replace(/[LR]$/, '')] * k, side: /[LR]$/.test(n) ? (n.endsWith('L') ? 1 : -1) : 0, limb: /[LR]$/.test(n), leg: /thigh|shin|foot/.test(n), arm: /Arm|hand/.test(n), name: n.replace(/[LR]$/, '') }));
  const sleeveK = opts.fit?.sleeve === false ? 0 : (opts.fit?.sleeve ?? 2.2);
  const skirtK = opts.fit?.skirt === false ? 0 : (opts.fit?.skirt ?? 1.6); // סף (ביחידות עובי רגל) לזיהוי בגד רחב
  const meshes = [];
  for (const p of parts) {
    const pos = p.g.attributes.position, n = pos.count;
    const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
    const P = new V();
    for (let v = 0; v < n; v++) {
      P.fromBufferAttribute(pos, v);
      let b1 = -1, d1 = Infinity, b2 = -1, d2 = Infinity;
      const gate = 0.03 * k;
      for (const s of segs) {
        if (s.side && s.side * P.x < -gate) continue; // לא נקשר לאיבר של הצד השני
        if (s.leg && Math.abs(P.x) > (P.x > 0 ? fit.armEdgeL : fit.armEdgeR) && P.y > fit.ankleL.y + 0.1 * k) continue; // אצבעות ארוכות ליד הברך – לא לרגל
        if (s.leg && P.y > fit.hips.y) continue; // בגדים מעל האגן (אפוד, מעיל) – לא לרגליים
        const d = segDist(P, s.a, s.b, s.limb ? 2.5 : 1) / s.r; // לפני תחילת איבר → שייך להורה
        if (d < d1) { b2 = b1; d2 = d1; b1 = s.i; d1 = d; } else if (d < d2) { b2 = s.i; d2 = d; }
      }
      // חצאית/גלימה/שובל: מתחת לאגן אבל רחוק מהרגל עצמה → בעיקר עם האגן, קצת עם הירך (בלי קריעה בהליכה)
      if (skirtK && segs[b1].leg && d1 > skirtK && P.y < fit.hips.y && P.y > fit.ankleL.y + 0.08 * k) {
        const thigh = BONES.indexOf(P.x >= 0 ? 'thighL' : 'thighR');
        const f = Math.min(1, (d1 - skirtK) / skirtK + 0.6);
        si[v * 4] = 0; sw[v * 4] = 0.35 + 0.35 * f; si[v * 4 + 1] = thigh; sw[v * 4 + 1] = 1 - sw[v * 4];
        continue;
      }
      // גלימה/שרוול רחב ליד היד: רחוק מהזרוע עצמה → עם החזה (אחרת היד "קורעת" את הגלימה בתנופה)
      if (sleeveK && segs[b1].arm && d1 > sleeveK && segs[b1].name !== 'hand' && Math.abs(P.x) < (P.x > 0 ? fit.armEdgeL : fit.armEdgeR) + 0.06 * k) {
        const chest = BONES.indexOf(P.y > fit.chest.y ? 'chest' : 'spine');
        const f = Math.min(1, (d1 - sleeveK) / sleeveK);
        si[v * 4] = chest; sw[v * 4] = 0.6 + 0.4 * f; si[v * 4 + 1] = b1; sw[v * 4 + 1] = 1 - sw[v * 4];
        continue;
      }
      // מעבר רך: משקל לפי יחס המרחקים (חזקה 4)
      const w1 = 1 / (Math.pow(d1, 4) + 1e-6), w2 = b2 >= 0 ? 1 / (Math.pow(d2, 4) + 1e-6) : 0;
      si[v * 4] = b1; sw[v * 4] = w1 / (w1 + w2);
      si[v * 4 + 1] = Math.max(b2, 0); sw[v * 4 + 1] = w2 / (w1 + w2);
    }
    p.g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
    p.g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
    const m = new THREE.SkinnedMesh(p.g, p.mat);
    m.frustumCulled = false;
    meshes.push(m);
  }

  // ---- 5. rig + סנכרון ----
  const rig = makeRig();
  const { root, j } = rig;
  root.add(bones.hips);
  root.updateMatrixWorld(true);
  for (const m of meshes) { root.add(m); m.bind(skeleton, new THREE.Matrix4()); }
  const hip0 = fit.hips.clone();
  const sync = () => {
    for (const n of BONES) bones[n].quaternion.copy(j[n].quaternion);
    bones.hips.position.set(hip0.x + j.hips.position.x * k, hip0.y + (j.hips.position.y - DIM.hip) * k, hip0.z + j.hips.position.z * k);
    bones.chest.scale.copy(j.chest.scale);
  };
  const anim = new Animator(rig);
  const upd = anim.update.bind(anim);
  anim.update = (dt, o) => { upd(dt, o); sync(); };
  sync();

  if (opts.debug) {
    const dm = new THREE.MeshBasicMaterial({ color: '#ff3355', depthTest: false });
    for (const n of BONES) { const s = new THREE.Mesh(new THREE.SphereGeometry(0.02 * k), dm); s.renderOrder = 9; bones[n].add(s); }
  }

  const out = { root, j, anim, meshes, skeleton, bones, fit, sync, pose: 'glb' };
  out.setWeapon = (model, id) => anim.setWeapon(model, id);
  return out;
}

// ---------- התאמת שלד ----------
function fitSkeleton(all, k, F) {
  const L = F.landmarks || {};
  const at = (name, def) => (L[name] ? new V(...L[name]) : def);
  const zAt = (y, w = 0.12) => {
    const zs = filterPts(all, (x, yy) => Math.abs(x) < w * k && Math.abs(yy - y) < 0.03 * k).map((p) => p[2]);
    return zs.length ? (Math.min(...zs) + Math.max(...zs)) / 2 : 0; // אמצע העובי (גם כשהבגד פתוח מקדימה)
  };
  const fit = {};
  // גו – לפי הפרופורציות של DIM, בין המפשעה לקודקוד (דמויות נמוכות/גבוהות מתאימות את עצמן)
  const topAll = Math.max(...filterPts(all, (x) => Math.abs(x) < 0.12 * k).map((p) => p[1]));
  const crotch = F.crotch === false ? null : (F.crotch ?? findCrotch(all, k, topAll)); // false = לפי DIM (למשל מעיל ארוך בין הרגליים)
  const yH0 = DIM.hip * k;
  // יחס: ב-rig האגן 0.95 והקודקוד ~1.75; המפשעה ~0.05 מתחת לאגן
  const hipY = crotch ? crotch + 0.06 * (topAll - crotch) / 0.8 : yH0;
  const tor = (topAll - hipY) / (1.75 - DIM.hip) / k; // מתיחת הגו
  const yH = hipY, yS = yH + 0.02 * k * tor, yC = yS + DIM.spine * k * tor, yN = yC + DIM.chest * k * tor, yHd = yN + DIM.neck * k * tor;
  fit.legScale = yH / yH0; fit.torsoScale = tor;
  fit.hips = at('hips', new V(0, yH, zAt(yH)));
  fit.spine = at('spine', new V(0, yS, zAt(yS)));
  fit.chest = at('chest', new V(0, yC, zAt(yC)));
  fit.neck = at('neck', new V(0, yN, zAt(yN, 0.06)));
  fit.head = at('head', new V(0, yHd, zAt(yHd, 0.06)));
  const topY = Math.max(...filterPts(all, (x) => Math.abs(x) < 0.1 * k).map((p) => p[1]));
  fit.top = at('top', new V(0, topY - 0.02 * k, fit.head.z));

  for (const [s, sx] of [['L', 1], ['R', -1]]) {
    // רגליים: מרכז הצבר הפנימי בכל גובה
    const legAt = (y) => {
      const sl = filterPts(all, (x, yy) => sx * x > 0.005 * k && Math.abs(yy - y) < 0.025 * k).sort((a, b) => sx * a[0] - sx * b[0]);
      const grp = firstCluster(sl, (p) => sx * p[0], 0.05 * k);
      return grp.length ? new V(mean(grp, 0), y, mean(grp, 2)) : new V(sx * DIM.hipX * k, y, 0);
    };
    const ls = fit.legScale, yHip = yH - 0.04 * k * ls, yKnee = yHip - DIM.thigh * k * ls, yAnk = yKnee - DIM.shin * k * ls;
    const knee = legAt(yKnee), ank = legAt(Math.max(yAnk, 0.06 * k));
    fit['hip' + s] = at('hip' + s, new V(sx * Math.max(DIM.hipX * k, Math.abs(knee.x) * 0.9), yHip, fit.hips.z));
    fit['knee' + s] = at('knee' + s, knee);
    fit['ankle' + s] = at('ankle' + s, ank);
    // בהונות: הנקודה הקדמית ביותר ליד הקרקע
    const feet = filterPts(all, (x, y) => sx * x > 0 && y < 0.08 * k && Math.abs(x - ank.x) < 0.15 * k);
    const zf = feet.length ? Math.max(...feet.map((p) => p[2])) : ank.z + 0.15 * k;
    fit['toe' + s] = at('toe' + s, new V(ank.x, 0.03 * k, Math.max(zf - 0.03 * k, ank.z + 0.05 * k)));

    // ידיים: הכתף לפי DIM, אחר כך שרשרת הקודקודים מחוץ לגו
    const sh = at('shoulder' + s, new V(sx * DIM.shoulderX * k, yC + DIM.shoulderY * k * fit.torsoScale, fit.chest.z));
    fit['shoulder' + s] = sh;
    // רוחב הגו בגובה החזה (הצבר הפנימי)
    let edge = 0;
    for (let y = yC - 0.05 * k; y <= yC + 0.12 * k; y += 0.03 * k) {
      const sl = filterPts(all, (x, yy) => sx * x > 0 && Math.abs(yy - y) < 0.015 * k).sort((a, b) => sx * a[0] - sx * b[0]);
      const grp = firstCluster(sl, (p) => sx * p[0], 0.035 * k);
      if (grp.length) edge = Math.max(edge, sx * grp[grp.length - 1][0]);
    }
    edge = Math.min(Math.max(edge, Math.abs(sh.x)), Math.abs(sh.x) + 0.12 * k);
    fit['armEdge' + s] = edge + 0.01 * k;
    const arm = filterPts(all, (x, y) => sx * x > edge + 0.01 * k && y < sh.y + 0.35 * k && y > Math.max(0.25 * k, fit.hips.y - 0.5 * k));
    let tipP = null;
    if (arm.length > 20) {
      // קצה האצבעות: הנקודה הרחוקה ביותר מהכתף
      // קצה האצבעות: רחוק מהכתף וגם רחוק לצד (מרחק × x), כדי לא לבחור שולי מעיל/אפוד
      let best = -Infinity;
      for (const p of arm) { const d = Math.hypot(p[0] - sh.x, p[1] - sh.y, p[2] - sh.z) * sx * p[0]; if (d > best) { best = d; tipP = p; } }
    }
    const handFrac = F.handFrac ?? 0.22, elbowFrac = F.elbowFrac ?? 0.52;
    if (tipP) {
      const T = new V(...tipP), len = T.distanceTo(sh);
      // קו מרכזי: ממוצע הקודקודים בפרוסות לאורך הכיוון כתף→קצה
      const dir = T.clone().sub(sh).normalize();
      const along = (t) => {
        const c = sh.clone().addScaledVector(dir, t * len);
        const near = arm.filter((p) => Math.abs((p[0] - sh.x) * dir.x + (p[1] - sh.y) * dir.y + (p[2] - sh.z) * dir.z - t * len) < 0.03 * k);
        if (near.length < 4) return c;
        return new V(mean(near, 0), mean(near, 1), mean(near, 2));
      };
      const wT = 1 - handFrac, eT = wT * elbowFrac;
      fit['elbow' + s] = at('elbow' + s, along(eT));
      fit['wrist' + s] = at('wrist' + s, along(wT));
      fit['fingers' + s] = at('fingers' + s, along(1 - handFrac * 0.25));
    } else {
      // ברירת מחדל: יד ישרה למטה כמו ב-rig
      fit['elbow' + s] = at('elbow' + s, sh.clone().add(new V(0, -DIM.upper * k, 0)));
      fit['wrist' + s] = at('wrist' + s, sh.clone().add(new V(0, -(DIM.upper + DIM.fore) * k, 0)));
      fit['fingers' + s] = at('fingers' + s, sh.clone().add(new V(0, -(DIM.upper + DIM.fore + 0.12) * k, 0)));
    }
  }
  return fit;
}

// מפשעה: הגובה הנמוך ביותר (מעל הברכיים) שבו אין רווח בין הרגליים ליד x=0
function findCrotch(all, k, top) {
  const step = 0.01 * k;
  // עומק הרגליים: מרכז z בגובה השוקיים. בגדים תלויים (שובלי מעיל) מלפנים/מאחור לא נספרים
  const shins = filterPts(all, (x, y) => y > 0.12 * top && y < 0.25 * top && Math.abs(x) < 0.25 * k).map((p) => p[2]);
  if (!shins.length) return null;
  const zl = (Math.min(...shins) + Math.max(...shins)) / 2, zr = (Math.max(...shins) - Math.min(...shins)) / 2 + 0.01 * k;
  for (let y = 0.15 * top; y < 0.75 * top; y += step) {
    const sl = filterPts(all, (x, yy, z) => Math.abs(yy - y) < step && Math.abs(x) < 0.2 * k && Math.abs(z - zl) < zr);
    if (sl.length < 6) continue;
    const mid = sl.filter((p) => Math.abs(p[0]) < 0.012 * k).length;
    if (mid >= 2) return y;
  }
  return null;
}

// ---------- עזר ----------
function filterPts(all, fn) {
  const out = [];
  for (let i = 0; i < all.length; i += 3) if (fn(all[i], all[i + 1], all[i + 2])) out.push([all[i], all[i + 1], all[i + 2]]);
  return out;
}
function firstCluster(sorted, key, gap) {
  const out = [];
  for (let i = 0; i < sorted.length; i++) { if (i && key(sorted[i]) - key(sorted[i - 1]) > gap) break; out.push(sorted[i]); }
  return out;
}
const mean = (pts, c) => pts.reduce((s, p) => s + p[c], 0) / pts.length;
function median(a) { if (!a.length) return NaN; const s = [...a].sort((x, y) => x - y); return s[s.length >> 1]; }
const _ab = new V(), _ap = new V();
function segDist(p, a, b, behind = 1) {
  _ab.subVectors(b, a); _ap.subVectors(p, a);
  const t0 = _ap.dot(_ab) / Math.max(_ab.lengthSq(), 1e-9), t = Math.max(0, Math.min(1, t0));
  return _ap.addScaledVector(_ab, -t).length() * (t0 < 0 ? behind : 1);
}
