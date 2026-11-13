// Retail store prices read off public web pages, as a stand-in until a builder
// loads a real supplier list. Every row says where its number came from. A row
// priced by the foot or by a different pack size than the store sells is the
// store price divided out, and says so. Lines no store page priced like for
// like are left out, so they show as unpriced rather than guessed.

const LOWES = "Lowe's, Norcross GA store, shelf price read 2026-11-13";
const MICHIANA = 'Michiana Building Supplies, steelroofingusa.com, prices posted August 2025';

const lowes = (item, size, unit, price, from) => ({ item, size, unit, price, source: LOWES, from });
const michiana = (item, size, unit, price, from) => ({ item, size, unit, price, source: MICHIANA, from });

export const RETAIL_CATALOG = {
  supplier: 'Retail Store Prices, November 2026',
  sample: false,
  retail: true,
  rows: [
    lowes('Posts', '6x6 treated', 'ft', 4.37, '6x6 x 12 ft treated ground contact, $52.48 a piece'),
    lowes('Skirt Boards', '2x8 treated', 'ft', 1.67, '2x8 x 16 ft treated ground contact, $26.68 a piece'),
    lowes('Wall Girts', '2x6', 'ft', 1.08, '2x6 x 16 ft, $17.33 a piece'),
    lowes('Roof Purlins', '2x4', 'ft', 0.55, '2x4 x 16 ft, $8.72 a piece'),
    lowes('Truss Carriers', '2x12', 'ft', 1.92, '2x12 x 16 ft, $30.68 a piece'),
    lowes('Rafter Ledgers', '2x8', 'ft', 1.28, '2x8 x 8 ft, $10.25 a piece'),
    lowes('Rafters', '2x8', 'ft', 1.28, '2x8 x 8 ft, $10.25 a piece'),
    lowes('Eave Beams', '2x12', 'ft', 1.92, '2x12 x 16 ft, $30.68 a piece'),
    lowes('Headers', '2x10', 'ft', 1.62, '2x10 x 8 ft, $12.96 a piece'),
    lowes('Headers', '2x12', 'ft', 1.92, '2x12 x 16 ft, $30.68 a piece'),
    lowes('Opening Blocking', '2x6', 'ft', 1.08, '2x6 x 16 ft, $17.33 a piece'),
    lowes('Wainscot Girts', '2x4', 'ft', 0.55, '2x4 x 16 ft, $8.72 a piece'),
    lowes('Liner Girts', '2x4', 'ft', 0.55, '2x4 x 16 ft, $8.72 a piece'),
    lowes('Eave Light Girts', '2x4', 'ft', 0.55, '2x4 x 16 ft, $8.72 a piece'),
    lowes('Ceiling Joists', '2x6', 'ft', 1.08, '2x6 x 16 ft, $17.33 a piece'),

    michiana('Roof Panels', '', 'ft', 3.79, '29 gauge 40-Year Select painted panel, per foot'),
    michiana('Wall Panels', '', 'ft', 3.79, '29 gauge 40-Year Select painted panel, per foot'),
    michiana('Wainscot Panels', '', 'ft', 3.79, '29 gauge 40-Year Select painted panel, per foot'),
    michiana('Sliding Door Panels', '', 'ft', 3.79, '29 gauge 40-Year Select painted panel, per foot'),
    michiana('Ridge Cap', '', 'each', 32.98, '10 in ridge cap, 10 ft 6 in piece'),
    michiana('Eave Trim', '', 'each', 15.97, 'Eave trim, sold as a 10 ft piece'),
    michiana('Rake Trim', '', 'each', 24.49, 'Rake and corner trim, 10 ft 6 in piece'),
    michiana('Corner Trim', '', 'each', 24.49, 'Rake and corner trim, 10 ft 6 in piece'),
    michiana('Inside Corner Trim', '', 'each', 29.79, 'Inside corner, 10 ft 6 in piece'),
    michiana('Base Trim', '', 'each', 10.98, 'Base trim (rodent guard), 10 ft 6 in piece'),
    michiana('Wainscot Trim', '', 'each', 10.49, 'Wainscot Z-trim, 10 ft 6 in piece'),
    michiana('J-Channel', '', 'each', 10.49, '7/8 in J-channel, 10 ft 6 in piece'),
    lowes('Inside Closures', '', 'each', 3.25, 'Master Rib foam closure strip, 4-pack of 3 ft strips at $12.98'),
    lowes('Outside Closures', '', 'each', 3.25, 'Master Rib foam closure strip, 4-pack of 3 ft strips at $12.98'),

    lowes('Gutter', '', 'each', 17.98, '5 in aluminum K gutter, 10 ft piece'),
    lowes('Gutter Joiners', '', 'each', 4.99, 'Aluminum K gutter connector, 2-pack at $9.98'),
    lowes('Gutter End Caps', '', 'each', 2.48, 'Aluminum gutter end cap'),
    lowes('Gutter Hangers', '', 'each', 2.78, 'Gutter hanger'),
    lowes('Gutter Outlets', '', 'each', 5.48, 'Downspout outlet'),
    lowes('Downspouts', '', 'each', 19.98, 'Aluminum downspout, 10 ft piece'),
    lowes('Downspout Elbows', '', 'each', 5.98, 'Downspout elbow'),
    lowes('Downspout Bands', '', 'each', 2.18, 'Downspout band'),

    lowes('Roof Bubble Insulation', '', 'each', 264.94, 'Reflectix 48 in x 100 ft roll at $141.30 (400 sq ft), scaled to the 6 x 125 ft roll this list counts'),
    lowes('Wall Bubble Insulation', '', 'each', 264.94, 'Reflectix 48 in x 100 ft roll at $141.30 (400 sq ft), scaled to the 6 x 125 ft roll this list counts'),
    lowes('Roof Fiberglass Insulation', '', 'sqft', 1.1, 'R-19 unfaced fiberglass roll, $53.97 for 48.96 sq ft. House insulation, not metal building rolls'),
    lowes('Wall Fiberglass Insulation', '', 'sqft', 1.1, 'R-19 unfaced fiberglass roll, $53.97 for 48.96 sq ft. House insulation, not metal building rolls'),
    lowes('House Wrap', '', 'each', 79.33, "Lowe's brand house wrap 9 x 150 ft at $119.00, scaled to the 9 x 100 ft roll this list counts"),
    lowes('Blown Ceiling Insulation', '', 'each', 56.08, 'Owens Corning AttiCat blown fiberglass, 27.5 lb bag'),

    lowes('Concrete Mix', '', 'each', 6.47, 'Quikrete concrete mix, 80 lb bag'),
    lowes('Slab Vapor Barrier', '', 'each', 179.54, '10 mil construction film 10 x 100 ft at $91.60, scaled to the 14 x 140 ft roll this list counts. Thinner than 15 mil'),

    lowes('Partition Bottom Plates', '', 'ft', 0.56, '2x4 x 8 ft treated, $4.48 a piece'),
    lowes('Partition Top Plates', '', 'ft', 0.55, '2x4 x 16 ft, $8.72 a piece'),
    lowes('Partition Studs', '2x4', 'ft', 0.53, '2x4 x 8 ft stud, $4.25 a piece'),
    lowes('Partition Studs', '2x6', 'ft', 0.75, '2x6 x 8 ft, $5.97 a piece'),
    lowes('Partition Door Headers', '', 'ft', 0.55, '2x4 x 16 ft, $8.72 a piece'),
    lowes('Partition Sheathing', '', 'each', 13.63, '7/16 in OSB, 4 x 8 ft sheet'),
    lowes('Loft Ledgers', '2x8', 'ft', 1.28, '2x8 x 8 ft, $10.25 a piece'),
    lowes('Loft Ledgers', '2x10', 'ft', 1.62, '2x10 x 8 ft, $12.96 a piece'),
    lowes('Loft Ledgers', '2x12', 'ft', 1.92, '2x12 x 16 ft, $30.68 a piece'),
    lowes('Loft Beams', '2x12', 'ft', 1.92, '2x12 x 16 ft, $30.68 a piece'),
    lowes('Loft Joists', '2x8', 'ft', 1.28, '2x8 x 8 ft, $10.25 a piece'),
    lowes('Loft Joists', '2x10', 'ft', 1.62, '2x10 x 8 ft, $12.96 a piece'),
    lowes('Loft Joists', '2x12', 'ft', 1.92, '2x12 x 16 ft, $30.68 a piece'),
    lowes('Joist Hangers', 'for 2x8 joists', 'each', 2.83, 'Simpson LUS hanger for a 2x8'),
    lowes('Joist Hangers', 'for 2x10 joists', 'each', 3.35, 'Simpson LUS hanger for a 2x10'),
    lowes('Loft Subfloor', '', 'each', 23.43, '23/32 in tongue and groove OSB subfloor, 4 x 8 ft sheet'),
    lowes('Stair Stringers', '', 'ft', 1.92, '2x12 x 16 ft, $30.68 a piece'),
    lowes('Stair Treads', '', 'ft', 1.92, '2x12 x 16 ft, $30.68 a piece'),
    lowes('Stair Handrail', '', 'ft', 5.87, 'Poplar handrail, 8 ft piece at $46.98'),

    lowes('Walk Door', '', 'each', 274, 'Steel prehung entry door, 36 x 80 in, primed, no glass'),
  ],
};
