// Places the wood: posts, trusses, skirt boards, girts, purlins, and the
// framing around doors and windows.
import { wallLengthIn, wallTopIn, isGable, WALLS } from './building.js';
import { cutStock, fitStock, add, segments, feetInches } from './stock.js';

const EPS = 0.01;

function evenSpots(lengthIn, maxSpacingIn) {
  const bays = Math.max(1, Math.ceil(lengthIn / maxSpacingIn - EPS));
  return Array.from({ length: bays + 1 }, (_, i) => (i * lengthIn) / bays);
}

// Where a point along a wall sits on the floor plan, in inches from the
// front-left corner.
export function planPoint(b, wall, atIn) {
  if (wall === 'front') return { x: atIn, y: 0 };
  if (wall === 'back') return { x: atIn, y: b.widthIn };
  if (wall === 'left') return { x: 0, y: atIn };
  return { x: b.lengthIn, y: atIn };
}

export function placePosts(b, rules) {
  const posts = [];
  const warnings = [];
  const errors = [];

  for (const wall of WALLS) {
    const len = wallLengthIn(b, wall);
    let spots = evenSpots(len, b.postSpacingIn);
    // Corner posts belong to the long walls, so gable ends skip them.
    if (isGable(wall)) spots = spots.slice(1, -1);

    for (const o of b.openings.filter((op) => op.wall === wall)) {
      const inside = spots.filter((s) => s > o.startIn + EPS && s < o.endIn - EPS);
      const wideDoor = o.toGround && o.widthIn >= rules.doorJambPostMinFt * 12 - EPS;
      if (wideDoor) {
        spots = spots.filter((s) => !inside.includes(s));
        for (const jamb of [o.startIn, o.endIn]) {
          const atCorner = jamb < 6 || jamb > len - 6;
          if (isGable(wall) && atCorner) continue;
          const near = spots.find((s) => Math.abs(s - jamb) < 6);
          if (near === undefined) { spots.push(jamb); continue; }
          // A regular post a few inches off the door's edge serves as the door post, so the door should meet it.
          if (Math.abs(near - jamb) > EPS && !warnings.some((w) => w.openingIndex === o.index)) {
            const what = o.type === 'slider' ? 'sliding door' : 'overhead door';
            warnings.push({
              code: 'door-edge-off-post', wall, postAtIn: near, openingIndex: o.index, slideByIn: near - jamb,
              text: `The ${what} on the ${wall} wall stops ${feetInches(Math.abs(near - jamb))} short of the post at ${feetInches(near)}. `
                + `Slide it ${feetInches(Math.abs(near - jamb))} to meet the post, or move the post.`,
            });
          }
        }
      } else {
        for (const s of inside) {
          const slideIn = Math.min(o.endIn - s, s - o.startIn);
          const towardStart = o.endIn - s <= s - o.startIn;
          const what = o.type === 'window' ? 'window' : 'walk door';
          warnings.push({
            code: 'opening-on-post', wall, postAtIn: s, openingIndex: o.index, slideByIn: towardStart ? -slideIn : slideIn,
            // The longer way round, for when the short slide would run into another opening.
            otherSlideByIn: towardStart ? s - o.startIn : s - o.endIn,
            text: `The ${what} on the ${wall} wall lands on the post at ${feetInches(s)}. `
              + `Slide it ${feetInches(slideIn)} to clear the post, or move the post.`,
          });
        }
      }
    }

    for (const atIn of spots.sort((a, c) => a - c)) {
      const topIn = wallTopIn(b, wall, atIn);
      const stockFt = fitStock(topIn + rules.postEmbedmentIn, rules.postStockFt);
      if (stockFt === null) {
        errors.push(`The post at ${feetInches(atIn)} on the ${wall} wall needs to be `
          + `${feetInches(topIn + rules.postEmbedmentIn)} long, which is longer than any stocked post.`);
      }
      posts.push({ wall, atIn, ...planPoint(b, wall, atIn), topIn, stockFt });
    }
  }
  return { posts, warnings, errors };
}

export function placeTrusses(b) {
  return evenSpots(b.lengthIn, b.trussSpacingIn).map((x) => ({ x, spanIn: b.widthIn }));
}

// Roof slope from ridge to the outer edge of the overhang.
export function slopeIn(b) {
  const run = b.widthIn / 2 + b.overhangIn;
  return Math.hypot(run, run * b.pitch / 12);
}

function cutsAt(b, wall, heightIn, groundOnly = false) {
  return b.openings
    .filter((o) => o.wall === wall && (groundOnly ? o.toGround : heightIn > o.sillIn + EPS && heightIn < o.sillIn + o.heightIn - EPS))
    .map((o) => [o.startIn, o.endIn]);
}

export function frameWalls(b, rules) {
  const skirt = {};
  const girts = {};
  const girtRows = [];

  const rowCount = Math.ceil((b.eaveIn - rules.skirtHeightIn) / rules.girtSpacingIn - EPS);
  const rowHeights = Array.from({ length: rowCount }, (_, i) =>
    Math.min(rules.skirtHeightIn + (i + 1) * rules.girtSpacingIn, b.eaveIn));

  for (const wall of WALLS) {
    const len = wallLengthIn(b, wall);
    for (const seg of segments(len, cutsAt(b, wall, 0, true))) {
      for (const ft of cutStock(seg, rules.lumberStockFt)) add(skirt, ft);
    }
    for (const h of rowHeights) {
      girtRows.push({ wall, heightIn: h });
      for (const seg of segments(len, cutsAt(b, wall, h))) {
        for (const ft of cutStock(seg, rules.lumberStockFt)) add(girts, ft);
      }
    }
    if (isGable(wall)) {
      // Rows keep going up the gable triangle, each one shorter than the last.
      for (let up = rules.girtSpacingIn; up < b.riseIn - EPS; up += rules.girtSpacingIn) {
        const rowLen = b.widthIn * (1 - up / b.riseIn);
        girtRows.push({ wall, heightIn: b.eaveIn + up, lengthIn: rowLen });
        for (const ft of cutStock(rowLen, rules.lumberStockFt)) add(girts, ft);
      }
    }
  }
  return { skirt, girts, girtRows, girtRowsPerWall: rowCount };
}

export function frameRoof(b, rules) {
  const purlins = {};
  const rowsPerSide = Math.ceil(slopeIn(b) / rules.purlinSpacingIn - EPS) + 1;
  const rowLengthIn = b.lengthIn + 2 * b.overhangIn;
  for (let i = 0; i < rowsPerSide * 2; i++) {
    for (const ft of cutStock(rowLengthIn, rules.lumberStockFt)) add(purlins, ft);
  }
  return { purlins, rowsPerSide, rowLengthIn };
}

export function frameOpenings(b, rules) {
  const headers = {};
  const blocking = {};
  for (const o of b.openings) {
    for (let i = 0; i < 2; i++) for (const ft of cutStock(o.widthIn, rules.lumberStockFt)) add(headers, ft);
    if (o.type === 'window') for (const ft of cutStock(o.widthIn, rules.lumberStockFt)) add(blocking, ft);
    if (o.type === 'slider') for (const ft of cutStock(o.widthIn * 2, rules.lumberStockFt)) add(blocking, ft);
  }
  return { headers, blocking };
}
