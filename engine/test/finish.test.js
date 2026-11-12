// Finish options on the plain 30 x 48 x 12 building. Each expected number is
// worked out by hand from the default rules; the working is beside it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { design, qty } from '../design.js';
import { priceJob, SAMPLE_CATALOG } from '../pricing.js';

const plain = { width: 30, length: 48, eaveHeight: 12, pitch: 4, overhang: 12, postSpacing: 8, trussSpacing: 4 };
const base = design(plain);
const withOptions = (options, more = {}) => design({ ...plain, ...more, options });

test('wainscot splits every wall panel', () => {
  const r = withOptions({ wainscot: true });
  // 16 panels on each long wall and 10 on each end: 52 pieces 3 ft tall.
  assert.equal(qty(r, 'Wainscot Panels', '3 ft 0 in'), 52);
  assert.equal(qty(r, 'Wall Panels'), qty(base, 'Wall Panels'));
  // The 32 long wall panels drop from 12 ft to 9 ft.
  assert.equal(qty(r, 'Wall Panels', '9 ft 0 in'), 32);
  // The only 12 ft panels left are the four at the gable peaks, which were 15 ft.
  assert.equal(qty(r, 'Wall Panels', '12 ft 0 in'), 4);
  // Z trim butts end to end in 10 ft 6 in pieces: 576 / 126 rounds up to 5, 360 / 126 to 3, twice each.
  assert.equal(qty(r, 'Wainscot Trim'), 16);
  // One girt row: three 16s on each long wall, two on each 30 ft end.
  assert.equal(qty(r, 'Wainscot Girts', '16 ft'), 10);
  assert.equal(qty(withOptions({ wainscot: true, wainscotIn: 48 }), 'Wainscot Panels', '4 ft 0 in'), 52);
});

test('the wainscot switch on the colors step counts too', () => {
  const r = design({ ...plain, colors: { wainscotOn: true, gutters: true } });
  assert.equal(qty(r, 'Wainscot Panels'), 52);
  assert.equal(qty(r, 'Gutter'), 10);
});

test('gutters', () => {
  const r = withOptions({ gutters: true });
  // Each eave is 48 ft + 2 ft of overhang = 600 in: 5 sections, 4 joiners, 2 end caps.
  assert.equal(qty(r, 'Gutter', '10 ft 0 in'), 10);
  assert.equal(qty(r, 'Gutter Joiners'), 8);
  assert.equal(qty(r, 'Gutter End Caps'), 4);
  // 600 / 24 = 25 spaces, 26 hangers a side.
  assert.equal(qty(r, 'Gutter Hangers'), 52);
  // One downspout per 40 ft: 2 a side. A 12 ft wall takes two 10 ft pieces each.
  assert.equal(qty(r, 'Gutter Outlets'), 4);
  assert.equal(qty(r, 'Downspouts'), 8);
  assert.equal(qty(r, 'Downspout Elbows'), 12);
  assert.equal(qty(r, 'Downspout Bands'), 16);
});

test('wall liner', () => {
  const r = withOptions({ linerWalls: true });
  assert.equal(qty(r, 'Liner Panels', '12 ft 0 in'), 52);
  // Six girt rows. Long walls: three rows of 16, 16, 16 and three staggered rows of 8, 16, 16, 8.
  // Ends, posts 7 ft 6 in apart: three rows of 15, 15 and three staggered rows of 7 ft 6 in, 15, 7 ft 6 in.
  assert.equal(qty(r, 'Liner Girts', '16 ft'), 48);
  assert.equal(qty(r, 'Liner Girts', '8 ft'), 24);
  // Four corners 12 ft tall, two pieces each.
  assert.equal(qty(r, 'Inside Corner Trim'), 8);
  // 156 ft around, each piece covers 10 ft.
  assert.equal(qty(r, 'J-Channel'), 16);
  // 1,872 sq ft of liner at 80 screws a square.
  assert.equal(r.summary.screws, base.summary.screws + 1498);
});

