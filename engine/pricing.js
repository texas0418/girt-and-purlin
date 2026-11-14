// Prices: a supplier price list in, a costed material list and job total out.
// A price list row is { item, size, unit, price }. Unit is one of:
//   each   one price per piece
//   ft     price per foot of length (trusses: per foot of span)
//   sqft   price per square foot (doors sold by size)
// A row with a blank size covers every size of that item.

export const UNITS = ['each', 'ft', 'sqft'];

// Placeholder numbers so the screen has something to add up. They are not quotes.
export const SAMPLE_CATALOG = {
  supplier: 'Sample Prices',
  sample: true,
  rows: [
    { item: 'Posts', size: '6x6 treated', unit: 'ft', price: 4.5 },
    { item: 'Laminated Columns', size: '3-ply 2x6 laminated', unit: 'ft', price: 9 },
    { item: 'Trusses', size: '', unit: 'ft', price: 9 },
    { item: 'Scissor Trusses', size: '', unit: 'ft', price: 11.7 },
    { item: 'Attic Trusses', size: '', unit: 'ft', price: 22.5 },
    { item: 'Single Slope Trusses', size: '', unit: 'ft', price: 13.5 },
    { item: 'Gambrel Trusses', size: '', unit: 'ft', price: 16.5 },
    { item: 'Skirt Boards', size: '2x8 treated', unit: 'ft', price: 1.6 },
    { item: 'Wall Girts', size: '2x6', unit: 'ft', price: 0.95 },
    { item: 'Roof Purlins', size: '2x4', unit: 'ft', price: 0.6 },
    { item: 'Truss Carriers', size: '2x12', unit: 'ft', price: 2.3 },
    { item: 'Rafter Ledgers', size: '', unit: 'ft', price: 1.5 },
    { item: 'Eave Beams', size: '', unit: 'ft', price: 2.3 },
    { item: 'Rafters', size: '', unit: 'ft', price: 1.5 },
    { item: 'Headers', size: '2x10', unit: 'ft', price: 1.8 },
    { item: 'Headers', size: '2x12', unit: 'ft', price: 2.3 },
    { item: 'Opening Blocking', size: '2x6', unit: 'ft', price: 0.95 },
    { item: 'Roof Panels', size: '', unit: 'ft', price: 3.2 },
    { item: 'Wall Panels', size: '', unit: 'ft', price: 3.2 },
    { item: 'Ridge Cap', size: '', unit: 'each', price: 32 },
    { item: 'Eave Trim', size: '', unit: 'each', price: 18 },
    { item: 'High Side Eave Trim', size: '', unit: 'each', price: 26 },
    { item: 'Gambrel Flashing', size: '', unit: 'each', price: 28 },
    { item: 'Rake Trim', size: '', unit: 'each', price: 22 },
    { item: 'Corner Trim', size: '', unit: 'each', price: 24 },
    { item: 'Base Trim', size: '', unit: 'each', price: 16 },
    { item: 'Endwall Flashing', size: '', unit: 'each', price: 24 },
    { item: 'Inside Corner Trim', size: '', unit: 'each', price: 20 },
    { item: 'Inside Closures', size: '', unit: 'each', price: 1.5 },
    { item: 'Outside Closures', size: '', unit: 'each', price: 1.5 },
    { item: 'Panel Screws', size: '', unit: 'each', price: 28 },
    { item: 'Wainscot Girts', size: '', unit: 'ft', price: 0.6 },
    { item: 'Liner Girts', size: '', unit: 'ft', price: 0.6 },
    { item: 'Ceiling Joists', size: '', unit: 'ft', price: 0.95 },
    { item: 'Wainscot Panels', size: '', unit: 'ft', price: 3.2 },
    { item: 'Sliding Door Panels', size: '', unit: 'ft', price: 3.2 },
    { item: 'Wainscot Trim', size: '', unit: 'each', price: 18 },
    { item: 'Skylight Panels', size: '', unit: 'ft', price: 6 },
    { item: 'Eave Light Panels', size: '', unit: 'ft', price: 6 },
    { item: 'Eave Light Trim', size: '', unit: 'each', price: 18 },
    { item: 'Eave Light Girts', size: '', unit: 'ft', price: 0.6 },
    { item: 'Ridge Vent', size: '', unit: 'each', price: 30 },
    { item: 'Cupolas', size: '', unit: 'each', price: 450 },
    { item: 'Liner Panels', size: '', unit: 'ft', price: 2.9 },
    { item: 'J-Channel', size: '', unit: 'each', price: 12 },
    { item: 'Gutter', size: '', unit: 'each', price: 14 },
    { item: 'Gutter Joiners', size: '', unit: 'each', price: 4 },
    { item: 'Gutter End Caps', size: '', unit: 'each', price: 4 },
    { item: 'Gutter Hangers', size: '', unit: 'each', price: 2 },
    { item: 'Gutter Outlets', size: '', unit: 'each', price: 6 },
    { item: 'Downspouts', size: '', unit: 'each', price: 13 },
    { item: 'Downspout Elbows', size: '', unit: 'each', price: 5 },
    { item: 'Downspout Bands', size: '', unit: 'each', price: 2 },
    { item: 'Roof Bubble Insulation', size: '', unit: 'each', price: 190 },
    { item: 'Wall Bubble Insulation', size: '', unit: 'each', price: 190 },
    { item: 'Roof Fiberglass Insulation', size: '', unit: 'sqft', price: 0.9 },
    { item: 'Wall Fiberglass Insulation', size: '', unit: 'sqft', price: 0.9 },
    { item: 'House Wrap', size: '', unit: 'each', price: 170 },
    { item: 'Blown Ceiling Insulation', size: '', unit: 'each', price: 42 },
    { item: 'Footing Pads', size: '', unit: 'each', price: 12 },
    { item: 'Concrete Mix', size: '', unit: 'each', price: 6.5 },
    { item: 'Post Brackets', size: '', unit: 'each', price: 85 },
    { item: 'Slab Concrete', size: '', unit: 'each', price: 165 },
    { item: 'Slab Vapor Barrier', size: '', unit: 'each', price: 320 },
    { item: 'Partition Bottom Plates', size: '', unit: 'ft', price: 0.9 },
    { item: 'Partition Top Plates', size: '', unit: 'ft', price: 0.6 },
    { item: 'Partition Studs', size: '2x4', unit: 'ft', price: 0.6 },
    { item: 'Partition Studs', size: '2x6', unit: 'ft', price: 0.95 },
    { item: 'Partition Door Headers', size: '', unit: 'ft', price: 0.6 },
    { item: 'Partition Sheathing', size: '', unit: 'each', price: 16 },
    { item: 'Interior Doors', size: '', unit: 'each', price: 180 },
    { item: 'Loft Ledgers', size: '', unit: 'ft', price: 2 },
    { item: 'Loft Beams', size: '', unit: 'ft', price: 2.3 },
    { item: 'Loft Joists', size: '2x8', unit: 'ft', price: 1.3 },
    { item: 'Loft Joists', size: '2x10', unit: 'ft', price: 1.8 },
    { item: 'Loft Joists', size: '2x12', unit: 'ft', price: 2.3 },
    { item: 'Joist Hangers', size: '', unit: 'each', price: 2 },
    { item: 'Loft Subfloor', size: '', unit: 'each', price: 38 },
    { item: 'Attic Subfloor', size: '', unit: 'each', price: 38 },
    { item: 'Stair Stringers', size: '', unit: 'ft', price: 2.3 },
    { item: 'Stair Treads', size: '', unit: 'ft', price: 2.3 },
    { item: 'Guard Rail', size: '', unit: 'ft', price: 12 },
    { item: 'Stair Handrail', size: '', unit: 'ft', price: 4 },
    { item: 'Sliding Door', size: '', unit: 'sqft', price: 14 },
    { item: 'Overhead Door', size: '', unit: 'sqft', price: 16 },
    { item: 'Walk Door', size: '', unit: 'each', price: 450 },
    { item: 'Window', size: '', unit: 'each', price: 260 },
  ],
};

