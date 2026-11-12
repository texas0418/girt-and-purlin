// The buildings offered on the Jobs step have to open cleanly: no errors, no warnings, every line priced.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { design } from '../design.js';
import { priceJob, SAMPLE_CATALOG } from '../pricing.js';
import { STARTING_POINTS } from '../../app/office.js';

for (const t of STARTING_POINTS) {
  test(`starting point: ${t.name}`, () => {
    const r = design(t.design);
    assert.deepEqual(r.errors ?? [], []);
    assert.deepEqual(r.warnings.map((w) => w.text), []);
    assert.equal(priceJob(r, SAMPLE_CATALOG).unpriced, 0);
  });
}
