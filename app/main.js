import { design } from '../engine/design.js';
import { feetInches } from '../engine/stock.js';
import { priceJob, parsePriceList, priceListCsv, toCsv, SAMPLE_CATALOG } from '../engine/pricing.js';
import { createView } from './scene.js';
import { floorPlan } from './plan.js';
import { drawing, SHEETS } from './drawings.js';

const STORE = 'girt-and-purlin.job.v1';
const PRICE_STORE = 'girt-and-purlin.prices.v1';
const STEPS = ['Size', 'Roof', 'Doors And Windows', 'Colors', 'Price', 'Drawings'];
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
let catalog = loadPrices();
let priced = priceJob(result, catalog, state.pricing);
const ui = { delta: 0, notice: '', step: 'Size', view: 'finished', sheet: 'front', sel: null, opening: null, placing: null, changed: new Set(), last: '', problem: '', savedAt: null };
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
  const { pricing, ...job } = state;
  const price = { package: priced.materials + priced.markup, labor: priced.labor, tax: priced.tax, total: priced.total };
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

const num = (v) => (Number.isInteger(v) ? String(v) : feetInches(v * 12));

function stepper(attrs, label, value, unit, selected) {
  const long = value.length > 4;
  return `<div class="dim${selected ? ' sel' : ''}"><label>${label}</label><div class="step">
    <button ${attrs} data-dir="-1" aria-label="Less ${label}">&lsaquo;</button>
    <output class="${long ? 'long' : ''}">${value}${unit && !long ? `<small>${unit}</small>` : ''}</output>
    <button ${attrs} data-dir="1" aria-label="More ${label}">&rsaquo;</button></div></div>`;
}

const field = (key) => stepper(`data-field="${key}"`, FIELDS[key].label, String(state[key]), FIELDS[key].unit, ui.sel === key);
const choice = (key, options, unit) => `<div class="seg">${options.map((v) =>
  `<button data-choice="${key}" data-value="${v}" class="${state[key] === v ? 'on' : ''}">${v} ${unit}</button>`).join('')}</div>`;

function leftPanel() {
  if (ui.step === 'Size') {
    return `<h2>Building Size</h2>${['width', 'length', 'eaveHeight', 'pitch', 'overhang'].map(field).join('')}
      <h2>Post Spacing</h2>${choice('postSpacing', [6, 8, 10, 12], 'ft')}
      <h2>Truss Spacing</h2>${choice('trussSpacing', [2, 4, 8], 'ft')}
      <p class="hint">Drag the picture to look around the building. Scroll or pinch to move closer. The material list follows every change.</p>`;
  }
  if (ui.step === 'Roof') {
    return `<h2>Roof</h2>${['pitch', 'overhang'].map(field).join('')}
      <h2>Truss Spacing</h2>${choice('trussSpacing', [2, 4, 8], 'ft')}
      <p class="hint">Version 1 draws a plain gable roof. Other roof shapes come later.</p>`;
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
  if (ui.step === 'Colors') {
    const name = (hex) => PALETTE.find((p) => p[1] === hex)?.[0] ?? hex;
    return COLOR_PARTS.map(([part, title]) => `<h2>${title}</h2>
      <p class="picked">${name(state.colors[part])}</p>
      <div class="swatches">${PALETTE.map(([n, hex]) =>
        `<button data-color="${part}" data-hex="${hex}" title="${n}" aria-label="${title} ${n}" style="background:${hex}" class="${state.colors[part] === hex ? 'on' : ''}"></button>`).join('')}</div>
      ${part === 'wainscot' ? `<div class="seg"><button data-wainscot="1" class="${state.colors.wainscotOn ? 'on' : ''}">Wainscot On</button><button data-wainscot="0" class="${state.colors.wainscotOn ? '' : 'on'}">Wainscot Off</button></div>` : ''}`).join('')
      + '<h2>Extras</h2>' + [['gutters', 'Gutters'], ['truck', 'Pickup']].map(([key, title]) =>
        `<div class="seg"><button data-extra="${key}" data-on="1" class="${state.colors[key] ? 'on' : ''}">${title} On</button><button data-extra="${key}" data-on="0" class="${state.colors[key] ? '' : 'on'}">${title} Off</button></div>`).join('')
      + '<p class="hint">Gutters are in the picture only for now. They are not in the material list or the price. The pickup is there for scale.</p>'
      + '<p class="hint">Sample colors. Each supplier\'s own color chart comes with its catalog.</p>';
  }
  if (ui.step === 'Price') {
    const row = (label, value, strong) => `<div class="sum${strong ? ' strong' : ''}"><span>${label}</span><span>${money(value)}</span></div>`;
    return `<h2>Price List</h2>
      <p class="picked">${esc(catalog.supplier)}, ${catalog.rows.length} items</p>
      ${catalog.sample ? '<p class="hint go">These are sample prices so the screen has something to add up. Load your own list before quoting a job.</p>' : ''}
      ${ui.notice ? `<p class="hint go">${esc(ui.notice)}</p>` : ''}
      <div class="seg"><button data-import>Load A Price List</button><button data-export>Save This List</button></div>
      ${catalog.sample ? '' : '<div class="seg"><button data-sample>Back To Sample Prices</button></div>'}
      <p class="hint">A price list is a spreadsheet saved as CSV with four columns: Item, Size, Unit and Price. Save This List gives you one to fill in.</p>
      <h2>Your Numbers</h2>
      ${Object.entries(PRICE_FIELDS).map(([k, f]) => stepper(`data-price="${k}"`, f.label, String(state.pricing[k]), f.unit, false)).join('')}
      <h2>This Job</h2>
      ${row('Materials', priced.materials)}${row('Markup', priced.markup)}${row('Sales Tax', priced.tax)}${row('Labor', priced.labor)}${row('Total', priced.total, true)}
      ${priced.unpriced ? `<p class="hint go">${priced.unpriced} ${priced.unpriced === 1 ? 'line has' : 'lines have'} no price in this list and count as zero.</p>` : ''}`;
  }
  return `<h2>Drawings</h2>
    <div class="seg stack">${SHEETS.map(([k, n]) => `<button data-sheet="${k}" class="${ui.sheet === k ? 'on' : ''}">${n}</button>`).join('')}</div>
    <p class="hint">Walls are drawn from outside the building. Dashed lines show the part of each post in the ground.</p>
    <h2>Print</h2>
    <div class="seg stack"><button data-sheets="all">All Sheets</button><button data-sheets="cuts">Cut List Only</button></div>
    <h2>For Your Engineer</h2>
    <div class="seg stack"><button data-engineer>Engineer Package</button></div>
    <p class="hint">Everything an engineer needs to start on this building: the size, the framing as drawn, where every post and opening sits, and the drawings. This program does not do the engineering.</p>`;
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
    ['Roof', `${state.pitch} in 12 pitch, ${state.overhang} in overhang`],
    ['Frame', `Posts every ${state.postSpacing} ft, trusses every ${state.trussSpacing} ft`],
    ['Doors And Windows', openings || 'None'],
    ['Colors', `${colorName(state.colors.walls)} walls, ${colorName(state.colors.roof)} roof, ${colorName(state.colors.trim)} trim${state.colors.wainscotOn ? `, ${colorName(state.colors.wainscot)} wainscot` : ''}`],
  ];
}

