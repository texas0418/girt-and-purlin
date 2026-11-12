// The floor plan: a flat drawing seen from above, front wall at the bottom.
const SIGNAL = '#f0883a';
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fi = (inches) => { const f = Math.floor(inches / 12), i = Math.round(inches - f * 12); return i ? `${f} ft ${i} in` : `${f} ft`; };

// light draws it in ink on white for the printed sheets.
export function floorPlan(result, light = false, fits = []) {
  const INK = light ? '#1a1a1a' : '#dcdcdc', SOFT = light ? '#777' : '#8f8f8f', PAPER = light ? '#fff' : '#262626';
  const { building: b, posts } = result.geometry;
  const L = b.lengthIn / 12, W = b.widthIn / 12;
  const pad = Math.max(L, W) * 0.16 + 6;
  const y = (v) => W - v;
  const text = (x, yy, s, extra = '') =>
    `<text x="${x}" y="${yy}" font-size="${pad * 0.14}" font-family="system-ui, Helvetica Neue, sans-serif" font-stretch="103%" fill="${INK}" text-anchor="middle" ${extra}>${s}</text>`;
  const label = (x, yy, s, extra = '') =>
    `<text x="${x}" y="${yy}" font-size="${pad * 0.1}" font-family="system-ui, Helvetica Neue, sans-serif" font-stretch="103%" font-weight="500" fill="${SOFT}" text-anchor="middle" ${extra}>${s}</text>`;

  const out = [];
  // Lean-tos and porches go down first so the main walls draw over their inner edge.
  const m = { front: 0, back: 0, left: 0, right: 0 };
  for (const s of result.geometry.sheds) {
    const D = s.depthIn / 12, a = s.startIn / 12, e = s.endIn / 12;
    m[s.wall] = Math.max(m[s.wall], D);
    const box = { front: [a, W, e - a, D], back: [a, -D, e - a, D], left: [-D, y(e), D, e - a], right: [L, y(e), D, e - a] }[s.wall];
    out.push(`<rect x="${box[0]}" y="${box[1]}" width="${box[2]}" height="${box[3]}" fill="${PAPER}" fill-opacity="${s.enclosed ? 1 : 0.45}" stroke="${INK}" stroke-width="${s.enclosed ? 0.3 : 0.08}" ${s.enclosed ? '' : 'stroke-dasharray="0.6 0.4"'}/>`);
    const cx = box[0] + box[2] / 2, cy = box[1] + box[3] / 2, turn = s.wall === 'left' || s.wall === 'right';
    out.push(label(cx, cy + pad * 0.03, `${s.kind === 'porch' ? 'Porch' : s.enclosed ? 'Lean-To' : 'Open Lean-To'}, ${D} ft`, turn ? `transform="rotate(-90 ${cx} ${cy})"` : ''));
    for (const p of s.posts) out.push(`<rect x="${p.x / 12 - 0.3}" y="${y(p.y / 12) - 0.3}" width="0.6" height="0.6" fill="${INK}"/>`);
  }
  out.push(`<rect x="0" y="0" width="${L}" height="${W}" fill="${PAPER}" stroke="${INK}" stroke-width="0.3"/>`);

  // An open wall shows as a thin dashed line between its posts.
  for (const [wall, x1, y1, x2, y2] of [['front', 0, W, L, W], ['back', 0, 0, L, 0], ['left', 0, 0, 0, W], ['right', L, 0, L, W]]) {
    if (!b.walls?.[wall]?.open) continue;
    const side = wall === 'front' || wall === 'back', t = 0.15;
    // The cover stops short of the corners so the closed walls beside it keep their full thickness.
    const ax = side ? x1 + t : x1, ay = side ? y1 : y1 + t, bx = side ? x2 - t : x2, by = side ? y2 : y2 - t;
    out.push(`<line x1="${ax}" y1="${ay}" x2="${bx}" y2="${by}" stroke="${PAPER}" stroke-width="0.5"/>`,
      `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${INK}" stroke-width="0.08" stroke-dasharray="0.6 0.4"/>`);
  }

  for (const o of b.openings) {
    const s = o.startIn / 12, e = o.endIn / 12;
    const side = o.wall === 'front' || o.wall === 'back';
    const at = { front: W, back: 0, left: 0, right: L }[o.wall];
    const outward = { front: 1, back: -1, left: -1, right: 1 }[o.wall];
    const line = (off, width, color, dash = '') => side
      ? `<line x1="${s}" x2="${e}" y1="${at + off * outward}" y2="${at + off * outward}" stroke="${color}" stroke-width="${width}" ${dash}/>`
      : `<line y1="${y(s)}" y2="${y(e)}" x1="${at + off * outward}" x2="${at + off * outward}" stroke="${color}" stroke-width="${width}" ${dash}/>`;
    out.push(line(0, 0.5, PAPER));
    if (o.type === 'window') out.push(line(-0.12, 0.08, INK), line(0.12, 0.08, INK));
    if (o.type === 'slider') out.push(line(0.45, 0.22, INK));
    if (o.type === 'overhead') out.push(line(0, 0.1, INK, 'stroke-dasharray="0.6 0.4"'));
    if (o.type === 'walk') {
      const w = e - s;
      out.push(side
        ? `<path d="M ${s} ${at} L ${s} ${at - w * outward} A ${w} ${w} 0 0 ${outward > 0 ? 1 : 0} ${e} ${at}" fill="none" stroke="${INK}" stroke-width="0.08"/>`
        : `<path d="M ${at} ${y(s)} L ${at - w * outward} ${y(s)} A ${w} ${w} 0 0 ${outward > 0 ? 0 : 1} ${at} ${y(e)}" fill="none" stroke="${INK}" stroke-width="0.08"/>`);
    }
  }

  // Inside: the loft goes down first, then interior walls over it.
  const loft = result.geometry.loft;
  if (loft) {
    const x0 = Math.min(loft.wallX, loft.edgeX) / 12, D = loft.depthIn / 12, cx = x0 + D / 2;
    out.push(`<rect x="${x0}" y="0" width="${D}" height="${W}" fill="${INK}" fill-opacity="0.07" stroke="none"/>`,
      `<line x1="${loft.edgeX / 12}" x2="${loft.edgeX / 12}" y1="0" y2="${W}" stroke="${INK}" stroke-width="0.12" stroke-dasharray="0.7 0.4"/>`);
    // A double-headed arrow shows which way the joists run.
    const ay = W * 0.3, a0 = x0 + D * 0.15, a1 = x0 + D * 0.85;
    out.push(`<path d="M ${a0 + 0.6} ${ay - 0.4} L ${a0} ${ay} L ${a0 + 0.6} ${ay + 0.4} M ${a0} ${ay} L ${a1} ${ay} M ${a1 - 0.6} ${ay - 0.4} L ${a1} ${ay} L ${a1 - 0.6} ${ay + 0.4}" fill="none" stroke="${SOFT}" stroke-width="0.07"/>`,
      label(cx, ay - pad * 0.06, `${loft.joistSize} joists`),
      label(cx, W / 2 - pad * 0.13, 'Loft'), label(cx, W / 2, `Floor ${fi(loft.heightIn)} up`), label(cx, W / 2 + pad * 0.13, `${D} x ${W} ft`));
    for (const p of loft.posts.slice(1, -1)) out.push(`<rect x="${p.x / 12 - 0.3}" y="${y(p.y / 12) - 0.3}" width="0.6" height="0.6" fill="${INK}"/>`);
    const st = loft.stair, s0 = Math.min(st.x0, st.x1) / 12, sl = st.runIn / 12, sw = st.widthIn / 12;
    out.push(`<rect x="${s0}" y="${W - sw}" width="${sl}" height="${sw}" fill="${PAPER}" stroke="${INK}" stroke-width="0.08"/>`);
    for (let i = 1; i < st.treads; i++) out.push(`<line x1="${s0 + i * sl / st.treads}" x2="${s0 + i * sl / st.treads}" y1="${W - sw}" y2="${W}" stroke="${INK}" stroke-width="0.04"/>`);
    out.push(label(s0 + sl / 2, W - sw - pad * 0.05, `Stair, ${st.risers} risers`));
  }
  for (const p of result.geometry.partitions ?? []) {
    const across = p.axis === 'across', at = p.atIn / 12;
    const seg = (a, e, width, color) => (across
      ? `<line x1="${at}" x2="${at}" y1="${y(a / 12)}" y2="${y(e / 12)}" stroke="${color}" stroke-width="${width}"/>`
      : `<line x1="${a / 12}" x2="${e / 12}" y1="${y(at)}" y2="${y(at)}" stroke="${color}" stroke-width="${width}"/>`);
    out.push(seg(p.startIn, p.endIn, p.sheathed ? 0.4 : 0.16, INK));
    for (const d of p.doors) {
      const w = (d.endIn - d.startIn) / 12, a = d.startIn / 12, e = d.endIn / 12;
      out.push(seg(d.startIn, d.endIn, 0.5, PAPER), across
        ? `<path d="M ${at} ${y(a)} L ${at + w} ${y(a)} A ${w} ${w} 0 0 0 ${at} ${y(e)}" fill="none" stroke="${INK}" stroke-width="0.08"/>`
        : `<path d="M ${a} ${y(at)} L ${a} ${y(at) - w} A ${w} ${w} 0 0 1 ${e} ${y(at)}" fill="none" stroke="${INK}" stroke-width="0.08"/>`);
    }
  }

  // Test-fit boxes: the things the builder wants to park inside.
  for (const t of fits) {
    const x = t.x0 / 12, w = (t.x1 - t.x0) / 12, h = (t.y1 - t.y0) / 12, top = y(t.y1 / 12), color = t.ok ? INK : SIGNAL;
    out.push(`<rect x="${x}" y="${top}" width="${w}" height="${h}" fill="${color}" fill-opacity="0.08" stroke="${color}" stroke-width="0.1" stroke-dasharray="0.5 0.3"/>`,
      `<line x1="${x}" y1="${top}" x2="${x + w}" y2="${top + h}" stroke="${color}" stroke-width="0.04"/>`, `<line x1="${x + w}" y1="${top}" x2="${x}" y2="${top + h}" stroke="${color}" stroke-width="0.04"/>`,
      `<text x="${x + w / 2}" y="${top + h / 2 - pad * 0.03}" font-size="${pad * 0.1}" font-family="system-ui, Helvetica Neue, sans-serif" font-stretch="103%" font-weight="500" fill="${color}" text-anchor="middle" stroke="${PAPER}" stroke-width="${pad * 0.03}" paint-order="stroke">${esc(t.name)}</text>`,
      `<text x="${x + w / 2}" y="${top + h / 2 + pad * 0.1}" font-size="${pad * 0.085}" font-family="system-ui, Helvetica Neue, sans-serif" font-stretch="103%" fill="${color}" text-anchor="middle" stroke="${PAPER}" stroke-width="${pad * 0.03}" paint-order="stroke">${fi(t.lengthIn)} x ${fi(t.widthIn)}</text>`);
  }

  const warned = new Set(result.warnings.map((w) => `${w.wall}:${w.postAtIn}`));
  for (const p of posts) {
    const hot = warned.has(`${p.wall}:${p.atIn}`);
    out.push(`<rect x="${p.x / 12 - 0.3}" y="${y(p.y / 12) - 0.3}" width="0.6" height="0.6" fill="${hot ? SIGNAL : INK}"/>`);
  }

  const d = pad * 0.42, df = m.front + d, dl = m.left + d;
  out.push(
    `<line x1="0" x2="${L}" y1="${W + df}" y2="${W + df}" stroke="${INK}" stroke-width="0.06"/>`,
    `<line x1="0" x2="0" y1="${W + df - 0.6}" y2="${W + df + 0.6}" stroke="${INK}" stroke-width="0.06"/>`,
    `<line x1="${L}" x2="${L}" y1="${W + df - 0.6}" y2="${W + df + 0.6}" stroke="${INK}" stroke-width="0.06"/>`,
    text(L / 2, W + df + pad * 0.2, `${L} ft`),
    `<line x1="${-dl}" x2="${-dl}" y1="0" y2="${W}" stroke="${INK}" stroke-width="0.06"/>`,
    `<line x1="${-dl - 0.6}" x2="${-dl + 0.6}" y1="0" y2="0" stroke="${INK}" stroke-width="0.06"/>`,
    `<line x1="${-dl - 0.6}" x2="${-dl + 0.6}" y1="${W}" y2="${W}" stroke="${INK}" stroke-width="0.06"/>`,
    text(-dl - pad * 0.1, W / 2, `${W} ft`, `transform="rotate(-90 ${-dl - pad * 0.1} ${W / 2})"`),
    label(L / 2, W + m.front + pad * 0.2, 'Front'),
    label(L / 2, -m.back - pad * 0.12, 'Back'),
    label(-m.left - pad * 0.14, W / 2, 'Left End', `transform="rotate(-90 ${-m.left - pad * 0.14} ${W / 2})"`),
    label(L + m.right + pad * 0.14, W / 2, 'Right End', `transform="rotate(90 ${L + m.right + pad * 0.14} ${W / 2})"`),
  );

  return `<svg viewBox="${-pad - m.left} ${-pad - m.back} ${L + 2 * pad + m.left + m.right} ${W + 2 * pad + m.front + m.back}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Floor plan">${out.join('')}</svg>`;
}
