// Lean-tos and porches: a single-slope roof hung on one wall of the main
// building. The high side sits on a ledger fastened to the main wall posts,
// the low side on a beam carried by its own row of posts.
//
// Along the host wall a shed runs from startIn to endIn, measured the same
// way as an opening. Out from the wall it runs depthIn.
import { wallLengthIn, isGable } from './building.js';
import { fitStock, add, feetInches } from './stock.js';
import { boards, WALL_NAMES } from './runs.js';

const EPS = 0.01;
const OUT = { front: [0, -1], back: [0, 1], left: [-1, 0], right: [1, 0] };
export const SHED_NAMES = { leanto: 'lean-to', porch: 'porch' };

function evenSpots(lengthIn, maxSpacingIn) {
  const bays = Math.max(1, Math.ceil(lengthIn / maxSpacingIn - EPS));
  return Array.from({ length: bays + 1 }, (_, i) => (i * lengthIn) / bays);
}

// A point in a shed, on the floor plan: atIn along the host wall, outIn away from it.
export function shedPoint(b, s, atIn, outIn) {
  const along = isGable(s.wall) ? { x: s.wall === 'left' ? 0 : b.lengthIn, y: atIn } : { x: atIn, y: s.wall === 'front' ? 0 : b.widthIn };
  const [ox, oy] = OUT[s.wall];
  return { x: along.x + ox * outIn, y: along.y + oy * outIn };
}

// Roof height above grade at a distance out from the host wall.
export const shedTopIn = (s, outIn) => s.highIn - outIn * s.pitch / 12;

// Sloped length of the roof from the host wall to the outer edge of the overhang.
export const shedSlopeIn = (b, s) => Math.hypot(s.depthIn + b.overhangIn, (s.depthIn + b.overhangIn) * s.pitch / 12);

export const shedLabel = (s) => `${WALL_NAMES[s.wall].replace(' wall', '')} ${s.wrap != null ? 'wraparound porch' : SHED_NAMES[s.kind]}`;

// Posts, rafters and rows for every shed. Errors stop the design.
export function placeSheds(b, rules) {
  const errors = [], warnings = [];
  const sheds = b.sheds.map((s, index) => {
    const name = `The ${s.wrap != null ? 'wraparound porch' : SHED_NAMES[s.kind]} on the ${s.wall} wall`;
    const posts = [];
    // A wraparound porch turns a corner at each end that meets another of its walls. The front
    // or back stretch owns that corner's post, hip rafter and hip cap; each stretch roofs its
    // own half of the corner square, a triangle from the building corner out to the hip.
    const reachIn = s.depthIn + b.overhangIn;
    const turns = [s.cornerStart ? -1 : 0, s.cornerEnd ? 1 : 0].filter(Boolean);
    const freeEnds = 2 - turns.length;
    const owned = isGable(s.wall) ? [] : turns;
    const post = (line, atIn, outIn) => {
      const topIn = shedTopIn(s, outIn);
      const stockFt = fitStock(topIn + rules.postEmbedmentIn, rules.postStockFt);
      if (stockFt === null) errors.push(`${name} needs a post ${feetInches(topIn + rules.postEmbedmentIn)} long, which is longer than any stocked post.`);
      posts.push({ shed: index, line, atIn, outIn, ...shedPoint(b, s, atIn, outIn), topIn, stockFt });
    };
    const outer = evenSpots(s.lengthIn, b.postSpacingIn).map((v) => s.startIn + v);
    for (const atIn of outer) post('outer', atIn, s.depthIn);
    const cornerAt = owned.map((t) => (t < 0 ? s.startIn - s.depthIn : s.endIn + s.depthIn));
    for (const atIn of cornerAt) post('corner', atIn, s.depthIn);
    // Enclosed side walls longer than one post bay get posts of their own.
    const sideOuts = s.enclosed ? evenSpots(s.depthIn, b.postSpacingIn).slice(1, -1) : [];
    for (const outIn of sideOuts) { post('start', s.startIn, outIn); post('end', s.endIn, outIn); }

    if (s.pitch < rules.minPanelPitch - EPS) {
      warnings.push({ code: 'shed-flat', shedIndex: index, text: `${name} is flatter than ${rules.minPanelPitch} in 12. Rib panels that flat need sealant in every lap, and most steel warranties do not cover them.` });
    }
    if (s.depthIn > rules.shedRafterMaxFt * 12 + EPS) {
      warnings.push({ code: 'shed-deep', shedIndex: index, text: `${name} is deeper than ${rules.shedRafterMaxFt} ft. Roofs that deep are normally framed with single-slope trusses, not rafters.` });
    }
    const slope = shedSlopeIn(b, s);
    const rafterStockFt = fitStock(slope, rules.rafterStockFt);
    if (rafterStockFt === null) {
      errors.push(`${name} needs rafters ${feetInches(slope)} long, which is longer than any stocked board. Make it shallower.`);
    }
    const rafters = evenSpots(s.lengthIn, rules.rafterSpacingIn).map((v) => s.startIn + v);
    const purlinRows = Math.ceil(slope / rules.purlinSpacingIn - EPS) + 1;
    // Jack rafters fill each corner triangle, from the hip down to the eave, at the rafter spacing out from the building corner.
    const jackOuts = [];
    for (let a = rules.rafterSpacingIn; turns.length && a < s.depthIn - EPS; a += rules.rafterSpacingIn) jackOuts.push(a);
    const k = slope / reachIn;
    const hipIn = Math.hypot(reachIn, reachIn, reachIn * s.pitch / 12);
    const hipStockFt = fitStock(hipIn, rules.rafterStockFt);
    if (owned.length && hipStockFt === null) errors.push(`${name} needs hip rafters ${feetInches(hipIn)} long, which is longer than any stocked board. Make it shallower.`);
    return {
      ...s, index, label: shedLabel(s), posts, outer, sideOuts, slopeIn: slope, rafters, rafterStockFt, purlinRows,
      turns, freeEnds, ownedCorners: owned, cornerAt, jackOuts, k, hipIn, hipStockFt, reachIn,
      // The roof as a rectangle between its ends, then the eave it drains to, then its whole area with the corner triangles.
      runIn: s.lengthIn + freeEnds * b.overhangIn,
      eaveRunIn: s.lengthIn + freeEnds * b.overhangIn + turns.length * reachIn,
      roofAreaIn: (s.lengthIn + freeEnds * b.overhangIn) * slope + turns.length * reachIn * slope / 2,
      beamStartIn: s.startIn - (s.cornerStart ? s.depthIn : 0), beamEndIn: s.endIn + (s.cornerEnd ? s.depthIn : 0),
    };
  });
  return { sheds, errors, warnings };
}