test('ceiling liner', () => {
  const r = withOptions({ linerCeiling: true });
  // Ten rows across 30 ft. Each 48 ft row: two 20 ft pieces with a 4 in lap, then 8 ft.
  assert.equal(qty(r, 'Liner Panels', '20 ft 4 in'), 20);
  assert.equal(qty(r, 'Liner Panels', '8 ft 0 in'), 10);
  assert.equal(qty(r, 'Ceiling Joists'), 0);
  // Trusses 8 ft apart: 30 / 4 rounds up to 8 spaces, 7 joists in each of 6 bays, 8 ft long.
  const wide = withOptions({ linerCeiling: true }, { trussSpacing: 8 });
  assert.equal(qty(wide, 'Ceiling Joists', '8 ft'), 42);
  // Panels now cross the joists, which sit 45 in apart: 16 across the 48 ft, each a piece
  // reaching the fifth joist (225 in + 4 in lap) and a piece for the last 135 in.
  assert.equal(qty(wide, 'Liner Panels', '19 ft 1 in'), 16);
  assert.equal(qty(wide, 'Liner Panels', '11 ft 3 in'), 16);
});

test('insulation', () => {
  // Roof: 2 x 189.7 in of slope x 48 ft = 1,518 sq ft. A 72 in roll lapped 2 in covers 729 sq ft.
  assert.equal(qty(withOptions({ roofInsulation: 'bubble' }), 'Roof Bubble Insulation'), 3);
  // Walls: 156 ft x 12 ft + two gable triangles of 75 sq ft = 2,022 sq ft.
  assert.equal(qty(withOptions({ wallInsulation: 'bubble' }), 'Wall Bubble Insulation'), 3);
  // A 9 ft roll lapped 6 in covers 850 sq ft.
  assert.equal(qty(withOptions({ wallInsulation: 'wrap' }), 'House Wrap'), 3);
  assert.equal(withOptions({ wallInsulation: 'fiberglass' }).items.find((i) => i.name === 'Wall Fiberglass Insulation').sqFt, 2022);
  // R-38 takes 19 bags per 1,000 sq ft: 1.44 x 19 = 27.4.
  assert.equal(qty(withOptions({ linerCeiling: true, ceilingR: 38 }), 'Blown Ceiling Insulation'), 28);
  assert.match(withOptions({ ceilingR: 38 }).errors[0], /needs a ceiling/);
});

test('footings and slab', () => {
  assert.equal(base.summary.posts, 20);
  assert.equal(qty(withOptions({ footing: 'pad' }), 'Footing Pads'), 20);
  // An 18 in hole 18 in deep holds 2.65 cu ft; 20 holes / 0.6 cu ft a bag = 88.4.
  assert.equal(qty(withOptions({ footing: 'collar' }), 'Concrete Mix'), 89);
  const slab = withOptions({ slab: true });
  // 1,440 sq ft / 80 sq ft a yard.
  assert.equal(qty(slab, 'Slab Concrete'), 18);
  assert.equal(qty(slab, 'Slab Vapor Barrier'), 1);
});

test('ridge vent and skylight panels', () => {
  const r = withOptions({ ridgeVent: true, skylights: 4 });
  assert.equal(qty(r, 'Ridge Vent'), 5);
  assert.equal(qty(r, 'Skylight Panels', '17 ft 1 in'), 4);
  assert.equal(qty(r, 'Roof Panels', '17 ft 1 in'), 30);
  assert.match(withOptions({ skylights: 40 }).errors[0], /cannot take 40/);
});

test('every finish part has a sample price and the cut list still agrees', () => {
  const r = withOptions({ wainscot: true, gutters: true, linerWalls: true, linerCeiling: true, roofInsulation: 'fiberglass', wallInsulation: 'bubble',
    ceilingR: 30, footing: 'collar', slab: true, ridgeVent: true, skylights: 2 }, { trussSpacing: 8, sheds: [{ kind: 'leanto', wall: 'back', depth: 12, drop: 1, enclosed: true }] });
  assert.equal(r.ok, true);
  assert.equal(priceJob(r, SAMPLE_CATALOG).unpriced, 0);
  for (const name of ['Wainscot Girts', 'Liner Girts', 'Ceiling Joists']) {
    const counted = r.items.filter((i) => i.name === name).reduce((n, i) => n + i.qty, 0);
    const cut = r.cuts.filter((c) => c.part === name).reduce((n, c) => n + c.qty, 0);
    assert.equal(cut, counted, name);
    assert.ok(counted > 0, name);
  }
});
