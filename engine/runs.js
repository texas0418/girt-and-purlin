// Every run of lumber in the frame, split into the boards it is built from.
// The material count and the cut list both read this, so they always agree.
// A joint between two boards lands on a post (walls) or a truss (roof), and
// the joints step over from one row to the next so they never line up.
import { wallLengthIn, wallTopIn, roofSpanAbove, isGable, isOpen, hipGeo, WALLS } from './building.js';
import { fitStock, spans } from './stock.js';

const EPS = 0.01;
export const WALL_NAMES = { front: 'Front wall', back: 'Back wall', left: 'Left end', right: 'Right end' };
export const OPENING_NAMES = { slider: 'sliding door', walk: 'walk door', overhead: 'overhead door', window: 'window' };

// Length of the first roof plane up its slope, overhang included.
export function slopeIn(b) { return b.planes[0].slopeIn; }

// One run from startIn to endIn. Each board reaches the farthest support its
// stock length allows. A staggered run starts with a board half as long.
export function boards(startIn, endIn, supports, stockFt, stagger = false) {
  const maxIn = Math.max(...stockFt) * 12;
  const out = [];
  let at = startIn, first = true;
  while (endIn - at > EPS) {
    let next = endIn;
    if (endIn - at > maxIn + EPS) {
      const within = (reach) => supports.filter((s) => s > at + EPS && s <= at + reach + EPS && s < endIn - EPS);
      const near = first && stagger ? within(maxIn / 2) : [];
      const reachable = near.length ? near : within(maxIn);
      next = reachable.length ? Math.max(...reachable) : at + maxIn;
    }
    out.push({ cutIn: next - at, stockFt: fitStock(next - at, stockFt) });
    at = next;
    first = false;
  }
  return out;
}

export function openSpans(b, wall, heightIn, groundOnly = false) {
  return b.openings
    .filter((o) => o.wall === wall && (groundOnly ? o.toGround : heightIn > o.sillIn + EPS && heightIn < o.sillIn + o.heightIn - EPS))
    .map((o) => [o.startIn, o.endIn]);
}

// Height the level girt rows stop at: the wall top on a long wall, the low eave on a gable end.
export const girtTopIn = (b, wall) => (isGable(wall) ? b.eaveIn : wallTopIn(b, wall, 0));

export function girtRowCount(b, rules, wall = 'front') {
  return Math.ceil((girtTopIn(b, wall) - rules.skirtHeightIn) / rules.girtSpacingIn - EPS);
}

// Rows above the low eave on a gable end, each as long as the roof line allows.
export function gableGirtRows(b, rules) {
  const rows = [];
  if (b.roof === 'hip') return rows;
  for (let up = rules.girtSpacingIn; up < b.riseIn - EPS; up += rules.girtSpacingIn) {
    const span = roofSpanAbove(b, b.eaveIn + up);
    if (span && span[1] - span[0] > EPS) rows.push({ heightIn: b.eaveIn + up, startIn: span[0], endIn: span[1] });
  }
  return rows;
}

export const planePurlinRows = (plane, rules) => Math.ceil(plane.slopeIn / rules.purlinSpacingIn - EPS) + 1;
export function purlinRowsPerSide(b, rules) { return planePurlinRows(b.planes[0], rules); }
export const purlinRows = (b, rules) => (b.roof === 'hip' ? hipPurlinRows(b, rules).length : b.planes.reduce((n, p) => n + planePurlinRows(p, rules), 0));

// Purlin rows on a hip roof. Each row sits level, and every row up the slope
// is shorter at both ends, because the hips close in. insetIn is how far each
// end has moved in from the corner of the eave.
export function hipPurlinRows(b, rules) {
  const g = hipGeo(b), slope = g.halfIn * g.k, out = [];
  for (let i = 0; i < planePurlinRows(b.planes[0], rules); i++) {
    const insetIn = Math.min(i * rules.purlinSpacingIn, slope) / g.k;
    for (const [end, lengthIn] of [[false, b.lengthIn], [true, b.widthIn]]) {
      const startIn = -b.overhangIn + insetIn, endIn = lengthIn + b.overhangIn - insetIn;
      // A row shorter than a foot is left out; the hip framing covers it.
      if (endIn - startIn < 12 - EPS) continue;
      for (let side = 0; side < 2; side++) out.push({ end, side, row: i, insetIn, startIn, endIn });
    }
  }
  return out;
}

