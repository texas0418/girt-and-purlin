// Writes the public site pages. Run with: node site/build.mjs
// The drawings, lists and totals on the pages come from the engine, so they
// are rebuilt here instead of being pasted in by hand.
import { writeFileSync } from 'node:fs';
import { design } from '../engine/design.js';
import { priceJob, SAMPLE_CATALOG } from '../engine/pricing.js';
import { drawing } from '../app/drawings.js';
import { floorPlan } from '../app/plan.js';

const REPO = 'https://github.com/texas0418/girt-and-purlin';
const out = (name, html) => writeFileSync(new URL(name, import.meta.url), html);
const money = (n) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

const job = {
  job: 'Machine Shed, 30 x 48', width: 30, length: 48, eaveHeight: 12, pitch: 4, overhang: 12, postSpacing: 8, trussSpacing: 4,
  openings: [
    { type: 'slider', wall: 'front', offset: 18, width: 12, height: 10 },
    { type: 'walk', wall: 'front', offset: 5, width: 3, height: 6 + 8 / 12 },
    { type: 'window', wall: 'front', offset: 34, width: 4, height: 3.5, sill: 3 },
    { type: 'window', wall: 'front', offset: 41, width: 4, height: 3.5, sill: 3 },
  ],
  colors: { walls: '#8b908d', roof: '#2f3336', trim: '#e6e6e0', wainscot: '#2f3336', wainscotOn: true, gutters: true, truck: false },
};
const result = design(job);
const priced = priceJob(result, SAMPLE_CATALOG, { markupPct: 0, taxPct: 0, laborPerSqFt: 0 });
const packed = Buffer.from(JSON.stringify({ ...job, price: { package: priced.total, labor: 0, tax: 0, total: priced.total } }))
  .toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

// The same building with the walk door slid onto a post, to show the warning as the program words it.
const clash = design({ ...job, openings: job.openings.map((o) => (o.type === 'walk' ? { ...o, offset: 6.5 } : o)) });
const warning = clash.warnings[0].text;

const cutLength = (inches) => {
  const eighths = Math.round(inches * 8), ft = Math.floor(eighths / 96), rest = eighths - ft * 96;
  const whole = Math.floor(rest / 8), part = rest % 8, div = part % 4 === 0 ? 4 : part % 2 === 0 ? 2 : 1;
  return `${ft} ft ${whole}${part ? ` ${part / div}/${8 / div}` : ''} in`;
};

const icon = '<svg viewBox="0 0 48 48" aria-hidden="true"><mask id="door"><path d="M6 42V20L24 7l18 13v22H31V26H17v16z" fill="#fff" stroke="#fff" stroke-width="3" stroke-linejoin="round"/><path d="M14 26h20" stroke="#000" stroke-width="3" stroke-linecap="round"/></mask><rect width="48" height="48" fill="currentColor" mask="url(#door)"/></svg>';
const MENU = [['what-it-does.html', 'What It Does'], ['tablet.html', 'Tablet'], ['lumber-yards.html', 'Lumber Yards'], ['license.html', 'License'], ['source.html', 'Source']];

function page(file, title, description, body) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${title}</title>
<meta name="description" content="${description}">
<link rel="icon" href="../app/icons/icon-180.png">
<link rel="stylesheet" href="site.css">
</head>
<body>
<div class="wrap">
  <header>
    <a class="brand" href="index.html">${icon}Girt And Purlin</a>
    <nav>${MENU.map(([href, name]) => `<a href="${href}"${href === file ? ' class="here"' : ''}>${name}</a>`).join('')}</nav>
    <a class="btn" href="../app/">Open The Designer</a>
  </header>
</div>
${body}
<div class="wrap">
  <footer><span>Girt And Purlin</span>${MENU.map(([href, name]) => `<a href="${href}">${name}</a>`).join('')}<a href="../app/">Open The Designer</a></footer>
</div>
</body>
</html>
`;
}

const listRows = (items) => items.map((i) => `<div><span>${i.qty}</span><span>${i.name}</span><span>${[i.size, i.length].filter(Boolean).join(', ')}</span></div>`).join('\n        ');
const framing = result.items.filter((i) => i.group === 'Framing').slice(0, 9);
const head = (h1, lead) => `<div class="wrap"><div class="top"><h1>${h1}</h1><div><p>${lead}</p></div></div></div>`;
const notYet = (items) => `<section><h2>Not In It Yet</h2><ul class="notyet">${items.map((i) => `<li>${i}</li>`).join('')}</ul></section>`;

out('index.html', page('index.html', 'Girt And Purlin, Pole Barn Design Software',
  'Lay out a post-frame building in 3D and get the material list, price, proposal and framing drawings. Runs in a browser and on a tablet.', `
