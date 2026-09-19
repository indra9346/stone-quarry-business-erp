# Frontend

One React/Vite codebase; one **isolated** Supabase project per business. The
business is part of the URL and selects the client, so nothing crosses
between KMG and Murudeshwara.

```
/                                  Central gateway (choose a business)
/business/:code                    Sign in to that business
/business/:code/forgot-password    /reset-password
/business/:code/dashboard          …and every module below, behind sign-in
```

## Data access
- `src/lib/supabase/business-client.ts` — one lazily-created client per
  business (own URL, anon key and auth storage key). Only the **anon** key is
  ever in the browser.
- `src/features/auth/` — `BusinessProvider` resolves the session and the
  user's role from that business's own `staff_profiles`. An inactive or
  never-granted user lands on "Access denied" and no business data is
  requested.
- `src/services/*` — all Supabase calls (typed against `src/types/db.ts`).
  `src/hooks/useBiz.ts` prefixes every query key with the business code, so
  cached rows can never leak between businesses.
- Money movement uses the database functions only: `post_bill_to_ledger`,
  `cancel_bill`, `record_payment` (with an idempotency key), `apply_stock_movement`,
  `record_ledger_adjustment`, `next_document_number`.

## Roles
Admin: everything. Staff: no Customer Ledger, Expenses, Reports, Settings or
Audit Logs. This is enforced three times: the menu, `RequireAdmin` route
guards (Access denied, no request made), and — authoritatively — RLS.

## Rules the UI keeps
- NULL is shown as “—”, never as 0. Blank form fields are stored as NULL.
- A bill line is descriptive (no quantity/rate/amount) or fully priced.
- Bill totals are computed by the database; the form shows a preview only.
- Draft bills are editable; posted bills are locked; cancelled bills stay on
  record. Payments and ledger entries cannot be edited or deleted.
- Measurement sheets are independent documents, stored and shown as written
  (no unit, no formula, no meaning given to “PCS”).
- Stock is movement-based; bills never move stock.
- Printing: `.print-area` on A4 via the browser's print dialog
  (“Save as PDF” for PDFs).

## Not verified
The screens are type-checked, linted, built and were exercised in a browser
against a local stand-in for the Supabase API (login, dashboard, bills list and
detail, draft bill form, Staff access-denied). They have **not** been run
against the deployed KMG database.

## Deploying (Vercel)
- Framework preset: Vite. `vercel.json` rewrites every path to `index.html` so
  deep links such as `/business/kmg/bills` survive a refresh.
- Environment variables (Project → Settings → Environment Variables), public
  values only: `VITE_KMG_SUPABASE_URL`, `VITE_KMG_SUPABASE_ANON_KEY`.
  Never add a service-role key or database password.
- In Supabase → Authentication → URL Configuration add the Vercel domain as the
  Site URL and a redirect URL (password-reset emails link back to
  `/business/kmg/reset-password`).
- Consider turning off "Allow new users to sign up" (Authentication → Sign In /
  Providers): logins are issued by an administrator.

## Live smoke test
`npm run smoke:kmg` runs the real service layer against the deployed project
(see the header of `scripts/smoke-kmg.ts`). Read-only by default; `SMOKE_WRITE=1`
creates clearly-marked TEST records.
