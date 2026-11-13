const SOURCE = 'https://pauperpilot.com';
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
const FAVORITES_KEY = 'pauper-meta-favorites-v1';
function readFavorites() {
  try {
    const saved = JSON.parse(localStorage.getItem(FAVORITES_KEY));
    return new Set(Array.isArray(saved) ? saved.filter(value => typeof value === 'string') : []);
  } catch { return new Set(); }
}
const favorites = readFavorites();
function saveFavorites() {
  try { localStorage.setItem(FAVORITES_KEY, JSON.stringify([...favorites])); } catch { /* Storage may be disabled. */ }
}
function favoriteKey(deck) { return deck.name.trim().toLocaleLowerCase(); }

function archetypeURL(href) {
  const url = new URL(href, SOURCE);
  if (url.origin !== SOURCE || !/^\/(?:7d\/|90d\/|bnr\/|set\/)?archetypes\/[^/]+\/$/.test(url.pathname) || url.search || url.hash) {
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
  rows.replaceChildren(...visibleItems.map(deck => {
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
    price.textContent = deck.price === null ? '—' : `${deck.incompletePrice ? '≥ ' : ''}${money.format(deck.price)}`;
    tr.append(favoriteCell, colors, name, share, decks, price);
    return tr;
  }));
}

function readCache(key) {
  try {
    const cached = JSON.parse(localStorage.getItem(`pauper-meta-v2:${key}`));
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
  const cached = readCache(key);
  const timestamp = snapshot => new Date(snapshot.fetchedAt).toLocaleString();
  if (cached) render(cached.archetypes);
  else {
    rows.replaceChildren();
    document.querySelector('#count').textContent = '';
  }
  status.textContent = cached ? 'Showing saved data · Checking for updates…' : 'Loading PauperPilot via AllOrigins…';
  rows.closest('table').setAttribute('aria-busy', 'true');
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetch(PROXY + encodeURIComponent(SOURCE + ROUTES[key]), {
      signal: controller.signal, credentials: 'omit'
    });
    if (!response.ok) throw new Error(`Proxy returned ${response.status}`);
    const archetypes = parseTable(await response.text());
    if (activeRequest !== controller) return;
    const snapshot = {archetypes, fetchedAt: new Date().toISOString()};
    try { localStorage.setItem(`pauper-meta-v2:${key}`, JSON.stringify(snapshot)); } catch { /* Storage may be disabled. */ }
    render(archetypes);
    status.textContent = `Retrieved ${timestamp(snapshot)} · Proxy data may be cached`;
  } catch (error) {
    if (activeRequest !== controller) return;
    status.textContent = cached
      ? `Could not refresh · Showing saved data retrieved ${timestamp(cached)}`
      : 'Could not load data through AllOrigins. Tap Refresh to retry, or open PauperPilot below.';
    console.warn('PauperPilot refresh failed:', error);
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
period.addEventListener('change', load);
refresh.addEventListener('click', load);
load();
