// ===== Car data + card renderer (used by the home, listing, category, city and details pages) =====
// The cars normally come from your Supabase database (managed in admin.html).
// STATIC_CARS below is the built-in backup list: it is used until Supabase is set up, and
// whenever Supabase cannot be reached, so the site never shows an empty fleet.
// Needs common.js and supabase-config.js loaded first.
const ICONS = {
  type: 'images/icons/car-parts-01.svg',
  fuel: 'images/icons/car-parts-03.svg',
  year: 'images/icons/car-parts-05.svg',
  seats: 'images/icons/car-parts-06.svg'
};

const STATIC_CATEGORIES = [
  { slug: 'suvs',        name: 'SUVs',         label: 'SUV' },
  { slug: 'sedan',       name: 'Sedan',        label: 'Sedan' },
  { slug: 'hilux',       name: 'Hilux',        label: 'Pickup' },
  { slug: 'busses',      name: 'Busses',       label: 'Bus' },
  { slug: 'bulletproof', name: 'Bullet Proof', label: 'Bullet proof' }
];

const STATIC_CARS = [
  { id: 28, name: 'Toyota Land Cruiser 2023',        img: 'thumb_1702378332-122921.webp', cat: 'suvs',             fuel: 'Petrol', year: 2023, seats: 7, price: null },
  { id: 29, name: 'Toyota Land Cruiser 2022',        img: 'thumb_1722866732-389697.webp', cat: 'suvs',             fuel: 'Petrol', year: 2021, seats: 8, price: null },
  { id: 30, name: 'Toyota Land Cruiser 2020',        img: 'thumb_1701940466-706866.webp', cat: 'suvs',             fuel: 'Petrol', year: 2020, seats: 8, price: null },
  { id: 31, name: 'Toyota Land Cruiser Prado 2021',  img: 'thumb_1702378758-153143.webp', cat: 'suvs',             fuel: 'Petrol', year: 2021, seats: 7, price: null },
  { id: 32, name: 'Toyota Land Cruiser Prado 2020',  img: 'thumb_1701866149-352307.webp', cat: 'suvs bulletproof', fuel: 'Petrol', year: 2020, seats: 7, price: null },
  { id: 33, name: 'Toyota Land Cruiser Prado 2015',  img: 'thumb_1701866261-519171.webp', cat: 'suvs',             fuel: 'Petrol', year: 2015, seats: 8, price: null },
  { id: 34, name: 'Lexus LX 570 2020',               img: 'thumb_1703012391-297301.webp', cat: 'suvs bulletproof', fuel: 'Petrol', year: 2020, seats: 7, price: null },
  { id: 35, name: 'Lexus GX 460 2020',               img: 'thumb_1701866420-589562.webp', cat: 'suvs',             fuel: 'Petrol', year: 2020, seats: 6, price: null },
  { id: 39, name: 'Lexus ES 350 2010',               img: 'thumb_1702831179-995546.webp', cat: 'sedan',            fuel: 'Petrol', year: 2010, seats: 4, price: null },
  { id: 40, name: 'Toyota Camry Spider 2010',        img: 'thumb_1702831211-702320.webp', cat: 'sedan',            fuel: 'Petrol', year: 2010, seats: 4, price: null },
  { id: 36, name: 'Toyota Hilux 2020',               img: 'thumb_1701873269-527773.webp', cat: 'hilux',            fuel: 'Diesel', year: 2020, seats: 5, price: null },
  { id: 38, name: 'Toyota Hilux 2015',               img: 'thumb_1701873228-635560.webp', cat: 'hilux',            fuel: 'Diesel', year: 2015, seats: 5, price: null }
];

let cars = STATIC_CARS;
let CATEGORIES = STATIC_CATEGORIES;

