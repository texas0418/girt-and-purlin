// Roof and wall coverings. Every expected number is worked by hand in the comment above it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { design, qty } from '../design.js';
import { priceJob, SAMPLE_CATALOG } from '../pricing.js';

// 24 x 32 ft, 10 ft eave, 6 in 12, 12 in overhangs on all four sides.
// Each slope runs 144 + 12 = 156 in on the flat, 156 x 1.1180 = 174.41 in up the slope, and is 384 + 24 = 408 in long.
// Roof: 2 x 174.41 x 408 / 144 = 988.3 sq ft.
// Walls: 2 x 32 x 10 + 2 x 24 x 10 + two gable ends of 24 x 6 / 2 = 640 + 480 + 144 = 1264 sq ft.
const size = { width: 24, length: 32, eaveHeight: 10, overhang: 12, postSpacing: 8, trussSpacing: 4, pitch: 6 };
const withOpts = (options, more = {}) => design({ ...size, ...more, options });
const lines = (r, name) => r.items.filter((i) => i.name === name);
const names = (r) => new Set(r.items.map((i) => i.name));

test('steel panel is the default for both and changes nothing', () => {
  assert.deepEqual(design(size).items, withOpts({ roofCover: 'steel', wallCover: 'steel' }).items);
});

test('standing seam: 16 in panels, clips on every purlin, no screws or closures on the roof', () => {
  const steel = design(size), r = withOpts({ roofCover: 'standing' });
  // 408 in / 16 in = 25.5, so 26 panels a slope and 52 in all, the same length as the rib panels they replace.
  assert.equal(qty(r, 'Standing Seam Panels'), 52);
  assert.equal(lines(r, 'Standing Seam Panels')[0].length, lines(steel, 'Roof Panels')[0].length);
  assert.equal(qty(r, 'Roof Panels'), 0);
  // One clip where each panel crosses each purlin row: 26 panels x 9 rows x 2 slopes = 468. Two screws a clip.
  assert.equal(r.geometry.planes[0].purlinRows, 9);
  assert.equal(qty(r, 'Panel Clips'), 468);
  assert.equal(qty(r, 'Clip Screws'), 936);
  assert.equal(qty(r, 'Inside Closures') + qty(r, 'Outside Closures'), 0);
  // The screw bags left are the wall's alone, the same count a shingle roof leaves.
  assert.ok(qty(r, 'Panel Screws') < qty(steel, 'Panel Screws'));
  assert.equal(qty(r, 'Panel Screws'), qty(withOpts({ roofCover: 'shingles' }), 'Panel Screws'));
  // 52 panels x 14.75 ft x the sample 5.50 a foot.
  assert.equal(priceJob(r, SAMPLE_CATALOG, {}).lines.find((l) => l.name === 'Standing Seam Panels').cost, 52 * 14.75 * 5.5);
});

test('standing seam is refused under 3 in 12, on the main roof or a lean-to', () => {
  const flat = withOpts({ roofCover: 'standing' }, { pitch: 2 });
  assert.equal(flat.errors.length, 1);
  assert.match(flat.errors[0], /flatter than 3 in 12/);
  const shed = { kind: 'leanto', wall: 'front', depth: 10, length: 32, drop: 1 };
  assert.match(withOpts({ roofCover: 'standing' }, { eaveHeight: 12, sheds: [{ ...shed, pitch: 2 }] }).errors[0], /lean-to is flatter than 3 in 12/);
  // A 3 in 12 lean-to passes. It is 408 in long with its overhangs, so 26 more panels.
  const ok = withOpts({ roofCover: 'standing' }, { eaveHeight: 12, sheds: [{ ...shed, pitch: 3 }] });
  assert.equal(qty(ok, 'Standing Seam Panels'), 52 + 26);
});

test('shingles: sheathing, underlayment, drip edge, starter, bundles, ridge and nails', () => {
  const r = withOpts({ roofCover: 'shingles' });
  // 988.3 sq ft / 32 sq ft a sheet = 30.9, so 31 sheets.
  assert.equal(qty(r, 'Roof Sheathing'), 31);
  // One layer at 6 in 12: 988.3 / 200 sq ft a roll = 4.9, so 5 rolls.
  assert.equal(qty(r, 'Roof Underlayment'), 5);
  // Drip edge in 10 ft pieces lapped 2 in, so each covers 118 in. Two eaves of 408 in take 4 each, four rakes of 174.41 in take 2 each: 16.
  assert.equal(qty(r, 'Drip Edge'), 16);
  // Starter along the eaves and rakes: 2 x 408 + 4 x 174.41 = 1513.6 in = 126.1 ft, over 123 ft a bundle, so 2.
  assert.equal(qty(r, 'Starter Shingles'), 2);
  // 988.3 sq ft plus 10 percent waste = 10.87 squares, 3 bundles a square = 32.6, so 33.
  assert.equal(qty(r, 'Shingles'), 33);
  // The ridge is 34 ft, one 36.5 ft bundle.
  assert.equal(qty(r, 'Ridge Shingles'), 1);
  // 10.87 squares x 320 nails = 3479, rounded up to the hundred.
  assert.equal(qty(r, 'Roofing Nails'), 3500);
  // Nothing made for rib steel stays on the roof.
  for (const gone of ['Roof Panels', 'Ridge Cap', 'Eave Trim', 'Rake Trim', 'Inside Closures', 'Outside Closures']) assert.ok(!names(r).has(gone), gone);
  assert.ok(r.warnings.some((w) => w.code === 'shingle-load'));
});