function paintShared() {
  const p = shared.price;
  const lines = [['Building Package', p.package], ['Labor', p.labor], ['Sales Tax', p.tax]].filter(([, v], i) => i === 0 || v > 0);
  document.body.classList.add('shared');
  document.body.classList.toggle('embed', shared.embed);
  document.title = `${state.job}, Girt And Purlin`;
  $('views').innerHTML = [VIEWS[0], VIEWS[2]].map(([k, n]) => `<button data-view="${k}" class="${ui.view === k ? 'on' : ''}">${n}</button>`).join('');
  $('readout').textContent = `${result.summary.floorSqFt.toLocaleString()} sq ft`;
  $('plan').hidden = ui.view !== 'plan';
  if (ui.view === 'plan') $('plan').innerHTML = floorPlan({ ...result, warnings: [] });
  $('total').innerHTML = `<small>${esc(state.job)}</small><strong>${money(Number(p.total) || 0)}</strong><em>Drag the picture to look around your building.</em>`;
  $('list').innerHTML = `<h2>Your Building</h2><dl class="spec">${specRows().map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>
    <h2>Price</h2>${lines.map(([k, v]) => `<div class="sum"><span>${k}</span><span>${money(Number(v) || 0)}</span></div>`).join('')}
    <div class="sum strong"><span>Total</span><span>${money(Number(p.total) || 0)}</span></div>`;
}

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
  if (sheet) $('plan').innerHTML = drawing(result, ui.sheet);
  else if (plan) $('plan').innerHTML = floorPlan(result);

  const check = $('check');
  const warning = result.warnings[0];
  check.hidden = !ui.problem && !warning;
  check.innerHTML = '';
  if (ui.problem) {
    check.innerHTML = `<span><b>${ui.lead || 'That will not fit.'}</b> ${esc(ui.problem)}</span><button data-dismiss>OK</button>`;
  } else if (warning) {
    const more = result.warnings.length > 1 ? ` (1 of ${result.warnings.length})` : '';
    check.innerHTML = `<span><b>Check this${more}.</b> ${esc(warning.text)}</span><button data-fix>Fix It For Me</button>`;
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
  if ('sample' in d) { ui.notice = ''; return setPrices(SAMPLE_CATALOG); }
  if ('order' in d) {
    return download('material-order.csv', toCsv([['Qty', 'Item', 'Size', 'Length', 'Each', 'Cost'],
      ...priced.lines.map((l) => [l.qty, l.name, l.size, l.length, l.each ?? '', l.cost ?? ''])]));
  }
  if (d.sheet) { ui.sheet = d.sheet; return paint(); }
  if (d.sheets) return openSheets(d.sheets === 'all');
  if ('engineer' in d) return openEngineer();
  if ('engdata' in d) return download(`${state.job.replace(/[^\w]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'building'}-data.json`, engineerData(), 'application/json');
  if ('send' in d) return openSend();
  if ('copy' in d) {
    const box = $('proposal').querySelector('input');
    box.select();
    return navigator.clipboard.writeText(box.value).then(() => { t.textContent = 'Copied'; }, () => { t.textContent = 'Press Copy On Your Keyboard'; });
  }
  if ('proposal' in d) return openProposal();
  if ('print' in d) return window.print();
  if ('close' in d) { $('proposal').hidden = true; $('proposal').innerHTML = ''; return; }
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
  if (d.color) {
    const title = COLOR_PARTS.find((p) => p[0] === d.color)[1];
    return apply({ colors: { ...state.colors, [d.color]: d.hex } }, `${title} color now ${t.title}`);
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
    const w = result.warnings[0], o = state.openings[w.openingIndex];
    return setOpening(w.openingIndex, { offset: o.offset + w.slideByIn / 12 }, `${TYPE_NAMES[o.type]} moved to ${w.code === 'door-edge-off-post' ? 'meet' : 'clear'} the post`);
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

$('pricefile').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const { catalog: next, problems } = parsePriceList(await file.text(), file.name.replace(/\.csv$/i, ''));
  e.target.value = '';
  if (!next) { ui.notice = `That file was not loaded. ${problems[0]}`; return paint(); }
  ui.notice = problems.length
    ? `Loaded ${next.rows.length} prices. ${problems.length} ${problems.length === 1 ? 'row was' : 'rows were'} skipped. ${problems[0]}`
    : `Loaded ${next.rows.length} prices.`;
  setPrices(next);
});

