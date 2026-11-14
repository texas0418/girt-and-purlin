// Wings: a second building joined to a wall of the main one. Each wing is
// designed as a gable building of its own whose left end is the joined end,
// so every part of it is counted by the same code as the main building. This
// file checks that the two fit together, counts what the joint adds (valleys,
// the wing roof where it runs back over the main roof, flashing), and folds
// the wing's parts into the main list.
import { wallLengthIn, wallTopIn, isGable, roofRunIn } from './building.js';
import { boards, planePurlinRows } from './runs.js';
import { add } from './stock.js';

const EPS = 0.01;
const up = (n) => Math.ceil(n - EPS);

// The wing's walls as its owner sees them, standing outside and facing the end that sticks out.
// Inside the engine the wing is a building lying on its side: its right end is that front wall.
export const WING_WALLS = { end: 'right', left: 'front', right: 'back' };
export const WING_WALL_NAMES = { right: 'Front wall of the wing', front: 'Left side of the wing', back: 'Right side of the wing', left: 'Joined end' };
const RENAME = {
  'Front wall': 'Left side', 'Back wall': 'Right side', 'Right end': 'Front wall', 'Left end': 'Joined end',
  'front wall': 'left side', 'back wall': 'right side', 'right wall': 'front wall', 'left wall': 'joined end', 'right end': 'front wall', 'left end': 'joined end',
};
const RENAME_RE = new RegExp(Object.keys(RENAME).join('|'), 'g');
export const wingText = (text) => String(text).replace(RENAME_RE, (m) => RENAME[m]);

// Where a point of the wing sits on the main floor plan. x runs out from the
// joined wall, y runs across the wing. Every wing is a turn of the same shape, never a mirror.
export function wingPoint(b, wg, x, y) {
  if (wg.wall === 'right') return { x: b.lengthIn + x, y: wg.startIn + y };
  if (wg.wall === 'left') return { x: -x, y: wg.startIn + wg.widthIn - y };
  if (wg.wall === 'front') return { x: wg.startIn + y, y: -x };
  return { x: wg.startIn + wg.widthIn - y, y: b.widthIn + x };
}
// Quarter turns, counted the way the plan is drawn, from a wing on the right end.
export const WING_TURNS = { right: 0, back: 1, left: 2, front: 3 };

export function wingShape(b, wg) {
  if (isGable(wg.wall)) return 'In line';
  return wg.startIn < 1 || wg.endIn > wallLengthIn(b, wg.wall) - 1 ? 'L shape' : 'T shape';
}

// What the wing meets: a roof slope that comes down to the wall, or a wall that stands taller than the wing.
function host(b, wg) {
  const slope = (maxBackIn) => ({ type: 'slope', eaveIn: b.eaveIn, pitch: b.pitch, overIn: b.overhangIn, maxBackIn });
  const mid = wg.startIn + wg.widthIn / 2;
  if (b.roof === 'hip') return slope(Math.min(mid, wallLengthIn(b, wg.wall) - mid, b.widthIn / 2));
  if (isGable(wg.wall)) return { type: 'wall' };
  if (b.roof === 'gambrel') return { error: 'cannot join the side of a gambrel roof. Put it on an end wall.' };
  if (b.roof === 'mono') return wg.wall === 'front' ? slope(b.widthIn) : { type: 'wall' };
  return slope(b.widthIn / 2);
}

// The valleys, for a wing building b whose roof runs back onto a main roof slope.
// u is measured across the wing from its ridge. Null when the wing roof stays below the main roof.
export function valley(b) {
  const j = b.join;
  if (!j || j.type !== 'slope') return null;
  const kw = Math.hypot(12, b.pitch) / 12;
  const ridgeIn = b.eaveIn + (b.widthIn / 2) * b.pitch / 12;
  const fasciaIn = j.eaveIn - j.overIn * j.pitch / 12;
  if (ridgeIn < fasciaIn + 1) return null;
  const edgeIn = b.widthIn / 2 + b.overhangIn;
  // How far back over the main roof the wing ridge runs before it meets the slope.
  const backIn = (ridgeIn - j.eaveIn) * 12 / j.pitch;
  const footIn = Math.min((ridgeIn - fasciaIn) * 12 / b.pitch, edgeIn);
  // Where the valley comes down to: the main fascia, or the wing's own eave if that is higher.
  const footOutIn = -((ridgeIn - footIn * b.pitch / 12) - j.eaveIn) * 12 / j.pitch;
  const lengthIn = Math.hypot(backIn + footOutIn, footIn, footIn * b.pitch / 12);
  // Width of the wing roof, to one side of its ridge, at the main wall line.
  const atWallIn = backIn > EPS ? footIn * backIn / (backIn + footOutIn) : 0;
  return { backIn, footIn, footOutIn, atWallIn, lengthIn, kw, ridgeIn, edgeIn };
}

