// Wraparound porches, awnings and dormers on the plain 30 x 48 x 12 gable
// building, 4 in 12, 12 in overhang. Each expected number is worked out by
// hand from the default rules; the working is in the comment beside it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { design } from '../design.js';
import { priceJob, SAMPLE_CATALOG } from '../pricing.js';

const plain = { width: 30, length: 48, eaveHeight: 12, pitch: 4, overhang: 12, postSpacing: 8, trussSpacing: 4 };
const base = design(plain);
const total = (r, name) => r.items.filter((i) => i.name === name).reduce((n, i) => n + i.qty, 0);
const more = (r, name) => total(r, name) - total(base, name);
const near = (a, b, by = 0.01) => assert.ok(Math.abs(a - b) < by, `${a} is not ${b}`);

const wrapInput = { kind: 'wrap', walls: ['front', 'right'], depth: 8, pitch: 3, drop: 1 };
const wrap = design({ ...plain, sheds: [wrapInput] });

test('a wraparound porch is one porch on each wall, joined at the corner', () => {
  assert.equal(wrap.ok, true);
  const [front, right] = wrap.geometry.sheds;
  assert.deepEqual([front.wall, front.lengthIn, front.cornerEnd, front.freeEnds], ['front', 576, true, 1]);
  assert.deepEqual([right.wall, right.lengthIn, right.cornerStart, right.freeEnds], ['right', 360, true, 1]);
  assert.equal(front.label, 'Front wraparound porch');
  // The front stretch owns the corner. Its post stands 8 ft past the end of the wall and 8 ft out.
  assert.deepEqual(front.cornerAt, [672]);
  assert.deepEqual(right.cornerAt, []);
  // Outer posts at 8 ft: 7 along 48 ft, 5 along 30 ft, and the corner post.
  assert.equal(front.posts.length + right.posts.length, 13);
  // Floor: 48 x 8 + 30 x 8 + the 8 x 8 corner square.
  assert.equal(wrap.summary.shedSqFt, 688);
});

test('the corner of a wraparound porch gets a hip rafter, jack rafters and hip cap', () => {
  // The roof reaches 8 ft + 1 ft of overhang = 108 in out. The hip crosses that both ways and
  // drops 108 x 3/12 = 27 in: the root of 108² + 108² + 27² = 155.1 in, cut from a 14 ft board.
  const hipCut = wrap.cuts.find((c) => c.part === 'Hip Rafters');
  near(hipCut.cutIn, 155.1, 0.2);
  assert.deepEqual([hipCut.stockFt, hipCut.qty, hipCut.size], [14, 1, '2x10']);
  // Hip cap pieces cover 120 in each: 155.1 / 120 = 2.
  assert.equal(more(wrap, 'Hip Cap'), 2);
  // Jack rafters at 4 ft from the building corner: one spot under 8 ft, on each side of the hip.
  // Each is (108 - 48) x 1.0308 = 61.8 in.
  const jacks = wrap.cuts.filter((c) => c.part === 'Rafters' && c.note.startsWith('Jack'));
  assert.equal(jacks.reduce((n, c) => n + c.qty, 0), 2);
  near(jacks[0].cutIn, 61.85, 0.2);
});

test('trim and roof area on a wraparound porch follow the corner', () => {
  // Eave: front 576 + 12 overhang at the free end + 108 to the corner = 696 in, 6 pieces.
  // Right: 360 + 12 + 108 = 480 in, 4 pieces.
  assert.equal(more(wrap, 'Eave Trim'), 10);
  // A rake only at the two free ends, 111.3 in each, one piece each.
  assert.equal(more(wrap, 'Rake Trim'), 2);
  // Rectangles 588 and 372 in long by the 111.32 in slope, plus two corner triangles of 108 x 111.32 / 2.
  near(wrap.summary.roofSqFt - base.summary.roofSqFt, (588 + 372 + 108) * 111.3238 / 144, 0.05);
  // Corner panels step down from the full 9 ft 6 in: 77 in and 40 in, one of each on each side of the hip.
  const panels = (len) => wrap.items.find((i) => i.name === 'Roof Panels' && i.length === len)?.qty;
  assert.equal(panels('6 ft 5 in'), 2);
  assert.equal(panels('3 ft 4 in'), 2);
  // 588 / 36 = 17 and 372 / 36 = 11 full panels, plus the first one in each corner triangle.
  assert.equal(panels('9 ft 6 in'), 30);
});

