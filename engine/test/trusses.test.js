// Truss types on a gable roof. Every expected number is worked by hand in the comment above it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { design, qty } from '../design.js';
import { priceJob, SAMPLE_CATALOG } from '../pricing.js';

const size = { width: 24, length: 32, eaveHeight: 10, overhang: 12, postSpacing: 8, trussSpacing: 4, pitch: 6 };
const lined = { linerCeiling: true, linerWalls: true, ceilingR: 38 };
const line = (r, name) => r.items.find((i) => i.name === name);

test('a common truss is the default and changes nothing', () => {
  assert.deepEqual(design(size).items, design({ ...size, truss: 'common' }).items);
  assert.equal(line(design(size), 'Trusses').size, '24 ft span, 6/12');
});

test('scissor trusses: named on the list, ceiling at half the roof pitch unless typed in', () => {
  const r = design({ ...size, truss: 'scissor' });
  assert.equal(qty(r, 'Trusses'), 0);
  assert.equal(line(r, 'Scissor Trusses').size, '24 ft span, 6/12, 3/12 ceiling');
  assert.equal(line(design({ ...size, truss: 'scissor', ceilingPitch: 2 }), 'Scissor Trusses').size, '24 ft span, 6/12, 2/12 ceiling');
  // 9 trusses x 24 ft x the sample 11.70 a foot.
  assert.equal(priceJob(r, SAMPLE_CATALOG, {}).lines.find((l) => l.name === 'Scissor Trusses').cost, 9 * 24 * 11.7);
  assert.match(design({ ...size, truss: 'scissor', ceilingPitch: 6 }).errors[0], /at least 1 in 12 flatter/);
});

// A 3 in 12 ceiling is sqrt(144 + 9) / 12 = 1.0308 times as long as the floor under it.
test('scissor trusses: the liner and insulation follow the vaulted ceiling', () => {
  const flat = design({ ...size, options: lined });
  const vault = design({ ...size, truss: 'scissor', options: lined });
  // Flat ceiling: 288 in / 36 in = 8 panels in each run. Vaulted: each slope is 144 x 1.0308 = 148.4 in, 5 panels, two slopes, 10.
  assert.equal(qty(flat, 'Liner Panels', '20 ft 4 in'), 8);
  assert.equal(qty(vault, 'Liner Panels', '20 ft 4 in'), 10);
  // End wall liner climbs to the ceiling: panel edges 3, 6, 9 and 12 ft in rise 9, 18, 27 and 36 in. Two walls, two sides each.
  for (const len of ['10 ft 9 in', '11 ft 6 in', '12 ft 3 in', '13 ft 0 in']) assert.equal(qty(vault, 'Liner Panels', len), 4, len);
  // 768 sq ft x 19 bags per 1,000 = 14.6, 15 bags. Vaulted: 791.6 sq ft, 15.04, 16 bags.
  assert.equal(qty(flat, 'Blown Ceiling Insulation'), 15);
  assert.equal(qty(vault, 'Blown Ceiling Insulation'), 16);
});

test('scissor trusses 8 ft apart: joists and liner run down each slope', () => {
  const vault = design({ ...size, truss: 'scissor', trussSpacing: 8, options: lined });
  // Each slope 148.4 in needs supports 48 in apart: 4 spaces, 3 rows inside, two slopes, plus one at the peak = 7 rows in each of 4 bays.
  assert.equal(qty(vault, 'Ceiling Joists'), 28);
  // Panels run down the slope, 148.4 in, ordered at 12 ft 5 in. 384 in / 36 in = 11 across, two slopes.
  assert.equal(qty(vault, 'Liner Panels', '12 ft 5 in'), 22);
});

test('attic trusses: room, subfloor and limits', () => {
  // 24 ft wide at 8 in 12: the roof is 96 in up at the middle. A 12 ft room starts 6 ft in, where the roof is 72 x 8/12 = 48 in up.
  const r = design({ ...size, pitch: 8, trussSpacing: 2, truss: 'attic', atticRoom: 12 });
  assert.equal(line(r, 'Attic Trusses').size, '24 ft span, 8/12, 12 ft room');
  assert.deepEqual(r.geometry.attic, { roomIn: 144, kneeIn: 48, ceilingIn: 96, flatIn: 0, startIn: 72, sqFt: 384 });
  // 12 ft x 32 ft = 384 sq ft, 12 sheets of 4 x 8.
  assert.equal(qty(r, 'Attic Subfloor'), 12);
  assert.equal(r.summary.atticSqFt, 384);
  assert.deepEqual(r.warnings.map((w) => w.code).filter((c) => c.startsWith('attic')), ['attic-stair']);
  // The floor rides on the trusses, so they cannot sit 4 ft apart.
  assert.match(design({ ...size, truss: 'attic' }).errors[0], /no more than 2 ft apart/);
  // 80% of 24 ft is 19 ft 2 in.
  assert.match(design({ ...size, trussSpacing: 2, truss: 'attic', atticRoom: 20 }).errors[0], /19 ft 2 in/);
  // At 4 in 12 the roof is only 48 in up at the middle.
  assert.equal(design({ ...size, pitch: 4, trussSpacing: 2, truss: 'attic' }).warnings.some((w) => w.code === 'attic-low'), true);
});

test('a roof that is not a gable ignores the truss type', () => {
  assert.deepEqual(design({ ...size, roof: 'mono', truss: 'scissor' }).items, design({ ...size, roof: 'mono' }).items);
});
