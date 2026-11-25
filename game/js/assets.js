// טעינת ספרייטים, אריחים ומודלים ארוזים (בלי data: URI)
const BASE = new URL('../../', import.meta.url).href; // projects/retro2real/
export const url = (p) => BASE + p;

export const img = (src) => new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => { console.warn('missing image', src); res(im); }; im.src = src; });
const json = (p) => fetch(p).then((r) => { if (!r.ok) throw new Error(p + ' ' + r.status); return r.json(); });

export const SPR = {}, TILES = {};
export async function loadSprite(era, name) {
  const k = `${era}/${name}`; if (SPR[k]) return SPR[k];
  const j = await json(url(`assets/sprites/${era}/${name}.json`));
  SPR[k] = { j, im: await img(url(`assets/sprites/${era}/${j.image || name + '.png'}`)) };
  return SPR[k];
}
export async function loadTiles(file) {
  if (TILES[file]) return TILES[file];
  const j = await json(url(`assets/sprites/tiles/${file}.json`));
  TILES[file] = { j, im: await img(url('assets/sprites/tiles/' + j.image)) };
  return TILES[file];
}

/** ציור פריים של ספרייט. (x,y) = רגליים. */
export function drawSpr(ctx, S, anim, t, x, y, alpha = 1, scale = 1) {
  if (!S || !S.im.width) return;
  const a = S.j.anims[anim] || S.j.anims.idle, n = a.frames.length;
  let i = Math.floor(t * a.fps); i = a.loop === false ? Math.min(i, n - 1) : i % n;
  const f = a.frames[i], fw = S.j.frameW, fh = S.j.frameH, c = S.j.columns;
  if (alpha < 1) { ctx.save(); ctx.globalAlpha = alpha; }
  const dw = Math.round(fw * scale), dh = Math.round(fh * scale);
  ctx.drawImage(S.im, (f % c) * fw, Math.floor(f / c) * fh, fw, fh, Math.round(x - dw / 2), Math.round(y - dh), dw, dh);
  if (alpha < 1) ctx.restore();
}

// GLB ארוז כ-JSON (גיאומטריה base64 + טקסטורות חיצוניות) – נבנה מחדש בזיכרון, כמו בטריילר 3
const packed = new Map();
export function loadPacked(loader, path) {
  if (packed.has(path)) return packed.get(path);
  const base = url('models/');
  const p = json(url(path)).then(({ gltf, bin }) => {
    const bs = atob(bin), body = new Uint8Array(bs.length); for (let i = 0; i < bs.length; i++) body[i] = bs.charCodeAt(i);
    gltf.buffers[0].byteLength = body.length;
    const js = new TextEncoder().encode(JSON.stringify(gltf)), jl = (js.length + 3) & ~3, bl = (body.length + 3) & ~3;
    const ab = new ArrayBuffer(28 + jl + bl), dv = new DataView(ab), u = new Uint8Array(ab);
    dv.setUint32(0, 0x46546C67, true); dv.setUint32(4, 2, true); dv.setUint32(8, ab.byteLength, true);
    dv.setUint32(12, jl, true); dv.setUint32(16, 0x4E4F534A, true); u.set(js, 20); for (let i = 20 + js.length; i < 20 + jl; i++) u[i] = 0x20;
    dv.setUint32(20 + jl, bl, true); dv.setUint32(24 + jl, 0x004E4942, true); u.set(body, 28 + jl);
    return new Promise((res, rej) => loader.parse(ab, base, res, rej));
  });
  packed.set(path, p);
  return p;
}

/** פיקסי 1.0: נגזר מהספרייט של פיקסי – חום עמום, סדקים ופיקסלים חסרים. נרשם כ-`${era}/pixi1`. */
export function makeWornPixi(era = '16bit') {
  const S = SPR[`${era}/pixi`]; if (!S || !S.im.width) return null;
  const c = document.createElement('canvas'); c.width = S.im.width; c.height = S.im.height;
  const x = c.getContext('2d'); x.drawImage(S.im, 0, 0);
  const id = x.getImageData(0, 0, c.width, c.height), d = id.data, fw = S.j.frameW, fh = S.j.frameH;
  const PAL = [[40, 28, 20], [74, 54, 38], [112, 86, 60], [150, 124, 92]];
  const h = (a, b) => { const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return v - Math.floor(v); };
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 10) continue;
    const px = (i / 4) % c.width, py = Math.floor(i / 4 / c.width), lx = px % fw, ly = py % fh;
    if (h(lx, ly) < 0.09) { d[i + 3] = 0; continue; } // פיקסלים חסרים (אותו נזק בכל פריים)
    const lum = (d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11) / 255, k = Math.min(3, Math.floor(lum * 4));
    const p = PAL[k], dim = 0.85 + h(lx + 9, ly) * 0.2;
    d[i] = p[0] * dim; d[i + 1] = p[1] * dim; d[i + 2] = p[2] * dim;
  }
  // סדקים: קווים כהים קבועים בכל פריים
  const cracks = [[0.3, 0.2, 0.55, 0.5], [0.55, 0.5, 0.45, 0.75], [0.7, 0.3, 0.8, 0.55]];
  for (let fy = 0; fy < c.height; fy += fh) for (let fx = 0; fx < c.width; fx += fw) for (const [a, b, e, f] of cracks) {
    const n = 12; for (let k = 0; k <= n; k++) { const X = Math.round(fx + (a + (e - a) * k / n) * fw), Y = Math.round(fy + (b + (f - b) * k / n) * fh), j = (Y * c.width + X) * 4; if (d[j + 3] > 10) { d[j] = 20; d[j + 1] = 12; d[j + 2] = 8; } }
  }
  x.putImageData(id, 0, 0);
  SPR[`${era}/pixi1`] = { j: S.j, im: c };
  return SPR[`${era}/pixi1`];
}