const cents = (n) => Math.round(n * 100) / 100;
const same = (a, b) => String(a).trim().toLowerCase() === String(b).trim().toLowerCase();

function findRow(catalog, item) {
  const named = catalog.rows.filter((r) => same(r.item, item.name));
  return named.find((r) => r.size && same(r.size, item.size)) ?? named.find((r) => !r.size) ?? null;
}

function pieceCost(row, item) {
  if (row.unit === 'ft') return item.ft ? row.price * item.ft : null;
  if (row.unit === 'sqft') return item.sqFt ? row.price * item.sqFt : null;
  return row.price;
}

// settings: { markupPct, taxPct, laborPerSqFt }. Tax is charged on materials plus markup.
// Freight and extra lines are flat dollar amounts the builder types in. They are
// added after markup and are not taxed here; sales tax rules differ by state.
export function priceJob(result, catalog, settings = {}) {
  const { markupPct = 0, taxPct = 0, laborPerSqFt = 0, freight = 0, extras = [] } = settings;
  const lines = result.items.map((item) => {
    const row = findRow(catalog, item);
    const each = row ? pieceCost(row, item) : null;
    return { ...item, each: each === null ? null : cents(each), cost: each === null ? null : cents(each * item.qty) };
  });
  const materials = cents(lines.reduce((sum, l) => sum + (l.cost ?? 0), 0));
  const markup = cents(materials * markupPct / 100);
  const tax = cents((materials + markup) * taxPct / 100);
  const labor = cents(((result.summary?.floorSqFt ?? 0) + (result.summary?.shedSqFt ?? 0)) * laborPerSqFt);
  const flat = (v) => cents(Math.max(0, Number(v) || 0));
  const extraLines = extras.map((e) => ({ name: String(e.name ?? '').trim() || 'Extra', amount: flat(e.amount) })).filter((e) => e.amount > 0);
  const extra = cents(extraLines.reduce((sum, e) => sum + e.amount, 0));
  return {
    lines, materials, markup, tax, labor, freight: flat(freight), extraLines, extra,
    total: cents(materials + markup + tax + labor + flat(freight) + extra),
    unpriced: lines.filter((l) => l.cost === null).length,
  };
}

