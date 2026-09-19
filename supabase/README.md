# Supabase provisioning

This repo's migrations are split into two independent sets, matching the
"separate database per business" requirement:

```
supabase/migrations/central/            -> applied ONCE, to the CENTRAL project
supabase/migrations/business-template/  -> applied to EVERY business project
                                            (KMG's project, Murudeshwara's
                                            project, and any future quarry's
                                            project) — identical SQL each time
```

## Provisioning a new business (Rule #29/#30)

1. Create a new Supabase project for the business (Free/Nano tier is fine to start).
2. Apply, in order, every file under `supabase/migrations/business-template/`.
3. Optionally run `supabase/seed.sql` for local/dev testing only — never in production.
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

## Applying migrations

Using the Supabase CLI, from the project root, pointed at the target
project (central or a specific business):

```bash
supabase link --project-ref <project-ref>
supabase db push
```

Or paste each file's contents into the target project's SQL editor in order,
by filename.

## Why not one shared database with a `business_id` column?

The customer's requirement explicitly asks for genuine database isolation
(see `../docs/ARCHITECTURE.md` #6-#10), not a shared table filtered by tenant ID. A
`business_id` column is one query away from an accidental cross-tenant leak;
a separate project physically cannot return another business's rows, even
if application code has a bug.