// Boards the joint adds to the wing's frame.
export function joinRuns(b, rules) {
  const v = valley(b), runs = [];
  if (!v) return runs;
  const stock = rules.lumberStockFt;
  for (let side = 0; side < 2; side++) {
    runs.push({ part: 'Valley Boards', size: rules.valleyBoardSize, where: 'Roof, at the valley', note: 'Laid flat on the main roof under the valley', pieces: boards(0, v.lengthIn, [], stock) });
  }
  if (v.backIn < 12 || v.atWallIn < EPS) return runs;
  // Each purlin row above the valley carries on back over the main roof until it meets the valley.
  for (let i = 0; i < planePurlinRows(b.planes[0], rules); i++) {
    const u = v.edgeIn - Math.min(i * rules.purlinSpacingIn, b.planes[0].slopeIn) / v.kw;
    const back = v.backIn * (1 - Math.max(u, 0) / v.atWallIn);
    if (back < 12) continue;
    for (let side = 0; side < 2; side++) {
      runs.push({ part: 'Roof Purlins', size: rules.purlinSize, where: 'Roof, at the valley', note: 'One end cut on the slant at the valley', pieces: boards(0, back, [], stock) });
    }
  }
  return runs;
}

// Panels, trim and closures the joint adds, in the same shape the lean-to count comes in.
export function joinMetal(b, rules) {
  const roof = {}, wall = {}, trim = {}, closures = {}, surfaces = [];
  let roofSqFt = 0;
  if (!b.join) return { roof, wall, trim, closures, roofSqFt, wallSqFt: 0, surfaces };
  const pieces = (runIn) => up(runIn / (rules.trimPieceIn - rules.trimLapIn));
  const v = valley(b), kw = Math.hypot(12, b.pitch) / 12, halfIn = b.widthIn / 2;
  // The wing's walls meet the main wall in an inside corner on each side.
  add(trim, 'Inside Corner Trim', 2 * pieces(b.eaveIn));
  // Where the top end of the wing roof stops against the main wall, flashing covers the joint.
  const againstWallIn = b.join.flush ? 0 : (halfIn - Math.min(v ? v.footIn : 0, halfIn)) * kw;
  if (againstWallIn > 1) add(trim, 'Sidewall Flashing', 2 * pieces(againstWallIn));
  if (v) {
    add(trim, 'Valley Flashing', 2 * pieces(v.lengthIn));
    if (v.backIn > 1 && v.atWallIn > 1) {
      const run = roofRunIn(b);
      add(trim, 'Ridge Cap', pieces(run + v.backIn) - pieces(run));
      add(closures, 'Outside Closures', 2 * up(v.backIn / rules.closureStripIn));
      // Panels over the main roof, each ordered at its longer edge and cut on the slant at the valley.
      for (let a = 0; a < v.backIn - EPS; a += rules.panelCoverageIn) {
        add(roof, up(v.atWallIn * (1 - a / v.backIn) * kw + rules.roofPanelExtraIn), 2);
      }
      const areaIn = v.backIn * v.atWallIn * kw / 2;
      roofSqFt = 2 * areaIn / 144;
      for (let side = 0; side < 2; side++) {
        surfaces.push({ name: 'The roof', pitch: b.pitch, slopeIn: v.atWallIn * kw, runIn: v.backIn, areaIn, rows: up(v.atWallIn * kw / rules.purlinSpacingIn), eave: false, top: 'ridge', rakes: 0 });
      }
    }
  }
  return { roof, wall, trim, closures, roofSqFt, wallSqFt: 0, surfaces };
}

