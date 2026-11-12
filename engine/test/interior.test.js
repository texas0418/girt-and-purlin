// Interior walls and a loft in the plain 30 x 48 x 12 building. Each expected
// number is worked out by hand from the default rules; the working is in the
// comment beside it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { design, qty } from '../design.js';
import { priceJob, SAMPLE_CATALOG } from '../pricing.js';

const plain = { width: 30, length: 48, eaveHeight: 12, pitch: 4, overhang: 12, postSpacing: 8, trussSpacing: 4 };
const base = design(plain);

// One wall across the building 16 ft from the left end, full width, with one door, sheathed.
const walled = design({ ...plain, partitions: [{ axis: 'across', at: 16, doors: 1, sheathed: true }] });

test('interior wall: plates', () => {
  assert.equal(walled.ok, true);
  // 30 ft of plate: one 16 ft board and one 14 ft board, top and bottom.
  for (const name of ['Partition Bottom Plates', 'Partition Top Plates']) {
    assert.equal(qty(walled, name, '16 ft'), 1);
    assert.equal(qty(walled, name, '14 ft'), 1);
  }
  assert.equal(walled.items.find((i) => i.name === 'Partition Bottom Plates').size, '2x4 treated');
});

test('interior wall: studs', () => {
  // 360 in / 24 in = 15 spaces, 16 studs, plus 2 at the door. 144 in less two plates is 141 in, from a 12 ft board.
  assert.equal(qty(walled, 'Partition Studs', '12 ft'), 18);
  assert.equal(walled.items.find((i) => i.name === 'Partition Studs').size, '2x4');
  assert.equal(walled.cuts.find((c) => c.part === 'Partition Studs').cutIn, 141);
});

test('interior wall: door and sheathing', () => {
  assert.equal(qty(walled, 'Interior Doors'), 1);
  // Rough opening 38 in, header 41 in, from an 8 ft board.
  assert.equal(qty(walled, 'Partition Door Headers', '8 ft'), 1);
  // Two faces of 30 x 12 ft = 720 sq ft. 720 / 32 = 22.5, so 23 sheets.
  assert.equal(qty(walled, 'Partition Sheathing'), 23);
  // The door sits in the middle of the wall: 180 in, 19 in each way.
  assert.deepEqual(walled.geometry.partitions[0].doors, [{ startIn: 161, endIn: 199 }]);
});

test('interior wall: nothing else changes and every line is priced', () => {
  for (const name of ['Posts', 'Wall Girts', 'Roof Purlins', 'Wall Panels']) assert.equal(qty(walled, name), qty(base, name), name);
  assert.equal(priceJob(walled, SAMPLE_CATALOG).unpriced, 0);
});

test('interior wall: tall walls move to 2x6 studs and stop at 20 ft', () => {
  const tall = design({ ...plain, eaveHeight: 16, partitions: [{ axis: 'along', at: 15, start: 0, length: 20 }] });
  assert.equal(tall.items.find((i) => i.name === 'Partition Studs').size, '2x6');
  // 240 / 24 = 10 spaces, 11 studs. 192 - 3 = 189 in, from a 16 ft board.
  assert.equal(qty(tall, 'Partition Studs', '16 ft'), 11);
  // The tallest wall the stocked posts allow is 20 ft, so the limit is tried with a yard that frames only to 14 ft.
  const tooTall = design({ ...plain, eaveHeight: 16, partitions: [{ axis: 'along', at: 15 }] }, { partitionStudByHeightFt: [[14, '2x4']] });
  assert.match(tooTall.errors[0], /up to 14 ft tall/);
});

test('interior walls that cannot be built are turned away', () => {
  const one = (p) => design({ ...plain, partitions: [p] });
  assert.match(one({ axis: 'across', at: 1 }).errors[0], /at least 2 ft inside/);
  assert.match(one({ axis: 'across', at: 16, start: 20, length: 20 }).errors[0], /runs past/);
  assert.match(one({ axis: 'across', at: 16, length: 6, doors: 2 }).errors[0], /too short for 2 doors/);
});

// A loft across the left end: 12 ft deep, floor framing 8 ft up, in a 14 ft wall.
const tall = { ...plain, eaveHeight: 14 };
const lofted = design({ ...tall, loft: { end: 'left', depth: 12, height: 8 } });
const tallBase = design(tall);

