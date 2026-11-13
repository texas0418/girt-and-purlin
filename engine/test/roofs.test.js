// Single-slope and gambrel roofs on a 24 x 32 x 10 building with a 12 in
// overhang, posts every 8 ft and trusses every 4 ft. Each expected number is
// worked out by hand from the default rules; the working is beside it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { design, qty } from '../design.js';
import { priceJob, SAMPLE_CATALOG } from '../pricing.js';

const size = { width: 24, length: 32, eaveHeight: 10, overhang: 12, postSpacing: 8, trussSpacing: 4 };
const near = (a, b) => assert.ok(Math.abs(a - b) < 0.5, `${a} is not ${b}`);

// Single slope at 3 in 12: low wall 10 ft at the front, high wall 10 ft + 24 ft x 3/12 = 16 ft at the back.
const mono = design({ ...size, roof: 'mono', pitch: 3 });

test('single slope: walls and posts', () => {
  assert.equal(mono.ok, true);
  assert.equal(mono.summary.peakIn, 192);
  // Front: 4 bays, 5 posts, 120 + 48 in the ground = 14 ft. Back: 5 posts, 192 + 48 = 20 ft.
  // Each end has posts 8 ft and 16 ft in, where the roof is 144 and 168 in up: 16 ft and 18 ft posts.
  assert.equal(qty(mono, 'Posts', '14 ft'), 5);
  assert.equal(qty(mono, 'Posts', '20 ft'), 5);
  assert.equal(qty(mono, 'Posts', '16 ft'), 2);
  assert.equal(qty(mono, 'Posts', '18 ft'), 2);
  // Girt rows: (120 - 7.25) / 24 rounds up to 5 on the front, (192 - 7.25) / 24 rounds up to 8 on the back.
  const rows = (wall) => mono.geometry.girtRows.filter((g) => g.wall === wall).length;
  assert.equal(rows('front'), 5);
  assert.equal(rows('back'), 8);
  // Ends: 5 level rows, then rows at 144 and 168 in that start where the roof passes them, 8 ft and 16 ft in.
  assert.deepEqual(mono.geometry.girtRows.filter((g) => g.wall === 'left' && g.lengthIn).map((g) => [g.heightIn, g.startIn, g.lengthIn]), [[144, 96, 192], [168, 192, 96]]);
});

test('single slope: trusses, purlins and steel', () => {
  assert.equal(qty(mono, 'Single Slope Trusses'), 9);
  assert.equal(qty(mono, 'Trusses'), 0);
  // One plane: run 288 + 12 + 12 = 312 in, slope 312 x 1.0308 = 321.6 in. 321.6 / 24 rounds up to 14 spaces, 15 rows.
  assert.equal(mono.summary.purlinRows, 15);
  // Roof run 384 + 24 = 408 in: 408 / 36 rounds up to 12 panels, 321.6 + 2 in rounds up to 27 ft 0 in.
  assert.equal(qty(mono, 'Roof Panels', '27 ft 0 in'), 12);
  assert.equal(qty(mono, 'Roof Panels'), 12);
  // Trim covers 120 in a piece: 4 along each long edge, 3 up each rake, 1 at each low corner and 2 at each high one.
  assert.equal(qty(mono, 'Ridge Cap'), 0);
  assert.equal(qty(mono, 'High Side Eave Trim'), 4);
  assert.equal(qty(mono, 'Eave Trim'), 4);
  assert.equal(qty(mono, 'Rake Trim'), 6);
  assert.equal(qty(mono, 'Corner Trim'), 6);
  // Closures: 408 / 36 rounds up to 12 under the low edge and 12 over the high edge.
  assert.equal(qty(mono, 'Inside Closures'), 12);
  assert.equal(qty(mono, 'Outside Closures'), 12);
  // Walls: 32 ft x (10 + 16) ft on the long walls, and two ends of 24 ft x 13 ft average: 832 + 624 = 1,456 sq ft.
  near(mono.summary.wallSqFt, 1456);
  near(mono.summary.roofSqFt, 321.6 * 408 / 144);
});

