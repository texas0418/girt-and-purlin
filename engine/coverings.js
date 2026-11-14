// Roof and wall coverings other than screw-down rib steel: standing seam
// and shingles on the roof, board and batten or lap siding on the walls.
// The choice covers the whole building, lean-tos and porches included.
import { wallLengthIn, wallTopIn, isOpen, closedWalls, CORNERS } from './building.js';
import { wallPanels } from './metal.js';
import { shedMetal } from './sheds.js';
import { planePurlinRows } from './runs.js';
import { add, fitStock, feetInches } from './stock.js';

const EPS = 0.01;
const up = (n) => Math.ceil(n - EPS);
const line = (group, name, size, qty, more = {}) => ({ group, name, size, length: '', qty, ...more });

export const ROOF_COVERS = ['steel', 'standing', 'shingles'];
export const WALL_COVERS = ['steel', 'batten', 'lap'];

// Every roof surface on the job: the main roof planes, then each lean-to or porch.
function surfaces(b, rules, sheds) {
  const runIn = b.lengthIn + 2 * b.endOverhangIn;
  return [
    ...b.planes.map((p) => ({ name: 'The roof', pitch: p.pitch, slopeIn: p.slopeIn, runIn, rows: planePurlinRows(p, rules), eave: p.lowEdge === 'eave', top: p.highEdge })),
    ...sheds.map((s) => ({ name: `The ${s.label}`, pitch: s.pitch, slopeIn: s.slopeIn, runIn: s.lengthIn + 2 * b.overhangIn, rows: s.purlinRows, eave: true, top: 'wall' })),
  ];
}

// Boards that stand up a wall, cut from stock lengths. A wall taller than the
// longest board takes two or more boards end to end.
function standing(tallyIn, stockFt) {
  const out = {};
  const longest = Math.max(...stockFt) * 12;
  for (const [k, n] of Object.entries(tallyIn)) {
    const parts = up(Number(k) / longest);
    add(out, fitStock(Number(k) / parts, stockFt), n * parts);
  }
  return out;
}
const boardLines = (group, name, size, tally) => Object.keys(tally).map(Number).sort((x, y) => y - x)
  .map((k) => ({ group, name, size, length: `${k} ft`, qty: tally[k], ft: k }));

