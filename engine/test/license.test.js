// License codes and the 30 day trial. The tests sign with a key made here, so
// the real private key is never needed to run them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { signCode, readCode, codeId, askSwitchedOff, tick, standing, normalName, longDate, PUBLIC_KEY, TRIAL_DAYS } from '../license.js';

const DAY = 86400000;
const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const pub = await crypto.subtle.exportKey('jwk', pair.publicKey);
const code = await signCode('Smith Barns, LLC', 'paid', '2027-11-13', pair.privateKey);

test('a good code unlocks for the company it was made for', async () => {
  const got = await readCode('Smith Barns, LLC', code, pub);
  assert.equal(got.kind, 'paid');
  assert.equal(got.expires, '2027-11-13');
  // Good through the end of November 13, so it ends at the first moment of the 14th.
  assert.equal(got.endsAt, Date.UTC(2027, 10, 14));
  assert.equal(longDate(got.expires), 'November 13, 2027');
});

test('capitals, spaces and punctuation in the name do not matter', async () => {
  assert.equal(normalName(' SMITH  barns llc. '), 'smithbarnsllc');
  assert.ok(await readCode('smith barns llc', code, pub));
  // Typed in lower case with the dashes left out, and O typed for zero.
  assert.ok(await readCode('Smith Barns LLC', code.toLowerCase().replace(/-/g, ' ').replace(/0/g, 'o'), pub));
});

test('the wrong company name is turned away', async () => {
  assert.equal(await readCode('Jones Barns LLC', code, pub), null);
  assert.equal(await readCode('', code, pub), null);
});

test('a made-up code is turned away', async () => {
  assert.equal(await readCode('Smith Barns LLC', 'ABCD-EFGH-JKMN-PQRS', pub), null);
  assert.equal(await readCode('Smith Barns LLC', '', pub), null);
  // The right length and shape, with nothing behind it.
  assert.equal(await readCode('Smith Barns LLC', '2'.repeat(code.replace(/-/g, '').length), pub), null);
});

test('a code cannot be changed to run longer or to a different kind', async () => {
  const flat = code.replace(/-/g, '');
  // The end date sits in the first few characters.
  for (const at of [0, 1, 2, 3, 4]) {
    const swapped = flat.slice(0, at) + (flat[at] === '7' ? '8' : '7') + flat.slice(at + 1);
    assert.equal(await readCode('Smith Barns LLC', swapped, pub), null, `character ${at}`);
  }
});

test('a code signed with any other key does not pass the key the program ships with', async () => {
  assert.ok(PUBLIC_KEY.x && PUBLIC_KEY.y);
  assert.equal(await readCode('Smith Barns LLC', code), null);
});

test('the trial runs 30 days from the first day', () => {
  const start = Date.UTC(2026, 10, 13, 9);
  const first = tick(null, start);
  assert.deepEqual(first, { start, seen: start });
  assert.deepEqual(standing(first, null, start), { mode: 'trial', daysLeft: TRIAL_DAYS });
  // Day 30 of use is 29 days in: one day left.
  const late = tick(first, start + 29 * DAY);
  assert.deepEqual(standing(late, null, start + 29 * DAY), { mode: 'trial', daysLeft: 1 });
  const over = tick(first, start + 30 * DAY);
  assert.deepEqual(standing(over, null, start + 30 * DAY), { mode: 'locked', why: 'trial' });
});

test('setting the clock back does not win days back', () => {
  const start = Date.UTC(2026, 10, 13, 9);
  const over = tick(tick(null, start), start + 31 * DAY);
  // The device now claims it is day 2.
  const back = tick(over, start + DAY);
  assert.equal(back.seen, start + 31 * DAY);
  assert.equal(standing(back, null, start + DAY).mode, 'locked');
});

test('a license runs to its end date and then locks', async () => {
  const license = await readCode('Smith Barns LLC', code, pub);
  const trial = tick(null, Date.UTC(2026, 0, 1));
  // Noon on the last day: half a day left, shown as 1.
  const lastDay = Date.UTC(2027, 10, 13, 12);
  assert.deepEqual(standing(tick(trial, lastDay), license, lastDay), { mode: 'licensed', daysLeft: 1 });
  const after = Date.UTC(2027, 10, 14, 0, 1);
  assert.deepEqual(standing(tick(trial, after), license, after), { mode: 'locked', why: 'ended' });
});

test('a switched off license locks, and falls back to the trial while trial days remain', async () => {
  const license = { ...await readCode('Smith Barns LLC', code, pub), off: true };
  const start = Date.UTC(2026, 10, 13);
  const trial = { start, seen: start };
  assert.equal(standing(tick(trial, start + DAY), license, start + DAY).mode, 'trial');
  const later = start + 40 * DAY;
  assert.deepEqual(standing(tick(trial, later), license, later), { mode: 'locked', why: 'off' });
  assert.equal(standing(tick(trial, later), { ...license, off: false }, later).mode, 'licensed');
});

test('the name the server holds for a code is the same however the code is typed', async () => {
  const id = await codeId(code);
  assert.match(id, /^[0-9a-f]{24}$/);
  assert.equal(await codeId(code.toLowerCase().replace(/-/g, ' ')), id);
  assert.equal(await codeId('not a code'), null);
  const other = await signCode('Smith Barns LLC', 'paid', '2028-11-13', pair.privateKey);
  assert.notEqual(await codeId(other), id);
});

test('only a plain answer from the server switches a code off', async () => {
  const answer = (status, body, headers = {}) => async () => ({ status, headers: { get: (h) => headers[h] ?? null }, json: async () => JSON.parse(body) });
  let asked = '';
  assert.equal(await askSwitchedOff(code, '../check/', async (u) => { asked = u; return answer(200, '{"off":true}')(); }), true);
  assert.equal(asked, `../check/?id=${await codeId(code)}`);
  assert.equal(await askSwitchedOff(code, '../check/', answer(200, '{"off":false}')), false);
  // A "checking your browser" page, a server fault, a page that is not an answer, and no connection at all.
  assert.equal(await askSwitchedOff(code, '../check/', answer(202, '<html>', { 'sg-captcha': 'challenge' })), null);
  assert.equal(await askSwitchedOff(code, '../check/', answer(200, '{"off":true}', { 'sg-captcha': 'challenge' })), null);
  assert.equal(await askSwitchedOff(code, '../check/', answer(500, '{"off":true}')), null);
  assert.equal(await askSwitchedOff(code, '../check/', answer(200, '<html>')), null);
  assert.equal(await askSwitchedOff(code, '../check/', answer(200, '{"off":"yes"}')), null);
  assert.equal(await askSwitchedOff(code, '../check/', async () => { throw new Error('offline'); }), null);
});
