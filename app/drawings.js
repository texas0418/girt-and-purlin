// Framing drawings: one view of each wall from outside, and the roof from above.
import { wallLengthIn, wallTopIn, edgeOverhangIn, isGable } from '../engine/building.js';
import { spans, feetInches } from '../engine/stock.js';
import { placeOnLot, feet } from '../engine/site.js';

export const SHEETS = [['front', 'Front Wall'], ['back', 'Back Wall'], ['left', 'Left End'], ['right', 'Right End'], ['roof', 'Roof Framing']];
const DARK = { ink: '#dcdcdc', soft: '#8f8f8f', paper: '#262626', wood: '#3a3a3a' };
const LIGHT = { ink: '#1a1a1a', soft: '#6f6f6f', paper: '#ffffff', wood: '#e9e9e9' };
const FONT = 'font-family="system-ui, Helvetica Neue, sans-serif" font-stretch="103%"';
const TYPES = { slider: 'Sliding Door', overhead: 'Overhead Door', walk: 'Walk Door', window: 'Window' };
// Seen from outside, the back wall and the left end read right to left on the plan.
const MIRRORED = { back: true, left: true };
const short = (inches) => feetInches(inches).replace(' ft ', "' ").replace(' in', '"').replace(' 0"', '');

function pen(c, unit) {
  const line = (x1, y1, x2, y2, w = 0.06, color = c.ink, extra = '') =>
    `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${w}" ${extra}/>`;
  const text = (x, y, s, size = 1, color = c.ink, extra = '') =>
    `<text x="${x}" y="${y}" font-size="${unit * size}" ${FONT} fill="${color}" text-anchor="middle" ${extra}>${s}</text>`;
  // A dimension line with end ticks and the length written on it.
  const across = (x1, x2, y, s, size = 1) => [
    line(x1, y, x2, y), line(x1, y - unit * 0.3, x1, y + unit * 0.3), line(x2, y - unit * 0.3, x2, y + unit * 0.3),
    text((x1 + x2) / 2, y - unit * 0.35, s, size),
  ].join('');
  const upright = (y1, y2, x, s, size = 1) => [
    line(x, y1, x, y2), line(x - unit * 0.3, y1, x + unit * 0.3, y1), line(x - unit * 0.3, y2, x + unit * 0.3, y2),
    text(x - unit * 0.35, (y1 + y2) / 2, s, size, c.ink, `transform="rotate(-90 ${x - unit * 0.35} ${(y1 + y2) / 2})"`),
  ].join('');
  return { line, text, across, upright };
}