<div class="wrap">
  <div class="top">
    <h1>Pole Barn Design Software You Can Open Right Now</h1>
    <div>
      <p>Lay out a post-frame building and watch it stand up in 3D. The material list, the price, the proposal and the framing drawings follow along as you work. There is no sales call and no sign-up.</p>
      <div class="go"><a class="btn" href="../app/">Open The Designer</a><a class="btn plain" href="source.html">See The Source</a></div>
    </div>
  </div>
</div>

<div class="live">
  <iframe src="../app/#q=${packed}&embed" title="A sample building you can turn"></iframe>
  <div class="tag">This is the program running. Drag the building to turn it.</div>
</div>

<div class="wrap">
  <section>
    <h2>One Building In, The Whole Job Out</h2>
    <div class="out">
      <div class="sheet"><b>Front Wall Framing, From The Building Above</b>${drawing(result, 'front', true)}</div>
      <div class="list"><b>Its Material List, With Sample Prices</b>
        ${listRows(framing)}
        <div><span></span><span>and ${result.items.length - framing.length} more lines</span><span></span></div>
        <div class="sum"><span>Total</span><span>${money(priced.total)}</span></div>
      </div>
    </div>
    <p class="cap">Both came out of the program as shown. Move a door and the drawing, the list and the total all change with it.</p>
  </section>

  <section>
    <h2>What It Does</h2>
    <div class="rows">
      <a href="what-it-does.html#posts"><strong>Catches A Post Under A Door</strong><span>Put a walk door where a post lands and it tells you in plain words, then offers to slide the door clear.</span><i>&rarr;</i></a>
      <a href="what-it-does.html#price"><strong>Prices From Your Own List</strong><span>Load a spreadsheet of your supplier's prices. Add your markup, labor and sales tax, and the total keeps up.</span><i>&rarr;</i></a>
      <a href="what-it-does.html#paper"><strong>Prints The Paperwork</strong><span>A proposal for the customer, a material order for the yard, a cut list for the crew and framing drawings of every wall.</span><i>&rarr;</i></a>
      <a href="what-it-does.html#link"><strong>Sends The Customer A Link</strong><span>They open it on a phone and turn their own building around. Your costs and markup stay with you.</span><i>&rarr;</i></a>
      <a href="tablet.html"><strong>Works On A Tablet Without Signal</strong><span>Open it once and it keeps working in a field with no bars. The job saves on the tablet.</span><i>&rarr;</i></a>
      <a href="what-it-does.html#engineer"><strong>Packs A Folder For Your Engineer</strong><span>It does not do the engineering. It hands your engineer the size, the framing as drawn, every post and opening, and the drawings.</span><i>&rarr;</i></a>
    </div>
  </section>

  <section>
    <div class="two">
      <div><h3>No Charge For Shops Of Ten Or Fewer</h3><p>Builders and yards with ten people or fewer use the whole program without paying. Larger companies buy a license. The code is public for anyone to read, which makes it source-available.</p><a href="license.html">Read The License</a></div>
      <div><h3>Where It Stands Today</h3><p>Version 1 draws plain rectangular buildings with a gable roof. Its framing rules are still being checked against published builder guides, and the drawings say so until that is done.</p><a href="what-it-does.html#notyet">See What Is Not In It Yet</a></div>
    </div>
  </section>
</div>`));

out('what-it-does.html', page('what-it-does.html', 'What Girt And Purlin Does',
  'Post layout, material list, pricing from your own list, proposal, cut list, framing drawings, customer link and an engineer package.', `
