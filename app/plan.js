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

  const out = [`<rect x="0" y="0" width="${L}" height="${W}" fill="${PAPER}" stroke="${INK}" stroke-width="0.3"/>`];

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

  const d = pad * 0.42;
  out.push(
    `<line x1="0" x2="${L}" y1="${W + d}" y2="${W + d}" stroke="${INK}" stroke-width="0.06"/>`,
    `<line x1="0" x2="0" y1="${W + d - 0.6}" y2="${W + d + 0.6}" stroke="${INK}" stroke-width="0.06"/>`,
    `<line x1="${L}" x2="${L}" y1="${W + d - 0.6}" y2="${W + d + 0.6}" stroke="${INK}" stroke-width="0.06"/>`,
    text(L / 2, W + d + pad * 0.2, `${L} ft`),
    `<line x1="${-d}" x2="${-d}" y1="0" y2="${W}" stroke="${INK}" stroke-width="0.06"/>`,
    `<line x1="${-d - 0.6}" x2="${-d + 0.6}" y1="0" y2="0" stroke="${INK}" stroke-width="0.06"/>`,
    `<line x1="${-d - 0.6}" x2="${-d + 0.6}" y1="${W}" y2="${W}" stroke="${INK}" stroke-width="0.06"/>`,
    text(-d - pad * 0.1, W / 2, `${W} ft`, `transform="rotate(-90 ${-d - pad * 0.1} ${W / 2})"`),
    label(L / 2, W + pad * 0.2, 'Front'),
    label(L / 2, -pad * 0.12, 'Back'),
    label(-pad * 0.14, W / 2, 'Left End', `transform="rotate(-90 ${-pad * 0.14} ${W / 2})"`),
    label(L + pad * 0.14, W / 2, 'Right End', `transform="rotate(90 ${L + pad * 0.14} ${W / 2})"`),
  );

  return `<svg viewBox="${-pad} ${-pad} ${L + 2 * pad} ${W + 2 * pad}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Floor plan">${out.join('')}</svg>`;
}
