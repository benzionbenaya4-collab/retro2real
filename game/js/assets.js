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
  const base = url('trailer3_data/');
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
