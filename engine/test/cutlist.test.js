import { test } from 'node:test';
import assert from 'node:assert/strict';
import { design } from '../design.js';

const shed = {
  width: 30, length: 48, eaveHeight: 12, pitch: 4, overhang: 12, postSpacing: 8, trussSpacing: 4,
  openings: [
    { type: 'slider', wall: 'front', offset: 18, width: 12, height: 10 },
    { type: 'walk', wall: 'front', offset: 5, width: 3, height: 6 + 8 / 12 },
    { type: 'window', wall: 'back', offset: 34, width: 4, height: 3.5, sill: 3 },
    { type: 'overhead', wall: 'right', offset: 9, width: 10, height: 10 },
  ],
};

test('the cut list uses exactly the boards the material list orders', () => {
  const result = design(shed);
  const lumber = ['Posts', 'Skirt Boards', 'Wall Girts', 'Roof Purlins', 'Headers', 'Opening Blocking'];
  for (const item of result.items.filter((i) => lumber.includes(i.name))) {
    const cut = result.cuts.filter((c) => c.part === item.name && c.stockFt === item.ft).reduce((n, c) => n + c.qty, 0);
    assert.equal(cut, item.qty, `${item.name} ${item.length}`);
  }
});

test('no cut is longer than the stock it comes from', () => {
  for (const c of design(shed).cuts) assert.ok(c.cutIn <= c.stockFt * 12 + 0.01, `${c.part} ${c.where}`);
});

test('a 24 ft plain wall girt row is one full 16 and one 8', () => {
  const result = design({ width: 24, length: 24, eaveHeight: 10, pitch: 4, overhang: 12, postSpacing: 8, trussSpacing: 4, openings: [] });
  const front = result.cuts.filter((c) => c.part === 'Wall Girts' && c.where === 'Front wall');
  assert.deepEqual(front.map((c) => [c.cutIn, c.stockFt, c.qty]), [[192, 16, 5], [96, 8, 5]]);
  const post = result.cuts.find((c) => c.part === 'Posts' && c.where === 'Front wall');
  assert.equal(post.cutIn, 10 * 12 + 48);
});
