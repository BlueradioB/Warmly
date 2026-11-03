# Warmly

Warmly is a private, single-user personal CRM. It can run locally with browser storage, or use Supabase for passwordless email sign-in and cloud persistence.

## Local preview

Open `index.html` from a local static web server. When `/api/config` is unavailable on `localhost` or `127.0.0.1`, Warmly uses local browser storage and starter contacts.

## Supabase setup

1. Create a Supabase project in a region you prefer.
2. In **Project Settings → API**, copy the project URL and the publishable (anon) key.
3. Run `supabase/migrations/20261103000000_initial_schema.sql` in the Supabase SQL editor.
4. Create your one Auth user in the Supabase dashboard, then insert that user’s UUID into `public.app_owner` as shown in the migration comment. Do not enable public sign-ups.
5. In **Authentication → URL Configuration**, set the site URL to your Vercel deployment URL and add that URL to the redirect allow list.
6. Configure the Vercel environment variables `SUPABASE_URL` and `SUPABASE_ANON_KEY` for the deployment. These contain the project URL and publishable client key; never put a Supabase service-role key in the app.
7. Deploy, request a magic link using the invited email address, and sign in. Existing local contacts are offered for import only when the cloud account has no contacts.

The database has row-level security enabled on every exposed table. The `app_owner` allow-list gates reads and writes, so other authenticated Supabase accounts cannot access Warmly data.

## Deploy

The app is static HTML, CSS, and JavaScript with a single Vercel function at `api/config.js` to provide the public Supabase client configuration at runtime. There is no build command or framework preset required.
