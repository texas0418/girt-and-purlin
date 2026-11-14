// Stud walls: the frame for a building that stands on concrete instead of
// posts set in the ground. Each wall is a treated bottom plate, studs, and two
// top plates, with a header over every opening.
import { wallLengthIn, wallTopIn, isGable, closedWalls } from './building.js';
import { fitStock, spans, feetInches } from './stock.js';
import { boards, WALL_NAMES, OPENING_NAMES, headerSizeFor } from './runs.js';

const EPS = 0.01;
const THICK = 1.5;
// Bottom plate plus the two top plates.
const PLATES_IN = 3 * THICK;
const HEADER_DEPTH_IN = { '2x6': 5.5, '2x8': 7.25, '2x10': 9.25, '2x12': 11.25 };
const SHORT_STOCK_FT = 8;

// The level top of a stud wall. An end wall stops at the eave height, and the end truss frames the wall above it.
export const studWallTopIn = (b, wall) => (isGable(wall) ? b.eaveIn : wallTopIn(b, wall, 0));

// Full-height studs at each side of an opening, from the building code table.
export function kingStuds(widthIn, rules) {
  const table = rules.studKingsBySpanFt;
  return (table.find(([spanFt]) => widthIn <= spanFt * 12 + EPS) ?? table[table.length - 1])[1];
}

