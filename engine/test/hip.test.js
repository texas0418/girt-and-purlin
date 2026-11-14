// A hip roof on the plain 30 x 48 x 12 building, 4 in 12, 12 in overhang.
// Each expected number is worked out by hand from the default rules; the
// working is in the comment beside it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { design, qty } from '../design.js';
import { priceJob, SAMPLE_CATALOG } from '../pricing.js';

const plain = { width: 30, length: 48, eaveHeight: 12, pitch: 4, overhang: 12, postSpacing: 8, trussSpacing: 4 };
const hip = design({ ...plain, roof: 'hip' });
const total = (r, name) => r.items.filter((i) => i.name === name).reduce((n, i) => n + i.qty, 0);

test('hip: designs without errors and prices in full', () => {
  assert.equal(hip.ok, true);
  assert.equal(priceJob(hip, SAMPLE_CATALOG).unpriced, 0);
  // The ridge is the length less the width: 48 - 30 = 18 ft.
  assert.equal(hip.geometry.hip.ridgeIn, 216);
  // Each hip runs 16 ft along, 16 ft across and 64 in up: sqrt(192² + 192² + 64²) = 278.97 in.
  assert.ok(Math.abs(hip.geometry.hip.hipIn - 278.97) < 0.01);
  // The peak is the same as a gable: 144 + 180 x 4/12 = 204 in.
  assert.equal(hip.summary.peakIn, 204);
});

test('hip: full trusses only under the ridge, and a hip set for each end', () => {
  // Truss lines every 4 ft, 13 in all. The ridge runs from 15 ft to 33 ft, so lines at 16, 20, 24, 28 and 32 ft carry full trusses.
  assert.equal(qty(hip, 'Trusses'), 5);
  // The other 8 lines, 4 at each end, belong to the two hip sets.
  assert.equal(qty(hip, 'Hip Truss Sets'), 2);
  assert.equal(hip.items.find((i) => i.name === 'Hip Truss Sets').ft, 120);
  assert.ok(hip.warnings.some((w) => w.code === 'hip-set'));
  assert.ok(hip.warnings.some((w) => w.code === 'hip-cut'));
});

test('hip: no gable ends', () => {
  // Every wall stops at the eave, so all wall panels are 12 ft: (48 + 48 + 30 + 30) x 12 / 36 in = 52.
  assert.equal(qty(hip, 'Wall Panels', '12 ft 0 in'), 52);
  assert.equal(total(hip, 'Wall Panels'), 52);
  assert.equal(total(hip, 'Rake Trim'), 0);
  // Wall area is the perimeter times the eave height: 156 x 12 = 1,872 sq ft.
  assert.equal(hip.summary.wallSqFt, 1872);
  // End walls get a two-board carrier like the side walls. Posts stand 7 ft 6 in apart, so each ply is one 15 ft board and two 7 ft 6 in boards, joints staggered: 5 boards.
  assert.equal(hip.cuts.filter((c) => c.part === 'Truss Carriers' && c.where === 'Left end').reduce((n, c) => n + c.qty, 0), 5);
});

test('hip: roof panels step shorter toward each hip', () => {
  // Slope factor sqrt(12² + 4²) / 12 = 1.05409. Half the roof is 180 + 12 = 192 in, so a full panel is 192 x 1.05409 + 2 = 204.4, ordered at 205 in.
  // Long sides are 600 in, 17 panels each; panels 6 to 12 reach the ridge, 7 a side. Ends are 384 in, 11 panels each; only the middle one reaches full height. 14 + 2 = 16.
  assert.equal(qty(hip, 'Roof Panels', '17 ft 1 in'), 16);
  // The first panel in from a corner has its long edge 36 in in: 36 x 1.05409 + 2 = 39.9, ordered at 40 in. One at each of the four corners.
  assert.equal(qty(hip, 'Roof Panels', '3 ft 4 in'), 4);
  // 17 + 17 + 11 + 11 panels in all.
  assert.equal(total(hip, 'Roof Panels'), 56);
  // Roof area is the plan area times the slope factor: 50 x 32 x 1.05409 = 1,686.5 sq ft.
  assert.ok(Math.abs(hip.summary.roofSqFt - 1686.55) < 0.01);
});

