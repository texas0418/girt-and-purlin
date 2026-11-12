// Counts the steel: roof and wall panels, trim, and screws.
import { wallLengthIn, wallTopIn, isGable, WALLS } from './building.js';
import { add } from './stock.js';
import { slopeIn } from './framing.js';

const EPS = 0.01;

export function roofPanels(b, rules) {
  const perSide = Math.ceil((b.lengthIn + 2 * b.overhangIn) / rules.panelCoverageIn - EPS);
  const lengthIn = Math.ceil(slopeIn(b) + rules.roofPanelExtraIn - EPS);
  return { [lengthIn]: perSide * 2 };
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
      if (isGable(wall) && left < len / 2 && right > len / 2) tall = wallTopIn(b, wall, len / 2);
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
  return {
    'Ridge Cap': pieces(roofRun),
    'Eave Trim': pieces(roofRun) * 2,
    'Rake Trim': pieces(slopeIn(b)) * 4,
    'Corner Trim': pieces(b.eaveIn) * 4,
    'Base Trim': base,
  };
}

export function areas(b) {
  const roofSqFt = (2 * slopeIn(b) * (b.lengthIn + 2 * b.overhangIn)) / 144;
  const wallSqFt = (2 * (b.lengthIn + b.widthIn) * b.eaveIn + b.widthIn * b.riseIn) / 144;
  return { roofSqFt, wallSqFt };
}

export function screws(b, rules) {
  const { roofSqFt, wallSqFt } = areas(b);
  const count = Math.ceil((roofSqFt + wallSqFt) * rules.screwsPerSqFt - EPS);
  return { count, bags: Math.ceil(count / rules.screwsPerBag) };
}
