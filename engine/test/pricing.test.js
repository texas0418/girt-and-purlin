import { test } from 'node:test';
import assert from 'node:assert/strict';
import { design } from '../design.js';
import { priceJob, parsePriceList, priceListCsv, SAMPLE_CATALOG } from '../pricing.js';

const plain = { width: 24, length: 32, eaveHeight: 10, pitch: 4, overhang: 12, postSpacing: 8, trussSpacing: 4, openings: [] };

test('a per-foot price multiplies by length and count', () => {
  const result = { items: [{ name: 'Wall Girts', size: '2x6', qty: 10, ft: 16 }], summary: { floorSqFt: 100 } };
  const priced = priceJob(result, { rows: [{ item: 'Wall Girts', size: '2x6', unit: 'ft', price: 1 }] });
  assert.equal(priced.lines[0].each, 16);
  assert.equal(priced.total, 160);
});

test('markup, tax and labor stack in that order', () => {
  const result = { items: [{ name: 'Window', size: '', qty: 2 }], summary: { floorSqFt: 1000 } };
  const priced = priceJob(result, { rows: [{ item: 'Window', size: '', unit: 'each', price: 500 }] },
    { markupPct: 20, taxPct: 5, laborPerSqFt: 2 });
  assert.equal(priced.materials, 1000);
  assert.equal(priced.markup, 200);
  assert.equal(priced.tax, 60);
  assert.equal(priced.labor, 2000);
  assert.equal(priced.total, 3260);
});

test('an exact size beats the any-size row, and a missing item is flagged', () => {
  const result = { items: [{ name: 'Posts', size: '6x6 treated', qty: 1, ft: 10 }, { name: 'Cupola', size: '', qty: 1 }], summary: {} };
  const priced = priceJob(result, { rows: [
    { item: 'Posts', size: '', unit: 'ft', price: 1 },
    { item: 'posts', size: '6X6 Treated', unit: 'ft', price: 5 },
  ] });
  assert.equal(priced.lines[0].cost, 50);
  assert.equal(priced.lines[1].cost, null);
  assert.equal(priced.unpriced, 1);
});

test('the sample price list prices every line of a real building', () => {
  const priced = priceJob(design({ ...plain, openings: [{ type: 'slider', wall: 'front', offset: 10, width: 12, height: 8 }] }), SAMPLE_CATALOG);
  assert.equal(priced.unpriced, 0);
  const door = priced.lines.find((l) => l.name === 'Sliding Door');
  assert.equal(door.cost, 12 * 8 * 14);
});

test('a price list survives the trip out to a spreadsheet and back', () => {
  const { catalog, problems } = parsePriceList(priceListCsv(SAMPLE_CATALOG));
  assert.deepEqual(problems, []);
  assert.deepEqual(catalog.rows, SAMPLE_CATALOG.rows);
});

test('a bad price list is refused with the row number', () => {
  const { catalog, problems } = parsePriceList('Item,Size,Unit,Price\nPosts,"6x6, treated",ft,$4.50\nTrusses,,yard,9\nWindow,,each,abc\n');
  assert.equal(catalog.rows.length, 1);
  assert.equal(catalog.rows[0].size, '6x6, treated');
  assert.equal(catalog.rows[0].price, 4.5);
  assert.equal(problems.length, 2);
  assert.match(problems[0], /Row 3/);
  assert.equal(parsePriceList('Name,Cost\nPosts,4\n').catalog, null);
});
