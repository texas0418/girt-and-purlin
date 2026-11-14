// Stud walls and wings (joined buildings).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { design } from '../design.js';
import { priceJob, SAMPLE_CATALOG } from '../pricing.js';
import { placeOnLot } from '../site.js';
import { dxf } from '../dxf.js';
import { wingPoint } from '../wings.js';

const base = { width: 30, length: 48, eaveHeight: 12, pitch: 4 };
const qty = (r, name) => r.items.filter((i) => i.name === name).reduce((s, i) => s + i.qty, 0);
const wing = (o) => ({ wall: 'front', start: 24, width: 24, out: 20, eaveHeight: 10, pitch: 4, between: 'open', openings: [], ...o });

test('stud walls: plates and studs take the place of posts and girts', () => {
  const r = design({ ...base, framing: 'stud' });
  assert.ok(r.ok, r.errors?.join(' '));
  assert.equal(r.geometry.posts.length, 0);
  assert.equal(qty(r, 'Posts'), 0);
  assert.equal(qty(r, 'Wall Girts'), 0);
  for (const name of ['Bottom Plates', 'Wall Studs', 'Top Plates', 'Wall Sheathing', 'House Wrap']) assert.ok(qty(r, name) > 0, name);
  assert.ok(r.items.find((i) => i.name === 'Bottom Plates').size.includes('treated'));
  // Trusses sit 2 ft apart on a stud wall whatever was asked for.
  assert.equal(r.geometry.building.trussSpacingIn, 24);
  assert.equal(r.summary.trusses, 25);
  assert.ok(r.warnings.some((w) => w.code === 'stud-walls'));
  assert.ok(r.warnings.some((w) => w.code === 'stud-tall'), '12 ft walls are over the code table');
  assert.equal(priceJob(r, SAMPLE_CATALOG).unpriced, 0);
});

test('stud walls: studs on the layout, 16 in apart with one at each end', () => {
  const r = design({ ...base, eaveHeight: 10, framing: 'stud', studSpacing: 16 });
  const wall = r.geometry.studWalls.front;
  // 48 ft at 16 in is 37 studs, and a side wall gets one more at each corner.
  assert.equal(wall.studs.length, 39);
  assert.ok(!r.warnings.some((w) => w.code === 'stud-tall'));
  const wide = design({ ...base, eaveHeight: 10, framing: 'stud', studSpacing: 24 });
  assert.equal(wide.geometry.studWalls.front.studs.length, 27);
});

test('stud walls: every opening gets a header, shorter studs and full studs beside it', () => {
  const r = design({ ...base, eaveHeight: 10, framing: 'stud', openings: [{ type: 'overhead', wall: 'front', offset: 8, width: 10, height: 8 }, { type: 'window', wall: 'back', offset: 6, width: 3, height: 4, sill: 3 }] });
  assert.ok(r.ok, r.errors?.join(' '));
  const front = r.geometry.studWalls.front, back = r.geometry.studWalls.back;
  assert.equal(front.headers.length, 1);
  assert.equal(back.sills.length, 1);
  // The bottom plate stops at the door.
  assert.deepEqual(front.plates, [[0, 96], [216, 576]]);
  assert.ok(!front.studs.some((s) => s.atIn > 96.1 && s.atIn < 215.9), 'no stud stands in the door');
  assert.ok(qty(r, 'Headers') > 0 && qty(r, 'Opening Framing') > 0);
  assert.ok(r.warnings.some((w) => w.code === 'stud-headers'));
});

test('stud walls: turned away when a wall is open or too tall', () => {
  assert.ok(!design({ ...base, framing: 'stud', walls: { front: { open: true } } }).ok);
  assert.ok(!design({ ...base, eaveHeight: 24, framing: 'stud' }).ok);
  assert.ok(!design({ ...base, framing: 'brick' }).ok);
});

test('a wing adds its own floor, posts, trusses and roof to the one list', () => {
  const plain = design(base), r = design({ ...base, wings: [wing()] });
  assert.ok(r.ok, r.errors?.join(' '));
  const w = r.geometry.wings[0];
  assert.equal(w.name, 'Wing 1');
  assert.equal(w.shape, 'L shape');
  assert.equal(r.summary.wingSqFt, 480);
  assert.ok(r.summary.roofSqFt > plain.summary.roofSqFt);
  assert.equal(r.summary.trusses, r.geometry.trusses.length + w.result.geometry.trusses.length);
  assert.equal(qty(r, 'Posts'), r.geometry.posts.length + w.result.geometry.posts.length);
  for (const name of ['Valley Boards', 'Valley Flashing', 'Inside Corner Trim']) assert.ok(qty(r, name) > 0, name);
  assert.ok(r.warnings.some((m) => m.code === 'wing-join'));
  assert.ok(r.cuts.some((c) => c.where.startsWith('Wing 1, ')));
  assert.equal(priceJob(r, SAMPLE_CATALOG).unpriced, 0);
});

test('wing shapes: L at an end of a side wall, T in the middle, in line on an end wall', () => {
  const shape = (o) => design({ ...base, wings: [wing(o)] }).geometry.wings[0].shape;
  assert.equal(shape({ start: 0 }), 'L shape');
  assert.equal(shape({ start: 12 }), 'T shape');
  assert.equal(shape({ wall: 'right', start: 5, width: 20, out: 16 }), 'In line');
});

