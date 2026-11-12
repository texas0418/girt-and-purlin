// Counts the steel: roof and wall panels, trim, and screws.
import { wallLengthIn, wallTopIn, gableAreaIn, isGable, WALLS } from './building.js';
import { add } from './stock.js';

const EPS = 0.01;

export function roofPanels(b, rules) {
  const perPlane = Math.ceil((b.lengthIn + 2 * b.overhangIn) / rules.panelCoverageIn - EPS);
  const tally = {};
  for (const p of b.planes) add(tally, Math.ceil(p.slopeIn + rules.roofPanelExtraIn - EPS), perPlane);
  return tally;
}

// Gable-end panels are ordered at the height of their taller edge and cut
// to the roof line on site.
export function wallPanels(b, rules) {
  const tally = {};
  for (const wall of WALLS) {
    const len = wallLengthIn(b, wall);
    const count = Math.ceil(len / rules.panelCoverageIn - EPS);
    for (let i = 0; i < count; i++) {
      const left = i * rules.panelCoverageIn;
      const right = Math.min(left + rules.panelCoverageIn, len);
      let tall = Math.max(wallTopIn(b, wall, left), wallTopIn(b, wall, right));
      // A panel that spans a peak or a break is as tall as the highest point it covers.
      if (isGable(wall)) for (const p of b.line) if (p.y > left && p.y < right) tall = Math.max(tall, p.h);
      add(tally, Math.ceil(tall - EPS));
    }
  }
  return tally;
}

export function trim(b, rules) {
  const covers = rules.trimPieceIn - rules.trimLapIn;
  const pieces = (runIn) => Math.ceil(runIn / covers - EPS);
  const roofRun = b.lengthIn + 2 * b.overhangIn;
  let base = 0;
  for (const wall of WALLS) {
    const doors = b.openings.filter((o) => o.wall === wall && o.toGround).reduce((sum, o) => sum + o.widthIn, 0);
    base += pieces(wallLengthIn(b, wall) - doors);
  }
  const edges = (kind) => b.planes.filter((p) => p.lowEdge === kind).length;
  const out = {};
  if (b.planes.some((p) => p.highEdge === 'ridge')) out['Ridge Cap'] = pieces(roofRun);
  if (b.roof === 'mono') out['High Side Eave Trim'] = pieces(roofRun);
  if (edges('break')) out['Gambrel Flashing'] = pieces(roofRun) * edges('break');
  out['Eave Trim'] = pieces(roofRun) * edges('eave');
  // Each plane gets its own rake piece at both ends of the building.
  out['Rake Trim'] = b.planes.reduce((n, p) => n + pieces(p.slopeIn) * 2, 0);
  out['Corner Trim'] = (pieces(wallTopIn(b, 'front', 0)) + pieces(wallTopIn(b, 'back', 0))) * 2;
  out['Base Trim'] = base;
  return out;
}

export function areas(b) {
  const roofSqFt = b.planes.reduce((sum, p) => sum + p.slopeIn, 0) * (b.lengthIn + 2 * b.overhangIn) / 144;
  const wallSqFt = (b.lengthIn * (wallTopIn(b, 'front', 0) + wallTopIn(b, 'back', 0)) + 2 * gableAreaIn(b)) / 144;
  return { roofSqFt, wallSqFt };
}

// Foam strips that seal the panel ribs: inside closures under the bottom edge
// of every roof plane, outside closures over its top edge under the ridge cap,
// the high side trim or the gambrel flashing.
export function closures(b, rules) {
  const strips = Math.ceil((b.lengthIn + 2 * b.overhangIn) / rules.closureStripIn - EPS) * b.planes.length;
  return { 'Inside Closures': strips, 'Outside Closures': strips };
}

// The published table steps up as the framing rows get closer together.
// Wider than the widest row in the table uses that row's count.
function perSquare(table, spacingIn) {
  const rows = Object.keys(table).map(Number).sort((x, y) => y - x);
  return table[rows.find((r) => r <= spacingIn + EPS) ?? rows[rows.length - 1]];
}

export function screws(b, rules, extra = { roofSqFt: 0, wallSqFt: 0 }, more = 0) {
  const main = areas(b);
  const roofSqFt = main.roofSqFt + extra.roofSqFt, wallSqFt = main.wallSqFt + extra.wallSqFt;
  const count = more + Math.ceil(
    (roofSqFt * perSquare(rules.screwsPerSquare, rules.purlinSpacingIn) + wallSqFt * perSquare(rules.screwsPerSquare, rules.girtSpacingIn)) / 100 - EPS,
  );
  return { count, bags: Math.ceil(count / rules.screwsPerBag) };
}
