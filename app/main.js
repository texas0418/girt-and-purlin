import { design } from '../engine/design.js';
import { feetInches } from '../engine/stock.js';
import { dxf } from '../engine/dxf.js';
import { edgeOverhangIn, eaveDropIn } from '../engine/building.js';
import { priceJob, parsePriceList, priceListCsv, toCsv, SAMPLE_CATALOG } from '../engine/pricing.js';
import { createView } from './scene.js';
import { jobs, templates, company, priceLists, newId, designOf, STARTING_POINTS } from './office.js';
import { floorPlan } from './plan.js';
import { drawing, sheetList } from './drawings.js';

const STORE = 'girt-and-purlin.job.v1';
const PRICE_STORE = 'girt-and-purlin.prices.v1';
const STEPS = ['Jobs', 'Size', 'Roof', 'Doors And Windows', 'Lean-Tos And Porches', 'Inside And Finish', 'Colors', 'Price', 'Drawings'];
const VIEWS = [['finished', 'Finished'], ['framing', 'Framing'], ['plan', 'Floor Plan']];
const WALL_NAMES = { front: 'Front', back: 'Back', left: 'Left End', right: 'Right End' };
const TYPE_NAMES = { slider: 'Sliding Door', overhead: 'Overhead Door', walk: 'Walk Door', window: 'Window' };
const NEW_OPENING = {
  slider: { width: 12, height: 10 },
  overhead: { width: 10, height: 10 },
  walk: { width: 3, height: 6 + 8 / 12 },
  window: { width: 4, height: 3.5, sill: 3 },
};

const FIELDS = {
  width: { label: 'Width', unit: 'ft', step: 1 },
  length: { label: 'Length', unit: 'ft', step: 1 },
  eaveHeight: { label: 'Wall Height', unit: 'ft', step: 1 },
  pitch: { label: 'Roof Pitch', unit: '/12', step: 1 },
  overhang: { label: 'Overhang', unit: 'in', step: 6 },
};
const PRICE_FIELDS = {
  markupPct: { label: 'Markup', unit: '%', step: 1 },
  taxPct: { label: 'Sales Tax', unit: '%', step: 0.25 },
  laborPerSqFt: { label: 'Labor', unit: '$/sq ft', step: 0.25 },
};
const SHED_NAMES = { leanto: 'Lean-To', porch: 'Porch' };
const NEW_SHED = { leanto: { depth: 12, pitch: 3, drop: 0, enclosed: false }, porch: { depth: 8, pitch: 3, drop: 0, enclosed: false } };
const SHED_FIELDS = {
  depth: { label: 'Depth', step: 1, min: 4 },
  length: { label: 'Length', step: 1, min: 4 },
  start: { label: 'Starts At', step: 1, min: 0 },
  pitch: { label: 'Roof Pitch', step: 1, min: 1 },
  drop: { label: 'Below Main Eave', step: 0.5, min: 0 },
};
// Finish choices. Each row is a title, the key in state.options, and the values with their button names.
const OPTION_SETS = {
  wainscotIn: ['Wainscot Height', [[36, '3 ft'], [48, '4 ft']]],
  linerWalls: ['Wall Liner', [[false, 'None'], [true, 'Steel Liner']]],
  linerCeiling: ['Ceiling Liner', [[false, 'None'], [true, 'Steel Liner']]],
  roofInsulation: ['Roof Insulation', [['none', 'None'], ['bubble', 'Bubble'], ['fiberglass', 'Fiberglass']]],
  wallInsulation: ['Wall Insulation', [['none', 'None'], ['wrap', 'House Wrap'], ['bubble', 'Bubble'], ['fiberglass', 'Fiberglass']]],
  ceilingR: ['Blown Ceiling Insulation', [[0, 'None'], [19, 'R-19'], [30, 'R-30'], [38, 'R-38'], [49, 'R-49'], [60, 'R-60']]],
  footing: ['Under Each Post', [['none', 'Not Listed'], ['pad', 'Concrete Pad'], ['collar', 'Poured Collar'], ['bracket', 'Bolt-Down Bracket']]],
  slab: ['Concrete Floor', [[false, 'None'], [true, '4 in Slab']]],
  ridgeVent: ['Ridge Vent', [[false, 'None'], [true, 'Vented Ridge']]],
  cupolas: ['Cupolas', [[false, 'None'], [true, 'On The Ridge']]],
  cupolaSizeIn: ['Cupola Size', [[0, 'Sized To The Roof'], [24, '24 in'], [36, '36 in'], [48, '48 in']]],
};
const ROOF_NAMES = { gable: 'Gable', mono: 'Single Slope', gambrel: 'Gambrel' };
const roofOf = () => state.roof ?? 'gable';
const OPTION_DEFAULTS = { wainscotIn: 36, linerWalls: false, linerCeiling: false, roofInsulation: 'none', wallInsulation: 'none', ceilingR: 0, footing: 'none', slab: false, ridgeVent: false, skylights: 0, cupolas: false, cupolaSizeIn: 0 };
const WALL_FIELDS = {
  at: { label: 'From Left End', other: 'From Front Wall', step: 1, min: 2 },
  start: { label: 'Starts At', step: 1, min: 0 },
  length: { label: 'Length', step: 1, min: 2 },
  doors: { label: 'Doors', step: 1, min: 0 },
};
const LOFT_FIELDS = { depth: { label: 'Depth', step: 1, min: 6 }, height: { label: 'Floor Height', step: 0.5, min: 7 } };
const OPENING_FIELDS = {
  offset: { label: 'Position', step: 0.5 },
  width: { label: 'Width', step: 0.5 },
  height: { label: 'Height', step: 0.5 },
  sill: { label: 'Sill Height', step: 0.5 },
};

// Sample colors only. Real supplier color charts arrive with the catalogs.
const PALETTE = [
  ['Ash Gray', '#8b908d'], ['Charcoal', '#2f3336'], ['White', '#e6e6e0'], ['Light Stone', '#c2b8a3'], ['Tan', '#a8946f'],
  ['Barn Red', '#7a2a22'], ['Forest Green', '#2e4a3a'], ['Ocean Blue', '#2f4d66'], ['Brown', '#4a392e'], ['Black', '#1b1c1e'],
];
const COLOR_PARTS = [['walls', 'Walls'], ['roof', 'Roof'], ['trim', 'Trim'], ['wainscot', 'Wainscot']];

const SAMPLE = {
  job: 'Sample Job, Machine Shed',
  width: 30, length: 48, eaveHeight: 12, pitch: 4, overhang: 12, postSpacing: 8, trussSpacing: 4,
  openings: [
    { type: 'slider', wall: 'front', offset: 18, width: 12, height: 10 },
    { type: 'walk', wall: 'front', offset: 5, width: 3, height: 6 + 8 / 12 },
    { type: 'window', wall: 'front', offset: 34, width: 4, height: 3.5, sill: 3 },
    { type: 'window', wall: 'front', offset: 41, width: 4, height: 3.5, sill: 3 },
  ],
  sheds: [],
  partitions: [],
  loft: null,
  options: {},
  colors: { walls: '#8b908d', roof: '#2f3336', trim: '#e6e6e0', wainscot: '#2f3336', wainscotOn: true, gutters: false, truck: false },
  pricing: { markupPct: 0, taxPct: 0, laborPerSqFt: 0 },
};

const $ = (id) => document.getElementById(id);
const money = (n) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// A customer link carries the whole job after the # sign. Opening one shows a look-only page.
const shared = readShare();
let state = load();
let result = design(state);
// A saved job the engine turns away is not opened; the sample shows instead and the reason is given.
let unopened = '';
if (!result.ok) { unopened = result.errors[0]; state = structuredClone(SAMPLE); result = design(state); }
const shelve = () => jobs.put({ id: state.id, name: state.job, savedAt: Date.now(), size: `${state.width} x ${state.length} x ${state.eaveHeight}`, job: state });
if (!state.id) { state.id = newId(); if (!shared) { try { localStorage.setItem(STORE, JSON.stringify(state)); } catch { /* storage is off */ } shelve(); } }
let catalog = loadPrices();
if (!shared && !catalog.sample && !priceLists.all().some((l) => l.supplier === catalog.supplier)) priceLists.put(catalog);
let priced = priceJob(result, catalog, state.pricing);
const ui = { delta: 0, notice: '', step: 'Size', view: 'finished', sheet: 'front', sel: null, opening: null, shed: null, part: null, placing: null, jobrow: null, tplrow: null, confirm: null, changed: new Set(), last: '', problem: '', savedAt: null };
if (unopened) { ui.lead = 'Your saved job could not be opened.'; ui.problem = `${unopened} The sample building is showing instead.`; }
const view = createView($('view'), $('stage'));

