# Girt And Purlin

Pole barn design software that runs in a browser. Lay out a post-frame building, watch it stand up in 3D, and get the material list, the price, the proposal and the framing drawings as you work.

It draws rectangular buildings up to 100 feet wide with a gable, single slope or gambrel roof, with lean-tos and porches on any wall.

## What It Does

- Sets posts, girts, trusses and purlins from the size and spacing you pick, and warns when a door or window lands on a post.
- Draws lean-tos, porches, open walls, lofts, interior walls, steel liner, insulation, wainscot, cupolas, skylights and eave lights, and counts footings, a slab and gutters.
- Counts the material list and prices it from one or more CSV price lists with four columns: Item, Size, Unit, Price. A supplier can save a copy of a list marked up or down for one builder.
- Draws a site plan from the lot size and setbacks you type in, and checks whether a tractor or camper of a given size fits through a door and on the floor.
- Keeps good, better and best versions of a job, a payment schedule and a signature taken on the screen.
- Prints a proposal, a cut list, a delivery check sheet and framing drawings of all four walls and the roof. Your logo and company details head each printed page. Saves the material order as a spreadsheet file, an invoice file for QuickBooks and the drawings as DXF.
- Makes a look-only link for the customer that leaves out your costs and markup, and a simple designer a builder can put on their own website.
- Works on a tablet without signal once it has been opened, saves the job on the device, and moves a job between devices as a file.
- Packs the building's facts and drawings into a package for your engineer.

## What It Does Not Do

It does no engineering. There is no bracing, truss design or connection details, and footings and the slab are counted as material only. The snow, wind and frost figures you type in are recorded for your engineer; nothing is sized from them except post depth for deep frost. The framing rules in `engine/rules.js` are each marked verified or not, and the ones marked not verified have not yet been checked against a published source. The drawings carry a notice saying so.

Also not in it yet: buildings that need a post longer than 24 feet; hip roofs, dormers, awnings and porches that wrap a corner; a choice of truss types; coverings other than ribbed steel panels; stud-framed walls; buildings joined to one another; panel counts that subtract openings; Excel price lists.

## Run It

Nothing to install. You need Node 20 or newer for the tests and any static file server for the designer.

```
npm test
python3 -m http.server 8771
```

Then open `localhost:8771/app/` for the designer, or `localhost:8771/site/` for the site pages.

## Layout

- `engine/` is the part that works out the building. A description goes in; posts, boards, panels, cuts and warnings come out. Plain JavaScript, no dependencies.
- `app/` is the designer. Static files, no build step. three.js is vendored in `app/vendor/`.
- `site/` is the public site. `npm run site` rebuilds its pages from the engine so the drawings and totals on them are real output.

## License

Source-available, not open source. Every company gets a 30 day trial, and after that the program asks for a license code. A company of ten people or fewer gets its code at no charge. A larger company buys a license: $1,500 a year or $149 a month for builders and contractors, $4,800 a year for lumber yards and suppliers. The count covers employees and regular subcontractors across the whole company, including parent and sister companies.

The full license text is not in this repository yet. Until it is, this section is a summary only.
