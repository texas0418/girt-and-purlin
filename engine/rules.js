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

  rafterSize:        { value: '2x8',  verified: false, note: 'Lean-to and porch rafters. No published size table exists: Hansen Pole Buildings publishes only the bending and deflection check, so the engineer sets the real size from span and snow load' },
  rafterSpacingIn:   { value: 48,   verified: false, note: 'On center, along the lean-to. Hansen Pole Buildings instead fastens a rafter to each side of every post and hangs the purlins between them' },
  rafterStockFt:     { value: [8, 10, 12, 14, 16, 18, 20], verified: false, note: 'Rafter lengths a yard stocks' },
  shedLedgerSize:    { value: '2x8',  verified: false, note: 'One board across the main wall posts under the high ends of the rafters. No post-frame source gives a ledger size, and Hansen Pole Buildings advises fastening rafters straight to the posts instead' },
  shedBeamSize:      { value: '2x12', verified: false, note: 'Two boards along the outer posts under the low ends of the rafters. Clermont County OH lists two 2x10 or two 2x12 for bearing headers by building width; the engineer sets the real size' },
  shedRafterMaxFt:   { value: 24,   verified: true, note: 'Deeper lean-tos move from rafters to single-slope trusses', source: 'FBi Buildings (rafters up to 24 ft wide, wider is most likely a mono truss)' },
  minPanelPitch:     { value: 3,    verified: true, note: 'Flattest roof for screw-down rib panels without sealant in the laps', source: 'IRC R905.10.2 (3 in 12 without lap sealant, down to 1/2 in 12 with it); Metal Sales Classic Rib guide (minimum 3:12); Hansen Pole Buildings' },

  panelCoverageIn:   { value: 36,   verified: true, note: 'Width one metal panel covers', source: 'Fabral Grandrib 3 guide p.8; Metal Sales Classic Rib; A.B. Martin ABM Panel; Everlast II' },
  roofPanelExtraIn:  { value: 2,    verified: true, note: 'Panel hang past the eave', source: 'Central States Panel-Loc Plus guide and A.B. Martin guide give 2 in; Fabral Standard Details p.2 gives 1 to 2 in' },
  trimPieceIn:       { value: 126,  verified: true, note: 'Trim comes in 10 ft 6 in pieces', source: 'Fabral guide p.11; Metal Sales trim sheet' },
  trimLapIn:         { value: 6,    verified: true, source: 'Fabral guide p.11. Hansen laps 3 in, so 6 is the safe figure' },
  screwsPerSquare:   { value: { 24: 80, 21: 90, 18: 100, 15: 120, 12: 150, 9: 190 }, verified: true, note: 'Screws per 100 sq ft of panel, by girt or purlin spacing in inches', source: 'Fabral Standard Details p.31-32; Metal Sales Post Frame Install Guide p.20 agrees at 24 in' },
  screwsPerBag:      { value: 250,  verified: true, source: 'Central States trim selection tool' },
  wainscotGirtSize:  { value: '2x4',  verified: false, note: 'One extra girt row behind the top of the wainscot. Hansen Pole Buildings calls for a 2x3 here; 2x4 is used so it matches the purlin stock' },
  linerGirtSize:     { value: '2x4',  verified: true, note: 'Girts on the inside of the posts that carry the wall liner', source: 'Hansen Pole Buildings, Steel Liner Panels (2x4 #2 at 24 in on center)' },
  linerGirtSpacingIn: { value: 24,  verified: true, source: 'Hansen Pole Buildings, Steel Liner Panels' },
  linerSupportMaxIn: { value: 48,   verified: true, note: 'Farthest apart the ceiling liner supports may sit; wider truss spacing gets joists', source: 'Hansen Pole Buildings (ceiling joists between truss bottom chords every four feet); Fabral TB704 deflection tables start at 4 ft' },
  ceilingJoistSize:  { value: '2x6',  verified: true, source: 'Hansen Pole Buildings, Steel Liner Panels (2x6 joist hung every four feet)' },
  linerMaxPanelFt:   { value: 20,   verified: false, note: 'Longest ceiling liner panel before it is split over a support' },
  linerEndLapIn:     { value: 4,    verified: false, note: 'Lap where two ceiling liner panels meet end to end' },
  linerScrewsPerSquare: { value: 80, verified: true, source: 'Metal Sales Post Frame Install Guide (80 screws per square for 3 ft panels)' },
  ridgeVentPieceIn:  { value: 120,  verified: true, source: 'Metal Sales Post Frame Install Guide (vent in 10 ft lengths)' },
  skylightMaxFt:     { value: 24,   verified: true, source: 'Palram SunSky 9 in rib installation addendum (maximum recommended panel length 24 ft; 36 in coverage)' },

  gutterSectionIn:   { value: 120,  verified: true, note: 'Gutter and downspout both come in 10 ft pieces', source: 'Amerimax, Installing Metal Gutter Systems' },
  gutterHangerSpacingIn: { value: 24, verified: true, note: '18 in where snow and ice are heavy', source: 'Amerimax metal and vinyl gutter instructions' },
  downspoutMaxRunFt: { value: 40,   verified: true, note: 'One downspout for each 40 ft of gutter', source: 'Amerimax vinyl gutter instructions (1 downspout per 40 ft maximum)' },
  downspoutBandsPerSection: { value: 2, verified: true, source: 'Amerimax metal and vinyl gutter instructions' },
  elbowsPerDownspout: { value: 3,   verified: false, note: 'Two to bring the downspout back to the wall and one at the bottom. Amerimax states only the bottom elbow' },

  bubbleRollWidthIn: { value: 72,   verified: true, source: 'rFoil 2210 data sheet (stock rolls 48 in x 125 ft and 72 in x 125 ft)' },
  bubbleRollFt:      { value: 125,  verified: true, source: 'rFoil 2210 data sheet' },
  bubbleLapIn:       { value: 2,    verified: true, source: 'Hansen Pole Buildings (overlap by 2 in at seams)' },
  wrapRollWidthIn:   { value: 108,  verified: true, source: 'DuPont Tyvek HomeWrap standard sizes (9 ft x 100 ft)' },
  wrapRollFt:        { value: 100,  verified: true, source: 'DuPont Tyvek HomeWrap standard sizes' },
  wrapLapIn:         { value: 6,    verified: false, note: 'Lap between courses of house wrap' },
  fiberglassSize:    { value: 'R-19, 6.3 in thick', verified: true, note: 'Priced by the square foot; roll length varies by maker', source: 'Owens Corning Certified R Metal Building Insulation (6.3 in is R-19; rolls 36 to 72 in wide)' },
  blownBagsPer1000:  { value: { 19: 9, 30: 14.6, 38: 19, 49: 25, 60: 31.5 }, verified: true, note: 'Bags of blown fiberglass per 1,000 sq ft of ceiling, by R-value', source: 'Owens Corning AttiCat coverage chart' },

  footingPadSize:    { value: '14 in precast', verified: true, source: 'NFBA, Bohnhoff (4 x 12 in and 4 x 14 in precast footings are the most common)' },
  collarDiameterIn:  { value: 18,   verified: true, source: 'Hansen Pole Buildings (most buildings need only 18 in diameter holes)' },
  collarDepthIn:     { value: 18,   verified: true, source: 'Hansen Pole Buildings (total depth of concrete is usually 18 in; post volume is not deducted)' },
  bagYieldCuFt:      { value: 0.6,  verified: true, source: 'Quikrete Concrete Mix 1101 data sheet (80 lb bag yields 0.60 cu ft)' },
  slabThicknessIn:   { value: 4,    verified: true, source: 'Hansen Pole Buildings (nominal 4 in slab)' },
  slabSqFtPerYard:   { value: 80,   verified: true, source: 'Hansen Pole Buildings (one yard covers 80 sq ft at a nominal 4 in)' },
  slabJointFt:       { value: 10,   verified: true, note: 'Farthest apart to saw control joints in a 4 in slab', source: 'NRMCA jointing guidance (4 in up to 5 in: 10 ft)' },
  vaporRollWidthFt:  { value: 14,   verified: true, source: 'Stego Wrap 15 mil (14 x 140 ft roll)' },
  vaporRollFt:       { value: 140,  verified: true, source: 'Stego Wrap 15 mil' },
  vaporLapIn:        { value: 6,    verified: true, source: 'IRC R506.2.3 (joints lapped not less than 6 in)' },

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
