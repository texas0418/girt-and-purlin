// The 30 day trial and the license code that follows it. A code is made for one
// company name and one end date and is signed with a key that never leaves the
// licensor's own computer. The program holds only the matching public key, so
// it can check a code with no connection and cannot make one.

export const TRIAL_DAYS = 30;
// A license warns this many days before it ends, and the trial turns orange this close to its end.
export const LICENSE_WARN_DAYS = 30;
export const TRIAL_WARN_DAYS = 5;
const DAY = 86400000;
// End dates are stored as whole days counted from here.
const EPOCH = Date.UTC(2020, 0, 1);
const KINDS = { 1: 'free', 2: 'paid' };
// 32 characters with no I, L, O or U, so a code read aloud or typed by hand is not misread.
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
// Kind, two bytes of end date, then a 64 byte signature.
const CODE_BYTES = 67;
const CODE_CHARS = Math.ceil(CODE_BYTES * 8 / 5);

export const PUBLIC_KEY = { kty: 'EC', crv: 'P-256', x: 'NqyW9Lz8ibWmHLxdN8QvHhPzoSQfhs3wF0nSpl2GcqI', y: 'ep2haMeKg-RIcEwomCwBKL8mIuEXdhK7A_RhK4guK6I' };

// "Smith Barns, LLC" and "smith barns llc" are the same company.
export const normalName = (name) => String(name ?? '').normalize('NFKD').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');

function toBase32(bytes) {
  let out = '', bits = 0, hold = 0;
  for (const b of bytes) {
    hold = (hold << 8) | b; bits += 8;
    while (bits >= 5) { out += ALPHABET[(hold >> (bits - 5)) & 31]; bits -= 5; }
  }
  return bits ? out + ALPHABET[(hold << (5 - bits)) & 31] : out;
}

function fromBase32(text) {
  const clean = String(text ?? '').toUpperCase().replace(/[IL]/g, '1').replace(/O/g, '0').replace(/[^0-9A-Z]/g, '');
  if (clean.length !== CODE_CHARS) return null;
  const out = [];
  let bits = 0, hold = 0;
  for (const c of clean) {
    const v = ALPHABET.indexOf(c);
    if (v < 0) return null;
    hold = ((hold << 5) | v) & 0xfff; bits += 5;
    if (bits >= 8) { out.push((hold >> (bits - 8)) & 255); bits -= 8; }
  }
  return Uint8Array.from(out);
}

const signedText = (name, kind, day) => new TextEncoder().encode(`girt-and-purlin license 1|${kind}|${day}|${normalName(name)}`);
const ECDSA = { name: 'ECDSA', namedCurve: 'P-256' }, HASH = { name: 'ECDSA', hash: 'SHA-256' };

// Makes a code. Only the code tool calls this, with the private key.
export async function signCode(name, kind, expires, privateKey) {
  const k = Number(Object.keys(KINDS).find((key) => KINDS[key] === kind));
  const day = Math.round((Date.parse(`${expires}T00:00:00Z`) - EPOCH) / DAY);
  if (!k) throw new Error('The kind is free or paid.');
  if (!normalName(name)) throw new Error('The company name is empty.');
  if (!(day > 0 && day < 65536)) throw new Error('The end date reads as YYYY-MM-DD.');
  const sig = new Uint8Array(await crypto.subtle.sign(HASH, privateKey, signedText(name, k, day)));
  return toBase32([k, day >> 8, day & 255, ...sig]).match(/.{1,6}/g).join('-');
}

// Checks a code against a company name. Gives back what it grants, or null when the two do not match.
export async function readCode(name, code, key = PUBLIC_KEY) {
  const bytes = fromBase32(code);
  if (!bytes || bytes.length !== CODE_BYTES || !KINDS[bytes[0]] || !normalName(name)) return null;
  const day = bytes[1] * 256 + bytes[2];
  try {
    const pub = await crypto.subtle.importKey('jwk', key, ECDSA, false, ['verify']);
    if (!await crypto.subtle.verify(HASH, pub, bytes.slice(3), signedText(name, bytes[0], day))) return null;
  } catch { return null; }
  // Good through the last minute of the end date.
  return { kind: KINDS[bytes[0]], expires: new Date(EPOCH + day * DAY).toISOString().slice(0, 10), endsAt: EPOCH + (day + 1) * DAY };
}

// The trial record to keep: when it started and the latest time this device has
// shown. Setting the device clock back does not win days back.
export function tick(trial, now) {
  const start = trial?.start > 0 ? trial.start : now;
  return { start, seen: Math.max(trial?.seen ?? 0, now, start) };
}

// Where a device stands: licensed, in its trial, or locked.
export function standing(trial, license, now) {
  const clock = Math.max(now, trial.seen);
  if (license && clock < license.endsAt) return { mode: 'licensed', daysLeft: Math.ceil((license.endsAt - clock) / DAY) };
  const daysLeft = TRIAL_DAYS - Math.floor((clock - trial.start) / DAY);
  if (daysLeft > 0) return { mode: 'trial', daysLeft };
  return { mode: 'locked', why: license ? 'ended' : 'trial' };
}

// 2027-11-13 reads as November 13, 2027.
export const longDate = (iso) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
