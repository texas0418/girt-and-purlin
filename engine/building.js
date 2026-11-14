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
const AWNING_GAP_IN = defaultRules.awningGapIn.value;
export const ROOFS = ['gable', 'mono', 'gambrel', 'hip'];
// Scissor and attic trusses go with a gable roof. Other roofs take the truss their shape calls for.
export const TRUSSES = ['common', 'scissor', 'attic'];
// A gambrel's proportions are fixed by the rules: the lower slope, the upper slope, and where the break sits.
export const GAMBREL = { lowerPitch: defaultRules.gambrelLowerPitch.value, upperPitch: defaultRules.gambrelUpperPitch.value, breakShare: defaultRules.gambrelBreakShare.value };
// The two walls each wall meets, at the start and at the end of its own measure.
const START_CORNER = { front: 'left', back: 'left', left: 'front', right: 'front' };
const END_CORNER = { front: 'right', back: 'right', left: 'back', right: 'back' };
export const STUD_SIZES = ['2x4', '2x6'];
export const STUD_SPACINGS = [16, 24];
export const WING_DOOR = { widthIn: 36, heightIn: 80 };
const NAMES = { wing: 'wing opening', slider: 'sliding door', walk: 'walk door', overhead: 'overhead door', window: 'window' };

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
  // Stud walls stand on concrete: plates and studs take the place of posts and girts.
  b.framing = input.framing ?? 'post';
  if (b.framing !== 'post' && b.framing !== 'stud') { errors.push('Wall framing is not one of the choices.'); b.framing = 'post'; }
  if (b.framing === 'stud') {
    b.studSize = input.studSize ?? '2x6';
    if (!STUD_SIZES.includes(b.studSize)) { errors.push('Stud size is not one of the choices.'); b.studSize = '2x6'; }
    b.studSpacingIn = input.studSpacing ?? 16;
    if (!STUD_SPACINGS.includes(b.studSpacingIn)) { errors.push('Stud spacing is not one of the choices.'); b.studSpacingIn = 16; }
    // Trusses on a stud wall sit 2 ft apart, each one over or beside a stud.
    b.trussSpacingIn = 24;
  }
  // A wing is designed as a building of its own whose left end meets the main building. join says how.
  b.join = input.join ?? null;
  // Wall by wall: a wall can be left open, with no girts or steel, and can carry its own post spacing.
  b.walls = {};
  for (const wall of WALLS) {
    const w = input.walls?.[wall] ?? {};
    b.walls[wall] = { open: !!w.open || (!!b.join && wall === 'left'), joined: !!b.join && wall === 'left', postSpacingIn: w.postSpacing == null ? b.postSpacingIn : num(w.postSpacing, `Post spacing on the ${wall} wall`, 4, 16) * 12 };
  }
  // Site figures the builder gets from the permit office. Zero means not typed in.
  const l = input.loads ?? {};
  if (b.framing === 'stud' && WALLS.some((wall) => b.walls[wall].open && !b.walls[wall].joined)) errors.push('Stud walls cannot have an open wall. Close the wall in, or go back to posts and girts.');
  b.loads = {
    snowPsf: num(l.snow ?? 0, 'Snow load', 0, 400), windMph: num(l.wind ?? 0, 'Wind speed', 0, 250),
    frostIn: num(l.frost ?? 0, 'Frost depth', 0, 96), exposure: String(l.exposure ?? '').trim().slice(0, 40),
  };
  b.roof = input.roof ?? 'gable';
  if (!ROOFS.includes(b.roof)) { errors.push('Roof shape is not one of the choices.'); b.roof = 'gable'; }
  if (b.roof === 'hip') {
    // A hip roof has one eave all the way around, so one overhang serves every side.
    b.endOverhangIn = b.overhangIn;
    if (b.lengthIn < b.widthIn - 0.01) errors.push('A hip roof needs the length to be at least the width. Swap the two numbers.');
  }
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

  // Wings: a second building joined to a wall of this one. The geometry is checked in wings.js;
  // here each one leaves its mark on the wall it joins.
  b.wings = [];
  (input.wings ?? []).forEach((w, i) => {
    const name = `Wing ${i + 1}`;
    if (b.join) { errors.push('A wing cannot carry a wing of its own.'); return; }
    if (!WALLS.includes(w.wall)) { errors.push(`${name} is not on a wall.`); return; }
    const wallLen = wallLengthIn(b, w.wall);
    const wg = {
      index: i, wall: w.wall,
      startIn: num(w.start ?? 0, `${name} position`, 0, 400) * 12,
      widthIn: num(w.width, `${name} width`, 8, 100) * 12,
      outIn: num(w.out, `${name} depth`, 8, 200) * 12,
      eaveIn: num(w.eaveHeight, `${name} wall height`, 6, 24) * 12,
      pitch: num(w.pitch ?? 4, `${name} roof pitch`, 1, 12),
      between: ['open', 'door', 'solid'].includes(w.between) ? w.between : 'open',
      openings: Array.isArray(w.openings) ? w.openings : [],
    };
    wg.endIn = wg.startIn + wg.widthIn;
    const hostTop = isGable(wg.wall) ? b.eaveIn : wallTopIn(b, wg.wall, 0);
    let fits = true;
    if (b.walls[wg.wall].open) { errors.push(`${name} joins an open wall. Close the wall in, or put the wing on another wall.`); fits = false; }
    if (wg.endIn > wallLen + 0.01) { errors.push(`${name} runs past the end of the wall it joins. Make it narrower or slide it over.`); fits = false; }
    if (wg.eaveIn > hostTop + 0.01) { errors.push(`${name} has walls taller than the wall it joins. Lower its wall height to ${Math.floor(hostTop / 12)} ft or less.`); fits = false; }
    if (b.wings.some((o) => o.wall === wg.wall && wg.startIn < o.endIn - 0.01 && o.startIn < wg.endIn - 0.01)) { errors.push(`${name} overlaps another wing on that wall.`); fits = false; }
    if (b.openings.some((o) => o.wall === wg.wall && wg.startIn < o.endIn - 0.01 && o.startIn < wg.endIn - 0.01)) { errors.push(`A door or window on the ${wg.wall} wall sits where ${name} joins the building. Move it, or move the wing.`); fits = false; }
    b.wings.push(wg);
    if (!fits) return;
    // Open through: the wall is left out across the wing, framed like a wide door with no door in it.
    if (wg.between === 'open') {
      b.openings.push({ index: 1000 + i, type: 'wing', wall: wg.wall, startIn: wg.startIn, widthIn: wg.widthIn, endIn: wg.endIn, heightIn: wg.eaveIn, sillIn: 0, toGround: true, wing: i });
    }
    // Wall with door: the wall stays, with a walk door through it in the middle of the nearest gap between posts.
    if (wg.between === 'door') {
      const bays = Math.max(1, Math.ceil(wallLen / b.walls[wg.wall].postSpacingIn - 0.01)), bayIn = wallLen / bays;
      const mid = (wg.startIn + wg.endIn) / 2;
      const bayMid = (Math.min(bays - 1, Math.floor(mid / bayIn)) + 0.5) * bayIn;
      const startIn = Math.min(Math.max((b.framing === 'stud' ? mid : bayMid) - WING_DOOR.widthIn / 2, wg.startIn + 6), wg.endIn - 6 - WING_DOOR.widthIn);
      b.openings.push({ index: 1000 + i, type: 'walk', wall: wg.wall, startIn, widthIn: WING_DOOR.widthIn, endIn: startIn + WING_DOOR.widthIn, heightIn: WING_DOOR.heightIn, sillIn: 0, toGround: true, wing: i, inJoin: true });
    }
  });

  // Lean-tos and porches. The roof starts dropIn below the main eave and falls away from the wall.
  // A wraparound porch is one porch on each wall it covers, joined at the corners.
  const underRoofIn = (wall) => (edgeOverhangIn(b, wall) > 0 ? eaveDropIn(b, wall) + 6 : 0);
  const addShed = (s, i, wrap = null) => {
    const name = `The ${wrap ? 'wraparound porch' : SHEDS[s.kind]} on the ${s.wall} wall`;
    const wallLen = wallLengthIn(b, s.wall);
    const sh = {
      kind: s.kind, wall: s.wall, inputIndex: i,
      depthIn: num(s.depth, `${name} depth`, 4, 40) * 12,
      pitch: num(s.pitch ?? 3, `${name} roof pitch`, 1, 12),
      dropIn: num(s.drop ?? 0, `${name} drop below the eave`, 0, 12) * 12,
      startIn: num(s.start ?? 0, `${name} position`, 0, 400) * 12,
      enclosed: s.kind === 'leanto' && !!s.enclosed,
    };
    if (wrap) Object.assign(sh, { wrap: i, cornerStart: wrap.walls.includes(START_CORNER[s.wall]), cornerEnd: wrap.walls.includes(END_CORNER[s.wall]) });
    sh.lengthIn = s.length == null ? wallLen - sh.startIn : num(s.length, `${name} length`, 4, 400) * 12;
    sh.endIn = sh.startIn + sh.lengthIn;
    // A wraparound porch holds one height all the way around, set from the lowest eave.
    sh.highIn = (wrap || isGable(sh.wall) ? b.eaveIn : wallTopIn(b, sh.wall, 0)) - sh.dropIn;
    sh.lowIn = sh.highIn - sh.depthIn * sh.pitch / 12;
    if (sh.lengthIn < 48 - 0.01 || sh.endIn > wallLen + 0.01) errors.push(`${name} runs past the end of the wall.`);
    else if (sh.lowIn < MIN_SHED_LOW_IN - 0.01) {
      errors.push(`${name} would be only ${Math.floor(sh.lowIn / 12)} ft ${Math.round(sh.lowIn % 12)} in high at its low side. Make it shallower or flatter, or raise the wall.`);
    }
    // The roof has to tuck under the main roof's overhang and its fascia.
    const clearIn = wrap ? wrap.clearIn : underRoofIn(sh.wall);
    if (sh.dropIn < clearIn - 0.01) {
      errors.push(`${name} would run into the main roof's overhang. Set it at least ${Math.ceil(clearIn)} in below the main eave.`);
    }
    if (b.sheds.some((other) => other.wall === sh.wall && sh.startIn < other.endIn - 0.01 && other.startIn < sh.endIn - 0.01)) {
      errors.push(`${name} overlaps another addition on that wall.`);
    }
    if (b.wings.some((w) => w.wall === sh.wall && sh.startIn < w.endIn - 0.01 && w.startIn < sh.endIn - 0.01)) errors.push(`${name} sits where a wing joins the building. Move one of them.`);
    b.sheds.push(sh);
  };
  (input.sheds ?? []).forEach((s, i) => {
    if (s.kind === 'awning') return;
    if (s.kind === 'wrap') {
      const walls = WALLS.filter((wall) => (s.walls ?? []).includes(wall));
      if (walls.length < 2 || (walls.length === 2 && isGable(walls[0]) === isGable(walls[1]))) { errors.push('The wraparound porch needs walls that touch at a corner.'); return; }
      const clearIn = Math.max(...walls.map(underRoofIn));
      for (const wall of walls) addShed({ kind: 'porch', wall, depth: s.depth, pitch: s.pitch, drop: s.drop, start: 0 }, i, { walls, clearIn });
      return;
    }
    if (!(s.kind in SHEDS)) { errors.push(`Addition ${i + 1} has an unknown type.`); return; }
    if (!WALLS.includes(s.wall)) { errors.push(`Addition ${i + 1} is not on a wall.`); return; }
    addShed(s, i);
  });

  // Awnings: a small roof hung on the wall with brackets, over a door or window or in a spot of its own.
  b.awnings = [];
  (input.sheds ?? []).forEach((s, i) => {
    if (s.kind !== 'awning') return;
    if (!WALLS.includes(s.wall)) { errors.push(`Addition ${i + 1} is not on a wall.`); return; }
    const name = `The awning on the ${s.wall} wall`;
    const a = {
      index: i, wall: s.wall, over: s.over ?? null,
      outIn: num(s.out ?? 3, `${name} depth`, 2, 8) * 12,
      widthIn: num(s.width ?? 5, `${name} width`, 3, 40) * 12,
      pitch: num(s.pitch ?? 4, `${name} roof pitch`, 1, 12),
    };
    if (b.walls[a.wall].open) errors.push(`${name} needs a closed wall to hang on.`);
    if (a.over != null) {
      const op = b.openings.find((o) => o.index === a.over);
      if (!op || op.wall !== a.wall) { errors.push(`${name} is set over a door or window that is not on that wall. Pick another one, or give it its own spot.`); return; }
      if (a.widthIn < op.widthIn - 0.01) errors.push(`${name} is narrower than the ${NAMES[op.type]} under it.`);
      a.startIn = (op.startIn + op.endIn) / 2 - a.widthIn / 2;
      a.lowIn = op.sillIn + op.heightIn + AWNING_GAP_IN;
      a.overType = op.type;
    } else {
      a.startIn = num(s.start ?? 0, `${name} position`, 0, 400) * 12;
      a.lowIn = MIN_SHED_LOW_IN;
    }
    a.endIn = a.startIn + a.widthIn;
    a.highIn = a.lowIn + a.outIn * a.pitch / 12;
    if (a.startIn < -0.01 || a.endIn > wallLengthIn(b, a.wall) + 0.01) errors.push(`${name} runs past the end of the wall.`);
    const roomIn = (isGable(a.wall) ? b.eaveIn : wallTopIn(b, a.wall, 0)) - underRoofIn(a.wall);
    if (a.highIn > roomIn + 0.01) errors.push(`${name} would reach up into the main roof. Make it flatter, or have it stick out less.`);
    const hits = (other) => other.wall === a.wall && a.startIn < other.endIn - 0.01 && other.startIn < a.endIn - 0.01;
    if (b.sheds.some(hits) || b.awnings.some(hits)) errors.push(`${name} overlaps another addition on that wall.`);
    if (b.wings.some((w) => w.wall === a.wall && a.startIn < w.endIn - 0.01 && w.startIn < a.endIn - 0.01)) errors.push(`${name} sits where a wing joins the building. Move one of them.`);
    b.awnings.push(a);
  });

  // Dormers stand on the front or back slope of a gable or gambrel roof. atIn is the left edge, from the left end.
  b.dormers = [];
  b.dormersLeftOff = 0;
  (input.dormers ?? []).forEach((d, i) => {
    if (b.roof !== 'gable' && b.roof !== 'gambrel') { b.dormersLeftOff++; return; }
    const name = `Dormer ${i + 1}`;
    if (d.side !== 'front' && d.side !== 'back') { errors.push(`${name} is not on a roof slope.`); return; }
    const dm = {
      index: i, side: d.side, style: d.style === 'shed' ? 'shed' : 'gable', window: d.window !== false,
      atIn: num(d.at ?? 0, `${name} position`, 0, 400) * 12,
      widthIn: num(d.width ?? 6, `${name} width`, 3, 16) * 12,
    };
    dm.endIn = dm.atIn + dm.widthIn;
    if (dm.atIn < 24 - 0.01 || dm.endIn > b.lengthIn - 24 + 0.01) errors.push(`${name} has to sit at least 2 ft in from each end of the building.`);
    if (b.dormers.some((o) => o.side === dm.side && dm.atIn < o.endIn + 24 - 0.01 && o.atIn < dm.endIn + 24 - 0.01)) errors.push(`${name} is closer than 2 ft to another dormer.`);
    if (b.wings.some((w) => w.wall === dm.side && dm.atIn < w.endIn + 24 - 0.01 && w.startIn < dm.endIn + 24 - 0.01)) errors.push(`${name} sits where the roof of a wing meets this roof. Move one of them.`);
    b.dormers.push(dm);
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
    footing: b.framing === 'stud' ? 'none' : pick(o.footing, ['none', 'pad', 'collar', 'bracket'], 'Footing'),
    slab: !!o.slab,
    ridgeVent: !!o.ridgeVent,
    cupolas: !!o.cupolas,
    cupolaSizeIn: pick(o.cupolaSizeIn, [0, 24, 36, 48], 'Cupola size'),
    eaveLights: steelWalls ? pick(o.eaveLights, ['none', 'front', 'back', 'both'], 'Eave lights') : 'none',
    skylights: o.skylights == null ? 0 : Math.round(num(o.skylights, 'Skylight panels', 0, 200)),
  };

  return { building: b, errors };
}

