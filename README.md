# Warmly

Warmly is a private, single-user personal CRM. It can run locally with browser storage, or use Supabase for passwordless email sign-in and cloud persistence.

## Local preview

Open `index.html` from a local static web server. When `/api/config` is unavailable on `localhost` or `127.0.0.1`, Warmly uses local browser storage and starter contacts.

## Supabase setup

1. Create a Supabase project in a region you prefer.
2. In **Project Settings → API**, copy the project URL and the publishable (anon) key.
3. Run `supabase/migrations/20261103000000_initial_schema.sql` and then `supabase/migrations/20261103010000_owner_email_signup.sql` in the Supabase SQL editor. The second migration upgrades an existing `app_owner` row by looking up its Auth email.
4. In **Authentication → Signups**, enable email sign-ups so the email form can create your Auth account. Warmly does not grant access just because an account can be created.
5. In the SQL editor, allowlist the single email that may own the app. Use the exact email you plan to enter in Warmly:

   ```sql
   insert into public.app_owner (allowed_email)
   values (lower('you@example.com'));
   ```

   If `app_owner` already contains your owner account, the migration preserves it and backfills its email; don’t insert a second row. The database enforces a single owner slot, and only the allowlisted email can claim it.
6. In **Authentication → URL Configuration**, set the site URL to your Vercel deployment URL and add that URL to the redirect allow list.
7. Configure the Vercel environment variables `SUPABASE_URL` and `SUPABASE_ANON_KEY` for the deployment. These contain the project URL and publishable client key; never put a Supabase service-role key in the app.
8. Deploy, enter the allowlisted email in Warmly, and use the emailed magic link. Existing local contacts are offered for import only when the cloud account has no contacts.

The database has row-level security enabled on every exposed table. The `app_owner` allow-list gates reads and writes, so other authenticated Supabase accounts cannot access Warmly data. New accounts can be created through the email form, but accounts whose email does not match the preconfigured owner email are signed out and cannot access CRM data.

## Deploy

The app is static HTML, CSS, and JavaScript with a single Vercel function at `api/config.js` to provide the public Supabase client configuration at runtime. There is no build command or framework preset required.
