# DeadGood Quote Engine

DeadGood Quote Engine is a mobile-first internal quoting tool for DeadGood Printing. The current build keeps the premium dark v3 interface, but adds saved quotes, garment categories, stronger quote item editing, custom quantities, and more compact mobile management screens.

## What it includes

- Fast `Quote`, `Saved Quotes`, `Garments`, `Print Pricing`, and `Settings` pages
- Auto-saved working quote that survives refreshes
- Named quotes stored in `localStorage`
- Open, duplicate, delete, and start-new quote actions
- Quote items with independent garment, quantity, print lines, and totals
- Editable quote items with duplicate and delete controls
- Preset quantities plus `Custom` quantity with nearest lower pricing bracket logic
- Quote-wide print pricing brackets based on total garments across the whole quote
- Quote-level delivery with compact box controls and saved delivery settings
- Saved garments with categories
- Collapsible category groups when choosing garments in the quote flow
- Collapsible garment and print pricing management built for mobile editing
- Editable print positions, sizes, and placeholder pricing tables
- Configurable internal VAT and markup settings
- Lightweight PWA install support

## File structure

```text
.
├── index.html
├── manifest.webmanifest
├── sw.js
├── assets
│   ├── app.js
│   ├── calculations.js
│   ├── config.js
│   ├── storage.js
│   ├── styles.css
│   ├── utils.js
│   └── icons
│       ├── icon-maskable.svg
│       └── icon.svg
└── README.md
```

## Run locally

Because the app uses ES modules and a service worker, serve the project with a local web server rather than opening `index.html` directly.

### Local machine

```bash
python3 -m http.server 4173
```

Then open [http://localhost:4173](http://localhost:4173).

### Same Wi-Fi on phone

Start the server on all interfaces:

```bash
python3 -m http.server 4173 --bind 0.0.0.0
```

Then open your Mac's local network IP with port `4173` from your phone browser.

## Editing key data

- Default categories, quantities, placeholder print pricing, and calculation defaults live in [assets/config.js](/Users/deadgood/Documents/DeadGood%20Price%20Calculator%20App/assets/config.js).
- Calculation rules, including custom quantity bracket handling, live in [assets/calculations.js](/Users/deadgood/Documents/DeadGood%20Price%20Calculator%20App/assets/calculations.js).
- Local persistence, hydration, and legacy quote migration live in [assets/storage.js](/Users/deadgood/Documents/DeadGood%20Price%20Calculator%20App/assets/storage.js).

## Notes

- All quote, garment, pricing, and settings data is browser-local only in v1.
- Pricing values are editable placeholders and should be replaced with real production pricing.
- Garment sell prices are stored per item, while print prices automatically reprice against the active whole-quote quantity bracket...
