# Setting up the admin dashboard (about 15 minutes, once)

You will add and manage cars at `your-site.com/admin.html`. The cars live in a free Supabase database; the website itself stays on Vercel.

## 1. Create the Supabase project
1. Go to **supabase.com**, sign up, and click **New project**.
2. Give it a name (e.g. `xclusive`), set a **database password** (save it somewhere safe; you will rarely need it) and pick the region closest to Nigeria (usually a Europe region).
3. Wait a minute or two until the project finishes setting up.

## 2. Create your admin login
1. In the left menu open **Authentication > Users**.
2. Click **Add user > Create new user**. Enter the email and password you want to log in with. Tick **Auto Confirm User** and create it.
3. Open the Authentication settings (**Sign In / Providers**, then **Email**) and **turn OFF "Allow new users to sign up"**. This makes sure nobody else can ever create an account.

## 3. Create the tables (one paste)
1. Open `supabase/setup.sql` from this folder in any text editor.
2. Find the line containing `CHANGE_ME@example.com` and replace it with **the same email you just created** (keep the quotes). This is what limits editing to you.
3. In Supabase open **SQL Editor > New query**, paste the whole file, and click **Run**. It should say *Success*. It creates the car and category tables, the photo storage, the security rules, and loads your current 12 cars and 5 categories.

## 4. Connect the website
1. In Supabase open **Project Settings > API** (or **API Keys**).
2. Copy the **Project URL** and the **anon / publishable** key.
3. Paste them into `supabase-config.js`:
   ```js
   const SUPABASE_URL = 'https://xxxxxxxx.supabase.co';
   const SUPABASE_KEY = 'eyJ...';
   ```
   Use the **anon / publishable** key only. Never paste the `service_role` or `secret` key into the website.

## 5. Put the site on Vercel
1. Create a free GitHub account and a new repository, then upload the contents of this folder (GitHub's "Add file > Upload files" works).
2. On **vercel.com** click **Add New > Project**, import that repository, set **Framework Preset = Other**, leave Build Command and Output Directory empty, and click **Deploy**.
3. Every time you later change a file on GitHub, Vercel redeploys automatically. Adding cars through the dashboard does **not** need a redeploy.

## 6. Use it
Open `your-site.com/admin` (or `/admin.html`) and log in.
- **Cars > Add a car**: name, year, seats, fuel, optional price, categories, photo. The photo is resized for you; a clean PNG on a transparent or plain background looks best.
- **Switch** on a car = show or hide it on the website without deleting it.
- **Arrows** change the order cars appear in.
- **Categories tab**: add, rename or remove categories. A new category appears on the website as a filter and as a tab on the home page straight away. Only categories that have at least one visible car are shown to visitors.

## Good to know
- **Price:** leave it empty to show "Price on request". As soon as any car has a price, the website shows the price filter and sort.
- **If Supabase is unreachable** the website keeps working: it shows the last cars it saved in the visitor's browser, or the built-in list in `cars-data.js` as a last resort.
- **Free plan pause:** Supabase pauses free projects that get no activity for about a week (check their current rules). A site with regular visitors is not affected. If it ever pauses, open the Supabase dashboard and click **Restore**.
- **Backups:** in Supabase **Table Editor** you can export the cars table to CSV any time.
- **Moving to cPanel later:** upload the contents of this folder to `public_html`. Nothing needs changing, because the admin talks to Supabase from the browser. Use `/admin.html` there (the short `/admin` link is a Vercel feature). Change `Disallow` lines in `robots.txt` if you want.
- **Forgot the admin password?** Supabase > Authentication > Users > your user > Send password recovery, or set a new one there.
