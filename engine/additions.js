// Awnings and dormers: the two additions that stand on the building itself
// and need no posts of their own.
//
// An awning is a small single-slope roof hung on a wall with brackets, over a
// door or window or in a spot of its own. A dormer is a small roofed box
// framed on top of the main roof, on the front or back slope.
//
// Nothing here is engineered. Every size and spacing is a rule marked
// unverified, and the trusses under a dormer are left as they are.
import { roofTopIn, GAMBREL } from './building.js';
import { fitStock, add, feetInches } from './stock.js';
import { boards, WALL_NAMES } from './runs.js';

const EPS = 0.01;
const up = (n) => Math.ceil(n - EPS);
const hyp = (pitch) => Math.hypot(12, pitch) / 12;

export function placeAdditions(b, rules) {
  const errors = [], warnings = [];

  const awnings = b.awnings.map((a) => {
    const slopeIn = a.outIn * hyp(a.pitch);
    const name = `The awning on the ${a.wall} wall`;
    if (a.pitch < rules.minPanelPitch - EPS) {
      warnings.push({ code: 'shed-flat', shedIndex: a.index, text: `${name} is flatter than ${rules.minPanelPitch} in 12. Rib panels that flat need sealant in every lap, and most steel warranties do not cover them.` });
    }
    return {
      ...a, label: `${WALL_NAMES[a.wall].replace(' wall', '')} awning`, slopeIn,
      brackets: Math.max(2, up(a.widthIn / rules.awningBracketSpacingIn) + 1),
      rafterStockFt: fitStock(slopeIn, rules.rafterStockFt),
      purlinRows: up(slopeIn / rules.purlinSpacingIn) + 1,
    };
  });

  // Across the building, a gable or gambrel roof is the same on both slopes,
  // so a dormer is worked out by how far in it stands from its own wall.
  const half = b.widthIn / 2;
  const h = (y) => roofTopIn(b, y);
  // The first place, going in from the wall, where the main roof has climbed up to a line.
  const meet = (top, fromIn) => { for (let y = fromIn; y <= half + EPS; y += 0.25) if (h(y) >= top(y) - 1e-6) return y; return null; };
  // Length along the main roof between two distances in from the wall.
  const along = (y0, y1) => { let s = 0; for (let y = y0; y < y1 - 1e-6; y += 1) { const n = Math.min(y + 1, y1); s += Math.hypot(n - y, h(n) - h(y)); } return s; };
  // Area of a dormer side wall: the gap between its top line and the main roof.
  const gap = (top, y0, y1) => { let s = 0; for (let y = y0; y < y1 - 1e-6; y += 1) { const n = Math.min(y + 1, y1), m = (y + n) / 2; s += (n - y) * Math.max(0, top(m) - h(m)); } return s; };

  const dormers = [];
  for (const d of b.dormers) {
    const name = `Dormer ${d.index + 1}`;
    const y0 = rules.dormerSetbackIn, oh = rules.dormerOverhangIn;
    const pitch = d.style === 'shed' ? rules.dormerShedPitch : b.roof === 'gambrel' ? GAMBREL.upperPitch : b.pitch;
    let fit = null;
    // The face comes down in 6 in steps until the dormer roof gets back to the main roof below the ridge.
    for (let faceIn = rules.dormerFaceIn; !fit && faceIn >= rules.dormerFaceMinIn - EPS && y0 < half - 12; faceIn -= 6) {
      const topIn = h(y0) + faceIn;
      if (d.style === 'gable') {
        const ridgeIn = topIn + (d.widthIn / 2) * pitch / 12;
        const cheekEnd = meet(() => topIn, y0), back = meet(() => ridgeIn, y0);
        if (back !== null && back < half - EPS) fit = { faceIn, topIn, ridgeIn, cheekEnd, back, top: () => topIn };
      } else {
        const top = (y) => topIn + (y - y0) * pitch / 12;
        const back = meet(top, y0 + 1);
        if (back !== null && back < half - EPS) fit = { faceIn, topIn, ridgeIn: top(back), cheekEnd: back, back, top };
      }
    }
    if (!fit) {
      errors.push(d.style === 'shed'
        ? `${name} has a shed roof that never gets back to the main roof. The main roof has to be a good deal steeper than ${pitch} in 12 for that. Give the dormer a gable roof, or make the main roof steeper.`
        : `${name} does not fit on this roof. Make it narrower, or make the main roof steeper.`);
      continue;
    }
    const { top } = fit;
    const gable = d.style === 'gable';
    // Gable: two slopes, each from the dormer ridge down past its side wall. Shed: one slope from the main roof down past the face.
    const slopeIn = gable ? (d.widthIn / 2 + oh) * hyp(pitch) : (fit.back - y0 + oh) * hyp(pitch);
    const rafterStockFt = fitStock(slopeIn, rules.rafterStockFt);
    if (rafterStockFt === null) { errors.push(`${name} needs rafters ${feetInches(slopeIn)} long, which is longer than any stocked board. Give it a gable roof, or make the main roof steeper.`); continue; }
    const cheekPlanIn = fit.cheekEnd - y0;
    dormers.push({
      ...d, label: name, pitch, setbackIn: y0, overhangIn: oh, baseIn: h(y0), faceIn: fit.faceIn, topIn: fit.topIn, ridgeIn: fit.ridgeIn,
      cheekEndIn: fit.cheekEnd, backIn: fit.back, slopeIn, rafterStockFt,
      cheekPlanIn, cheekSlopeIn: along(y0, fit.cheekEnd), cheekAreaIn: gap(top, y0, fit.cheekEnd),
      cheekTopIn: gable ? cheekPlanIn : cheekPlanIn * hyp(pitch),
      cheekStuds: Array.from({ length: Math.max(0, up(cheekPlanIn / rules.dormerStudSpacingIn) - 1) }, (_, i) => { const y = y0 + (i + 1) * rules.dormerStudSpacingIn; return top(y) - h(y); }).filter((v) => v > 3),
      // The valley runs from the top of each side wall, where it dies into the main roof, up to where the dormer ridge lands.
      valleyIn: gable ? Math.hypot(fit.back - fit.cheekEnd, d.widthIn / 2, fit.ridgeIn - fit.topIn) : 0,
      windowWIn: d.widthIn - 24, windowHIn: fit.faceIn - 12,
    });
  }
  if (b.dormersLeftOff) warnings.push({ code: 'dormer-roof', text: `Dormers go on gable and gambrel roofs. The ${b.dormersLeftOff === 1 ? 'dormer is' : `${b.dormersLeftOff} dormers are`} left off this one.` });
  if (dormers.length) warnings.push({ code: 'dormer-framing', text: 'Dormers are framed on top of the roof, and the trusses under them are not cut. To open the ceiling up into a dormer, the truss maker has to design the trusses around it. The dormer lumber sizes are placeholders for the engineer.' });
  return { awnings, dormers, errors, warnings };
}

