// The cut list: every board, the length to cut it to, and the stock piece it
// comes out of. It walks the same rules the material count uses, so the two
// always agree.
import { wallLengthIn, isGable, WALLS } from './building.js';
import { fitStock, segments } from './stock.js';
import { slopeIn } from './framing.js';

const EPS = 0.01;
const WALL_NAMES = { front: 'Front wall', back: 'Back wall', left: 'Left end', right: 'Right end' };
const OPENING_NAMES = { slider: 'sliding door', walk: 'walk door', overhead: 'overhead door', window: 'window' };

// One run of lumber split into stock pieces: full sticks first, then the cut piece.
function pieces(lengthIn, stockFt) {
  const maxFt = Math.max(...stockFt);
  const out = [];
  let left = lengthIn;
  while (left > maxFt * 12 + EPS) { out.push({ stockFt: maxFt, cutIn: maxFt * 12 }); left -= maxFt * 12; }
  if (left > EPS) out.push({ stockFt: fitStock(left, stockFt), cutIn: left });
  return out;
}

function spans(b, wall, heightIn, groundOnly) {
  return b.openings
    .filter((o) => o.wall === wall && (groundOnly ? o.toGround : heightIn > o.sillIn + EPS && heightIn < o.sillIn + o.heightIn - EPS))
    .map((o) => [o.startIn, o.endIn]);
}

export function cutList(b, rules, posts) {
  const rows = new Map();
  const put = (part, size, where, piece, note = '') => {
    const cutIn = Math.round(piece.cutIn * 8) / 8;
    const key = [part, where, cutIn, piece.stockFt, note].join('|');
    const row = rows.get(key) ?? { part, size, where, cutIn, stockFt: piece.stockFt, note, qty: 0 };
    row.qty += 1;
    rows.set(key, row);
  };
  const run = (part, size, where, lengthIn, note) => {
    for (const p of pieces(lengthIn, rules.lumberStockFt)) put(part, size, where, p, note);
  };

  for (const p of posts) {
    put('Posts', rules.postSize, WALL_NAMES[p.wall], { stockFt: p.stockFt, cutIn: p.topIn + rules.postEmbedmentIn },
      isGable(p.wall) ? 'Top cut to the roof slope' : '');
  }

  const rowCount = Math.ceil((b.eaveIn - rules.skirtHeightIn) / rules.girtSpacingIn - EPS);
  for (const wall of WALLS) {
    const len = wallLengthIn(b, wall);
    for (const seg of segments(len, spans(b, wall, 0, true))) run('Skirt Boards', rules.skirtSize, WALL_NAMES[wall], seg);
    for (let i = 0; i < rowCount; i++) {
      const h = Math.min(rules.skirtHeightIn + (i + 1) * rules.girtSpacingIn, b.eaveIn);
      for (const seg of segments(len, spans(b, wall, h))) run('Wall Girts', rules.girtSize, WALL_NAMES[wall], seg);
    }
    if (isGable(wall)) {
      for (let up = rules.girtSpacingIn; up < b.riseIn - EPS; up += rules.girtSpacingIn) {
        run('Wall Girts', rules.girtSize, `${WALL_NAMES[wall]}, gable`, b.widthIn * (1 - up / b.riseIn), 'Ends cut to the roof slope');
      }
    }
  }

  const purlinRows = (Math.ceil(slopeIn(b) / rules.purlinSpacingIn - EPS) + 1) * 2;
  for (let i = 0; i < purlinRows; i++) run('Roof Purlins', rules.purlinSize, 'Roof', b.lengthIn + 2 * b.overhangIn);

  for (const o of b.openings) {
    const where = `${WALL_NAMES[o.wall]}, ${OPENING_NAMES[o.type]}`;
    for (let i = 0; i < 2; i++) run('Headers', rules.headerSize, where, o.widthIn);
    if (o.type === 'window') run('Opening Blocking', rules.girtSize, where, o.widthIn, 'Under the sill');
    if (o.type === 'slider') run('Opening Blocking', rules.girtSize, where, o.widthIn * 2, 'Backs the door track');
  }

  return [...rows.values()];
}
