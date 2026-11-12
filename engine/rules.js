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

  panelCoverageIn:   { value: 36,   verified: false, note: 'Width one metal panel covers' },
  roofPanelExtraIn:  { value: 1.5,  verified: false, note: 'Panel hang past the eave' },
  trimPieceIn:       { value: 126,  verified: false, note: 'Trim comes in 10 ft 6 in pieces' },
  trimLapIn:         { value: 6,    verified: false },
  screwsPerSqFt:     { value: 0.8,  verified: false },
  screwsPerBag:      { value: 250,  verified: false },
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
