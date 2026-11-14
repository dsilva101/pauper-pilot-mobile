let activeFormat = 'pauper';
const GOLDFISH = {source: 'https://www.mtggoldfish.com', name: 'MTGGoldfish', currency: 'USD', goldfish: true};
const FORMATS = {
  pauper: {source: 'https://pauperpilot.com', name: 'PauperPilot', currency: 'EUR', label: 'Pauper'},
  standard: {...GOLDFISH, label: 'Standard', path: '/metagame/standard/full'},
  'pauper-gf': {...GOLDFISH, label: 'Pauper-GF', path: '/metagame/pauper/full'},
  modern: {...GOLDFISH, label: 'Modern', path: '/metagame/modern/full'},
  'duel-commander': {...GOLDFISH, label: 'Duel Commander', path: '/metagame/duel_commander/full'}
};
function formatConfig() { return FORMATS[activeFormat]; }
const PROXY = 'https://api.allorigins.win/raw?url=';
const ROUTES = {'30d': '/', '7d': '/7d/', '90d': '/90d/', bnr: '/bnr/', set: '/set/'};
const status = document.querySelector('#status');
const rows = document.querySelector('#rows');
const period = document.querySelector('#period');
const refresh = document.querySelector('#refresh');
const favoritesOnly = document.querySelector('#favorites-only');
const money = new Intl.NumberFormat('en-IE', {style: 'currency', currency: 'EUR'});
const COLOR_NAMES = {W: 'White', U: 'Blue', B: 'Black', R: 'Red', G: 'Green'};
let activeRequest;
let currentItems = [];
function favoritesKey() { return `${activeFormat}-meta-favorites-v1`; }
function readFavorites() {
  try {
    const saved = JSON.parse(localStorage.getItem(favoritesKey()));
    return new Set(Array.isArray(saved) ? saved.filter(value => typeof value === 'string') : []);
  } catch { return new Set(); }
}
let favorites = readFavorites();
function saveFavorites() {
  try { localStorage.setItem(favoritesKey(), JSON.stringify([...favorites])); } catch { /* Storage may be disabled. */ }
}
function favoriteKey(deck) { return deck.name.trim().toLocaleLowerCase(); }

function archetypeURL(href) {
  const url = new URL(href, formatConfig().source);
  const validPath = formatConfig().goldfish
    ? /^\/archetype\/[-a-z0-9_]+$/.test(url.pathname)
    : /^\/(?:7d\/|90d\/|bnr\/|set\/)?archetypes\/[^/]+\/$/.test(url.pathname);
  if (url.origin !== formatConfig().source || !validPath || url.search || (url.hash && !(formatConfig().goldfish && url.hash === '#paper'))) {
    throw new Error('Invalid archetype URL');
  }
  return url.href;
}

function validate(items) {
  if (!Array.isArray(items) || !items.length) throw new Error('No archetypes found');
  const seen = new Set();
  for (const item of items) {
    if (!item || typeof item.name !== 'string' || !item.name.trim() ||
        !Number.isFinite(item.share) || item.share < 0 || item.share > 100 ||
        (item.price !== null && (!Number.isFinite(item.price) || item.price < 0)) ||
        !Number.isSafeInteger(item.decks) || item.decks < 0 ||
        typeof item.colors !== 'string' || !/^[WUBRG]*$/.test(item.colors) ||
        typeof item.splash !== 'string' || !/^[WUBRG]*$/.test(item.splash)) {
      throw new Error('Invalid archetype data');
    }
    const url = archetypeURL(item.href);
    if (seen.has(url)) throw new Error('Duplicate archetype');
    seen.add(url);
  }
  return items;
}

