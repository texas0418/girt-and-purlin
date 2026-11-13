#!/usr/bin/env node
// Makes license codes. The private key it signs with is kept in a folder
// outside this project and is never put in the project or on GitHub.
//
//   node tools/license-code.mjs "Smith Barns LLC" free
//   node tools/license-code.mjs "Smith Barns LLC" paid 2027-11-13
//   node tools/license-code.mjs new-key
//
// With no end date the code runs one year from today.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { signCode, readCode, longDate } from '../engine/license.js';

const DIR = process.env.GIRT_AND_PURLIN_KEYS || join(homedir(), 'Documents', 'girt-and-purlin-keys');
const FILE = join(DIR, 'private-key.json');
const ECDSA = { name: 'ECDSA', namedCurve: 'P-256' };
const [first, kind = '', date] = process.argv.slice(2);

if (first === 'new-key') {
  if (existsSync(FILE)) { console.error(`A key is already at ${FILE}. Making a new one would end every code made so far, so nothing was changed.`); process.exit(1); }
  const pair = await crypto.subtle.generateKey(ECDSA, true, ['sign', 'verify']);
  mkdirSync(DIR, { recursive: true, mode: 0o700 });
  writeFileSync(FILE, JSON.stringify(await crypto.subtle.exportKey('jwk', pair.privateKey)), { mode: 0o600 });
  const { x, y } = await crypto.subtle.exportKey('jwk', pair.publicKey);
  console.log(`Private key saved to ${FILE}\nPublic key for engine/license.js:\nexport const PUBLIC_KEY = { kty: 'EC', crv: 'P-256', x: '${x}', y: '${y}' };`);
  process.exit(0);
}

if (!first || !['free', 'paid'].includes(kind)) { console.error('Use: node tools/license-code.mjs "Company Name" free|paid [YYYY-MM-DD]'); process.exit(1); }
if (!existsSync(FILE)) { console.error(`No private key at ${FILE}.`); process.exit(1); }

const nextYear = new Date();
nextYear.setFullYear(nextYear.getFullYear() + 1);
const expires = date || nextYear.toISOString().slice(0, 10);
const key = await crypto.subtle.importKey('jwk', JSON.parse(readFileSync(FILE, 'utf8')), ECDSA, false, ['sign']);
const code = await signCode(first, kind, expires, key);
// Checked against the public key the program ships with, so a code that would not unlock is never handed out.
if (!await readCode(first, code)) { console.error('This code does not pass the public key in engine/license.js, so the program would turn it away. The key file and the program do not match.'); process.exit(1); }
console.log(`Company:  ${first}\nKind:     ${kind}\nGood through: ${longDate(expires)}\n\n${code}\n`);