function girtHeights(topIn, rules) {
  const rows = Math.ceil((topIn - rules.skirtHeightIn) / rules.girtSpacingIn - EPS);
  return Array.from({ length: rows }, (_, i) => Math.min(rules.skirtHeightIn + (i + 1) * rules.girtSpacingIn, topIn));
}

export function shedRuns(b, rules, sheds, hostPosts) {
  const runs = [];
  const stock = rules.lumberStockFt;
  const put = (part, size, where, pieces, note = '') => runs.push({ part, size, where, note, pieces });

  for (const s of sheds) {
    const where = s.label;
    const hostAt = [0, wallLengthIn(b, s.wall), ...hostPosts.filter((p) => p.wall === s.wall).map((p) => p.atIn)];
    put('Rafter Ledgers', rules.shedLedgerSize, where, boards(s.startIn, s.endIn, hostAt, stock), 'Fastened across the main wall posts');
    for (let ply = 0; ply < 2; ply++) {
      put('Eave Beams', rules.shedBeamSize, where, boards(s.beamStartIn, s.beamEndIn, [...s.outer, ...s.cornerAt], stock, ply === 1), 'Two boards side by side on the outer posts');
    }
    put('Rafters', rules.rafterSize, where,
      s.rafters.map(() => ({ cutIn: s.slopeIn, stockFt: s.rafterStockFt })), 'Ends cut to the roof slope');
    for (const t of s.turns) {
      put('Rafters', rules.rafterSize, where, s.jackOuts.map((a) => ({ cutIn: (s.reachIn - a) * s.k, stockFt: fitStock((s.reachIn - a) * s.k, rules.rafterStockFt) })), 'Jack rafters at the corner, top cut to the hip');
      if (s.ownedCorners.includes(t)) put('Hip Rafters', rules.porchHipRafterSize, where, [{ cutIn: s.hipIn, stockFt: s.hipStockFt }], 'From the building corner out over the corner post');
    }
    for (let i = 0; i < s.purlinRows; i++) {
      // Rows are counted down from the main wall. At a corner each one runs on to the hip, so the lower rows reach farther.
      const outIn = Math.min(i * rules.purlinSpacingIn, s.slopeIn) / s.k;
      const startIn = s.startIn - (s.cornerStart ? outIn : b.overhangIn), endIn = s.endIn + (s.cornerEnd ? outIn : b.overhangIn);
      const at = [...s.rafters, ...(s.cornerStart ? s.jackOuts.map((a) => s.startIn - a) : []), ...(s.cornerEnd ? s.jackOuts.map((a) => s.endIn + a) : [])];
      put('Roof Purlins', rules.purlinSize, where, boards(startIn, endIn, at, stock, i % 2 === 1), s.turns.length && outIn > EPS ? 'End cut on the slant at the hip' : '');
    }
    if (!s.enclosed) continue;

    put('Skirt Boards', rules.skirtSize, `${where}, outer wall`, boards(s.startIn, s.endIn, s.outer, stock));
    girtHeights(s.lowIn, rules).forEach((h, row) => {
      put('Wall Girts', rules.girtSize, `${where}, outer wall`, boards(s.startIn, s.endIn, s.outer, stock, row % 2 === 1));
    });
    const sideAt = [0, s.depthIn, ...s.sideOuts];
    for (const side of ['left side', 'right side']) {
      put('Skirt Boards', rules.skirtSize, `${where}, ${side}`, boards(0, s.depthIn, sideAt, stock));
      girtHeights(s.highIn, rules).forEach((h, row) => {
        // Above the low eave each row stops where it meets the roof.
        const reach = h <= s.lowIn + EPS ? s.depthIn : s.depthIn * (s.highIn - h) / (s.highIn - s.lowIn);
        if (reach < 12) return;
        put('Wall Girts', rules.girtSize, `${where}, ${side}`, boards(0, reach, sideAt, stock, row % 2 === 1), reach < s.depthIn - EPS ? 'One end cut to the roof slope' : '');
      });
    }
  }
  return runs;
}

