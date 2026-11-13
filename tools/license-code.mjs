#!/usr/bin/env node
// Makes license codes. The private key it signs with is kept in a folder
// outside this project and is never put in the project or on GitHub.
//
//   node tools/license-code.mjs "Smith Barns LLC" free
//   node tools/license-code.mjs "Smith Barns LLC" paid 2027-11-13
//   node tools/license-code.mjs list
//   node tools/license-code.mjs off "Smith Barns LLC"
//   node tools/license-code.mjs on "Smith Barns LLC"
//   node tools/license-code.mjs new-key
//
// With no end date the code runs one year from today. Every code made is
// written to codes-issued.csv beside the private key, and list shows that record.
//
// off switches every code made for a company off, and on switches them back on.
// The program learns of it the next time it is online. Which codes are off is
// kept in codes-switched-off.csv beside the private key, and only a short name
// for each one is sent to the server. server.json in the same folder says where:
//   { "ssh": "the ssh host", "file": "the path of the list on the server" }
import { readFileSync, writeFileSync, appendFileSync, existsSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { signCode, readCode, codeId, normalName, longDate } from '../engine/license.js';

const DIR = process.env.RIDGE_AND_RAFTER_KEYS || join(homedir(), 'Documents', 'ridge-and-rafter-keys');
const FILE = join(DIR, 'private-key.json');
const RECORD = join(DIR, 'codes-issued.csv');
const OFF = join(DIR, 'codes-switched-off.csv');
const SERVER = join(DIR, 'server.json');
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

// The rows of a record file, without its heading.
const rows = (file) => existsSync(file) ? readFileSync(file, 'utf8').trimEnd().split('\n').slice(1).filter(Boolean) : [];
const offIds = () => new Set(rows(OFF).map((r) => r.split(',').pop()));

if (first === 'list') {
  const off = offIds();
  const lines = [];
  for (const r of rows(RECORD)) lines.push(off.has(await codeId(r.split(',').pop())) ? `${r}  SWITCHED OFF` : r);
  console.log(lines.length ? `Issued,Company,Kind,Good Through,Code\n${lines.join('\n')}` : 'No codes have been made yet.');
  process.exit(0);
}

if (first === 'off' || first === 'on') {
  if (!kind) { console.error(`Use: node tools/license-code.mjs ${first} "Company Name"`); process.exit(1); }
  if (!existsSync(SERVER)) { console.error(`No server.json at ${SERVER}, so there is nowhere to send the list.`); process.exit(1); }
  const mine = [];
  for (const r of rows(RECORD)) {
    const m = r.match(/^[^,]*,"((?:[^"]|"")*)",[^,]*,([^,]*),(.*)$/);
    if (m && normalName(m[1].replace(/""/g, '"')) === normalName(kind)) mine.push({ id: await codeId(m[3]), until: m[2] });
  }
  if (!mine.length) { console.error(`No code in ${RECORD} was made for "${kind}". The name has to match the one the code was made for.`); process.exit(1); }
  const today = new Date().toISOString().slice(0, 10);
  const ids = new Set(mine.map((c) => c.id));
  const kept = rows(OFF).filter((r) => !ids.has(r.split(',').pop()));
  if (first === 'off') for (const c of mine) kept.push(`${today},"${kind.replace(/"/g, '""')}",${c.id}`);
  const { ssh, file } = JSON.parse(readFileSync(SERVER, 'utf8'));
  // The server gets the whole list each time, so it always matches this record. It goes up first: if that fails, nothing here changes.
  execFileSync('ssh', [ssh, `cat > '${file}.new' && mv '${file}.new' '${file}'`], { input: kept.map((r) => r.split(',').pop()).join('\n') + '\n', stdio: ['pipe', 'inherit', 'inherit'] });
  writeFileSync(OFF, `Switched Off,Company,Code Name\n${kept.map((r) => r + '\n').join('')}`, { mode: 0o600 });
  console.log(`${mine.length} ${mine.length === 1 ? 'code' : 'codes'} for ${kind} switched ${first}. ${first === 'off' ? 'Each device locks the next time it is online.' : 'Each device opens again the next time it is online.'}`);
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
if (!existsSync(RECORD)) writeFileSync(RECORD, 'Issued,Company,Kind,Good Through,Code\n', { mode: 0o600 });
appendFileSync(RECORD, `${new Date().toISOString().slice(0, 10)},"${first.replace(/"/g, '""')}",${kind},${expires},${code}\n`);
console.log(`Company:  ${first}\nKind:     ${kind}\nGood through: ${longDate(expires)}\n\n${code}\n\nWritten to ${RECORD}`);