test('single slope: gutter on the low edge only, no ridge parts', () => {
  const r = design({ ...size, roof: 'mono', pitch: 3, options: { gutters: true, ridgeVent: true, cupolas: true } });
  // 408 in of eave: 4 gutter sections, where the gable roof has 8.
  assert.equal(qty(r, 'Gutter'), 4);
  assert.equal(qty(r, 'Ridge Vent'), 0);
  assert.equal(qty(r, 'Cupolas'), 0);
  assert.equal(r.warnings.filter((w) => /no ridge/.test(w.text)).length, 2);
});

test('single slope: flat and tall roofs carry a warning', () => {
  assert.match(design({ ...size, roof: 'mono', pitch: 2 }).warnings.map((w) => w.text).join(' '), /flatter than 3 in 12/);
  // 40 ft wide at 4 in 12 rises 13 ft 4 in.
  const tall = design({ ...size, eaveHeight: 8, width: 40, roof: 'mono', pitch: 4, postSpacing: 8 });
  assert.match([...tall.errors, ...tall.warnings.map((w) => w.text)].join(' '), /13 ft 4 in tall|longer than any stocked post/);
});

// Gambrel: break 144 / 3 = 48 in in from each wall and 48 x 24/12 = 96 in up; peak another 96 x 6/12 = 48 in up.
const gambrel = design({ ...size, roof: 'gambrel' });

test('gambrel: shape', () => {
  assert.equal(gambrel.ok, true);
  assert.deepEqual(gambrel.geometry.building.line.map((p) => [p.y, p.h]), [[0, 120], [48, 216], [144, 264], [240, 216], [288, 120]]);
  assert.equal(gambrel.summary.peakIn, 264);
  // End wall posts 8 ft in stand under the upper roof at 216 + 48 x 6/12 = 240 in: 24 ft posts.
  assert.equal(qty(gambrel, 'Posts', '24 ft'), 4);
  assert.equal(qty(gambrel, 'Posts', '14 ft'), 10);
  // End wall rows above the eave, every 24 in: each starts where the roof passes it.
  assert.deepEqual(gambrel.geometry.girtRows.filter((g) => g.wall === 'right' && g.lengthIn).map((g) => [g.heightIn, g.startIn, g.lengthIn]),
    [[144, 12, 264], [168, 24, 240], [192, 36, 216], [216, 48, 192], [240, 96, 96]]);
});

test('gambrel: trusses, purlins and steel', () => {
  assert.equal(qty(gambrel, 'Gambrel Trusses'), 9);
  assert.equal(gambrel.items.find((i) => i.name === 'Gambrel Trusses').size, '24 ft span, 24/12 and 6/12');
  // Four planes, each 107.3 in up the slope (48 by 96 below the break, 96 by 48 above). 107.3 / 24 rounds up to 5 spaces, 6 rows each.
  assert.equal(gambrel.summary.purlinRows, 24);
  // 12 panels a plane, 107.3 + 2 in rounds up to 9 ft 2 in.
  assert.equal(qty(gambrel, 'Roof Panels', '9 ft 2 in'), 48);
  assert.equal(qty(gambrel, 'Ridge Cap'), 4);
  assert.equal(qty(gambrel, 'Gambrel Flashing'), 8);
  assert.equal(qty(gambrel, 'Eave Trim'), 8);
  // One rake piece for each plane at each end.
  assert.equal(qty(gambrel, 'Rake Trim'), 8);
  assert.equal(qty(gambrel, 'Corner Trim'), 4);
  // A row of each closure at both eaves, both breaks and both sides of the ridge: 4 x 12.
  assert.equal(qty(gambrel, 'Inside Closures'), 48);
  assert.equal(qty(gambrel, 'Outside Closures'), 48);
  // Long walls 2 x 32 x 10 = 640 sq ft. Each end: 2 x 4 ft x 14 ft + 2 x 8 ft x 20 ft = 432 sq ft.
  near(gambrel.summary.wallSqFt, 640 + 864);
  near(gambrel.summary.roofSqFt, 4 * 107.33 * 408 / 144);
});

