// Car details page: car-details.html?id=31
// Needs common.js and cars-data.js loaded first.
carsReady.then(function () {
  const root = document.getElementById('detail');
  const id = Number(new URLSearchParams(location.search).get('id'));
  const car = cars.find(c => c.id === id);

  if (!car) {
    document.title = 'Car not found | Perfect Hand Integrated Services';
    root.innerHTML = `
      <div class="not-found">
        <h2>Sorry, we couldn't find that car.</h2>
        <p>It may have been removed or the link may be wrong.</p>
        <a class="btn btn-gold" href="car-listing.html">View all vehicles</a>
      </div>`;
    document.getElementById('crumbName').textContent = 'Not found';
    return;
  }

  const cats = carCats(car);
  const typeWord = cats.includes('hilux') ? 'pickup truck' : cats.includes('sedan') ? 'sedan' : cats.includes('busses') ? 'bus' : cats.includes('suvs') ? 'SUV' : 'vehicle';
  const bulletproof = cats.includes('bulletproof');
  const full = carFull(car);
  const thumb = carThumb(car);
  const msg = carEnquiry(car);
  const price = (car.price && car.priceSelf)
    ? `<p class="detail-price">&#8358;${car.price.toLocaleString()} <small>per day with driver</small></p><p class="detail-price">&#8358;${car.priceSelf.toLocaleString()} <small>per day self-drive</small></p>`
    : car.price
      ? `<p class="detail-price">&#8358;${car.price.toLocaleString()} <small>per day</small></p>`
      : car.priceSelf
        ? `<p class="detail-price">&#8358;${car.priceSelf.toLocaleString()} <small>per day self-drive</small></p>`
        : `<p class="detail-price"><small>Price on request. Message us for a quote.</small></p>`;
  const photos = [full, ...(car.galleryUrls || [])];
  const thumbs = photos.length > 1
    ? `<div class="gallery-thumbs">${photos.map((u, i) => `<button type="button" class="gthumb${i ? '' : ' on'}" data-src="${esc(u)}" aria-label="Show photo ${i + 1}"><img src="${esc(u)}" alt="" loading="lazy"></button>`).join('')}</div>`
    : '';
  const feats = (car.features || []).length
    ? `<h3>Features</h3><ul class="included">${car.features.map(f => `<li>${esc(f)}</li>`).join('')}</ul>`
    : '';

  document.title = `${car.name} for Rent in Nigeria | Perfect Hand Integrated Services`;
  document.querySelector('meta[name="description"]').setAttribute('content',
    `Hire the ${car.name} from Perfect Hand Integrated Services. ${car.seats} seats, ${car.fuel.toLowerCase()}, automatic. Chauffeur-driven or self-drive. Book via WhatsApp today.`);
  document.getElementById('crumbName').textContent = car.name;
  document.getElementById('bannerTitle').textContent = car.name;

  // Up to 4 similar cars: same category first, then the rest
  const related = [...cars.filter(c => c.id !== car.id && cats.some(k => carCats(c).includes(k))),
                   ...cars.filter(c => c.id !== car.id && !cats.some(k => carCats(c).includes(k)))].slice(0, 4);

  root.innerHTML = `
    <div class="detail-main">
      <div class="detail-gallery">
        <span class="badges"><span class="badge">${carLabel(car)}</span>${bulletproof ? '<span class="badge badge-gold">Bullet proof</span>' : ''}</span>
        <img id="mainPhoto" src="${esc(full)}" alt="${esc(car.name)}" width="550" height="401" onerror="this.onerror=null;this.src='${esc(thumb)}'">
      </div>
      ${thumbs}
      <h2>${esc(car.name)}</h2>
      ${price}
      <ul class="spec-grid">
        <li><img src="${ICONS.fuel}" alt=""><span>Fuel</span><strong>${car.fuel}</strong></li>
        <li><img src="${ICONS.type}" alt=""><span>Transmission</span><strong>Automatic</strong></li>
        <li><img src="${ICONS.year}" alt=""><span>Model Year</span><strong>${car.year}</strong></li>
        <li><img src="${ICONS.seats}" alt=""><span>No of Seats</span><strong>${car.seats}</strong></li>
        <li><span class="spec-dot" aria-hidden="true">&#9737;</span><span>Bullet Proof</span><strong>${bulletproof ? 'Yes' : 'No'}</strong></li>
      </ul>

      <div class="detail-cta">
        <a href="${waLink(msg)}" data-wa="${esc(msg)}" data-enq-id="${car.id}" data-enq-name="${esc(car.name)}" class="btn btn-gold" target="_blank" rel="noopener">Book on WhatsApp</a>
        <a href="tel:${PHONE}" class="btn btn-outline">Call us</a>
      </div>

      <h3>Description of Listing</h3>
      <p>The ${esc(car.name)} is a ${car.year} ${typeWord} with an automatic transmission, ${car.fuel.toLowerCase()} engine and seating for ${car.seats} passengers${bulletproof ? ', and it is available as a bullet proof vehicle' : ''}.</p>
      <p>Hire it with a professional driver, or ask about our <a href="self-drive.html">self-drive option</a>. Please confirm the exact model details, availability and rental terms with us before you book.</p>

      ${feats}
      <h3>Good to know</h3>
      <ul class="included">
        <li>Professional driver available</li>
        <li>Mopol escort on request</li>
        <li>Travel to all states</li>
        <li>Airport pick-up available</li>
        <li>Fuel is provided by the client</li>
        <li>Support 24 hours, every day</li>
      </ul>

      <div class="related">
        <h3>You may also like</h3>
        <div class="car-grid">${related.map(cardHTML).join('')}</div>
      </div>
    </div>

    <aside class="detail-side">
      <div class="side-card">
        <h5>Vehicles Type</h5>
        <ul class="side-links">
          <li><a href="car-listing.html">All Vehicles</a></li>
          <li><a href="suvs.html">SUVs</a></li>
          <li><a href="sedan.html">Sedan</a></li>
          <li><a href="hilux.html">Hilux</a></li>
          <li><a href="bullet-proof.html">Bullet Proof</a></li>
        </ul>
      </div>
      <div class="side-card">
        <h5>Contact Info</h5>
        <address>
          <p>No. 1 Tombia Street G.R.A Phase II<br>Port Harcourt,<br>Rivers State,<br>Nigeria.</p>
          <p>Branch Office: 21 Dim Rd. Str., Yenegoa,<br>Bayelsa St.</p>
        </address>
        <p class="side-contact">
          Email: <a href="mailto:phsinigeria@gmail.com">phsinigeria@gmail.com</a><br>
          Tel: <a href="tel:+2348067852755">08067852755</a>, <a href="tel:+2348184351604">08184351604</a>
        </p>
      </div>
    </aside>`;

  // Gallery: click a small photo to show it large
  root.addEventListener('click', e => {
    const b = e.target.closest('.gthumb'); if (!b) return;
    document.getElementById('mainPhoto').src = b.dataset.src;
    root.querySelectorAll('.gthumb').forEach(x => x.classList.toggle('on', x === b));
  });
});
