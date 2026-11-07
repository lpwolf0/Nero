// Shared behaviour for EVERY page: menu, header, FAQ, counters, scroll reveal,
// image fallbacks, WhatsApp helper, mobile call bar, toast.
// Load this first on every page.

// ---- Business settings (edit here) ---------------------------------------
const WHATSAPP = 'https://wa.me/message/PN4K63INSLYEI1';
// You can now change the WhatsApp number and phone from admin.html > Settings (no code needed).
// The values below are only the fallback used when Settings has not been saved yet.
// WhatsApp number: digits only, with country code, e.g. '2349163910032'. While it is empty the
// buttons open your WhatsApp link and copy the message to the clipboard.
let WHATSAPP_NUMBER = '';
let PHONE = '+2349163910032';

function waLink(text) {
  return WHATSAPP_NUMBER
    ? `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`
    : WHATSAPP;
}

function toast(msg) {
  let t = document.getElementById('toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast'; t.className = 'toast'; t.setAttribute('role', 'status');
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('show'), 4500);
}

// A link with data-wa="message" opens WhatsApp; without a number it copies the message first.
document.addEventListener('click', e => {
  const a = e.target.closest('a[data-wa]');
  if (!a || WHATSAPP_NUMBER) return;
  const text = a.getAttribute('data-wa');
  if (navigator.clipboard && window.isSecureContext !== false) {
    navigator.clipboard.writeText(text).then(
      () => toast('Your enquiry is copied. Paste it into the WhatsApp chat.'),
      () => {});
  }
});

// Keep every data-wa link in sync with WHATSAPP_NUMBER (so setting the number fixes them all at once)
function syncWaLinks() { document.querySelectorAll('a[data-wa]').forEach(a => { a.href = waLink(a.getAttribute('data-wa')); }); }
syncWaLinks();

// ---- Image fallbacks (a missing picture never leaves a broken icon) -------
const CAR_PLACEHOLDER = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 260"><rect width="400" height="260" fill="#eef2fa"/>' +
  '<path d="M60 170l22-52c4-9 12-14 22-14h192c10 0 18 5 22 14l22 52v32c0 6-4 10-10 10h-16a20 20 0 01-40 0H128a20 20 0 01-40 0H70c-6 0-10-4-10-10z" fill="#c4d0ea"/>' +
  '<circle cx="108" cy="204" r="18" fill="#0b3aa8"/><circle cx="292" cy="204" r="18" fill="#0b3aa8"/>' +
  '<path d="M100 120h200l12 32H88z" fill="#e6ecf8"/></svg>');
const GENERIC_PLACEHOLDER = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 3"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0b3aa8"/><stop offset="1" stop-color="#061a4d"/></linearGradient></defs><rect width="4" height="3" fill="url(#g)"/></svg>');

function imgFailed(img) {
  if (img.dataset.failed) return;
  img.dataset.failed = '1';
  const logo = img.closest('.logo');
  if (logo) { logo.classList.add('no-img'); img.remove(); return; }
  const hero = img.closest('.hero-card');
  if (hero) { hero.classList.add('no-img'); return; }
  if (img.closest('.car-img, .detail-gallery, .car-card, .about-img')) {
    img.src = CAR_PLACEHOLDER;
    img.closest('.car-img, .detail-gallery')?.classList.add('img-failed');
    return;
  }
  if (img.closest('.city, .city-hero-img')) { img.src = GENERIC_PLACEHOLDER; return; }
  img.style.visibility = 'hidden';
}
document.addEventListener('error', e => { if (e.target.tagName === 'IMG') imgFailed(e.target); }, true);
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('img').forEach(i => { if (i.complete && i.naturalWidth === 0 && i.getAttribute('src')) imgFailed(i); });
});

