// A CAD file of the building: the floor plan and the four walls, as plain
// lines and labels. One drawing unit is one inch.
//
// The file is a DXF with an ENTITIES section only. The AutoCAD DXF reference
// allows the header to be left out, and a file that small opens in every CAD
// program. A header-less file cannot name its units, so the screen says inches.
import { WALLS, isGable, isOpen, wallLengthIn, wallTopIn, roofSpanAbove } from './building.js';
import { WALL_NAMES } from './runs.js';

const POST_IN = 5.5;
const GAP_IN = 120;
const MIRRORED = { back: true, left: true };
const n = (v) => String(Math.round(v * 1000) / 1000);

export function dxf(result) {
  const g = result.geometry, b = g.building;
  const L = b.lengthIn, W = b.widthIn;
  const out = ['0', 'SECTION', '2', 'ENTITIES'];
  const line = (layer, x1, y1, x2, y2) => out.push('0', 'LINE', '8', layer, '10', n(x1), '20', n(y1), '30', '0', '11', n(x2), '21', n(y2), '31', '0');
  const text = (layer, x, y, heightIn, value) => out.push('0', 'TEXT', '8', layer, '10', n(x), '20', n(y), '30', '0', '40', n(heightIn), '1', String(value).replace(/[\r\n]+/g, ' '));
  const rect = (layer, x1, y1, x2, y2) => { line(layer, x1, y1, x2, y1); line(layer, x2, y1, x2, y2); line(layer, x2, y2, x1, y2); line(layer, x1, y2, x1, y1); };
  const square = (layer, x, y) => rect(layer, x - POST_IN / 2, y - POST_IN / 2, x + POST_IN / 2, y + POST_IN / 2);
  const inside = (v, max) => Math.min(Math.max(v, POST_IN / 2), max - POST_IN / 2);

  // Floor plan. x runs along the length from the left end, y from the front wall to the back.
  // An open wall goes on its own layer so the CAD user can show it dashed.
  const wallLine = (wall, a, c) => {
    const layer = isOpen(b, wall) ? 'PLAN-OPEN-WALLS' : 'PLAN-WALLS';
    if (wall === 'front') line(layer, a, 0, c, 0);
    else if (wall === 'back') line(layer, a, W, c, W);
    else if (wall === 'left') line(layer, 0, a, 0, c);
    else line(layer, L, a, L, c);
  };
  const tick = (wall, at) => {
    if (wall === 'front') line('PLAN-OPENINGS', at, -6, at, 6);
    else if (wall === 'back') line('PLAN-OPENINGS', at, W - 6, at, W + 6);
    else if (wall === 'left') line('PLAN-OPENINGS', -6, at, 6, at);
    else line('PLAN-OPENINGS', L - 6, at, L + 6, at);
  };
  for (const wall of WALLS) {
    // The wall is drawn solid between openings and left open across each one.
    let at = 0;
    for (const o of b.openings.filter((o) => o.wall === wall).sort((p, q) => p.startIn - q.startIn)) {
      if (o.type === 'window') { tick(wall, o.startIn); tick(wall, o.endIn); continue; }
      wallLine(wall, at, o.startIn); tick(wall, o.startIn); tick(wall, o.endIn);
      at = o.endIn;
    }
    wallLine(wall, at, wallLengthIn(b, wall));
  }
  for (const p of g.posts) square('PLAN-POSTS', inside(p.x, L), inside(p.y, W));
  for (const s of g.sheds) {
    const xs = s.posts.map((p) => p.x), ys = s.posts.map((p) => p.y);
    const front = isGable(s.wall) ? null : s.wall;
    const x1 = front ? s.startIn : Math.min(...xs, s.wall === 'left' ? 0 : L), x2 = front ? s.endIn : Math.max(...xs, s.wall === 'left' ? 0 : L);
    const y1 = front ? Math.min(...ys, s.wall === 'front' ? 0 : W) : s.startIn, y2 = front ? Math.max(...ys, s.wall === 'front' ? 0 : W) : s.endIn;
    rect('PLAN-SHEDS', x1, y1, x2, y2);
    for (const p of s.posts) square('PLAN-POSTS', p.x, p.y);
    text('TEXT', x1 + 12, (y1 + y2) / 2, 6, s.label);
  }
  for (const p of g.partitions ?? []) {
    let at = p.startIn;
    const seg = (a, c) => (p.axis === 'across' ? line('PLAN-INTERIOR', p.atIn, a, p.atIn, c) : line('PLAN-INTERIOR', a, p.atIn, c, p.atIn));
    for (const d of [...p.doors].sort((a, c) => a.startIn - c.startIn)) { seg(at, d.startIn); at = d.endIn; }
    seg(at, p.endIn);
  }
  if (g.loft) {
    const f = g.loft, st = f.stair;
    line('PLAN-LOFT', f.edgeX, 0, f.edgeX, W);
    for (const p of f.posts) square('PLAN-POSTS', p.x, inside(p.y, W));
    rect('PLAN-LOFT', st.x0, st.y0, st.x1, st.y1);
    for (let i = 1; i < st.treads; i++) {
      const x = st.x0 + (st.x1 - st.x0) * i / st.treads;
      line('PLAN-LOFT', x, st.y0, x, st.y1);
    }
    text('TEXT', Math.min(f.edgeX, f.wallX) + 12, W / 2, 6, `Loft floor ${n(f.heightIn)} in up`);
  }
  const deepFront = Math.max(0, ...g.sheds.filter((s) => s.wall === 'front').map((s) => s.depthIn));
  text('TEXT', 0, -deepFront - 30, 8, `Floor plan, ${n(L / 12)} x ${n(W / 12)} ft, front wall at the bottom. Units are inches.`);

  // The four walls in a row under the plan, each seen from outside.
  const peak = Math.max(...b.line.map((p) => p.h));
  const baseY = -deepFront - GAP_IN - peak;
  let x0 = 0;
  for (const wall of WALLS) {
    const len = wallLengthIn(b, wall);
    const u = (atIn) => x0 + (MIRRORED[wall] ? len - atIn : atIn);
    const top = isGable(wall) ? b.line.map((p) => [p.y, p.h]) : [[0, wallTopIn(b, wall, 0)], [len, wallTopIn(b, wall, 0)]];
    line('ELEV-GRADE', x0 - 24, baseY, x0 + len + 24, baseY);
    line('ELEV-OUTLINE', u(0), baseY, u(0), baseY + top[0][1]);
    line('ELEV-OUTLINE', u(len), baseY, u(len), baseY + top[top.length - 1][1]);
    for (let i = 0; i < top.length - 1; i++) line('ELEV-OUTLINE', u(top[i][0]), baseY + top[i][1], u(top[i + 1][0]), baseY + top[i + 1][1]);
    for (const p of g.posts.filter((p) => p.wall === wall)) {
      const c = inside(p.atIn, len);
      line('ELEV-POSTS', u(c - POST_IN / 2), baseY, u(c - POST_IN / 2), baseY + p.topIn);
      line('ELEV-POSTS', u(c + POST_IN / 2), baseY, u(c + POST_IN / 2), baseY + p.topIn);
    }
    for (const row of g.girtRows.filter((r) => r.wall === wall)) {
      const span = isGable(wall) && row.heightIn > b.eaveIn ? roofSpanAbove(b, row.heightIn) : [0, len];
      if (span) line('ELEV-GIRTS', u(span[0]), baseY + row.heightIn, u(span[1]), baseY + row.heightIn);
    }
    for (const o of b.openings.filter((o) => o.wall === wall)) {
      rect('ELEV-OPENINGS', u(o.startIn), baseY + o.sillIn, u(o.endIn), baseY + o.sillIn + o.heightIn);
    }
    text('TEXT', x0, baseY - 30, 8, `${WALL_NAMES[wall]}, from outside${isOpen(b, wall) ? ', open wall: posts only' : ''}`);
    x0 += len + GAP_IN;
  }

  out.push('0', 'ENDSEC', '0', 'EOF');
  return out.join('\r\n') + '\r\n';
}
