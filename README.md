## v9.1 — Shawarma-style responsive layout and checkout fix
- Uses v9 as the base; V10 is not used.
- Keeps the desktop sidebar and slide-out sidebar on phone/tablet.
- Responsive layout follows the existing Shawarma app style: full-width content, compact cards, two-column mobile dashboard, stacked forms, and touch-friendly buttons.
- Checkout uses a frozen cart snapshot and always displays the real subtotal/discount/total.
- POS remains independent from inventory.

# Cash Register X Automatic — v9

v9 fixes cart total rendering, instant cart updates, and phone/tablet navigation/layout.
Inventory remains independent from POS: sales do not read or modify stock.

## v7 performance update
- Product clicks update only the cart panel instead of rebuilding the entire POS screen.
- Remove/Clear cart actions are also instant.
- Quantity and discount inputs remain live without full-page redraws.

## v6 update
- Add Stock now uses a typed Product Name instead of a product dropdown.
- Existing products are matched automatically.
- New product names are created automatically with price ₱0 so they can be edited later in Products.
- Adding stock to an existing product increases its current stock instead of making a duplicate inventory row.

# Cash Register X Automatic

Mobile-friendly Supabase POS for GitHub Pages.

## Included
- POS checkout with automatic change calculation
- Cash quick-pay buttons (Exact, P100, P200, P500)
- Cash, GCash, Maya, Card and Other payments
- Products and categories
- Inventory units: pcs, kg, packs, btls
- Decimal stock quantities for kilos
- Automatic stock deduction after completed sales
- Sales history and printable receipts
- Expenses with date, category, description, amount, payment method and reference number
- Reports and Excel export/import
- Supabase authentication and profiles
- Mobile bottom navigation
- PWA/service worker

## Existing Supabase database
If you already have the database/tables from the earlier version, run `upgrade.sql` in Supabase SQL Editor. It only adds/updates the fields needed for the new inventory units and expense details; it does not delete your existing records.

## Fresh database
For a completely new Supabase project, run `database.sql` instead.

## GitHub Pages
Upload the files in this folder to the root of your `Cash-register` repository and replace the old app files. Keep `config.js` with your Supabase publishable/anon key. Never put a service-role/secret key in browser code.

After GitHub Pages updates, hard refresh with Ctrl+Shift+R if an older version is cached.


### v4 performance improvements
- Parallel Supabase data loading instead of sequential requests.
- POS search is debounced to avoid rebuilding the entire screen on every keystroke.
- Discount updates no longer rebuild the whole POS screen.
- Inventory Excel files are parsed only once.
- Sales and expenses initial lists are capped at 500 recent records for faster mobile loading.
- Service-worker cache version bumped to force the optimized build to load.

### v5 smooth input update
- Cart quantity changes update instantly without rebuilding the POS page.
- Discount changes update instantly without rebuilding the POS page.
- POS product search filters the existing buttons instead of rerendering the whole screen.
- Service-worker cache version bumped again.


## POS / Inventory separation (v8)
The POS is intentionally independent from Inventory. POS does not display stock, does not check stock availability, and completing a sale does not reduce inventory. Inventory remains a separate stock-tracking module with its own units (pcs, packs, btls, kg).


V9.1 SIZING-ONLY BUILD: Original V9.1 layout and functionality retained. Only POS product tile/grid sizing was adjusted.


ADMIN / STAFF UPDATE: Staff sees only Dashboard, POS, Products, and Inventory. Admin retains access to all modules, including Customers, Sales, Expenses, Reports, and Settings. Run roles_upgrade.sql in Supabase SQL Editor to enforce the permissions at database level.


Mobile navigation now follows the Staff-accessible core modules: Dashboard, POS, Products, Inventory. Admin still has all modules through the sidebar.


ADMIN STAFF REGISTRATION UPDATE
- Public login no longer exposes a Create account button.
- Admin accounts now have a Staff Accounts page in the sidebar.
- Admin can register Staff accounts without being signed out.
- Newly registered accounts are assigned the Staff role by the existing profile trigger.
- The Staff Accounts page lists registered profiles and their roles.
- Staff cannot access the Staff Accounts page.


## V9.1 Username + Password Staff Accounts

This build removes email from the visible login and Staff registration.
- Login: Username + Password
- Admin > Staff Accounts: Username + Password + Confirm Password
- Staff accounts are created server-side by the Supabase Edge Function `create-staff`, so the Admin session is not replaced.
- Supabase Auth uses an internal synthetic email behind the scenes; users never enter or see it.

### Supabase setup
1. Run `username_auth_upgrade.sql` once in the existing Supabase SQL Editor.
2. Deploy `supabase/functions/create-staff/index.ts` as the `create-staff` Edge Function. Supabase supplies `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to the function; never put the service-role key in `config.js` or GitHub.
3. The existing Admin profile should receive a username automatically from the part before its email address.
4. Log in using that username and the existing password.

## V9.1 Feature Update

- Customers removed from the application navigation and POS flow. The existing `customers` database table is preserved to avoid deleting existing data.
- Products are Admin-only. Staff can still use POS and Inventory, but cannot open/manage Products.
- Products have a `pos_shape` field: `circle`, `box`, `triangle`, or `hexagon`.
- POS supports only a fixed PWD Discount option at 20%; the old manual discount input is removed.
- Sales store `pwd_discount=true` when the PWD 20% option is used.

### Database
Run `v9_1_features_upgrade.sql` in Supabase SQL Editor after the existing role/username setup.

### Edge Function
Keep `supabase/functions/create-staff/index.ts` deployed as `create-staff`. Never put a service-role/secret key in `config.js` or the GitHub Pages files.