test('gutters turn the corner of a wraparound porch', () => {
  const r = design({ ...plain, sheds: [wrapInput], options: { gutters: true } });
  assert.equal(total(r, 'Gutter Corners'), 1);
});

test('a wraparound porch on all four walls has four corners and no rakes', () => {
  const r = design({ ...plain, sheds: [{ ...wrapInput, walls: ['front', 'back', 'left', 'right'] }] });
  assert.equal(r.ok, true);
  assert.equal(more(r, 'Rake Trim'), 0);
  assert.equal(more(r, 'Hip Cap'), 8);
  assert.equal(r.cuts.filter((c) => c.part === 'Hip Rafters').reduce((n, c) => n + c.qty, 0), 4);
  // 2 x 48 x 8 + 2 x 30 x 8 + 4 corner squares of 64.
  assert.equal(r.summary.shedSqFt, 1504);
});

test('a wraparound porch needs walls that touch', () => {
  for (const walls of [['front', 'back'], ['left', 'right'], ['front'], []]) {
    const r = design({ ...plain, sheds: [{ ...wrapInput, walls }] });
    assert.deepEqual(r.errors, ['The wraparound porch needs walls that touch at a corner.']);
  }
});

const door = { type: 'walk', wall: 'front', offset: 6, width: 3, height: 6 + 8 / 12 };
const awningInput = { kind: 'awning', wall: 'front', over: 0, out: 3, width: 5, pitch: 4 };
const awn = design({ ...plain, openings: [door], sheds: [awningInput] });
const doorOnly = design({ ...plain, openings: [door] });

test('an awning centers itself over its door and sits just above it', () => {
  const a = awn.geometry.awnings[0];
  // The door runs 72 to 108 in, center 90. A 60 in awning starts at 60.
  assert.equal(a.startIn, 60);
  // Door top at 80 in, plus the 6 in gap. It rises 36 x 4/12 = 12 in back to the wall.
  near(a.lowIn, 86);
  near(a.highIn, 98);
  assert.equal(a.label, 'Front awning');
  // Brackets no more than 4 ft apart: 60 / 48 rounds up to 2 spaces, 3 brackets.
  assert.equal(total(awn, 'Awning Brackets'), 3);
});

test('an awning is counted: ledger, rafters, purlins, panels and trim', () => {
  const cuts = awn.cuts.filter((c) => c.where === 'Front awning');
  const of = (part) => cuts.filter((c) => c.part === part).reduce((n, c) => n + c.qty, 0);
  assert.equal(of('Rafter Ledgers'), 1);
  assert.equal(of('Rafters'), 3);
  // Slope 36 x 1.0541 = 37.9 in: purlin rows at 24 in, 2 spaces, 3 rows.
  assert.equal(of('Roof Purlins'), 3);
  // Panels 37.9 + 2 = 40 in, two of them across 60 in.
  assert.equal(awn.items.find((i) => i.name === 'Roof Panels' && i.length === '3 ft 4 in').qty, 2);
  const d = (name) => total(awn, name) - total(doorOnly, name);
  assert.deepEqual([d('Endwall Flashing'), d('Eave Trim'), d('Rake Trim')], [1, 1, 2]);
  assert.equal(priceJob(awn, SAMPLE_CATALOG).unpriced, 0);
});

test('an awning that cannot hang where it is put says why', () => {
  const err = (sheds, extra = {}) => design({ ...plain, openings: [door], ...extra, sheds }).errors.join(' ');
  assert.match(err([{ ...awningInput, wall: 'back' }]), /not on that wall/);
  assert.match(err([{ ...awningInput, width: 3, over: null, start: 46 }]), /runs past the end/);
  assert.match(err([{ ...awningInput, out: 8, pitch: 12 }]), /reach up into the main roof/);
  assert.match(err([awningInput, { ...awningInput, over: null, start: 8 }]), /overlaps another addition/);
  assert.match(err([{ ...awningInput, over: null, start: 4, wall: 'back' }], { walls: { back: { open: true } } }), /closed wall/);
  const narrow = design({ ...plain, openings: [{ type: 'overhead', wall: 'front', offset: 20, width: 10, height: 8 }], sheds: [awningInput] });
  assert.match(narrow.errors.join(' '), /narrower than the overhead door/);
});