test('hip: trim and closures', () => {
  // Ridge 216 in at 120 in a piece is 2. Each hip 279 in is 3 pieces, 12 for four hips.
  assert.equal(total(hip, 'Ridge Cap'), 2);
  assert.equal(total(hip, 'Hip Cap'), 12);
  // Eave trim on all four sides: 600 / 120 = 5, twice, and 384 / 120 = 3.2 so 4, twice. 18.
  assert.equal(total(hip, 'Eave Trim'), 18);
  // Inside closures along every eave: 600 / 36 = 17 and 384 / 36 = 11, twice each. 56. Outside closures along both sides of the ridge: 216 / 36 = 6, twice.
  assert.equal(total(hip, 'Inside Closures'), 56);
  assert.equal(total(hip, 'Outside Closures'), 12);
});

test('hip: purlin rows run on all four slopes', () => {
  // Slope 192 x 1.05409 = 202.4 in, rows every 24 in: 10 rows. The top row on each end slope has no length, so 10 + 10 + 9 + 9 = 38.
  assert.equal(hip.summary.purlinRowsPerSide, 10);
  assert.equal(hip.summary.purlinRows, 38);
  // The eave row runs the full 50 ft on the sides and 32 ft on the ends.
  const rows = hip.geometry.hip.rows;
  assert.equal(rows.filter((r) => !r.end && r.row === 0)[0].endIn - rows.filter((r) => !r.end && r.row === 0)[0].startIn, 600);
  assert.equal(rows.filter((r) => r.end && r.row === 0)[0].endIn - rows.filter((r) => r.end && r.row === 0)[0].startIn, 384);
});

test('hip: gutters go all the way around', () => {
  const r = design({ ...plain, roof: 'hip', options: { gutters: true, ridgeVent: true, cupolas: true } });
  // 600 / 120 = 5 sections on each side, 384 / 120 = 4 on each end. 18.
  assert.equal(total(r, 'Gutter'), 18);
  assert.equal(total(r, 'Gutter Corners'), 4);
  assert.equal(total(r, 'Gutter End Caps'), 0);
  // The ridge vent follows the 18 ft ridge: 216 / 120 = 2.
  assert.equal(total(r, 'Ridge Vent'), 2);
  // One cupola in the middle of the ridge, 24 ft from the left end.
  assert.equal(r.geometry.cupolas.length, 1);
  assert.equal(r.geometry.cupolas[0].x, 288);
  assert.equal(priceJob(r, SAMPLE_CATALOG).unpriced, 0);
});

test('hip: shingles cap the ridge and the four hips', () => {
  const r = design({ ...plain, roof: 'hip', options: { roofCover: 'shingles' } });
  assert.equal(r.ok, true);
  // Drip edge covers 118 in a piece: 600 / 118 = 6 a side, 384 / 118 = 4 an end, no rakes. 20.
  assert.equal(total(r, 'Drip Edge'), 20);
  // 1,686.5 sq ft / 32 = 53 sheets.
  assert.equal(total(r, 'Roof Sheathing'), 53);
  assert.equal(total(r, 'Hip Cap'), 0);
});

test('hip: needs the length to be at least the width', () => {
  const r = design({ ...plain, roof: 'hip', width: 48, length: 30 });
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.includes('hip roof')));
});

test('hip: a square building comes to a point', () => {
  const r = design({ ...plain, roof: 'hip', length: 30, options: { ridgeVent: true } });
  assert.equal(r.ok, true);
  assert.equal(total(r, 'Ridge Cap'), 0);
  assert.equal(total(r, 'Ridge Vent'), 0);
  assert.ok(r.warnings.some((w) => w.code === 'no-ridge'));
});