test('cupolas follow the ridge length', () => {
  const on = (length, more = {}) => design({ ...size, pitch: 4, length, options: { cupolas: true }, ...more });
  const one = (r) => r.items.find((i) => i.name === 'Cupolas');
  // 1.5 in of cupola per ft of ridge up to 32 ft, then two at 1 in per ft.
  assert.deepEqual([one(on(16)).qty, one(on(16)).size], [1, '24 in square']);
  assert.deepEqual([one(on(24)).qty, one(on(24)).size], [1, '36 in square']);
  assert.deepEqual([one(on(32)).qty, one(on(32)).size], [1, '48 in square']);
  assert.deepEqual([one(on(48)).qty, one(on(48)).size], [2, '24 in square']);
  assert.deepEqual([one(on(60)).qty, one(on(60)).size], [2, '36 in square']);
  assert.deepEqual([one(on(96)).qty, one(on(96)).size], [2, '48 in square']);
  assert.deepEqual(on(48).geometry.cupolas.map((c) => c.x), [144, 432]);
  // A chosen size is kept; the count still follows the ridge.
  assert.equal(one(on(48, { options: { cupolas: true, cupolaSizeIn: 36 } })).size, '36 in square');
  assert.match(on(32, { pitch: 8 }).warnings.map((w) => w.text).join(' '), /high pitch base/);
  assert.equal(on(32).warnings.length, 0);
});

test('every part of the new roofs has a sample price', () => {
  for (const r of [mono, gambrel, design({ ...size, pitch: 4, options: { cupolas: true } })]) {
    assert.equal(priceJob(r, SAMPLE_CATALOG, {}).unpriced, 0);
  }
});

test('the gable roof is unchanged', () => {
  const r = design({ ...size, pitch: 4 });
  assert.equal(qty(r, 'Trusses'), 9);
  assert.equal(qty(r, 'Ridge Cap'), 4);
  assert.equal(qty(r, 'Eave Trim'), 8);
  assert.equal(qty(r, 'Rake Trim'), 8);
  assert.equal(r.summary.peakIn, 168);
});

// Walls too tall for solid posts. 22 ft wall + 4 ft in the ground = 26 ft, past the 24 ft solid post.
// Side walls 32 ft at 8 ft: 5 posts each, 10 columns at 26 ft. End walls 24 ft at 8 ft: two posts each
// between the corners, 8 ft in, where a 4 in 12 roof has climbed 32 in: 24 ft 8 in + 4 ft = 28 ft 8 in, a 30 ft column.
test('walls past the longest solid post are framed with laminated columns', () => {
  const tall = design({ ...size, eaveHeight: 22, pitch: 4 });
  assert.equal(tall.ok, true);
  assert.equal(qty(tall, 'Posts'), 0);
  assert.equal(qty(tall, 'Laminated Columns', '26 ft'), 10);
  assert.equal(qty(tall, 'Laminated Columns', '30 ft'), 4);
  assert.equal(tall.warnings.filter((w) => w.code === 'laminated-columns').length, 1);
  assert.equal(tall.cuts.some((c) => c.part === 'Posts'), false);
  assert.equal(tall.cuts.filter((c) => c.part === 'Laminated Columns').reduce((s, c) => s + c.qty, 0), 14);
  // 10 x 26 + 4 x 30 = 380 ft at the sample 9.00 a foot.
  const line = priceJob(tall, SAMPLE_CATALOG, {}).lines.filter((l) => l.name === 'Laminated Columns');
  assert.equal(line.reduce((s, l) => s + l.cost, 0), 380 * 9);
  // A 20 ft wall still fits a 24 ft solid post, so nothing changes there.
  const solid = design({ ...size, eaveHeight: 20, pitch: 4 });
  assert.equal(qty(solid, 'Laminated Columns'), 0);
  assert.equal(solid.warnings.some((w) => w.code === 'laminated-columns'), false);
});