// ---- Load cars + categories from Supabase (falls back to cache, then to the built-in list) ----
const CACHE_KEY = 'xc_cars_v2';
function storageUrl(path) { return `${SUPABASE_URL}/storage/v1/object/public/car-images/${path}`; }
function fromRow(r) {
  return {
    id: r.id, name: r.name, cat: (r.categories || []).join(' '), fuel: r.fuel || 'Petrol',
    year: r.year, seats: r.seats, price: r.price != null ? Number(r.price) : null,
    img: r.legacy_img || '',
    thumbUrl: r.thumb_path ? storageUrl(r.thumb_path) : null,
    fullUrl: r.image_path ? storageUrl(r.image_path) : null,
    priceSelf: r.price_self_drive != null ? Number(r.price_self_drive) : null,
    features: r.features || [],
    galleryUrls: (r.gallery || []).map(storageUrl)
  };
}
const carsReady = (async () => {
  if (!SUPABASE_URL || !SUPABASE_KEY) return;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 7000);
  try {
    const opts = { headers: { apikey: SUPABASE_KEY }, signal: ctl.signal };
    const [rc, rk] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/cars?select=*&visible=eq.true&order=sort_order.asc,id.asc`, opts),
      fetch(`${SUPABASE_URL}/rest/v1/categories?select=*&order=sort_order.asc,name.asc`, opts)
    ]);
    if (!rc.ok || !rk.ok) throw new Error('Supabase answered ' + rc.status + '/' + rk.status);
    cars = (await rc.json()).map(fromRow);
    CATEGORIES = await rk.json();
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ u: SUPABASE_URL, cars, CATEGORIES })); } catch (e) {}
  } catch (err) {
    console.warn('Could not load cars from Supabase, using the saved copy.', err);
    try {
      const c = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
      if (c && c.u === SUPABASE_URL) { cars = c.cars; CATEGORIES = c.CATEGORIES; }
    } catch (e) {}
  } finally { clearTimeout(timer); }
  await window.siteReady;   // settings (WhatsApp number) are applied before any car button is drawn
})();

function carCats(c) { return c.cat ? c.cat.split(' ') : []; }
function carLabel(c) {
  for (const k of carCats(c)) {
    const cat = CATEGORIES.find(x => x.slug === k);
    if (cat && k !== 'bulletproof') return cat.label || cat.name;
  }
  return 'Car';
}
function carEnquiry(c) { return `Hello Perfect Hand Integrated Services, I would like to rent the ${c.name}. Please confirm availability and price.`; }
function esc(s) { return String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch])); }
function carThumb(c) { return c.thumbUrl || ('images/cars/' + c.img); }
function carFull(c) { return c.fullUrl || ('images/cars/' + c.img.replace('thumb_', '')); }

function cardHTML(c) {
  const link = `car-details.html?id=${c.id}`;
  const msg = carEnquiry(c);
  const self = c.priceSelf ? `<p class="car-quote">Self-drive &#8358;${c.priceSelf.toLocaleString()} / day</p>` : '';
  const price = c.price
    ? `<p class="car-price">&#8358;${c.price.toLocaleString()} <small>/ day</small></p>${self}`
    : (self || `<p class="car-quote">Price on request</p>`);
  const bp = carCats(c).includes('bulletproof') ? '<span class="badge badge-gold">Bullet proof</span>' : '';
  return `
    <article class="car-card">
      <a class="car-img" href="${link}" aria-label="View ${esc(c.name)}">
        <span class="badges"><span class="badge">${carLabel(c)}</span>${bp}</span>
        <img src="${esc(carThumb(c))}" alt="${esc(c.name)}" width="550" height="401" loading="lazy">
      </a>
      <div class="car-body">
        <h3><a href="${link}">${esc(c.name)}</a></h3>
        ${price}
        <ul class="car-specs">
          <li><img src="${ICONS.type}" alt="" width="20" height="20">Automatic</li>
          <li><img src="${ICONS.fuel}" alt="" width="20" height="20">${c.fuel}</li>
          <li><img src="${ICONS.year}" alt="" width="20" height="20">${c.year}</li>
          <li><img src="${ICONS.seats}" alt="" width="20" height="20">${c.seats} seats</li>
        </ul>
        <div class="car-actions">
          <a href="${link}" class="btn btn-outline btn-sm">Details</a>
          <a href="${waLink(msg)}" data-wa="${esc(msg)}" data-enq-id="${c.id}" data-enq-name="${esc(c.name)}" class="btn btn-gold btn-sm" target="_blank" rel="noopener">Book now</a>
        </div>
      </div>
    </article>`;
}
