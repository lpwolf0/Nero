// Loads the details you manage in admin.html (settings, testimonials, FAQs, locations)
// and applies the settings on every page. Also records booking enquiries.
// Load after common.js and supabase-config.js. If Supabase is not set up or cannot be
// reached, nothing changes: every page keeps the content that is already in its HTML.
window.siteData = { settings: {}, testimonials: null, faqs: null, locations: null };
window.siteReady = Promise.resolve();
window.logEnquiry = function () {};

(function () {
  if (typeof SUPABASE_URL === 'undefined' || !SUPABASE_URL || !SUPABASE_KEY) return;

  const KEY = 'xc_site_v1';
  const escH = s => String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

  // ---------- settings -> every page ----------
  const fmtPhone = p => { const m = /^\+234(\d{3})(\d{3})(\d{4})$/.exec(p); return m ? `+234 ${m[1]} ${m[2]} ${m[3]}` : p; };
  function applySettings(s) {
    if (!s) return;
    const num = String(s.whatsapp_number || '').replace(/\D/g, '');
    if (num) WHATSAPP_NUMBER = num;

    const phone = String(s.phone || '').replace(/[^\d+]/g, '');
    if (phone) {
      PHONE = phone;
      document.querySelectorAll('a[href^="tel:"]').forEach(a => {
        const first = a.matches('.nav-phone, .mobile-bar a, .detail-cta a, .cta-actions a');
        if (!first) return;
        a.setAttribute('href', 'tel:' + phone);
        const span = a.querySelector('span');
        if (span) span.textContent = fmtPhone(phone);
        else if (a.matches('.cta-actions a')) a.textContent = 'Call ' + fmtPhone(phone);
      });
    }

    document.querySelectorAll('.promo-bar').forEach(bar => {
      if (s.promo_enabled === 'false') { bar.hidden = true; bar.style.display = 'none'; return; }
      const a = bar.querySelector('a'), strong = bar.querySelector('strong');
      if (!a || !strong) return;
      if (s.promo_highlight) strong.textContent = s.promo_highlight;
      if (s.promo_text || s.promo_highlight) {
        bar.textContent = '';
        bar.append(strong, ' ' + (s.promo_text || '') + ' \u00b7 ', a);
      }
      if (s.promo_button) a.textContent = s.promo_button;
      if (s.promo_message) a.setAttribute('data-wa', s.promo_message);
    });
    syncWaLinks();
  }

  // Use the last saved settings straight away so numbers are right before the fresh copy arrives
  try {
    const c = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (c && c.u === SUPABASE_URL) { siteData.settings = c.settings || {}; applySettings(siteData.settings); }
  } catch (e) {}

  // ---------- fetch everything ----------
  async function get(path, signal) {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: { apikey: SUPABASE_KEY }, signal });
      return res.ok ? await res.json() : null;      // null = not available (keep the page as it is)
    } catch (e) { return null; }
  }
  window.siteReady = (async () => {
    const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 6000);
    const [st, tm, fq, lc] = await Promise.all([
      get('settings?select=key,value', ctl.signal),
      get('testimonials?select=*&visible=eq.true&order=sort_order.asc,id.asc', ctl.signal),
      get('faqs?select=*&visible=eq.true&order=sort_order.asc,id.asc', ctl.signal),
      get('locations?select=*&visible=eq.true&order=sort_order.asc,id.asc', ctl.signal)
    ]);
    clearTimeout(timer);
    if (st) {
      const settings = {}; st.forEach(r => { settings[r.key] = r.value; });
      siteData.settings = settings;
      applySettings(settings);
      try { localStorage.setItem(KEY, JSON.stringify({ u: SUPABASE_URL, settings })); } catch (e) {}
    }
    siteData.testimonials = tm; siteData.faqs = fq; siteData.locations = lc;
  })();

  // ---------- enquiries log (no personal details, just what was asked for) ----------
  const recent = {};
  window.logEnquiry = function (e) {
    try {
      const body = JSON.stringify(Object.assign({ source: 'booking-form' }, e));
      if (recent[body] && Date.now() - recent[body] < 15000) return;   // ignore double clicks
      recent[body] = Date.now();
      fetch(`${SUPABASE_URL}/rest/v1/enquiries`, {
        method: 'POST', keepalive: true,
        headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body
      }).catch(() => {});
    } catch (err) {}
  };
  // "Book now" on a car card or details page
  document.addEventListener('click', ev => {
    const a = ev.target.closest('a[data-enq-name]');
    if (!a) return;
    logEnquiry({ source: 'car', car_id: Number(a.dataset.enqId) || null, car_name: a.dataset.enqName.slice(0, 160), message: (a.dataset.wa || '').slice(0, 1500) });
  });

  // Small helper other scripts use to show FAQ answers safely: plain text, line breaks, [text](link)
  window.richText = function (t) {
    return escH(t).replace(/\[([^\]]+)\]\(((?:https?:\/\/[^)\s]+)|(?:[\w\-]+\.html))\)/g, '<a href="$2">$1</a>').replace(/\n/g, '<br>');
  };
})();
