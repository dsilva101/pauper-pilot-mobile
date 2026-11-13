const SOURCE = 'https://pauperpilot.com';
const PROXY = 'https://api.allorigins.win/raw?url=';
const ROUTES = {'30d': '/', '7d': '/7d/', '90d': '/90d/', bnr: '/bnr/', set: '/set/'};
const status = document.querySelector('#status');
const rows = document.querySelector('#rows');
const period = document.querySelector('#period');
const refresh = document.querySelector('#refresh');
const money = new Intl.NumberFormat('en-IE', {style: 'currency', currency: 'EUR'});
let activeRequest;

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
        (item.price !== null && (!Number.isFinite(item.price) || item.price < 0))) {
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
    items.push({
      name: row.dataset.name || link.textContent.trim(),
      href: archetypeURL(link.getAttribute('href')),
      share: row.dataset.share?.trim() ? Number(row.dataset.share) : NaN,
      price: row.dataset.price?.trim() ? Number(row.dataset.price) : null,
      incompletePrice: /≥/.test(row.textContent)
    });
  }
  return validate(items);
}

function render(items) {
  rows.replaceChildren(...items.map((deck, index) => {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 3;
    const link = document.createElement('a');
    link.className = 'deck-link';
    link.href = archetypeURL(deck.href);
    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = `${index + 1}. ${deck.name}`;
    const share = document.createElement('span');
    share.className = 'share';
    share.textContent = `${deck.share.toFixed(1)}%`;
    const price = document.createElement('span');
    price.className = 'price';
    price.textContent = deck.price === null ? '—' : `${deck.incompletePrice ? '≥ ' : ''}${money.format(deck.price)}`;
    link.append(name, share, price);
    td.append(link);
    tr.append(td);
    return tr;
  }));
}

function readCache(key) {
  try {
    const cached = JSON.parse(localStorage.getItem(`pauper-meta-v1:${key}`));
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
  else rows.replaceChildren();
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
    try { localStorage.setItem(`pauper-meta-v1:${key}`, JSON.stringify(snapshot)); } catch { /* Storage may be disabled. */ }
    render(archetypes);
    status.textContent = `${archetypes.length} archetypes · Retrieved ${timestamp(snapshot)} · Proxy data may be cached`;
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

period.addEventListener('change', load);
refresh.addEventListener('click', load);
load();
