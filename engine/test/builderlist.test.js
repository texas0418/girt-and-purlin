// A supplier's list handed to a builder at that builder's price level.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { builderPriceList, priceListCsv, parsePriceList } from '../pricing.js';

const list = { supplier: 'Valley Lumber', sample: false, rows: [
  { item: 'Posts', size: '6x6 treated', unit: 'ft', price: 4.5 },
  { item: 'Walk Door', size: '', unit: 'each', price: 449.99 },
] };

test('a discount takes the same share off every price', () => {
  const r = builderPriceList(list, 'Hill Builders', -10);
  // 4.50 less 10% = 4.05; 449.99 less 10% = 404.991, to the cent 404.99.
  assert.deepEqual(r.rows.map((x) => x.price), [4.05, 404.99]);
  assert.equal(r.supplier, 'Valley Lumber For Hill Builders');
  assert.deepEqual(r.rows.map((x) => [x.item, x.size, x.unit]), list.rows.map((x) => [x.item, x.size, x.unit]));
  // The supplier's own list is left alone.
  assert.equal(list.rows[0].price, 4.5);
});

test('a figure above zero raises prices and zero leaves them', () => {
  // 4.50 plus 8% = 4.86; 449.99 plus 8% = 485.9892, to the cent 485.99.
  assert.deepEqual(builderPriceList(list, 'A', 8).rows.map((x) => x.price), [4.86, 485.99]);
  assert.deepEqual(builderPriceList(list, '', 0), { ...list });
  // Nothing goes below zero.
  assert.deepEqual(builderPriceList(list, 'A', -150).rows.map((x) => x.price), [0, 0]);
});

test('the saved file loads back as the same list', () => {
  const r = builderPriceList(list, 'Hill Builders', -10);
  assert.deepEqual(parsePriceList(priceListCsv(r), r.supplier).catalog, r);
});