test('shingles under 4 in 12 get two layers of underlayment, and under 2 in 12 are refused', () => {
  // At 3 in 12 each slope is 156 x 1.0308 = 160.8 in, so the roof is 2 x 160.8 x 408 / 144 = 911.2 sq ft. Doubled, 1822.4 / 200 = 9.1, so 10 rolls.
  assert.equal(qty(withOpts({ roofCover: 'shingles' }, { pitch: 3 }), 'Roof Underlayment'), 10);
  const flat = withOpts({ roofCover: 'shingles' }, { pitch: 1 });
  assert.equal(flat.errors.length, 1);
  assert.match(flat.errors[0], /flatter than 2 in 12/);
});

test('skylight panels are refused on anything but rib steel', () => {
  assert.match(withOpts({ roofCover: 'shingles', skylights: 2 }).errors[0], /Skylight panels only fit rib steel/);
  assert.match(withOpts({ roofCover: 'standing', skylights: 2 }).errors[0], /Skylight panels only fit rib steel/);
});

test('board and batten: sheathing, wrap, corner boards, and a batten for every board', () => {
  const r = withOpts({ wallCover: 'batten' });
  // 1264 sq ft / 32 = 39.5, so 40 sheets. 1264 / 900 sq ft a roll of wrap = 1.4, so 2 rolls.
  assert.equal(qty(r, 'Wall Sheathing'), 40);
  assert.equal(qty(r, 'House Wrap'), 2);
  // Two boards at each of four corners.
  assert.equal(qty(r, 'Corner Boards'), 8);
  // Side walls: 384 in / 11.25 in a board = 34.1, so 35 a wall and 70 at 10 ft.
  // End walls: 288 / 11.25 = 25.6, so 26 a wall and 52 in the longer lengths that reach up the gable.
  assert.equal(qty(r, 'Siding Boards'), 70 + 52);
  assert.equal(lines(r, 'Siding Boards').find((l) => l.length === '10 ft').qty, 70);
  assert.equal(qty(r, 'Battens'), qty(r, 'Siding Boards'));
  for (const gone of ['Wall Panels', 'Corner Trim', 'Base Trim']) assert.ok(!names(r).has(gone), gone);
  // The roof is still rib steel.
  assert.equal(qty(r, 'Roof Panels'), 24);
});

test('lap siding: counted by area with waste, less the big doors', () => {
  const r = withOpts({ wallCover: 'lap' });
  // A 16 ft piece showing 6.84 in covers 9.12 sq ft. 1264 x 1.10 / 9.12 = 152.5, so 153 pieces.
  assert.equal(qty(r, 'Lap Siding'), 153);
  // A nail every 8 in along 16 ft is 25 a piece: 153 x 25 = 3825, rounded up to the hundred.
  assert.equal(qty(r, 'Siding Nails'), 3900);
  // A 10 x 10 ft slider takes 100 sq ft out: 1164 x 1.10 / 9.12 = 140.4, so 141.
  const door = withOpts({ wallCover: 'lap' }, { eaveHeight: 12, openings: [] });
  const slid = withOpts({ wallCover: 'lap' }, { eaveHeight: 12, openings: [{ type: 'slider', wall: 'right', offset: 7, width: 10, height: 10 }] });
  // At a 12 ft eave the walls are 1264 + 2 x 112 = 1488 sq ft: 1488 x 1.10 / 9.12 = 179.5, so 180. Less the door, 1388 x 1.10 / 9.12 = 167.4, so 168.
  assert.equal(qty(door, 'Lap Siding'), 180);
  assert.equal(qty(slid, 'Lap Siding'), 168);
});

test('house wrap is not listed twice when it is already picked as the wall insulation', () => {
  const r = withOpts({ wallCover: 'lap', wallInsulation: 'wrap' });
  assert.equal(lines(r, 'House Wrap').length, 1);
});

test('wood walls drop the wainscot and the eave lights', () => {
  const plain = withOpts({ wallCover: 'batten' });
  const asked = withOpts({ wallCover: 'batten', wainscotIn: 36, eaveLights: 'front' });
  assert.deepEqual(asked.items, plain.items);
  assert.equal(asked.geometry.building.options.wainscotIn, 0);
  assert.equal(asked.geometry.building.options.eaveLights, 'none');
});

test('an enclosed lean-to under wood walls gets its own two corners', () => {
  const shed = { kind: 'leanto', wall: 'front', depth: 10, length: 32, pitch: 3, drop: 1, enclosed: true };
  const r = withOpts({ wallCover: 'lap' }, { eaveHeight: 12, sheds: [shed] });
  assert.equal(qty(r, 'Corner Boards'), 8 + 4);
  assert.ok(!names(r).has('Inside Corner Trim'));
});

test('every covering part has a sample price', () => {
  for (const options of [{ roofCover: 'standing' }, { roofCover: 'shingles' }, { wallCover: 'batten' }, { wallCover: 'lap' }]) {
    const priced = priceJob(withOpts(options), SAMPLE_CATALOG, {});
    assert.deepEqual(priced.lines.filter((l) => !(l.cost > 0)).map((l) => l.name), []);
  }
});
