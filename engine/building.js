// The building description: what the user enters. Feet in, inches inside.
//
// Walls are named as seen on a floor plan with the front wall at the bottom:
//   front and back are the long eave walls, left and right are the gable ends.
// An opening's offset is measured along its wall from the front-left corner
// (front and back walls) or from the front wall (left and right walls).

import { defaultRules } from './rules.js';

// The lowest a lean-to or porch roof may come: a walk door still fits under it.
export const MIN_SHED_LOW_IN = 84;
export const WALLS = ['front', 'back', 'left', 'right'];
const GROUND_DOORS = new Set(['slider', 'walk', 'overhead']);
const TYPES = new Set([...GROUND_DOORS, 'window']);
const SHEDS = { leanto: 'lean-to', porch: 'porch' };
export const ROOFS = ['gable', 'mono', 'gambrel'];
// Scissor and attic trusses go with a gable roof. Other roofs take the truss their shape calls for.
export const TRUSSES = ['common', 'scissor', 'attic'];
// A gambrel's proportions are fixed by the rules: the lower slope, the upper slope, and where the break sits.
export const GAMBREL = { lowerPitch: defaultRules.gambrelLowerPitch.value, upperPitch: defaultRules.gambrelUpperPitch.value, breakShare: defaultRules.gambrelBreakShare.value };
const NAMES = { slider: 'sliding door', walk: 'walk door', overhead: 'overhead door', window: 'window' };