export function additionRuns(b, rules, { awnings, dormers }) {
  const runs = [];
  const stock = rules.lumberStockFt;
  const put = (part, size, where, pieces, note = '') => { if (pieces.length) runs.push({ part, size, where, note, pieces }); };
  const run = (lengthIn) => boards(0, lengthIn, [], stock);
  const cut = (lengthIn, stockFt = stock) => ({ cutIn: lengthIn, stockFt: fitStock(lengthIn, stockFt) });

  for (const a of awnings) {
    put('Rafter Ledgers', rules.shedLedgerSize, a.label, run(a.widthIn), 'Fastened through the wall steel into the girts');
    put('Rafters', rules.awningRafterSize, a.label, Array.from({ length: a.brackets }, () => ({ cutIn: a.slopeIn, stockFt: a.rafterStockFt })), 'One on each bracket');
    for (let i = 0; i < a.purlinRows; i++) put('Roof Purlins', rules.purlinSize, a.label, run(a.widthIn));
  }

  for (const d of dormers) {
    const gable = d.style === 'gable', w = d.widthIn, sp = rules.dormerStudSpacingIn, size = rules.dormerStudSize;
    const sideways = d.backIn - d.setbackIn + d.overhangIn;
    // Face wall: one plate on the roof, two on top, studs between.
    put('Dormer Framing', size, d.label, [...run(w), ...run(w), ...run(w)], 'Face wall plates, one under and two on top');
    put('Dormer Framing', size, d.label, Array.from({ length: up(w / sp) + 1 }, () => cut(d.faceIn)), 'Face wall studs');
    if (gable) {
      const short = [];
      for (let x = sp; x < w / 2 - EPS; x += sp) short.push(cut(x * d.pitch / 12), cut(x * d.pitch / 12));
      put('Dormer Framing', size, d.label, short, 'Studs in the gable over the face wall, top cut to the slope');
    }
    if (d.window) put('Dormer Framing', rules.dormerRafterSize, d.label, [cut(d.windowWIn), cut(d.windowWIn)], 'Header over the window');
    // Two side walls, each a wedge between the dormer roof and the main roof.
    for (let side = 0; side < 2; side++) {
      put('Dormer Framing', size, d.label, [...run(d.cheekSlopeIn), ...run(d.cheekTopIn)], 'Side wall plates, the lower one laid on the main roof');
      put('Dormer Framing', size, d.label, d.cheekStuds.map((v) => cut(v)), 'Side wall studs, bottom cut to the main roof');
    }
    const rs = rules.dormerRafterSize, rsp = rules.dormerRafterSpacingIn;
    if (gable) {
      const pairs = up(d.cheekPlanIn / rsp) + 1;
      put('Dormer Rafters', rs, d.label, Array.from({ length: pairs * 2 }, () => ({ cutIn: d.slopeIn, stockFt: d.rafterStockFt })), 'Rafters, in pairs');
      // Past the side walls the rafters land on the valley boards and get shorter toward the main roof.
      const jacks = [], tailIn = d.backIn - d.cheekEndIn;
      for (let y = rsp; y < tailIn - EPS; y += rsp) { const v = d.slopeIn * (1 - y / tailIn); if (v > 6) jacks.push(cut(v, rules.rafterStockFt), cut(v, rules.rafterStockFt)); }
      put('Dormer Rafters', rs, d.label, jacks, 'Short rafters down to the valleys');
      put('Dormer Rafters', rs, d.label, run(sideways), 'Ridge board');
      put('Dormer Rafters', rs, d.label, [...run(d.valleyIn), ...run(d.valleyIn)], 'Valley boards, laid flat on the main roof');
    } else {
      put('Dormer Rafters', rs, d.label, Array.from({ length: up(w / rsp) + 1 }, () => ({ cutIn: d.slopeIn, stockFt: d.rafterStockFt })), 'Rafters, from the main roof down over the face wall');
    }
    const rows = up(d.slopeIn / rules.purlinSpacingIn) + 1;
    for (let i = 0; i < rows * (gable ? 2 : 1); i++) put('Roof Purlins', rules.purlinSize, d.label, run(gable ? sideways : w + 2 * d.overhangIn));
  }
  return runs;
}

