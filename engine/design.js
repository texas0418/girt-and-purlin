// The one entry point: a building description in, every part out.
import { normalize } from './building.js';
import { resolveRules, unverifiedRules } from './rules.js';
import { placePosts, placeTrusses } from './framing.js';
import { WALL_NAMES, lumberRuns, girtRowCount, girtTopIn, gableGirtRows, purlinRowsPerSide, purlinRows, planePurlinRows } from './runs.js';
import { isGable, isOpen, closedWalls, GAMBREL } from './building.js';
import { roofPanels, wallPanels, trim, closures, screws, areas } from './metal.js';
import { feetInches, add } from './stock.js';
import { cutList } from './cutlist.js';
import { placeSheds, shedRuns, shedMetal } from './sheds.js';
import { finishRuns, finishParts, FINISH_LUMBER } from './finish.js';
import { placeInterior, INTERIOR_LUMBER } from './interior.js';

// ft and sqFt are the numbers a price list multiplies by.
function lines(group, name, size, tally, label = (k) => `${k} ft`, ft = (k) => k) {
  return Object.keys(tally).map(Number).sort((a, b) => b - a)
    .map((k) => ({ group, name, size, length: label(k), qty: tally[k], ft: ft(k) }));
}
const inchesToFt = (k) => k / 12;
export const TRUSS_NAMES = { gable: 'Trusses', mono: 'Single Slope Trusses', gambrel: 'Gambrel Trusses' };

