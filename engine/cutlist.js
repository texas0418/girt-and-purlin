// The cut list: every board, the length to cut it to, and the stock piece it
// comes out of. It reads the same runs the material count uses, so the two
// always agree.
import { isGable } from './building.js';
import { WALL_NAMES } from './runs.js';

export function cutList(rules, posts, runs) {
  const rows = new Map();
  const put = (part, size, where, piece, note = '') => {
    const cutIn = Math.round(piece.cutIn * 8) / 8;
    const key = [part, size, where, cutIn, piece.stockFt, note].join('|');
    const row = rows.get(key) ?? { part, size, where, cutIn, stockFt: piece.stockFt, note, qty: 0 };
    row.qty += 1;
    rows.set(key, row);
  };

  for (const p of posts) {
    put(p.column ? 'Laminated Columns' : 'Posts', p.column ? rules.columnSize : rules.postSize, p.where ?? WALL_NAMES[p.wall], { stockFt: p.stockFt, cutIn: p.topIn + rules.postEmbedmentIn },
      (p.where ? p.sloped : isGable(p.wall)) ? 'Top cut to the roof slope' : '');
  }
  for (const r of runs) for (const piece of r.pieces) put(r.part, r.size, r.where, piece, r.note);
  return [...rows.values()];
}
