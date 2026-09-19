# Supabase provisioning

This repo's migrations are split into two independent sets, matching the
"separate database per business" requirement:

```
supabase/migrations/central/            -> applied ONCE, to the CENTRAL project
                                            (001 registry, 002 grants)
supabase/migrations/business-template/  -> applied to EVERY business project
                                            (KMG's project, Murudeshwara's
                                            project, and any future quarry's
                                            project) — identical SQL each time
```

## Provisioning a new business (Rule #29/#30)

1. Create a new Supabase project for the business (Free/Nano tier is fine to start).
2. Apply, in order, every file under `supabase/migrations/business-template/`
   (`001` … `012`).
3. Optionally run `supabase/seed.sql` for local/dev testing only — never in
   production. It contains generic sample rows only.
4. Add the new project's URL + anon key to `.env.local` as
   `VITE_<CODE>_SUPABASE_URL` / `VITE_<CODE>_SUPABASE_ANON_KEY`.
5. Add a row to `central_businesses` in the CENTRAL project (code, name,
   legal_name, tagline, status='active').
6. Add the business's code to `BUSINESS_CODES` / `BUSINESS_REGISTRY` in
   `src/types/business.ts`.
7. Create the business's first admin user in Supabase Auth for that
   project, then insert a matching row into that project's `staff_profiles`
   with `role = 'admin'`.

No application code needs to change — this is why each business has its own
project running the identical business-template schema (Rule #10/#31).

## Verifying the migrations locally

```bash
npm run test:db
```

Applies the central and business-template migrations to real PostgreSQL
(PGlite) with Supabase-style roles and runs the schema, calculation, ledger,
stock, RLS and grant checks. Needs no Supabase project, network or
credentials. Run it after any migration change.

## Applying migrations

The two migration sets live in sub-folders, so the CLI's flat
`supabase db push` (which reads `supabase/migrations/*.sql` directly) will
**not** pick them up as-is. Apply each set to its own project, in filename
order, using either:

- the target project's SQL editor (paste each file in order), or
- `psql "<that project's connection string>" -v ON_ERROR_STOP=1 -f <file>`
  for each file in order (the connection string is a secret — keep it out of
  the repo and the shell history).

The files are ordered by dependency: e.g. `005` adds a foreign key to
`quotations` (`004`), `007` adds foreign keys to `bills` (`005`), `010`
revokes and re-grants privileges on every table created before it, and `011`
grants its own tables. Function bodies that mention later tables (`006` reads
`settings`) are resolved at call time, as on any Postgres. `npm run test:db`
applies the files in exactly this order as a non-superuser owner, the way the
hosted `postgres` role does.

## Why not one shared database with a `business_id` column?

The customer's requirement explicitly asks for genuine database isolation
(see `../docs/ARCHITECTURE.md` #6-#10), not a shared table filtered by tenant ID. A
`business_id` column is one query away from an accidental cross-tenant leak;
a separate project physically cannot return another business's rows, even
if application code has a bug.