// Steel for the sheds, in the same shapes metal.js uses for the main building.
export function shedMetal(b, rules, sheds) {
  const roof = {}, wall = {}, trim = {}, closures = {};
  const covers = rules.trimPieceIn - rules.trimLapIn;
  const pieces = (runIn) => Math.ceil(runIn / covers - EPS);
  const strips = (runIn) => Math.ceil(runIn / rules.closureStripIn - EPS);
  let roofSqFt = 0, wallSqFt = 0;

  for (const s of sheds) {
    const runIn = s.runIn;
    add(roof, Math.ceil(s.slopeIn + rules.roofPanelExtraIn - EPS), Math.ceil(runIn / rules.panelCoverageIn - EPS));
    // In a corner triangle each panel is ordered at its longer edge, the one nearer the building corner, and cut on the slant.
    for (let a = 0; s.turns.length && a < s.reachIn - EPS; a += rules.panelCoverageIn) {
      add(roof, Math.ceil((s.reachIn - a) * s.k + rules.roofPanelExtraIn - EPS), s.turns.length);
    }
    roofSqFt += s.roofAreaIn / 144;
    add(trim, 'Endwall Flashing', pieces(runIn));
    add(trim, 'Eave Trim', pieces(s.eaveRunIn));
    if (s.freeEnds) add(trim, 'Rake Trim', pieces(s.slopeIn) * s.freeEnds);
    if (s.ownedCorners.length) add(trim, 'Hip Cap', pieces(s.hipIn) * s.ownedCorners.length);
    add(closures, 'Inside Closures', strips(s.eaveRunIn));
    add(closures, 'Outside Closures', strips(runIn));
    if (!s.enclosed) continue;

    add(wall, Math.ceil(s.lowIn - EPS), Math.ceil(s.lengthIn / rules.panelCoverageIn - EPS));
    const sidePanels = Math.ceil(s.depthIn / rules.panelCoverageIn - EPS);
    for (let i = 0; i < sidePanels; i++) {
      // Each side panel is ordered at its taller edge, the one nearer the main wall.
      add(wall, Math.ceil(shedTopIn(s, i * rules.panelCoverageIn) - EPS), 2);
    }
    wallSqFt += (s.lengthIn * s.lowIn + s.depthIn * (s.highIn + s.lowIn)) / 144;
    add(trim, 'Base Trim', pieces(s.lengthIn) + 2 * pieces(s.depthIn));
    add(trim, 'Corner Trim', pieces(s.lowIn) * 2);
    add(trim, 'Inside Corner Trim', pieces(s.highIn) * 2);
  }
  return { roof, wall, trim, closures, roofSqFt, wallSqFt };
}
