# Deployment (Vercel + two Supabase projects)

One codebase, two isolated databases:

| Business | Supabase project | Ref | Region |
|---|---|---|---|
| KMG Stones | KMG | `odapxrssshzdhaxvowtr` | Tokyo |
| Murudeshwara Stones | Murudeshwara | `qatyfljijtetfauufifm` | Mumbai |

Both have the identical public schema (verified by generating and diffing the
types of each project: 21 tables, 2 views, the same functions).

## Vercel
- Production branch: `main`. Framework: Vite. Build: `npm run build`. Output: `dist`.
  `vercel.json` rewrites all paths to `index.html` (deep links survive refresh).
- Environment variables — Production **and** Preview, public values only:

  | Name | Value |
  |---|---|
  | `VITE_KMG_SUPABASE_URL` | `https://odapxrssshzdhaxvowtr.supabase.co` |
  | `VITE_KMG_SUPABASE_ANON_KEY` | KMG project's anon/public key |
  | `VITE_MURUDESHWARA_SUPABASE_URL` | `https://qatyfljijtetfauufifm.supabase.co` |
  | `VITE_MURUDESHWARA_SUPABASE_ANON_KEY` | Murudeshwara project's anon/public key |

  Names must start with `VITE_`, contain only letters/digits/underscores, and be
  typed without spaces. Never add a service-role key or database password.
  Vite bakes the values in at build time, so **redeploy after any change**
  (turn off "Use existing build cache").
- A business whose two variables are missing shows "Database not connected" and
  opens an informational page. There is no fallback to another business's keys.

## Supabase (each project separately)
- Authentication → URL Configuration: Site URL = your Vercel domain; add
  `https://<domain>/**` as a redirect URL (password-reset emails).
- Consider turning off open signups (logins are issued by an administrator).
- Create the first admin: Authentication → Users → Add user (auto-confirm), then in
  the SQL Editor run `supabase/tests/manual/01_make_admin.sql` with that user's
  exact id. Do this once **per project**; logins are not shared.
- Migrations live in `supabase/migrations/business-template/`. To (re)apply to a
  project: `node supabase/deploy/prepare.mjs business-template`, then from
  `.deploy/business-template`: `npx supabase link --project-ref <ref>` and
  `npx supabase db push`.

## Verify
- `npm run test:db` — local database rules (no credentials).
- `npm run smoke:kmg` — anonymous checks against the project in `.env.local`;
  with `TEST_EMAIL`/`TEST_PASSWORD` (and `STAFF_*`) it runs the authenticated
  checks; `SMOKE_WRITE=1` adds writes with clearly marked TEST records.
