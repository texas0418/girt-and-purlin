// Every framing and material rule the engine uses lives here, so a yard or
// builder can change one without touching the engine. Lengths are in inches
// unless the name says Ft. A rule with verified: false came from general
// knowledge and still has to be checked against a published source.

export const defaultRules = {
  postEmbedmentIn:   { value: 48,   verified: true, note: 'Depth of post below grade', source: 'American Wood Council Post Frame Buildings (about 4 ft); Bannock County ID guide (48 in minimum); FBi Buildings. A minimum: frost depth or the engineer can make it deeper' },
  postStockFt:       { value: [10, 12, 14, 16, 18, 20, 24], verified: false, note: 'Post lengths a yard stocks' },
  postSize:          { value: '6x6 treated', verified: true, source: 'Bannock County ID and Kochville Township MI guides (6x6 minimum). Fits small and medium buildings; tall walls move to laminated columns' },
  doorJambPostMinFt: { value: 6,    verified: false, note: 'Doors this wide or wider get a post at each jamb' },

  skirtSize:         { value: '2x8 treated', verified: true, source: 'USDA NRCS PA-12 Fig 5.10 (2x8 treated skirt board)' },
  skirtHeightIn:     { value: 7.25, verified: false },
  girtSize:          { value: '2x6', verified: true, source: 'Bannock County ID guide (2x6 minimum at 24 in). 2x4 is also published (NRCS, Kochville, APM)' },
  girtSpacingIn:     { value: 24,   verified: true, note: 'On center, up the wall', source: 'Kochville Township MI (24 in maximum); Bannock County ID; APM Buildings' },
  purlinSize:        { value: '2x4', verified: true, source: 'USDA NRCS PA-12 (2x4 at 24 in on trusses 4 ft apart); Kochville Township MI; APM Buildings' },
  purlinSpacingIn:   { value: 24,   verified: true, note: 'On center, up the roof slope', source: 'USDA NRCS PA-12; FBi Buildings (24 in maximum)' },
  lumberStockFt:     { value: [8, 10, 12, 14, 16], verified: false, note: 'Board lengths a yard stocks' },
  headerSize:        { value: '2x10', verified: false, note: 'Two boards over each opening. Kochville Township MI lists two 2x10 for a 12 ft end wall opening; the engineer sets the real size' },
  wideHeaderSize:    { value: '2x12', verified: false, note: 'Openings wider than wideHeaderOverFt. Kochville Township MI lists two 2x12 at 16 ft' },
  wideHeaderOverFt:  { value: 12,   verified: false },
  trussCarrierSize:  { value: '2x12', verified: true, note: 'Two boards along each long wall when trusses land between posts', source: 'USDA NRCS PA-12 (2-ply 2x12 roof girders); Bannock County ID post-frame guide; APM Buildings' },

  panelCoverageIn:   { value: 36,   verified: true, note: 'Width one metal panel covers', source: 'Fabral Grandrib 3 guide p.8; Metal Sales Classic Rib; A.B. Martin ABM Panel; Everlast II' },
  roofPanelExtraIn:  { value: 2,    verified: true, note: 'Panel hang past the eave', source: 'Central States Panel-Loc Plus guide and A.B. Martin guide give 2 in; Fabral Standard Details p.2 gives 1 to 2 in' },
  trimPieceIn:       { value: 126,  verified: true, note: 'Trim comes in 10 ft 6 in pieces', source: 'Fabral guide p.11; Metal Sales trim sheet' },
  trimLapIn:         { value: 6,    verified: true, source: 'Fabral guide p.11. Hansen laps 3 in, so 6 is the safe figure' },
  screwsPerSquare:   { value: { 24: 80, 21: 90, 18: 100, 15: 120, 12: 150, 9: 190 }, verified: true, note: 'Screws per 100 sq ft of panel, by girt or purlin spacing in inches', source: 'Fabral Standard Details p.31-32; Metal Sales Post Frame Install Guide p.20 agrees at 24 in' },
  screwsPerBag:      { value: 250,  verified: true, source: 'Central States trim selection tool' },
  closureStripIn:    { value: 36,   verified: true, note: 'Foam closure strips are 3 ft long', source: 'Fabral guide p.15; A.B. Martin guide' },
};

export function resolveRules(overrides = {}) {
  const out = {};
  for (const [key, rule] of Object.entries(defaultRules)) {
    out[key] = key in overrides ? overrides[key] : rule.value;
  }
  return out;
}

export function unverifiedRules() {
  return Object.entries(defaultRules).filter(([, r]) => !r.verified).map(([k]) => k);
}