function readShare() {
  // &embed after the job shows the picture alone, for the front page of the site.
  const packed = location.hash.match(/^#q=([^&]+)(&embed)?$/);
  if (!packed) return null;
  try {
    const bytes = Uint8Array.from(atob(packed[1].replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
    const job = JSON.parse(new TextDecoder().decode(bytes));
    return job && job.width && job.price ? { ...job, embed: !!packed[2] } : null;
  } catch { return null; }
}

function shareLink() {
  const { pricing, id, alts, alt, ...job } = state;
  const price = { lines: priceLines(priced), total: priced.total };
  const bytes = new TextEncoder().encode(JSON.stringify({ ...job, price }));
  const packed = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${location.origin}${location.pathname}#q=${packed}`;
}

function load() {
  if (shared) { const { price, ...job } = shared; return { ...structuredClone(SAMPLE), ...job }; }
  try {
    const saved = JSON.parse(localStorage.getItem(STORE));
    if (saved && saved.width) return { ...structuredClone(SAMPLE), ...saved };
  } catch { /* nothing saved, or storage is off */ }
  return structuredClone(SAMPLE);
}

function loadPrices() {
  try {
    const saved = JSON.parse(localStorage.getItem(PRICE_STORE));
    if (saved && saved.rows?.length) return saved;
  } catch { /* nothing saved, or storage is off */ }
  return SAMPLE_CATALOG;
}

function setPrices(next) {
  catalog = next;
  try {
    if (next.sample) localStorage.removeItem(PRICE_STORE); else localStorage.setItem(PRICE_STORE, JSON.stringify(next));
  } catch { /* storage is off; the list still works until the page closes */ }
  const was = priced.total;
  priced = priceJob(result, catalog, state.pricing);
  ui.changed = new Set();
  ui.last = `Price list now ${catalog.supplier}`;
  ui.delta = priced.total - was;
  paint();
}

function download(name, text, type = 'text/csv') {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

function save() {
  if (shared) return;
  try { localStorage.setItem(STORE, JSON.stringify(state)); ui.savedAt = new Date(); } catch { ui.savedAt = null; }
  shelve();
}

// The lines a customer sees under the price, in the order they add up.
const priceLines = (p) => [['Building Package', p.materials + p.markup], ['Freight And Delivery', p.freight],
  ...p.extraLines.map((e) => [e.name, e.amount]), ['Labor', p.labor], ['Sales Tax', p.tax]].filter(([, v], i) => i === 0 || v > 0);

// Swaps the whole job for another one: a saved job, a copy, or a template.
function openJob(job, note) {
  const next = { ...structuredClone(SAMPLE), ...structuredClone(job) };
  const tried = design(next);
  if (!tried.ok) { ui.lead = 'That one could not be opened.'; ui.problem = tried.errors[0]; return paint(); }
  state = next;
  result = tried;
  priced = priceJob(result, catalog, state.pricing);
  Object.assign(ui, { changed: new Set(), last: note, delta: 0, problem: '', lead: '', opening: null, shed: null, placing: null, jobrow: null, tplrow: null, confirm: null });
  $('job').value = state.job;
  save();
  view.update(result, state.colors);
  paint();
}

const startFrom = (name, design_) => openJob({ ...design_, id: newId(), job: name, pricing: state.pricing }, `Started from ${name}`);

// Customer options: each is its own version of the building. The one showing
// lives in the job itself; the rest wait in state.alts.
const ALT_NAMES = ['Good', 'Better', 'Best', 'Option 4'];

function eachAlt(fn) {
  const keep = [state, result, priced];
  const out = keep[0].alts.map((a, i) => {
    [state, result, priced] = keep;
    if (i !== keep[0].alt) {
      const other = { ...keep[0], ...structuredClone(a.snap) }, tried = design(other);
      if (!tried.ok) return null;
      state = other; result = tried; priced = priceJob(result, catalog, state.pricing);
    }
    return fn(a, i);
  });
  [state, result, priced] = keep;
  return out;
}

function showAlt(i) {
  const alts = state.alts.map((a, k) => (k === state.alt ? { ...a, snap: designOf(state) } : a));
  openJob({ ...state, ...structuredClone(alts[i].snap), alts, alt: i }, `Now showing ${alts[i].name}`);
}

const lineKey = (i) => [i.group, i.name, i.size, i.length].join('|');

// Every change goes through here. A change the engine rejects is not applied.
function apply(change, note) {
  const next = { ...state, ...change };
  const tried = design(next);
  if (!tried.ok) {
    ui.lead = '';
    ui.problem = tried.errors[0];
    return paint();
  }
  const before = new Map(result.items.map((i) => [lineKey(i), i.qty]));
  ui.changed = new Set(tried.items.filter((i) => before.get(lineKey(i)) !== i.qty).map(lineKey));
  ui.problem = '';
  ui.lead = '';
  ui.last = note;
  state = next;
  result = tried;
  const was = priced.total;
  priced = priceJob(result, catalog, state.pricing);
  ui.delta = priced.total - was;
  save();
  view.update(result, state.colors);
  paint();
}

function setOpening(index, change, note) {
  apply({ openings: state.openings.map((o, i) => (i === index ? { ...o, ...change } : o)) }, note);
}

function setShed(index, change, note) {
  apply({ sheds: state.sheds.map((s, i) => (i === index ? { ...s, ...change } : s)) }, note);
}

const walls = () => state.partitions ?? [];
function setPart(index, change, note) {
  apply({ partitions: walls().map((p, i) => (i === index ? { ...p, ...change } : p)) }, note);
}
// A new interior wall, or one turned the other way, fills the open floor beside any loft.
function wallAcross(axis) {
  const f = state.loft, open0 = f?.end === 'left' ? f.depth : 0, open1 = state.length - (f?.end === 'right' ? f.depth : 0);
  return axis === 'across'
    ? { axis, at: Math.round((open0 + open1) / 2), start: 0, length: state.width }
    : { axis, at: Math.round(state.width / 2), start: open0, length: open1 - open0 };
}

const num = (v) => (Number.isInteger(v) ? String(v) : feetInches(v * 12));

function stepper(attrs, label, value, unit, selected) {
  const long = value.length > 4;
  return `<div class="dim${selected ? ' sel' : ''}"><label>${label}</label><div class="step">
    <button ${attrs} data-dir="-1" aria-label="Less ${label}">&lsaquo;</button>
    <output class="${long ? 'long' : ''}">${value}${unit && !long ? `<small>${unit}</small>` : ''}</output>
    <button ${attrs} data-dir="1" aria-label="More ${label}">&rsaquo;</button></div></div>`;
}

const opt = (key) => state.options[key] ?? OPTION_DEFAULTS[key];
const optName = (key) => OPTION_SETS[key][1].find(([v]) => v === opt(key))[1];
const optionRow = (key, stack) => `<h2>${OPTION_SETS[key][0]}</h2><div class="seg${stack ? ' stack' : ''}">${OPTION_SETS[key][1].map(([v, name]) =>
  `<button data-opt="${key}" data-val='${JSON.stringify(v)}' class="${opt(key) === v ? 'on' : ''}">${name}</button>`).join('')}</div>`;

const field = (key) => stepper(`data-field="${key}"`, FIELDS[key].label, String(state[key]), FIELDS[key].unit, ui.sel === key);
const choice = (key, options, unit) => `<div class="seg">${options.map((v) =>
  `<button data-choice="${key}" data-value="${v}" class="${state[key] === v ? 'on' : ''}">${v} ${unit}</button>`).join('')}</div>`;

const textIn = (attrs, label, value, hint) => `<label class="lab">${label}<input class="in" ${attrs} value="${esc(value)}" placeholder="${hint}" spellcheck="false"></label>`;

function jobsPanel() {
  const when = (t) => new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const rows = jobs.all().map((j) => {
    const here = j.id === state.id;
    const head = `<button data-jobrow="${j.id}"><span>${esc(j.name)}<small>${esc(j.size)} ft, ${here ? 'open now' : `saved ${when(j.savedAt)}`}</small></span></button>`;
    if (ui.jobrow !== j.id || here) return `<div class="op${here ? ' here' : ''}">${head}</div>`;
    return `<div class="op open">${head}<div class="seg"><button data-jobopen="${j.id}">Open</button><button data-jobdel="${j.id}">${ui.confirm === j.id ? 'Press Again To Delete' : 'Delete'}</button></div></div>`;
  }).join('');
  const mine = templates.all().map((t, i) => {
    const head = `<button data-tplrow="${i}"><span>${esc(t.name)}<small>${t.design.width} x ${t.design.length} x ${t.design.eaveHeight} ft</small></span></button>`;
    if (ui.tplrow !== i) return `<div class="op">${head}</div>`;
    return `<div class="op open">${head}<div class="seg"><button data-tplstart="${i}">Start A Job</button><button data-tpldel="${i}">Delete</button></div></div>`;
  }).join('');
  const co = company.get();
  return `<h2>My Jobs</h2>${rows || '<p class="hint">Nothing saved yet.</p>'}
    <div class="seg"><button data-jobcopy>Copy This Job</button></div>
    <p class="hint">Every job saves itself on this device as you work. Nothing is sent anywhere.</p>
    <h2>Start A New Job From</h2>
    <div class="seg stack">${STARTING_POINTS.map((t, i) => `<button data-start="${i}">${t.name}</button>`).join('')}</div>
    <h2>My Templates</h2>${mine || '<p class="hint">Buildings you sell often can be kept here.</p>'}
    <div class="seg"><button data-tplsave>Save This Building As A Template</button></div>
    <h2>Your Company</h2>
    ${textIn('data-company="name"', 'Company Name', co.name, 'Your company name')}
    ${textIn('data-company="contact"', 'Address, Phone And Email', co.contact, 'One line')}
    <label class="lab">Proposal Terms<textarea class="in" data-company="terms" rows="4" placeholder="Payment schedule and how long the price holds">${esc(co.terms)}</textarea></label>
    <p class="hint">These head every proposal and printed sheet.</p>`;
}

function leftPanel() {
  if (ui.step === 'Jobs') return jobsPanel();
  if (ui.step === 'Size') {
    return `<h2>Building Size</h2>${['width', 'length', 'eaveHeight', ...(roofOf() === 'gambrel' ? [] : ['pitch']), 'overhang'].map(field).join('')}
      <h2>Post Spacing</h2>${choice('postSpacing', [6, 8, 10, 12], 'ft')}
      <h2>Truss Spacing</h2>${choice('trussSpacing', [2, 4, 8], 'ft')}
      <p class="hint">Drag the picture to look around the building. Scroll or pinch to move closer. The material list follows every change.</p>`;
  }
  if (ui.step === 'Roof') {
    const shape = roofOf();
    const about = {
      gable: 'A gable has two equal slopes that meet at a ridge down the middle.',
      mono: 'A single slope is low along the front wall and high along the back. The wall height on the Size step is the low wall.',
      gambrel: `A gambrel is the classic barn roof: a steep lower slope, then a flatter one up to the ridge. Its slopes are fixed at ${result.rules.gambrelLowerPitch} in 12 and ${result.rules.gambrelUpperPitch} in 12, and the steep part stops at the wall line with no side overhang.`,
    }[shape];
    return `<h2>Roof Shape</h2>
      <div class="seg">${Object.entries(ROOF_NAMES).map(([k, name]) => `<button data-roof="${k}" class="${shape === k ? 'on' : ''}">${name}</button>`).join('')}</div>
      <p class="hint">${about}</p>
      <h2>Roof</h2>${(shape === 'gambrel' ? ['overhang'] : ['pitch', 'overhang']).map(field).join('')}
      <h2>Truss Spacing</h2>${choice('trussSpacing', [2, 4, 8], 'ft')}
      ${shape === 'mono' ? '' : `${optionRow('cupolas')}${opt('cupolas') ? optionRow('cupolaSizeIn', true) : ''}
      <p class="hint">Cupolas sit on the ridge. Sized to the roof means one or two, by the length of the ridge. They are priced as bought units.</p>`}
      <p class="hint">Lean-tos and porches are on their own step.</p>`;
  }
  if (ui.step === 'Doors And Windows') {
    const rows = state.openings.map((o, i) => {
      const from = o.wall === 'front' || o.wall === 'back' ? 'from the left end' : 'from the front';
      const head = `<button data-open="${i}"><span>${TYPE_NAMES[o.type]}<small>${WALL_NAMES[o.wall]} wall, ${feetInches(o.offset * 12)} ${from}</small></span><em>${num(o.width)} x ${num(o.height)}</em></button>`;
      if (ui.opening !== i) return `<div class="op">${head}</div>`;
      const keys = o.type === 'window' ? ['offset', 'width', 'height', 'sill'] : ['offset', 'width', 'height'];
      return `<div class="op open">${head}
        <div class="seg">${Object.entries(WALL_NAMES).map(([w, name]) =>
          `<button data-wall="${w}" class="${o.wall === w ? 'on' : ''}">${name.replace(' End', '')}</button>`).join('')}</div>
        ${keys.map((k) => stepper(`data-opfield="${k}"`, OPENING_FIELDS[k].label, feetInches(o[k] * 12), '', false)).join('')}
        <button class="btn remove" data-remove="${i}">Remove</button></div>`;
    }).join('');
    return `<h2>Add One</h2>
      <div class="seg stack">${Object.entries(TYPE_NAMES).map(([t, name]) =>
        `<button data-place="${t}" class="${ui.placing === t ? 'on' : ''}">${name}</button>`).join('')}</div>
      <p class="hint${ui.placing ? ' go' : ''}">${ui.placing
        ? `Now click a wall in the picture where the ${TYPE_NAMES[ui.placing].toLowerCase()} goes.`
        : 'Pick a type, then click a wall in the picture to place it.'}</p>
      <h2>On This Building</h2>${rows || '<p class="hint">Nothing yet.</p>'}`;
  }
  if (ui.step === 'Lean-Tos And Porches') {
    const rows = state.sheds.map((s, i) => {
      const head = `<button data-shedopen="${i}"><span>${SHED_NAMES[s.kind]}<small>${WALL_NAMES[s.wall]} wall, ${s.kind === 'leanto' && s.enclosed ? 'enclosed' : 'open'}</small></span><em>${num(s.depth)} x ${num(s.length)}</em></button>`;
      if (ui.shed !== i) return `<div class="op">${head}</div>`;
      return `<div class="op open">${head}
        <div class="seg">${Object.entries(WALL_NAMES).map(([w, name]) =>
          `<button data-shedwall="${w}" class="${s.wall === w ? 'on' : ''}">${name.replace(' End', '')}</button>`).join('')}</div>
        ${Object.entries(SHED_FIELDS).map(([k, f]) => stepper(`data-shedfield="${k}"`, f.label, k === 'pitch' ? String(s[k]) : feetInches(s[k] * 12), k === 'pitch' ? '/12' : '', false)).join('')}
        ${s.kind === 'leanto' ? `<div class="seg"><button data-shedenc="0" class="${s.enclosed ? '' : 'on'}">Open Sides</button><button data-shedenc="1" class="${s.enclosed ? 'on' : ''}">Enclosed</button></div>` : ''}
        <button class="btn remove" data-shedremove="${i}">Remove</button></div>`;
    }).join('');
    return `<h2>Add One</h2>
      <div class="seg stack">${Object.entries(SHED_NAMES).map(([k, name]) => `<button data-shedadd="${k}">${name}</button>`).join('')}</div>
      <p class="hint">A lean-to or porch is a single-slope roof on one wall of the building, held up along its outer edge by its own row of posts. A lean-to can be closed in with walls. A porch stays open.</p>
      <h2>On This Building</h2>${rows || '<p class="hint">Nothing yet.</p>'}`;
  }
  if (ui.step === 'Inside And Finish') {
    const rows = walls().map((p, i) => {
      const head = `<button data-partopen="${i}"><span>Interior Wall ${i + 1}<small>${p.axis === 'across' ? 'Front to back' : 'End to end'}, ${p.doors} ${p.doors === 1 ? 'door' : 'doors'}, ${p.sheathed ? 'sheathed' : 'studs only'}</small></span><em>${num(p.length)} ft</em></button>`;
      if (ui.part !== i) return `<div class="op">${head}</div>`;
      return `<div class="op open">${head}
        <div class="seg"><button data-partaxis="across" class="${p.axis === 'across' ? 'on' : ''}">Front To Back</button><button data-partaxis="along" class="${p.axis === 'along' ? 'on' : ''}">End To End</button></div>
        ${Object.entries(WALL_FIELDS).map(([k, f]) => stepper(`data-partfield="${k}"`, k === 'at' && p.axis === 'along' ? f.other : k === 'start' ? (p.axis === 'across' ? 'Starts From Front' : 'Starts From Left') : f.label, k === 'doors' ? String(p.doors) : feetInches(p[k] * 12), '', false)).join('')}
        <div class="seg"><button data-partskin="1" class="${p.sheathed ? 'on' : ''}">Sheathed</button><button data-partskin="0" class="${p.sheathed ? '' : 'on'}">Studs Only</button></div>
        <button class="btn remove" data-partremove="${i}">Remove</button></div>`;
    }).join('');
    const f = state.loft;
    const loftPart = `<h2>Loft</h2><div class="seg">${[['', 'None'], ['left', 'Left End'], ['right', 'Right End']].map(([e, name]) =>
      `<button data-loftend="${e}" class="${(f?.end ?? '') === e ? 'on' : ''}">${name}</button>`).join('')}</div>
      ${f ? Object.entries(LOFT_FIELDS).map(([k, fd]) => stepper(`data-loftfield="${k}"`, fd.label, feetInches(f[k] * 12), '', false)).join('') : ''}
      <p class="hint">A loft is a floor across one end of the building, side wall to side wall, with a straight stair down along the front wall. The list adds its posts, beam, joists, subfloor, stair and guard rail. Its beam, posts and footings are sized by your engineer.</p>`;
    return `<h2>Interior Walls</h2>${rows}
      <div class="seg"><button data-partadd>Add An Interior Wall</button></div>
      <p class="hint">An interior wall is a stud wall from the floor to the underside of the trusses. It carries no roof. Each door is 3 ft wide. See the walls and loft in the Framing and Floor Plan views.</p>
      ${loftPart}
      ${optionRow('linerWalls')}${optionRow('linerCeiling')}
      <p class="hint">A steel liner is the bright panel on the inside of the walls or under the trusses. The list adds its panels, trim, screws and the framing it fastens to.</p>
      ${optionRow('roofInsulation')}${optionRow('wallInsulation', true)}${optionRow('ceilingR', true)}
      <p class="hint">Bubble is a thin foil roll that stops dripping under a steel roof. Blown insulation lies on top of a ceiling liner, so picking it turns the ceiling liner on.</p>
      ${optionRow('footing', true)}${optionRow('slab')}
      <p class="hint">The slab is counted at 4 in thick with a plastic sheet under it. No mesh, bar or thickened edge is counted. That is your concrete man's call. A bolt-down bracket stands each post on top of the concrete, so no wood goes in the ground and the posts are ordered 4 ft shorter. The concrete under the brackets has to be made for them, and a bracket does not hold a post upright the way a buried post holds itself. That is engineer work.</p>
      ${optionRow('ridgeVent')}
      <h2>Skylight Panels</h2>${stepper('data-optstep="skylights"', 'Clear Roof Panels', String(opt('skylights')), '', false)}
      <p class="hint">Each skylight panel takes the place of one steel roof panel, eave to ridge.</p>
      ${state.colors.wainscotOn ? optionRow('wainscotIn') : ''}
      <p class="hint">Wainscot and gutters are switched on the Colors step.</p>`;
  }
  if (ui.step === 'Colors') {
    const name = (hex) => PALETTE.find((p) => p[1] === hex)?.[0] ?? hex;
    return COLOR_PARTS.map(([part, title]) => `<h2>${title}</h2>
      <p class="picked">${name(state.colors[part])}</p>
      <div class="swatches">${PALETTE.map(([n, hex]) =>
        `<button data-color="${part}" data-hex="${hex}" title="${n}" aria-label="${title} ${n}" style="background:${hex}" class="${state.colors[part] === hex ? 'on' : ''}"></button>`).join('')}</div>
      ${part === 'wainscot' ? `<div class="seg"><button data-wainscot="1" class="${state.colors.wainscotOn ? 'on' : ''}">Wainscot On</button><button data-wainscot="0" class="${state.colors.wainscotOn ? '' : 'on'}">Wainscot Off</button></div>` : ''}`).join('')
      + '<h2>Extras</h2>' + [['gutters', 'Gutters'], ['truck', 'Pickup']].map(([key, title]) =>
        `<div class="seg"><button data-extra="${key}" data-on="1" class="${state.colors[key] ? 'on' : ''}">${title} On</button><button data-extra="${key}" data-on="0" class="${state.colors[key] ? '' : 'on'}">${title} Off</button></div>`).join('')
      + '<p class="hint">Gutters add the troughs, downspouts and hangers to the material list. The pickup is there for scale and is not in the list.</p>'
      + '<p class="hint">Sample colors. Each supplier\'s own color chart comes with its catalog.</p>';
  }
  if (ui.step === 'Price') {
    const row = (label, value, strong) => `<div class="sum${strong ? ' strong' : ''}"><span>${label}</span><span>${money(value)}</span></div>`;
    const lists = [SAMPLE_CATALOG, ...priceLists.all()];
    const listRows = lists.map((l, i) => {
      const on = l.supplier === catalog.supplier;
      return `<div class="op${on ? ' here' : ''}"><button data-list="${i}"><span>${esc(l.supplier)}<small>${l.rows.length} items${on ? ', in use' : ''}</small></span><em>${money(priceJob(result, l, state.pricing).total)}</em></button></div>`;
    }).join('');
    const extras = state.pricing.extras ?? [];
    const alts = state.alts ? eachAlt((a, i) => `<div class="op${i === state.alt ? ' open' : ''}"><button data-alt="${i}"><span>${esc(a.name)}<small>${i === state.alt ? 'Showing now' : 'Click to show'}</small></span><em>${money(priced.total)}</em></button>
      ${i === state.alt ? `${textIn(`data-altname="${i}"`, 'Name', a.name, 'Option name')}<button class="btn remove" data-altdel="${i}">Remove This Option</button>` : ''}</div>`).join('') : '';
    return `<h2>Price List</h2>
      ${listRows}
      ${catalog.sample ? '<p class="hint go">These are sample prices so the screen has something to add up. Load your own list before quoting a job.</p>' : ''}
      ${ui.notice ? `<p class="hint go">${esc(ui.notice)}</p>` : ''}
      <div class="seg"><button data-import>Load A Price List</button><button data-export>Save This List</button></div>
      ${catalog.sample ? '' : '<div class="seg"><button data-listdel>Remove The List In Use</button></div>'}
      <p class="hint">A price list is a spreadsheet saved as CSV with four columns: Item, Size, Unit and Price. Save This List gives you one to fill in. Load one for each yard you buy from and the figure beside each is this job at that yard's prices.</p>
      <h2>Your Numbers</h2>
      ${Object.entries(PRICE_FIELDS).map(([k, f]) => stepper(`data-price="${k}"`, f.label, String(state.pricing[k]), f.unit, false)).join('')}
      <h2>Freight And Extras</h2>
      <label class="lab">Freight Or Delivery, Dollars<input class="in" type="number" min="0" step="1" inputmode="decimal" data-num="freight" value="${state.pricing.freight || ''}" placeholder="0"></label>
      ${extras.map((e, i) => `<div class="pair"><input class="in" data-xname="${i}" value="${esc(e.name)}" placeholder="What it is" aria-label="Extra line name">
        <input class="in" type="number" min="0" step="1" inputmode="decimal" data-xamt="${i}" value="${e.amount || ''}" placeholder="0" aria-label="Extra line dollars">
        <button class="btn" data-xdel="${i}" aria-label="Remove this line">Remove</button></div>`).join('')}
      <div class="seg"><button data-xadd>Add A Line</button></div>
      <p class="hint">Flat dollar amounts, such as a permit or equipment rental. They are added after markup and sales tax is not figured on them.</p>
      <h2>This Job</h2>
      ${row('Materials', priced.materials)}${row('Markup', priced.markup)}${row('Sales Tax', priced.tax)}${row('Labor', priced.labor)}
      ${priced.freight ? row('Freight And Delivery', priced.freight) : ''}${priced.extraLines.map((e) => row(esc(e.name), e.amount)).join('')}${row('Total', priced.total, true)}
      ${priced.unpriced ? `<p class="hint go">${priced.unpriced} ${priced.unpriced === 1 ? 'line has' : 'lines have'} no price in this list and count as zero.</p>` : ''}
      <h2>Options For The Customer</h2>${alts}
      ${(state.alts?.length ?? 0) < ALT_NAMES.length ? `<div class="seg"><button data-altadd>${state.alts ? 'Add Another Option' : 'Offer Good, Better, Best'}</button></div>` : ''}
      <p class="hint">Each option is its own version of this building. Changes go to the one that is showing and the others stay as they are. The proposal prints them all with their totals.</p>`;
  }
  return `<h2>Drawings</h2>
    <div class="seg stack">${sheetList(result).map(([k, n]) => `<button data-sheet="${k}" class="${ui.sheet === k ? 'on' : ''}">${n}</button>`).join('')}</div>
    <p class="hint">Walls are drawn from outside the building. ${result.rules?.postEmbedmentIn === 0 ? 'The posts stand on brackets at floor level.' : 'Dashed lines show the part of each post in the ground.'}</p>
    <h2>Print</h2>
    <div class="seg stack"><button data-sheets="all">All Sheets</button><button data-sheets="cuts">Cut List Only</button><button data-checksheet>Delivery Check Sheet</button></div>
    <h2>For CAD</h2>
    <div class="seg stack"><button data-dxf>Save CAD File</button></div>
    <p class="hint">A DXF file with the floor plan and the four walls as plain lines. It opens in AutoCAD, DraftSight, LibreCAD, QCAD and most other drafting programs. One unit is one inch, so pick inches if the program asks.</p>
    <h2>For Your Engineer</h2>
    <div class="seg stack"><button data-engineer>Engineer Package</button></div>
    <p class="hint">Everything an engineer needs to start on this building: the size, the framing as drawn, where every post and opening sits, and the drawings. This program does not do the engineering.</p>`;
}

// The finish choices that are switched on, in plain words.
function finishRows() {
  const rows = [];
  const inside = result.geometry.partitions ?? [], loft = result.geometry.loft;
  if (inside.length) {
    const doors = inside.reduce((n, p) => n + p.doors.length, 0);
    rows.push(`${inside.length} interior ${inside.length === 1 ? 'wall' : 'walls'}, ${feetInches(inside.reduce((n, p) => n + p.lengthIn, 0))} in all${doors ? `, ${doors} ${doors === 1 ? 'door' : 'doors'}` : ''}`);
  }
  if (loft) rows.push(`Loft at the ${loft.end} end, ${feetInches(loft.depthIn)} deep, floor ${feetInches(loft.heightIn)} up, with a stair`);
  if (state.colors.wainscotOn) rows.push(`${optName('wainscotIn')} wainscot`);
  const cupolas = result.geometry.cupolas ?? [];
  if (cupolas.length) rows.push(`${cupolas.length === 1 ? 'One' : 'Two'} ${cupolas[0].sizeIn} in ${cupolas.length === 1 ? 'cupola' : 'cupolas'} on the ridge`);
  const liner = [opt('linerWalls') && 'walls', opt('linerCeiling') && 'ceiling'].filter(Boolean);
  if (liner.length) rows.push(`Steel liner on the ${liner.join(' and ')}`);
  if (opt('roofInsulation') !== 'none') rows.push(`${optName('roofInsulation')} insulation under the roof`);
  if (opt('wallInsulation') !== 'none') rows.push(opt('wallInsulation') === 'wrap' ? 'House wrap on the walls' : `${optName('wallInsulation')} insulation in the walls`);
  if (opt('ceilingR')) rows.push(`${optName('ceilingR')} blown insulation over the ceiling`);
  if (opt('footing') !== 'none') rows.push(`${optName('footing')} under each post`);
  if (opt('slab')) rows.push('4 in concrete floor');
  if (opt('ridgeVent')) rows.push('Vented ridge');
  if (opt('skylights')) rows.push(`${opt('skylights')} clear skylight ${opt('skylights') === 1 ? 'panel' : 'panels'}`);
  if (state.colors.gutters) rows.push('Gutters and downspouts');
  return rows;
}

function specRows() {
  const colorName = (hex) => PALETTE.find((c) => c[1] === hex)?.[0] ?? hex;
  const counts = {};
  for (const o of state.openings) {
    const k = `${TYPE_NAMES[o.type]}|${num(o.width)} x ${num(o.height)}`;
    counts[k] = (counts[k] ?? 0) + 1;
  }
  const openings = Object.entries(counts).map(([k, n]) => `${n} ${esc(k.replace('|', n > 1 ? 's, ' : ', '))}`).join('<br>');
  return [
    ['Size', `${state.width} ft wide, ${state.length} ft long, ${state.eaveHeight} ft walls`],
    ['Roof', `${ROOF_NAMES[roofOf()]}, ${roofOf() === 'gambrel' ? `${result.rules.gambrelLowerPitch} in 12 and ${result.rules.gambrelUpperPitch} in 12 slopes` : `${state.pitch} in 12 pitch`}, ${state.overhang} in overhang`],
    ['Frame', `Posts every ${state.postSpacing} ft, trusses every ${state.trussSpacing} ft`],
    ['Doors And Windows', openings || 'None'],
    ...(state.sheds.length ? [['Lean-Tos And Porches', state.sheds.map((s) => `${SHED_NAMES[s.kind]}, ${WALL_NAMES[s.wall].toLowerCase()} wall, ${num(s.depth)} x ${num(s.length)} ft${s.kind === 'leanto' && s.enclosed ? ', enclosed' : ''}`).join('<br>')]] : []),
    ...(finishRows().length ? [['Inside And Finish', finishRows().join('<br>')]] : []),
    ['Colors', `${colorName(state.colors.walls)} walls, ${colorName(state.colors.roof)} roof, ${colorName(state.colors.trim)} trim${state.colors.wainscotOn ? `, ${colorName(state.colors.wainscot)} wainscot` : ''}`],
  ];
}

function paintShared() {
  const p = shared.price;
  const lines = p.lines ?? [['Building Package', p.package], ['Labor', p.labor], ['Sales Tax', p.tax]].filter(([, v], i) => i === 0 || v > 0);
  document.body.classList.add('shared');
  document.body.classList.toggle('embed', shared.embed);
  document.title = `${state.job}, Girt And Purlin`;
  $('views').innerHTML = [VIEWS[0], VIEWS[2]].map(([k, n]) => `<button data-view="${k}" class="${ui.view === k ? 'on' : ''}">${n}</button>`).join('');
  $('readout').textContent = `${result.summary.floorSqFt.toLocaleString()} sq ft`;
  $('plan').hidden = ui.view !== 'plan';
  if (ui.view === 'plan') $('plan').innerHTML = floorPlan({ ...result, warnings: [] });
  $('total').innerHTML = `<small>${esc(state.job)}</small><strong>${money(Number(p.total) || 0)}</strong><em>Drag the picture to look around your building.</em>`;
  $('list').innerHTML = `<h2>Your Building</h2><dl class="spec">${specRows().map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>
    <h2>Price</h2>${lines.map(([k, v]) => `<div class="sum"><span>${esc(k)}</span><span>${money(Number(v) || 0)}</span></div>`).join('')}
    <div class="sum strong"><span>Total</span><span>${money(Number(p.total) || 0)}</span></div>`;
}

// Warnings the program can fix by itself come first; the rest are notes.
const firstWarning = () => result.warnings.find((w) => w.openingIndex !== undefined) || result.warnings[0];

function paint() {
  if (shared) return paintShared();
  $('nav').innerHTML = STEPS.map((s) => `<button data-nav="${s}" class="${ui.step === s ? 'on' : ''}">${s}</button>`).join('');
  $('views').innerHTML = VIEWS.map(([k, n]) => `<button data-view="${k}" class="${ui.view === k ? 'on' : ''}">${n}</button>`).join('');
  $('left').innerHTML = leftPanel();
  $('stage').classList.toggle('placing', Boolean(ui.placing));
  $('saved').textContent = ui.savedAt
    ? `Saved on this device ${ui.savedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}`
    : 'Saved on this device';

  const s = result.summary;
  $('readout').textContent = `${s.floorSqFt.toLocaleString()} sq ft   ${s.posts} posts   ${s.trusses} trusses`;

  const sheet = ui.step === 'Drawings', plan = ui.view === 'plan';
  $('views').hidden = sheet;
  $('plan').hidden = !plan && !sheet;
  if (sheet && !sheetList(result).some(([k]) => k === ui.sheet)) ui.sheet = 'front';
  if (sheet) $('plan').innerHTML = drawing(result, ui.sheet);
  else if (plan) $('plan').innerHTML = floorPlan(result);

  const check = $('check');
  const warning = firstWarning();
  check.hidden = !ui.problem && !warning;
  check.innerHTML = '';
  if (ui.problem) {
    check.innerHTML = `<span><b>${ui.lead || 'That will not fit.'}</b> ${esc(ui.problem)}</span><button data-dismiss>OK</button>`;
  } else if (warning) {
    const more = result.warnings.length > 1 ? ` (1 of ${result.warnings.length})` : '';
    check.innerHTML = `<span><b>Check this${more}.</b> ${esc(warning.text)}</span>${warning.openingIndex === undefined ? '' : '<button data-fix>Fix It For Me</button>'}`;
  }

  const changed = ui.changed.size;
  const moved = Math.abs(ui.delta) >= 0.005 ? ` ${ui.delta > 0 ? 'Up' : 'Down'} ${money(Math.abs(ui.delta))}.` : '';
  $('total').innerHTML = `<small>Job Total${catalog.sample ? ', Sample Prices' : ''}</small><strong>${money(priced.total)}</strong>
    <em>${ui.last ? `${esc(ui.last)}. ${changed} ${changed === 1 ? 'line' : 'lines'} changed.${moved}` : `${esc(catalog.supplier)}, ${result.items.length} lines.`}</em>`;

  const groups = [...new Set(result.items.map((i) => i.group))];
  const cost = (i) => (i.cost === null ? '<td class="c none">No price</td>' : `<td class="c">${money(i.cost).slice(1)}</td>`);
  $('list').innerHTML = groups.map((g) => `<h2>${g}</h2><table>${priced.lines.filter((i) => i.group === g).map((i) =>
    `<tr class="${ui.changed.has(lineKey(i)) ? 'new' : ''}"><td class="q">${i.qty}</td><td>${i.name}<small>${esc([i.size, i.length].filter(Boolean).join(', '))}</small></td>${cost(i)}</tr>`).join('')}</table>`).join('');
}

document.addEventListener('click', (e) => {
  const t = e.target.closest('button');
  if (!t) return;
  const d = t.dataset;
  if (d.nav) { ui.step = d.nav; ui.placing = null; return paint(); }
  if (d.view) { ui.view = d.view; if (d.view !== 'plan') view.setMode(d.view); return paint(); }
  if (d.field) {
    const f = FIELDS[d.field], from = state[d.field], to = from + f.step * Number(d.dir);
    ui.sel = d.field;
    return apply({ [d.field]: to }, `${f.label} ${from} to ${to} ${f.unit === '/12' ? 'in 12' : f.unit}`);
  }
  if (d.price) {
    const f = PRICE_FIELDS[d.price], from = state.pricing[d.price], to = Math.max(0, from + f.step * Number(d.dir));
    return apply({ pricing: { ...state.pricing, [d.price]: to } }, `${f.label} ${from} to ${to} ${f.unit}`);
  }
  if ('import' in d) return $('pricefile').click();
  if ('export' in d) return download('price-list.csv', priceListCsv(catalog));
  if (d.list) { ui.notice = ''; return setPrices([SAMPLE_CATALOG, ...priceLists.all()][Number(d.list)]); }
  if ('listdel' in d) { priceLists.remove(catalog.supplier); ui.notice = ''; return setPrices(SAMPLE_CATALOG); }
  if ('xadd' in d) return apply({ pricing: { ...state.pricing, extras: [...(state.pricing.extras ?? []), { name: '', amount: 0 }] } }, 'Extra line added');
  if (d.xdel) return apply({ pricing: { ...state.pricing, extras: state.pricing.extras.filter((_, i) => i !== Number(d.xdel)) } }, 'Extra line removed');
  if (d.jobrow) { ui.jobrow = ui.jobrow === d.jobrow ? null : d.jobrow; ui.confirm = null; return paint(); }
  if (d.jobopen) return openJob(jobs.all().find((j) => j.id === d.jobopen).job, 'Job opened');
  if (d.jobdel) {
    if (ui.confirm !== d.jobdel) { ui.confirm = d.jobdel; return paint(); }
    jobs.remove(d.jobdel); ui.confirm = null; ui.jobrow = null;
    return paint();
  }
  if ('jobcopy' in d) return openJob({ ...state, id: newId(), job: `${state.job}, Copy` }, 'Copy made. You are in the copy now');
  if (d.start) { const t = STARTING_POINTS[Number(d.start)]; return startFrom(t.name, t.design); }
  if (d.tplrow) { ui.tplrow = ui.tplrow === Number(d.tplrow) ? null : Number(d.tplrow); return paint(); }
  if (d.tplstart) { const t = templates.all()[Number(d.tplstart)]; return startFrom(t.name, t.design); }
  if (d.tpldel) { templates.remove(templates.all()[Number(d.tpldel)].name); ui.tplrow = null; return paint(); }
  if ('tplsave' in d) { templates.put({ name: state.job, design: designOf(state) }); ui.tplrow = 0; return paint(); }
  if ('altadd' in d) {
    const snap = designOf(state);
    const alts = state.alts ? [...state.alts.map((a, k) => (k === state.alt ? { ...a, snap } : a)), { name: ALT_NAMES[state.alts.length], snap }]
      : [{ name: ALT_NAMES[0], snap }, { name: ALT_NAMES[1], snap }];
    return apply({ alts, alt: alts.length - 1 }, `Now showing ${alts[alts.length - 1].name}, a copy to change`);
  }
  if (d.alt) return Number(d.alt) === state.alt ? null : showAlt(Number(d.alt));
  if (d.altdel) {
    const alts = state.alts.filter((_, i) => i !== Number(d.altdel));
    if (alts.length < 2) { const { alts: gone, alt, ...rest } = state; state = rest; return apply({}, 'Options removed. The building showing is the job'); }
    return openJob({ ...state, ...structuredClone(alts[0].snap), alts, alt: 0 }, `Option removed. Now showing ${alts[0].name}`);
  }
  if ('checksheet' in d) return openCheckSheet();
  if ('order' in d) {
    return download('material-order.csv', toCsv([['Qty', 'Item', 'Size', 'Length', 'Each', 'Cost'],
      ...priced.lines.map((l) => [l.qty, l.name, l.size, l.length, l.each ?? '', l.cost ?? ''])]));
  }
  if (d.sheet) { ui.sheet = d.sheet; return paint(); }
  if (d.sheets) return openSheets(d.sheets === 'all');
  if ('engineer' in d) return openEngineer();
  const fileStem = state.job.replace(/[^\w]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'building';
  if ('engdata' in d) return download(`${fileStem}-data.json`, engineerData(), 'application/json');
  if ('dxf' in d) return download(`${fileStem}.dxf`, dxf(result), 'application/dxf');
  if ('send' in d) return openSend();
  if ('copy' in d) {
    const box = $('proposal').querySelector('input');
    box.select();
    return navigator.clipboard.writeText(box.value).then(() => { t.textContent = 'Copied'; }, () => { t.textContent = 'Press Copy On Your Keyboard'; });
  }
  if ('proposal' in d) return openProposal();
  if ('print' in d) return window.print();
  if ('close' in d) { $('proposal').hidden = true; $('proposal').innerHTML = ''; return; }
  if (d.roof) {
    if (d.roof === roofOf()) return;
    return apply({ roof: d.roof }, `Roof now ${ROOF_NAMES[d.roof].toLowerCase()}`);
  }
  if (d.choice) {
    const label = d.choice === 'postSpacing' ? 'Post spacing' : 'Truss spacing';
    return apply({ [d.choice]: Number(d.value) }, `${label} ${state[d.choice]} to ${d.value} ft`);
  }
  if (d.place) {
    ui.placing = ui.placing === d.place ? null : d.place;
    if (ui.placing && ui.view === 'plan') { ui.view = 'finished'; view.setMode('finished'); }
    return paint();
  }
  if (d.open) { ui.opening = ui.opening === Number(d.open) ? null : Number(d.open); return paint(); }
  if (d.wall) {
    const o = state.openings[ui.opening];
    return setOpening(ui.opening, { wall: d.wall, offset: 2 }, `${TYPE_NAMES[o.type]} moved to the ${WALL_NAMES[d.wall].toLowerCase()} wall`);
  }
  if (d.opfield) {
    const o = state.openings[ui.opening], f = OPENING_FIELDS[d.opfield];
    const to = Math.max(0, o[d.opfield] + f.step * Number(d.dir));
    return setOpening(ui.opening, { [d.opfield]: to }, `${TYPE_NAMES[o.type]} ${f.label.toLowerCase()} now ${feetInches(to * 12)}`);
  }
  if (d.remove) {
    const o = state.openings[Number(d.remove)];
    ui.opening = null;
    return apply({ openings: state.openings.filter((_, i) => i !== Number(d.remove)) }, `${TYPE_NAMES[o.type]} removed`);
  }
  if (d.shedadd) {
    const taken = new Set(state.sheds.map((s) => s.wall));
    const wall = ['back', 'front', 'left', 'right'].find((w) => !taken.has(w));
    if (!wall) { ui.lead = ''; ui.problem = 'Every wall already has a lean-to or porch. Remove one first, or shorten one to make room.'; return paint(); }
    const length = wall === 'front' || wall === 'back' ? state.length : state.width;
    ui.shed = state.sheds.length;
    // Low enough to tuck under the main roof's overhang and fascia on that wall.
    const host = result.geometry.building;
    const drop = edgeOverhangIn(host, wall) > 0 ? Math.ceil((eaveDropIn(host, wall) + 6) / 6) / 2 : 0;
    apply({ sheds: [...state.sheds, { kind: d.shedadd, wall, start: 0, length, ...NEW_SHED[d.shedadd], drop }] }, `${SHED_NAMES[d.shedadd]} added to the ${WALL_NAMES[wall].toLowerCase()} wall`);
    if (ui.problem) ui.shed = null;
    return paint();
  }
  if (d.shedopen) { ui.shed = ui.shed === Number(d.shedopen) ? null : Number(d.shedopen); return paint(); }
  if (d.shedwall) {
    const s = state.sheds[ui.shed];
    const length = d.shedwall === 'front' || d.shedwall === 'back' ? state.length : state.width;
    return setShed(ui.shed, { wall: d.shedwall, start: 0, length }, `${SHED_NAMES[s.kind]} moved to the ${WALL_NAMES[d.shedwall].toLowerCase()} wall`);
  }
  if (d.shedfield) {
    const s = state.sheds[ui.shed], f = SHED_FIELDS[d.shedfield];
    const to = Math.max(f.min, s[d.shedfield] + f.step * Number(d.dir));
    const shown = d.shedfield === 'pitch' ? `${to} in 12` : feetInches(to * 12);
    return setShed(ui.shed, { [d.shedfield]: to }, `${SHED_NAMES[s.kind]} ${f.label.toLowerCase()} now ${shown}`);
  }
  if (d.shedenc) {
    return setShed(ui.shed, { enclosed: d.shedenc === '1' }, `Lean-to ${d.shedenc === '1' ? 'enclosed' : 'opened up'}`);
  }
  if (d.shedremove) {
    const s = state.sheds[Number(d.shedremove)];
    ui.shed = null;
    return apply({ sheds: state.sheds.filter((_, i) => i !== Number(d.shedremove)) }, `${SHED_NAMES[s.kind]} removed`);
  }
  if ('partadd' in d) {
    ui.part = walls().length;
    apply({ partitions: [...walls(), { ...wallAcross('across'), doors: 1, sheathed: true }] }, 'Interior wall added');
    if (ui.problem) ui.part = null;
    return paint();
  }
  if (d.partopen) { ui.part = ui.part === Number(d.partopen) ? null : Number(d.partopen); return paint(); }
  if (d.partaxis) return setPart(ui.part, wallAcross(d.partaxis), `Interior wall now runs ${d.partaxis === 'across' ? 'front to back' : 'end to end'}`);
  if (d.partfield) {
    const p = walls()[ui.part], f = WALL_FIELDS[d.partfield];
    const to = Math.max(f.min, p[d.partfield] + f.step * Number(d.dir));
    const change = { [d.partfield]: to };
    // Moving the start keeps the far end where it is.
    if (d.partfield === 'start') change.length = Math.max(2, p.length - (to - p.start));
    return setPart(ui.part, change, `Interior wall ${d.partfield === 'doors' ? `doors now ${to}` : `${(d.partfield === 'at' ? 'position' : f.label.toLowerCase())} now ${feetInches(to * 12)}`}`);
  }
  if (d.partskin) return setPart(ui.part, { sheathed: d.partskin === '1' }, `Interior wall ${d.partskin === '1' ? 'sheathed' : 'left as studs'}`);
  if (d.partremove) {
    ui.part = null;
    return apply({ partitions: walls().filter((_, i) => i !== Number(d.partremove)) }, 'Interior wall removed');
  }
  if ('loftend' in d) {
    if (!d.loftend) return apply({ loft: null }, 'Loft removed');
    const loft = state.loft ? { ...state.loft, end: d.loftend } : { end: d.loftend, depth: Math.min(12, state.length - 8), height: Math.max(7, state.eaveHeight - 6) };
    return apply({ loft }, `Loft at the ${d.loftend} end`);
  }
  if (d.loftfield) {
    const f = LOFT_FIELDS[d.loftfield], to = Math.max(f.min, state.loft[d.loftfield] + f.step * Number(d.dir));
    return apply({ loft: { ...state.loft, [d.loftfield]: to } }, `Loft ${f.label.toLowerCase()} now ${feetInches(to * 12)}`);
  }
  if (d.color) {
    const title = COLOR_PARTS.find((p) => p[0] === d.color)[1];
    return apply({ colors: { ...state.colors, [d.color]: d.hex } }, `${title} color now ${t.title}`);
  }
  if (d.opt) {
    const value = JSON.parse(d.val), change = { [d.opt]: value };
    // Blown insulation needs a ceiling under it, so the two switch together.
    if (d.opt === 'ceilingR' && value && !opt('linerCeiling')) change.linerCeiling = true;
    if (d.opt === 'linerCeiling' && !value) change.ceilingR = 0;
    return apply({ options: { ...state.options, ...change } }, `${OPTION_SETS[d.opt][0]} now ${OPTION_SETS[d.opt][1].find(([v]) => v === value)[1].toLowerCase()}`);
  }
  if (d.optstep) {
    const to = Math.max(0, opt('skylights') + Number(d.dir));
    return apply({ options: { ...state.options, skylights: to } }, `Skylight panels now ${to}`);
  }
  if (d.wainscot) {
    return apply({ colors: { ...state.colors, wainscotOn: d.wainscot === '1' } }, `Wainscot ${d.wainscot === '1' ? 'on' : 'off'}`);
  }
  if (d.extra) {
    const on = d.on === '1';
    return apply({ colors: { ...state.colors, [d.extra]: on } }, `${d.extra === 'gutters' ? 'Gutters' : 'Pickup'} ${on ? 'on' : 'off'}`);
  }
  if ('dismiss' in d) { ui.problem = ''; ui.lead = ''; return paint(); }
  if ('fix' in d) {
    const w = firstWarning(), o = state.openings[w.openingIndex];
    const moved = (byIn) => state.openings.map((x, i) => (i === w.openingIndex ? { ...x, offset: o.offset + byIn / 12 } : x));
    const fits = [w.slideByIn, w.otherSlideByIn].find((byIn) => byIn !== undefined && design({ ...state, openings: moved(byIn) }).ok);
    return apply({ openings: moved(fits ?? w.slideByIn) }, `${TYPE_NAMES[o.type]} moved to ${w.code === 'door-edge-off-post' ? 'meet' : 'clear'} the post`);
  }
});

// A click on a wall places the chosen door or window. A drag still turns the view.
let down = null;
$('view').addEventListener('pointerdown', (e) => { down = [e.clientX, e.clientY]; });
$('view').addEventListener('pointerup', (e) => {
  if (!ui.placing || !down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5) return;
  const hit = view.pick(e.clientX, e.clientY);
  if (!hit) return;
  const type = ui.placing, size = NEW_OPENING[type];
  const wallLength = hit.wall === 'front' || hit.wall === 'back' ? state.length : state.width;
  const offset = Math.max(0, Math.min(wallLength - size.width, Math.round((hit.at - size.width / 2) * 2) / 2));
  ui.opening = state.openings.length;
  apply({ openings: [...state.openings, { type, wall: hit.wall, offset, ...size }] }, `${TYPE_NAMES[type]} added to the ${WALL_NAMES[hit.wall].toLowerCase()} wall`);
  if (ui.problem) ui.opening = null; else ui.placing = null;
  paint();
});

// Typed fields. The repaint waits a moment so a click that ended the typing still lands on its button.
document.addEventListener('change', (e) => {
  const d = e.target.dataset, v = e.target.value;
  const later = (change, note) => setTimeout(() => apply(change, note), 200);
  const dollars = Math.max(0, Number(v) || 0);
  if (d.company) return company.set({ [d.company]: v.trim() });
  if (d.num) return later({ pricing: { ...state.pricing, [d.num]: dollars } }, `Freight now ${money(dollars)}`);
  if (d.xname) return later({ pricing: { ...state.pricing, extras: state.pricing.extras.map((x, i) => (i === Number(d.xname) ? { ...x, name: v.trim() } : x)) } }, 'Extra line named');
  if (d.xamt) return later({ pricing: { ...state.pricing, extras: state.pricing.extras.map((x, i) => (i === Number(d.xamt) ? { ...x, amount: dollars } : x)) } }, `Extra line now ${money(dollars)}`);
  if (d.altname) return later({ alts: state.alts.map((a, i) => (i === Number(d.altname) ? { ...a, name: v.trim() || ALT_NAMES[i] } : a)) }, 'Option renamed');
});

// Company details typed on a printed page are kept for the next one.
$('proposal').addEventListener('focusout', (e) => {
  const key = e.target.dataset?.co, text = e.target.innerText?.trim();
  if (key && text && text !== e.target.dataset.ph) company.set({ [key]: text });
});

$('pricefile').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const { catalog: next, problems } = parsePriceList(await file.text(), file.name.replace(/\.csv$/i, ''));
  e.target.value = '';
  if (!next) { ui.notice = `That file was not loaded. ${problems[0]}`; return paint(); }
  ui.notice = problems.length
    ? `Loaded ${next.rows.length} prices. ${problems.length} ${problems.length === 1 ? 'row was' : 'rows were'} skipped. ${problems[0]}`
    : `Loaded ${next.rows.length} prices.`;
  priceLists.put(next);
  setPrices(next);
});

// The company block at the top of a printed page. Typing in it on the page saves it.
function companyHead(kind) {
  const co = company.get(), slot = (tag, key, ph) => `<${tag} contenteditable spellcheck="false" data-co="${key}" data-ph="${ph}">${esc(co[key] || ph)}</${tag}>`;
  return `<div class="top"><div>${slot('h1', 'name', 'Your Company Name')}${slot('p', 'contact', 'Address, phone and email')}</div>
    <div class="when"><b>${kind}</b><br>${today()}</div></div>`;
}

// One card for each customer option, with its own picture and total.
function optionPage() {
  if (!state.alts) return '';
  const cards = eachAlt((a) => {
    view.update(result, state.colors);
    return `<div class="optcard"><h3>${esc(a.name)}</h3><img src="${view.snapshot()}" alt="${esc(a.name)}">
      <dl>${specRows().map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>
      <div class="price"><div class="grand"><span>Total</span><span>${money(priced.total)}</span></div></div></div>`;
  }).filter(Boolean);
  view.update(result, state.colors);
  return `<div class="page"><h2>Your Options</h2><div class="optgrid">${cards.join('')}</div></div>`;
}

function openCheckSheet() {
  const groups = [...new Set(result.items.map((i) => i.group))];
  $('proposal').innerHTML = `<div class="bar"><span>Check each line off as the truck is unloaded. Write what is short or damaged in the last column.</span>
    <button class="btn" data-close>Close</button><button class="btn solid" data-print>Print Or Save As PDF</button></div>
    <div class="page sheet">${companyHead('Delivery Check Sheet')}<h2>${esc(state.job)}</h2>
    <table class="cuts tick"><thead><tr><th></th><th>Qty</th><th>Item</th><th>Size</th><th>Length</th><th class="chg">Short Or Damaged</th></tr></thead>
    ${groups.map((g) => `<tbody><tr class="part"><td colspan="6">${g}</td></tr>${result.items.filter((i) => i.group === g).map((i) =>
      `<tr><td class="box"><i></i></td><td class="q">${i.qty}</td><td>${i.name}</td><td>${esc(i.size ?? '')}</td><td>${esc(i.length ?? '')}</td><td class="chg">&nbsp;</td></tr>`).join('')}</tbody>`).join('')}
    </table>
    <div class="sign"><span>Received By</span><span>Date</span></div></div>`;
  $('proposal').hidden = false;
  $('proposal').scrollTop = 0;
}

function openProposal() {
  if (ui.view !== 'finished') { ui.view = 'finished'; view.setMode('finished'); paint(); }
  const picture = view.snapshot();
  const spec = specRows();
  const price = priceLines(priced), co = company.get();
  const groups = [...new Set(result.items.map((i) => i.group))];
  $('proposal').innerHTML = `
    <div class="bar">
      <span>${catalog.sample ? '<b>Sample prices are loaded.</b> Load your own price list before sending this. ' : ''}Click any gray text on the page to type your own.</span>
      <button class="btn" data-close>Close</button><button class="btn solid" data-print>Print Or Save As PDF</button>
    </div>
    <div class="page">
      ${companyHead('Proposal')}
      <h2>${esc(state.job)}${state.alts ? `, ${esc(state.alts[state.alt].name)}` : ''}</h2>
      <img src="${picture}" alt="The building">
      <div class="cols"><dl>${spec.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>
        <div class="price">${price.map(([k, v]) => `<div><span>${esc(k)}</span><span>${money(v)}</span></div>`).join('')}
          <div class="grand"><span>Total</span><span>${money(priced.total)}</span></div></div></div>
      <p class="terms" contenteditable spellcheck="false" data-co="terms" data-ph="Type your terms, payment schedule and how long this price holds.">${esc(co.terms || 'Type your terms, payment schedule and how long this price holds.')}</p>
      <div class="sign"><span>Customer</span><span>Date</span></div>
    </div>
    ${optionPage()}
    <div class="page">
      <h2>What Is Included</h2>
      ${groups.map((g) => `<h3>${g}</h3><table>${result.items.filter((i) => i.group === g).map((i) =>
        `<tr><td class="q">${i.qty}</td><td class="n">${i.name}</td><td>${esc([i.size, i.length].filter(Boolean).join(', '))}</td></tr>`).join('')}</table>`).join('')}
    </div>`;
  $('proposal').hidden = false;
  $('proposal').scrollTop = 0;
}

function openSend() {
  const link = shareLink();
  $('proposal').innerHTML = `<div class="bar"><span></span><button class="btn" data-close>Close</button></div>
    <div class="send"><h2>Send To Customer</h2>
      <p>This link opens a look-only page: the building in 3D, what is included, and the total of ${money(priced.total)}. Your costs, markup and material list are not in it.</p>
      ${catalog.sample ? '<p class="warn">Sample prices are loaded. Load your own price list before sending this.</p>' : ''}
      <input readonly value="${esc(link)}" aria-label="Customer link">
      <div class="row"><button class="btn solid" data-copy>Copy Link</button><a class="btn" href="${esc(link)}" target="_blank" rel="noopener">See What They See</a></div>
      <p class="fine">The link holds this job as it is right now. Change the job and you send a new link. Paste it into a text or an email yourself.</p></div>`;
  $('proposal').hidden = false;
}

// Cut lengths are shown to the nearest eighth of an inch.
function cutLength(inches) {
  const eighths = Math.round(inches * 8), ft = Math.floor(eighths / 96), rest = eighths - ft * 96;
  const whole = Math.floor(rest / 8), part = rest % 8, div = part % 4 === 0 ? 4 : part % 2 === 0 ? 2 : 1;
  return `${ft} ft ${whole}${part ? ` ${part / div}/${8 / div}` : ''} in`;
}

const today = () => new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

function sheetHead(title) {
  return `<div class="top"><div><h1>${title}</h1><p>${esc(state.job)}</p></div>
    <div class="when">${state.width} x ${state.length} x ${state.eaveHeight} ft<br>${today()}</div></div>`;
}

function drawingPages() {
  const names = Object.fromEntries(sheetList(result));
  const sheds = result.geometry.sheds.map((s) => `shed${s.index}`);
  const pairs = sheds.flatMap((k, i) => (i % 2 ? [] : [sheds.slice(i, i + 2)]));
  const how = (k) => (k === 'roof' ? ', seen from above' : k.startsWith('shed') ? ', cut through looking along the main wall' : ', seen from outside');
  return [['front', 'back'], ['left', 'right'], ['roof'], ...pairs].map((set) => `<div class="page sheet">${sheetHead('Framing Drawings')}
    ${set.map((k) => `<h3>${names[k]}${how(k)}</h3>${drawing(result, k, true)}`).join('')}
    <p class="fine">Built from framing rules that have not been checked against a builder's guide yet. Not an engineered drawing.</p></div>`).join('')
    + (result.geometry.loft || result.geometry.partitions?.length ? `<div class="page sheet">${sheetHead('Inside Layout')}
    <h3>Interior walls and loft, seen from above, front wall at the bottom</h3>${floorPlan(result, true)}
    <table class="cuts"><thead><tr><th>Part</th><th>Where</th><th>Size</th></tr></thead><tbody>
    ${(result.geometry.partitions ?? []).map((p) => `<tr><td>Interior Wall ${p.index + 1}</td><td>${p.axis === 'across' ? `${feetInches(p.atIn)} from the left end, from ${feetInches(p.startIn)} to ${feetInches(p.endIn)} off the front wall` : `${feetInches(p.atIn)} from the front wall, from ${feetInches(p.startIn)} to ${feetInches(p.endIn)} off the left end`}</td><td>${p.studSize} studs, ${feetInches(p.heightIn)} tall${p.doors.map((d) => `, door at ${feetInches(d.startIn)}`).join('')}</td></tr>`).join('')}
    ${result.geometry.loft ? ((f) => `<tr><td>Loft</td><td>${f.end === 'left' ? 'Left' : 'Right'} end, ${feetInches(f.depthIn)} deep</td><td>${f.joistSize} joists, floor ${feetInches(f.heightIn)} up, ${feetInches(f.underIn)} clear under the joists</td></tr>
      <tr><td>Loft Stair</td><td>Along the front wall, ${feetInches(f.stair.runIn)} of floor</td><td>${f.stair.risers} risers of ${(f.stair.riseIn / f.stair.risers).toFixed(2)} in, ${f.stair.treads} treads</td></tr>`)(result.geometry.loft) : ''}
    </tbody></table>
    <p class="fine">Built from framing rules that have not been checked against a builder's guide yet. Not an engineered drawing.</p></div>` : '');
}

// The same building as numbers, for an engineer who wants to load it into
// their own software. Lengths are in inches.
function engineerData() {
  const g = result.geometry;
  return JSON.stringify({
    madeWith: 'Girt And Purlin',
    note: 'A description of the building as drawn. Not an engineered design. No loads were calculated. Lengths are in inches, measured along each wall from the front-left corner (front and back walls) or from the front wall (end walls).',
    job: state.job, date: new Date().toISOString().slice(0, 10),
    building: g.building, posts: g.posts, leanTosAndPorches: g.sheds, interiorWalls: g.partitions, loft: g.loft, trusses: g.trusses, girtRows: g.girtRows, purlinRowLengthIn: g.purlinRowLengthIn,
    framingAsDrawn: result.rules, summary: result.summary,
  }, null, 2);
}

function openEngineer() {
  if (ui.view !== 'finished') { ui.view = 'finished'; view.setMode('finished'); paint(); }
  const picture = view.snapshot();
  const { building: b, posts } = result.geometry;
  const r = result.rules, sum = result.summary;
  const blank = (label, hint) => `<dt>${label}</dt><dd contenteditable spellcheck="false">${hint}</dd>`;
  const pitchText = b.roof === 'gambrel' ? `${r.gambrelLowerPitch} in 12 lower slopes, ${r.gambrelUpperPitch} in 12 upper slopes, break ${feetInches(b.line[1].y)} in from each side wall and ${feetInches(b.line[1].h)} above the ground` : `${state.pitch} in 12`;
  const planes = result.geometry.planes;
  const purlinText = b.roof === 'gable' ? `${planes[0].purlinRows} rows each side` : b.roof === 'mono' ? `${planes[0].purlinRows} rows` : `${planes[0].purlinRows} rows on each lower slope and ${planes[1].purlinRows} on each upper slope`;
  const facts = [
    ['Shape', `Rectangle with a ${{ gable: 'gable roof, ridge running the long way', mono: 'single-slope roof, low along the front wall and high along the back', gambrel: 'gambrel roof, ridge running the long way' }[b.roof]}${b.sheds.length ? `, plus ${b.sheds.length} single-slope ${b.sheds.length === 1 ? 'addition' : 'additions'}` : ''}`],
    ['Width', `${state.width} ft`], ['Length', `${state.length} ft`],
    ['Wall Height', `${state.eaveHeight} ft, ground to ${b.roof === 'mono' ? 'the low eave' : 'eave'}`],
    ['Peak Height', `${feetInches(b.eaveIn + b.riseIn)}, ground to ${b.roof === 'mono' ? 'the top of the high wall' : 'ridge'}`],
    ['Roof Pitch', pitchText], ['Overhang', b.roof === 'gambrel' ? `${state.overhang} in at each end wall, none along the side walls` : `${state.overhang} in, all four sides`],
    ['Floor Area', `${Math.round(sum.floorSqFt).toLocaleString('en-US')} sq ft`],
    ...(finishRows().length ? [['Inside And Finish', finishRows().join(', ')]] : []),
  ];
  const loftG = result.geometry.loft;
  const carriers = result.items.some((i) => i.name === 'Truss Carriers');
  const headerSizes = [...new Set(result.items.filter((i) => i.name === 'Headers').map((i) => i.size))];
  const members = [
    ['Posts', r.postSize, `Every ${state.postSpacing} ft along each wall, ${posts.length} in all, ${r.postEmbedmentIn ? `set ${feetInches(r.postEmbedmentIn)} into the ground` : 'standing on bolt-down brackets on the concrete'}`],
    [{ gable: 'Trusses', mono: 'Single Slope Trusses', gambrel: 'Gambrel Trusses' }[b.roof], `${state.width} ft span, ${b.roof === 'gambrel' ? 'gambrel profile' : `${state.pitch} in 12`}`, `Every ${state.trussSpacing} ft, ${sum.trusses} in all`],
    ['Skirt Board', r.skirtSize, 'One row at the ground, all four walls'],
    ['Wall Girts', r.girtSize, `Every ${r.girtSpacingIn} in up the wall, on the outside face of the posts, joined on posts`],
    ['Roof Purlins', r.purlinSize, `Every ${r.purlinSpacingIn} in up the slope, ${purlinText}, joined on trusses`],
    ...(carriers ? [['Truss Carriers', r.trussCarrierSize, 'Two boards along the top of each long wall, under the trusses that land between posts, joined on posts']] : []),
    ...(headerSizes.length ? [['Headers', headerSizes.join(' and '), `Two boards over each door and window${headerSizes.length > 1 ? `, the larger size over openings wider than ${r.wideHeaderOverFt} ft` : ''}`]] : []),
    ...result.geometry.sheds.flatMap((s) => {
      const name = s.label[0].toUpperCase() + s.label.slice(1);
      return [
        [`${name}`, `${feetInches(s.depthIn)} deep, ${feetInches(s.lengthIn)} long`, `Single slope at ${s.pitch} in 12, ${feetInches(s.highIn)} at the main wall down to ${feetInches(s.lowIn)} at its posts, ${s.enclosed ? 'walls closed in' : 'sides open'}`],
        [`${name} Rafters`, r.rafterSize, `${s.rafters.length} rafters about every ${r.rafterSpacingIn} in, from a ${r.shedLedgerSize} ledger on the main wall posts to a beam of two ${r.shedBeamSize} boards on ${s.outer.length} posts`],
      ];
    }),
    ...(result.geometry.partitions ?? []).map((p) => [`Interior Wall ${p.index + 1}`, `${p.studSize} studs`,
      `${feetInches(p.lengthIn)} long and ${feetInches(p.heightIn)} tall, running ${p.axis === 'across' ? `front to back, ${feetInches(p.atIn)} from the left end` : `end to end, ${feetInches(p.atIn)} from the front wall`}, studs every ${r.partitionStudSpacingIn} in, ${p.doors.length} ${p.doors.length === 1 ? 'door' : 'doors'}, ${p.sheathed ? 'sheathed both sides' : 'not sheathed'}. Carries no roof or floor`]),
    ...(loftG ? [
      ['Loft', `${feetInches(loftG.depthIn)} deep, ${state.width} ft wide`, `Across the ${loftG.end} end, top of floor ${feetInches(loftG.heightIn)} above the ground floor, ${feetInches(loftG.aboveIn)} clear to the truss bottom chords`],
      ['Loft Joists', loftG.joistSize, `Every ${r.loftJoistSpacingIn} in, ${loftG.joists.length} in all, running the long way of the building, hung between a ledger on the end wall posts and the loft beam`],
      ['Loft Beam', `Two ${r.loftBeamSize}`, `Under the open edge, one board each side of ${loftG.posts.length} posts spaced ${feetInches(state.width * 12 / (loftG.posts.length - 1))} apart`],
      ['Loft Posts', r.postSize, `${loftG.posts.length} posts, ${r.postEmbedmentIn ? `set ${feetInches(r.postEmbedmentIn)} into the ground` : 'on bolt-down brackets'} like the wall posts`],
      ['Loft Stair', `${r.stairStringers} stringers, ${r.stairStringerSize}`, `${loftG.stair.risers} risers of ${(loftG.stair.riseIn / loftG.stair.risers).toFixed(2)} in, ${loftG.stair.treads} treads of ${r.stairTreadIn} in, ${feetInches(loftG.stair.widthIn)} wide, along the front wall`],
    ] : []),
    ['Roof And Walls', 'Ribbed steel panel', `${r.panelCoverageIn} in coverage, screwed to the purlins and girts`],
  ];
  const first = `<div class="page sheet eng">
    ${companyHead('Engineer Package')}
    <h2>${esc(state.job)}</h2>
    <p class="lead">This package describes a post-frame building we want to build. We are asking you for the engineered design. Nothing in it has been engineered and no loads have been calculated. The member sizes are our starting point and are yours to change.</p>
    <img src="${picture}" alt="The building">
    <div class="cols even"><div><h3>The Building</h3><dl>${facts.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl></div>
      <div><h3>The Site</h3><dl>${blank('Site Address', 'Type the address')}${blank('County And State', 'Type the county and state')}${blank('Permit Office', 'Type who issues the permit')}
        ${blank('What The Building Is For', 'Type the use, such as equipment storage')}${blank('Heated', 'Type yes or no')}${blank('Soil', 'Type what you know, or leave for the engineer')}
        <dt>Snow, Wind And Soil Loads</dt><dd>Engineer to set for this site</dd></dl></div></div>
  </div>`;
  const second = `<div class="page sheet eng">${sheetHead('Framing As Drawn')}
    <p class="fine">These are the sizes and spacings the drawings use. Write your change beside any line.</p>
    <table class="cuts eng-members"><thead><tr><th>Member</th><th>Size</th><th>Layout</th><th class="chg">Engineer's Change</th></tr></thead>
      <tbody>${members.map(([m, s, l]) => `<tr><td>${m}</td><td>${esc(s)}</td><td>${esc(l)}</td><td class="chg">&nbsp;</td></tr>`).join('')}</tbody></table>
    <h3>What We Need From You</h3>
    <p>The program that made this package lays out the frame and counts the material. It does not size anything for load. It has no footing design, no bracing, no truss design and no connection details. Any pads, collars or slab in the material list are counted from common sizes and are not sized for this site. Those are yours, along with any stamped drawings the permit office asks for.</p>
    ${b.options.footing === 'bracket' ? `<p>The posts stand on bolt-down steel brackets, not in the ground. A buried post resists wind by its grip in the soil. A bracketed post gets that from the bracket, its anchors and the concrete under it, and from bracing in the frame. The bracket model, the anchors, the thickened edge or piers under them, and the bracing are all yours to specify. The list counts one bracket per post and nothing else.</p>` : ''}
    ${b.sheds.length ? `<p>Each lean-to and porch roof starts below the main eave, so its rafters and upper purlins have to carry snow that slides off the main roof and drifts against the wall above. The rafter, ledger and beam sizes shown are placeholders with no published table behind them.</p>` : ''}
    ${loftG ? `<p>The loft joist size comes from a house floor span table for a 40 lb per sq ft live load. Storage or shop use can call for more. The loft beam, its posts and the ledger fastening are placeholders with no table behind them. The loft adds floor load to the end wall posts and their footings, and its own posts need footings sized for it. The stair stringers are drawn in one length with no support under the middle, which notched stringers this long normally need.</p>` : ''}
    <h3>Doors And Windows</h3>
    ${b.openings.length ? `<table class="cuts"><thead><tr><th>Opening</th><th>Wall</th><th>Starts At</th><th>Width</th><th>Height</th><th>Sill</th></tr></thead>
      <tbody>${b.openings.map((o) => `<tr><td>${TYPE_NAMES[o.type]}</td><td>${WALL_NAMES[o.wall]}</td><td>${feetInches(o.startIn)}</td><td>${feetInches(o.widthIn)}</td><td>${feetInches(o.heightIn)}</td><td>${o.toGround ? 'At the ground' : feetInches(o.sillIn)}</td></tr>`).join('')}</tbody></table>` : '<p>None.</p>'}
    <p class="fine">Front and back walls are measured from the left corner as you face the front wall. End walls are measured from the front wall.</p>
  </div>`;
  const third = `<div class="page sheet eng">${sheetHead('Post Layout')}
    <h3>Seen from above, front wall at the bottom</h3>${floorPlan(result, true)}
    <table class="cuts posts"><thead><tr><th>Wall</th><th>At</th><th>Top Above Ground</th><th>Post Length</th></tr></thead>
      <tbody>${posts.map((p) => `<tr><td>${WALL_NAMES[p.wall]}</td><td>${feetInches(p.atIn)}</td><td>${feetInches(p.topIn)}</td><td>${p.stockFt} ft</td></tr>`).join('')}
      ${result.geometry.sheds.flatMap((s) => s.posts.map((p) => `<tr><td>${s.label[0].toUpperCase() + s.label.slice(1)}</td><td>${feetInches(p.atIn)} along, ${feetInches(p.outIn)} out</td><td>${feetInches(p.topIn)}</td><td>${p.stockFt} ft</td></tr>`)).join('')}
      ${(loftG?.posts ?? []).map((p) => `<tr><td>Loft</td><td>${feetInches(p.y)} from the front wall, ${feetInches(p.x)} from the left end</td><td>${feetInches(p.topIn)}</td><td>${p.stockFt} ft</td></tr>`).join('')}</tbody></table>
  </div>`;
  $('proposal').innerHTML = `<div class="bar"><span>Click any gray text on the first page to type your own. The data file is the same building as numbers, for the engineer's own software.</span>
    <button class="btn" data-close>Close</button><button class="btn" data-engdata>Save Data File</button><button class="btn solid" data-print>Print Or Save As PDF</button></div>${first}${second}${third}${drawingPages()}`;
  $('proposal').hidden = false;
  $('proposal').scrollTop = 0;
}

function openSheets(withDrawings) {
  const head = sheetHead;
  const pages = drawingPages();
  const parts = [...new Set(result.cuts.map((c) => c.part))];
  const boards = result.cuts.reduce((n, c) => n + c.qty, 0);
  const cuts = `<div class="page sheet">${head('Cut List')}
    <p class="fine">${boards} boards. Cut each one to the length shown from the stock piece next to it. Lengths are to the nearest eighth of an inch.</p>
    <table class="cuts"><thead><tr><th>Qty</th><th>Cut To</th><th>From</th><th>Where It Goes</th><th>Note</th></tr></thead>
    ${parts.map((p) => { const rows = result.cuts.filter((c) => c.part === p); return `<tbody><tr class="part"><td colspan="5">${p}, ${esc(rows[0].size)}</td></tr>${rows.map((c) =>
      `<tr><td class="q">${c.qty}</td><td>${Math.abs(c.cutIn - c.stockFt * 12) < 0.01 ? 'Full length' : cutLength(c.cutIn)}</td><td>${c.stockFt} ft</td><td>${esc(c.where)}</td><td>${esc(c.note)}</td></tr>`).join('')}</tbody>`; }).join('')}
    </table></div>`;
  $('proposal').innerHTML = `<div class="bar"><span>${withDrawings ? 'Framing drawings and the cut list.' : 'The cut list.'}</span>
    <button class="btn" data-close>Close</button><button class="btn solid" data-print>Print Or Save As PDF</button></div>${withDrawings ? pages : ''}${cuts}`;
  $('proposal').hidden = false;
  $('proposal').scrollTop = 0;
}

window.addEventListener('hashchange', () => location.reload());

$('job').value = state.job;
$('job').addEventListener('change', (e) => { if (e.target.dataset.company || e.target !== $('job')) return; state = { ...state, job: e.target.value.trim() || SAMPLE.job }; save(); paint(); });

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');

paint();
view.resize();
view.update(result, state.colors);
if (shared) view.spin();
