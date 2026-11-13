// The trial line in the top bar and the screen that asks for a license code.
// The checking itself is in engine/license.js; this file keeps the trial and
// the code on this device and puts the screen up.
import { tick, standing, readCode, askSwitchedOff, longDate, TRIAL_DAYS, TRIAL_WARN_DAYS, LICENSE_WARN_DAYS } from '../engine/license.js';
import { company } from './office.js';

const TRIAL = 'girt-and-purlin.trial.v1';
const LICENSE = 'girt-and-purlin.license.v1';
// Where the server says whether a code has been switched off.
const CHECK = '../check/';
const HOUR = 3600000;
const read = (key) => { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } };
const write = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage is off */ } };
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const days = (n) => `${n} ${n === 1 ? 'day' : 'days'}`;

let trial = null, license = null, now = null, hooks = {};

// "Licensed to Smith Barns LLC until November 13, 2027", for the My Jobs panel.
export const licenseLine = () => {
  if (now?.mode === 'licensed') return `Licensed to ${license.name} until ${longDate(license.expires)}.`;
  if (now?.mode === 'trial') return `Trial: ${days(now.daysLeft)} left of ${TRIAL_DAYS}.`;
  return '';
};

export async function startLock(given) {
  hooks = given;
  const kept = read(LICENSE);
  const good = kept ? await readCode(kept.name, kept.code) : null;
  license = good ? { ...good, name: kept.name, code: kept.code, off: !!kept.off } : null;
  document.querySelector('header .job').insertAdjacentHTML('afterbegin', '<button id="trial" class="trial" hidden></button>');
  document.getElementById('trial').addEventListener('click', () => show());
  check();
  askServer();
  // A tablet left open for weeks still comes to its last day.
  setInterval(() => { check(); askServer(); }, HOUR);
}

// A code switched off on the server locks the program the next time it is online, and one switched back on opens it again.
async function askServer() {
  if (!license) return;
  const off = await askSwitchedOff(license.code, CHECK);
  if (off === null || off === license.off) return;
  license.off = off;
  write(LICENSE, { name: license.name, code: license.code, off });
  check();
  if (!off) document.getElementById('lock')?.remove();
  hooks.onChange();
}

function check() {
  trial = tick(read(TRIAL), Date.now());
  write(TRIAL, trial);
  now = standing(trial, license, Date.now());
  const line = document.getElementById('trial');
  const text = now.mode === 'trial' ? `Trial: ${days(now.daysLeft)} left. Enter A Code`
    : now.mode === 'licensed' && now.daysLeft <= LICENSE_WARN_DAYS ? `License ends in ${days(now.daysLeft)}. Enter A New Code` : '';
  line.hidden = !text;
  line.textContent = text;
  line.classList.toggle('soon', now.mode === 'licensed' || now.daysLeft <= TRIAL_WARN_DAYS);
  if (now.mode === 'locked') show();
  for (const el of document.querySelectorAll('body > header, main, #proposal')) el.inert = now.mode === 'locked';
}

function show(bad = '') {
  const locked = now.mode === 'locked';
  const head = !locked ? 'Enter Your License Code' : now.why === 'off' ? 'This License Code Has Been Switched Off' : now.why === 'ended' ? 'Your License Has Ended' : `Your ${TRIAL_DAYS} Day Trial Has Ended`;
  const lead = locked && now.why === 'off' ? 'Your jobs are safe on this device. Email simon@simonbuilds.app about this code, or type in a new one.'
    : locked ? 'Your jobs are safe on this device. Type in your license code to keep working.'
    : now.mode === 'trial' ? `You have ${days(now.daysLeft)} left in your trial. A code keeps the program open after that.`
      : `Your license runs until ${longDate(license.expires)}. A new code takes over from the one you have.`;
  const old = document.getElementById('lock');
  const typed = old ? { name: old.querySelector('[name=company]').value, code: old.querySelector('[name=code]').value } : { name: license?.name ?? company.get().name, code: '' };
  old?.remove();
  if (locked) document.getElementById('proposal').hidden = true;
  document.body.insertAdjacentHTML('beforeend', `<div id="lock" class="lock"><form class="lockbox">
    <h1>${head}</h1>
    <p>${lead}</p>
    <label>Company Name<input name="company" value="${esc(typed.name)}" autocomplete="organization" spellcheck="false"></label>
    <label>License Code<textarea name="code" rows="4" spellcheck="false" autocapitalize="characters" autocomplete="off">${esc(typed.code)}</textarea></label>
    ${bad ? `<p class="bad">${esc(bad)}</p>` : ''}
    <div class="row"><button class="btn solid">Unlock</button>${locked ? '<button type="button" class="btn" data-lockjobs>Save My Jobs To A File</button>' : '<button type="button" class="btn" data-lockclose>Close</button>'}</div>
    <p class="fine">No code yet? Email simon@simonbuilds.app with your company name and how many people work for you, counting regular subcontractors.</p>
  </form></div>`);
  const box = document.getElementById('lock');
  box.querySelector('form').addEventListener('submit', enter);
  box.querySelector('[data-lockjobs]')?.addEventListener('click', () => hooks.saveJobs());
  box.querySelector('[data-lockclose]')?.addEventListener('click', () => box.remove());
  box.querySelector(typed.name ? '[name=code]' : '[name=company]').focus();
}

async function enter(e) {
  e.preventDefault();
  const name = e.target.company.value.trim(), code = e.target.code.value.trim();
  const got = await readCode(name, code);
  if (!got) return show('That code does not match this company name. Check both and try again.');
  if (Math.max(Date.now(), trial.seen) >= got.endsAt) return show(`That code ended on ${longDate(got.expires)}. Email simon@simonbuilds.app for a new one.`);
  if (await askSwitchedOff(code, CHECK)) return show('That code has been switched off. Email simon@simonbuilds.app about it.');
  license = { ...got, name, code, off: false };
  write(LICENSE, { name, code, off: false });
  document.getElementById('lock').remove();
  check();
  hooks.onChange();
}