test('between the two: open through leaves the wall out, a door or a solid wall keeps it', () => {
  const open = design({ ...base, wings: [wing()] }), door = design({ ...base, wings: [wing({ between: 'door' })] }), solid = design({ ...base, wings: [wing({ between: 'solid' })] });
  const into = (r) => r.geometry.building.openings.filter((o) => o.wing === 0);
  assert.equal(into(open)[0].type, 'wing');
  assert.equal(into(open)[0].widthIn, 288);
  assert.equal(into(door)[0].type, 'walk');
  assert.equal(into(solid).length, 0);
  assert.equal(qty(door, 'Walk Door'), qty(solid, 'Walk Door') + 1);
  // The opening into a wing is never a door to buy.
  assert.equal(qty(open, 'Walk Door'), qty(solid, 'Walk Door'));
});

test('a wing has doors and windows on its own three walls', () => {
  const r = design({ ...base, wings: [wing({ openings: [{ type: 'overhead', wall: 'end', offset: 7, width: 10, height: 8 }, { type: 'window', wall: 'left', offset: 8, width: 3, height: 4 }] })] });
  assert.ok(r.ok, r.errors?.join(' '));
  const ops = r.geometry.wings[0].result.geometry.building.openings;
  assert.deepEqual(ops.map((o) => o.wall), ['right', 'front']);
  assert.equal(qty(r, 'Overhead Door'), 1);
  const bad = design({ ...base, wings: [wing({ openings: [{ type: 'overhead', wall: 'end', offset: 20, width: 10, height: 8 }] })] });
  assert.ok(!bad.ok);
  assert.match(bad.errors[0], /^Wing 1: .*front wall/);
});

test('wings that cannot be built are turned away', () => {
  const errs = (o, more = {}) => { const r = design({ ...base, ...more, wings: [wing(o)] }); assert.ok(!r.ok); return r.errors.join(' '); };
  assert.match(errs({ pitch: 12, eaveHeight: 12 }), /higher than the main roof/);
  assert.match(errs({}, { roof: 'gambrel' }), /gambrel/);
  assert.match(errs({ start: 40 }), /Wing 1/);
  assert.match(errs({ eaveHeight: 14 }), /Wing 1/);
  assert.match(errs({}, { openings: [{ type: 'walk', wall: 'front', offset: 30, width: 3, height: 6.67 }] }), /where Wing 1 joins/);
  assert.match(errs({}, { walls: { front: { open: true } } }), /open wall/);
  const two = design({ ...base, wings: [wing(), wing({ start: 30, width: 12 })] });
  assert.match(two.errors.join(' '), /overlaps another wing/);
});

test('a wing the same size as the end it joins carries the roof on with no joint', () => {
  const r = design({ ...base, wings: [wing({ wall: 'right', start: 0, width: 30, out: 16, eaveHeight: 12 })] });
  assert.ok(r.ok, r.errors?.join(' '));
  assert.equal(r.geometry.wings[0].valley, null);
  assert.equal(qty(r, 'Valley Flashing'), 0);
  assert.equal(qty(r, 'Sidewall Flashing'), 0);
});

test('wings on other roofs and on stud walls', () => {
  for (const job of [
    { ...base, roof: 'hip', wings: [wing()] },
    { ...base, roof: 'mono', pitch: 2, wings: [wing({ wall: 'back', eaveHeight: 8 })] },
    { ...base, roof: 'gambrel', wings: [wing({ wall: 'right', start: 5, width: 20 })] },
    { ...base, framing: 'stud', wings: [wing({ between: 'door' })] },
    { ...base, wings: [wing(), wing({ wall: 'left', start: 5, width: 20, out: 16 })] },
  ]) {
    const r = design(job);
    assert.ok(r.ok, r.errors?.join(' '));
    assert.equal(priceJob(r, SAMPLE_CATALOG).unpriced, 0);
  }
  const stud = design({ ...base, framing: 'stud', wings: [wing()] });
  assert.equal(stud.summary.posts, 0);
  assert.ok(stud.geometry.wings[0].result.geometry.studWalls.right);
});

test('wings on the floor plan: each wall turns the same shape, never a mirror', () => {
  const b = { lengthIn: 576, widthIn: 360 }, wg = { startIn: 100, widthIn: 200, outIn: 120 };
  assert.deepEqual(wingPoint(b, { ...wg, wall: 'right' }, 120, 0), { x: 696, y: 100 });
  assert.deepEqual(wingPoint(b, { ...wg, wall: 'left' }, 120, 0), { x: -120, y: 300 });
  assert.deepEqual(wingPoint(b, { ...wg, wall: 'front' }, 120, 0), { x: 100, y: -120 });
  assert.deepEqual(wingPoint(b, { ...wg, wall: 'back' }, 120, 0), { x: 300, y: 480 });
});

test('wings count toward the site plan footprint and show in the CAD file', () => {
  const r = design({ ...base, wings: [wing()] });
  const lot = placeOnLot(r.geometry, { lotWidth: 200, lotDepth: 200, fromLeft: 20, fromFront: 30 });
  assert.deepEqual(lot.footprint, [20, 30, 68, 80]);
  assert.deepEqual(lot.parts.find((p) => p.label === 'Wing 1').box, [44, 30, 68, 50]);
  const file = dxf(r);
  assert.ok(file.includes('PLAN-WINGS'));
  assert.ok(file.includes('Wing 1, front wall of the wing, from outside'));
  assert.ok(dxf(design({ ...base, framing: 'stud' })).includes('ELEV-STUDS'));
});
