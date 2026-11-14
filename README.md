# PauperPilot Mobile Meta

A mobile-first GitHub Pages view of Pauper and Standard archetype popularity from PauperPilot and MTGGoldfish. Each row links to its archetype page. Link directly to Standard with `#standard`.

## Data source

The Pauper tab fetches PauperPilot’s server-rendered HTML through the public [AllOrigins raw CORS proxy](https://allorigins.win/). It reads the table’s popularity, deck counts, prices, colors, splash markers, and canonical archetype anchors in the browser. Colored bars show each share relative to the most popular archetype. Remote HTML is parsed in an inert template; only validated links and text are rendered. The aggregate “Other” row is omitted because it has no archetype page.

The Standard tab fetches MTGGoldfish’s Standard Tabletop metagame through AllOrigins and sorts the main metagame list by popularity, with reported deck counts, mana colors, canonical links, and USD prices. Budget and recent event decks are excluded. Refresh requests updated data. Each format has its own browser cache and favorites collection; existing Pauper favorites are preserved. Standard includes a dated `data/standard.json` fallback for first visits when the proxy is unavailable. The displayed retrieval time identifies how old the fallback or cached data is.

No GitHub Actions, API key, build step, or hosted backend of your own is required. Live updates depend on AllOrigins being available and able to fetch PauperPilot. The proxy may return cached upstream data; the displayed retrieval time is not the source’s update time. Requests go through that third-party service. Successful results are saved per date range in the browser’s local storage and shown with a clear saved-data message if a later refresh fails. A first visit requires network access and a working proxy.

PauperPilot also exposes `/data/30d/reference-lists.json`, but both that resource and its homepage currently omit `Access-Control-Allow-Origin`. Fetching either directly from GitHub Pages is blocked by browsers.

## Publish with GitHub Pages

Push the repository and enable Pages from your publishing branch’s root directory. The site uses `index.html`, `styles.css`, `app.js`, and the bundled mana icons in `assets/`. It loads all five date ranges directly through AllOrigins and does not require JSON snapshots.

Mana glyph attribution is recorded in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## Local use

Run `python3 -m http.server` in this directory and open the printed localhost address. The optional `scripts/update_data.py` utility can produce local JSON snapshots with network access, but the website does not use or require them.