// ---- Mobile menu + sticky header ------------------------------------------
(function () {
  const toggle = document.getElementById('menuToggle');
  const nav = document.getElementById('mainNav');
  function setOpen(open) {
    nav.classList.toggle('open', open);
    toggle.classList.toggle('open', open);
    toggle.setAttribute('aria-expanded', open);
  }
  if (toggle && nav) {
    toggle.addEventListener('click', () => setOpen(!nav.classList.contains('open')));
    nav.addEventListener('click', e => { if (e.target.closest('a')) setOpen(false); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') setOpen(false); });
    document.addEventListener('click', e => { if (!e.target.closest('.site-header')) setOpen(false); });
  }
  const header = document.getElementById('header');
  if (header) {
    const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 10);
    window.addEventListener('scroll', onScroll, { passive: true }); onScroll();
  }
  const year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();
})();

// ---- FAQ accordion (works for every .accordion on the page; can be re-run after the FAQs are rebuilt) ----
function initAccordion(acc, a) {
  const buttons = acc.querySelectorAll('.acc-q');
  buttons.forEach((btn, i) => {
    const panel = btn.nextElementSibling;
    const id = `acc-${a}-${i}`;
    btn.id = id + '-btn'; panel.id = id;
    btn.setAttribute('aria-controls', id);
    panel.setAttribute('role', 'region'); panel.setAttribute('aria-labelledby', btn.id);
    btn.addEventListener('click', () => {
      const open = btn.getAttribute('aria-expanded') === 'true';
      buttons.forEach(b => { b.setAttribute('aria-expanded', 'false'); b.nextElementSibling.style.maxHeight = null; });
      if (!open) { btn.setAttribute('aria-expanded', 'true'); panel.style.maxHeight = panel.scrollHeight + 'px'; }
    });
  });
}
document.querySelectorAll('.accordion').forEach(initAccordion);

// ---- Counters (count up when scrolled into view) ---------------------------
(function () {
  const counters = document.querySelectorAll('.count');
  if (!counters.length) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const final = el => Number(el.dataset.target).toLocaleString() + (el.dataset.suffix || '');
  function run(el) {
    const target = Number(el.dataset.target), start = performance.now(), dur = 1600;
    (function tick(now) {
      const p = Math.min((now - start) / dur, 1), eased = 1 - Math.pow(1 - p, 3);
      el.textContent = p === 1 ? final(el) : Math.round(target * eased).toLocaleString();
      if (p < 1) requestAnimationFrame(tick);
    })(start);
  }
  if (reduce || !('IntersectionObserver' in window)) { counters.forEach(el => (el.textContent = final(el))); return; }
  const io = new IntersectionObserver((entries, obs) => {
    entries.forEach(e => { if (e.isIntersecting) { run(e.target); obs.unobserve(e.target); } });
  }, { threshold: .4 });
  counters.forEach(el => io.observe(el));
})();

// ---- Scroll reveal ----------------------------------------------------------
(function () {
  if (!('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const els = document.querySelectorAll('.step, .service, .care-card, .why-row, .stat, .split-card, .info-card, .city, .trust-item, .section-head, .why-list li, .booking-card, .partner-card');
  const io = new IntersectionObserver((entries, obs) => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); obs.unobserve(e.target); } });
  }, { threshold: .12, rootMargin: '0px 0px -40px 0px' });
  els.forEach((el, i) => { el.classList.add('reveal'); el.style.transitionDelay = (i % 4) * 70 + 'ms'; io.observe(el); });
})();

// ---- Mobile call / WhatsApp bar --------------------------------------------
(function () {
  const bar = document.createElement('div');
  bar.className = 'mobile-bar';
  bar.innerHTML =
    `<a class="btn btn-outline" href="tel:${PHONE}">Call us</a>` +
    `<a class="btn btn-wa" href="${waLink('Hello Xclusive Rent A Car, I would like to make an enquiry.')}" data-wa="Hello Xclusive Rent A Car, I would like to make an enquiry." target="_blank" rel="noopener">WhatsApp</a>`;
  document.body.appendChild(bar);
})();
