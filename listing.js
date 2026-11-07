// Car listing, category and city pages: search, filters, sorting, pagination.
// Needs common.js and cars-data.js loaded first.
carsReady.then(function () {
  const PER_PAGE = 12;
  const $ = id => document.getElementById(id);
  const grid = $('carGrid'), showing = $('showing'), pagination = $('pagination'), noResults = $('noResults');
  const sortEl = $('sort'), filters = $('filters');
  const preset = document.body.dataset.category || null;   // set on suvs.html, sedan.html ...
  const params = new URLSearchParams(location.search);
  const hasPrices = cars.some(c => c.price);
  const countIn = k => cars.filter(c => carCats(c).includes(k)).length;
  let page = 1;

  // --- Tidy the sidebar to match the real fleet ---
  // No price slider. Sorting by price only appears once at least one car has a price.
  if (!hasPrices) sortEl.closest('.sort').hidden = true;
  // 2. Build the category boxes from the real categories (only ones that have cars).
  const usedCats = CATEGORIES.filter(c => countIn(c.slug));
  const catBlock = document.querySelector('input[name="cat"]')?.closest('.filter-block');
  if (catBlock) {
    catBlock.querySelectorAll('label.check').forEach(l => l.remove());
    catBlock.insertAdjacentHTML('beforeend', usedCats.map(c =>
      `<label class="check"><input type="checkbox" name="cat" value="${esc(c.slug)}"> ${esc(c.name)}</label>`).join(''));
  }

  // --- Search box + category chips ---
  const bar = document.querySelector('.results-bar');
  bar.insertAdjacentHTML('beforeend',
    '<div class="search-box"><label class="sr-only" for="q">Search vehicles</label><input type="search" id="q" placeholder="Search e.g. Prado, Lexus, Hilux" autocomplete="off"></div>');
  const qEl = $('q');
  qEl.value = params.get('q') || '';

  const PAGE_FOR = { suvs: 'suvs.html', sedan: 'sedan.html', hilux: 'hilux.html', bulletproof: 'bullet-proof.html', busses: 'busses.html' };
  const CHIPS = [['All', null, 'car-listing.html'],
    ...usedCats.map(c => [c.name, c.slug, PAGE_FOR[c.slug] || 'car-listing.html?cat=' + encodeURIComponent(c.slug)])];
  const chipRow = document.createElement('div');
  chipRow.className = 'chip-row'; chipRow.setAttribute('role', 'group'); chipRow.setAttribute('aria-label', 'Vehicle type');
  const isCategoryPage = !!preset;
  chipRow.innerHTML = CHIPS.map(([label, key, href]) => isCategoryPage
    ? `<a class="chip${(key === preset || (!key && false)) ? ' active' : ''}" href="${href}">${label}</a>`
    : `<button type="button" class="chip" data-key="${key || ''}">${label}</button>`).join('');
  bar.insertAdjacentElement('afterend', chipRow);

  function checked(name) { return [...document.querySelectorAll(`input[name="${name}"]:checked`)].map(i => i.value); }
  function syncChips() {
    if (isCategoryPage) return;
    const cats = checked('cat');
    chipRow.querySelectorAll('.chip').forEach(ch => {
      const k = ch.dataset.key;
      ch.classList.toggle('active', k ? (cats.length === 1 && cats[0] === k) : cats.length === 0);
    });
  }
  chipRow.addEventListener('click', e => {
    const ch = e.target.closest('button.chip'); if (!ch) return;
    document.querySelectorAll('input[name="cat"]').forEach(i => (i.checked = ch.dataset.key && i.value === ch.dataset.key));
    page = 1; render();
  });
  // ?cat=suvs in the link pre-selects a category
  const urlCat = params.get('cat');
  if (urlCat && !preset) document.querySelectorAll('input[name="cat"]').forEach(i => (i.checked = i.value === urlCat));

  function getFiltered() {
    const cats = checked('cat');
    const caps = checked('cap').map(Number);
    const maxSeats = caps.length ? Math.max(...caps) : null;   // "1-7" = up to 7 seats
    const q = qEl.value.trim().toLowerCase();
    let list = cars.filter(c => {
      const ck = carCats(c);
      if (preset && !ck.includes(preset)) return false;
      if (cats.length && !cats.some(k => ck.includes(k))) return false;
      if (maxSeats !== null && c.seats > maxSeats) return false;
      if (q && !(c.name + ' ' + c.year + ' ' + c.fuel + ' ' + carLabel(c)).toLowerCase().includes(q)) return false;
      return true;
    });
    const dir = sortEl.value;
    if (dir && hasPrices) {
      list = [...list].sort((a, b) => {
        const pa = a.price ?? (dir === 'asc' ? Infinity : -Infinity);
        const pb = b.price ?? (dir === 'asc' ? Infinity : -Infinity);
        return dir === 'asc' ? pa - pb : pb - pa;
      });
    }
    return list;
  }

  function render() {
    const list = getFiltered();
    const pages = Math.max(1, Math.ceil(list.length / PER_PAGE));
    if (page > pages) page = pages;
    grid.innerHTML = list.slice((page - 1) * PER_PAGE, page * PER_PAGE).map(cardHTML).join('');
    noResults.hidden = list.length > 0;
    showing.textContent = `${list.length} vehicle${list.length === 1 ? '' : 's'}` + (pages > 1 ? ` · page ${page} of ${pages}` : '');
    syncChips();

    pagination.innerHTML = '';
    if (pages > 1) {
      const mk = (label, target, opts = {}) => {
        const b = document.createElement('button');
        b.type = 'button'; b.innerHTML = label;
        b.className = 'page-btn' + (opts.active ? ' active' : '');
        b.disabled = !!opts.disabled;
        if (opts.aria) b.setAttribute('aria-label', opts.aria);
        if (opts.active) b.setAttribute('aria-current', 'page');
        b.addEventListener('click', () => { page = target; render(); grid.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
        pagination.appendChild(b);
      };
      mk('&lsaquo;', page - 1, { disabled: page === 1, aria: 'Previous page' });
      for (let i = 1; i <= pages; i++) mk(i, i, { active: i === page, aria: `Page ${i}` });
      mk('&rsaquo;', page + 1, { disabled: page === pages, aria: 'Next page' });
    }
  }

  function reset() {
    document.querySelectorAll('.filters input[type="checkbox"]').forEach(i => (i.checked = false));
    sortEl.value = ''; qEl.value = ''; page = 1; render();
  }

  document.querySelectorAll('.filters input[type="checkbox"]').forEach(i => i.addEventListener('change', () => { page = 1; render(); }));
  sortEl.addEventListener('change', () => { page = 1; render(); });
  qEl.addEventListener('input', () => { page = 1; render(); });
  $('resetFilters').addEventListener('click', reset);

  // Mobile filter drawer
  const closeDrawer = () => filters.classList.remove('open');
  $('filterOpen').addEventListener('click', () => filters.classList.add('open'));
  $('filterClose').addEventListener('click', closeDrawer);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDrawer(); });

  // Pickup location chosen on the home page (?location=Lagos), or set on a city page
  const loc = params.get('location') || document.body.dataset.location;
  if (loc) { const chip = $('locationChip'); chip.textContent = 'Pickup location: ' + loc; chip.hidden = false; }

  render();
});