// Designs every wing. design is the engine's own entry point, handed in so the two files do not import each other.
export function placeWings(b, input, ruleOverrides, design) {
  const wings = [], errors = [];
  for (const wg of b.wings) {
    const name = `Wing ${wg.index + 1}`;
    const h = host(b, wg);
    if (h.error) { errors.push(`${name} ${h.error}`); continue; }
    const ridgeIn = wg.eaveIn + (wg.widthIn / 2) * wg.pitch / 12;
    const tooTall = `${name} has a roof that would stand higher than the main roof where the two meet. Lower its roof pitch or wall height, or make it narrower.`;
    if (h.type === 'slope' && (ridgeIn - h.eaveIn) * 12 / h.pitch > h.maxBackIn + EPS) { errors.push(tooTall); continue; }
    if (h.type === 'wall' && ridgeIn > wallTopIn(b, wg.wall, wg.startIn + wg.widthIn / 2) + EPS) { errors.push(tooTall); continue; }
    // A wing the same size as the end it joins carries the main roof straight on, with no joint to flash.
    const flush = h.type === 'wall' && b.roof === 'gable' && Math.abs(wg.widthIn - b.widthIn) < EPS && Math.abs(wg.eaveIn - b.eaveIn) < EPS && Math.abs(wg.pitch - b.pitch) < EPS;
    const o = b.options;
    const sub = design({
      width: wg.widthIn / 12, length: wg.outIn / 12, eaveHeight: wg.eaveIn / 12, pitch: wg.pitch, roof: 'gable',
      overhang: b.overhangIn, endOverhang: b.endOverhangIn, postSpacing: b.postSpacingIn / 12, trussSpacing: b.trussSpacingIn / 12,
      framing: b.framing, studSize: b.studSize, studSpacing: b.studSpacingIn,
      loads: input.loads,
      // A wing follows the main building for its coverings and finish. What sits on the main roof or wall stays there.
      options: { ...input.options, wainscot: o.wainscotIn > 0, wainscotIn: o.wainscotIn || undefined, gutters: o.gutters, cupolas: false, skylights: 0, eaveLights: 'none' },
      openings: wg.openings.map((op) => ({ ...op, wall: WING_WALLS[op.wall] ?? op.wall })),
      join: { type: h.type, eaveIn: h.eaveIn, pitch: h.pitch, overIn: h.overIn, flush, sharedPosts: wg.between === 'open' && b.framing === 'post' },
    }, ruleOverrides);
    if (!sub.ok) { errors.push(...sub.errors.map((e) => `${name}: ${wingText(e)}`)); continue; }
    wings.push({ ...wg, name, shape: wingShape(b, wg), turns: WING_TURNS[wg.wall], valley: valley(sub.geometry.building), result: sub });
  }
  return { wings, errors };
}

// Folds the wings into the main result: one material list, one cut list, one set of totals.
export function mergeWings(result, wings) {
  if (!wings.length) return result;
  const items = result.items.map((i) => ({ ...i }));
  const same = (a, c) => a.group === c.group && a.name === c.name && a.size === c.size && a.length === c.length;
  // A warning about the opening into a wing is fixed on the Wings tab, so it carries no door to slide.
  const cuts = [...result.cuts], warnings = result.warnings.map((m) => { if (!(m.openingIndex >= 1000)) return m; const { openingIndex, slideByIn, otherSlideByIn, ...rest } = m; return rest; });
  const summary = { ...result.summary, wingSqFt: 0 };
  for (const w of wings) {
    const r = w.result;
    for (const item of r.items) {
      const found = items.find((i) => same(i, item));
      if (found) { found.qty += item.qty; continue; }
      // A part the main building does not have goes in beside its own kind.
      let at = items.findLastIndex((i) => i.group === item.group && i.name === item.name);
      if (at < 0) at = items.findLastIndex((i) => i.group === item.group);
      items.splice(at < 0 ? items.length : at + 1, 0, { ...item });
    }
    for (const c of r.cuts) cuts.push({ ...c, where: `${w.name}, ${wingText(c.where)}` });
    for (const warn of r.warnings) {
      if (warn.code === 'open-wall' || result.warnings.some((m) => m.code === warn.code && m.text === warn.text)) continue;
      const { openingIndex, slideByIn, otherSlideByIn, postAtIn, wall, ...rest } = warn;
      warnings.push({ ...rest, wing: w.index, wingOpening: openingIndex, wingSlideByIn: slideByIn, wingOtherSlideByIn: otherSlideByIn, text: `${w.name}: ${wingText(warn.text)}` });
    }
    summary.wingSqFt += r.summary.floorSqFt;
    for (const k of ['posts', 'trusses', 'roofSqFt', 'wallSqFt', 'screws', 'slabSqFt', 'linerSqFt']) summary[k] += r.summary[k];
  }
  const names = wings.map((w) => w.name).join(' and ').replace(/^(.*) and (.*) and /, '$1, $2 and ');
  warnings.push({ code: 'wing-join', text: `Where ${names} ${wings.length === 1 ? 'meets' : 'meet'} the main building, the framing is the engineer's to design: the valleys, the header over any opening between the two, and the load the wing roof puts on the main building. The list carries starting parts for the valleys and flashing only.` });
  return { ...result, items, cuts, warnings, summary, geometry: { ...result.geometry, wings } };
}
