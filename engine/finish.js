// Everything past the bare shell: wainscot, gutters, the steel liner,
// insulation, footings, the slab, ridge vent and skylight panels. Each part
// is counted only when the job turns it on in its options.
import { wallLengthIn, wallTopIn, isOpen, isGable, closedWalls, litWalls, CORNERS } from './building.js';
import { wallAreaIn, doorOver } from './metal.js';
import { add, fitStock, spans, feetInches } from './stock.js';
import { boards, openSpans, WALL_NAMES } from './runs.js';
import { ceilingFactor } from './trusses.js';

const EPS = 0.01;
const up = (n) => Math.ceil(n - EPS);

// Wall runs that carry base trim: each wall less its ground-level doors, then the walls of enclosed lean-tos.
export function baseRuns(b, sheds = []) {
  const runs = closedWalls(b).map((wall) => wallLengthIn(b, wall)
    - b.openings.filter((o) => o.wall === wall && o.toGround).reduce((sum, o) => sum + o.widthIn, 0));
  for (const s of sheds) if (s.enclosed) runs.push(s.lengthIn, s.depthIn, s.depthIn);
  return runs;
}

// Extra boards the finish options add to the frame.
export function finishRuns(b, rules, posts, trusses, sheds) {
  const runs = [];
  const o = b.options, stock = rules.lumberStockFt;
  const put = (part, size, where, pieces, note = '') => runs.push({ part, size, where, note, pieces });

  for (const wall of closedWalls(b)) {
    const len = wallLengthIn(b, wall);
    const supports = [0, len, ...posts.filter((p) => p.wall === wall).map((p) => p.atIn)];
    if (o.wainscotIn) {
      for (const [s, e] of spans(len, openSpans(b, wall, o.wainscotIn))) {
        put('Wainscot Girts', rules.wainscotGirtSize, WALL_NAMES[wall], boards(s, e, supports, stock), 'Backs the joint between wainscot and wall steel');
      }
    }
    if (litWalls(b).includes(wall)) {
      put('Eave Light Girts', rules.eaveLightGirtSize, WALL_NAMES[wall], boards(0, len, supports, stock), 'Backs the joint between the eave lights and the wall steel');
    }
    if (o.linerWalls) {
      const rows = up(b.eaveIn / rules.linerGirtSpacingIn);
      for (let row = 0; row < rows; row++) {
        const h = Math.min((row + 1) * rules.linerGirtSpacingIn, b.eaveIn);
        for (const [s, e] of spans(len, openSpans(b, wall, h))) {
          put('Liner Girts', rules.linerGirtSize, `${WALL_NAMES[wall]}, inside`, boards(s, e, supports, stock, row % 2 === 1));
        }
      }
    }
  }
  if (o.wainscotIn) {
    for (const s of sheds.filter((sh) => sh.enclosed)) {
      put('Wainscot Girts', rules.wainscotGirtSize, `${s.label}, outer wall`, boards(s.startIn, s.endIn, s.outer, stock));
      for (const side of ['left side', 'right side']) {
        put('Wainscot Girts', rules.wainscotGirtSize, `${s.label}, ${side}`, boards(0, s.depthIn, [0, s.depthIn, ...s.sideOuts], stock));
      }
    }
  }
  // Trusses wider apart than the liner can span get joists hung between their bottom chords.
  if (o.linerCeiling && b.trussSpacingIn > rules.linerSupportMaxIn + EPS) {
    // A vaulted ceiling has two slopes, each with its own rows, and one more row at the peak.
    const vault = b.truss === 'scissor';
    const planeIn = (vault ? b.widthIn / 2 : b.widthIn) * ceilingFactor(b);
    const rows = vault ? 2 * (up(planeIn / rules.linerSupportMaxIn) - 1) + 1 : up(planeIn / rules.linerSupportMaxIn) - 1;
    for (let i = 1; i < trusses.length; i++) {
      const bay = trusses[i].x - trusses[i - 1].x;
      put('Ceiling Joists', rules.ceilingJoistSize, 'Ceiling', Array.from({ length: rows }, () => ({ cutIn: bay, stockFt: fitStock(bay, stock) })), 'Hung between truss bottom chords');
    }
  }
  return runs;
}