export function design(input, ruleOverrides) {
  let rules = resolveRules(ruleOverrides);
  const { building: b, errors } = normalize(input);
  if (errors.length) return { ok: false, errors, warnings: [], items: [] };
  // Posts on brackets stand on the concrete, so nothing goes in the ground.
  if (b.options.footing === 'bracket') rules = { ...rules, postEmbedmentIn: 0 };

  const { posts, warnings, errors: postErrors } = placePosts(b, rules);
  if (postErrors.length) return { ok: false, errors: postErrors, warnings, items: [] };

  const trusses = placeTrusses(b);
  if (b.roof !== 'gambrel' && b.pitch < rules.minPanelPitch - 0.01) {
    warnings.push({ code: 'roof-flat', text: `The roof is flatter than ${rules.minPanelPitch} in 12. Rib panels that flat need sealant in every lap, and most steel warranties do not cover them.` });
  }
  if (b.roof === 'mono' && b.riseIn > rules.monoTrussMaxRiseFt * 12 + 0.01) {
    warnings.push({ code: 'mono-tall', text: `The single-slope trusses would stand ${feetInches(b.riseIn)} tall. Past ${rules.monoTrussMaxRiseFt} ft a truss this shape is hard to build and haul, so lower the pitch or narrow the building.` });
  }
  const openNames = ['front', 'back', 'left', 'right'].filter((wall) => isOpen(b, wall));
  if (openNames.length) {
    const list = openNames.map((wall) => WALL_NAMES[wall].toLowerCase()).join(', ').replace(/, ([^,]*)$/, ' and $1');
    warnings.push({ code: 'open-wall', text: `The ${list} ${openNames.length === 1 ? 'is' : 'are'} open. An open wall has no girts or steel to brace the frame, so the engineer has to size the beam over those posts and the bracing that takes the wall's place.` });
  }
  const { sheds, errors: shedErrors, warnings: shedWarnings } = placeSheds(b, rules);
  warnings.push(...shedWarnings);
  if (shedErrors.length) return { ok: false, errors: shedErrors, warnings, items: [] };
  const shedPosts = sheds.flatMap((s) => s.posts);
  const interior = placeInterior(b, rules, posts);
  if (interior.errors.length) return { ok: false, errors: interior.errors, warnings, items: [] };
  warnings.push(...interior.warnings);
  const runs = [...lumberRuns(b, rules, posts, trusses), ...shedRuns(b, rules, sheds, posts), ...finishRuns(b, rules, posts, trusses, sheds), ...interior.runs];
  const extra = shedMetal(b, rules, sheds);
  const merged = (base, more) => { for (const [k, n] of Object.entries(more)) add(base, k, n); return base; };
  const mainRoof = roofPanels(b, rules);
  const finish = finishParts(b, rules, {
    posts: [...posts, ...shedPosts, ...interior.posts], trusses, sheds,
    wallTally: merged(wallPanels(b, rules), extra.wall), roofTally: merged({ ...mainRoof }, extra.roof), mainRoofPanelIn: Math.max(...Object.keys(mainRoof).map(Number)),
  });
  if (finish.errors.length) return { ok: false, errors: finish.errors, warnings, items: [] };
  warnings.push(...finish.warnings);
  const fasteners = screws(b, rules, extra, finish.screws);

  // Boards counted by part, then size, then stock length.
  const tally = {};
  for (const r of runs) for (const p of r.pieces) {
    const bySize = (tally[r.part] ??= {});
    const byLen = (bySize[r.size] ??= {});
    byLen[p.stockFt] = (byLen[p.stockFt] ?? 0) + 1;
  }
  const lumber = (name, group = 'Framing') => Object.entries(tally[name] ?? {}).flatMap(([size, t]) => lines(group, name, size, t));

  // Where each girt row sits, for the picture and the drawings.
  const girtRows = [];
  for (const wall of closedWalls(b)) {
    for (let i = 0; i < girtRowCount(b, rules, wall); i++) {
      girtRows.push({ wall, heightIn: Math.min(rules.skirtHeightIn + (i + 1) * rules.girtSpacingIn, girtTopIn(b, wall)) });
    }
    if (isGable(wall)) {
      for (const g of gableGirtRows(b, rules)) girtRows.push({ wall, heightIn: g.heightIn, startIn: g.startIn, lengthIn: g.endIn - g.startIn });
    }
  }

  const postTally = {};
  for (const p of [...posts, ...shedPosts, ...interior.posts]) postTally[p.stockFt] = (postTally[p.stockFt] ?? 0) + 1;

  const items = [
    ...lines('Framing', 'Posts', rules.postSize, postTally),
    { group: 'Framing', name: TRUSS_NAMES[b.roof], size: `${b.widthIn / 12} ft span, ${b.roof === 'gambrel' ? `${GAMBREL.lowerPitch}/12 and ${GAMBREL.upperPitch}/12` : `${b.pitch}/12`}`, length: '', qty: trusses.length, ft: b.widthIn / 12 },
    ...lumber('Skirt Boards'),
    ...lumber('Wall Girts'),
    ...lumber('Roof Purlins'),
    ...lumber('Truss Carriers'),
    ...lumber('Rafter Ledgers'),
    ...lumber('Eave Beams'),
    ...lumber('Rafters'),
    ...lumber('Headers'),
    ...lumber('Opening Blocking'),
    ...FINISH_LUMBER.flatMap((name) => lumber(name)),
    ...lines('Metal', 'Roof Panels', '', finish.roof, feetInches, inchesToFt),
    ...lines('Metal', 'Wall Panels', '', finish.walls, feetInches, inchesToFt),
    ...lines('Metal', 'Wainscot Panels', '', finish.wainscot, feetInches, inchesToFt),
    ...finish.metal,
    ...lines('Interior', 'Liner Panels', '', finish.liner, feetInches, inchesToFt),
    ...Object.entries(merged(merged(trim(b, rules), extra.trim), finish.trim)).map(([name, qty]) => ({ group: 'Metal', name, size: '', length: feetInches(rules.trimPieceIn), qty, ft: rules.trimPieceIn / 12 })),
    ...Object.entries(merged(closures(b, rules), extra.closures)).map(([name, qty]) => ({ group: 'Metal', name, size: '', length: feetInches(rules.closureStripIn), qty })),
    { group: 'Metal', name: 'Panel Screws', size: `bag of ${rules.screwsPerBag}`, length: '', qty: fasteners.bags },
    ...b.openings.map((o) => ({
      group: 'Doors And Windows',
      name: { slider: 'Sliding Door', walk: 'Walk Door', overhead: 'Overhead Door', window: 'Window' }[o.type],
      size: `${feetInches(o.widthIn)} x ${feetInches(o.heightIn)}`, length: '', qty: 1, sqFt: (o.widthIn * o.heightIn) / 144,
    })),
    ...INTERIOR_LUMBER.flatMap((name) => lumber(name, 'Interior')),
    ...interior.items,
    ...finish.items,
  ];

  return {
    ok: true, errors: [], warnings, items,
    summary: {
      floorSqFt: (b.widthIn * b.lengthIn) / 144,
      shedSqFt: sheds.reduce((sum, s) => sum + (s.lengthIn * s.depthIn) / 144, 0),
      posts: posts.length + shedPosts.length + interior.posts.length, trusses: trusses.length,
      girtRowsPerWall: girtRowCount(b, rules), purlinRowsPerSide: purlinRowsPerSide(b, rules), purlinRows: purlinRows(b, rules),
      peakIn: b.eaveIn + b.riseIn,
      loftSqFt: interior.loft?.sqFt ?? 0, linerSqFt: finish.linerSqFt, slabSqFt: finish.slabSqFt,
      screws: fasteners.count, roofSqFt: areas(b).roofSqFt + extra.roofSqFt, wallSqFt: areas(b).wallSqFt + extra.wallSqFt,
    },
    geometry: { building: b, posts, trusses, girtRows, sheds, partitions: interior.partitions, loft: interior.loft, cupolas: finish.cupolas, planes: b.planes.map((p) => ({ ...p, purlinRows: planePurlinRows(p, rules) })), purlinRowLengthIn: b.lengthIn + 2 * b.overhangIn },
    cuts: cutList(rules, [...posts, ...sheds.flatMap((sh) => sh.posts.map((p) => ({ ...p, where: sh.label, sloped: p.line !== 'outer' }))), ...interior.posts], runs),
    rules,
    unverifiedRules: unverifiedRules(),
  };
}

// Finds one line in a result, for tests and for the screen.
export function qty(result, name, length) {
  return result.items.filter((i) => i.name === name && (length === undefined || i.length === length))
    .reduce((sum, i) => sum + i.qty, 0);
}