function parseTable(html) {
  // Parse in an inert template. Remote scripts and markup never enter the page.
  const template = document.createElement('template');
  template.innerHTML = html;
  const items = [];
  for (const row of template.content.querySelectorAll('tbody tr[data-meta-row]')) {
    const link = row.querySelector('a[href]');
    if (!link) continue; // The aggregate "Other" row has no destination.
    const deckCount = row.cells[3]?.textContent.trim().replace(/,/g, '');
    items.push({
      name: row.dataset.name || link.textContent.trim(),
      href: archetypeURL(link.getAttribute('href')),
      share: row.dataset.share?.trim() ? Number(row.dataset.share) : NaN,
      price: row.dataset.price?.trim() ? Number(row.dataset.price) : null,
      decks: /^\d+$/.test(deckCount || '') ? Number(deckCount) : NaN,
      colors: row.dataset.colors || '',
      splash: row.dataset.splash || '',
      incompletePrice: /≥/.test(row.textContent)
    });
  }
  return validate(items);
}

function parseGoldfish(html) {
  const template = document.createElement('template');
  template.innerHTML = html;
  const items = [];
  for (const tile of template.content.querySelectorAll('#metagame-decks-container .archetype-tile')) {
    const link = tile.querySelector('.archetype-tile-title .deck-price-paper a');
    const stats = tile.querySelector('.metagame-percentage .archetype-tile-statistic-value')?.textContent;
    const match = stats?.match(/([\d.]+)\s*%\s*\(([\d,]+)\)/);
    if (!link || !match) throw new Error('Invalid MTGGoldfish metagame tile');
    const priceText = tile.querySelector('.archetype-tile-statistic.deck-price-paper .archetype-tile-statistic-value')?.textContent;
    const priceMatch = priceText?.match(/\$\s*([\d,]+(?:\.\d+)?)/);
    const colors = [...tile.querySelectorAll('.manacost .ms')]
      .map(icon => [...icon.classList].find(name => /^ms-[wubrg]$/.test(name))?.slice(3).toUpperCase())
      .filter(Boolean);
    items.push({
      name: link.textContent.trim(), href: archetypeURL(link.getAttribute('href')),
      share: Number(match[1]), decks: Number(match[2].replace(/,/g, '')),
      price: priceMatch ? Number(priceMatch[1].replace(/,/g, '')) : null,
      colors: [...new Set(colors)].join(''), splash: ''
    });
  }
  return validate(items).sort((a, b) => b.share - a.share || b.decks - a.decks);
}

function manaIcons(deck) {
  const icons = document.createElement('span');
  icons.className = 'mana-icons';
  icons.setAttribute('role', 'img');
  const main = [...deck.colors].filter(color => !deck.splash.includes(color));
  const splash = [...deck.splash];
  const label = main.map(color => COLOR_NAMES[color]).join(' and ') || 'Colorless';
  icons.setAttribute('aria-label', label + (splash.length ? `, splashing ${splash.map(color => COLOR_NAMES[color]).join(' and ')}` : ''));
  for (const color of [...main, ...splash]) {
    const icon = document.createElement('span');
    icon.className = `mana mana-${color}${splash.includes(color) ? ' splash' : ''}`;
    const image = document.createElement('img');
    image.src = `assets/mana-${color}.svg`;
    image.alt = '';
    image.width = 12;
    image.height = 12;
    icon.append(image);
    icons.append(icon);
  }
  return icons;
}

