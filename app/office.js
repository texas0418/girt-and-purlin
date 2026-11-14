// What a builder keeps between jobs: the job list, building templates, the
// company details that head every printed page, and saved price lists.
// Everything lives in the browser's own storage on this device.
const KEYS = {
  jobs: 'ridge-and-rafter.jobs.v1',
  templates: 'ridge-and-rafter.templates.v1',
  company: 'ridge-and-rafter.company.v1',
  lists: 'ridge-and-rafter.pricelists.v1',
};

function read(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
function write(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
}

export const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

// A keyed list kept newest first.
function shelf(key, idOf) {
  const all = () => read(key, []);
  return {
    all,
    put(entry) { return write(key, [entry, ...all().filter((e) => idOf(e) !== idOf(entry))]); },
    remove(id) { return write(key, all().filter((e) => idOf(e) !== id)); },
  };
}

export const jobs = shelf(KEYS.jobs, (e) => e.id);
export const templates = shelf(KEYS.templates, (e) => e.name);
export const priceLists = shelf(KEYS.lists, (e) => e.supplier);

export const company = {
  get: () => ({ name: '', contact: '', terms: '', ...read(KEYS.company, {}) }),
  set: (change) => write(KEYS.company, { ...company.get(), ...change }),
};

// The parts of a job that describe the building itself. Customer options and
// templates copy these and nothing else.
export const DESIGN_KEYS = ['roof', 'width', 'length', 'eaveHeight', 'pitch', 'overhang', 'endOverhang', 'postSpacing', 'trussSpacing', 'truss', 'ceilingPitch', 'atticRoom', 'walls', 'openings', 'sheds', 'partitions', 'loft', 'options', 'colors'];
// Keys added after a job was saved get their empty value, so a copy laid over another design never keeps that design's parts.
export const designOf = (job) => structuredClone({ roof: 'gable', truss: 'common', ceilingPitch: undefined, atticRoom: undefined, walls: {}, partitions: [], loft: null, ...Object.fromEntries(DESIGN_KEYS.filter((k) => k in job).map((k) => [k, job[k]])) });

const colors = (walls, roof, trim, wainscot, wainscotOn) => ({ walls, roof, trim, wainscot, wainscotOn, gutters: false, truck: false });

// Common buildings to start from. Sizes and door places are starting points to change, not recommendations.
export const STARTING_POINTS = [
  { name: 'Two-Car Garage', design: {
    width: 24, length: 32, eaveHeight: 10, pitch: 4, overhang: 12, postSpacing: 8, trussSpacing: 4,
    openings: [
      { type: 'overhead', wall: 'left', offset: 4, width: 16, height: 8 },
      { type: 'walk', wall: 'front', offset: 2.5, width: 3, height: 6 + 8 / 12 },
      { type: 'window', wall: 'front', offset: 18, width: 4, height: 3.5, sill: 3 },
    ],
    sheds: [], options: { slab: true }, colors: colors('#e6e6e0', '#2f3336', '#2f3336', '#2f3336', false) } },
  { name: 'Machine Shed', design: {
    width: 30, length: 48, eaveHeight: 12, pitch: 4, overhang: 12, postSpacing: 8, trussSpacing: 4,
    openings: [
      { type: 'slider', wall: 'front', offset: 16, width: 16, height: 10 },
      { type: 'walk', wall: 'front', offset: 2.5, width: 3, height: 6 + 8 / 12 },
    ],
    sheds: [], options: {}, colors: colors('#8b908d', '#2f3336', '#e6e6e0', '#2f3336', false) } },
  { name: 'Farm Shop', design: {
    width: 40, length: 64, eaveHeight: 14, pitch: 4, overhang: 12, postSpacing: 8, trussSpacing: 4,
    openings: [
      { type: 'overhead', wall: 'left', offset: 13, width: 14, height: 12 },
      { type: 'overhead', wall: 'front', offset: 16, width: 12, height: 12 },
      { type: 'walk', wall: 'front', offset: 2.5, width: 3, height: 6 + 8 / 12 },
      { type: 'window', wall: 'front', offset: 42, width: 4, height: 3.5, sill: 3 },
      { type: 'window', wall: 'front', offset: 50, width: 4, height: 3.5, sill: 3 },
    ],
    sheds: [], options: { slab: true, linerWalls: true, linerCeiling: true, ceilingR: 38, wallInsulation: 'fiberglass', footing: 'pad' },
    colors: colors('#c2b8a3', '#4a392e', '#4a392e', '#4a392e', true) } },
  { name: 'Horse Barn With Lean-Tos', design: {
    width: 36, length: 48, eaveHeight: 12, pitch: 4, overhang: 12, postSpacing: 8, trussSpacing: 4,
    openings: [
      { type: 'slider', wall: 'left', offset: 12, width: 12, height: 10 },
      { type: 'slider', wall: 'right', offset: 12, width: 12, height: 10 },
    ],
    sheds: [
      { kind: 'leanto', wall: 'front', start: 0, length: 48, depth: 12, pitch: 3, drop: 1, enclosed: false },
      { kind: 'leanto', wall: 'back', start: 0, length: 48, depth: 12, pitch: 3, drop: 1, enclosed: false },
    ],
    options: { ridgeVent: true }, colors: colors('#7a2a22', '#2f3336', '#e6e6e0', '#2f3336', false) } },
  { name: 'Cabin Shell With Porch', design: {
    width: 24, length: 36, eaveHeight: 10, pitch: 6, overhang: 12, postSpacing: 8, trussSpacing: 4,
    openings: [
      { type: 'walk', wall: 'front', offset: 16.5, width: 3, height: 6 + 8 / 12 },
      { type: 'window', wall: 'front', offset: 9, width: 4, height: 3.5, sill: 3 },
      { type: 'window', wall: 'front', offset: 23, width: 4, height: 3.5, sill: 3 },
      { type: 'window', wall: 'back', offset: 9, width: 4, height: 3.5, sill: 3 },
    ],
    sheds: [{ kind: 'porch', wall: 'front', start: 0, length: 36, depth: 8, pitch: 3, drop: 1, enclosed: false }],
    options: { slab: true, wallInsulation: 'wrap' }, colors: colors('#2e4a3a', '#2f3336', '#e6e6e0', '#2f3336', false) } },
  { name: 'Gambrel Barn', design: {
    roof: 'gambrel', width: 24, length: 40, eaveHeight: 10, pitch: 4, overhang: 12, postSpacing: 8, trussSpacing: 4,
    openings: [
      { type: 'slider', wall: 'left', offset: 7, width: 10, height: 9 },
      { type: 'walk', wall: 'front', offset: 2.5, width: 3, height: 6 + 8 / 12 },
    ],
    sheds: [], options: { cupolas: true }, colors: colors('#7a2a22', '#2f3336', '#e6e6e0', '#2f3336', false) } },
  { name: 'Single Slope Shed', design: {
    roof: 'mono', width: 20, length: 32, eaveHeight: 9, pitch: 3, overhang: 12, postSpacing: 8, trussSpacing: 4,
    openings: [
      { type: 'overhead', wall: 'back', offset: 4, width: 10, height: 10 },
      { type: 'overhead', wall: 'back', offset: 18, width: 10, height: 10 },
    ],
    sheds: [], options: {}, colors: colors('#8b908d', '#2f3336', '#e6e6e0', '#2f3336', false) } },
  { name: 'Empty Shell', design: {
    width: 30, length: 40, eaveHeight: 10, pitch: 4, overhang: 12, postSpacing: 8, trussSpacing: 4,
    openings: [], sheds: [], options: {}, colors: colors('#8b908d', '#2f3336', '#e6e6e0', '#2f3336', false) } },
];
