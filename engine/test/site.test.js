// The site plan arithmetic: a 30 x 48 building on a 150 x 200 ft lot.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { design } from '../design.js';
import { placeOnLot, feet } from '../site.js';

const plain = { width: 30, length: 48, eaveHeight: 12, pitch: 4, overhang: 12, postSpacing: 8, trussSpacing: 4 };
const g = design(plain).geometry;
const lot = { lotWidth: 150, lotDepth: 200, fromLeft: 40, fromFront: 60 };

test('front wall toward the front lot line', () => {
  const p = placeOnLot(g, lot);
  // 48 ft along the street, 30 ft deep.
  assert.deepEqual(p.footprint, [40, 60, 88, 90]);
  // 150 - 88 = 62 to the right line, 200 - 90 = 110 to the back line.
  assert.deepEqual(p.clear, { front: 60, left: 40, right: 62, back: 110 });
  // The middle of the front wall sits on the low edge.
  assert.deepEqual(p.frontWallAt, [64, 60]);
  assert.deepEqual(p.problems, []);
});

test('turned to face a side line, the length runs front to back', () => {
  const p = placeOnLot(g, { ...lot, facing: 'left' });
  // Now 30 ft across and 48 ft deep.
  assert.deepEqual(p.footprint, [40, 60, 70, 108]);
  assert.deepEqual(p.clear, { front: 60, left: 40, right: 80, back: 92 });
  assert.deepEqual(p.frontWallAt, [40, 84]);
  const r = placeOnLot(g, { ...lot, facing: 'right' });
  assert.deepEqual(r.footprint, [40, 60, 70, 108]);
  assert.deepEqual(r.frontWallAt, [70, 84]);
  const k = placeOnLot(g, { ...lot, facing: 'back' });
  assert.deepEqual(k.footprint, [40, 60, 88, 90]);
  assert.deepEqual(k.frontWallAt, [64, 90]);
});

test('lean-tos and porches count toward the footprint', () => {
  const shed = design({ ...plain, sheds: [{ kind: 'leanto', wall: 'back', start: 0, length: 48, depth: 12, pitch: 3, drop: 1, enclosed: false }] }).geometry;
  const p = placeOnLot(shed, lot);
  // 30 + 12 = 42 ft deep.
  assert.deepEqual(p.footprint, [40, 60, 88, 102]);
  assert.equal(p.clear.back, 98);
  // On the front wall the lean-to is what sits at the typed distance, and the wall is 12 ft behind it.
  const f = design({ ...plain, sheds: [{ kind: 'porch', wall: 'front', start: 0, length: 48, depth: 12, pitch: 3, drop: 1, enclosed: false }] }).geometry;
  const q = placeOnLot(f, lot);
  assert.deepEqual(q.footprint, [40, 60, 88, 102]);
  assert.deepEqual(q.frontWallAt, [64, 72]);
  assert.equal(q.parts.length, 2);
});

test('setbacks and lot lines are checked', () => {
  // 40 ft from the left line against a 50 ft side setback; 62 ft on the right is fine.
  const p = placeOnLot(g, { ...lot, setSide: 50, setFront: 60, setBack: 25 });
  assert.equal(p.problems.length, 1);
  assert.match(p.problems[0], /40 ft from the left lot line, inside the 50 ft setback/);
  // 40 + 48 = 88 ft, so an 80 ft lot is 8 ft short.
  const off = placeOnLot(g, { ...lot, lotWidth: 80 });
  assert.match(off.problems[0], /runs 8 ft past the right lot line/);
  assert.equal(placeOnLot(g, {}).ready, false);
});

test('feet read as feet and inches', () => {
  assert.equal(feet(12), '12 ft');
  assert.equal(feet(12.5), '12 ft 6 in');
  assert.equal(feet(7.999), '8 ft');
});
