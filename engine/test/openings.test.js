import { test } from 'node:test';
import assert from 'node:assert/strict';
import { design, qty } from '../design.js';

const base = { width: 30, length: 48, eaveHeight: 12, pitch: 4, overhang: 12, postSpacing: 8, trussSpacing: 4 };
const withOpenings = (...openings) => design({ ...base, openings });

test('a walk door on a post gives a plain-English warning', () => {
  // Front wall posts sit every 8 ft. A 3 ft door from 6 ft to 9 ft covers the post at 8 ft.
  const r = withOpenings({ type: 'walk', wall: 'front', offset: 6, width: 3, height: 6 + 8 / 12 });
  assert.equal(r.ok, true);
  assert.equal(r.warnings.length, 1);
  assert.equal(r.warnings[0].postAtIn, 96);
  assert.match(r.warnings[0].text, /walk door on the front wall lands on the post at 8 ft 0 in/);
  assert.match(r.warnings[0].text, /Slide it 1 ft 0 in/);
});

test('a walk door between posts gives no warning', () => {
  const r = withOpenings({ type: 'walk', wall: 'front', offset: 10, width: 3, height: 6 + 8 / 12 });
  assert.deepEqual(r.warnings, []);
});

test('a wide sliding door moves posts to its jambs', () => {
  // Right gable posts sit at 7 ft 6 in, 15 ft and 22 ft 6 in. A 12 ft door from 9 to 21 ft
  // removes the 15 ft post and adds one at each jamb, so that wall has 4 posts, not 3.
  const r = withOpenings({ type: 'slider', wall: 'right', offset: 9, width: 12, height: 10 });
  assert.deepEqual(r.warnings, []);
  const right = r.geometry.posts.filter((p) => p.wall === 'right').map((p) => p.atIn);
  assert.deepEqual(right, [90, 108, 252, 270]);
  assert.equal(r.summary.posts, 21);
  // The center 24 ft post is gone from that end; jamb posts at 9 ft need 144 + 36 + 48 = 228 in, a 20 ft post.
  assert.equal(qty(r, 'Posts', '24 ft'), 1);
  assert.equal(qty(r, 'Posts', '20 ft'), 6);
});

test('a door to the ground cuts the skirt board and the girt rows it crosses', () => {
  const plain = design(base);
  const r = withOpenings({ type: 'walk', wall: 'front', offset: 10, width: 3, height: 6 + 8 / 12 });
  // Front skirt becomes 10 ft and 35 ft: one 10, two 16s and one 8, in place of three 16s.
  assert.equal(qty(r, 'Skirt Boards', '16 ft'), qty(plain, 'Skirt Boards', '16 ft') - 1);
  assert.equal(qty(r, 'Skirt Boards', '10 ft'), 1);
  assert.equal(qty(r, 'Skirt Boards', '8 ft'), 1);
  // The door is 80 in tall, so it cuts the girt rows at 31.25, 55.25 and 79.25 in: three rows.
  assert.equal(qty(r, 'Wall Girts', '10 ft'), 3);
});

test('openings show up on the list with headers', () => {
  const r = withOpenings({ type: 'window', wall: 'front', offset: 20, width: 4, height: 3.5, sill: 4 });
  assert.equal(qty(r, 'Window'), 1);
  assert.equal(qty(r, 'Headers', '8 ft'), 2);
});

test('bad input is refused with a reason', () => {
  assert.match(design({ ...base, width: 500 }).errors[0], /Width must be between/);
  assert.match(withOpenings({ type: 'walk', wall: 'left', offset: 29, width: 3, height: 7 }).errors[0], /runs past the end/);
  assert.match(withOpenings({ type: 'overhead', wall: 'front', offset: 4, width: 10, height: 14 }).errors[0], /taller than the wall/);
  const two = withOpenings(
    { type: 'walk', wall: 'front', offset: 10, width: 3, height: 7 },
    { type: 'window', wall: 'front', offset: 12, width: 4, height: 3, sill: 3 });
  assert.match(two.errors[0], /overlaps another opening/);
});