// Where the roof starts and how far it runs along the building. A wing's roof starts at the wall it joins.
export const roofStartIn = (b) => (b.join ? 0 : -b.endOverhangIn);
export const roofRunIn = (b) => b.lengthIn + b.endOverhangIn - roofStartIn(b);
// Ends of the roof that finish in the open air with a rake.
export const freeRakes = (b) => (b.join ? 1 : 2);

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
// A hip roof: the main slopes are the gable cross-section, and a slope of the
// same pitch closes each end. halfIn is the level run of every slope, eave
// edge to ridge. ridgeIn is what is left of the ridge. hipIn is one hip, from
// the corner of the eave up to the end of the ridge, measured along the roof.
export function hipGeo(b) {
  const halfIn = b.widthIn / 2 + b.overhangIn;
  return { halfIn, k: Math.hypot(12, b.pitch) / 12, ridgeIn: b.lengthIn - b.widthIn, hipIn: Math.hypot(halfIn, halfIn, halfIn * b.pitch / 12) };
}

export function edgeOverhangIn(b, wall) {
  if (isGable(wall)) return b.endOverhangIn;
  return b.roof === 'gambrel' ? 0 : b.overhangIn;
}
export function eaveDropIn(b, wall) {
  if ((isGable(wall) && b.roof !== 'hip') || b.roof === 'gambrel') return 0;
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
  // The end walls of a hip roof stop level at the eave.
  return b.roof === 'hip' ? b.eaveIn : roofTopIn(b, atIn);
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
  if (b.roof === 'hip') return b.widthIn * b.eaveIn;
  let a = 0;
  for (let i = 0; i < b.line.length - 1; i++) a += (b.line[i + 1].y - b.line[i].y) * (b.line[i].h + b.line[i + 1].h) / 2;
  return a;
}
