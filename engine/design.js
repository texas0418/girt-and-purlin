// The one entry point: a building description in, every part out.
import { normalize } from './building.js';
import { resolveRules, unverifiedRules } from './rules.js';
import { placePosts, placeTrusses, frameWalls, frameRoof, frameOpenings } from './framing.js';
import { roofPanels, wallPanels, trim, screws, areas } from './metal.js';
import { feetInches } from './stock.js';
import { cutList } from './cutlist.js';

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
  const walls = frameWalls(b, rules);
  const roof = frameRoof(b, rules);
  const openings = frameOpenings(b, rules);
  const fasteners = screws(b, rules);

  const postTally = {};
  for (const p of posts) postTally[p.stockFt] = (postTally[p.stockFt] ?? 0) + 1;

  const items = [
    ...lines('Framing', 'Posts', rules.postSize, postTally),
    { group: 'Framing', name: 'Trusses', size: `${b.widthIn / 12} ft span, ${b.pitch}/12`, length: '', qty: trusses.length, ft: b.widthIn / 12 },
    ...lines('Framing', 'Skirt Boards', rules.skirtSize, walls.skirt),
    ...lines('Framing', 'Wall Girts', rules.girtSize, walls.girts),
    ...lines('Framing', 'Roof Purlins', rules.purlinSize, roof.purlins),
    ...lines('Framing', 'Headers', rules.headerSize, openings.headers),
    ...lines('Framing', 'Opening Blocking', rules.girtSize, openings.blocking),
    ...lines('Metal', 'Roof Panels', '', roofPanels(b, rules), feetInches, inchesToFt),
    ...lines('Metal', 'Wall Panels', '', wallPanels(b, rules), feetInches, inchesToFt),
    ...Object.entries(trim(b, rules)).map(([name, qty]) => ({ group: 'Metal', name, size: '', length: feetInches(rules.trimPieceIn), qty, ft: rules.trimPieceIn / 12 })),
    { group: 'Metal', name: 'Panel Screws', size: `bag of ${rules.screwsPerBag}`, length: '', qty: fasteners.bags },
    ...b.openings.map((o) => ({
      group: 'Doors And Windows',
      name: { slider: 'Sliding Door', walk: 'Walk Door', overhead: 'Overhead Door', window: 'Window' }[o.type],
      size: `${feetInches(o.widthIn)} x ${feetInches(o.heightIn)}`, length: '', qty: 1, sqFt: (o.widthIn * o.heightIn) / 144,
    })),
  ];

  return {
    ok: true, errors: [], warnings, items,
    summary: {
      floorSqFt: (b.widthIn * b.lengthIn) / 144,
      posts: posts.length, trusses: trusses.length,
      girtRowsPerWall: walls.girtRowsPerWall, purlinRowsPerSide: roof.rowsPerSide,
      screws: fasteners.count, ...areas(b),
    },
    geometry: { building: b, posts, trusses, girtRows: walls.girtRows, purlinRowLengthIn: roof.rowLengthIn },
    cuts: cutList(b, rules, posts),
    rules,
    unverifiedRules: unverifiedRules(),
  };
}

// Finds one line in a result, for tests and for the screen.
export function qty(result, name, length) {
  return result.items.filter((i) => i.name === name && (length === undefined || i.length === length))
    .reduce((sum, i) => sum + i.qty, 0);
}