function wallSheet(result, wall, c) {
  const { building: b, posts, girtRows } = result.geometry;
  const rules = result.rules;
  const len = wallLengthIn(b, wall) / 12;
  // The wall's own top: the eave on a side wall, the low eave on an end wall.
  const wallIn = isGable(wall) ? b.eaveIn : wallTopIn(b, wall, 0);
  const top = (isGable(wall) ? b.eaveIn + b.riseIn : wallIn) / 12;
  const unit = Math.max(len, top * 2) * 0.016 + 0.2;
  const { line, text, across, upright } = pen(c, unit);
  const u = (atIn) => (MIRRORED[wall] ? len - atIn / 12 : atIn / 12);
  const y = (heightIn) => top - heightIn / 12;
  const out = [];

  const bury = rules.postEmbedmentIn / 12;
  const corner = isGable(wall) ? [0, len * 12].map((atIn) => ({ atIn, topIn: wallTopIn(b, wall, atIn) })) : [];
  const stand = [...posts.filter((p) => p.wall === wall), ...corner].sort((p, q) => u(p.atIn) - u(q.atIn));
  for (const p of stand) {
    const x = Math.min(Math.max(u(p.atIn), 0.25), len - 0.25);
    out.push(`<rect x="${x - 0.25}" y="${y(p.topIn)}" width="0.5" height="${p.topIn / 12}" fill="${c.wood}" stroke="${c.ink}" stroke-width="0.05"/>`,
      `<rect x="${x - 0.25}" y="${top}" width="0.5" height="${bury}" fill="none" stroke="${c.soft}" stroke-width="0.05" stroke-dasharray="0.3 0.2"/>`);
  }

  const mine = b.openings.filter((o) => o.wall === wall);
  const gaps = (heightIn, groundOnly) => mine
    .filter((o) => (groundOnly ? o.toGround : heightIn > o.sillIn + 0.01 && heightIn < o.sillIn + o.heightIn - 0.01))
    .map((o) => [o.startIn, o.endIn]);
  const board = (fromIn, runIn, heightIn, deepIn) => {
    const a = u(fromIn), z = u(fromIn + runIn);
    return `<rect x="${Math.min(a, z)}" y="${y(heightIn + deepIn / 2)}" width="${Math.abs(z - a)}" height="${deepIn / 12}" fill="${c.paper}" stroke="${c.ink}" stroke-width="0.04"/>`;
  };
  const open = !!b.walls?.[wall]?.open;
  if (open) out.push(text(len / 2, y(wallIn / 2), 'Open Wall', 1.1, c.ink), text(len / 2, y(wallIn / 2) + unit * 1.4, 'Posts only: no skirt board, girts or steel', 0.8, c.soft));
  else for (const [from, to] of spans(len * 12, gaps(0, true))) out.push(board(from, to - from, rules.skirtHeightIn / 2, rules.skirtHeightIn));
  const heights = [];
  for (const row of girtRows.filter((r) => r.wall === wall)) {
    if (row.lengthIn) {
      out.push(board(row.startIn ?? (len * 12 - row.lengthIn) / 2, row.lengthIn, row.heightIn, 5.5));
    } else {
      for (const [from, to] of spans(len * 12, gaps(row.heightIn))) out.push(board(from, to - from, row.heightIn, 5.5));
    }
    heights.push(row.heightIn);
  }

  // Opening labels stay inside the opening: a tall narrow door reads up its
  // height, and the lettering shrinks before it runs past an edge.
  const label = (o, cx, cy, w, h) => {
    const turned = h > w * 1.5;
    const room = (turned ? h : w) - 0.4;
    const words = [TYPES[o.type], `${short(o.widthIn)} x ${short(o.heightIn)}`];
    const size = Math.min(w < 6 ? 0.65 : 0.9, ...words.map((s) => room / (s.length * 0.55 * unit)));
    const turn = turned ? `transform="rotate(-90 ${cx} ${cy})"` : '';
    return [text(cx, cy - (turned ? unit * size * 0.25 : 0), words[0], size, c.ink, turn),
      text(cx, cy + unit * size * (turned ? 0.95 : 1.2), words[1], size, c.soft, turn)];
  };
  for (const o of mine) {
    const a = Math.min(u(o.startIn), u(o.endIn)), w = o.widthIn / 12, h = o.heightIn / 12;
    const head = y(o.sillIn + o.heightIn);
    out.push(`<rect x="${a}" y="${head}" width="${w}" height="${h}" fill="${c.paper}" stroke="${c.ink}" stroke-width="0.1"/>`,
      `<rect x="${a}" y="${head - 0.77}" width="${w}" height="0.77" fill="${c.wood}" stroke="${c.ink}" stroke-width="0.05"/>`,
      ...label(o, a + w / 2, head + h / 2, w, h));
  }

  if (isGable(wall)) {
    out.push(`<path d="M ${b.line.map((p) => `${u(p.y)} ${y(p.h)}`).join(' L ')}" fill="none" stroke="${c.ink}" stroke-width="0.12"/>`);
  } else {
    out.push(line(0, y(wallIn), len, y(wallIn), 0.12));
  }
  out.push(line(-unit, top, len + unit, top, 0.05, c.soft), text(len + unit * 2.2, top + unit * 0.3, 'Grade', 0.8, c.soft));

  const marks = [...new Set([0, len, ...stand.map((p) => u(p.atIn))].map((v) => Math.round(v * 1000) / 1000))].sort((p, q) => p - q);
  // A length too wide for its own gap drops to a line below, so close posts never print over each other.
  const row1 = top + bury + unit * 2.2;
  const lastRight = [-Infinity];
  for (let i = 1; i < marks.length; i++) {
    const s = short((marks[i] - marks[i - 1]) * 12), mid = (marks[i - 1] + marks[i]) / 2, half = s.length * 0.28 * unit * 0.8 + unit * 0.2;
    let tier = lastRight.findIndex((r) => r < mid - half);
    if (tier < 0) tier = lastRight.push(-Infinity) - 1;
    lastRight[tier] = mid + half;
    out.push(across(marks[i - 1], marks[i], row1, '', 0.8), text(mid, row1 + unit * (tier ? 0.3 + tier * 0.95 : -0.35), s, 0.8));
  }
  const row2 = row1 + unit * (2.4 + Math.max(0, lastRight.length - 1) * 0.95);
  out.push(across(0, len, row2, `${short(len * 12)} overall`),
    text(len / 2, row1 - unit * 1.5, 'Post centers', 0.75, c.soft),
    upright(y(wallIn), top, -unit * 2, `${short(wallIn)} ${wallIn > b.eaveIn ? 'high wall' : 'eave'}`));
  if (isGable(wall)) out.push(upright(0, top, -unit * 4.4, `${short(b.eaveIn + b.riseIn)} peak`));
  for (const h of [...new Set(heights)].filter((v) => v <= wallIn)) {
    out.push(line(len + unit * 0.4, y(h), len + unit * 1.1, y(h)), text(len + unit * 1.4, y(h) + unit * 0.3, short(h), 0.75, c.soft, 'text-anchor="start"').replace('text-anchor="middle" ', ''));
  }
  if (!open) out.push(text(len + unit * 1.4, y(wallIn) - unit * 1.2, 'Girt heights', 0.75, c.soft, 'text-anchor="start"').replace('text-anchor="middle" ', ''));

  const left = unit * 6.5, right = unit * 8;
  return `<svg viewBox="${-left} ${-unit * 2} ${len + left + right} ${row2 + unit * 3.5}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Wall framing">${out.join('')}</svg>`;
}

