# Warmly

Warmly is a personal CRM with private, per-account workspaces. It can run locally with browser storage, or use Supabase for email-and-password sign-in and cloud persistence.

## Local preview

Open `index.html` from a local static web server. When `/api/config` is unavailable on `localhost` or `127.0.0.1`, Warmly uses local browser storage and starter contacts.

## Supabase setup

1. Create a Supabase project in a region you prefer.
2. In **Project Settings → API**, copy the project URL and the publishable (anon) key.
3. Run these migrations in order in the Supabase SQL editor:
   - `supabase/migrations/20261103000000_initial_schema.sql`
   - `supabase/migrations/20261103010000_owner_email_signup.sql`
   - `supabase/migrations/20261106000000_multi_user_workspaces.sql`

   If you already deployed the earlier single-owner version, run only the new `20261106000000_multi_user_workspaces.sql` migration. It preserves the existing owner’s data and makes it private to that account.
4. In **Authentication → Signups**, enable email sign-ups. If email confirmation is enabled, confirm your address before signing in.
5. In **Authentication → URL Configuration**, set the site URL to your Vercel deployment URL and add that URL to the redirect allow list.
6. Configure the Vercel environment variables `SUPABASE_URL` and `SUPABASE_ANON_KEY` for the deployment. These contain the project URL and publishable client key; never put a Supabase service-role key in the app.
7. Deploy and choose **Create account**. Every Supabase account receives a separate private workspace. Existing local contacts are offered for import only when that account has no cloud contacts; local caches are kept separate by account.

The database has row-level security enabled on every exposed table. Each contact, activity, custom field, and custom value is assigned to its account, and policies and relationship constraints prevent one user from reading or attaching records to another user’s workspace. Use **Forgot password?** on the sign-in form to recover access.

## Export your data

Open **Account settings → Export your circle** to download contacts as CSV, logged moments as a separate activity CSV, or an Excel workbook containing Contacts, Activity log, and Custom fields sheets.

## Import connections

On the Contacts page, choose **Import connections** and select a CSV or Excel file. The first worksheet should have a header row. Review or change the column mappings, map a required Name column, and choose which rows to import. Possible duplicates are detected by email or by matching name and company, and are excluded by default. Unmapped columns can be ignored or added as custom text fields.

The contacts table includes each connection’s organization and supports sorting by name, organization, relationship, or latest activity date. Name and organization sort A–Z by default; choosing the activity date sorts newest first.

## Deploy

The app is static HTML, CSS, and JavaScript with a single Vercel function at `api/config.js` to provide the public Supabase client configuration at runtime. There is no build command or framework preset required.