// Panels, trim and closures, in the same shape the lean-to count comes in so the two add together.
export function additionMetal(b, rules, { awnings, dormers }) {
  const roof = {}, wall = {}, trim = {}, closures = {}, surfaces = [];
  const covers = rules.trimPieceIn - rules.trimLapIn;
  const pieces = (runIn) => up(runIn / covers);
  const strips = (runIn) => up(runIn / rules.closureStripIn);
  const panels = (runIn) => up(runIn / rules.panelCoverageIn);
  let roofSqFt = 0, wallSqFt = 0;

  for (const a of awnings) {
    add(roof, up(a.slopeIn + rules.roofPanelExtraIn), panels(a.widthIn));
    roofSqFt += a.widthIn * a.slopeIn / 144;
    add(trim, 'Endwall Flashing', pieces(a.widthIn));
    add(trim, 'Eave Trim', pieces(a.widthIn));
    add(trim, 'Rake Trim', pieces(a.slopeIn) * 2);
    add(closures, 'Inside Closures', strips(a.widthIn));
    add(closures, 'Outside Closures', strips(a.widthIn));
    surfaces.push({ name: `The ${a.label.toLowerCase()}`, pitch: a.pitch, slopeIn: a.slopeIn, runIn: a.widthIn, rows: a.purlinRows, eave: true, top: 'wall' });
  }

  for (const d of dormers) {
    const gable = d.style === 'gable', w = d.widthIn, oh = d.overhangIn;
    const rows = up(d.slopeIn / rules.purlinSpacingIn) + 1;
    if (gable) {
      // Each slope is as long as the ridge at the top and as long as the side wall at the eave.
      // Panels are ordered full length for the whole ridge and cut on the slant at the valley.
      const ridgeRun = d.backIn - d.setbackIn + oh, eaveRun = d.cheekPlanIn + oh;
      const areaIn = (ridgeRun + eaveRun) / 2 * d.slopeIn;
      add(roof, up(d.slopeIn + rules.roofPanelExtraIn), panels(ridgeRun) * 2);
      roofSqFt += 2 * areaIn / 144;
      const peakIn = (w / 2) * d.pitch / 12;
      // The face is paneled to the peak; each panel is ordered at the full height and cut to the slope.
      add(wall, up(d.faceIn + peakIn), panels(w));
      wallSqFt += (w * d.faceIn + w * peakIn / 2) / 144;
      add(trim, 'Ridge Cap', pieces(ridgeRun));
      add(trim, 'Valley Flashing', pieces(d.valleyIn) * 2);
      add(trim, 'Rake Trim', pieces(d.slopeIn) * 2);
      add(trim, 'Eave Trim', pieces(eaveRun) * 2);
      add(closures, 'Inside Closures', strips(eaveRun) * 2);
      add(closures, 'Outside Closures', strips(ridgeRun) * 2);
      for (let i = 0; i < 2; i++) surfaces.push({ name: `The roof of ${d.label.toLowerCase()}`, pitch: d.pitch, slopeIn: d.slopeIn, runIn: eaveRun, areaIn, rows, eave: true, top: 'ridge', rakes: 1 });
    } else {
      const runIn = w + 2 * oh;
      add(roof, up(d.slopeIn + rules.roofPanelExtraIn), panels(runIn));
      roofSqFt += runIn * d.slopeIn / 144;
      add(wall, up(d.faceIn), panels(w));
      wallSqFt += w * d.faceIn / 144;
      add(trim, 'Transition Flashing', pieces(runIn));
      add(trim, 'Eave Trim', pieces(runIn));
      add(trim, 'Rake Trim', pieces(d.slopeIn) * 2);
      add(closures, 'Inside Closures', strips(runIn));
      add(closures, 'Outside Closures', strips(runIn));
      surfaces.push({ name: `The roof of ${d.label.toLowerCase()}`, pitch: d.pitch, slopeIn: d.slopeIn, runIn, rows, eave: true, top: 'wall' });
    }
    // Side walls: panels ordered at the tall end and cut down to the main roof.
    const tallIn = gable ? d.faceIn : Math.max(d.faceIn, ...d.cheekStuds, 0);
    add(wall, up(tallIn), panels(d.cheekPlanIn) * 2);
    wallSqFt += 2 * d.cheekAreaIn / 144;
    add(trim, 'Sidewall Flashing', pieces(d.cheekSlopeIn) * 2);
    add(trim, 'Endwall Flashing', pieces(w));
    add(trim, 'Corner Trim', pieces(d.faceIn) * 2);
  }
  return { roof, wall, trim, closures, roofSqFt, wallSqFt, surfaces };
}

// Parts that are bought whole, not cut from stock.
export function additionItems(b, rules, { awnings, dormers }) {
  const items = [];
  const brackets = {};
  for (const a of awnings) add(brackets, a.outIn / 12, a.brackets);
  for (const [ft, qty] of Object.entries(brackets)) items.push({ group: 'Framing', name: 'Awning Brackets', size: `steel, for a ${ft} ft awning`, length: '', qty });
  const windows = {};
  for (const d of dormers) if (d.window) add(windows, `${feetInches(d.windowWIn)} x ${feetInches(d.windowHIn)}`, 1);
  for (const [size, qty] of Object.entries(windows)) items.push({ group: 'Doors And Windows', name: 'Dormer Window', size, length: '', qty });
  return items;
}