function roofSheet(result, c) {
  const { building: b, trusses, planes } = result.geometry;
  const rules = result.rules;
  const over = b.overhangIn / 12, L = b.lengthIn / 12, W = b.widthIn / 12;
  // The plan reads with the back wall at the top of the sheet.
  const side = { back: edgeOverhangIn(b, 'back') / 12, front: edgeOverhangIn(b, 'front') / 12 };
  const yy = (yIn) => W - yIn / 12;
  const unit = Math.max(L, W) * 0.016 + 0.2;
  const { line, text, across, upright } = pen(c, unit);
  const out = [`<rect x="${-over}" y="${-side.back}" width="${L + 2 * over}" height="${W + side.back + side.front}" fill="${c.paper}" stroke="${c.ink}" stroke-width="0.1"/>`,
    `<rect x="0" y="0" width="${L}" height="${W}" fill="none" stroke="${c.soft}" stroke-width="0.05" stroke-dasharray="0.5 0.3"/>`];

  for (const p of planes) {
    const low = p.lowY - p.dir * p.lowOverIn, high = p.highY + p.dir * p.highOverIn;
    for (let i = 0; i < p.purlinRows; i++) {
      const at = high + (low - high) * (p.purlinRows > 1 ? i / (p.purlinRows - 1) : 0.5);
      // The top row of each slope sits just off the ridge or break so the two do not print as one line.
      const nudge = i === 0 && p.highEdge !== 'high' ? p.dir * 0.12 : 0;
      out.push(line(-over, yy(at) + nudge, L + over, yy(at) + nudge, 0.05, c.soft));
    }
    if (p.highEdge !== 'high' && p.dir === 1) out.push(line(-over, yy(p.highY), L + over, yy(p.highY), 0.04, c.ink, 'stroke-dasharray="1 0.3 0.2 0.3"'));
    if (p.highEdge === 'break' && p.dir === -1) out.push(line(-over, yy(p.highY), L + over, yy(p.highY), 0.04, c.ink, 'stroke-dasharray="1 0.3 0.2 0.3"'));
  }
  for (const t of trusses) out.push(line(t.x / 12, -side.back, t.x / 12, W + side.front, 0.16));
  for (const cup of result.geometry.cupolas ?? []) {
    const half = cup.sizeIn / 24;
    out.push(`<rect x="${cup.x / 12 - half}" y="${W / 2 - half}" width="${half * 2}" height="${half * 2}" fill="${c.paper}" stroke="${c.ink}" stroke-width="0.1"/>`,
      text(cup.x / 12, W / 2 + half + unit * 1.1, `Cupola ${short(cup.sizeIn)}`, 0.75, c.soft));
  }

  const xs = trusses.map((t) => t.x / 12).sort((p, q) => p - q);
  const row1 = W + side.front + unit * 2.4, row2 = row1 + unit * 2.4;
  if (xs.length > 1) out.push(across(xs[0], xs[1], row1, short((xs[1] - xs[0]) * 12), 0.8),
    text((xs[1] + xs[xs.length - 1]) / 2, row1 + unit * 0.3, `${xs.length} trusses, same spacing to the far end`, 0.8, c.soft));
  const counts = planes.map((p) => p.purlinRows);
  const rowsNote = b.roof === 'gable' ? `${counts[0]} purlin rows each side`
    : b.roof === 'mono' ? `${counts[0]} purlin rows`
      : `${counts[0]} purlin rows on each lower slope, ${counts[1]} on each upper slope`;
  out.push(across(-over, L + over, row2, `${short(result.geometry.purlinRowLengthIn)} purlin rows`),
    upright(0, W, -over - unit * 2, `${short(b.widthIn)} truss span`),
    text(L / 2, -side.back - unit * 2.4, `${rowsNote}, ${rules.purlinSpacingIn} in apart up the slope`, 0.8, c.soft),
    text(L / 2, -side.back - unit * 0.9, b.roof === 'mono' ? 'Back, high side' : 'Back', 0.8, c.soft),
    text(L / 2, W + side.front + unit * 1.1, b.roof === 'mono' ? 'Front, low side' : 'Front', 0.8, c.soft));

  const left = over + unit * 5;
  return `<svg viewBox="${-left} ${-over - unit * 4.5} ${L + left + over + unit * 2} ${row2 + over + unit * 7}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Roof framing">${out.join('')}</svg>`;
}