function openProposal() {
  if (ui.view !== 'finished') { ui.view = 'finished'; view.setMode('finished'); paint(); }
  const picture = view.snapshot();
  const spec = specRows();
  const price = [['Building Package', priced.materials + priced.markup], ['Labor', priced.labor], ['Sales Tax', priced.tax]].filter(([, v], i) => i === 0 || v > 0);
  const groups = [...new Set(result.items.map((i) => i.group))];
  $('proposal').innerHTML = `
    <div class="bar">
      <span>${catalog.sample ? '<b>Sample prices are loaded.</b> Load your own price list before sending this. ' : ''}Click any gray text on the page to type your own.</span>
      <button class="btn" data-close>Close</button><button class="btn solid" data-print>Print Or Save As PDF</button>
    </div>
    <div class="page">
      <div class="top"><div><h1 contenteditable spellcheck="false">Your Company Name</h1><p contenteditable spellcheck="false">Address, phone and email</p></div>
        <div class="when"><b>Proposal</b><br>${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div></div>
      <h2>${esc(state.job)}</h2>
      <img src="${picture}" alt="The building">
      <div class="cols"><dl>${spec.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>
        <div class="price">${price.map(([k, v]) => `<div><span>${k}</span><span>${money(v)}</span></div>`).join('')}
          <div class="grand"><span>Total</span><span>${money(priced.total)}</span></div></div></div>
      <p class="terms" contenteditable spellcheck="false">Type your terms, payment schedule and how long this price holds.</p>
      <div class="sign"><span>Customer</span><span>Date</span></div>
    </div>
    <div class="page">
      <h2>What Is Included</h2>
      ${groups.map((g) => `<h3>${g}</h3><table>${result.items.filter((i) => i.group === g).map((i) =>
        `<tr><td class="q">${i.qty}</td><td>${i.name}</td><td>${esc([i.size, i.length].filter(Boolean).join(', '))}</td></tr>`).join('')}</table>`).join('')}
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
  const names = Object.fromEntries(SHEETS);
  return [['front', 'back'], ['left', 'right'], ['roof']].map((set) => `<div class="page sheet">${sheetHead('Framing Drawings')}
    ${set.map((k) => `<h3>${names[k]}${k === 'roof' ? ', seen from above' : ', seen from outside'}</h3>${drawing(result, k, true)}`).join('')}
    <p class="fine">Built from framing rules that have not been checked against a builder's guide yet. Not an engineered drawing.</p></div>`).join('');
}