export function normalize(input) {
  const errors = [];
  const num = (v, name, min, max) => {
    if (typeof v !== 'number' || !Number.isFinite(v)) { errors.push(`${name} is missing.`); return 0; }
    if (v < min || v > max) errors.push(`${name} must be between ${min} and ${max}.`);
    return v;
  };

  const b = {
    widthIn: num(input.width, 'Width', 8, 100) * 12,
    lengthIn: num(input.length, 'Length', 8, 400) * 12,
    eaveIn: num(input.eaveHeight, 'Wall height', 6, 24) * 12,
    pitch: num(input.pitch ?? 4, 'Roof pitch', 1, 12),
    overhangIn: num(input.overhang ?? 12, 'Overhang', 0, 36),
    // The roof can run a different distance past the end walls than past the side walls.
    endOverhangIn: num(input.endOverhang ?? input.overhang ?? 12, 'End overhang', 0, 36),
    postSpacingIn: num(input.postSpacing ?? 8, 'Post spacing', 4, 16) * 12,
    trussSpacingIn: num(input.trussSpacing ?? 4, 'Truss spacing', 2, 16) * 12,
    openings: [],
    sheds: [],
  };
  // Wall by wall: a wall can be left open, with no girts or steel, and can carry its own post spacing.
  b.walls = {};
  for (const wall of WALLS) {
    const w = input.walls?.[wall] ?? {};
    b.walls[wall] = { open: !!w.open, postSpacingIn: w.postSpacing == null ? b.postSpacingIn : num(w.postSpacing, `Post spacing on the ${wall} wall`, 4, 16) * 12 };
  }
  // Site figures the builder gets from the permit office. Zero means not typed in.
  const l = input.loads ?? {};
  b.loads = {
    snowPsf: num(l.snow ?? 0, 'Snow load', 0, 400), windMph: num(l.wind ?? 0, 'Wind speed', 0, 250),
    frostIn: num(l.frost ?? 0, 'Frost depth', 0, 96), exposure: String(l.exposure ?? '').trim().slice(0, 40),
  };
  b.roof = input.roof ?? 'gable';
  if (!ROOFS.includes(b.roof)) { errors.push('Roof shape is not one of the choices.'); b.roof = 'gable'; }
  b.truss = b.roof === 'gable' ? (input.truss ?? 'common') : 'common';
  if (!TRUSSES.includes(b.truss)) { errors.push('Truss type is not one of the choices.'); b.truss = 'common'; }
  if (b.truss === 'scissor') {
    // Half the roof pitch is the usual starting point for the ceiling. The truss maker confirms it.
    b.ceilingPitch = num(input.ceilingPitch ?? b.pitch / 2, 'Ceiling pitch', 0.5, 11);
    if (b.ceilingPitch > b.pitch - 0.99) errors.push('The ceiling pitch has to be at least 1 in 12 flatter than the roof pitch.');
  }
  if (b.truss === 'attic') b.atticRoomIn = num(input.atticRoom ?? Math.max(6, Math.floor(b.widthIn / 24)), 'Attic room width', 6, 80) * 12;
  b.line = roofLine(b);
  b.planes = roofPlanes(b);
  b.riseIn = Math.max(...b.line.map((p) => p.h)) - b.eaveIn;

  (input.openings ?? []).forEach((o, i) => {
    const label = `Opening ${i + 1}`;
    if (!TYPES.has(o.type)) { errors.push(`${label} has an unknown type.`); return; }
    if (!WALLS.includes(o.wall)) { errors.push(`${label} is not on a wall.`); return; }
    const name = `The ${NAMES[o.type]} on the ${o.wall} wall`;
    const op = {
      index: i, type: o.type, wall: o.wall,
      startIn: num(o.offset, `${name} position`, 0, 400) * 12,
      widthIn: num(o.width, `${name} width`, 1, 60) * 12,
      heightIn: num(o.height, `${name} height`, 1, 24) * 12,
      sillIn: GROUND_DOORS.has(o.type) ? 0 : num(o.sill ?? 4, `${name} sill height`, 0, 20) * 12,
      toGround: GROUND_DOORS.has(o.type),
    };
    op.endIn = op.startIn + op.widthIn;
    const wallLen = wallLengthIn(b, op.wall);
    if (b.walls[op.wall].open) errors.push(`${name} sits on an open wall. Take it off, or close the wall in.`);
    if (op.endIn > wallLen + 0.01) errors.push(`${name} runs past the end of the wall.`);
    if (op.sillIn + op.heightIn > (isGable(op.wall) ? b.eaveIn : wallTopIn(b, op.wall, 0)) + 0.01) errors.push(`${name} is taller than the wall.`);
    for (const other of b.openings) {
      if (other.wall === op.wall && op.startIn < other.endIn && other.startIn < op.endIn
          && op.sillIn < other.sillIn + other.heightIn && other.sillIn < op.sillIn + op.heightIn) {
        errors.push(`${name} overlaps another opening.`);
      }
    }
    b.openings.push(op);
  });

  // Lean-tos and porches. The roof starts dropIn below the main eave and falls away from the wall.
  (input.sheds ?? []).forEach((s, i) => {
    if (!(s.kind in SHEDS)) { errors.push(`Addition ${i + 1} has an unknown type.`); return; }
    if (!WALLS.includes(s.wall)) { errors.push(`Addition ${i + 1} is not on a wall.`); return; }
    const name = `The ${SHEDS[s.kind]} on the ${s.wall} wall`;
    const wallLen = wallLengthIn(b, s.wall);
    const sh = {
      kind: s.kind, wall: s.wall,
      depthIn: num(s.depth, `${name} depth`, 4, 40) * 12,
      pitch: num(s.pitch ?? 3, `${name} roof pitch`, 1, 12),
      dropIn: num(s.drop ?? 0, `${name} drop below the eave`, 0, 12) * 12,
      startIn: num(s.start ?? 0, `${name} position`, 0, 400) * 12,
      enclosed: s.kind === 'leanto' && !!s.enclosed,
    };
    sh.lengthIn = s.length == null ? wallLen - sh.startIn : num(s.length, `${name} length`, 4, 400) * 12;
    sh.endIn = sh.startIn + sh.lengthIn;
    sh.highIn = (isGable(sh.wall) ? b.eaveIn : wallTopIn(b, sh.wall, 0)) - sh.dropIn;
    sh.lowIn = sh.highIn - sh.depthIn * sh.pitch / 12;
    if (sh.lengthIn < 48 - 0.01 || sh.endIn > wallLen + 0.01) errors.push(`${name} runs past the end of the wall.`);
    else if (sh.lowIn < MIN_SHED_LOW_IN - 0.01) {
      errors.push(`${name} would be only ${Math.floor(sh.lowIn / 12)} ft ${Math.round(sh.lowIn % 12)} in high at its low side. Make it shallower or flatter, or raise the wall.`);
    }
    // The roof has to tuck under the main roof's overhang and its fascia.
    const clearIn = edgeOverhangIn(b, sh.wall) > 0 ? eaveDropIn(b, sh.wall) + 6 : 0;
    if (sh.dropIn < clearIn - 0.01) {
      errors.push(`${name} would run into the main roof's overhang. Set it at least ${Math.ceil(clearIn)} in below the main eave.`);
    }
    if (b.sheds.some((other) => other.wall === sh.wall && sh.startIn < other.endIn - 0.01 && other.startIn < sh.endIn - 0.01)) {
      errors.push(`${name} overlaps another addition on that wall.`);
    }
    b.sheds.push(sh);
  });

  // Interior walls. One that runs across sits a distance from the left end and is measured
  // from the front wall; one that runs along sits a distance from the front wall and is
  // measured from the left end.
  b.partitions = [];
  (input.partitions ?? []).forEach((p, i) => {
    const name = `Interior wall ${i + 1}`;
    if (p.axis !== 'across' && p.axis !== 'along') { errors.push(`${name} has no direction.`); return; }
    const across = p.axis === 'across';
    const runMax = across ? b.widthIn : b.lengthIn, atMax = across ? b.lengthIn : b.widthIn;
    const pt = { index: i, axis: p.axis, sheathed: !!p.sheathed,
      atIn: num(p.at, `${name} position`, 0, 400) * 12,
      startIn: num(p.start ?? 0, `${name} start`, 0, 400) * 12,
      doors: p.doors == null ? 0 : Math.round(num(p.doors, `${name} door count`, 0, 4)) };
    pt.lengthIn = p.length == null ? runMax - pt.startIn : num(p.length, `${name} length`, 2, 400) * 12;
    pt.endIn = pt.startIn + pt.lengthIn;
    if (pt.atIn < 24 - 0.01 || pt.atIn > atMax - 24 + 0.01) errors.push(`${name} has to sit at least 2 ft inside the outside walls.`);
    if (pt.lengthIn < 24 - 0.01 || pt.endIn > runMax + 0.01) errors.push(`${name} runs past the outside wall.`);
    else if (pt.doors * 48 > pt.lengthIn + 0.01) errors.push(`${name} is too short for ${pt.doors} ${pt.doors === 1 ? 'door' : 'doors'}.`);
    b.partitions.push(pt);
  });

  // A loft fills one end of the building from side wall to side wall.
  b.loft = null;
  if (input.loft) {
    const f = input.loft;
    if (f.end !== 'left' && f.end !== 'right') errors.push('The loft is not at an end of the building.');
    else {
      b.loft = { end: f.end, depthIn: num(f.depth, 'Loft depth', 6, 40) * 12, heightIn: num(f.height, 'Loft floor height', 7, 20) * 12 };
      if (b.loft.depthIn > b.lengthIn - 96 + 0.01) errors.push('The loft has to leave at least 8 ft of the building open.');
    }
  }

  // Finish options. Wainscot and gutters also follow the switches on the Colors step.
  const o = input.options ?? {};
  const pick = (v, list, name) => {
    if (v == null) return list[0];
    if (!list.includes(v)) { errors.push(`${name} is not one of the choices.`); return list[0]; }
    return v;
  };
  const wallCover = pick(o.wallCover, ['steel', 'batten', 'lap'], 'Wall covering');
  // Wainscot and eave lights are cut into steel wall panels, so wood walls carry neither.
  const steelWalls = wallCover === 'steel';
  b.options = {
    roofCover: pick(o.roofCover, ['steel', 'standing', 'shingles'], 'Roof covering'),
    wallCover,
    wainscotIn: steelWalls && (o.wainscot ?? input.colors?.wainscotOn) ? pick(o.wainscotIn, [36, 48], 'Wainscot height') : 0,
    gutters: !!(o.gutters ?? input.colors?.gutters),
    linerWalls: !!o.linerWalls,
    linerCeiling: !!o.linerCeiling,
    roofInsulation: pick(o.roofInsulation, ['none', 'bubble', 'fiberglass'], 'Roof insulation'),
    wallInsulation: pick(o.wallInsulation, ['none', 'bubble', 'wrap', 'fiberglass'], 'Wall insulation'),
    ceilingR: pick(o.ceilingR, [0, 19, 30, 38, 49, 60], 'Ceiling insulation'),
    footing: pick(o.footing, ['none', 'pad', 'collar', 'bracket'], 'Footing'),
    slab: !!o.slab,
    ridgeVent: !!o.ridgeVent,
    cupolas: !!o.cupolas,
    cupolaSizeIn: pick(o.cupolaSizeIn, [0, 24, 36, 48], 'Cupola size'),
    eaveLights: steelWalls ? pick(o.eaveLights, ['none', 'front', 'back', 'both'], 'Eave lights') : 'none',
    skylights: o.skylights == null ? 0 : Math.round(num(o.skylights, 'Skylight panels', 0, 200)),
  };

  return { building: b, errors };
}