// A cut through a lean-to or porch, looking along the main wall.
function shedSheet(result, s, c) {
  const { building: b } = result.geometry;
  const rules = result.rules;
  const D = s.depthIn / 12, over = b.overhangIn / 12, hi = s.highIn / 12, lo = s.lowIn / 12;
  const eave = (isGable(s.wall) ? b.eaveIn : wallTopIn(b, s.wall, 0)) / 12;
  // How the main roof leaves the wall the shed hangs on: up and inward on a low eave,
  // down and inward on the high side of a single slope, level on an end wall.
  const mainPitch = isGable(s.wall) ? 0 : b.roof === 'mono' && s.wall === 'back' ? -b.pitch : b.planes[0].pitch;
  const mainOver = edgeOverhangIn(b, s.wall) / 12;
  const top = eave + 1.5;
  const unit = Math.max(D + over, top * 1.6) * 0.02 + 0.2;
  const { line, text, across, upright } = pen(c, unit);
  const y = (ft) => top - ft;
  const fall = (x) => hi - x * s.pitch / 12;
  const bury = rules.postEmbedmentIn / 12;
  const post = (x, h, fill) => `<rect x="${x}" y="${y(h)}" width="0.46" height="${h}" fill="${fill}" stroke="${c.ink}" stroke-width="0.05"/>`
    + `<rect x="${x}" y="${top}" width="0.46" height="${bury}" fill="none" stroke="${c.soft}" stroke-width="0.05" stroke-dasharray="0.3 0.2"/>`;
  const deep = 0.6;
  const out = [
    post(-0.46, eave, c.wood),
    line(-0.46, y(eave), -0.46 - 1.2, y(eave + 1.2 * Math.max(-1, Math.min(1, mainPitch / 12))), 0.12),
    line(-0.46, y(eave), mainOver, y(eave - mainOver * mainPitch / 12), 0.12),
    text(-0.23, y(eave) - unit * 2.6, 'Main wall', 0.75, c.soft),
    post(D - 0.46, lo - 0.9, c.wood),
    `<rect x="${D - 0.46 - 0.13}" y="${y(lo - 0.12)}" width="0.25" height="0.94" fill="${c.paper}" stroke="${c.ink}" stroke-width="0.05"/>`,
    `<rect x="0" y="${y(hi - 0.15)}" width="0.13" height="${deep}" fill="${c.paper}" stroke="${c.ink}" stroke-width="0.05"/>`,
    `<path d="M 0.13 ${y(fall(0.13) - 0.15)} L ${D + over} ${y(fall(D + over) - 0.15)} L ${D + over} ${y(fall(D + over) - 0.15 - deep)} L 0.13 ${y(fall(0.13) - 0.15 - deep)} Z" fill="${c.wood}" stroke="${c.ink}" stroke-width="0.05"/>`,
    line(0, y(hi), D + over, y(fall(D + over)), 0.12),
  ];
  const run = Math.hypot(1, s.pitch / 12);
  for (let i = 0; i < s.purlinRows; i++) {
    const x = 0.15 + (D + over - 0.3) * i / (s.purlinRows - 1);
    out.push(`<rect x="${x - 0.15}" y="${y(fall(x) - 0.02)}" width="0.29" height="0.125" fill="${c.paper}" stroke="${c.ink}" stroke-width="0.04" transform="rotate(${Math.atan(s.pitch / 12) * 180 / Math.PI} ${x} ${y(fall(x))})"/>`);
  }
  if (s.enclosed) {
    const rows = Math.ceil((s.lowIn - rules.skirtHeightIn) / rules.girtSpacingIn - 0.01);
    for (let i = 1; i <= rows; i++) {
      const h = Math.min(rules.skirtHeightIn + i * rules.girtSpacingIn, s.lowIn - 12) / 12;
      out.push(`<rect x="${D}" y="${y(h + 0.23)}" width="0.125" height="0.46" fill="${c.paper}" stroke="${c.ink}" stroke-width="0.04"/>`);
    }
    out.push(`<rect x="${D}" y="${y(rules.skirtHeightIn / 12)}" width="0.125" height="${rules.skirtHeightIn / 12}" fill="${c.paper}" stroke="${c.ink}" stroke-width="0.04"/>`);
  }
  const row1 = top + bury + unit * 2.2;
  const note = (x, yy, t) => text(x, yy, t, 0.75, c.soft, 'text-anchor="start"').replace('text-anchor="middle" ', '');
  const nx = D + over + unit * 4.6;
  out.push(
    line(-2, top, D + over + unit, top, 0.05, c.soft), text(D + over + unit * 2.4, top + unit * 0.3, 'Grade', 0.8, c.soft),
    across(0, D, row1, `${short(s.depthIn)} wall to post line`),
    upright(y(hi), top, -unit * 3.2, `${short(s.highIn)} at the wall`),
    upright(y(lo), top, D + over + unit * 2.6, `${short(s.lowIn)} at the posts`),
    text((D + over) / 2, y(fall((D + over) / 2)) - unit * 1.2, `${s.pitch} in 12`, 0.9, c.ink, `transform="rotate(${Math.atan(s.pitch / 12) * 180 / Math.PI} ${(D + over) / 2} ${y(fall((D + over) / 2)) - unit * 1.2})"`),
    note(nx, y(hi), `Rafters ${rules.rafterSize}, ${short(s.slopeIn)} long`),
    note(nx, y(hi) + unit * 1.3, `${s.rafters.length} rafters along ${short(s.lengthIn)}`),
    note(nx, y(hi) + unit * 2.6, `Ledger ${rules.shedLedgerSize} on the main posts`),
    note(nx, y(hi) + unit * 3.9, `Beam two ${rules.shedBeamSize} on ${s.outer.length} posts`),
    note(nx, y(hi) + unit * 5.2, `${s.purlinRows} purlin rows, ${rules.purlinSize}`),
    note(nx, y(hi) + unit * 6.5, s.enclosed ? 'Walls closed in' : 'Sides open'),
  );
  const left = unit * 6.5 + 2, right = unit * 22;
  return `<svg viewBox="${-left} ${-unit * 2} ${D + over + left + right} ${row1 + unit * 3.5}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Section through the ${s.label.toLowerCase()}">${out.join('')}</svg>`;
}