${head('What It Does', 'Everything on this page was made by the program from one sample building: a 30 by 48 machine shed with 12 foot walls, a sliding door, a walk door and two windows.')}
<div class="wrap">
  <section>
    <h2>Lay Out The Building</h2>
    <div class="split">
      <div class="prose"><p>Set the width, length, wall height, roof pitch and overhang with arrow buttons. Pick the post spacing and truss spacing. Click a wall to put a sliding door, overhead door, walk door or window on it, then nudge it along the wall.</p><p>The building redraws in 3D as you go, in your colors. Switch to Framing to see the posts, girts, trusses and purlins with the steel off, or to Floor Plan for the view from above.</p></div>
      <div class="sheet"><b>Floor Plan</b>${floorPlan(result, true)}</div>
    </div>
  </section>

  <section id="posts">
    <h2>Catches A Post Under A Door</h2>
    <div class="split">
      <div class="prose"><p>Posts go in at your spacing. A door wide enough to need them gets a post at each side. When a walk door or window lands on a post, the program stops you with a line like the one here and a Fix It For Me button that slides the opening clear.</p></div>
      <div class="warn"><b>Check this.</b> ${warning}</div>
    </div>
  </section>

  <section id="price">
    <h2>Prices From Your Own List</h2>
    <div class="split">
      <div class="prose"><p>The material list counts posts by length, trusses, skirt boards, girts, purlins, headers, roof and wall panels, trim and screws. It updates on every change and marks the lines that moved.</p><p>A price list is a spreadsheet saved as CSV with four columns: Item, Size, Unit and Price. Load yours, set your markup, your labor per square foot and your sales tax, and the total follows. The program ships with sample prices so the screen has something to add up. They are not real quotes.</p></div>
      <div class="list"><b>Material List, With Sample Prices</b>
        ${listRows(framing)}
        <div><span></span><span>and ${result.items.length - framing.length} more lines</span><span></span></div>
        <div class="sum"><span>Total</span><span>${money(priced.total)}</span></div>
      </div>
    </div>
  </section>

  <section id="paper">
    <h2>Prints The Paperwork</h2>
    <div class="prose wide"><p>Four things print, or save as PDF: a proposal with the picture, the spec, the price and a signature line; a material order for the yard; a cut list for the crew; and framing drawings of all four walls and the roof.</p></div>
    <div class="out even">
      <div class="sheet"><b>Left End Framing</b>${drawing(result, 'left', true)}</div>
      <div class="sheet"><b>Cut List, First Lines</b>
        <table><thead><tr><th>Qty</th><th>Cut To</th><th>From</th><th>Where It Goes</th></tr></thead>
        ${result.cuts.slice(0, 9).map((c) => `<tr><td>${c.qty}</td><td>${Math.abs(c.cutIn - c.stockFt * 12) < 0.01 ? 'Full length' : cutLength(c.cutIn)}</td><td>${c.stockFt} ft</td><td>${c.part}, ${c.where}</td></tr>`).join('')}</table></div>
    </div>
  </section>

  <section id="link">
    <h2>Sends The Customer A Link</h2>
    <div class="prose wide"><p>Send To Customer makes a link you paste into a text or an email. The customer opens a look-only page with their building in 3D, the floor plan, what is included and the total. Your costs, your markup and the material list are not in it. The picture at the top of the <a href="index.html">front page</a> is that same view.</p></div>
  </section>

  <section id="engineer">
    <h2>Packs A Folder For Your Engineer</h2>
    <div class="prose wide"><p>The program does not size anything for load. It has no footings, no bracing, no truss design and no connection details. What it does is save your engineer the first hour: a package with the building's size, the framing as drawn with room to mark changes, a table of every post and every opening, the post layout and the framing drawings, plus a data file they can load into their own software.</p></div>
  </section>

  <div id="notyet">${notYet([
    'Any shape other than a plain rectangle with a gable roof. No lean-tos, porches or hip roofs.',
    'Engineering of any kind. Snow, wind and soil are your engineer\'s call.',
    'Panel counts that subtract door and window openings. Today the walls are counted solid.',
    'Excel files. Price lists load as CSV.',
    'Gutters in the material list. They show in the picture only.',
    'Typing a number straight into a size box. Sizes move by arrow buttons.',
  ])}</div>
</div>`));

out('tablet.html', page('tablet.html', 'Girt And Purlin On A Tablet',
  'The designer runs on a tablet in the field and keeps working without signal.', `