function render(items) {
  currentItems = items;
  const visibleItems = favoritesOnly.checked ? items.filter(deck => favorites.has(favoriteKey(deck))) : items;
  const maxShare = Math.max(...items.map(deck => deck.share), 1);
  document.querySelector('#count').textContent = favoritesOnly.checked
    ? `${visibleItems.length} of ${items.length} archetypes`
    : `${items.length} archetypes`;
  const renderedRows = visibleItems.map(deck => {
    const tr = document.createElement('tr');
    const isFavorite = favorites.has(favoriteKey(deck));
    if (isFavorite) tr.classList.add('is-favorite');
    const favoriteCell = document.createElement('td');
    favoriteCell.className = 'favorite-cell';
    const favoriteButton = document.createElement('button');
    favoriteButton.type = 'button';
    favoriteButton.className = 'favorite-toggle';
    favoriteButton.dataset.favoriteKey = favoriteKey(deck);
    favoriteButton.setAttribute('aria-label', `${isFavorite ? 'Remove' : 'Add'} ${deck.name} ${isFavorite ? 'from' : 'to'} favorites`);
    favoriteButton.setAttribute('aria-pressed', String(isFavorite));
    favoriteButton.textContent = isFavorite ? '★' : '☆';
    favoriteCell.append(favoriteButton);
    const colors = document.createElement('td');
    colors.className = 'colors-cell';
    colors.append(manaIcons(deck));
    const name = document.createElement('td');
    name.className = 'name-cell';
    name.append(manaIcons(deck));
    const link = document.createElement('a');
    link.className = 'deck-link';
    link.href = archetypeURL(deck.href);
    link.textContent = deck.name;
    name.append(link);
    const share = document.createElement('td');
    share.className = 'share-cell';
    const shareLayout = document.createElement('span');
    shareLayout.className = 'share-layout';
    const track = document.createElement('span');
    track.className = 'share-track';
    track.setAttribute('aria-hidden', 'true');
    const bar = document.createElement('span');
    const mainColors = [...deck.colors].filter(color => !deck.splash.includes(color));
    bar.className = `share-bar bar-${mainColors.length > 1 ? 'multi' : mainColors[0] || 'other'}`;
    bar.style.width = `${deck.share / maxShare * 100}%`;
    track.append(bar);
    const percent = document.createElement('span');
    percent.className = 'share';
    percent.textContent = `${deck.share.toFixed(1)}%`;
    shareLayout.append(track, percent);
    share.append(shareLayout);
    const decks = document.createElement('td');
    decks.className = 'decks';
    decks.textContent = deck.decks.toLocaleString();
    const price = document.createElement('td');
    price.className = 'price';
    const currency = formatConfig().goldfish
      ? new Intl.NumberFormat('en-US', {style: 'currency', currency: formatConfig().currency}) : money;
    price.textContent = deck.price === null ? '—' : `${deck.incompletePrice ? '≥ ' : ''}${currency.format(deck.price)}`;
    tr.append(favoriteCell, colors, name, share, decks, price);
    return tr;
  });
  if (favoritesOnly.checked && visibleItems.length === 0) {
    const emptyRow = document.createElement('tr');
    const emptyCell = document.createElement('td');
    emptyCell.className = 'favorite-empty';
    emptyCell.colSpan = 6;
    emptyCell.textContent = items.length
      ? 'No favorite decks yet. Tap a star to add a deck.'
      : 'No decks are available for this date range.';
    emptyRow.append(emptyCell);
    renderedRows.push(emptyRow);
  }
  rows.replaceChildren(...renderedRows);
}

function cacheKey(key) {
  return formatConfig().goldfish ? `${activeFormat}-meta-v2:paper-full` : `pauper-meta-v2:${key}`;
}

function readCache(key) {
  try {
    const cached = JSON.parse(localStorage.getItem(cacheKey(key)));
    if (!cached || !Number.isFinite(Date.parse(cached.fetchedAt))) return null;
    validate(cached.archetypes);
    return cached;
  } catch { return null; }
}

