// Home page: booking widget, fleet tabs, testimonials slider.
// Needs common.js and cars-data.js loaded first.

// ===== Booking widget -> WhatsApp enquiry =====
(function () {
  const form = document.getElementById('bookingForm');
  if (!form) return;
  const pickup = form.elements.pickup, ret = form.elements.ret;
  const iso = d => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const today = iso(new Date());
  pickup.min = today; ret.min = today;
  pickup.addEventListener('change', () => {
    ret.min = pickup.value || today;
    if (ret.value && ret.value < pickup.value) ret.value = pickup.value;
  });

  const fmt = v => new Date(v + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  const days = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000) + 1;

  form.addEventListener('submit', e => {
    e.preventDefault();
    let ok = true;
    ['location', 'pickup'].forEach(n => {
      const bad = !form.elements[n].value;
      form.elements[n].closest('.bfield').classList.toggle('invalid', bad);
      if (bad && ok) { form.elements[n].focus(); ok = false; }
    });
    if (!ok) { toast('Please choose a pickup location and date.'); return; }

    const v = n => form.elements[n].value;
    const lines = ['Hello Perfect Hand Integrated Services, I would like to book a vehicle.',
      `Location: ${v('location')}`,
      `Vehicle: ${form.elements.vehicle.selectedOptions[0].text}`,
      `Service: ${form.elements.service.selectedOptions[0].text}`,
      `Pickup: ${fmt(v('pickup'))}`];
    if (v('ret')) lines.push(`Return: ${fmt(v('ret'))} (${days(v('pickup'), v('ret'))} day${days(v('pickup'), v('ret')) === 1 ? '' : 's'})`);
    lines.push('Please confirm availability and price.');
    const text = lines.join('\n');

    logEnquiry({
      source: 'booking-form', location: v('location'),
      vehicle: form.elements.vehicle.selectedOptions[0].text,
      service: form.elements.service.selectedOptions[0].text,
      pickup: v('pickup') || null, return_date: v('ret') || null, message: text
    });

    if (!WHATSAPP_NUMBER && navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => toast('Your booking details are copied. Paste them into the WhatsApp chat.'), () => {});
    }
    window.open(waLink(text), '_blank', 'noopener');
  });

  form.querySelectorAll('select, input').forEach(el => el.addEventListener('input', () => el.closest('.bfield').classList.remove('invalid')));

  document.getElementById('browseLink').addEventListener('click', e => {
    e.preventDefault();
    const q = new URLSearchParams();
    if (form.elements.location.value) q.set('location', form.elements.location.value);
    if (form.elements.vehicle.value) q.set('cat', form.elements.vehicle.value);
    location.href = 'car-listing.html' + (q.toString() ? '?' + q : '');
  });
})();

// ===== Fleet tabs (built from the real categories) =====
carsReady.then(function () {
  const grid = document.getElementById('carGrid');
  const tabsEl = document.getElementById('carTabs');
  const used = CATEGORIES.filter(c => cars.some(x => carCats(x).includes(c.slug)));

  // Booking form: vehicle choices follow the categories too
  const vSel = document.getElementById('vehicle');
  if (vSel) vSel.innerHTML = '<option value="">Any vehicle</option>' + used.map(c => `<option value="${esc(c.slug)}">${esc(c.name)}</option>`).join('');

  if (!used.length) { tabsEl.hidden = true; grid.innerHTML = '<p class="no-results">Our fleet is being updated. Please message us on WhatsApp for available cars.</p>'; return; }
  tabsEl.innerHTML = used.slice(0, 6).map((c, i) =>
    `<button class="tab${i ? '' : ' active'}" data-filter="${esc(c.slug)}" role="tab" aria-selected="${!i}"${i ? ' tabindex="-1"' : ''}>${esc(c.name)}</button>`).join('');
  const tabs = [...tabsEl.querySelectorAll('.tab')];
  function show(filter) {
    grid.innerHTML = cars.filter(c => carCats(c).includes(filter)).slice(0, 6).map(cardHTML).join('');
    grid.setAttribute('aria-labelledby', 'tab-' + filter);
  }
  tabs.forEach((tab, i) => {
    tab.id = 'tab-' + tab.dataset.filter;
    tab.addEventListener('click', () => select(tab));
    tab.addEventListener('keydown', e => {
      const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (d) { const n = tabs[(i + d + tabs.length) % tabs.length]; n.focus(); select(n); }
    });
  });
  function select(tab) {
    tabs.forEach(t => { t.classList.toggle('active', t === tab); t.setAttribute('aria-selected', t === tab); t.tabIndex = t === tab ? 0 : -1; });
    show(tab.dataset.filter);
  }
  select(tabs[0]);
});