// The same building as numbers, for an engineer who wants to load it into
// their own software. Lengths are in inches.
function engineerData() {
  const g = result.geometry;
  return JSON.stringify({
    madeWith: 'Girt And Purlin',
    note: 'A description of the building as drawn. Not an engineered design. No loads were calculated. Lengths are in inches, measured along each wall from the front-left corner (front and back walls) or from the front wall (end walls).',
    job: state.job, date: new Date().toISOString().slice(0, 10),
    building: g.building, posts: g.posts, trusses: g.trusses, girtRows: g.girtRows, purlinRowLengthIn: g.purlinRowLengthIn,
    framingAsDrawn: result.rules, summary: result.summary,
  }, null, 2);
}

function openEngineer() {
  if (ui.view !== 'finished') { ui.view = 'finished'; view.setMode('finished'); paint(); }
  const picture = view.snapshot();
  const { building: b, posts } = result.geometry;
  const r = result.rules, sum = result.summary;
  const blank = (label, hint) => `<dt>${label}</dt><dd contenteditable spellcheck="false">${hint}</dd>`;
  const facts = [
    ['Shape', 'Rectangle with a gable roof, ridge running the long way'],
    ['Width', `${state.width} ft`], ['Length', `${state.length} ft`],
    ['Wall Height', `${state.eaveHeight} ft, ground to eave`],
    ['Peak Height', `${feetInches(b.eaveIn + b.riseIn)}, ground to ridge`],
    ['Roof Pitch', `${state.pitch} in 12`], ['Overhang', `${state.overhang} in, all four sides`],
    ['Floor Area', `${Math.round(sum.floorSqFt).toLocaleString('en-US')} sq ft`],
  ];
  const members = [
    ['Posts', r.postSize, `Every ${state.postSpacing} ft along each wall, ${posts.length} in all, set ${feetInches(r.postEmbedmentIn)} into the ground`],
    ['Trusses', `${state.width} ft span, ${state.pitch} in 12`, `Every ${state.trussSpacing} ft, ${sum.trusses} in all`],
    ['Skirt Board', r.skirtSize, 'One row at the ground, all four walls'],
    ['Wall Girts', r.girtSize, `Every ${r.girtSpacingIn} in up the wall, flat on the outside of the posts`],
    ['Roof Purlins', r.purlinSize, `Every ${r.purlinSpacingIn} in up the slope, ${sum.purlinRowsPerSide} rows each side`],
    ['Headers', r.headerSize, 'Over each door and window'],
    ['Roof And Walls', 'Ribbed steel panel', `${r.panelCoverageIn} in coverage, screwed to the purlins and girts`],
  ];
  const first = `<div class="page sheet eng">
    <div class="top"><div><h1 contenteditable spellcheck="false">Your Company Name</h1><p contenteditable spellcheck="false">Address, phone and email</p></div>
      <div class="when"><b>Engineer Package</b><br>${today()}</div></div>
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
    <p>The program that made this package lays out the frame and counts the material. It does not size anything for load. It has no footings, no bracing, no truss design and no connection details. Those are yours, along with any stamped drawings the permit office asks for.</p>
    <h3>Doors And Windows</h3>
    ${b.openings.length ? `<table class="cuts"><thead><tr><th>Opening</th><th>Wall</th><th>Starts At</th><th>Width</th><th>Height</th><th>Sill</th></tr></thead>
      <tbody>${b.openings.map((o) => `<tr><td>${TYPE_NAMES[o.type]}</td><td>${WALL_NAMES[o.wall]}</td><td>${feetInches(o.startIn)}</td><td>${feetInches(o.widthIn)}</td><td>${feetInches(o.heightIn)}</td><td>${o.toGround ? 'At the ground' : feetInches(o.sillIn)}</td></tr>`).join('')}</tbody></table>` : '<p>None.</p>'}
    <p class="fine">Front and back walls are measured from the left corner as you face the front wall. End walls are measured from the front wall.</p>
  </div>`;
  const third = `<div class="page sheet eng">${sheetHead('Post Layout')}
    <h3>Seen from above, front wall at the bottom</h3>${floorPlan(result, true)}
    <table class="cuts posts"><thead><tr><th>Wall</th><th>At</th><th>Top Above Ground</th><th>Post Length</th></tr></thead>
      <tbody>${posts.map((p) => `<tr><td>${WALL_NAMES[p.wall]}</td><td>${feetInches(p.atIn)}</td><td>${feetInches(p.topIn)}</td><td>${p.stockFt} ft</td></tr>`).join('')}</tbody></table>
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
$('job').addEventListener('change', (e) => { state = { ...state, job: e.target.value.trim() || SAMPLE.job }; save(); paint(); });

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');

paint();
view.resize();
view.update(result, state.colors);
if (shared) view.spin();