export function wallLengthIn(b, wall) {
  return wall === 'front' || wall === 'back' ? b.lengthIn : b.widthIn;
}

export function isGable(wall) { return wall === 'left' || wall === 'right'; }
export const isOpen = (b, wall) => !!b.walls?.[wall]?.open;
export const closedWalls = (b) => WALLS.filter((wall) => !isOpen(b, wall));
// Side walls with a strip of clear panels under the eave. An open wall has no steel to swap.
export const litWalls = (b) => ['front', 'back'].filter((wall) => !isOpen(b, wall) && [wall, 'both'].includes(b.options?.eaveLights));
// The two walls that meet at each corner, with the wall whose top sets the corner's height first.
export const CORNERS = [['front', 'left'], ['front', 'right'], ['back', 'left'], ['back', 'right']];

// The roof seen from a gable end: points across the width from the front wall
// (y = 0) to the back wall, each with its height above grade. A single slope
// is low at the front and high at the back.
export function roofLine(b) {
  const W = b.widthIn, E = b.eaveIn;
  if (b.roof === 'mono') return [{ y: 0, h: E }, { y: W, h: E + W * b.pitch / 12 }];
  if (b.roof === 'gambrel') {
    const inIn = (W / 2) * GAMBREL.breakShare, upIn = inIn * GAMBREL.lowerPitch / 12;
    const peak = upIn + (W / 2 - inIn) * GAMBREL.upperPitch / 12;
    return [{ y: 0, h: E }, { y: inIn, h: E + upIn }, { y: W / 2, h: E + peak }, { y: W - inIn, h: E + upIn }, { y: W, h: E }];
  }
  return [{ y: 0, h: E }, { y: W / 2, h: E + (W / 2) * b.pitch / 12 }, { y: W, h: E }];
}