const dormerInput = { side: 'front', at: 12, width: 6, style: 'gable', window: true };
const dorm = design({ ...plain, dormers: [dormerInput] });

test('a gable dormer is sized to get back to the main roof below the ridge', () => {
  assert.equal(dorm.ok, true);
  const d = dorm.geometry.dormers[0];
  // The face stands 24 in in from the wall, where the roof is 144 + 24 x 4/12 = 152 in up.
  assert.equal(d.baseIn, 152);
  // A 48 in face would put the dormer ridge at 152 + 48 + 36 x 4/12 = 212, over the 204 in peak.
  // It comes down 6 in at a time: 36 in gives a ridge at 200.
  assert.deepEqual([d.faceIn, d.topIn, d.ridgeIn], [36, 188, 200]);
  // The main roof reaches 188 in at (188 - 144) x 3 = 132 in, and 200 in at 168 in.
  near(d.cheekEndIn, 132, 0.3);
  near(d.backIn, 168, 0.3);
  // Each slope: half the width plus 6 in of overhang, 42 x 1.0541 = 44.3 in.
  near(d.slopeIn, 44.27);
  // Valley: 36 in back, 36 in across, 12 in up.
  near(d.valleyIn, 52.31, 0.2);
  assert.ok(dorm.warnings.some((w) => w.code === 'dormer-framing'));
});

test('a gable dormer is counted: framing, rafters, flashing and its window', () => {
  assert.equal(more(dorm, 'Valley Flashing'), 2);
  assert.equal(more(dorm, 'Sidewall Flashing'), 2);
  assert.equal(more(dorm, 'Corner Trim'), 2);
  // The window is 2 ft narrower than the dormer and 1 ft shorter than its face.
  const win = dorm.items.find((i) => i.name === 'Dormer Window');
  assert.deepEqual([win.size, win.qty], ['4 ft 0 in x 2 ft 0 in', 1]);
  // Face studs at 16 in across 72 in: 5 spaces, 6 studs, 36 in each.
  assert.equal(dorm.cuts.find((c) => c.note === 'Face wall studs').qty, 6);
  // Rafter pairs at 24 in along the 108 in side wall: 5 spaces, 6 pairs.
  assert.equal(dorm.cuts.find((c) => c.note === 'Rafters, in pairs').qty, 12);
  assert.ok(total(dorm, 'Dormer Framing') > 0 && total(dorm, 'Dormer Rafters') > 0);
  assert.equal(priceJob(dorm, SAMPLE_CATALOG).unpriced, 0);
  const plainWindow = design({ ...plain, dormers: [{ ...dormerInput, window: false }] });
  assert.equal(total(plainWindow, 'Dormer Window'), 0);
});

test('a shed dormer needs a main roof steep enough to meet', () => {
  const flat = design({ ...plain, dormers: [{ ...dormerInput, style: 'shed' }] });
  assert.match(flat.errors.join(' '), /never gets back to the main roof/);
  const steep = design({ ...plain, pitch: 6, dormers: [{ ...dormerInput, style: 'shed' }] });
  assert.equal(steep.ok, true);
  const d = steep.geometry.dormers[0];
  // On a 6 in 12 roof the face base is at 156 in. The peak is 234, so a 48 in face at 3 in 12 would
  // meet the roof at 24 + 48 x 4 = 216 in in, past the ridge at 180. A 36 in face meets at 24 + 144 = 168.
  assert.equal(d.faceIn, 36);
  near(d.backIn, 168, 0.3);
  assert.equal(total(steep, 'Transition Flashing'), 1);
  assert.equal(total(steep, 'Valley Flashing'), 0);
});

