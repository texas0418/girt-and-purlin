// Open walls and wall-by-wall post spacing on the plain 30 x 48 x 12 building.
// Each expected number is the difference from the plain building, worked out
// by hand from the default rules; the working is in the comment beside it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { design, qty } from '../design.js';

const plain = { width: 30, length: 48, eaveHeight: 12, pitch: 4, overhang: 12, postSpacing: 8, trussSpacing: 4 };
const base = design(plain);
const added = (r, name, length) => qty(r, name, length) - qty(base, name, length);

const openFront = design({ ...plain, walls: { front: { open: true } } });

test('open front wall: steel', () => {
  assert.equal(openFront.ok, true);
  // The front wall is 576 in long: 576 / 36 = 16 panels, each 12 ft, come off.
  assert.equal(added(openFront, 'Wall Panels', '12 ft 0 in'), -16);
  // Base trim pieces cover 120 in: 576 / 120 rounds up to 5.
  assert.equal(added(openFront, 'Base Trim'), -5);
  // Both front corners still meet a closed end wall, so they keep their trim.
  assert.equal(added(openFront, 'Corner Trim'), 0);
  // 48 ft x 12 ft of wall is gone.
  assert.equal(openFront.summary.wallSqFt, base.summary.wallSqFt - 576);
  assert.equal(openFront.summary.roofSqFt, base.summary.roofSqFt);
});

test('open front wall: frame', () => {
  // The skirt was three 16 ft boards.
  assert.equal(added(openFront, 'Skirt Boards', '16 ft'), -3);
  assert.equal(openFront.cuts.some((c) => c.where === 'Front wall' && (c.part === 'Wall Girts' || c.part === 'Skirt Boards')), false);
  assert.equal(openFront.geometry.girtRows.some((r) => r.wall === 'front'), false);
  assert.equal(openFront.geometry.girtRows.filter((r) => r.wall === 'back').length, base.geometry.girtRows.filter((r) => r.wall === 'back').length);
  // The posts stay where they were.
  assert.equal(openFront.summary.posts, base.summary.posts);
  assert.match(openFront.warnings.map((w) => w.text).join(' '), /front wall is open/);
});

test('an open side wall always gets a beam over its posts', () => {
  // Trusses every 8 ft land on the posts, so the closed building needs no carriers.
  const closed = design({ ...plain, trussSpacing: 8 });
  assert.equal(qty(closed, 'Truss Carriers'), 0);
  // Open the front: two boards side by side over 48 ft. One line is three 16s, the other starts with a half board: 8, 16, 16, 8.
  const open = design({ ...plain, trussSpacing: 8, walls: { front: { open: true } } });
  assert.equal(qty(open, 'Truss Carriers', '16 ft'), 5);
  assert.equal(qty(open, 'Truss Carriers', '8 ft'), 2);
});

test('every wall open leaves a roof on posts', () => {
  const all = design({ ...plain, walls: { front: { open: true }, back: { open: true }, left: { open: true }, right: { open: true } } });
  assert.equal(all.ok, true);
  for (const name of ['Wall Panels', 'Base Trim', 'Corner Trim', 'Skirt Boards', 'Wall Girts']) assert.equal(qty(all, name), 0, name);
  assert.equal(all.summary.wallSqFt, 0);
  assert.equal(qty(all, 'Roof Panels'), qty(base, 'Roof Panels'));
  assert.equal(qty(all, 'Rake Trim'), qty(base, 'Rake Trim'));
  assert.match(all.warnings.map((w) => w.text).join(' '), /front wall, back wall, left end and right end are open/);
});

test('a corner loses its trim only when both of its walls are open', () => {
  // Front and left open: the front-left corner has no steel on either side. Each corner takes 2 pieces (144 in at 120 in a piece).
  const two = design({ ...plain, walls: { front: { open: true }, left: { open: true } } });
  assert.equal(added(two, 'Corner Trim'), -2);
});

test('a door or window cannot sit on an open wall', () => {
  const r = design({ ...plain, walls: { front: { open: true } }, openings: [{ type: 'walk', wall: 'front', offset: 2.5, width: 3, height: 6 + 8 / 12 }] });
  assert.equal(r.ok, false);
  assert.match(r.errors[0], /sits on an open wall/);
});

test('liner and wainscot leave an open wall alone', () => {
  const lined = design({ ...plain, options: { linerWalls: true, wainscot: true, wainscotIn: 36 } });
  const open = design({ ...plain, walls: { front: { open: true } }, options: { linerWalls: true, wainscot: true, wainscotIn: 36 } });
  // 16 liner panels and 16 wainscot panels come off with the wall.
  assert.equal(qty(open, 'Liner Panels') - qty(lined, 'Liner Panels'), -16);
  assert.equal(qty(open, 'Wainscot Panels') - qty(lined, 'Wainscot Panels'), -16);
  // Liner turns an inside corner only at the two back corners now: 2 pieces each instead of 4 corners.
  assert.equal(qty(open, 'Inside Corner Trim') * 2, qty(lined, 'Inside Corner Trim'));
});

test('post spacing can differ from wall to wall', () => {
  // Front wall at 12 ft: 48 / 12 = 4 bays, 5 posts where there were 7. Posts are 144 + 48 in = 16 ft.
  const r = design({ ...plain, walls: { front: { postSpacing: 12 } } });
  assert.equal(r.ok, true);
  assert.equal(added(r, 'Posts', '16 ft'), -2);
  assert.deepEqual(r.geometry.posts.filter((p) => p.wall === 'front').map((p) => p.atIn), [0, 144, 288, 432, 576]);
  assert.deepEqual(r.geometry.posts.filter((p) => p.wall === 'back').map((p) => p.atIn), base.geometry.posts.filter((p) => p.wall === 'back').map((p) => p.atIn));
  assert.match(design({ ...plain, walls: { front: { postSpacing: 30 } } }).errors[0], /Post spacing on the front wall/);
});

test('the cut list still matches the material list', () => {
  for (const name of ['Skirt Boards', 'Wall Girts', 'Truss Carriers']) {
    const counted = openFront.items.filter((i) => i.name === name).reduce((n, i) => n + i.qty, 0);
    const cut = openFront.cuts.filter((c) => c.part === name).reduce((n, c) => n + c.qty, 0);
    assert.equal(cut, counted, name);
  }
});