async function load() {
  activeRequest?.abort();
  const controller = new AbortController();
  activeRequest = controller;
  const key = period.value;
  let cached = readCache(key);
  if (!cached && formatConfig().goldfish) {
    try {
      const response = await fetch(`data/${activeFormat}.json`, {signal: controller.signal});
      if (!response.ok) throw new Error('Snapshot unavailable');
      const bundled = await response.json();
      if (activeRequest !== controller) return;
      validate(bundled.archetypes);
      if (!Number.isFinite(Date.parse(bundled.fetchedAt))) throw new Error('Invalid snapshot date');
      cached = bundled;
    } catch { /* Live retrieval can still succeed without the bundled snapshot. */ }
    if (activeRequest !== controller) return;
  }
  const timestamp = snapshot => new Date(snapshot.fetchedAt).toLocaleString();
  if (cached) render(cached.archetypes);
  else {
    render([]);
    document.querySelector('#count').textContent = '';
  }
  const config = formatConfig();
  status.textContent = cached ? 'Showing saved data · Checking for updates…' : `Loading ${config.name} data…`;
  rows.closest('table').setAttribute('aria-busy', 'true');
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const path = config.goldfish ? config.path : ROUTES[key];
    const response = await fetch(PROXY + encodeURIComponent(config.source + path), {
      signal: controller.signal, credentials: 'omit'
    });
    if (!response.ok) throw new Error(`Proxy returned ${response.status}`);
    const html = await response.text();
    if (activeRequest !== controller) return;
    const archetypes = config.goldfish ? parseGoldfish(html) : parseTable(html);
    const snapshot = {archetypes, fetchedAt: new Date().toISOString()};
    try { localStorage.setItem(cacheKey(key), JSON.stringify(snapshot)); } catch { /* Storage may be disabled. */ }
    render(archetypes);
    status.textContent = `Retrieved ${timestamp(snapshot)} · Proxy data may be cached`;
  } catch (error) {
    if (activeRequest !== controller) return;
    status.textContent = cached
      ? `Could not refresh · Showing saved data retrieved ${timestamp(cached)}`
      : `Could not load data. Tap Refresh to retry, or open ${config.name} below.`;
    console.warn(`${config.name} refresh failed:`, error);
  } finally {
    clearTimeout(timer);
    if (activeRequest === controller) rows.closest('table').setAttribute('aria-busy', 'false');
  }
}

// Table row positioning varies between browsers; handle clicks on every cell
// explicitly while keeping the real link for keyboard and context-menu access.
function openRow(event) {
  if (event.defaultPrevented || event.target.closest('a, button') ||
      (event.type === 'click' ? event.button !== 0 : event.button !== 1) ||
      !window.getSelection().isCollapsed) return;
  const link = event.target.closest('tr')?.querySelector('.deck-link');
  if (!link) return;
  if (event.button === 1 || event.ctrlKey || event.metaKey || event.shiftKey) {
    event.preventDefault();
    window.open(link.href, '_blank', 'noopener');
  } else {
    link.click();
  }
}

rows.addEventListener('click', openRow);
rows.addEventListener('auxclick', openRow);
rows.addEventListener('click', event => {
  const button = event.target.closest('.favorite-toggle');
  if (!button) return;
  const deck = currentItems.find(item => favoriteKey(item) === button.dataset.favoriteKey);
  if (!deck) return;
  const key = favoriteKey(deck);
  if (favorites.has(key)) favorites.delete(key); else favorites.add(key);
  saveFavorites();
  render(currentItems);
});
favoritesOnly.addEventListener('change', () => render(currentItems));
function selectFormat() {
  activeRequest?.abort();
  activeRequest = undefined;
  const requestedFormat = location.hash.slice(1);
  activeFormat = Object.hasOwn(FORMATS, requestedFormat) ? requestedFormat : 'pauper';
  favorites = readFavorites();
  favoritesOnly.checked = false;
  const config = formatConfig();
  document.title = `${config.label} · Mobile Meta`;
  document.querySelector('#eyebrow').textContent = `THE ${config.label.toUpperCase()} METAGAME`;
  document.querySelector('#subtitle').textContent = config.goldfish
    ? `The most played ${activeFormat === 'pauper-gf' ? 'Pauper' : config.label} archetypes, at a glance.` : 'The most played archetypes, at a glance.';
  period.hidden = Boolean(config.goldfish);
  for (const tab of document.querySelectorAll('.format-tab')) {
    const selected = tab.dataset.format === activeFormat;
    tab.classList.toggle('is-active', selected);
    tab.setAttribute('aria-pressed', String(selected));
  }
  for (const link of document.querySelectorAll('#source-link, #footer-source')) {
    link.href = config.source + (config.goldfish ? `${config.path}#paper` : '/');
    link.textContent = `${link.id === 'source-link' ? 'Visit ' : ''}${config.name} ↗`;
  }
  load();
}
document.querySelectorAll('.format-tab').forEach(tab => tab.addEventListener('click', () => {
  const hash = `#${tab.dataset.format}`;
  if (location.hash === hash) selectFormat(); else location.hash = hash;
}));
window.addEventListener('hashchange', selectFormat);
period.addEventListener('change', load);
refresh.addEventListener('click', load);
selectFormat();