export function headerSizeFor(o, rules) {
  return o.widthIn > rules.wideHeaderOverFt * 12 + EPS ? rules.wideHeaderSize : rules.headerSize;
}

// Trusses that do not sit on a post need a carrier under them along that wall.
export function needsCarrier(wall, posts, trusses) {
  const at = posts.filter((p) => p.wall === wall).map((p) => p.atIn);
  return trusses.some((t) => !at.some((s) => Math.abs(s - t.x) < 0.5));
}

export function lumberRuns(b, rules, posts, trusses) {
  const runs = [];
  const stock = rules.lumberStockFt;
  const put = (part, size, where, pieces, note = '') => runs.push({ part, size, where, note, pieces });

  for (const wall of WALLS) {
    const len = wallLengthIn(b, wall);
    // Corner posts belong to the long walls but the end wall boards land on them too.
    const supports = [0, len, ...posts.filter((p) => p.wall === wall).map((p) => p.atIn)];
    // An open wall has posts and nothing between them but the beam along the top of a side wall.
    const open = isOpen(b, wall);
    for (const [s, e] of open ? [] : spans(len, openSpans(b, wall, 0, true))) {
      put('Skirt Boards', rules.skirtSize, WALL_NAMES[wall], boards(s, e, supports, stock));
    }
    let row = 0;
    const rowCount = open ? 0 : girtRowCount(b, rules, wall), topIn = girtTopIn(b, wall);
    for (; row < rowCount; row++) {
      const h = Math.min(rules.skirtHeightIn + (row + 1) * rules.girtSpacingIn, topIn);
      for (const [s, e] of spans(len, openSpans(b, wall, h))) {
        put('Wall Girts', rules.girtSize, WALL_NAMES[wall], boards(s, e, supports, stock, row % 2 === 1));
      }
    }
    if (isGable(wall) && !open) {
      // Rows keep going up the gable triangle, each one shorter than the last.
      for (const g of gableGirtRows(b, rules)) {
        put('Wall Girts', rules.girtSize, `${WALL_NAMES[wall]}, gable`, boards(g.startIn, g.endIn, supports, stock, row++ % 2 === 1), 'Ends cut to the roof slope');
      }
    }
    if (isGable(wall) && b.roof === 'hip') {
      // The short jack trusses of a hip end bear on the end wall between its posts.
      for (let ply = 0; ply < 2; ply++) {
        put('Truss Carriers', rules.trussCarrierSize, WALL_NAMES[wall], boards(0, len, supports, stock, ply === 1), 'Two boards side by side at the top of the posts, under the hip end trusses');
      }
    }
    if (!isGable(wall) && (open || needsCarrier(wall, posts, trusses))) {
      for (let ply = 0; ply < 2; ply++) {
        put('Truss Carriers', rules.trussCarrierSize, WALL_NAMES[wall], boards(0, len, supports, stock, ply === 1), open ? 'Two boards side by side at the top of the posts, the only tie along the open wall' : 'Two boards side by side at the top of the posts');
      }
    }
  }

  const trussAt = trusses.map((t) => t.x);
  if (b.roof === 'hip') {
    const jackAt = Array.from({ length: Math.ceil(b.widthIn / b.trussSpacingIn - EPS) + 1 }, (_, i) => Math.min(i * b.trussSpacingIn, b.widthIn));
    for (const r of hipPurlinRows(b, rules)) {
      put('Roof Purlins', rules.purlinSize, r.end ? 'Roof, hip ends' : 'Roof', boards(r.startIn, r.endIn, r.end ? jackAt : trussAt, stock, r.row % 2 === 1), r.insetIn > EPS ? 'Ends cut on the slant at the hips' : '');
    }
  } else for (let i = 0; i < purlinRows(b, rules); i++) {
    put('Roof Purlins', rules.purlinSize, 'Roof', boards(-b.endOverhangIn, b.lengthIn + b.endOverhangIn, trussAt, stock, i % 2 === 1));
  }

  for (const o of b.openings) {
    const where = `${WALL_NAMES[o.wall]}, ${OPENING_NAMES[o.type]}`;
    for (let i = 0; i < 2; i++) put('Headers', headerSizeFor(o, rules), where, boards(0, o.widthIn, [], stock));
    if (o.type === 'window') put('Opening Blocking', rules.girtSize, where, boards(0, o.widthIn, [], stock), 'Under the sill');
    if (o.type === 'slider') put('Opening Blocking', rules.girtSize, where, boards(0, o.widthIn * 2, [], stock), 'Backs the door track');
  }
  return runs;
}
