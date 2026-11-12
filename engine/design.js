// The one entry point: a building description in, every part out.
import { normalize } from './building.js';
import { resolveRules, unverifiedRules } from './rules.js';
import { placePosts, placeTrusses } from './framing.js';
import { lumberRuns, girtRowCount, purlinRowsPerSide } from './runs.js';
import { wallLengthIn, isGable, WALLS } from './building.js';
import { roofPanels, wallPanels, trim, closures, screws, areas } from './metal.js';
import { feetInches, add } from './stock.js';
import { cutList } from './cutlist.js';
import { placeSheds, shedRuns, shedMetal } from './sheds.js';
import { finishRuns, finishParts, FINISH_LUMBER } from './finish.js';

// ft and sqFt are the numbers a price list multiplies by.
function lines(group, name, size, tally, label = (k) => `${k} ft`, ft = (k) => k) {
  return Object.keys(tally).map(Number).sort((a, b) => b - a)
    .map((k) => ({ group, name, size, length: label(k), qty: tally[k], ft: ft(k) }));
}
const inchesToFt = (k) => k / 12;

export function design(input, ruleOverrides) {
  const rules = resolveRules(ruleOverrides);
  const { building: b, errors } = normalize(input);
  if (errors.length) return { ok: false, errors, warnings: [], items: [] };

  const { posts, warnings, errors: postErrors } = placePosts(b, rules);
  if (postErrors.length) return { ok: false, errors: postErrors, warnings, items: [] };

  const trusses = placeTrusses(b);
  const { sheds, errors: shedErrors, warnings: shedWarnings } = placeSheds(b, rules);
  warnings.push(...shedWarnings);
  if (shedErrors.length) return { ok: false, errors: shedErrors, warnings, items: [] };
  const shedPosts = sheds.flatMap((s) => s.posts);
  const runs = [...lumberRuns(b, rules, posts, trusses), ...shedRuns(b, rules, sheds, posts), ...finishRuns(b, rules, posts, trusses, sheds)];
  const extra = shedMetal(b, rules, sheds);
  const merged = (base, more) => { for (const [k, n] of Object.entries(more)) add(base, k, n); return base; };
  const mainRoof = roofPanels(b, rules);
  const finish = finishParts(b, rules, {
    posts: [...posts, ...shedPosts], trusses, sheds,
    wallTally: merged(wallPanels(b, rules), extra.wall), roofTally: merged({ ...mainRoof }, extra.roof), mainRoofPanelIn: Number(Object.keys(mainRoof)[0]),
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
  const lumber = (name) => Object.entries(tally[name] ?? {}).flatMap(([size, t]) => lines('Framing', name, size, t));

  // Where each girt row sits, for the picture and the drawings.
  const girtRows = [];
  for (const wall of WALLS) {
    for (let i = 0; i < girtRowCount(b, rules); i++) {
      girtRows.push({ wall, heightIn: Math.min(rules.skirtHeightIn + (i + 1) * rules.girtSpacingIn, b.eaveIn) });
    }
    if (isGable(wall)) {
      for (let up = rules.girtSpacingIn; up < b.riseIn - 0.01; up += rules.girtSpacingIn) {
        girtRows.push({ wall, heightIn: b.eaveIn + up, lengthIn: wallLengthIn(b, wall) * (1 - up / b.riseIn) });
      }
    }
  }

  const postTally = {};
  for (const p of [...posts, ...shedPosts]) postTally[p.stockFt] = (postTally[p.stockFt] ?? 0) + 1;

  const items = [
    ...lines('Framing', 'Posts', rules.postSize, postTally),
    { group: 'Framing', name: 'Trusses', size: `${b.widthIn / 12} ft span, ${b.pitch}/12`, length: '', qty: trusses.length, ft: b.widthIn / 12 },
    ...lumber('Skirt Boards'),
    ...lumber('Wall Girts'),
    ...lumber('Roof Purlins'),
    ...lumber('Truss Carriers'),
    ...lumber('Rafter Ledgers'),
    ...lumber('Eave Beams'),
    ...lumber('Rafters'),
    ...lumber('Headers'),
    ...lumber('Opening Blocking'),
    ...FINISH_LUMBER.flatMap(lumber),
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
    ...finish.items,
  ];

  return {
    ok: true, errors: [], warnings, items,
    summary: {
      floorSqFt: (b.widthIn * b.lengthIn) / 144,
      shedSqFt: sheds.reduce((sum, s) => sum + (s.lengthIn * s.depthIn) / 144, 0),
      posts: posts.length + shedPosts.length, trusses: trusses.length,
      girtRowsPerWall: girtRowCount(b, rules), purlinRowsPerSide: purlinRowsPerSide(b, rules),
      linerSqFt: finish.linerSqFt, slabSqFt: finish.slabSqFt,
      screws: fasteners.count, roofSqFt: areas(b).roofSqFt + extra.roofSqFt, wallSqFt: areas(b).wallSqFt + extra.wallSqFt,
    },
    geometry: { building: b, posts, trusses, girtRows, sheds, purlinRowLengthIn: b.lengthIn + 2 * b.overhangIn },
    cuts: cutList(rules, [...posts, ...sheds.flatMap((sh) => sh.posts.map((p) => ({ ...p, where: sh.label, sloped: p.line !== 'outer' })))], runs),
    rules,
    unverifiedRules: unverifiedRules(),
  };
}

// Finds one line in a result, for tests and for the screen.
export function qty(result, name, length) {
  return result.items.filter((i) => i.name === name && (length === undefined || i.length === length))
    .reduce((sum, i) => sum + i.qty, 0);
}
