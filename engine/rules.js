// Every framing and material rule the engine uses lives here, so a yard or
// builder can change one without touching the engine. Lengths are in inches
// unless the name says Ft. A rule with verified: false came from general
// knowledge and still has to be checked against a published source.

export const defaultRules = {
  postEmbedmentIn:   { value: 48,   verified: false, note: 'Depth of post below grade' },
  postStockFt:       { value: [10, 12, 14, 16, 18, 20, 24], verified: false, note: 'Post lengths a yard stocks' },
  postSize:          { value: '6x6 treated', verified: false },
  doorJambPostMinFt: { value: 6,    verified: false, note: 'Doors this wide or wider get a post at each jamb' },

  skirtSize:         { value: '2x8 treated', verified: false },
  skirtHeightIn:     { value: 7.25, verified: false },
  girtSize:          { value: '2x6', verified: false },
  girtSpacingIn:     { value: 24,   verified: false, note: 'On center, up the wall' },
  purlinSize:        { value: '2x4', verified: false },
  purlinSpacingIn:   { value: 24,   verified: false, note: 'On center, up the roof slope' },
  lumberStockFt:     { value: [8, 10, 12, 14, 16], verified: false, note: 'Board lengths a yard stocks' },
  headerSize:        { value: '2x10', verified: false },

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