// A payment schedule: each payment is a share of the job total, typed in by
// the builder. Nothing is assumed, so a job with no payments has no schedule.
// Shares short of 100% leave a balance line; the last line takes up the odd cent.
export function paymentSchedule(total, payments = []) {
  const rows = payments.map((p) => ({ name: String(p.name ?? '').trim() || 'Payment', pct: Math.max(0, Number(p.pct) || 0) })).filter((p) => p.pct > 0);
  if (!rows.length) return { lines: [], problem: '' };
  const pct = cents(rows.reduce((sum, r) => sum + r.pct, 0));
  if (pct > 100) return { lines: [], problem: `The payments add up to ${pct}%. Bring them down to 100% or less.` };
  const lines = rows.map((r) => ({ ...r, amount: cents(total * r.pct / 100) }));
  if (pct < 100) lines.push({ name: 'Balance', pct: cents(100 - pct), amount: 0 });
  const last = lines[lines.length - 1];
  last.amount = cents(total - lines.slice(0, -1).reduce((sum, l) => sum + l.amount, 0));
  return { lines, problem: '' };
}

// A supplier's price list for one of its builders: every price moved up or
// down by one percent figure. A negative figure is a discount.
export function builderPriceList(catalog, builder, pct = 0) {
  const by = Math.max(-100, Number(pct) || 0), name = String(builder ?? '').trim();
  return {
    supplier: name ? `${catalog.supplier} For ${name}` : catalog.supplier,
    sample: false,
    rows: catalog.rows.map((r) => ({ ...r, price: cents(r.price * (1 + by / 100)) })),
  };
}

function splitCsvLine(line) {
  const out = [];
  let cell = '', quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') quoted = false; else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { out.push(cell); cell = ''; } else cell += c;
  }
  out.push(cell);
  return out.map((s) => s.trim());
}

