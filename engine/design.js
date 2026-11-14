// The one entry point: a building description in, every part out.
import { normalize } from './building.js';
import { resolveRules, unverifiedRules } from './rules.js';
import { placePosts, placeTrusses } from './framing.js';
import { WALL_NAMES, lumberRuns, girtRowCount, girtTopIn, gableGirtRows, purlinRowsPerSide, purlinRows, planePurlinRows, hipPurlinRows } from './runs.js';
import { isGable, isOpen, closedWalls, hipGeo, roofRunIn, GAMBREL } from './building.js';
import { roofPanels, wallPanels, sliderPanels, trim, closures, screws, areas } from './metal.js';
import { feetInches, add } from './stock.js';
import { cutList } from './cutlist.js';
import { placeSheds, shedRuns, shedMetal } from './sheds.js';
import { finishRuns, finishParts, FINISH_LUMBER } from './finish.js';
import { placeInterior, INTERIOR_LUMBER } from './interior.js';
import { trussParts } from './trusses.js';
import { coverParts } from './coverings.js';
import { placeAdditions, additionRuns, additionMetal, additionItems } from './additions.js';
import { studWalls } from './studwalls.js';
import { joinRuns, joinMetal, placeWings, mergeWings } from './wings.js';

// ft and sqFt are the numbers a price list multiplies by.
function lines(group, name, size, tally, label = (k) => `${k} ft`, ft = (k) => k) {
  return Object.keys(tally).map(Number).sort((a, b) => b - a)
    .map((k) => ({ group, name, size, length: label(k), qty: tally[k], ft: ft(k) }));
}
const inchesToFt = (k) => k / 12;
export const TRUSS_NAMES = { gable: 'Trusses', mono: 'Single Slope Trusses', gambrel: 'Gambrel Trusses', hip: 'Trusses' };

