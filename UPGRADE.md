# Dashboard upgrade

New tabs in `/admin`: **Enquiries**, **Stats**, **Locations**, **Testimonials**, **FAQs**, **Settings**. Cars also get a self-drive price, a features list and extra photos.

## Install (about 5 minutes)

1. **Supabase**: open **SQL Editor > New query**, paste all of `supabase/upgrade.sql`, press **Run**. It says *Success*.
   - It does not touch your admin email setting.
   - It loads your current testimonials, FAQs and cities so the website looks the same until you change something.
   - Safe to run twice.
2. **GitHub**: upload the files from this zip to your repository (same folder structure, replace existing files).
   - Do NOT replace `supabase-config.js`. It already holds your Supabase details (it is not in this zip).
3. Wait for Vercel to redeploy, open `/admin`, log in.
4. Open **Settings**, check your WhatsApp number and phone, and press **Save settings**. (`common.js` in this zip has the original numbers, so this step puts yours back.)

## What each tab does

- **Enquiries**: every booking-form submit and every "Book now" tap on a car is logged. Set a status (New, Followed up, Booked, Not interested), add a note, filter, or download a CSV. This records interest only: the customer must still send the WhatsApp message, and no name or phone number is collected.
- **Stats**: enquiries per day, most requested cars, vehicle types, cities and services for the last 7, 30 or 90 days.
- **Locations**: cities shown in the booking form dropdown and the "Where we operate" cards (name, trips label, optional page link, optional photo).
- **Testimonials**: the home page slider. Hide them all to remove the section.
- **FAQs**: the home page questions. Links: write `[text](page.html)`. City pages and the self-drive page keep their own questions.
- **Settings**: WhatsApp number, call number, and the promo bar (text, button, on/off).
- **Cars**: new fields for self-drive price (the website then shows both prices), features (one per line) and up to 8 extra photos.

## Good to know

- If Supabase is unreachable or this upgrade has not been run, every page keeps the content in its HTML, so nothing breaks.
- The header phone, "Call us" buttons, the call button near the bottom of the home page and the first footer number follow the Settings phone. The other footer numbers stay as written in the HTML.
- Prices you already entered are treated as "with driver" only once you also add a self-drive price to that car.
