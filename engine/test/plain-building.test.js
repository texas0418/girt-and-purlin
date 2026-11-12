// A plain 30 x 48 x 12 building, 4/12 pitch, 12 in overhang, posts 8 ft,
// trusses 4 ft, no openings. Every expected number below was worked out by
// hand from the default rules; the working is in the comment beside it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { design, qty } from '../design.js';

const plain = { width: 30, length: 48, eaveHeight: 12, pitch: 4, overhang: 12, postSpacing: 8, trussSpacing: 4 };
const r = design(plain);

test('designs without errors or warnings', () => {
  assert.equal(r.ok, true);
  assert.deepEqual(r.warnings, []);
  assert.equal(r.summary.floorSqFt, 1440);
});

test('posts', () => {
  // Long walls: 48 / 8 = 6 bays, 7 posts each = 14. Wall 12 ft + 4 ft in the ground = 16 ft.
  assert.equal(qty(r, 'Posts', '16 ft'), 14);
  // Gable ends: 30 / 8 rounds up to 4 bays of 7 ft 6 in, 3 posts each between the corners.
  // At 7 ft 6 in the roof is 30 in above the eave: 144 + 30 + 48 = 222 in, next stock is 20 ft.
  assert.equal(qty(r, 'Posts', '20 ft'), 4);
  // At the center the roof is 60 in above the eave: 144 + 60 + 48 = 252 in = 21 ft, next stock is 24 ft.
  assert.equal(qty(r, 'Posts', '24 ft'), 2);
  assert.equal(r.summary.posts, 20);
});

test('trusses', () => {
  // 48 / 4 = 12 bays, 13 trusses.
  assert.equal(qty(r, 'Trusses'), 13);
});

test('skirt boards', () => {
  // Long walls 48 ft = three 16s each. Ends 30 ft = one 16 and one 14 each.
  assert.equal(qty(r, 'Skirt Boards', '16 ft'), 8);
  assert.equal(qty(r, 'Skirt Boards', '14 ft'), 2);
});

test('wall girts', () => {
  // (144 - 7.25) / 24 = 5.7, so 6 rows. Each row: eight 16s and two 14s. Six rows: 48 and 12.
  assert.equal(r.summary.girtRowsPerWall, 6);
  // Gable rows at 24 in and 48 in above the eave (rise is 60 in):
  // 30 ft x (1 - 24/60) = 18 ft = one 16 and one 8.  30 ft x (1 - 48/60) = 6 ft = one 8.
  // Two ends: two 16s and four 8s.
  assert.equal(qty(r, 'Wall Girts', '16 ft'), 50);
  assert.equal(qty(r, 'Wall Girts', '14 ft'), 12);
  assert.equal(qty(r, 'Wall Girts', '8 ft'), 4);
});

test('roof purlins', () => {
  // Run 15 ft + 1 ft overhang = 192 in, rise 64 in, slope = 202.39 in.
  // 202.39 / 24 = 8.4, rounds up to 9 spaces, 10 rows a side, 20 rows.
  // Each row is 48 + 2 = 50 ft: three 16s and one 8.
  assert.equal(r.summary.purlinRowsPerSide, 10);
  assert.equal(qty(r, 'Roof Purlins', '16 ft'), 60);
  assert.equal(qty(r, 'Roof Purlins', '8 ft'), 20);
});

test('roof panels', () => {
  // 600 in / 36 = 16.7, so 17 a side. Slope 202.39 + 2 = 204.39, ordered at 205 in = 17 ft 1 in.
  assert.equal(qty(r, 'Roof Panels', '17 ft 1 in'), 34);
});

test('wall panels', () => {
  // Long walls: 576 / 36 = 16 each, 32 at 12 ft.
  assert.equal(qty(r, 'Wall Panels', '12 ft 0 in'), 32);
  // Ends: 10 panels each. The roof climbs 12 in per 36 in panel, so the taller
  // edges are 13, 14, 15, 16 and 17 ft, twice per end, four of each in all.
  for (const len of ['13 ft 0 in', '14 ft 0 in', '15 ft 0 in', '16 ft 0 in', '17 ft 0 in']) {
    assert.equal(qty(r, 'Wall Panels', len), 4, len);
  }
  assert.equal(qty(r, 'Wall Panels'), 52);
});

test('trim', () => {
  // Each 10 ft 6 in piece covers 10 ft after the lap.
  assert.equal(qty(r, 'Ridge Cap'), 5);    // 50 ft
  assert.equal(qty(r, 'Eave Trim'), 10);   // 50 ft, two sides
  assert.equal(qty(r, 'Rake Trim'), 8);    // 16 ft 10 in slope = 2 pieces, four rakes
  assert.equal(qty(r, 'Corner Trim'), 8);  // 12 ft = 2 pieces, four corners
  assert.equal(qty(r, 'Base Trim'), 16);   // 5 + 5 + 3 + 3
});

test('screws', () => {
  // Roof 2 x 202.39 x 600 / 144 = 1686.5 sq ft. Walls 156 x 12 + 150 gable = 2022 sq ft.
  // Girts and purlins at 24 in take 80 screws per 100 sq ft. 3708.5 x 0.8 = 2967 screws, 12 bags of 250.
  assert.equal(r.summary.screws, 2967);
  assert.equal(qty(r, 'Panel Screws'), 12);
});

test('closures', () => {
  // 3 ft foam strips. 50 ft of eave = 17 strips, two eaves. Same count on each side of the ridge.
  assert.equal(qty(r, 'Inside Closures'), 34);
  assert.equal(qty(r, 'Outside Closures'), 34);
});

test('screws step up when the framing rows are closer', () => {
  // Purlins at 18 in take 100 per 100 sq ft on the roof: 1686.5 + 2022 x 0.8 = 3304.1.
  assert.equal(design(plain, { purlinSpacingIn: 18 }).summary.screws, 3305);
});