test('loft: joists', () => {
  assert.equal(lofted.ok, true);
  // 12 ft is past the 2x8 limit of 11 ft 10 in, so 2x10. 360 / 16 = 22.5, so 23 spaces and 24 joists.
  assert.equal(lofted.geometry.loft.joistSize, '2x10');
  // 144 in less the ledger and one beam board is 141 in, from a 12 ft board.
  assert.equal(qty(lofted, 'Loft Joists', '12 ft'), 24);
  assert.equal(qty(lofted, 'Joist Hangers'), 48);
});

test('loft: ledger, beam and posts', () => {
  // The left end has posts at 0, 7 ft 6 in, 15 ft, 22 ft 6 in and 30 ft. Ledger: two 15 ft boards from 16s.
  assert.equal(qty(lofted, 'Loft Ledgers', '16 ft'), 2);
  // Loft posts every 7 ft 6 in: 5 posts. Beam board one: 15 + 15. Board two starts short: 7 ft 6 in, 15, 7 ft 6 in.
  assert.equal(qty(lofted, 'Loft Beams', '16 ft'), 3);
  assert.equal(qty(lofted, 'Loft Beams', '8 ft'), 2);
  // 96 in up plus 48 in in the ground is a 12 ft post.
  assert.equal(qty(lofted, 'Posts', '12 ft') - qty(tallBase, 'Posts', '12 ft'), 5);
  assert.equal(lofted.summary.posts, tallBase.summary.posts + 5);
});

test('loft: floor and stair', () => {
  // 30 x 12 = 360 sq ft, 360 / 32 = 11.25, so 12 sheets.
  assert.equal(qty(lofted, 'Loft Subfloor'), 12);
  const s = lofted.geometry.loft.stair;
  // Rise 96.75 in. 96.75 / 7.75 = 12.5, so 13 risers and 12 treads. Run 120 in.
  assert.equal(s.risers, 13);
  assert.equal(s.treads, 12);
  assert.equal(s.runIn, 120);
  // Stringer: the long side of 120 by 96.75 is 154.1 in, from a 14 ft board. Three of them.
  assert.equal(qty(lofted, 'Stair Stringers', '14 ft'), 3);
  // Four 36 in treads from each 12 ft board: 3 boards.
  assert.equal(qty(lofted, 'Stair Treads', '12 ft'), 3);
  // Guard: 30 ft less the 3 ft stair, plus 154.1 in down the stair = 478.1 in.
  assert.equal(lofted.items.find((i) => i.name === 'Guard Rail').length, '39 ft 10 in');
});

test('loft: headroom warnings', () => {
  // Above: 168 - 96 - 0.75 = 71.25 in. Below: 96 - 9.25 = 86.75 in, which clears 7 ft.
  const codes = lofted.warnings.map((w) => w.code);
  assert.deepEqual(codes, ['loft-low-above']);
});

test('lofts that cannot be built are turned away', () => {
  const one = (loft, more = {}) => design({ ...tall, ...more, loft });
  assert.match(one({ end: 'left', depth: 18, height: 8 }).errors[0], /past what a 2x12/);
  assert.match(one({ end: 'left', depth: 12, height: 12 }).errors[0], /under the trusses/);
  assert.match(one({ end: 'left', depth: 12, height: 8 }, { openings: [{ type: 'overhead', wall: 'left', offset: 10, width: 10, height: 10 }] }).errors[0], /taller than the underside of the loft/);
  assert.match(one({ end: 'left', depth: 12, height: 8 }, { partitions: [{ axis: 'across', at: 6 }] }).errors[0], /runs under the loft/);
  assert.match(design({ ...tall, length: 24, loft: { end: 'right', depth: 14, height: 8 } }).errors[0], /needs 3 ft to step off/);
});

test('loft and interior walls: the cut list matches the material list and every line is priced', () => {
  const both = design({ ...tall, loft: { end: 'right', depth: 10, height: 8 }, partitions: [{ axis: 'across', at: 12, doors: 1 }] });
  assert.equal(both.ok, true);
  for (const item of both.items.filter((i) => i.group === 'Interior' && /^\d+ ft$/.test(i.length))) {
    const cut = both.cuts.filter((c) => c.part === item.name && c.stockFt === item.ft).reduce((n, c) => n + c.qty, 0);
    assert.equal(cut, item.qty, `${item.name} ${item.length}`);
  }
  for (const c of both.cuts) assert.ok(c.cutIn <= c.stockFt * 12 + 0.01, `${c.part} ${c.where}`);
  assert.equal(priceJob(both, SAMPLE_CATALOG).unpriced, 0);
});
