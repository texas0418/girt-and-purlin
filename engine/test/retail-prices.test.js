import { test } from 'node:test';
import assert from 'node:assert/strict';
import { design } from '../design.js';
import { priceJob, UNITS, SAMPLE_CATALOG } from '../pricing.js';
import { RETAIL_CATALOG } from '../retail-prices.js';

const plain = { width: 24, length: 32, eaveHeight: 10, pitch: 4, overhang: 12, postSpacing: 8, trussSpacing: 4, openings: [] };

test('every retail row names its source and prices an item the program lists', () => {
  const known = new Set(SAMPLE_CATALOG.rows.map((r) => r.item));
  for (const r of RETAIL_CATALOG.rows) {
    assert.ok(known.has(r.item), `${r.item} is not an item the program lists`);
    assert.ok(UNITS.includes(r.unit));
    assert.ok(r.price > 0);
    assert.ok(r.source && r.from, `${r.item} has no source`);
  }
});

test('retail prices cover the frame and steel of a plain building, and trusses stay unpriced', () => {
  const priced = priceJob(design(plain), RETAIL_CATALOG);
  const by = (name) => priced.lines.find((l) => l.name === name);
  for (const name of ['Posts', 'Skirt Boards', 'Wall Girts', 'Roof Purlins', 'Roof Panels', 'Wall Panels', 'Ridge Cap']) {
    assert.ok(by(name).cost > 0, `${name} should have a price`);
  }
  assert.equal(by('Trusses').cost, null);
  assert.ok(priced.unpriced > 0);
});
