// Test fit: will the tractor, camper or boat go through a door and sit on the
// floor? Each thing is a plain box whose size the builder types in from the
// maker's spec sheet, so no vehicle size is assumed here. Position is the
// box's near-left corner, in feet from the left end and from the front wall.
import { feetInches } from './stock.js';

const WALLS = { front: 'front wall', back: 'back wall', left: 'left end', right: 'right end' };
const DOORS = { slider: 'Sliding door', overhead: 'Overhead door', walk: 'Walk door', wing: 'Wing opening' };
// A 6x6 post, taken off the gap between post centers on an open wall.
const POST_IN = 6;
// The beam drawn over the posts of an open side wall is a 2x12 on edge.
const BEAM_IN = 11.25;
const EPS = 0.01;

export function testFit(geometry, things = []) {
  const b = geometry.building;
  const boxes = things.map((t) => {
    const along = (t.turned ? t.width : t.length) * 12, deep = (t.turned ? t.length : t.width) * 12;
    const x0 = (t.fromLeft ?? 0) * 12, y0 = (t.fromFront ?? 0) * 12;
    return { name: (t.name || 'Item').trim() || 'Item', x0, y0, x1: x0 + along, y1: y0 + deep, widthIn: t.width * 12, lengthIn: t.length * 12, heightIn: t.height * 12 };
  });

  return boxes.map((box, i) => {
    const problems = [];
    if (box.x0 < -EPS || box.y0 < -EPS || box.x1 > b.lengthIn + EPS || box.y1 > b.widthIn + EPS) problems.push('It does not sit inside the walls.');
    if (box.heightIn > b.eaveIn + EPS) problems.push(`It is taller than the ${feetInches(b.eaveIn)} under the trusses.`);
    const loft = geometry.loft;
    if (loft) {
      const lo = Math.min(loft.wallX, loft.edgeX), hi = Math.max(loft.wallX, loft.edgeX);
      if (box.x0 < hi - EPS && box.x1 > lo + EPS && box.heightIn > loft.underIn + EPS) problems.push(`It is taller than the ${feetInches(loft.underIn)} under the loft.`);
    }
    for (const p of geometry.partitions ?? []) {
      // A doorway does not help: these are 3 ft doors, and the wall still stands over the box.
      const crosses = p.axis === 'across'
        ? p.atIn > box.x0 + EPS && p.atIn < box.x1 - EPS && p.startIn < box.y1 - EPS && p.endIn > box.y0 + EPS
        : p.atIn > box.y0 + EPS && p.atIn < box.y1 - EPS && p.startIn < box.x1 - EPS && p.endIn > box.x0 + EPS;
      if (crosses) problems.push(`Interior wall ${p.index + 1} runs through it.`);
    }
    boxes.forEach((other, j) => {
      if (j !== i && box.x0 < other.x1 - EPS && box.x1 > other.x0 + EPS && box.y0 < other.y1 - EPS && box.y1 > other.y0 + EPS) problems.push(`It overlaps ${other.name}.`);
    });

    // Every way in: doors that reach the ground, and open walls between their posts.
    const ways = [];
    for (const o of b.openings) {
      if (!o.toGround) continue;
      ways.push({ label: `${DOORS[o.type]} on the ${WALLS[o.wall]}`, sideIn: o.widthIn - box.widthIn, topIn: o.heightIn - box.heightIn });
    }
    for (const wall of Object.keys(WALLS)) {
      if (!b.walls?.[wall]?.open) continue;
      const at = [0, ...geometry.posts.filter((p) => p.wall === wall).map((p) => p.atIn), wall === 'front' || wall === 'back' ? b.lengthIn : b.widthIn];
      const sorted = [...new Set(at)].sort((p, q) => p - q);
      const gap = Math.max(...sorted.slice(1).map((v, k) => v - sorted[k])) - POST_IN;
      const sideWall = wall === 'front' || wall === 'back';
      ways.push({ label: `Open ${WALLS[wall]}, between posts`, sideIn: gap - box.widthIn, topIn: b.eaveIn - (sideWall ? BEAM_IN : 0) - box.heightIn });
    }
    const through = ways.filter((w) => w.sideIn >= -EPS && w.topIn >= -EPS);
    if (!through.length) problems.push(ways.length ? 'No door is big enough to get it in.' : 'There is no door that reaches the ground.');
    return { ...box, index: i, ok: !problems.length, problems, through };
  });
}

// "1 ft 6 in to spare side to side and 6 in overhead"
const plainFeet = (inches) => {
  const whole = Math.max(0, Math.round(inches)), ft = Math.floor(whole / 12), rest = whole - ft * 12;
  return [ft ? `${ft} ft` : '', rest || !ft ? `${rest} in` : ''].filter(Boolean).join(' ');
};
export const spare = (w) => `${plainFeet(w.sideIn)} to spare side to side and ${plainFeet(w.topIn)} overhead`;
