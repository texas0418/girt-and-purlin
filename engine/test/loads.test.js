// Site figures typed in by the builder. Only frost depth changes the building.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { design, qty } from '../design.js';

const plain = { width: 30, length: 48, eaveHeight: 12, pitch: 4, overhang: 12, postSpacing: 8, trussSpacing: 4 };
const base = design(plain);

test('no figures typed in changes nothing', () => {
  assert.deepEqual(base.geometry.building.loads, { snowPsf: 0, windMph: 0, frostIn: 0, exposure: '' });
  assert.equal(base.rules.postEmbedmentIn, 48);
});

test('frost shallower than the usual 4 ft leaves the posts alone', () => {
  const r = design({ ...plain, loads: { frost: 36, snow: 30, wind: 115 } });
  assert.equal(r.rules.postEmbedmentIn, 48);
  assert.deepEqual(r.items, base.items);
  assert.equal(r.warnings.some((w) => w.code === 'frost-deep'), false);
});

test('deeper frost sends the posts down to it', () => {
  const r = design({ ...plain, loads: { frost: 60 } });
  assert.equal(r.rules.postEmbedmentIn, 60);
  // Side posts were 144 + 48 = 192 in, a 16 ft post. Now 144 + 60 = 204 in, so they move to 18 ft.
  assert.equal(qty(base, 'Posts', '16 ft'), 14);
  assert.equal(qty(r, 'Posts', '16 ft'), 0);
  assert.equal(qty(r, 'Posts', '18 ft'), 14);
  assert.match(r.warnings.find((w) => w.code === 'frost-deep').text, /5 ft 0 in deep/);
});

test('posts on brackets stay out of the ground whatever the frost', () => {
  const r = design({ ...plain, loads: { frost: 60 }, options: { footing: 'bracket' } });
  assert.equal(r.rules.postEmbedmentIn, 0);
});

test('figures out of range are turned away', () => {
  assert.match(design({ ...plain, loads: { frost: 200 } }).errors[0], /Frost depth/);
});
