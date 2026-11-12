// Eave lights on the plain 30 x 48 x 12 building, worked by hand from the rules.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { design, qty } from '../design.js';

const plain = { width: 30, length: 48, eaveHeight: 12, pitch: 4, overhang: 12, postSpacing: 8, trussSpacing: 4 };
const base = design(plain);
const added = (r, name, length) => qty(r, name, length) - qty(base, name, length);

test('one side wall', () => {
  const r = design({ ...plain, options: { eaveLights: 'front' } });
  assert.equal(r.ok, true);
  // The front wall is 576 in: 576 / 36 = 16 panels. Each 12 ft panel becomes a 9 ft panel under a 3 ft clear one.
  assert.equal(added(r, 'Wall Panels', '12 ft 0 in'), -16);
  assert.equal(qty(r, 'Wall Panels', '9 ft 0 in'), 16);
  assert.equal(qty(r, 'Eave Light Panels', '3 ft 0 in'), 16);
  // Z trim butts end to end in 126 in pieces: 576 / 126 = 4.6, so 5.
  assert.equal(qty(r, 'Eave Light Trim'), 5);
  // One girt row behind the joint: 48 ft in three 16 ft boards.
  assert.equal(qty(r, 'Eave Light Girts', '16 ft'), 3);
  assert.equal(qty(r, 'Eave Light Girts'), 3);
});

test('both side walls, and with wainscot', () => {
  const r = design({ ...plain, options: { eaveLights: 'both' } });
  assert.equal(qty(r, 'Eave Light Panels'), 32);
  assert.equal(qty(r, 'Eave Light Trim'), 10);
  // 3 ft of wainscot and 3 ft of clear panel leave 6 ft of wall steel between them.
  const w = design({ ...plain, options: { eaveLights: 'both', wainscot: true, wainscotIn: 36 } });
  assert.equal(qty(w, 'Wall Panels', '6 ft 0 in'), 32);
  assert.equal(qty(w, 'Eave Light Panels'), 32);
});

test('an open wall takes none', () => {
  const r = design({ ...plain, walls: { front: { open: true } }, options: { eaveLights: 'both' } });
  assert.equal(qty(r, 'Eave Light Panels'), 16);
});

test('what gets in the way', () => {
  // A 12 x 10 door tops out at 10 ft; the clear panels start at 9 ft.
  const door = design({ ...plain, options: { eaveLights: 'front' }, openings: [{ type: 'slider', wall: 'front', offset: 18, width: 12, height: 10 }] });
  assert.equal(door.ok, false);
  assert.match(door.errors[0], /reaches into the top 3 ft 0 in/);
  // An 8 ft tall door clears it.
  assert.equal(design({ ...plain, options: { eaveLights: 'front' }, openings: [{ type: 'slider', wall: 'front', offset: 18, width: 12, height: 8 }] }).ok, true);
  const shed = design({ ...plain, options: { eaveLights: 'back' }, sheds: [{ kind: 'leanto', wall: 'back', start: 0, length: 48, depth: 12, pitch: 3, drop: 1, enclosed: false }] });
  assert.match(shed.errors[0], /lean-to or porch against it/);
  const lined = design({ ...plain, options: { eaveLights: 'front', linerWalls: true } });
  assert.equal(lined.warnings.some((x) => x.code === 'eave-light-liner'), true);
});
