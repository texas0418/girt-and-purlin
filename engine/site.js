// Where the building sits on its lot, for the site plan a permit office asks for.
// Everything here is plain arithmetic on figures the builder types in: the lot
// is taken as a rectangle, and no setback is assumed. Lot feet run X from the
// left lot line and Y from the front lot line.

export const FACINGS = { front: 'The Front Lot Line', left: 'The Left Lot Line', back: 'The Back Lot Line', right: 'The Right Lot Line' };
export const SITE_DEFAULTS = { lotWidth: 0, lotDepth: 0, fromLeft: 0, fromFront: 0, facing: 'front', setFront: 0, setSide: 0, setBack: 0, north: '' };

// Turns a spot in building feet (x along the length from the left end, y from
// the front wall toward the back) so the front wall faces the chosen lot line.
const TURN = {
  front: (x, y) => [x, y],
  back: (x, y) => [-x, -y],
  left: (x, y) => [y, -x],
  right: (x, y) => [-y, x],
};

export function placeOnLot(geometry, input = {}) {
  const site = { ...SITE_DEFAULTS, ...input };
  const b = geometry.building, L = b.lengthIn / 12, W = b.widthIn / 12;
  const turn = TURN[site.facing] ?? TURN.front;
  // Each part as a box in building feet: the main building, then every lean-to and porch.
  const parts = [{ label: 'Building', main: true, box: [0, 0, L, W] }];
  for (const s of geometry.sheds ?? []) {
    // A wraparound porch also covers the square outside each building corner it turns.
    const D = s.depthIn / 12, own = s.ownedCorners ?? [];
    const a = s.startIn / 12 - (own.includes(-1) ? D : 0), e = s.endIn / 12 + (own.includes(1) ? D : 0);
    const box = { front: [a, -D, e, 0], back: [a, W, e, W + D], left: [-D, a, 0, e], right: [L, a, L + D, e] }[s.wall];
    parts.push({ label: s.label[0].toUpperCase() + s.label.slice(1), main: false, open: !s.enclosed, box });
  }
  const turned = parts.map((p) => {
    const [x0, y0] = turn(p.box[0], p.box[1]), [x1, y1] = turn(p.box[2], p.box[3]);
    return { ...p, box: [Math.min(x0, x1), Math.min(y0, y1), Math.max(x0, x1), Math.max(y0, y1)] };
  });
  const minX = Math.min(...turned.map((p) => p.box[0])), minY = Math.min(...turned.map((p) => p.box[1]));
  const dx = site.fromLeft - minX, dy = site.fromFront - minY;
  const placed = turned.map((p) => ({ ...p, box: [p.box[0] + dx, p.box[1] + dy, p.box[2] + dx, p.box[3] + dy] }));
  const maxX = Math.max(...placed.map((p) => p.box[2])), maxY = Math.max(...placed.map((p) => p.box[3]));
  const round = (v) => Math.round(v * 1000) / 1000;
  const clear = { front: round(site.fromFront), left: round(site.fromLeft), right: round(site.lotWidth - maxX), back: round(site.lotDepth - maxY) };

  // Which lot line the front wall looks at, as the middle of that wall in lot feet.
  const [fx, fy] = turn(L / 2, 0);
  const problems = [];
  const ready = site.lotWidth > 0 && site.lotDepth > 0;
  if (!ready) problems.push('Type in the lot width and depth to see the site plan.');
  else {
    const names = { front: 'front', left: 'left', right: 'right', back: 'back' };
    const need = { front: site.setFront, left: site.setSide, right: site.setSide, back: site.setBack };
    for (const side of ['front', 'left', 'right', 'back']) {
      if (clear[side] < -0.001) problems.push(`The building runs ${feet(-clear[side])} past the ${names[side]} lot line.`);
      else if (need[side] > 0 && clear[side] < need[side] - 0.001) problems.push(`The building is ${feet(clear[side])} from the ${names[side]} lot line, inside the ${feet(need[side])} setback.`);
    }
  }
  return { site, ready, parts: placed, footprint: [site.fromLeft, site.fromFront, maxX, maxY].map(round), clear, frontWallAt: [round(fx + dx), round(fy + dy)], problems };
}

// 12.5 reads as 12 ft 6 in.
export function feet(v) {
  const whole = Math.floor(v + 1e-6), inches = Math.round((v - whole) * 12);
  if (inches === 12) return `${whole + 1} ft`;
  return inches ? `${whole} ft ${inches} in` : `${whole} ft`;
}