// One flat piece of roof for each stretch of the roof line. lowY and highY are
// its edges over the building; lowOverIn and highOverIn are how far the steel
// runs past them. lowEdge and highEdge say what trim finishes each edge.
export function roofPlanes(b) {
  const line = b.line ?? roofLine(b);
  const last = line.length - 2;
  return line.slice(0, -1).map((p, i) => {
    const q = line[i + 1];
    const [low, high] = p.h <= q.h ? [p, q] : [q, p];
    const runIn = Math.abs(q.y - p.y);
    const pitch = (high.h - low.h) / runIn * 12;
    const atWall = (pt) => pt.y === 0 || pt.y === b.widthIn;
    // A gambrel's steep lower roof stops at the wall line; the other shapes carry the overhang.
    const over = b.roof === 'gambrel' ? 0 : b.overhangIn;
    const lowOverIn = atWall(low) ? over : 0;
    const highOverIn = atWall(high) ? over : 0;
    const k = Math.hypot(1, pitch / 12);
    return {
      index: i, lowY: low.y, highY: high.y, lowIn: low.h, highIn: high.h, runIn, pitch,
      dir: low.y < high.y ? 1 : -1, lowOverIn, highOverIn,
      slopeIn: (runIn + lowOverIn + highOverIn) * k, bareSlopeIn: runIn * k,
      lowEdge: atWall(low) ? 'eave' : 'break',
      highEdge: atWall(high) ? 'high' : (i === 0 || i === last) && line.length > 3 ? 'break' : 'ridge',
    };
  });
}

// How far the roof runs past a wall, and how far its edge hangs below the wall top there.
export function edgeOverhangIn(b, wall) {
  if (isGable(wall)) return b.endOverhangIn;
  return b.roof === 'gambrel' ? 0 : b.overhangIn;
}
export function eaveDropIn(b, wall) {
  if (isGable(wall) || b.roof === 'gambrel') return 0;
  if (b.roof === 'mono' && wall === 'back') return 0;
  return b.overhangIn * b.pitch / 12;
}

// Height of the roof line above grade at a distance across the building from the front wall.
export function roofTopIn(b, yIn) {
  const line = b.line;
  const y = Math.min(Math.max(yIn, 0), b.widthIn);
  const i = Math.max(0, line.findIndex((p, n) => n > 0 && y <= p.y + 1e-9) - 1);
  const p = line[i], q = line[i + 1];
  return p.h + (q.h - p.h) * (y - p.y) / (q.y - p.y);
}

// Height of the wall top above grade at a point along the wall.
export function wallTopIn(b, wall, atIn) {
  if (wall === 'front') return b.line[0].h;
  if (wall === 'back') return b.line[b.line.length - 1].h;
  return roofTopIn(b, atIn);
}

// Where the roof line stands above a height, as [start, end] across the width. Null when it never does.
export function roofSpanAbove(b, heightIn) {
  let start = Infinity, end = -Infinity;
  for (let i = 0; i < b.line.length - 1; i++) {
    const p = b.line[i], q = b.line[i + 1];
    if (Math.max(p.h, q.h) <= heightIn) continue;
    const cross = p.y + (q.y - p.y) * (heightIn - p.h) / (q.h - p.h);
    start = Math.min(start, p.h > heightIn ? p.y : cross);
    end = Math.max(end, q.h > heightIn ? q.y : cross);
  }
  return end > start ? [start, end] : null;
}

// Wall area under the roof line on one gable end, in square inches.
export function gableAreaIn(b) {
  let a = 0;
  for (let i = 0; i < b.line.length - 1; i++) a += (b.line[i + 1].y - b.line[i].y) * (b.line[i].h + b.line[i + 1].h) / 2;
  return a;
}
