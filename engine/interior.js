// What goes inside the shell: interior walls and a loft.
//
// An interior wall is a stud wall that carries nothing but itself. It stands
// on the floor and stops at the underside of the trusses.
//
// A loft is a floor across one end of the building. Its joists run the long
// way, from a ledger on the end wall posts to a beam on a row of its own
// posts under the open edge. A straight stair comes down from the open edge
// along the front wall.
import { fitStock, feetInches } from './stock.js';
import { boards } from './runs.js';

const EPS = 0.01;
const up = (n) => Math.ceil(n - EPS);
const BOARD_IN = { '2x8': 7.25, '2x10': 9.25, '2x12': 11.25 };
const line = (group, name, size, qty, more = {}) => ({ group, name, size, length: '', qty, ...more });

function evenSpots(lengthIn, maxSpacingIn) {
  const bays = Math.max(1, up(lengthIn / maxSpacingIn));
  return Array.from({ length: bays + 1 }, (_, i) => (i * lengthIn) / bays);
}

export const INTERIOR_LUMBER = ['Partition Bottom Plates', 'Partition Top Plates', 'Partition Studs', 'Partition Door Headers',
  'Loft Ledgers', 'Loft Beams', 'Loft Joists', 'Stair Stringers', 'Stair Treads'];

export function placeInterior(b, rules, wallPosts) {
  const errors = [], warnings = [], runs = [], items = [];
  const stock = rules.lumberStockFt;
  const put = (part, size, where, pieces, note = '') => runs.push({ part, size, where, note, pieces });

  // The loft first: interior walls have to stay out from under it.
  let loft = null;
  if (b.loft) {
    const f = b.loft, W = b.widthIn;
    const size = Object.entries(rules.loftJoistSpanIn).find(([, maxIn]) => f.depthIn <= maxIn + EPS)?.[0];
    const deepest = Math.max(...Object.values(rules.loftJoistSpanIn));
    if (!size) errors.push(`A loft ${feetInches(f.depthIn)} deep is past what a 2x12 floor joist can span, which is ${feetInches(deepest)}. Make it shallower.`);
    const joistIn = BOARD_IN[size ?? '2x12'];
    const underIn = f.heightIn - joistIn;
    const aboveIn = b.eaveIn - f.heightIn - 0.75;
    if (aboveIn < 48 - EPS) errors.push(`The loft floor would sit only ${feetInches(Math.max(0, aboveIn))} under the trusses. Lower the loft or raise the wall.`);
    for (const o of b.openings) {
      if (o.wall === f.end && o.sillIn + o.heightIn > underIn - EPS) {
        errors.push(`The opening on the ${f.end} wall is taller than the underside of the loft, which is ${feetInches(underIn)} above the floor. Raise the loft or move the opening.`);
      }
    }
    const atEnd = f.end === 'left';
    const edgeX = atEnd ? f.depthIn : b.lengthIn - f.depthIn;
    const wallX = atEnd ? 0 : b.lengthIn;

    // Stair: the fewest steps that keep each one under the tallest riser allowed.
    const riseIn = f.heightIn + 0.75;
    const risers = up(riseIn / rules.stairRiserMaxIn), treads = risers - 1;
    const runIn = treads * rules.stairTreadIn;
    const stringerIn = Math.hypot(runIn, riseIn);
    const stringerFt = fitStock(stringerIn, rules.stairStringerStockFt);
    const openIn = b.lengthIn - f.depthIn;
    if (runIn + 36 > openIn + EPS) errors.push(`The loft stair runs ${feetInches(runIn)} along the floor and needs 3 ft to step off at the bottom. Only ${feetInches(openIn)} of the building is open. Make the loft shallower or lower.`);
    if (stringerFt === null) errors.push(`The loft stair needs stringers ${feetInches(stringerIn)} long, which is longer than any stocked board. Lower the loft.`);

    if (!errors.length) {
      if (aboveIn < rules.loftHeadroomIn - EPS) {
        warnings.push({ code: 'loft-low-above', text: `There is ${feetInches(aboveIn)} between the loft floor and the trusses. That is storage height. A room people use needs ${feetInches(rules.loftHeadroomIn)}.` });
      }
      if (underIn < rules.loftHeadroomIn - EPS) {
        warnings.push({ code: 'loft-low-below', text: `There is ${feetInches(underIn)} under the loft joists. A room people use needs ${feetInches(rules.loftHeadroomIn)}.` });
      }
      const dir = atEnd ? 1 : -1;
      const postYs = evenSpots(W, rules.loftPostSpacingFt * 12);
      const postStock = fitStock(f.heightIn + rules.postEmbedmentIn, rules.postStockFt);
      const posts = postYs.map((y) => ({ where: 'Loft', x: edgeX, y, topIn: f.heightIn, stockFt: postStock, sloped: false }));
      const endPosts = [0, W, ...wallPosts.filter((p) => p.wall === f.end).map((p) => p.atIn)];
      put('Loft Ledgers', size, 'Loft', boards(0, W, endPosts, stock), 'Fastened across the end wall posts, top edge at the joist tops');
      for (let ply = 0; ply < 2; ply++) {
        put('Loft Beams', rules.loftBeamSize, 'Loft', boards(0, W, postYs, stock, ply === 1), 'Two boards, one on each side of the loft posts');
      }
      const joists = evenSpots(W, rules.loftJoistSpacingIn);
      const cutIn = f.depthIn - 3;
      put('Loft Joists', size, 'Loft', joists.map(() => ({ cutIn, stockFt: fitStock(cutIn, stock) })), 'Hung in joist hangers between the ledger and the beam');
      put('Stair Stringers', rules.stairStringerSize, 'Loft stair', Array.from({ length: rules.stairStringers }, () => ({ cutIn: stringerIn, stockFt: stringerFt })), `Notched for ${risers} risers of ${(riseIn / risers).toFixed(2)} in and ${treads} treads of ${rules.stairTreadIn} in`);
      const perBoard = Math.floor(144 / rules.stairWidthIn);
      put('Stair Treads', '2x12', 'Loft stair', Array.from({ length: up(treads / perBoard) }, () => ({ cutIn: 144, stockFt: 12 })), `Cut into ${rules.stairWidthIn} in treads, ${treads} needed`);

      const sqFt = (W * f.depthIn) / 144;
      const guardIn = W - rules.stairWidthIn + stringerIn;
      items.push(
        line('Interior', 'Joist Hangers', `for ${size} joists`, joists.length * 2),
        line('Interior', 'Loft Subfloor', rules.loftSubfloorSize, up(sqFt / 32)),
        line('Interior', 'Guard Rail', `${rules.guardHeightIn} in high`, 1, { length: feetInches(guardIn), ft: guardIn / 12 }),
        line('Interior', 'Stair Handrail', '', 1, { length: feetInches(stringerIn), ft: stringerIn / 12 }),
      );
      loft = {
        ...f, edgeX, wallX, joistSize: size, joistIn, underIn, aboveIn, joists, posts, sqFt,
        stair: { risers, treads, riseIn, runIn, stringerIn, widthIn: rules.stairWidthIn, x0: edgeX, x1: edgeX + dir * runIn, y0: 0, y1: rules.stairWidthIn },
      };
    }
  }

  const studFt = fitStock(b.eaveIn - 3, rules.partitionStudStockFt);
  const studSize = rules.partitionStudByHeightFt.find(([maxFt]) => b.eaveIn <= maxFt * 12 + EPS)?.[1];
  const tallest = Math.max(...rules.partitionStudByHeightFt.map(([maxFt]) => maxFt));
  if (b.partitions.length && (!studSize || studFt === null)) {
    errors.push(`Interior walls are framed up to ${tallest} ft tall. This wall height is ${feetInches(b.eaveIn)}.`);
  }
  const doorIn = rules.partitionDoorWidthIn + rules.partitionDoorRoughExtraIn;
  const partitions = [];
  let sheets = 0, doorCount = 0;
  for (const p of b.partitions) {
    const where = `Interior wall ${p.index + 1}`;
    if (b.loft) {
      const lo = b.loft.end === 'left' ? 0 : b.lengthIn - b.loft.depthIn, hi = lo + b.loft.depthIn;
      const [x0, x1] = p.axis === 'across' ? [p.atIn, p.atIn] : [p.startIn, p.endIn];
      if (x1 > lo + EPS && x0 < hi - EPS) { errors.push(`${where} runs under the loft. Interior walls have to stay in the open part of the building.`); continue; }
    }
    if (!studSize || studFt === null) continue;
    const plate = studSize === '2x6' ? '2x6' : rules.partitionPlateSize;
    const studs = evenSpots(p.lengthIn, rules.partitionStudSpacingIn).map((v) => p.startIn + v);
    const doors = Array.from({ length: p.doors }, (_, i) => {
      const mid = p.startIn + p.lengthIn * (i + 0.5) / p.doors;
      return { startIn: mid - doorIn / 2, endIn: mid + doorIn / 2 };
    });
    put('Partition Bottom Plates', `${plate} treated`, where, boards(p.startIn, p.endIn, [], stock), p.doors ? 'Cut out of each doorway once the wall is standing' : '');
    put('Partition Top Plates', plate, where, boards(p.startIn, p.endIn, [], stock), 'Fastened to the truss bottom chords or to blocking between them');
    put('Partition Studs', studSize, where, Array.from({ length: studs.length + p.doors * rules.partitionDoorExtraStuds }, () => ({ cutIn: b.eaveIn - 3, stockFt: studFt })));
    if (p.doors) put('Partition Door Headers', plate, where, doors.map(() => ({ cutIn: doorIn + 3, stockFt: fitStock(doorIn + 3, stock) })), 'Laid flat over the doorway');
    doorCount += p.doors;
    if (p.sheathed) sheets += up(2 * p.lengthIn * b.eaveIn / 144 / 32);
    partitions.push({ ...p, heightIn: b.eaveIn, studSize, studs, doors });
  }
  if (doorCount) items.unshift(line('Interior', 'Interior Doors', `${feetInches(rules.partitionDoorWidthIn)} wide`, doorCount));
  if (sheets) items.unshift(line('Interior', 'Partition Sheathing', rules.partitionSheetSize, sheets));

  return { errors, warnings, runs, items, partitions, loft, posts: loft?.posts ?? [] };
}
