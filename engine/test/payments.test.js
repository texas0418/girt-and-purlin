// The payment schedule on a $16,033.27 job.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { paymentSchedule } from '../pricing.js';

test('no payments typed in means no schedule', () => {
  assert.deepEqual(paymentSchedule(16033.27, []), { lines: [], problem: '' });
  assert.deepEqual(paymentSchedule(16033.27, [{ name: 'Deposit', pct: 0 }]).lines, []);
});

test('shares short of the whole leave a balance', () => {
  const { lines } = paymentSchedule(16033.27, [{ name: 'Deposit', pct: 30 }, { name: 'When Materials Arrive', pct: 40 }]);
  // 30% = 4809.981, 40% = 6413.308; the balance is what is left: 16033.27 - 4809.98 - 6413.31.
  assert.deepEqual(lines.map((l) => [l.name, l.pct, l.amount]), [['Deposit', 30, 4809.98], ['When Materials Arrive', 40, 6413.31], ['Balance', 30, 4809.98]]);
  assert.equal(Math.round(lines.reduce((s, l) => s + l.amount, 0) * 100), 1603327);
});

test('the last payment takes up the odd cent', () => {
  // Three thirds of $100: 33.33 + 33.33 leaves 33.34.
  const third = 100 / 3;
  const { lines } = paymentSchedule(100, [{ name: 'A', pct: third }, { name: 'B', pct: third }, { name: 'C', pct: third }]);
  assert.deepEqual(lines.map((l) => l.amount), [33.33, 33.33, 33.34]);
  assert.equal(lines.length, 3);
});

test('more than the whole job is turned away', () => {
  const r = paymentSchedule(1000, [{ name: 'Deposit', pct: 60 }, { name: 'Framing', pct: 50 }]);
  assert.deepEqual(r.lines, []);
  assert.match(r.problem, /add up to 110%/);
});

test('a payment with no name still prints', () => {
  assert.equal(paymentSchedule(1000, [{ pct: 100 }]).lines[0].name, 'Payment');
});