export function studWalls(b, rules) {
  const runs = [], errors = [], warnings = [], walls = {};
  const stock = rules.lumberStockFt, studStock = rules.partitionStudStockFt, size = b.studSize;
  const put = (part, partSize, where, pieces, note = '') => { if (pieces.length) runs.push({ part, size: partSize, where, note, pieces }); };
  let tallest = 0, anyOpening = false;

  for (const wall of closedWalls(b)) {
    const len = wallLengthIn(b, wall), topIn = studWallTopIn(b, wall), where = WALL_NAMES[wall];
    const cutIn = topIn - PLATES_IN;
    const stockFt = fitStock(cutIn, studStock);
    if (stockFt === null) {
      errors.push(`The ${where.toLowerCase()} is ${feetInches(topIn)} tall, and its studs would be longer than any stocked stud. Lower the wall, or go back to posts and girts.`);
      continue;
    }
    tallest = Math.max(tallest, topIn);
    const geo = { lengthIn: len, topIn, studs: [], shorts: [], headers: [], sills: [], plates: [] };
    const full = (atIn) => geo.studs.push({ atIn, fromIn: THICK, toIn: topIn - 2 * THICK });

    // Studs on the layout, with one at the far end whatever the spacing leaves.
    let layout = [];
    for (let x = 0; x < len - EPS; x += b.studSpacingIn) layout.push(x);
    layout.push(len);
    const all = [...layout];
    let fullCount = 0;
    // A third stud at each corner gives the inside wall covering something to fasten to.
    if (!isGable(wall)) { fullCount += 2; full(THICK * 1.5); full(len - THICK * 1.5); }

    const shorts = {};
    const short = (lengthIn) => { const k = Math.round(lengthIn * 8) / 8; shorts[k] = (shorts[k] ?? 0) + 1; };
    for (const o of b.openings.filter((op) => op.wall === wall).sort((a, c) => a.startIn - c.startIn)) {
      anyOpening = true;
      const what = `${where}, ${OPENING_NAMES[o.type]}`;
      const headerSize = headerSizeFor(o, rules), depth = HEADER_DEPTH_IN[headerSize] ?? 11.25;
      const roomIn = topIn - 2 * THICK - depth;
      // The opening into a wing is as tall as the wing's walls, or as tall as the header leaves room for.
      const headIn = o.type === 'wing' ? Math.min(o.heightIn, roomIn) : o.sillIn + o.heightIn;
      if (headIn > roomIn + EPS) {
        errors.push(`The ${OPENING_NAMES[o.type]} on the ${where.toLowerCase()} leaves no room for its header under the top of the wall. Lower it or raise the wall.`);
        continue;
      }
      const jacks = o.widthIn > rules.studJackDoubleOverFt * 12 + EPS ? 2 : 1, kings = kingStuds(o.widthIn, rules);
      const pack = (jacks + kings) * THICK;
      // Layout studs that fall in the opening or in the studs beside it give way.
      const inside = layout.filter((x) => x > o.startIn + EPS && x < o.endIn - EPS);
      layout = layout.filter((x) => x < o.startIn - pack - EPS || x > o.endIn + pack + EPS);
      for (const side of [-1, 1]) {
        const edge = side < 0 ? o.startIn : o.endIn;
        for (let i = 0; i < jacks; i++) geo.studs.push({ atIn: edge + side * (i + 0.5) * THICK, fromIn: THICK, toIn: headIn });
        for (let i = 0; i < kings; i++) full(edge + side * (jacks + i + 0.5) * THICK);
      }
      fullCount += 2 * kings;
      const jackIn = headIn - THICK;
      put('Opening Framing', size, what, Array.from({ length: 2 * jacks }, () => ({ cutIn: jackIn, stockFt: fitStock(jackIn, studStock) })), 'Shorter stud under the header');
      const headerIn = o.widthIn + 2 * jacks * THICK;
      for (let ply = 0; ply < 2; ply++) put('Headers', headerSize, what, boards(0, headerIn, [], stock), 'Two boards on edge, resting on the shorter studs');
      geo.headers.push({ startIn: o.startIn - jacks * THICK, endIn: o.endIn + jacks * THICK, bottomIn: headIn, topIn: headIn + depth });
      const aboveIn = topIn - 2 * THICK - (headIn + depth), belowIn = o.sillIn - 2 * THICK;
      for (const x of inside) {
        if (aboveIn > 1) { short(aboveIn); geo.shorts.push({ atIn: x, fromIn: headIn + depth, toIn: topIn - 2 * THICK }); }
        if (o.type === 'window' && belowIn > 1) { short(belowIn); geo.shorts.push({ atIn: x, fromIn: THICK, toIn: o.sillIn - THICK }); }
      }
      if (o.type === 'window' && o.sillIn > 2 * THICK) {
        put('Opening Framing', size, what, boards(0, o.widthIn, [], stock), 'Laid flat under the window');
        geo.sills.push({ startIn: o.startIn, endIn: o.endIn, atIn: o.sillIn - THICK });
      }
    }
    for (const x of layout) full(Math.min(Math.max(x, THICK / 2), len - THICK / 2));
    fullCount += layout.length;
    put('Wall Studs', size, where, Array.from({ length: fullCount }, () => ({ cutIn, stockFt })));
    // Short studs above headers and under windows come out of 8 ft boards, several to a board.
    for (const [k, n] of Object.entries(shorts)) {
      const lengthIn = Number(k), perBoard = Math.floor((SHORT_STOCK_FT * 12) / lengthIn);
      if (perBoard < 1) put('Opening Framing', size, where, Array.from({ length: n }, () => ({ cutIn: lengthIn, stockFt: fitStock(lengthIn, studStock) })), 'Short stud above a header');
      else put('Opening Framing', size, where, Array.from({ length: Math.ceil(n / perBoard) }, () => ({ cutIn: SHORT_STOCK_FT * 12, stockFt: SHORT_STOCK_FT })), `Cut into short studs of ${feetInches(lengthIn)}, ${n} needed`);
    }

    // The bottom plate stops at each door; the top plates run through, with their joints stepped apart over studs.
    for (const [s, e] of spans(len, b.openings.filter((op) => op.wall === wall && op.toGround).map((op) => [op.startIn, op.endIn]))) {
      put('Bottom Plates', `${size} treated`, where, boards(s, e, all, stock), 'Bolted to the concrete');
      geo.plates.push([s, e]);
    }
    for (let row = 0; row < 2; row++) put('Top Plates', size, where, boards(0, len, all, stock, row === 1), 'Two rows, joints stepped apart');
    walls[wall] = geo;
  }

  if (!errors.length) {
    warnings.push({ code: 'stud-walls', text: `Stud walls stand on a concrete slab or foundation that the engineer designs. That concrete and the bolts into it are not on this list.${b.roof === 'hip' ? '' : ' Order the truss at each end wall as a gable end truss, so the wall above the top plates has uprights to take the siding.'}` });
    if (tallest > rules.studMaxHeightFt * 12 + EPS) {
      warnings.push({ code: 'stud-tall', text: `The walls stand ${feetInches(tallest)} tall. The building code table for stud walls stops at ${rules.studMaxHeightFt} ft, so the engineer has to size the studs for walls this tall.` });
    }
    if (anyOpening) warnings.push({ code: 'stud-headers', text: 'The headers over the doors and windows are listed at a starting size. The engineer or the lumber yard sets the real size from the roof load and the width of each opening.' });
  }
  return { runs, walls, errors, warnings };
}
