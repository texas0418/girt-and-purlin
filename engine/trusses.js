// Truss types for a gable roof. A common truss has a flat bottom chord. A
// scissor truss slopes its bottom chords up to a vaulted ceiling. An attic
// truss leaves a room inside the roof with a floor on its bottom chord.
// Source for the three types: FBi Buildings, Common Pole Barn Trusses.
// The truss maker engineers every truss; this only works out what the
// choice changes on the material list and in the picture.
import { feetInches } from './stock.js';

const EPS = 0.01;
const up = (n) => Math.ceil(n - EPS);
const tidy = (n) => Number(n.toFixed(2));

export const TRUSS_TYPE_NAMES = { scissor: 'Scissor Trusses', attic: 'Attic Trusses' };

// How much longer a sloped ceiling is than the floor under it.
export function ceilingFactor(b) {
  return b.truss === 'scissor' ? Math.hypot(12, b.ceilingPitch) / 12 : 1;
}

// The room inside an attic truss, measured to the truss lines. The lumber
// takes a few inches off each face, so the truss maker gives the final size.
export function atticRoom(b, rules) {
  const W = b.widthIn, roomIn = b.atticRoomIn;
  const peakIn = (W / 2) * b.pitch / 12;
  const kneeIn = ((W - roomIn) / 2) * b.pitch / 12;
  const ceilingIn = Math.min(rules.atticCeilingIn, peakIn);
  // The flat part of the ceiling, between the two slopes.
  const flatIn = Math.max(0, Math.min(roomIn, W - 2 * ceilingIn * 12 / b.pitch));
  return { roomIn, kneeIn, ceilingIn, flatIn, startIn: (W - roomIn) / 2, sqFt: (roomIn * b.lengthIn) / 144 };
}

export function trussParts(b, rules) {
  const errors = [], warnings = [], items = [];
  if (b.truss === 'scissor') {
    return { errors, warnings, items, name: TRUSS_TYPE_NAMES.scissor, size: `, ${tidy(b.ceilingPitch)}/12 ceiling`, attic: null };
  }
  if (b.truss !== 'attic') return { errors, warnings, items, name: null, size: '', attic: null };

  const maxIn = b.widthIn * rules.atticRoomMaxShare;
  if (b.atticRoomIn > maxIn + EPS) {
    errors.push(`An attic room can be up to ${rules.atticRoomMaxShare * 100}% of the truss span, which is ${feetInches(Math.floor(maxIn))} here. Make the room narrower or the building wider.`);
  }
  if (b.trussSpacingIn > rules.atticTrussSpacingMaxIn + EPS) {
    errors.push(`Attic trusses carry a floor, so they sit no more than ${rules.atticTrussSpacingMaxIn / 12} ft apart. Set the truss spacing to ${rules.atticTrussSpacingMaxIn / 12} ft.`);
  }
  if (errors.length) return { errors, warnings, items, name: TRUSS_TYPE_NAMES.attic, size: '', attic: null };

  const attic = atticRoom(b, rules);
  if (attic.ceilingIn < rules.loftHeadroomIn - EPS) {
    warnings.push({ code: 'attic-low', text: `The roof leaves ${feetInches(attic.ceilingIn)} at the middle of the attic room. That is storage height. A room people use needs ${feetInches(rules.loftHeadroomIn)}, so steepen the roof or widen the building.` });
  }
  warnings.push({ code: 'attic-stair', text: 'The stair up to the attic room is not on the list. The truss maker frames the stair opening and sets the final room size.' });
  items.push({ group: 'Interior', name: 'Attic Subfloor', size: rules.loftSubfloorSize, length: '', qty: up(attic.sqFt / 32) });
  return { errors, warnings, items, name: TRUSS_TYPE_NAMES.attic, size: `, ${tidy(b.atticRoomIn / 12)} ft room`, attic };
}
