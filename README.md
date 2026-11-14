# PauperPilot Mobile Meta

A mobile-first GitHub Pages view of archetype popularity from PauperPilot and MTGGoldfish. The original Pauper tab uses PauperPilot. Standard, Pauper-GF, Modern, and Duel Commander use MTGGoldfish. Each row links to its archetype page. Direct links use `#pauper`, `#standard`, `#pauper-gf`, `#modern`, or `#duel-commander`.

## Data source

The Pauper tab fetches PauperPilot’s server-rendered HTML through the public [AllOrigins raw CORS proxy](https://allorigins.win/). It reads the table’s popularity, deck counts, prices, colors, splash markers, and canonical archetype anchors in the browser. Colored bars show each share relative to the most popular archetype. Remote HTML is parsed in an inert template; only validated links and text are rendered. The aggregate “Other” row is omitted because it has no archetype page.

The MTGGoldfish tabs fetch each format’s full Tabletop metagame through AllOrigins and sort all listed archetypes by popularity, with reported deck counts, mana colors, canonical links, and USD prices. Sources are the full lists for [Standard](https://www.mtggoldfish.com/metagame/standard/full#paper), [Pauper](https://www.mtggoldfish.com/metagame/pauper/full#paper), [Modern](https://www.mtggoldfish.com/metagame/modern/full#paper), and [Duel Commander](https://www.mtggoldfish.com/metagame/duel_commander/full#paper). Budget and recent event decks are excluded. Refresh requests updated data. Every tab has its own browser cache and favorites collection, including separate favorites for Pauper and Pauper-GF. Existing Pauper and Standard favorites are preserved. Each MTGGoldfish tab includes a dated `data/<format>.json` fallback for first visits when the proxy is unavailable. The displayed retrieval time identifies how old the fallback or cached data is.

No GitHub Actions, API key, build step, or hosted backend of your own is required. Live updates depend on AllOrigins being available and able to fetch the source site. The proxy may return cached upstream data; the displayed retrieval time is not the source’s update time. Requests go through that third-party service. Successful results are saved per format (and per date range for PauperPilot) in the browser’s local storage and shown with a clear saved-data message if a later refresh fails. A first visit to PauperPilot requires a working proxy; the MTGGoldfish tabs can use their bundled fallbacks.

PauperPilot also exposes `/data/30d/reference-lists.json`, but both that resource and its homepage currently omit `Access-Control-Allow-Origin`. Fetching either directly from GitHub Pages is blocked by browsers.

## Publish with GitHub Pages

Push the repository and enable Pages from your publishing branch’s root directory. The site uses `index.html`, `styles.css`, `app.js`, the bundled mana icons in `assets/`, and the MTGGoldfish fallback snapshots in `data/`. PauperPilot’s five date ranges load through AllOrigins.

Mana glyph attribution is recorded in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## Local use

Run `python3 -m http.server` in this directory and open the printed localhost address. The optional `scripts/update_data.py` utility can produce PauperPilot JSON snapshots with network access, but the website does not use those snapshots.