export function coverParts(b, rules, { sheds, roofTally, roofSqFt, wallSqFt }) {
  const o = b.options;
  const errors = [], warnings = [], items = [];
  const dropTrim = new Set();
  const roofs = surfaces(b, rules, sheds);

  if (o.roofCover !== 'steel' && o.skylights) errors.push('Skylight panels only fit rib steel. Take the skylights off or go back to steel panels on the roof.');

  if (o.roofCover === 'standing') {
    for (const r of roofs) {
      if (r.pitch < rules.seamMinPitch - EPS) errors.push(`${r.name} is flatter than ${rules.seamMinPitch} in 12. Standing seam on purlins needs at least that much slope.`);
    }
    const longest = Math.max(0, ...Object.keys(roofTally).map(Number));
    if (longest > rules.seamMaxPanelFt * 12 + EPS) {
      warnings.push({ code: 'seam-long', text: `The standing seam panels would be ${feetInches(longest)} long. They cannot be lapped end to end, and their maker recommends no longer than ${rules.seamMaxPanelFt} ft.` });
    }
    // One clip on every purlin row under every seam.
    const clips = roofs.reduce((n, r) => n + up(r.runIn / rules.seamCoverageIn) * r.rows, 0);
    items.push(
      line('Metal', 'Panel Clips', 'for standing seam', clips),
      line('Metal', 'Clip Screws', rules.seamClipScrewSize, clips * rules.seamScrewsPerClip),
    );
  }

  if (o.roofCover === 'shingles') {
    for (const r of roofs) {
      if (r.pitch < rules.shingleMinPitch - EPS) errors.push(`${r.name} is flatter than ${rules.shingleMinPitch} in 12. Shingles need at least that much slope.`);
    }
    for (const name of ['Ridge Cap', 'High Side Eave Trim', 'Gambrel Flashing', 'Eave Trim', 'Rake Trim']) dropTrim.add(name);
    // Two layers of underlayment on the flatter slopes, one on the rest.
    const feltSqFt = roofs.reduce((sum, r) => sum + (r.slopeIn * r.runIn) / 144 * (r.pitch < rules.underlaymentDoubleBelowPitch - EPS ? 2 : 1), 0);
    const covers = rules.dripEdgeIn - rules.dripEdgeLapIn;
    // Drip edge on every eave and rake, and along the high side of a single slope.
    const drip = roofs.reduce((n, r) => n + (r.eave ? up(r.runIn / covers) : 0) + (r.top === 'high' ? up(r.runIn / covers) : 0) + 2 * up(r.slopeIn / covers), 0);
    const starterIn = roofs.reduce((sum, r) => sum + (r.eave ? r.runIn : 0) + 2 * r.slopeIn, 0);
    const ridgeIn = b.planes.some((p) => p.highEdge === 'ridge') ? b.lengthIn + 2 * b.endOverhangIn : 0;
    const squares = roofSqFt * (1 + rules.shingleWaste) / 100;
    items.push(
      line('Roofing', 'Roof Sheathing', rules.roofSheathingSize, up(roofSqFt / 32)),
      line('Roofing', 'Roof Underlayment', `${rules.underlaymentSize}, roll`, up(feltSqFt / rules.underlaymentRollSqFt)),
      line('Roofing', 'Drip Edge', '', drip, { length: feetInches(rules.dripEdgeIn) }),
      line('Roofing', 'Starter Shingles', 'bundle', up(starterIn / 12 / rules.starterBundleFt)),
      line('Roofing', 'Shingles', 'architectural, bundle', up(squares * rules.shingleBundlesPerSquare)),
    );
    if (ridgeIn) items.push(line('Roofing', 'Ridge Shingles', 'bundle', up(ridgeIn / 12 / rules.ridgeBundleFt)));
    items.push(line('Roofing', 'Roofing Nails', 'each', up(squares * rules.roofingNailsPerSquare / 100) * 100));
    warnings.push({ code: 'shingle-load', text: 'Shingles and the sheathing under them weigh far more than steel. Tell the truss maker the roof is shingled, and have the engineer confirm the purlins under the sheathing.' });
  }

  if (o.wallCover !== 'steel') {
    for (const name of ['Corner Trim', 'Base Trim']) dropTrim.add(name);
    items.push(line('Siding', 'Wall Sheathing', rules.wallSheathingSize, up(wallSqFt / 32)));
    if (o.wallInsulation !== 'wrap') {
      items.push(line('Siding', 'House Wrap', `${rules.wrapRollWidthIn / 12} x ${rules.wrapRollFt} ft roll`, up(wallSqFt / ((rules.wrapRollWidthIn - rules.wrapLapIn) / 12 * rules.wrapRollFt))));
    }
    // Two boards wrap each outside corner; an enclosed lean-to adds two corners of its own.
    const corners = {};
    const cornerBoards = (heightIn) => { for (const [k, n] of Object.entries(standing({ [heightIn]: 2 }, rules.lumberStockFt))) add(corners, Number(k), n); };
    for (const [side, other] of CORNERS) if (!(isOpen(b, side) && isOpen(b, other))) cornerBoards(wallTopIn(b, side, 0));
    for (const s of sheds) if (s.enclosed) { cornerBoards(s.lowIn); cornerBoards(s.lowIn); }
    items.push(...boardLines('Siding', 'Corner Boards', rules.cornerBoardSize, corners));
  }

  if (o.wallCover === 'batten') {
    // Boards stand side by side like steel panels do, so they are counted the same way at their own width.
    const wide = { ...rules, panelCoverageIn: rules.battenBoardCoverIn };
    const main = wallPanels(b, wide);
    const tall = { ...main.tally };
    for (const more of [main.short, shedMetal(b, wide, sheds).wall]) for (const [k, n] of Object.entries(more)) add(tall, Number(k), n);
    const boards = standing(tall, rules.lumberStockFt);
    items.push(
      ...boardLines('Siding', 'Siding Boards', rules.battenBoardSize, boards),
      ...boardLines('Siding', 'Battens', rules.battenSize, boards),
    );
  }

  if (o.wallCover === 'lap') {
    // Wide doors are left out of the area; walk doors and windows are cut in on site.
    const doorSqFt = b.openings.filter((op) => (op.type === 'slider' || op.type === 'overhead') && !isOpen(b, op.wall))
      .reduce((sum, op) => sum + (op.widthIn * op.heightIn) / 144, 0);
    const exposureIn = rules.lapWidthIn - rules.lapOverlapIn;
    const pieces = up((wallSqFt - doorSqFt) * 144 * (1 + rules.lapWaste) / (exposureIn * rules.lapLengthFt * 12));
    items.push(
      line('Siding', 'Lap Siding', rules.lapSize, pieces, { length: `${rules.lapLengthFt} ft`, ft: rules.lapLengthFt }),
      line('Siding', 'Siding Nails', 'each', up(pieces * (rules.lapLengthFt * 12 / rules.lapNailSpacingIn + 1) / 100) * 100),
    );
  }

  return { errors: [...new Set(errors)], warnings, items, dropTrim };
}