// Reads a price list saved from a spreadsheet as CSV. Columns: Item, Size, Unit, Price.
export function parsePriceList(text, supplier = 'Imported Price List') {
  const rows = [], problems = [];
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return { catalog: null, problems: ['The file is empty.'] };
  const head = splitCsvLine(lines[0]).map((h) => h.toLowerCase());
  const col = (name) => head.indexOf(name);
  if (col('item') < 0 || col('price') < 0) {
    return { catalog: null, problems: ['The first row needs the column names Item, Size, Unit and Price.'] };
  }
  lines.slice(1).forEach((line, n) => {
    const cells = splitCsvLine(line);
    const item = cells[col('item')] ?? '';
    const size = col('size') < 0 ? '' : cells[col('size')] ?? '';
    const unit = (col('unit') < 0 ? 'each' : cells[col('unit')] || 'each').toLowerCase().replace(/[^a-z]/g, '');
    const price = Number(String(cells[col('price')] ?? '').replace(/[$,\s]/g, ''));
    if (!item) return;
    if (!UNITS.includes(unit)) return problems.push(`Row ${n + 2}: unit "${cells[col('unit')]}" is not each, ft or sqft.`);
    if (!Number.isFinite(price) || price < 0 || cells[col('price')] === '') return problems.push(`Row ${n + 2}: "${cells[col('price')]}" is not a price.`);
    rows.push({ item, size, unit, price });
  });
  if (!rows.length) problems.push('No priced rows were found.');
  return { catalog: rows.length ? { supplier, sample: false, rows } : null, problems };
}

const csvCell = (v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
export const toCsv = (table) => table.map((row) => row.map(csvCell).join(',')).join('\n') + '\n';

export function priceListCsv(catalog) {
  return toCsv([['Item', 'Size', 'Unit', 'Price'], ...catalog.rows.map((r) => [r.item, r.size, r.unit, r.price])]);
}

// One invoice as a file QuickBooks Online can import. The first four columns
// and Item amount are the ones Intuit marks as required; every row of an
// invoice repeats its number, customer and dates. Lines are [description, dollars].
export function invoiceCsv(lines, { number, customer, date }) {
  const day = `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}/${date.getFullYear()}`;
  return toCsv([['Invoice number', 'Customer', 'Invoice date', 'Due date', 'Item description', 'Item amount'],
    ...lines.filter(([, amount]) => amount > 0).map(([what, amount]) => [number, customer, day, day, what, amount.toFixed(2)])]);
}

// QuickBooks Desktop takes a tab-separated IIF file. The columns follow Intuit's own invoice and estimate samples.
// The accounts and the item must already be in the builder's QuickBooks under exactly these names.
const IIF_TRNS = ['TRNSID', 'TRNSTYPE', 'DATE', 'ACCNT', 'NAME', 'CLASS', 'AMOUNT', 'DOCNUM', 'MEMO', 'CLEAR', 'TOPRINT', 'NAMEISTAXABLE'];
const IIF_SPL = ['SPLID', 'TRNSTYPE', 'DATE', 'ACCNT', 'NAME', 'CLASS', 'AMOUNT', 'DOCNUM', 'MEMO', 'CLEAR', 'QNTY', 'PRICE', 'INVITEM', 'TAXABLE'];
const iifCell = (v) => String(v ?? '').replace(/[\t\r\n]+/g, ' ').trim();
const iifRow = (key, cols, values) => [key, ...cols.map((c) => iifCell(values[c]))].join('\t');

export function quickbooksIif(lines, { kind = 'invoice', number, customer, date, receivable = 'Accounts Receivable', income, item }) {
  const type = kind === 'estimate' ? 'ESTIMATE' : 'INVOICE';
  const day = `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
  const cents = lines.map(([what, amount]) => [what, Math.round(amount * 100)]).filter(([, c]) => c > 0);
  const money = (c) => (c / 100).toFixed(2);
  const head = { TRNSTYPE: type, DATE: day, CLEAR: 'N' };
  return [
    ['!TRNS', ...IIF_TRNS].join('\t'), ['!SPL', ...IIF_SPL].join('\t'), '!ENDTRNS',
    iifRow('TRNS', IIF_TRNS, { ...head, ACCNT: type === 'ESTIMATE' ? 'Estimates' : receivable, NAME: customer,
      AMOUNT: money(cents.reduce((sum, [, c]) => sum + c, 0)), DOCNUM: number, TOPRINT: 'N', NAMEISTAXABLE: 'N' }),
    ...cents.map(([what, c]) => iifRow('SPL', IIF_SPL, { ...head, ACCNT: income, AMOUNT: `-${money(c)}`, MEMO: what,
      QNTY: type === 'INVOICE' ? -1 : '', PRICE: money(c), INVITEM: item, TAXABLE: 'N' })),
    'ENDTRNS', ''].join('\r\n');
}
