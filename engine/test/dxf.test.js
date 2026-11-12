// The CAD file is read back the way a CAD program reads it: pairs of lines,
// a group code and then its value.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { design } from '../design.js';
import { dxf } from '../dxf.js';

const job = { width: 30, length: 48, eaveHeight: 12, pitch: 4, overhang: 12, postSpacing: 8, trussSpacing: 4,
  openings: [{ type: 'walk', wall: 'front', offset: 2.5, width: 3, height: 6 + 8 / 12 }] };

function entities(file) {
  const rows = file.trimEnd().split('\r\n');
  assert.equal(rows.length % 2, 0);
  const pairs = [];
  for (let i = 0; i < rows.length; i += 2) pairs.push([Number(rows[i]), rows[i + 1]]);
  const list = [];
  for (const [code, value] of pairs) {
    if (code === 0) list.push({ type: value }); else list[list.length - 1][code] = value;
  }
  return list;
}

test('the file is one ENTITIES section that ends with EOF', () => {
  const list = entities(dxf(design(job)));
  assert.deepEqual([list[0].type, list[0][2]], ['SECTION', 'ENTITIES']);
  assert.deepEqual(list.slice(-2).map((e) => e.type), ['ENDSEC', 'EOF']);
  assert.deepEqual([...new Set(list.slice(1, -2).map((e) => e.type))].sort(), ['LINE', 'TEXT']);
  for (const e of list.filter((e) => e.type === 'LINE')) {
    for (const code of [8, 10, 20, 11, 21]) assert.ok(e[code] !== undefined && (code === 8 || Number.isFinite(Number(e[code]))));
  }
});

test('the plan is drawn in inches with a gap at the door', () => {
  const list = entities(dxf(design(job)));
  const walls = list.filter((e) => e[8] === 'PLAN-WALLS');
  const front = walls.filter((e) => e[20] === '0' && e[21] === '0').map((e) => [Number(e[10]), Number(e[11])]);
  // Front wall: left corner to the door at 30 in, then from 66 in to the far corner at 576 in.
  assert.deepEqual(front, [[0, 30], [66, 576]]);
  // Twenty posts, four lines each.
  assert.equal(list.filter((e) => e[8] === 'PLAN-POSTS').length, 80);
  // Each wall view shows its posts as two lines: 7 + 7 + 3 + 3 posts.
  assert.equal(list.filter((e) => e[8] === 'ELEV-POSTS').length, 40);
});

test('the end wall outline climbs to the peak', () => {
  const list = entities(dxf(design(job)));
  const ys = list.filter((e) => e[8] === 'ELEV-OUTLINE').flatMap((e) => [Number(e[20]), Number(e[21])]);
  // Eave 144 in, peak 144 + 180 x 4/12 = 204 in.
  assert.equal(Math.max(...ys) - Math.min(...ys), 204);
});

test('sheds, walls inside and a loft all draw', () => {
  const r = design({ ...job, eaveHeight: 14, sheds: [{ kind: 'porch', wall: 'back', depth: 8, pitch: 3, drop: 1 }],
    partitions: [{ axis: 'across', at: 30, start: 0, length: 30, doors: 1 }], loft: { end: 'left', depth: 12, height: 8 } });
  assert.equal(r.ok, true);
  const layers = new Set(entities(dxf(r)).map((e) => e[8]));
  for (const layer of ['PLAN-SHEDS', 'PLAN-INTERIOR', 'PLAN-LOFT']) assert.ok(layers.has(layer), layer);
});
