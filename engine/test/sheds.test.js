// Lean-tos and porches on the plain 30 x 48 x 12 building. Each expected
// number is the difference from the plain building, worked out by hand from
// the default rules; the working is in the comment beside it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { design, qty } from '../design.js';

const plain = { width: 30, length: 48, eaveHeight: 12, pitch: 4, overhang: 12, postSpacing: 8, trussSpacing: 4 };
const base = design(plain);
const added = (r, name, length) => qty(r, name, length) - qty(base, name, length);

// A porch the full length of the back wall: 8 ft deep, 3 in 12, 1 ft below the eave.
const porch = design({ ...plain, sheds: [{ kind: 'porch', wall: 'back', depth: 8, pitch: 3, drop: 1 }] });

test('porch: designs without errors', () => {
  assert.equal(porch.ok, true);
  assert.equal(porch.summary.shedSqFt, 384);
  // High side 144 - 12 = 132 in. Low side 132 - 96 x 3/12 = 108 in.
  assert.equal(porch.geometry.sheds[0].highIn, 132);
  assert.equal(porch.geometry.sheds[0].lowIn, 108);
});

test('porch: posts', () => {
  // 48 / 8 = 6 bays, 7 posts. 108 in + 48 in in the ground = 13 ft, next stock is 14 ft.
  assert.equal(added(porch, 'Posts', '14 ft'), 7);
  assert.equal(porch.summary.posts, base.summary.posts + 7);
});

test('porch: rafters, ledger and beam', () => {
  // Run 96 + 12 overhang = 108 in. Slope 108 x 1.0308 = 111.3 in, cut from 10 ft.
  // One rafter every 4 ft: 12 bays, 13 rafters.
  assert.equal(added(porch, 'Rafters', '10 ft'), 13);
  // Ledger 48 ft, joined on the main posts every 8 ft: three 16 ft boards.
  assert.equal(added(porch, 'Rafter Ledgers', '16 ft'), 3);
  // Beam, two boards thick. First board line: three 16s. Second starts with a half board: 8, 16, 16, 8.
  assert.equal(added(porch, 'Eave Beams', '16 ft'), 5);
  assert.equal(added(porch, 'Eave Beams', '8 ft'), 2);
});

test('porch: purlins', () => {
  // 111.3 / 24 rounds up to 5 spaces, 6 rows. Each row is 50 ft with joints on rafters:
  // 13 ft (from a 14), 16, 16 and 5 ft (from an 8).
  assert.equal(porch.geometry.sheds[0].purlinRows, 6);
  assert.equal(added(porch, 'Roof Purlins', '16 ft'), 12);
  assert.equal(added(porch, 'Roof Purlins', '14 ft'), 6);
  assert.equal(added(porch, 'Roof Purlins', '8 ft'), 6);
});

test('porch: steel', () => {
  // Roof run 48 ft + 2 ft of overhang = 600 in. 600 / 36 rounds up to 17 panels, 111.3 + 2 in = 9 ft 6 in.
  assert.equal(added(porch, 'Roof Panels', '9 ft 6 in'), 17);
  // Trim pieces cover 120 in each: 600 / 120 = 5 along the wall and 5 along the eave. One rake piece each side.
  assert.equal(added(porch, 'Endwall Flashing', '10 ft 6 in'), 5);
  assert.equal(added(porch, 'Eave Trim', '10 ft 6 in'), 5);
  assert.equal(added(porch, 'Rake Trim', '10 ft 6 in'), 2);
  // Closure strips are 3 ft: 600 / 36 rounds up to 17 of each.
  assert.equal(added(porch, 'Inside Closures', '3 ft 0 in'), 17);
  assert.equal(added(porch, 'Outside Closures', '3 ft 0 in'), 17);
  // An open porch adds no wall steel.
  assert.equal(porch.summary.wallSqFt, base.summary.wallSqFt);
});

// An enclosed lean-to the full width of the left end: 12 ft deep, 3 in 12, 1 ft below the eave.
const lean = design({ ...plain, sheds: [{ kind: 'leanto', wall: 'left', depth: 12, pitch: 3, drop: 1, enclosed: true }] });

test('enclosed lean-to: posts', () => {
  assert.equal(lean.ok, true);
  // Low side 132 - 144 x 3/12 = 96 in. Outer wall 30 / 8 rounds up to 4 bays, 5 posts, 96 + 48 = 12 ft.
  assert.equal(added(lean, 'Posts', '12 ft'), 5);
  // Each 12 ft side wall gets one post halfway, where the roof is 114 in up: 114 + 48 = 13 ft 6 in, from a 14.
  assert.equal(added(lean, 'Posts', '14 ft'), 2);
});