// ===== Testimonials slider (can be rebuilt after the testimonials load from the dashboard) =====
const homeSlider = (function () {
  const slider = document.getElementById('slider');
  if (!slider) return { rebuild() {} };
  const dotsWrap = document.getElementById('dots');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let slides = [], dots = [], index = 0, timer;

  function go(i) {
    index = (i + slides.length) % slides.length;
    slides.forEach((s, n) => { s.classList.toggle('active', n === index); s.setAttribute('aria-hidden', n !== index); });
    dots.forEach((d, n) => d.classList.toggle('active', n === index));
  }
  function restart() { clearInterval(timer); if (!reduce && slides.length > 1) timer = setInterval(() => go(index + 1), 6500); }

  function rebuild() {
    slides = [...slider.querySelectorAll('.slide')];
    dotsWrap.innerHTML = '';
    slides.forEach((_, i) => {
      const d = document.createElement('button');
      d.type = 'button'; d.className = 'dot';
      d.setAttribute('aria-label', `Show testimonial ${i + 1}`);
      d.addEventListener('click', () => { go(i); restart(); });
      dotsWrap.appendChild(d);
    });
    dots = [...dotsWrap.children];
    slider.querySelector('.slider-nav').hidden = slides.length < 2;
    go(0); restart();
  }

  document.getElementById('prevSlide').addEventListener('click', () => { go(index - 1); restart(); });
  document.getElementById('nextSlide').addEventListener('click', () => { go(index + 1); restart(); });
  slider.addEventListener('mouseenter', () => clearInterval(timer));
  slider.addEventListener('mouseleave', restart);
  rebuild();
  return { rebuild };
})();

// ===== Content managed in the dashboard: locations, testimonials, FAQs =====
// Each part only replaces what is on the page when the dashboard has data for it.
siteReady.then(function () {
  const d = siteData;

  // Locations: booking dropdown, city cards and the "cities" figure
  if (d.locations && d.locations.length) {
    const sel = document.getElementById('location');
    if (sel) sel.innerHTML = '<option value="">Select a location</option>' + d.locations.map(l => `<option>${esc(l.name)}</option>`).join('');
    const grid = document.querySelector('.city-grid');
    if (grid) {
      const photo = l => l.image_path ? storageUrl(l.image_path) : (l.legacy_img ? 'images/' + l.legacy_img : GENERIC_PLACEHOLDER);
      grid.innerHTML = d.locations.map(l => {
        const tag = l.page ? 'a' : 'div', href = l.page ? ` href="${esc(l.page)}"` : '';
        return `<${tag} class="city"${href}><img src="${esc(photo(l))}" alt="${esc(l.name)}" loading="lazy"><div class="city-info"><h3 style="color:#fff;margin:0;font-size:1.1rem">${esc(l.name)}</h3>${l.trips ? `<span>${esc(l.trips)}</span>` : ''}</div></${tag}>`;
      }).join('');
    }
    document.querySelectorAll('.trust-item').forEach(t => {
      if (/cities/i.test(t.textContent)) t.querySelector('strong').textContent = d.locations.length;
    });
  }

  // Testimonials
  if (d.testimonials) {
    const section = document.querySelector('.testimonials');
    if (!d.testimonials.length) { if (section) section.hidden = true; }
    else {
      document.querySelector('#slider .slides').innerHTML = d.testimonials.map((t, i) =>
        `<blockquote class="slide${i ? '' : ' active'}"><p>${esc(t.quote)}</p><cite>${esc(t.name)}</cite></blockquote>`).join('');
      homeSlider.rebuild();
    }
  }

  // FAQs
  if (d.faqs) {
    const section = document.querySelector('.faq');
    const acc = document.getElementById('accordion');
    if (!d.faqs.length) { if (section) section.hidden = true; }
    else if (acc) {
      acc.innerHTML = d.faqs.map(f =>
        `<div class="acc-item"><button class="acc-q" aria-expanded="false">${esc(f.question)}</button><div class="acc-a"><p>${richText(f.answer)}</p></div></div>`).join('');
      initAccordion(acc, 'home');
    }
  }
});
