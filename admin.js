// Admin dashboard: cars, categories, enquiries, stats, locations, testimonials, FAQs, settings. Talks straight to your Supabase project.
// Login = Supabase Auth (single admin). What you may change is enforced by the database
// rules in supabase/setup.sql, not by this page, so a visitor cannot bypass it.
(function () {
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const SESSION_KEY = 'xc_admin_session';
  const BUCKET = 'car-images';

  const views = { setup: $('viewSetup'), login: $('viewLogin'), app: $('viewApp') };
  function show(name) { Object.entries(views).forEach(([k, el]) => (el.hidden = k !== name)); }

  if (!SUPABASE_URL || !SUPABASE_KEY) { show('setup'); return; }

  // ---------------------------------------------------------------- session + API
  let session = null;
  try { session = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); } catch (e) {}
  const saveSession = s => {
    session = s;
    try { s ? localStorage.setItem(SESSION_KEY, JSON.stringify(s)) : localStorage.removeItem(SESSION_KEY); } catch (e) {}
  };
  const toSession = d => ({
    access_token: d.access_token, refresh_token: d.refresh_token,
    expires_at: d.expires_at || Math.floor(Date.now() / 1000) + (d.expires_in || 3600),
    email: d.user && d.user.email
  });

  async function errorFrom(res) {
    let d = {};
    try { d = await res.json(); } catch (e) {}
    const msg = d.message || d.msg || d.error_description || d.error || ('Request failed (' + res.status + ')');
    const err = new Error(msg); err.status = res.status; err.code = d.code; return err;
  }

  async function refresh() {
    if (!session || !session.refresh_token) throw new Error('Please log in again.');
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST', headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: session.refresh_token })
    });
    if (!res.ok) { saveSession(null); throw new Error('Your session expired. Please log in again.'); }
    saveSession(Object.assign(toSession(await res.json()), { email: session.email }));
  }

  // One place for every request: adds the keys, renews the login if it is about to expire.
  async function api(path, opts = {}) {
    if (!session) throw new Error('Please log in again.');
    if (session.expires_at - 60 < Date.now() / 1000) await refresh();
    const send = () => fetch(SUPABASE_URL + path, {
      method: opts.method || 'GET',
      headers: Object.assign({ apikey: SUPABASE_KEY, Authorization: 'Bearer ' + session.access_token }, opts.headers || {}),
      body: opts.body
    });
    let res = await send();
    if (res.status === 401) { await refresh(); res = await send(); }
    if (!res.ok) throw await errorFrom(res);
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  }
  const rest = (path, method, obj, prefer) => api('/rest/v1/' + path, {
    method, body: obj === undefined ? undefined : JSON.stringify(obj),
    headers: Object.assign({ 'Content-Type': 'application/json' }, prefer ? { Prefer: prefer } : {})
  });

  function friendly(err) {
    if (err.status === 403 || err.code === '42501') return 'This account is not allowed to change data. Check that the email in setup.sql matches the one you logged in with.';
    if (err.code === 'PGRST204' || /schema cache|does not exist|Could not find/i.test(err.message)) return 'Your database needs the upgrade. In Supabase open SQL Editor, paste supabase/upgrade.sql and press Run, then refresh this page.';
    if (/Failed to fetch|NetworkError/i.test(err.message)) return 'Could not reach Supabase. Check your internet connection and try again.';
    return err.message;
  }

  // ---------------------------------------------------------------- login / logout
  $('loginForm').addEventListener('submit', async e => {
    e.preventDefault();
    const msg = $('loginMsg'), btn = $('loginBtn');
    msg.textContent = '';
    if (!$('email').value || !$('password').value) { msg.textContent = 'Enter your email and password.'; return; }
    btn.disabled = true; btn.textContent = 'Logging in...';
    try {
      const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: 'POST', headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: $('email').value.trim(), password: $('password').value })
      });
      if (!res.ok) { const er = await errorFrom(res); throw new Error(/invalid/i.test(er.message) ? 'Wrong email or password.' : er.message); }
      saveSession(toSession(await res.json()));
      $('password').value = '';
      await start();
    } catch (err) { msg.textContent = friendly(err); }
    btn.disabled = false; btn.textContent = 'Log in';
  });

  $('logoutBtn').addEventListener('click', async () => {
    try { await api('/auth/v1/logout', { method: 'POST' }); } catch (e) {}
    saveSession(null); show('login');
  });

  // ---------------------------------------------------------------- state + loading
  let cars = [], cats = [];
  const appMsg = t => { $('appMsg').textContent = t || ''; };

  async function load() {
    [cars, cats] = await Promise.all([
      rest('cars?select=*&order=sort_order.asc,id.asc', 'GET'),
      rest('categories?select=*&order=sort_order.asc,name.asc', 'GET')
    ]);
    renderCars(); renderCats();
  }

  async function start() {
    appMsg('');
    try {
      await load();
      show('app');
      loadExtra();
    } catch (err) {
      if (/log in again|expired/i.test(err.message)) { show('login'); $('loginMsg').textContent = err.message; }
      else { show('app'); appMsg(friendly(err)); }
    }
  }

  // ---------------------------------------------------------------- helpers
  const photoUrl = (c, thumb) => {
    const p = thumb ? c.thumb_path : c.image_path;
    if (p) return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${p}`;
    return c.legacy_img ? 'images/cars/' + (thumb ? c.legacy_img : c.legacy_img.replace('thumb_', '')) : '';
  };
  const pubUrl = p => `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${p}`;
  const catName = slug => (cats.find(c => c.slug === slug) || { name: slug }).name;
  const slugify = s => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const nextOrder = list => list.reduce((m, x) => Math.max(m, x.sort_order || 0), 0) + 10;
  function busy(btn, on, label) { btn.disabled = on; if (label) btn.textContent = on ? label.busy : label.idle; }

  // ---------------------------------------------------------------- cars list
  function renderCars() {
    const shown = cars.filter(c => c.visible).length;
    $('carsSummary').textContent = cars.length ? `${cars.length} car${cars.length === 1 ? '' : 's'}, ${shown} showing on the website` : '';
    const box = $('carsList');
    if (!cars.length) { box.innerHTML = '<div class="empty-box">No cars yet. Click <strong>+ Add a car</strong> to add your first one.</div>'; return; }
    box.innerHTML = cars.map((c, i) => {
      const catChips = (c.categories || []).map(s => `<span class="chip-s">${esc(catName(s))}</span>`).join('') || '<span class="chip-s warn">No category</span>';
      const price = c.price != null ? '&#8358;' + Number(c.price).toLocaleString() + ' / day' : 'Price on request';
      const img = photoUrl(c, true);
      return `<article class="row-card${c.visible ? '' : ' is-hidden'}" data-id="${c.id}">
        <div class="row-thumb">${img ? `<img src="${esc(img)}" alt="" loading="lazy">` : ''}</div>
        <div>
          <p class="row-title">${esc(c.name)}${c.visible ? '' : ' <span class="chip-s warn">Hidden</span>'}</p>
          <p class="row-meta">${esc(c.year)} &middot; ${esc(c.seats)} seats &middot; ${esc(c.fuel)} &middot; ${price}</p>
          <div class="chips">${catChips}</div>
        </div>
        <div class="row-actions">
          <label class="switch" title="Show on website"><input type="checkbox" data-act="toggle" ${c.visible ? 'checked' : ''} aria-label="Show ${esc(c.name)} on the website"><span></span></label>
          <button class="icon-btn" data-act="up" ${i === 0 ? 'disabled' : ''} aria-label="Move up" title="Move up">&uarr;</button>
          <button class="icon-btn" data-act="down" ${i === cars.length - 1 ? 'disabled' : ''} aria-label="Move down" title="Move down">&darr;</button>
          <button class="btn btn-outline btn-sm" data-act="edit">Edit</button>
          <button class="btn btn-outline btn-sm btn-danger" data-act="delete">Delete</button>
        </div>
      </article>`;
    }).join('');
  }

  $('carsList').addEventListener('click', async e => {
    const btn = e.target.closest('[data-act]'); if (!btn) return;
    const card = btn.closest('[data-id]'); const car = cars.find(c => String(c.id) === card.dataset.id);
    const act = btn.dataset.act; appMsg('');
    try {
      if (act === 'edit') openCar(car);
      else if (act === 'toggle') { await rest(`cars?id=eq.${car.id}`, 'PATCH', { visible: btn.checked }); car.visible = btn.checked; renderCars(); }
      else if (act === 'up' || act === 'down') await move(car, act === 'up' ? -1 : 1);
      else if (act === 'delete') await removeCar(car);
    } catch (err) { appMsg(friendly(err)); await load().catch(() => {}); }
  });

  // Re-number everything 10, 20, 30... so moving is always exact
  async function move(car, dir) {
    const i = cars.indexOf(car), j = i + dir;
    if (j < 0 || j >= cars.length) return;
    const list = cars.slice(); list.splice(i, 1); list.splice(j, 0, car);
    const changes = [];
    list.forEach((c, n) => { const o = (n + 1) * 10; if (c.sort_order !== o) { changes.push(rest(`cars?id=eq.${c.id}`, 'PATCH', { sort_order: o })); c.sort_order = o; } });
    await Promise.all(changes);
    cars = list; renderCars();
  }

  async function removeCar(car) {
    if (!confirm(`Delete "${car.name}" permanently?\n\nTo remove it from the website but keep it, use the switch instead.`)) return;
    await rest(`cars?id=eq.${car.id}`, 'DELETE');
    await deletePhotos([car.image_path, car.thumb_path, ...(car.gallery || [])]);
    await load();
  }

  async function deletePhotos(paths) {
    const prefixes = paths.filter(Boolean);
    if (!prefixes.length) return;
    try { await api(`/storage/v1/object/${BUCKET}`, { method: 'DELETE', body: JSON.stringify({ prefixes }), headers: { 'Content-Type': 'application/json' } }); } catch (e) { /* leftover file is harmless */ }
  }

  // ---------------------------------------------------------------- car form
  const carDlg = $('carDialog'), carForm = $('carForm');
  let editing = null, pickedFile = null, galleryKeep = [];

  function renderGalleryCur() {
    $('galleryCur').innerHTML = galleryKeep.map((p, i) =>
      `<span class="gcur"><img src="${esc(pubUrl(p))}" alt=""><button type="button" data-rm="${i}" aria-label="Remove this photo">&times;</button></span>`).join('');
  }
  $('galleryCur').addEventListener('click', e => {
    const b = e.target.closest('[data-rm]'); if (!b) return;
    galleryKeep.splice(Number(b.dataset.rm), 1); renderGalleryCur();
  });

  function setPreview(src) { $('photoPreview').innerHTML = src ? `<img src="${esc(src)}" alt="Photo preview">` : '<span>No photo</span>'; }

  function openCar(car) {
    editing = car || null; pickedFile = null; $('carMsg').textContent = '';
    $('carDialogTitle').textContent = car ? 'Edit car' : 'Add a car';
    $('fName').value = car ? car.name : '';
    $('fYear').value = car ? car.year : new Date().getFullYear();
    $('fSeats').value = car ? car.seats : 5;
    $('fFuel').value = car ? car.fuel : 'Petrol';
    $('fPrice').value = car && car.price != null ? car.price : '';
    $('fOrder').value = car ? car.sort_order : nextOrder(cars);
    $('fPriceSelf').value = car && car.price_self_drive != null ? car.price_self_drive : '';
    $('fFeatures').value = car ? (car.features || []).join('\n') : '';
    galleryKeep = car ? (car.gallery || []).slice() : []; renderGalleryCur(); $('fGallery').value = '';
    $('fVisible').checked = car ? car.visible : true;
    $('fPhoto').value = '';
    $('photoReq').hidden = !!(car && photoUrl(car));
    setPreview(car ? photoUrl(car, false) : '');
    $('fCats').innerHTML = cats.length
      ? cats.map(c => `<label><input type="checkbox" value="${esc(c.slug)}" ${car && (car.categories || []).includes(c.slug) ? 'checked' : ''}> ${esc(c.name)}</label>`).join('')
      : '<span class="muted">Create a category first (Categories tab).</span>';
    carDlg.showModal();
    $('fName').focus();
  }
  $('addCarBtn').addEventListener('click', () => { if (!cats.length) { appMsg('Create at least one category first (Categories tab).'); return; } openCar(null); });

  $('fPhoto').addEventListener('change', () => {
    const f = $('fPhoto').files[0]; $('carMsg').textContent = '';
    if (!f) { pickedFile = null; setPreview(editing ? photoUrl(editing, false) : ''); return; }
    if (!/^image\/(png|jpeg|webp)$/.test(f.type)) { $('carMsg').textContent = 'Please choose a PNG, JPG or WebP image.'; $('fPhoto').value = ''; return; }
    if (f.size > 15 * 1024 * 1024) { $('carMsg').textContent = 'That image is over 15 MB. Please choose a smaller one.'; $('fPhoto').value = ''; return; }
    pickedFile = f; setPreview(URL.createObjectURL(f));
  });

  // Shrink the photo in the browser: one for the details page, a smaller one for cards.
  async function resize(file, maxW) {
    let bmp;
    if (window.createImageBitmap) bmp = await createImageBitmap(file);
    else bmp = await new Promise((ok, no) => { const im = new Image(); im.onload = () => ok(im); im.onerror = no; im.src = URL.createObjectURL(file); });
    const w = bmp.width || bmp.naturalWidth, h = bmp.height || bmp.naturalHeight;
    const scale = Math.min(1, maxW / w);
    const c = document.createElement('canvas'); c.width = Math.round(w * scale); c.height = Math.round(h * scale);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise(r => c.toBlob(r, 'image/webp', 0.85));
    if (!blob) throw new Error('Could not process that image. Try a different file.');
    return blob;
  }
  async function upload(path, blob) {
    await api(`/storage/v1/object/${BUCKET}/${path}`, { method: 'POST', body: blob, headers: { 'Content-Type': blob.type || 'image/webp', 'x-upsert': 'true', 'cache-control': 'max-age=31536000' } });
  }
  const extOf = blob => (blob.type === 'image/webp' ? 'webp' : blob.type === 'image/png' ? 'png' : 'jpg');

  carForm.addEventListener('submit', async e => {
    e.preventDefault();
    const msg = $('carMsg'), btn = $('carSaveBtn'); msg.textContent = '';
    const name = $('fName').value.trim(), year = Number($('fYear').value), seats = Number($('fSeats').value);
    const chosen = [...$('fCats').querySelectorAll('input:checked')].map(i => i.value);
    const priceTxt = $('fPrice').value.trim();
    if (!name) return void (msg.textContent = 'Enter the car name.');
    if (!year || year < 1990) return void (msg.textContent = 'Enter a valid year.');
    if (!seats || seats < 1) return void (msg.textContent = 'Enter the number of seats.');
    if (!chosen.length) return void (msg.textContent = 'Pick at least one category.');
    if (priceTxt !== '' && (isNaN(Number(priceTxt)) || Number(priceTxt) < 0)) return void (msg.textContent = 'Price must be a number, or empty.');
    if (!editing && !pickedFile) return void (msg.textContent = 'Please add a photo of the car.');
    const selfTxt = $('fPriceSelf').value.trim();
    if (selfTxt !== '' && (isNaN(Number(selfTxt)) || Number(selfTxt) < 0)) return void (msg.textContent = 'Self-drive price must be a number, or empty.');
    const galleryFiles = [...$('fGallery').files];
    if (galleryFiles.some(f => !/^image\/(png|jpeg|webp)$/.test(f.type))) return void (msg.textContent = 'More photos must be PNG, JPG or WebP images.');
    if (galleryFiles.some(f => f.size > 15 * 1024 * 1024)) return void (msg.textContent = 'One of the extra photos is over 15 MB.');
    if (galleryKeep.length + galleryFiles.length > 8) return void (msg.textContent = 'You can have at most 8 extra photos. Remove some first.');

    const row = {
      name, year, seats, fuel: $('fFuel').value, price: priceTxt === '' ? null : Number(priceTxt),
      categories: chosen, visible: $('fVisible').checked, sort_order: Number($('fOrder').value) || nextOrder(cars),
      price_self_drive: selfTxt === '' ? null : Number(selfTxt),
      features: $('fFeatures').value.split('\n').map(x => x.trim()).filter(Boolean).slice(0, 20)
    };
    const L = { busy: 'Saving...', idle: 'Save car' };
    busy(btn, true, L);
    const oldPaths = editing ? [editing.image_path, editing.thumb_path] : [];
    const newPaths = [];
    try {
      if (pickedFile) {
        const [full, thumb] = await Promise.all([resize(pickedFile, 900), resize(pickedFile, 480)]);
        const stamp = Date.now() + '-' + Math.random().toString(36).slice(2, 7);
        row.image_path = `cars/${stamp}.${extOf(full)}`; row.thumb_path = `cars/thumb_${stamp}.${extOf(thumb)}`;
        await upload(row.image_path, full); newPaths.push(row.image_path);
        await upload(row.thumb_path, thumb); newPaths.push(row.thumb_path);
      }
      const gallery = galleryKeep.slice();
      for (const [i, f] of galleryFiles.entries()) {
        const blob = await resize(f, 900);
        const path = `cars/g-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}.${extOf(blob)}`;
        await upload(path, blob); newPaths.push(path); gallery.push(path);
      }
      row.gallery = gallery;
      if (editing) await rest(`cars?id=eq.${editing.id}`, 'PATCH', row);
      else await rest('cars', 'POST', row, 'return=minimal');
      const stale = [];
      if (pickedFile && editing) stale.push(...oldPaths);
      if (editing) stale.push(...(editing.gallery || []).filter(p => !gallery.includes(p)));
      if (stale.length) await deletePhotos(stale);
      carDlg.close();
      await load();
    } catch (err) {
      await deletePhotos(newPaths);        // do not leave orphan uploads behind
      msg.textContent = friendly(err);
    }
    busy(btn, false, L);
  });

  // ---------------------------------------------------------------- categories
  function renderCats() {
    const box = $('catsList');
    if (!cats.length) { box.innerHTML = '<div class="empty-box">No categories yet. Click <strong>+ Add a category</strong>.</div>'; return; }
    box.innerHTML = cats.map(c => {
      const n = cars.filter(x => (x.categories || []).includes(c.slug)).length;
      return `<article class="row-card is-cat" data-slug="${esc(c.slug)}">
        <div>
          <p class="row-title">${esc(c.name)}</p>
          <p class="row-meta">${n} car${n === 1 ? '' : 's'} &middot; badge: ${esc(c.label || c.name)} &middot; id: ${esc(c.slug)}</p>
        </div>
        <div class="row-actions">
          <button class="btn btn-outline btn-sm" data-act="edit">Edit</button>
          <button class="btn btn-outline btn-sm btn-danger" data-act="delete">Delete</button>
        </div>
      </article>`;
    }).join('');
  }

  const catDlg = $('catDialog'), catForm = $('catForm');
  let editingCat = null;
  function openCat(cat) {
    editingCat = cat || null; $('catMsg').textContent = '';
    $('catDialogTitle').textContent = cat ? 'Edit category' : 'Add a category';
    $('cName').value = cat ? cat.name : ''; $('cLabel').value = cat ? (cat.label || '') : '';
    $('cOrder').value = cat ? cat.sort_order : nextOrder(cats);
    catDlg.showModal(); $('cName').focus();
  }
  $('addCatBtn').addEventListener('click', () => openCat(null));

  $('catsList').addEventListener('click', async e => {
    const btn = e.target.closest('[data-act]'); if (!btn) return;
    const cat = cats.find(c => c.slug === btn.closest('[data-slug]').dataset.slug); appMsg('');
    if (btn.dataset.act === 'edit') return openCat(cat);
    const n = cars.filter(x => (x.categories || []).includes(cat.slug)).length;
    if (n) { appMsg(`"${cat.name}" is used by ${n} car${n === 1 ? '' : 's'}. Remove it from those cars first (or move them to another category), then delete it.`); return; }
    if (!confirm(`Delete the category "${cat.name}"?`)) return;
    try { await rest(`categories?slug=eq.${encodeURIComponent(cat.slug)}`, 'DELETE'); await load(); } catch (err) { appMsg(friendly(err)); }
  });

  catForm.addEventListener('submit', async e => {
    e.preventDefault();
    const msg = $('catMsg'), btn = $('catSaveBtn'); msg.textContent = '';
    const name = $('cName').value.trim();
    if (!name) return void (msg.textContent = 'Enter a name.');
    const row = { name, label: $('cLabel').value.trim() || null, sort_order: Number($('cOrder').value) || nextOrder(cats) };
    const L = { busy: 'Saving...', idle: 'Save' }; busy(btn, true, L);
    try {
      if (editingCat) await rest(`categories?slug=eq.${encodeURIComponent(editingCat.slug)}`, 'PATCH', row);
      else {
        const slug = slugify(name);
        if (!slug) throw new Error('Please use letters or numbers in the name.');
        if (cats.some(c => c.slug === slug)) throw new Error('A category with that name already exists.');
        await rest('categories', 'POST', Object.assign({ slug }, row), 'return=minimal');
      }
      catDlg.close(); await load();
    } catch (err) { msg.textContent = friendly(err); }
    busy(btn, false, L);
  });

  // ---------------------------------------------------------------- tabs + dialogs
  function activate(name) {
    document.querySelectorAll('.admin-tab').forEach(x => x.classList.toggle('active', x.dataset.tab === name));
    document.querySelectorAll('[data-pane]').forEach(p => { p.hidden = p.dataset.pane !== name; });
    appMsg('');
  }
  document.querySelectorAll('.admin-tab').forEach(t => t.addEventListener('click', () => activate(t.dataset.tab)));
  document.querySelectorAll('dialog [data-close]').forEach(b => b.addEventListener('click', () => b.closest('dialog').close()));
  document.querySelectorAll('dialog').forEach(d => d.addEventListener('mousedown', e => { if (e.target === d) d.close(); }));

  // ---------------------------------------------------------------- extra data
  const UPGRADE_NOTE = '<div class="empty-box">This part needs the database upgrade. In Supabase open <strong>SQL Editor</strong>, paste the contents of <code>supabase/upgrade.sql</code>, press <strong>Run</strong>, then refresh this page.</div>';
  const ents = { locations: null, testimonials: null, faqs: null };
  let enqs = null, settingsMap = null;

  async function loadExtra() {
    const get = async path => { try { return await rest(path, 'GET'); } catch (e) { return null; } };
    const [lo, te, fa, se, eq] = await Promise.all([
      get('locations?select=*&order=sort_order.asc,id.asc'),
      get('testimonials?select=*&order=sort_order.asc,id.asc'),
      get('faqs?select=*&order=sort_order.asc,id.asc'),
      get('settings?select=key,value'),
      get('enquiries?select=*&order=created_at.desc&limit=1000')
    ]);
    ents.locations = lo; ents.testimonials = te; ents.faqs = fa;
    settingsMap = se ? Object.fromEntries(se.map(r => [r.key, r.value])) : null;
    enqs = eq;
    Object.keys(ents).forEach(renderEnt);
    fillSettings(); renderEnq(); renderStats();
  }

  // ---------------------------------------------------------------- locations / testimonials / FAQs (one shared editor)
  const ENT = {
    locations: {
      noun: 'location',
      fields: [
        { k: 'name', l: 'City name', req: 1, ph: 'e.g. Port Harcourt' },
        { k: 'trips', l: 'Trips label', ph: 'e.g. 8015+ Trips', hint: 'Shown on the city card. Leave empty to hide it.' },
        { k: 'page', l: 'Page link', ph: 'e.g. lagos.html', hint: 'Optional. The page the city card opens.' },
        { k: 'photo', t: 'file', l: 'City photo', hint: 'Optional. A landscape photo works best.' },
        { k: 'sort_order', t: 'number', l: 'Position', hint: 'Smaller numbers show first.' },
        { k: 'visible', t: 'check', l: 'Show on the website' }
      ],
      line: r => [r.name, [r.trips, r.page].filter(Boolean).join(' \u00b7 ')]
    },
    testimonials: {
      noun: 'testimonial',
      fields: [
        { k: 'name', l: 'Customer name', req: 1, ph: 'e.g. Amadi P' },
        { k: 'quote', t: 'area', l: 'What they said', req: 1 },
        { k: 'sort_order', t: 'number', l: 'Position', hint: 'Smaller numbers show first.' },
        { k: 'visible', t: 'check', l: 'Show on the website' }
      ],
      line: r => [r.name, r.quote]
    },
    faqs: {
      noun: 'question',
      fields: [
        { k: 'question', l: 'Question', req: 1 },
        { k: 'answer', t: 'area', l: 'Answer', req: 1, hint: 'Plain text. To add a link, write [link text](page.html) or [link text](https://...).' },
        { k: 'sort_order', t: 'number', l: 'Position', hint: 'Smaller numbers show first.' },
        { k: 'visible', t: 'check', l: 'Show on the website' }
      ],
      line: r => [r.question, r.answer]
    }
  };

  function renderEnt(name) {
    const box = document.querySelector(`[data-list="${name}"]`), rows = ents[name], cfg = ENT[name];
    if (rows === null) { box.innerHTML = UPGRADE_NOTE; return; }
    if (!rows.length) { box.innerHTML = `<div class="empty-box">Nothing here yet. Use the button above to add a ${cfg.noun}.</div>`; return; }
    box.innerHTML = rows.map((r, i) => {
      const [title, meta] = cfg.line(r);
      return `<article class="row-card is-cat${r.visible ? '' : ' is-hidden'}" data-id="${r.id}">
        <div>
          <p class="row-title">${esc(title)}${r.visible ? '' : ' <span class="chip-s warn">Hidden</span>'}</p>
          <p class="row-meta clamp">${esc(meta)}</p>
        </div>
        <div class="row-actions">
          <label class="switch" title="Show on website"><input type="checkbox" data-act="toggle" ${r.visible ? 'checked' : ''} aria-label="Show on the website"><span></span></label>
          <button class="icon-btn" data-act="up" ${i === 0 ? 'disabled' : ''} aria-label="Move up">&uarr;</button>
          <button class="icon-btn" data-act="down" ${i === rows.length - 1 ? 'disabled' : ''} aria-label="Move down">&darr;</button>
          <button class="btn btn-outline btn-sm" data-act="edit">Edit</button>
          <button class="btn btn-outline btn-sm btn-danger" data-act="delete">Delete</button>
        </div>
      </article>`;
    }).join('');
  }

  async function reloadEnt(name) {
    try { ents[name] = await rest(`${name}?select=*&order=sort_order.asc,id.asc`, 'GET'); } catch (e) { ents[name] = null; }
    renderEnt(name);
  }

  document.querySelectorAll('[data-list]').forEach(box => box.addEventListener('click', async e => {
    const btn = e.target.closest('[data-act]'); if (!btn) return;
    const name = box.dataset.list, rows = ents[name];
    const row = rows.find(r => String(r.id) === btn.closest('[data-id]').dataset.id); appMsg('');
    try {
      if (btn.dataset.act === 'edit') openEnt(name, row);
      else if (btn.dataset.act === 'toggle') { await rest(`${name}?id=eq.${row.id}`, 'PATCH', { visible: btn.checked }); row.visible = btn.checked; renderEnt(name); }
      else if (btn.dataset.act === 'up' || btn.dataset.act === 'down') {
        const i = rows.indexOf(row), j = i + (btn.dataset.act === 'up' ? -1 : 1);
        if (j < 0 || j >= rows.length) return;
        const list = rows.slice(); list.splice(i, 1); list.splice(j, 0, row);
        await Promise.all(list.map((r, n) => { const o = (n + 1) * 10; if (r.sort_order === o) return null; r.sort_order = o; return rest(`${name}?id=eq.${r.id}`, 'PATCH', { sort_order: o }); }).filter(Boolean));
        ents[name] = list; renderEnt(name);
      }
      else if (btn.dataset.act === 'delete') {
        if (!confirm('Delete this ' + ENT[name].noun + ' permanently?\n\nTo hide it but keep it, use the switch instead.')) return;
        await rest(`${name}?id=eq.${row.id}`, 'DELETE');
        if (row.image_path) await deletePhotos([row.image_path]);
        await reloadEnt(name);
      }
    } catch (err) { appMsg(friendly(err)); await reloadEnt(name); }
  }));
  document.querySelectorAll('[data-add]').forEach(b => b.addEventListener('click', () => {
    if (ents[b.dataset.add] === null) { appMsg('Run supabase/upgrade.sql first (see the notice on this tab).'); return; }
    openEnt(b.dataset.add, null);
  }));

  const entDlg = $('entDialog'), entForm = $('entForm');
  let entName = null, entRow = null;
  function openEnt(name, row) {
    entName = name; entRow = row; const cfg = ENT[name];
    $('entTitle').textContent = (row ? 'Edit ' : 'Add a ') + cfg.noun;
    const rows = ents[name];
    $('entBody').innerHTML = cfg.fields.map(f => {
      const id = 'ef_' + f.k, v = row ? row[f.k] : (f.k === 'sort_order' ? nextOrder(rows) : f.k === 'visible' ? true : '');
      const hint = f.hint ? `<small class="muted">${esc(f.hint)}</small>` : '';
      if (f.t === 'check') return `<label class="switch-row"><input type="checkbox" id="${id}" ${v ? 'checked' : ''}> <span>${esc(f.l)}</span></label>`;
      if (f.t === 'area') return `<div class="field"><label for="${id}">${esc(f.l)}${f.req ? ' <span class="req">*</span>' : ''}</label><textarea id="${id}" rows="4">${esc(v ?? '')}</textarea>${hint}</div>`;
      if (f.t === 'file') {
        const cur = row && (row.image_path ? pubUrl(row.image_path) : row.legacy_img ? 'images/' + row.legacy_img : '');
        return `<div class="field"><label for="${id}">${esc(f.l)}</label><div class="photo-row"><div class="photo-preview" id="entPrev">${cur ? `<img src="${esc(cur)}" alt="">` : '<span>No photo</span>'}</div><div><input id="${id}" type="file" accept="image/png,image/jpeg,image/webp">${hint}</div></div></div>`;
      }
      return `<div class="field"><label for="${id}">${esc(f.l)}${f.req ? ' <span class="req">*</span>' : ''}</label><input id="${id}" type="${f.t === 'number' ? 'number' : 'text'}" ${f.t === 'number' ? 'min="0" step="10"' : ''} value="${esc(v ?? '')}" placeholder="${esc(f.ph || '')}">${hint}</div>`;
    }).join('') + '<p class="form-msg err" id="entMsg" role="alert"></p>';
    const file = $('ef_photo');
    if (file) file.addEventListener('change', () => { const f = file.files[0]; if (f) $('entPrev').innerHTML = `<img src="${esc(URL.createObjectURL(f))}" alt="Preview">`; });
    entDlg.showModal();
    const first = $('entBody').querySelector('input, textarea'); if (first) first.focus();
  }

  entForm.addEventListener('submit', async e => {
    e.preventDefault();
    const cfg = ENT[entName], msg = $('entMsg'), btn = $('entSave'); msg.textContent = '';
    const out = {}; let file = null;
    for (const f of cfg.fields) {
      const el = $('ef_' + f.k);
      if (f.t === 'check') out[f.k] = el.checked;
      else if (f.t === 'file') file = el.files[0] || null;
      else if (f.t === 'number') out[f.k] = Number(el.value) || nextOrder(ents[entName]);
      else { out[f.k] = el.value.trim(); if (f.req && !out[f.k]) return void (msg.textContent = `Please fill in: ${f.l}.`); if (!out[f.k] && !f.req) out[f.k] = null; }
    }
    if (file && !/^image\/(png|jpeg|webp)$/.test(file.type)) return void (msg.textContent = 'Please choose a PNG, JPG or WebP image.');
    if (file && file.size > 15 * 1024 * 1024) return void (msg.textContent = 'That image is over 15 MB.');
    const L = { busy: 'Saving...', idle: 'Save' }; busy(btn, true, L);
    let newPath = null;
    try {
      if (file) {
        const blob = await resize(file, 900);
        newPath = `locations/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${extOf(blob)}`;
        await upload(newPath, blob); out.image_path = newPath;
      }
      if (entRow) await rest(`${entName}?id=eq.${entRow.id}`, 'PATCH', out);
      else await rest(entName, 'POST', out, 'return=minimal');
      if (newPath && entRow && entRow.image_path) await deletePhotos([entRow.image_path]);
      entDlg.close(); await reloadEnt(entName);
    } catch (err) { if (newPath) await deletePhotos([newPath]); msg.textContent = friendly(err); }
    busy(btn, false, L);
  });

  // ---------------------------------------------------------------- enquiries
  const STATUS = { new: 'New', followed_up: 'Followed up', booked: 'Booked', not_interested: 'Not interested' };
  const fmtWhen = iso => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const fmtDay = v => v ? new Date(v + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '';

  function renderEnq() {
    const box = $('enqList');
    if (enqs === null) { box.innerHTML = UPGRADE_NOTE; $('enqBadge').hidden = true; return; }
    const fresh = enqs.filter(x => x.status === 'new').length;
    $('enqBadge').hidden = !fresh; $('enqBadge').textContent = fresh;
    const f = $('enqFilter').value, rows = f ? enqs.filter(x => x.status === f) : enqs;
    if (!rows.length) { box.innerHTML = `<div class="empty-box">${enqs.length ? 'No enquiries with that status.' : 'No enquiries yet. They appear here when visitors use the booking form or tap Book now on a car.'}</div>`; return; }
    box.innerHTML = rows.map(x => {
      const isCar = x.source === 'car';
      const title = isCar ? x.car_name : [x.location, x.vehicle].filter(Boolean).join(' \u00b7 ') || 'Booking form';
      const dates = x.pickup ? `Pickup ${fmtDay(x.pickup)}${x.return_date ? ' to ' + fmtDay(x.return_date) : ''}` : '';
      const meta = [fmtWhen(x.created_at), isCar ? 'Book now on a car' : 'Booking form', x.service, dates].filter(Boolean).join(' \u00b7 ');
      return `<article class="row-card is-cat enq-row st-${esc(x.status)}" data-id="${x.id}">
        <div>
          <p class="row-title">${esc(title)}</p>
          <p class="row-meta">${esc(meta)}</p>
          <input class="enq-note" data-act="note" maxlength="2000" placeholder="Add a note (e.g. called back, customer name)" value="${esc(x.note || '')}" aria-label="Note">
        </div>
        <div class="row-actions">
          <select data-act="status" aria-label="Status">${Object.entries(STATUS).map(([k, l]) => `<option value="${k}"${x.status === k ? ' selected' : ''}>${l}</option>`).join('')}</select>
          <button class="btn btn-outline btn-sm btn-danger" data-act="delete">Delete</button>
        </div>
      </article>`;
    }).join('');
  }
  $('enqFilter').addEventListener('change', renderEnq);

  $('enqList').addEventListener('change', async e => {
    const el = e.target.closest('[data-act]'); if (!el || (el.dataset.act !== 'status' && el.dataset.act !== 'note')) return;
    const row = enqs.find(x => String(x.id) === el.closest('[data-id]').dataset.id); appMsg('');
    const patch = el.dataset.act === 'status' ? { status: el.value } : { note: el.value.trim() || null };
    try { await rest(`enquiries?id=eq.${row.id}`, 'PATCH', patch); Object.assign(row, patch); if (patch.status) { renderEnq(); renderStats(); } }
    catch (err) { appMsg(friendly(err)); }
  });
  $('enqList').addEventListener('click', async e => {
    const btn = e.target.closest('[data-act="delete"]'); if (!btn) return;
    const row = enqs.find(x => String(x.id) === btn.closest('[data-id]').dataset.id);
    if (!confirm('Delete this enquiry?')) return;
    try { await rest(`enquiries?id=eq.${row.id}`, 'DELETE'); enqs = enqs.filter(x => x !== row); renderEnq(); renderStats(); }
    catch (err) { appMsg(friendly(err)); }
  });

  $('enqCsv').addEventListener('click', () => {
    if (!enqs || !enqs.length) { appMsg('There are no enquiries to download yet.'); return; }
    const q = v => '"' + String(v ?? '').replace(/"/g, '""') + '"';
    const head = ['Date', 'Source', 'Location', 'Vehicle or car', 'Service', 'Pickup', 'Return', 'Status', 'Note', 'Message'];
    const lines = enqs.map(x => [x.created_at, x.source === 'car' ? 'Car Book now' : 'Booking form', x.location, x.source === 'car' ? x.car_name : x.vehicle, x.service, x.pickup, x.return_date, STATUS[x.status], x.note, x.message].map(q).join(','));
    const blob = new Blob(['\ufeff' + [head.map(q).join(','), ...lines].join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = 'xclusive-enquiries-' + new Date().toISOString().slice(0, 10) + '.csv'; document.body.appendChild(a); a.click(); a.remove();
  });

  // ---------------------------------------------------------------- stats
  function barList(title, pairs) {
    const top = pairs.sort((a, b) => b[1] - a[1]).slice(0, 6), max = top.length ? top[0][1] : 1;
    return `<div class="stat-card"><h3>${esc(title)}</h3>${top.length ? top.map(([l, n]) => `<div class="bar-row"><span class="bar-label">${esc(l)}</span><span class="bar-track"><span class="bar-fill" style="width:${Math.max(6, Math.round(n / max * 100))}%"></span></span><b>${n}</b></div>`).join('') : '<p class="muted">Nothing yet.</p>'}</div>`;
  }
  const tally = (list, fn) => { const m = {}; list.forEach(x => { const k = fn(x); if (k) m[k] = (m[k] || 0) + 1; }); return Object.entries(m); };

  function renderStats() {
    const body = $('statsBody');
    if (enqs === null) { body.innerHTML = UPGRADE_NOTE; return; }
    const days = Number($('statsRange').value), since = Date.now() - days * 86400000;
    const inR = enqs.filter(x => new Date(x.created_at).getTime() >= since);
    const booked = inR.filter(x => x.status === 'booked').length, waiting = enqs.filter(x => x.status === 'new').length;
    const forms = inR.filter(x => x.source !== 'car').length;
    $('statsNote').textContent = `Based on your latest ${enqs.length} logged enquiries. They show interest, not confirmed bookings.`;
    const buckets = {};
    for (let i = days - 1; i >= 0; i--) { const d = new Date(Date.now() - i * 86400000); buckets[d.toLocaleDateString('en-CA')] = 0; }
    inR.forEach(x => { const k = new Date(x.created_at).toLocaleDateString('en-CA'); if (k in buckets) buckets[k]++; });
    const vals = Object.values(buckets), peak = Math.max(1, ...vals);
    const bars = Object.entries(buckets).map(([d, n]) => `<span class="day" title="${esc(d)}: ${n}"><i style="height:${n ? Math.max(6, Math.round(n / peak * 100)) : 2}%"></i></span>`).join('');
    const carsShown = cars.filter(c => c.visible).length;
    body.innerHTML = `
      <div class="stat-grid">
        <div class="stat-card big"><span>Enquiries</span><b>${inR.length}</b><small>last ${days} days</small></div>
        <div class="stat-card big"><span>Booking form</span><b>${forms}</b><small>${inR.length - forms} from car Book now</small></div>
        <div class="stat-card big"><span>Marked booked</span><b>${booked}</b><small>${inR.length ? Math.round(booked / inR.length * 100) : 0}% of the period</small></div>
        <div class="stat-card big"><span>Waiting for follow-up</span><b>${waiting}</b><small>status New, all time</small></div>
      </div>
      <div class="stat-card"><h3>Enquiries per day</h3><div class="day-chart">${bars}</div><div class="day-axis"><small>${days} days ago</small><small>Today</small></div></div>
      <div class="stat-cols">
        ${barList('Most requested cars', tally(inR.filter(x => x.source === 'car'), x => x.car_name))}
        ${barList('Vehicle types in the booking form', tally(inR.filter(x => x.source !== 'car'), x => x.vehicle && x.vehicle !== 'Any vehicle' ? x.vehicle : ''))}
        ${barList('Pickup cities', tally(inR, x => x.location))}
        ${barList('Service type', tally(inR, x => x.service))}
      </div>
      <p class="muted">Fleet: ${cars.length} cars, ${carsShown} showing on the website.</p>`;
  }
  $('statsRange').addEventListener('change', renderStats);

  // ---------------------------------------------------------------- settings
  const PROMO_DEFAULTS = { promo_highlight: '10% off', promo_text: 'your next ride', promo_button: 'Claim it on WhatsApp', promo_message: 'Hello Xclusive Rent A Car, I would like to claim the 10% discount on my next ride.' };
  const sField = { whatsapp_number: 'sWa', phone: 'sPhone', promo_highlight: 'sPromoHi', promo_text: 'sPromoTxt', promo_button: 'sPromoBtn', promo_message: 'sPromoMsg' };
  function fillSettings() {
    const m = settingsMap || {};
    $('sWa').value = m.whatsapp_number ?? WHATSAPP_NUMBER;
    $('sPhone').value = m.phone ?? PHONE;
    $('sPromoOn').checked = m.promo_enabled !== 'false';
    ['promo_highlight', 'promo_text', 'promo_button', 'promo_message'].forEach(k => { $(sField[k]).value = m[k] ?? PROMO_DEFAULTS[k]; });
    waTest();
  }
  function waTest() { const n = $('sWa').value.replace(/\D/g, ''); $('sWaTest').href = n ? `https://wa.me/${n}?text=${encodeURIComponent('Test message from the Xclusive website')}` : '#'; }
  $('sWa').addEventListener('input', waTest);

  $('settingsForm').addEventListener('submit', async e => {
    e.preventDefault();
    const msg = $('settingsMsg'), btn = $('settingsSave'); msg.className = 'form-msg err'; msg.textContent = '';
    const wa = $('sWa').value.replace(/\D/g, ''), phone = $('sPhone').value.replace(/[^\d+]/g, '');
    if (wa && (wa.length < 10 || wa.length > 15)) return void (msg.textContent = 'The WhatsApp number should be 10 to 15 digits including the country code (e.g. 2349163910032).');
    if (phone && phone.replace(/\D/g, '').length < 7) return void (msg.textContent = 'That phone number looks too short.');
    $('sWa').value = wa; $('sPhone').value = phone;
    const rows = [
      { key: 'whatsapp_number', value: wa }, { key: 'phone', value: phone },
      { key: 'promo_enabled', value: $('sPromoOn').checked ? 'true' : 'false' },
      ...['promo_highlight', 'promo_text', 'promo_button', 'promo_message'].map(k => ({ key: k, value: $(sField[k]).value.trim() }))
    ];
    const L = { busy: 'Saving...', idle: 'Save settings' }; busy(btn, true, L);
    try {
      await rest('settings', 'POST', rows, 'resolution=merge-duplicates,return=minimal');
      settingsMap = Object.fromEntries(rows.map(r => [r.key, r.value]));
      msg.className = 'form-msg ok'; msg.textContent = 'Saved. The website now uses these details.';
    } catch (err) { msg.textContent = friendly(err); }
    busy(btn, false, L);
  });

  // ---------------------------------------------------------------- go
  if (session) start(); else show('login');
})();