// Ceiling liner panels. They cross their supports, so they run along the
// building under close trusses and across it under added joists.
function ceilingPanels(b, rules, trusses) {
  const tally = {};
  const maxFt = [rules.linerMaxPanelFt];
  const close = b.trussSpacingIn <= rules.linerSupportMaxIn + EPS;
  // A vaulted ceiling is two sloped planes that meet at the peak; a flat one is a single plane.
  const planes = b.truss === 'scissor' ? 2 : 1;
  const planeIn = (b.widthIn / planes) * ceilingFactor(b);
  const runIn = close ? b.lengthIn : planeIn;
  const across = close ? planeIn : b.lengthIn;
  const rows = up(planeIn / rules.linerSupportMaxIn);
  const supports = close ? trusses.map((t) => t.x) : Array.from({ length: rows + 1 }, (_, i) => (i * planeIn) / rows);
  const pieces = boards(0, runIn, supports, maxFt);
  pieces.forEach((p, i) => add(tally, up(p.cutIn + (i < pieces.length - 1 ? rules.linerEndLapIn : 0)), planes * up(across / rules.panelCoverageIn)));
  return tally;
}

const line = (group, name, size, qty, more = {}) => ({ group, name, size, length: '', qty, ...more });

// The counted parts. wallTally and roofTally are the panel counts so far; they come back adjusted.
export function finishParts(b, rules, { posts, trusses, sheds, wallTally, roofTally, mainRoofPanelIn }) {
  const o = b.options;
  const items = [], warnings = [], errors = [];
  const pieces = (runIn, lapIn = rules.trimLapIn) => up(runIn / (rules.trimPieceIn - lapIn));
  const trim = {};
  let screws = 0;
  const floorSqFt = (b.widthIn * b.lengthIn) / 144;
  // A vaulted ceiling meets the end walls along its slopes, and is that much bigger than the floor.
  const vault = ceilingFactor(b);
  const perimeterIn = 2 * (b.widthIn * vault + b.lengthIn);
  const vaulted = b.truss === 'scissor';
  const closedIn = closedWalls(b).reduce((sum, wall) => sum + wallLengthIn(b, wall), 0);
  const roofRunIn = b.lengthIn + 2 * b.endOverhangIn;

  // Wainscot: every wall panel is cut in two, with Z trim over the joint. Z trim butts end to end.
  let walls = wallTally;
  const wainscot = {};
  if (o.wainscotIn) {
    walls = {};
    for (const [k, n] of Object.entries(wallTally)) {
      add(walls, Number(k) - o.wainscotIn, n);
      add(wainscot, o.wainscotIn, n);
    }
    add(trim, 'Wainscot Trim', baseRuns(b, sheds).reduce((sum, run) => sum + pieces(run, 0), 0));
  }

  // Eave lights: clear panels across the top of a side wall, with Z trim over the joint.
  const metal = [];
  const lit = litWalls(b);
  let lights = 0;
  for (const wall of lit) {
    const len = wallLengthIn(b, wall), top = wallTopIn(b, wall, 0), joint = top - rules.eaveLightIn;
    const name = WALL_NAMES[wall].toLowerCase();
    if (joint < o.wainscotIn + 12) errors.push(`The ${name} is too short for eave lights, which take the top ${feetInches(rules.eaveLightIn)}.`);
    if (b.openings.some((op) => op.wall === wall && op.sillIn + op.heightIn > joint + EPS)) errors.push(`A door or window on the ${name} reaches into the top ${feetInches(rules.eaveLightIn)}, where the eave lights go. Lower it or take the eave lights off that wall.`);
    if (sheds.some((s) => s.wall === wall)) errors.push(`The ${name} has a lean-to or porch against it, so it cannot take eave lights.`);
    lights += up(len / rules.panelCoverageIn);
    add(trim, 'Eave Light Trim', pieces(len, 0));
  }
  if (lights) metal.push({ group: 'Metal', name: 'Eave Light Panels', size: 'clear polycarbonate', length: feetInches(rules.eaveLightIn), qty: lights, ft: rules.eaveLightIn / 12 });
  if (lit.length && o.linerWalls) warnings.push({ code: 'eave-light-liner', text: 'The steel wall liner covers the eave lights from the inside. Stop the liner below them on site, or leave one of the two off.' });

  // Skylight panels take the place of roof panels on the main roof.
  let roof = roofTally;
  if (o.skylights) {
    if (o.skylights > roofTally[mainRoofPanelIn]) errors.push(`The roof has ${roofTally[mainRoofPanelIn]} panels, so it cannot take ${o.skylights} skylight panels.`);
    roof = { ...roofTally, [mainRoofPanelIn]: roofTally[mainRoofPanelIn] - o.skylights };
    if (!roof[mainRoofPanelIn]) delete roof[mainRoofPanelIn];
    if (mainRoofPanelIn > rules.skylightMaxFt * 12 + EPS) {
      warnings.push({ code: 'skylight-long', text: `The skylight panels would be ${feetInches(mainRoofPanelIn)} long. Their maker recommends no longer than ${rules.skylightMaxFt} ft.` });
    }
  }
  if (o.skylights) metal.push({ group: 'Metal', name: 'Skylight Panels', size: 'clear polycarbonate', length: feetInches(mainRoofPanelIn), qty: o.skylights, ft: mainRoofPanelIn / 12 });
  const hasRidge = b.planes.some((p) => p.highEdge === 'ridge');
  if (o.ridgeVent && !hasRidge) warnings.push({ code: 'no-ridge', text: 'A single-slope roof has no ridge, so no ridge vent is counted.' });
  if (o.ridgeVent && hasRidge) metal.push({ group: 'Metal', name: 'Ridge Vent', size: '', length: feetInches(rules.ridgeVentPieceIn), qty: up(roofRunIn / rules.ridgeVentPieceIn) });

  // Cupolas sit on the ridge: one in the middle, or two at the quarter points.
  let cupolas = [];
  if (o.cupolas && !hasRidge) warnings.push({ code: 'no-ridge-cupola', text: 'A single-slope roof has no ridge, so no cupola is counted.' });
  if (o.cupolas && hasRidge) {
    const table = rules.cupolaByRidgeFt;
    const [, count, autoIn] = table.find(([maxFt]) => b.lengthIn <= maxFt * 12 + EPS) ?? table[table.length - 1];
    const sizeIn = o.cupolaSizeIn || autoIn;
    cupolas = (count === 1 ? [0.5] : [0.25, 0.75]).map((share) => ({ x: b.lengthIn * share, sizeIn }));
    metal.push({ group: 'Metal', name: 'Cupolas', size: `${sizeIn} in square`, length: '', qty: count });
    const ridgePitch = Math.max(...b.planes.filter((p) => p.highEdge === 'ridge').map((p) => p.pitch));
    if (ridgePitch > rules.cupolaBaseMaxPitch + EPS) {
      warnings.push({ code: 'cupola-steep', text: `A standard cupola base fits roofs up to ${rules.cupolaBaseMaxPitch} in 12. This roof needs the high pitch base.` });
    }
  }

  if (o.gutters) {
    const eaves = [...b.planes.filter((p) => p.lowEdge === 'eave').map((p) => ({ runIn: roofRunIn, highIn: p.lowIn })),
      ...sheds.map((s) => ({ runIn: s.lengthIn + 2 * b.overhangIn, highIn: s.lowIn }))];
    const t = { sections: 0, joiners: 0, hangers: 0, caps: 0, spouts: 0, spoutSections: 0 };
    for (const e of eaves) {
      const sections = up(e.runIn / rules.gutterSectionIn);
      const spouts = up(e.runIn / (rules.downspoutMaxRunFt * 12));
      t.sections += sections; t.joiners += sections - 1; t.caps += 2; t.spouts += spouts;
      t.hangers += up(e.runIn / rules.gutterHangerSpacingIn) + 1;
      t.spoutSections += spouts * up(e.highIn / rules.gutterSectionIn);
    }
    const len = feetInches(rules.gutterSectionIn);
    items.push(
      { ...line('Gutters', 'Gutter', '', t.sections), length: len },
      line('Gutters', 'Gutter Joiners', '', t.joiners),
      line('Gutters', 'Gutter End Caps', '', t.caps),
      line('Gutters', 'Gutter Hangers', '', t.hangers),
      line('Gutters', 'Gutter Outlets', '', t.spouts),
      { ...line('Gutters', 'Downspouts', '', t.spoutSections), length: len },
      line('Gutters', 'Downspout Elbows', '', t.spouts * rules.elbowsPerDownspout),
      line('Gutters', 'Downspout Bands', '', t.spoutSections * rules.downspoutBandsPerSection),
    );
  }

  const liner = {};
  let linerSqFt = 0;
  if (o.linerWalls) {
    // Like the outside steel, a liner panel wholly inside a wide door only covers the wall above it.
    for (const wall of closedWalls(b)) {
      const len = wallLengthIn(b, wall);
      for (let left = 0; left < len - EPS; left += rules.panelCoverageIn) {
        const door = doorOver(b, wall, left, Math.min(left + rules.panelCoverageIn, len));
        // Under a vaulted ceiling the end wall liner climbs to the ceiling line, so each panel is cut for its taller edge.
        const right = Math.min(left + rules.panelCoverageIn, len);
        const nearMid = Math.min(Math.max(len / 2, left), right);
        const tall = b.eaveIn + (vaulted && isGable(wall) ? Math.min(nearMid, len - nearMid) * b.ceilingPitch / 12 : 0);
        if (!door) add(liner, up(tall));
        else if (tall - door.heightIn > EPS) add(liner, up(tall - door.heightIn));
      }
      // The triangle of end wall between the eave line and the vaulted ceiling.
      if (vaulted && isGable(wall)) linerSqFt += (len * (len / 2) * b.ceilingPitch / 12) / 2 / 144;
    }
    linerSqFt += (closedIn * b.eaveIn) / 144;
    // Liner turns an inside corner only where two closed walls meet.
    const corners = CORNERS.filter((pair) => !pair.some((wall) => isOpen(b, wall))).length;
    if (corners) add(trim, 'Inside Corner Trim', pieces(b.eaveIn) * corners);
  }
  if (o.linerCeiling) {
    for (const [k, n] of Object.entries(ceilingPanels(b, rules, trusses))) add(liner, Number(k), n);
    linerSqFt += floorSqFt * vault;
  }
  if (o.linerWalls || o.linerCeiling) {
    add(trim, 'J-Channel', pieces(o.linerCeiling ? perimeterIn : closedIn));
    screws += up(linerSqFt * rules.linerScrewsPerSquare / 100);
  }

  // Insulation is measured over the building itself, not the overhangs or lean-tos.
  const roofSqFt = b.planes.reduce((sum, p) => sum + p.bareSlopeIn, 0) * b.lengthIn / 144;
  const wallSqFt = wallAreaIn(b) / 144;
  const rolls = (sqFt, widthIn, lengthFt, lapIn) => up(sqFt / ((widthIn - lapIn) / 12 * lengthFt));
  for (const [where, kind, sqFt] of [['Roof', o.roofInsulation, roofSqFt], ['Wall', o.wallInsulation, wallSqFt]]) {
    if (kind === 'bubble') {
      items.push(line('Insulation', `${where} Bubble Insulation`, `${rules.bubbleRollWidthIn / 12} x ${rules.bubbleRollFt} ft roll`, rolls(sqFt, rules.bubbleRollWidthIn, rules.bubbleRollFt, rules.bubbleLapIn)));
    } else if (kind === 'fiberglass') {
      items.push(line('Insulation', `${where} Fiberglass Insulation`, rules.fiberglassSize, 1, { length: `${Math.ceil(sqFt)} sq ft`, sqFt: Math.ceil(sqFt) }));
    } else if (kind === 'wrap') {
      items.push(line('Insulation', 'House Wrap', `${rules.wrapRollWidthIn / 12} x ${rules.wrapRollFt} ft roll`, rolls(sqFt, rules.wrapRollWidthIn, rules.wrapRollFt, rules.wrapLapIn)));
    }
  }
  if (o.ceilingR) {
    if (!o.linerCeiling) errors.push('Blown insulation needs a ceiling under it. Turn on the ceiling liner first.');
    items.push(line('Insulation', 'Blown Ceiling Insulation', `R-${o.ceilingR}, bags`, up(floorSqFt * vault / 1000 * rules.blownBagsPer1000[o.ceilingR])));
  }

  const postCount = posts.length;
  if (o.footing === 'pad') items.push(line('Concrete', 'Footing Pads', rules.footingPadSize, postCount));
  if (o.footing === 'collar') {
    const holeCuFt = Math.PI * (rules.collarDiameterIn / 2) ** 2 * rules.collarDepthIn / 1728;
    items.push(line('Concrete', 'Concrete Mix', '80 lb bag', up(postCount * holeCuFt / rules.bagYieldCuFt)));
  }
  if (o.footing === 'bracket') {
    items.push(line('Concrete', 'Post Brackets', `Bolt-down, for ${rules.postSize} posts, with the maker's hardware`, postCount));
    if (!o.slab) warnings.push({ code: 'bracket-no-concrete', text: 'Post brackets bolt down to concrete. No slab is turned on, so the piers or wall under the brackets are not on this list.' });
  }
  let slabSqFt = 0;
  if (o.slab) {
    slabSqFt = floorSqFt + sheds.filter((s) => s.enclosed).reduce((sum, s) => sum + (s.lengthIn * s.depthIn) / 144, 0);
    items.push(
      line('Concrete', 'Slab Concrete', `${rules.slabThicknessIn} in thick, cubic yards`, up(slabSqFt / rules.slabSqFtPerYard)),
      line('Concrete', 'Slab Vapor Barrier', `${rules.vaporRollWidthFt} x ${rules.vaporRollFt} ft roll`, rolls(slabSqFt, rules.vaporRollWidthFt * 12, rules.vaporRollFt, rules.vaporLapIn)),
    );
  }

  return { items, metal, warnings, errors, cupolas, walls, roof, wainscot, liner, trim, screws, linerSqFt, slabSqFt };
}

export const FINISH_LUMBER = ['Wainscot Girts', 'Eave Light Girts', 'Liner Girts', 'Ceiling Joists'];
