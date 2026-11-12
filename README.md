# Girt And Purlin

Pole barn design software that runs in a browser. Lay out a post-frame building, watch it stand up in 3D, and get the material list, the price, the proposal and the framing drawings as you work.

Version 1 draws plain rectangular buildings with a gable roof.

## What It Does

- Sets posts, girts, trusses and purlins from the size and spacing you pick, and warns when a door or window lands on a post.
- Counts the material list and prices it from a CSV price list with four columns: Item, Size, Unit, Price.
- Prints a proposal, a material order, a cut list and framing drawings of all four walls and the roof.
- Makes a look-only link for the customer that leaves out your costs and markup.
- Works on a tablet without signal once it has been opened, and saves the job on the device.
- Packs the building's facts and drawings into a package for your engineer.

## What It Does Not Do

It does no engineering. There are no footings, bracing, truss design or connection details, and snow, wind and soil are left to your engineer. The framing rules in `engine/rules.js` are each marked verified or not, and the ones marked not verified have not yet been checked against a published source. The drawings carry a notice saying so.

Also not in it yet: buildings that need a post longer than 24 feet (with 12 foot walls and a 4/12 roof, 50 feet wide works and 60 feet wide is turned away with a reason); lean-tos, porches and hip roofs; panel counts that subtract openings; Excel price lists; gutters in the material list.

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

Source-available, not open source. A company of ten people or fewer uses it at no charge. A larger company buys a license. The count covers employees and regular subcontractors across the whole company, including parent and sister companies.

The full license text is not in this repository yet. Until it is, this section is a summary only.
