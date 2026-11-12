// The floor plan: a flat drawing seen from above, front wall at the bottom.
const SIGNAL = '#f0883a';

// light draws it in ink on white for the printed sheets.
export function floorPlan(result, light = false) {
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
