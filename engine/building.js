// The building description: what the user enters. Feet in, inches inside.
//
// Walls are named as seen on a floor plan with the front wall at the bottom:
//   front and back are the long eave walls, left and right are the gable ends.
// An opening's offset is measured along its wall from the front-left corner
// (front and back walls) or from the front wall (left and right walls).

// The lowest a lean-to or porch roof may come: a walk door still fits under it.
export const MIN_SHED_LOW_IN = 84;
export const WALLS = ['front', 'back', 'left', 'right'];
const GROUND_DOORS = new Set(['slider', 'walk', 'overhead']);
const TYPES = new Set([...GROUND_DOORS, 'window']);
const SHEDS = { leanto: 'lean-to', porch: 'porch' };
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
    postSpacingIn: num(input.postSpacing ?? 8, 'Post spacing', 4, 16) * 12,
    trussSpacingIn: num(input.trussSpacing ?? 4, 'Truss spacing', 2, 16) * 12,
    openings: [],
    sheds: [],
  };
  b.riseIn = (b.widthIn / 2) * b.pitch / 12;

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
    if (op.endIn > wallLen + 0.01) errors.push(`${name} runs past the end of the wall.`);
    if (op.sillIn + op.heightIn > b.eaveIn + 0.01) errors.push(`${name} is taller than the wall.`);
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
    sh.highIn = b.eaveIn - sh.dropIn;
    sh.lowIn = sh.highIn - sh.depthIn * sh.pitch / 12;
    if (sh.lengthIn < 48 - 0.01 || sh.endIn > wallLen + 0.01) errors.push(`${name} runs past the end of the wall.`);
    else if (sh.lowIn < MIN_SHED_LOW_IN - 0.01) {
      errors.push(`${name} would be only ${Math.floor(sh.lowIn / 12)} ft ${Math.round(sh.lowIn % 12)} in high at its low side. Make it shallower or flatter, or raise the wall.`);
    }
    // The roof has to tuck under the main roof's overhang and its fascia.
    const clearIn = b.overhangIn > 0 ? (isGable(sh.wall) ? 0 : b.overhangIn * b.pitch / 12) + 6 : 0;
    if (sh.dropIn < clearIn - 0.01) {
      errors.push(`${name} would run into the main roof's overhang. Set it at least ${Math.ceil(clearIn)} in below the main eave.`);
    }
    if (b.sheds.some((other) => other.wall === sh.wall && sh.startIn < other.endIn - 0.01 && other.startIn < sh.endIn - 0.01)) {
      errors.push(`${name} overlaps another addition on that wall.`);
    }
    b.sheds.push(sh);
  });

  return { building: b, errors };
}

export function wallLengthIn(b, wall) {
  return wall === 'front' || wall === 'back' ? b.lengthIn : b.widthIn;
}

export function isGable(wall) { return wall === 'left' || wall === 'right'; }

// Height of the wall top above grade at a point along the wall.
export function wallTopIn(b, wall, atIn) {
  if (!isGable(wall)) return b.eaveIn;
  const half = b.widthIn / 2;
  return b.eaveIn + b.riseIn * (1 - Math.abs(atIn - half) / half);
}