export function design(input, ruleOverrides) {
  let rules = resolveRules(ruleOverrides);
  const { building: b, errors } = normalize(input);
  if (errors.length) return { ok: false, errors, warnings: [], items: [] };
  // Posts on brackets stand on the concrete, so nothing goes in the ground.
  if (b.options.footing === 'bracket') rules = { ...rules, postEmbedmentIn: 0 };
  // The embedment rule is a minimum: where frost goes deeper, the posts go down to it.
  const frostIn = Math.ceil(b.loads.frostIn - 0.001), shallowIn = rules.postEmbedmentIn;
  if (shallowIn > 0 && frostIn > shallowIn) rules = { ...rules, postEmbedmentIn: frostIn };

  // Stud walls stand on concrete, so no posts go in the ground.
  const stud = b.framing === 'stud';
  const { posts, warnings, errors: postErrors } = stud ? { posts: [], warnings: [], errors: [] } : placePosts(b, rules);
  if (postErrors.length) return { ok: false, errors: postErrors, warnings, items: [] };

  const trusses = placeTrusses(b);
  if (!stud && rules.postEmbedmentIn > shallowIn && shallowIn > 0) {
    warnings.push({ code: 'frost-deep', text: `Frost here goes ${feetInches(frostIn)} deep, so the posts are set ${feetInches(frostIn)} into the ground, not the usual ${feetInches(shallowIn)}. The posts are longer to suit.` });
  }
  const { roofCover, wallCover } = b.options;
  if (roofCover === 'steel' && b.roof !== 'gambrel' && b.pitch < rules.minPanelPitch - 0.01) {
    warnings.push({ code: 'roof-flat', text: `The roof is flatter than ${rules.minPanelPitch} in 12. Rib panels that flat need sealant in every lap, and most steel warranties do not cover them.` });
  }
  if (b.roof === 'mono' && b.riseIn > rules.monoTrussMaxRiseFt * 12 + 0.01) {
    warnings.push({ code: 'mono-tall', text: `The single-slope trusses would stand ${feetInches(b.riseIn)} tall. Past ${rules.monoTrussMaxRiseFt} ft a truss this shape is hard to build and haul, so lower the pitch or narrow the building.` });
  }
  const hip = b.roof === 'hip';
  // Full trusses stand only under the ridge. Every truss line nearer an end wall than half the width belongs to that end's hip set.
  const commons = hip ? trusses.filter((t) => t.x > b.widthIn / 2 - 0.01 && t.x < b.lengthIn - b.widthIn / 2 + 0.01).length : trusses.length;
  const hipLines = (trusses.length - commons) / 2;
  if (hip) {
    warnings.push({ code: 'hip-set', text: `Each end of a hip roof is framed with a hip set from the truss maker: flat-topped trusses that step down toward the end wall, with short jack trusses out to the wall and the corners. The list carries one set for each end, covering the ${hipLines} truss lines in the last ${feetInches(b.widthIn / 2)}. The truss maker designs the set, and the engineer confirms the carrier on each end wall.` });
    if (roofCover !== 'shingles') warnings.push({ code: 'hip-cut', text: 'The roof panels that meet a hip are listed at the length of their longer edge and are cut on the slant on site. Foam closures do not fit under the hip caps, because the ribs meet them at an angle; ask the steel supplier for the sealing tape they use there.' });
  }
  const openNames = ['front', 'back', 'left', 'right'].filter((wall) => isOpen(b, wall) && !b.walls[wall].joined);
  if (openNames.length) {
    const list = openNames.map((wall) => WALL_NAMES[wall].toLowerCase()).join(', ').replace(/, ([^,]*)$/, ' and $1');
    warnings.push({ code: 'open-wall', text: `The ${list} ${openNames.length === 1 ? 'is' : 'are'} open. An open wall has no girts or steel to brace the frame, so the engineer has to size the beam over those posts and the bracing that takes the wall's place.` });
  }
  const trussType = trussParts(b, rules);
  if (trussType.errors.length) return { ok: false, errors: trussType.errors, warnings, items: [] };
  warnings.push(...trussType.warnings);
  const { sheds, errors: shedErrors, warnings: shedWarnings } = placeSheds(b, rules);
  warnings.push(...shedWarnings.filter((w) => roofCover === 'steel' || w.code !== 'shed-flat'));
  if (shedErrors.length) return { ok: false, errors: shedErrors, warnings, items: [] };
  const shedPosts = sheds.flatMap((s) => s.posts);
  const added = placeAdditions(b, rules);
  warnings.push(...added.warnings.filter((w) => roofCover === 'steel' || w.code !== 'shed-flat'));
  if (added.errors.length) return { ok: false, errors: added.errors, warnings, items: [] };
  const interior = placeInterior(b, rules, posts);
  if (interior.errors.length) return { ok: false, errors: interior.errors, warnings, items: [] };
  warnings.push(...interior.warnings);
  const studs = stud ? studWalls(b, rules) : null;
  if (studs?.errors.length) return { ok: false, errors: studs.errors, warnings, items: [] };
  if (studs) warnings.push(...studs.warnings);
  const runs = [...lumberRuns(b, rules, posts, trusses), ...(studs?.runs ?? []), ...joinRuns(b, rules), ...shedRuns(b, rules, sheds, posts), ...additionRuns(b, rules, added), ...finishRuns(b, rules, posts, trusses, sheds), ...interior.runs];
  // Boards that fasten across posts on a post building fasten across the studs here.
  if (stud) for (const r of runs) if (r.note) r.note = r.note.replace('main wall posts', 'wall studs').replace('end wall posts', 'wall studs');
  const merged = (base, more) => { for (const [k, n] of Object.entries(more)) add(base, k, n); return base; };
  // Everything hung on or framed onto the building: lean-tos and porches, then awnings and dormers.
  const extraFor = (r) => {
    const s = shedMetal(b, r, sheds), a = additionMetal(b, r, added), j = joinMetal(b, r);
    for (const k of ['roof', 'wall', 'trim', 'closures']) { merged(s[k], a[k]); merged(s[k], j[k]); }
    return { ...s, roofSqFt: s.roofSqFt + a.roofSqFt + j.roofSqFt, wallSqFt: s.wallSqFt + a.wallSqFt, surfaces: [...a.surfaces, ...j.surfaces] };
  };
  const extra = extraFor(rules);
  // Standing seam panels are narrower than rib panels; shingles and wood walls take no panels at all.
  const roofRules = roofCover === 'standing' ? { ...rules, panelCoverageIn: rules.seamCoverageIn } : rules;
  if (roofCover === 'standing') extra.roof = extraFor(roofRules).roof;
  if (roofCover === 'shingles') extra.roof = {};
  if (roofCover !== 'steel') extra.closures = {};
  if (wallCover !== 'steel') extra.wall = {};
  const mainRoof = roofCover === 'shingles' ? {} : roofPanels(b, roofRules);
  const mainWalls = wallCover === 'steel' ? wallPanels(b, rules) : { tally: {}, short: {} };
  const totalSqFt = { roofSqFt: areas(b).roofSqFt + extra.roofSqFt, wallSqFt: areas(b).wallSqFt + extra.wallSqFt };
  const cover = coverParts(b, rules, { sheds, more: extra.surfaces, extraWall: (r) => extraFor(r).wall, roofTally: merged({ ...mainRoof }, extra.roof), ...totalSqFt });
  if (cover.errors.length) return { ok: false, errors: cover.errors, warnings, items: [] };
  warnings.push(...cover.warnings);
  const shellTrim = merged(trim(b, rules), extra.trim);
  for (const name of cover.dropTrim) delete shellTrim[name];
  if (wallCover !== 'steel') delete shellTrim['Inside Corner Trim'];
  const finish = finishParts(b, rules, {
    posts: [...posts, ...shedPosts, ...interior.posts], trusses, sheds,
    wallTally: merged(mainWalls.tally, extra.wall), roofTally: merged({ ...mainRoof }, extra.roof), mainRoofPanelIn: Math.max(...Object.keys(mainRoof).map(Number)),
  });
  if (finish.errors.length) return { ok: false, errors: finish.errors, warnings, items: [] };
  warnings.push(...finish.warnings);
  const fasteners = screws(b, rules, extra, finish.screws, { roof: roofCover === 'steel', wall: wallCover === 'steel' });

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
  for (const wall of stud ? [] : closedWalls(b)) {
    for (let i = 0; i < girtRowCount(b, rules, wall); i++) {
      girtRows.push({ wall, heightIn: Math.min(rules.skirtHeightIn + (i + 1) * rules.girtSpacingIn, girtTopIn(b, wall)) });
    }
    if (isGable(wall)) {
      for (const g of gableGirtRows(b, rules)) girtRows.push({ wall, heightIn: g.heightIn, startIn: g.startIn, lengthIn: g.endIn - g.startIn });
    }
  }

  const postTally = {}, columnTally = {};
  for (const p of [...posts, ...shedPosts, ...interior.posts]) {
    const t = p.column ? columnTally : postTally;
    t[p.stockFt] = (t[p.stockFt] ?? 0) + 1;
  }

  const items = [
    ...lines('Framing', 'Posts', rules.postSize, postTally),
    ...lines('Framing', 'Laminated Columns', rules.columnSize, columnTally),
    ...(commons ? [{ group: 'Framing', name: trussType.name ?? TRUSS_NAMES[b.roof], size: `${b.widthIn / 12} ft span, ${b.roof === 'gambrel' ? `${GAMBREL.lowerPitch}/12 and ${GAMBREL.upperPitch}/12` : `${b.pitch}/12`}${trussType.size}`, length: '', qty: commons, ft: b.widthIn / 12 }] : []),
    ...(hip ? [{ group: 'Framing', name: 'Hip Truss Sets', size: `${b.widthIn / 12} ft span, ${b.pitch}/12, ${hipLines} truss lines and the jacks for one end`, length: '', qty: 2, ft: (b.widthIn / 12) * hipLines }] : []),
    ...lumber('Bottom Plates'),
    ...lumber('Wall Studs'),
    ...lumber('Top Plates'),
    ...lumber('Skirt Boards'),
    ...lumber('Wall Girts'),
    ...lumber('Roof Purlins'),
    ...lumber('Truss Carriers'),
    ...lumber('Rafter Ledgers'),
    ...lumber('Eave Beams'),
    ...lumber('Rafters'),
    ...lumber('Hip Rafters'),
    ...lumber('Valley Boards'),
    ...lumber('Dormer Framing'),
    ...lumber('Dormer Rafters'),
    ...additionItems(b, rules, added).filter((i) => i.group === 'Framing'),
    ...lumber('Headers'),
    ...lumber('Opening Framing'),
    ...lumber('Opening Blocking'),
    ...FINISH_LUMBER.flatMap((name) => lumber(name)),
    ...lines('Metal', roofCover === 'standing' ? 'Standing Seam Panels' : 'Roof Panels', '', finish.roof, feetInches, inchesToFt),
    ...lines('Metal', 'Wall Panels', '', merged({ ...finish.walls }, mainWalls.short), feetInches, inchesToFt),
    ...lines('Metal', 'Wainscot Panels', '', finish.wainscot, feetInches, inchesToFt),
    ...lines('Metal', 'Sliding Door Panels', '', sliderPanels(b, rules), feetInches, inchesToFt),
    ...finish.metal,
    ...lines('Interior', 'Liner Panels', '', finish.liner, feetInches, inchesToFt),
    ...Object.entries(merged(shellTrim, finish.trim)).map(([name, qty]) => ({ group: 'Metal', name, size: '', length: feetInches(rules.trimPieceIn), qty, ft: rules.trimPieceIn / 12 })),
    ...Object.entries(merged(roofCover === 'steel' ? closures(b, rules) : {}, extra.closures)).map(([name, qty]) => ({ group: 'Metal', name, size: '', length: feetInches(rules.closureStripIn), qty })),
    ...(fasteners.bags ? [{ group: 'Metal', name: 'Panel Screws', size: `bag of ${rules.screwsPerBag}`, length: '', qty: fasteners.bags }] : []),
    ...cover.items,
    ...b.openings.filter((o) => o.type !== 'wing').map((o) => ({
      group: 'Doors And Windows',
      name: { slider: 'Sliding Door', walk: 'Walk Door', overhead: 'Overhead Door', window: 'Window' }[o.type],
      size: `${feetInches(o.widthIn)} x ${feetInches(o.heightIn)}`, length: '', qty: 1, sqFt: (o.widthIn * o.heightIn) / 144,
    })),
    ...additionItems(b, rules, added).filter((i) => i.group !== 'Framing'),
    ...INTERIOR_LUMBER.flatMap((name) => lumber(name, 'Interior')),
    ...interior.items,
    ...finish.items,
    ...trussType.items,
  ];

  const result = {
    ok: true, errors: [], warnings, items,
    summary: {
      floorSqFt: (b.widthIn * b.lengthIn) / 144,
      shedSqFt: sheds.reduce((sum, s) => sum + (s.lengthIn * s.depthIn + s.ownedCorners.length * s.depthIn ** 2) / 144, 0),
      posts: posts.length + shedPosts.length + interior.posts.length, trusses: trusses.length,
      girtRowsPerWall: girtRowCount(b, rules), purlinRowsPerSide: purlinRowsPerSide(b, rules), purlinRows: purlinRows(b, rules),
      peakIn: b.eaveIn + b.riseIn,
      loftSqFt: interior.loft?.sqFt ?? 0, atticSqFt: trussType.attic?.sqFt ?? 0, linerSqFt: finish.linerSqFt, slabSqFt: finish.slabSqFt,
      screws: fasteners.count, roofSqFt: areas(b).roofSqFt + extra.roofSqFt, wallSqFt: areas(b).wallSqFt + extra.wallSqFt,
    },
    geometry: { building: b, posts, trusses, girtRows, sheds, awnings: added.awnings, dormers: added.dormers, partitions: interior.partitions, loft: interior.loft, attic: trussType.attic, cupolas: finish.cupolas, planes: b.planes.map((p) => ({ ...p, purlinRows: planePurlinRows(p, rules) })), purlinRowLengthIn: roofRunIn(b), studWalls: studs?.walls ?? null, wings: [], hip: hip ? { ...hipGeo(b), commons, rows: hipPurlinRows(b, rules) } : null },
    cuts: cutList(rules, [...(hip ? posts.map((p) => ({ ...p, where: WALL_NAMES[p.wall], sloped: false })) : posts), ...sheds.flatMap((sh) => sh.posts.map((p) => ({ ...p, where: sh.label, sloped: p.line !== 'outer' && p.line !== 'corner' }))), ...interior.posts], runs),
    rules,
    unverifiedRules: unverifiedRules(),
  };
  if (!b.wings.length) return result;
  // Each wing is designed as a building of its own, then folded into this one.
  const placed = placeWings(b, input, ruleOverrides, design);
  if (placed.errors.length) return { ok: false, errors: placed.errors, warnings, items: [] };
  return mergeWings(result, placed.wings);
}

// Finds one line in a result, for tests and for the screen.
export function qty(result, name, length) {
  return result.items.filter((i) => i.name === name && (length === undefined || i.length === length))
    .reduce((sum, i) => sum + i.qty, 0);
}