test('dormers are left off roofs that cannot take them, with a warning', () => {
  for (const roof of ['hip', 'mono']) {
    const r = design({ ...plain, roof, dormers: [dormerInput] });
    assert.equal(r.ok, true);
    assert.equal(r.geometry.dormers.length, 0);
    assert.ok(r.warnings.some((w) => w.code === 'dormer-roof'));
  }
  assert.equal(design({ ...plain, roof: 'gambrel', dormers: [dormerInput] }).geometry.dormers.length, 1);
});

test('dormers keep clear of the ends and of each other', () => {
  assert.match(design({ ...plain, dormers: [{ ...dormerInput, at: 1 }] }).errors.join(' '), /2 ft in from each end/);
  assert.match(design({ ...plain, dormers: [dormerInput, { ...dormerInput, at: 19 }] }).errors.join(' '), /closer than 2 ft/);
  assert.equal(design({ ...plain, dormers: [dormerInput, { ...dormerInput, at: 19, side: 'back' }] }).ok, true);
});

test('1,500 random buildings with additions hold together and price out', () => {
  let seed = 7;
  const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  const pick = (list) => list[Math.floor(rnd() * list.length)];
  const between = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  let good = 0;
  for (let i = 0; i < 1500; i++) {
    const job = { width: between(12, 60), length: between(60, 120), eaveHeight: between(9, 18), pitch: between(2, 12), overhang: pick([0, 12, 24]), postSpacing: 8, trussSpacing: pick([2, 4, 8]), roof: pick(['gable', 'gable', 'gambrel', 'hip', 'mono']),
      options: { roofCover: pick(['steel', 'steel', 'standing', 'shingles']), wallCover: pick(['steel', 'steel', 'batten', 'lap']), gutters: rnd() < 0.5 },
      openings: [{ type: 'walk', wall: 'front', offset: 10, width: 3, height: 6 + 8 / 12 }],
      sheds: [
        ...(rnd() < 0.6 ? [{ kind: 'wrap', walls: ['front', 'back', 'left', 'right'].filter(() => rnd() < 0.6), depth: between(4, 12), pitch: between(1, 4), drop: between(0, 3) }] : []),
        ...(rnd() < 0.6 ? [{ kind: 'awning', wall: pick(['front', 'back', 'left']), over: rnd() < 0.5 ? 0 : null, start: between(0, 30), out: between(2, 8), width: between(3, 12), pitch: between(1, 8) }] : []),
      ],
      dormers: Array.from({ length: between(0, 3) }, (_, n) => ({ side: pick(['front', 'back']), at: 4 + n * between(8, 20), width: between(3, 16), style: pick(['gable', 'shed']), window: rnd() < 0.7 })) };
    const r = design(job);
    if (!r.ok) { assert.ok(r.errors.length > 0 && r.errors.every((e) => typeof e === 'string' && !/NaN|undefined|null/.test(e)), JSON.stringify([job, r.errors])); continue; }
    good++;
    for (const item of r.items) assert.ok(Number.isInteger(item.qty) && item.qty > 0, `${item.name} ${item.qty} ${JSON.stringify(job)}`);
    for (const c of r.cuts) assert.ok(c.cutIn > 0 && c.stockFt && c.cutIn <= c.stockFt * 12 + 0.01, `${c.part} ${c.cutIn} ${c.stockFt} ${JSON.stringify(job)}`);
    assert.ok(Number.isFinite(r.summary.roofSqFt) && Number.isFinite(r.summary.wallSqFt));
    assert.equal(priceJob(r, SAMPLE_CATALOG).unpriced, 0, JSON.stringify(job));
    assert.equal(JSON.stringify(design(job)), JSON.stringify(r));
  }
  assert.ok(good > 150, `only ${good} of 1,500 were buildable`);
});

test('a board and batten wall one inch taller than the longest board is built from two boards', () => {
  // 49 ft wide at 6 in 12 on a 9 ft wall peaks at 255 in. Boards at 193 in are an inch past a 16 ft
  // board, so each takes two; before the fix they were listed with no length and no count.
  const r = design({ ...plain, width: 49, length: 82, eaveHeight: 9, pitch: 6, overhang: 0, options: { wallCover: 'batten' } });
  assert.equal(r.ok, true);
  for (const i of r.items.filter((i) => i.name === 'Siding Boards' || i.name === 'Battens')) assert.ok(i.qty > 0 && i.ft > 0, JSON.stringify(i));
});
