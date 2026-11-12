// Test fit on the 30 x 48 x 12 building with a 12 x 10 sliding door and a walk door.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { design } from '../design.js';
import { testFit, spare } from '../fit.js';

const plain = { width: 30, length: 48, eaveHeight: 12, pitch: 4, overhang: 12, postSpacing: 8, trussSpacing: 4 };
const doors = [{ type: 'slider', wall: 'front', offset: 18, width: 12, height: 10 }, { type: 'walk', wall: 'front', offset: 5, width: 3, height: 6 + 8 / 12 }];
const g = design({ ...plain, openings: doors }).geometry;
const box = { name: 'Tractor', length: 14, width: 8, height: 9, fromLeft: 4, fromFront: 4 };

test('a box that fits goes through the big door and not the walk door', () => {
  const [t] = testFit(g, [box]);
  assert.equal(t.ok, true);
  assert.equal(t.through.length, 1);
  // 12 ft door less 8 ft wide = 4 ft; 10 ft less 9 ft = 1 ft.
  assert.equal(t.through[0].sideIn, 48);
  assert.equal(t.through[0].topIn, 12);
  assert.equal(spare(t.through[0]), '4 ft to spare side to side and 1 ft overhead');
  assert.deepEqual([t.x0, t.y0, t.x1, t.y1], [48, 48, 216, 144]);
});

test('turning it swaps the two floor sides', () => {
  const [t] = testFit(g, [{ ...box, turned: true }]);
  // 8 ft along the building, 14 ft front to back.
  assert.deepEqual([t.x1 - t.x0, t.y1 - t.y0], [96, 168]);
});

test('too tall, too wide, off the floor', () => {
  const [tall] = testFit(g, [{ ...box, height: 11 }]);
  assert.deepEqual(tall.problems, ['No door is big enough to get it in.']);
  const [high] = testFit(g, [{ ...box, height: 13 }]);
  assert.match(high.problems[0], /taller than the 12 ft 0 in under the trusses/);
  // 40 + 14 = 54 ft, past the 48 ft wall.
  const [out] = testFit(g, [{ ...box, fromLeft: 40 }]);
  assert.equal(out.problems[0], 'It does not sit inside the walls.');
  const [none] = testFit(design(plain).geometry, [box]);
  assert.deepEqual(none.problems, ['There is no door that reaches the ground.']);
});

test('two things cannot share the floor', () => {
  const r = testFit(g, [box, { ...box, name: 'Camper', fromLeft: 10 }]);
  assert.equal(r[0].problems[0], 'It overlaps Camper.');
  assert.equal(r[1].problems[0], 'It overlaps Tractor.');
  // Side by side with the second one starting where the first ends: 4 + 14 = 18 ft.
  assert.equal(testFit(g, [box, { ...box, name: 'Camper', fromLeft: 18 }]).every((t) => t.ok), true);
});

test('interior walls and the loft get in the way', () => {
  const wall = design({ ...plain, openings: doors, partitions: [{ axis: 'across', at: 10, start: 0, length: 30, doors: 1, sheathed: true }] }).geometry;
  // The box runs from 4 to 18 ft; the wall stands at 10 ft.
  assert.equal(testFit(wall, [box])[0].problems[0], 'Interior wall 1 runs through it.');
  assert.equal(testFit(wall, [{ ...box, fromLeft: 10 }])[0].ok, true);
  // A 16 ft wall leaves room for a loft floor 8 ft up.
  const lofted = design({ ...plain, eaveHeight: 16, openings: doors, loft: { end: 'left', depth: 16, height: 8 } }).geometry;
  const [t] = testFit(lofted, [box]);
  assert.match(t.problems[0], /taller than the .* under the loft/);
  // Clear of the loft at 16 ft from the left end.
  assert.equal(testFit(lofted, [{ ...box, fromLeft: 16 }])[0].ok, true);
});

test('an open wall is a way in between its posts', () => {
  const open = design({ ...plain, walls: { front: { open: true } } }).geometry;
  const [t] = testFit(open, [{ ...box, width: 7 }]);
  assert.equal(t.ok, true);
  // Posts 8 ft apart less a 6 in post = 90 in; 90 - 84 = 6 in. 144 - 11.25 beam - 108 = 24.75 in overhead.
  assert.equal(t.through[0].sideIn, 6);
  assert.equal(t.through[0].topIn, 24.75);
  // An 8 ft box will not pass between posts 8 ft on center.
  assert.equal(testFit(open, [box])[0].ok, false);
});
