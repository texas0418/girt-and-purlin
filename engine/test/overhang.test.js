// The roof can run a different distance past the end walls than past the side walls.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { design, qty } from '../design.js';
import { edgeOverhangIn } from '../building.js';

const plain = { width: 30, length: 48, eaveHeight: 12, pitch: 4, overhang: 12, postSpacing: 8, trussSpacing: 4 };
const base = design(plain);

test('with no end figure the ends follow the sides', () => {
  assert.equal(base.geometry.building.endOverhangIn, 12);
  // 576 + 2 x 12 = 600 in of roof.
  assert.equal(base.geometry.purlinRowLengthIn, 600);
});

test('a longer end overhang adds roof along the length only', () => {
  const r = design({ ...plain, endOverhang: 24 });
  assert.equal(r.ok, true);
  // 576 + 2 x 24 = 624 in. At 36 in a panel that is 17.33, so 18 a slope where 600 in took 17.
  assert.equal(r.geometry.purlinRowLengthIn, 624);
  assert.equal(qty(r, 'Roof Panels') - qty(base, 'Roof Panels'), 2);
  // The panels are no longer up the slope: the side overhang has not moved.
  assert.deepEqual(r.geometry.planes.map((p) => p.slopeIn), base.geometry.planes.map((p) => p.slopeIn));
  assert.equal(edgeOverhangIn(r.geometry.building, 'left'), 24);
  assert.equal(edgeOverhangIn(r.geometry.building, 'front'), 12);
});

test('no end overhang stops the roof at the end walls', () => {
  const r = design({ ...plain, endOverhang: 0 });
  assert.equal(r.geometry.purlinRowLengthIn, 576);
  // 576 / 36 = 16 panels a slope.
  assert.equal(qty(r, 'Roof Panels'), 32);
});

test('the end overhang has the same limit as the side one', () => {
  assert.match(design({ ...plain, endOverhang: 48 }).errors[0], /End overhang/);
});