test('enclosed lean-to: frame', () => {
  // Run 144 + 12 = 156 in, slope 160.8 in, from a 14. 30 ft / 4 ft rounds up to 8 bays, 9 rafters.
  assert.equal(added(lean, 'Rafters', '14 ft'), 9);
  assert.equal(added(lean, 'Rafter Ledgers', '16 ft'), 2);
  assert.equal(added(lean, 'Eave Beams', '16 ft'), 3);
  assert.equal(added(lean, 'Eave Beams', '8 ft'), 2);
  // Skirt: two 15 ft boards on the outer wall, one 12 ft board on each side.
  assert.equal(added(lean, 'Skirt Boards', '16 ft'), 2);
  assert.equal(added(lean, 'Skirt Boards', '12 ft'), 2);
  // Outer wall, 4 girt rows of 30 ft: two rows of 15 + 15, two staggered rows of 7 ft 6 in, 15, 7 ft 6 in.
  assert.equal(added(lean, 'Wall Girts', '16 ft'), 6);
  // Side walls: three full 12 ft rows each, then one row cut back to the roof at 9 ft 7 in
  // and one at 1 ft 7 in. The 8 ft count is four from the outer wall and two from the sides.
  assert.equal(added(lean, 'Wall Girts', '12 ft'), 6);
  assert.equal(added(lean, 'Wall Girts', '10 ft'), 2);
  assert.equal(added(lean, 'Wall Girts', '8 ft'), 6);
});

test('enclosed lean-to: steel', () => {
  // Roof run 32 ft = 384 in, 384 / 36 rounds up to 11 panels, 160.8 + 2 in rounds up to 13 ft 7 in.
  assert.equal(added(lean, 'Roof Panels', '13 ft 7 in'), 11);
  // Outer wall: 360 / 36 = 10 panels at 8 ft. Each side: 4 panels stepping down 9 in at a time from 11 ft.
  assert.equal(added(lean, 'Wall Panels', '8 ft 0 in'), 10);
  for (const length of ['11 ft 0 in', '10 ft 3 in', '9 ft 6 in', '8 ft 9 in']) assert.equal(added(lean, 'Wall Panels', length), 2);
  // Base trim: 3 pieces on the outer wall, 2 on each side. Two outside corners, 8 ft tall, one piece each.
  // Two inside corners against the main wall, 11 ft tall, two pieces each.
  assert.equal(added(lean, 'Base Trim', '10 ft 6 in'), 7);
  assert.equal(added(lean, 'Corner Trim', '10 ft 6 in'), 2);
  assert.equal(added(lean, 'Inside Corner Trim', '10 ft 6 in'), 4);
  assert.equal(added(lean, 'Endwall Flashing', '10 ft 6 in'), 4);
});

test('the cut list still matches the material list', () => {
  for (const r of [porch, lean]) {
    for (const name of ['Rafters', 'Rafter Ledgers', 'Eave Beams', 'Roof Purlins', 'Wall Girts', 'Skirt Boards']) {
      const counted = r.items.filter((i) => i.name === name).reduce((n, i) => n + i.qty, 0);
      const cut = r.cuts.filter((c) => c.part === name).reduce((n, c) => n + c.qty, 0);
      assert.equal(cut, counted, name);
    }
  }
});

test('sheds that cannot be built are turned away', () => {
  const tryShed = (shed) => design({ ...plain, sheds: [shed] });
  // 132 - 240 x 3/12 = 72 in at the low side, under the 7 ft minimum.
  assert.match(tryShed({ kind: 'leanto', wall: 'back', depth: 20, pitch: 3, drop: 1 }).errors[0], /high at its low side/);
  // The main overhang hangs 12 x 4/12 = 4 in below the eave, plus 6 in of fascia.
  assert.match(tryShed({ kind: 'porch', wall: 'back', depth: 8, pitch: 3, drop: 0 }).errors[0], /at least 10 in below/);
  assert.match(tryShed({ kind: 'porch', wall: 'back', depth: 8, pitch: 3, drop: 1, start: 40, length: 20 }).errors[0], /runs past the end/);
  const two = design({ ...plain, sheds: [
    { kind: 'porch', wall: 'back', depth: 8, drop: 1, start: 0, length: 30 },
    { kind: 'porch', wall: 'back', depth: 8, drop: 1, start: 20, length: 20 }] });
  assert.match(two.errors[0], /overlaps/);
});

test('flat and deep sheds carry a warning', () => {
  const flat = design({ ...plain, sheds: [{ kind: 'porch', wall: 'back', depth: 8, pitch: 2, drop: 1 }] });
  assert.equal(flat.ok, true);
  assert.match(flat.warnings.map((w) => w.text).join(' '), /flatter than 3 in 12/);
  assert.equal(porch.warnings.some((w) => /flatter/.test(w.text)), false);
});