${head('On A Tablet, With Or Without Signal', 'Stand in the customer\'s yard, lay out the building in front of them and hand over a price before you leave.')}
<div class="wrap">
  <section>
    <div class="rows still">
      <div><strong>No Signal Needed</strong><span>Open the designer once while you have a connection. After that it opens and works with none. Nothing about the job is sent anywhere.</span></div>
      <div><strong>The Job Stays On The Tablet</strong><span>Every change saves on the device as you make it. Close the tab, open it tomorrow, and the job is where you left it.</span></div>
      <div><strong>Sized For Thumbs</strong><span>On a touch screen the buttons and steppers grow. On a narrow screen the building takes the top and the settings and material list sit side by side below it.</span></div>
      <div><strong>Add It To The Home Screen</strong><span>It carries its own icon, so it can sit on the home screen next to your other apps.</span></div>
    </div>
  </section>
  ${notYet([
    'A run on a real tablet. The layouts were checked at tablet sizes on a computer, not yet on the device itself. Adding it to a home screen has not been tried on one either.',
    'Moving a job from the tablet to the office computer. A job lives on the device it was drawn on.',
  ])}
</div>`));

out('lumber-yards.html', page('lumber-yards.html', 'Girt And Purlin For Lumber Yards',
  'Give your builders a pole barn designer that prices from your list and sends you the material order.', `
${head('For Lumber Yards', 'Hand your builders a designer that adds up jobs at your prices and sends the material order back to you.')}
<div class="wrap">
  <section>
    <div class="rows still">
      <div><strong>Your Price List, In Their Hands</strong><span>Fill in one spreadsheet with four columns: Item, Size, Unit and Price. Save it as CSV and send it to your builders. They load it once and every job adds up at your prices.</span></div>
      <div><strong>An Order You Can Read</strong><span>The Material Order sheet lists every post, board, panel, trim piece and bag of screws by size and length, grouped the way a yard pulls it.</span></div>
      <div><strong>Nothing To Install</strong><span>It opens in a browser. A builder with ten people or fewer pays nothing to use it.</span></div>
      <div><strong>Your Yard's License</strong><span>A yard with ten people or fewer pays nothing. A larger yard buys a license. <a href="license.html">How the count works</a>.</span></div>
    </div>
  </section>
  ${notYet([
    'More than one price list loaded at a time.',
    'Your yard\'s name and logo on the designer itself.',
    'Excel files. Price lists load as CSV.',
    'Orders sent to you from inside the program. The builder prints or saves the order and sends it.',
  ])}
</div>`));

out('license.html', page('license.html', 'Girt And Purlin License',
  'No charge for companies of ten people or fewer. Larger companies buy a license. Source-available.', `
${head('The License, In Plain Words', 'Small shops use it without paying. Larger companies buy a license. Anyone can read the code.')}
<div class="wrap">
  <section>
    <div class="rows still">
      <div><strong>Ten People Or Fewer</strong><span>Your company uses the whole program at no charge.</span></div>
      <div><strong>More Than Ten People</strong><span>Your company buys a license.</span></div>
      <div><strong>Who Counts</strong><span>Employees and regular subcontractors, across the whole company. A parent company and sister companies count together.</span></div>
      <div><strong>Source-Available</strong><span>The code is public and you can read all of it. Because larger companies must pay, it is source-available and not open source.</span></div>
    </div>
  </section>
  <section>
    <h2>Still Being Written</h2>
    <div class="prose wide"><p>This page is a summary, not the license itself. The full legal text is being prepared and reviewed, and it will be posted here and in the code before the program is offered for sale. The price for larger companies is not set yet.</p></div>
  </section>
</div>`));

out('source.html', page('source.html', 'Girt And Purlin Source',
  'The code is public on GitHub. Plain JavaScript, no build step.', `
${head('The Source', 'All of the code is public. Read it, run it on your own computer, or check how a count was made.')}
<div class="wrap">
  <section>
    <div class="rows still">
      <div><strong>Where It Lives</strong><span><a href="${REPO}">${REPO.replace('https://', '')}</a></span></div>
      <div><strong>The Engine</strong><span>Plain JavaScript with nothing to install. A building description goes in and every post, board, panel and cut comes out. ${Object.keys(result.rules).length} framing and material rules sit in one file, each marked checked or not checked.</span></div>
      <div><strong>The Designer</strong><span>Plain files with no build step. The 3D picture uses three.js, which is included in the code.</span></div>
      <div><strong>The Tests</strong><span>The engine's counts are checked by tests worked out by hand. Run them with <code>npm test</code>.</span></div>
      <div><strong>Run It Yourself</strong><span>From the project folder: <code>python3 -m http.server 8771</code>, then open <code>localhost:8771/app/</code>.</span></div>
      <div><strong>The Terms</strong><span>Source-available, not open source. <a href="license.html">The license in plain words</a>.</span></div>
    </div>
  </section>
</div>`));

console.log('site built:', money(priced.total), '|', warning);
