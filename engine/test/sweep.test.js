// Runs about 6,000 buildings, from the smallest to the largest the engine accepts, with and
// without doors and windows, and checks that every answer holds together. The buildings come
// from a fixed seed, so every run tries the same ones.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { design } from '../design.js';
import { priceJob, SAMPLE_CATALOG } from '../pricing.js';

let seed = 12345; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
const pick = (a) => a[Math.floor(rnd() * a.length)], between = (a, b, step = 1) => a + Math.floor(rnd() * ((b - a) / step + 1)) * step;
const fails = new Map(); let okN = 0, threw = 0;
const fail = (what, job) => { const f = fails.get(what) ?? { count: 0, job }; f.count++; fails.set(what, f); };
const scan = (v, path, job) => { if (typeof v === 'number') { if (!Number.isFinite(v)) fail('not a number at ' + path.replace(/\d+/g, 'N'), job); } else if (v && typeof v === 'object') for (const k in v) scan(v[k], path + '.' + k, job); };
const SIZES = { slider: [[8, 16], [8, 14]], overhead: [[8, 16], [7, 14]], walk: [[3, 3], [6.67, 6.67]], window: [[2, 6], [2, 4]] };
function check(job) {
  let r;
  try { r = design(job); } catch (e) { threw++; return fail('crash: ' + e.message, job); }
  if (!r.ok) { if (!r.errors.length) fail('not ok but no error text', job); return; }
  okN++;
  scan({ items: r.items, summary: r.summary, cuts: r.cuts, posts: r.geometry.posts, trusses: r.geometry.trusses, girts: r.geometry.girtRows }, 'r', job);
  for (const i of r.items) if (!(i.qty > 0) || !Number.isInteger(i.qty)) fail(`material line "${i.name}" has quantity ${i.qty}`.replace(/-?\d+(\.\d+)?$/, (q) => (q < 0 ? 'negative' : q == 0 ? 'zero' : 'fractional')), job);
  for (const c of r.cuts) {
    if (!(c.qty > 0) || !Number.isInteger(c.qty)) fail(`cut "${c.part}" bad quantity`, job);
    if (!(c.cutIn > 0)) fail(`cut "${c.part}" has no length`, job);
    if (c.cutIn > c.stockFt * 12 + 0.01) fail(`cut "${c.part}" is longer than its board`, job);
  }
  const b = r.geometry.building, R = r.rules, posts = r.geometry.posts;
  for (const wall of ['front', 'back', 'left', 'right']) {
    const len = wall === 'front' || wall === 'back' ? b.lengthIn : b.widthIn;
    const at = posts.filter((p) => p.wall === wall).map((p) => p.atIn).sort((x, y) => x - y);
    const ops = b.openings.filter((o) => o.wall === wall);
    if (at.some((a) => a < -0.01 || a > len + 0.01)) fail('post outside its wall', job);
    // corners may be listed on the neighboring wall, so only gaps between listed posts and the wall ends are checked
    const marks = [0, ...at, len];
    for (let i = 1; i < marks.length; i++) {
      const a = marks[i - 1], z = marks[i];
      if (z - a > b.postSpacingIn + 0.01 && !ops.some((o) => o.toGround && o.startIn <= a + 6 && o.endIn >= z - 6)) fail('gap between posts wider than the post spacing', job);
    }
    for (const o of ops) if (o.toGround) {
      const wide = o.widthIn >= R.doorJambPostMinFt * 12, warned = r.warnings.some((w) => w.openingIndex === o.index);
      // A post in a narrow door is allowed only with a warning. A wide door never keeps one.
      if (at.some((a) => a > o.startIn + 0.01 && a < o.endIn - 0.01) && (wide || !warned)) fail(`post standing inside a ${o.type} door opening with no warning`, job);
      if (wide) for (const jamb of [o.startIn, o.endIn]) {
        const gap = Math.min(...marks.map((a) => Math.abs(a - jamb)));
        if (gap >= 6) fail(`wide ${o.type} door missing a post at its side`, job);
        else if (gap > 0.01 && !warned) fail(`wide ${o.type} door edge is off its post with no warning`, job);
      }
    }
    for (const o of ops) if (!o.toGround && at.some((a) => a > o.startIn + 0.01 && a < o.endIn - 0.01) && !r.warnings.some((w) => w.openingIndex === o.index)) fail('post behind a window with no warning', job);
  }
  for (const p of posts) {
    if (!R.postStockFt.includes(p.stockFt)) fail('post length is not one a yard stocks', job);
    if (p.stockFt * 12 + 0.01 < p.topIn + R.postEmbedmentIn) fail('post is shorter than the wall plus the depth in the ground', job);
  }
  const tx = r.geometry.trusses.map((t) => t.x).sort((x, y) => x - y);
  if (Math.abs(tx[0]) > 0.01 || Math.abs(tx.at(-1) - b.lengthIn) > 0.01) fail('no truss at an end wall', job);
  for (let i = 1; i < tx.length; i++) if (tx[i] - tx[i - 1] > b.trussSpacingIn + 0.01) fail('gap between trusses wider than the truss spacing', job);
  const sum = (name) => r.items.filter((i) => i.name === name).reduce((s, i) => s + i.qty, 0);
  if (sum('Posts') !== posts.length) fail('post count on the material list differs from posts drawn', job);
  if (r.summary.trusses !== tx.length) fail('truss count in summary differs from trusses drawn', job);
  if (JSON.stringify(design(job)) !== JSON.stringify(r)) fail('same building gave two different answers', job);
  try { const p = priceJob(r, SAMPLE_CATALOG, { markupPct: 20, taxPct: 7, laborPerSqFt: 4 }); if (!(p.total > 0) || !Number.isFinite(p.total)) fail('price total is not a positive number', job); } catch (e) { fail('pricing crash: ' + e.message, job); }
}
const base = () => ({ job: 'sweep', width: between(8, 100, 2), length: between(8, 400, 4), eaveHeight: between(6, 24), pitch: between(1, 12), overhang: pick([0, 12, 18, 24, 36]), postSpacing: pick([4, 6, 8, 10, 12, 16]), trussSpacing: pick([2, 4, 8, 12, 16]), roof: pick(['gable', 'gable', 'mono', 'gambrel']) });
for (let i = 0; i < 2000; i++) check(base());
for (const w of [8, 100]) for (const l of [8, 400]) for (const e of [6, 24]) for (const p of [1, 12]) for (const ps of [4, 16]) for (const ts of [2, 16]) for (const roof of ['gable', 'mono', 'gambrel']) check({ roof, width: w, length: l, eaveHeight: e, pitch: p, overhang: 36, postSpacing: ps, trussSpacing: ts });
for (let i = 0; i < 4000; i++) {
  const j = base(); j.openings = [];
  for (let k = between(1, 5); k > 0; k--) {
    const type = pick(['slider', 'overhead', 'walk', 'window']), wall = pick(['front', 'back', 'left', 'right']), [ws, hs] = SIZES[type];
    const len = wall === 'front' || wall === 'back' ? j.length : j.width, width = between(ws[0], ws[1]);
    const o = { type, wall, width, height: between(hs[0], hs[1]), offset: Math.max(0, between(0, Math.max(0, (len - width) * 2)) / 2) };
    if (type === 'window') o.sill = 3;
    j.openings.push(o);
  }
  check(j);
}
for (const bad of [{}, { width: 'x' }, { width: 30, length: 48, eaveHeight: 12, openings: [{ type: 'walk', wall: 'front', offset: 999, width: 3, height: 6.67 }] }, { width: 30, length: 48, eaveHeight: 12, openings: [{}] }, { width: 30, length: 48, eaveHeight: 12, openings: [{ type: 'slider', wall: 'left', offset: 0, width: 40, height: 30 }] }, { width: NaN, length: Infinity, eaveHeight: -1 }]) check(bad);

test('about 6,000 buildings, small to very large, all hold together', () => {
  assert.equal(threw, 0, 'the engine crashed');
  assert.ok(okN > 900, 'too few buildings were designed for the sweep to mean anything');
  assert.deepEqual([...fails].map(([what, f]) => `${f.count} x ${what}: ${JSON.stringify(f.job)}`), []);
});