// The lot from above with the front lot line at the bottom: the building, its
// distance to each lot line, and any setbacks the builder typed in.
function siteSheet(result, input, c) {
  const p = placeOnLot(result.geometry, input);
  const { lotWidth: LW, lotDepth: LD } = p.site;
  if (!p.ready) {
    return `<svg viewBox="0 0 100 40" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Site plan"><text x="50" y="20" font-size="3" ${FONT} fill="${c.soft}" text-anchor="middle">Type in the lot width and depth to draw the site plan.</text></svg>`;
  }
  const unit = Math.max(LW, LD) * 0.022 + 0.3;
  const { line, text, across, upright } = pen(c, unit);
  const w = unit * 0.07;
  // Text that starts or ends at a point instead of sitting centered on it.
  const label = (x, yy, t, size, color, anchor) => `<text x="${x}" y="${yy}" font-size="${unit * size}" ${FONT} fill="${color}" text-anchor="${anchor}">${t}</text>`;
  const y = (ft) => LD - ft;
  const out = [`<rect x="0" y="0" width="${LW}" height="${LD}" fill="none" stroke="${c.ink}" stroke-width="${w * 2}" stroke-dasharray="${unit * 1.2} ${unit * 0.4} ${unit * 0.25} ${unit * 0.4}"/>`];

  // Setback lines, only where a figure was typed.
  const dash = `stroke-dasharray="${unit * 0.5} ${unit * 0.4}"`;
  const { setFront: sf, setSide: ss, setBack: sb } = p.site;
  if (sf > 0) out.push(line(0, y(sf), LW, y(sf), w, c.soft, dash), label(LW - unit * 0.4, y(sf) - unit * 0.3, `${feet(sf)} setback`, 0.8, c.soft, 'end'));
  if (sb > 0) out.push(line(0, y(LD - sb), LW, y(LD - sb), w, c.soft, dash), label(LW - unit * 0.4, y(LD - sb) + unit * 1, `${feet(sb)} setback`, 0.8, c.soft, 'end'));
  if (ss > 0) {
    out.push(line(ss, 0, ss, LD, w, c.soft, dash), line(LW - ss, 0, LW - ss, LD, w, c.soft, dash));
    out.push(label(ss + unit * 0.4, unit * 1.1, `${feet(ss)} setback`, 0.8, c.soft, 'start'));
  }

  for (const part of p.parts) {
    const [x0, y0, x1, y1] = part.box;
    out.push(`<rect x="${x0}" y="${y(y1)}" width="${x1 - x0}" height="${y1 - y0}" fill="${part.main ? c.wood : 'none'}" stroke="${c.ink}" stroke-width="${part.main ? w * 1.6 : w}" ${part.main || !part.open ? '' : dash}/>`);
  }
  const main = p.parts[0].box, [fx0, fy0, fx1, fy1] = p.footprint;
  const mw = main[2] - main[0], md = main[3] - main[1];
  const mx = (main[0] + main[2]) / 2, my = (main[1] + main[3]) / 2;
  const fits = Math.min(mw, md) > unit * 3.2;
  out.push(text(mx, y(my) + (fits ? -unit * 0.1 : unit * 0.3), fits ? 'Building' : '', 1));
  if (fits) out.push(text(mx, y(my) + unit * 1.1, `${feet(mw)} x ${feet(md)}`, 0.85, c.soft));

  // A mark on the front wall, pointing the way it faces.
  const [ax, ay] = p.frontWallAt;
  const [ox, oy] = { front: [0, -1], back: [0, 1], left: [-1, 0], right: [1, 0] }[p.site.facing] ?? [0, -1];
  const t = unit * 0.9, tx = ax + ox * t, ty = ay + oy * t;
  out.push(`<polygon points="${tx},${y(ty)} ${ax - oy * t * 0.6},${y(ay + ox * t * 0.6)} ${ax + oy * t * 0.6},${y(ay - ox * t * 0.6)}" fill="${c.ink}"/>`);
  out.push(label(ax + ox * t * 1.5, y(ay + oy * t * 2.2) + unit * 0.3, 'Front', 0.8, c.ink, ox ? (ox < 0 ? 'end' : 'start') : 'middle'));

  // Distance from the footprint to each lot line, drawn clear of the front mark.
  const cx = fx0 + (fx1 - fx0) * 0.25, cy = fy0 + (fy1 - fy0) * 0.25;
  if (p.clear.front > 0) out.push(upright(y(0), y(fy0), cx, feet(p.clear.front), 0.85));
  if (p.clear.back > 0) out.push(upright(y(fy1), y(LD), cx, feet(p.clear.back), 0.85));
  if (p.clear.left > 0) out.push(across(0, fx0, y(cy), feet(p.clear.left), 0.85));
  if (p.clear.right > 0) out.push(across(fx1, LW, y(cy), feet(p.clear.right), 0.85));

  // Lot size outside the lines.
  out.push(across(0, LW, LD + unit * 3.4, feet(LW)), upright(0, LD, -unit * 2.2, feet(LD)));
  out.push(text(LW / 2, LD + unit * 1.3, 'Front Lot Line', 0.9, c.soft), text(LW / 2, -unit * 0.6, 'Back Lot Line', 0.9, c.soft));

  // North arrow in the top right corner, outside the lot.
  const turn = { up: 0, right: 90, down: 180, left: 270 }[p.site.north];
  if (turn !== undefined) {
    const nx = LW + unit * 3.2, ny = unit * 2.5, r = unit * 1.6;
    out.push(`<g transform="rotate(${turn} ${nx} ${ny})"><line x1="${nx}" y1="${ny + r}" x2="${nx}" y2="${ny - r}" stroke="${c.ink}" stroke-width="${w * 1.5}"/><polygon points="${nx},${ny - r - unit * 0.7} ${nx - unit * 0.5},${ny - r + unit * 0.3} ${nx + unit * 0.5},${ny - r + unit * 0.3}" fill="${c.ink}"/></g>`);
    const [lx, ly] = { 0: [0, -1], 90: [1, 0], 180: [0, 1], 270: [-1, 0] }[turn];
    out.push(text(nx + lx * (r + unit * 1.6), ny + ly * (r + unit * 1.6) + unit * 0.35, 'N', 1.1));
  }
  out.push(text(LW / 2, LD + unit * 5.3, 'Drawn from the figures typed in. Not a survey.', 0.8, c.soft));
  const left = unit * 4.5, right = unit * 6.5;
  return `<svg viewBox="${-left} ${-unit * 2.2} ${LW + left + right} ${LD + unit * 8.4}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Site plan">${out.join('')}</svg>`;
}

const title = (t) => t.replace(/(^|[\s-])([a-z])/g, (m, a, ch) => a + ch.toUpperCase());

// The fixed sheets plus one section for every lean-to and porch.
export function sheetList(result) {
  return [...SHEETS, ...result.geometry.sheds.map((s) => [`shed${s.index}`, title(s.label)]), ['site', 'Site Plan']];
}

export function drawing(result, sheet, light = false, site = {}) {
  const c = light ? LIGHT : DARK;
  if (sheet === 'site') return siteSheet(result, site, c);
  if (sheet.startsWith('shed')) {
    const s = result.geometry.sheds[Number(sheet.slice(4))];
    return s ? shedSheet(result, s, c) : wallSheet(result, 'front', c);
  }
  return sheet === 'roof' ? roofSheet(result, c) : wallSheet(result, sheet, c);
}
