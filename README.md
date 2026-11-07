# Xclusive Rent A Car website

Plain HTML, CSS and JavaScript. No build step: double-click `index.html`, or upload the whole folder to your hosting.

## The 3 things to set first (WhatsApp and phone: admin > Settings, or the top of `common.js`)
- `WHATSAPP_NUMBER`: your WhatsApp number, digits only with country code (e.g. `'2349163910032'`). Once set, every "Book now" button and the booking form open WhatsApp with the message already typed. While it is empty they open your WhatsApp link and copy the message so the customer can paste it.
- `PHONE`: number used by the mobile "Call us" bar.
- `https://xclusiverentcars.com` in `sitemap.xml` and `robots.txt`: change it if your real address differs.

## Admin dashboard
See **SUPABASE-SETUP.md**. After a one-time setup you add and manage cars and categories at `/admin.html`. `cars-data.js` then only acts as a backup list.

## Files
- `cars-data.js`: loads the cars from Supabase and holds a built-in backup list (used until Supabase is set up, or if it is unreachable).
- `supabase-config.js`: your Supabase URL and key.
- `admin.html`, `admin.js`, `admin.css`: the dashboard.
- `supabase/setup.sql`: creates the database tables, security rules and loads your current cars.
- `vercel.json`: Vercel settings (the `/admin` short link, caching, headers).
- `common.js`: shared behaviour (menu, FAQ, counters, image fallbacks, WhatsApp helper).
- `home.js`, `listing.js`, `details.js`, `contact.js`: page-specific scripts.
- `style.css`: all styling. Brand colours are at the top (`--blue`, `--navy`, `--gold`).
- `images/`: photos are compressed `.webp`. Add new car photos to `images/cars/` (a `thumb_` version for cards and a full version for the details page).

## Contact form
It opens the visitor's email app (`mailto:`). It does not send mail by itself; the "Send on WhatsApp" button is the more reliable route.

## Dashboard upgrade (enquiries, stats, locations, testimonials, FAQs, settings, car extras)
See **UPGRADE.md**. Run `supabase/upgrade.sql` once in Supabase, then use the new tabs in `/admin`. `site-data.js` loads those details on every page.
