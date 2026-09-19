# Development Plan

Phased, per the "do not build everything blindly at once" instruction.
Status reflects what is **actually implemented and verified**, not intent.

- [x] **Phase 1 — Audit.** Greenfield repo; nothing pre-existing to inspect.
- [x] **Phase 2 — Architecture.** [`ARCHITECTURE.md`](./ARCHITECTURE.md),
      [`DATABASE_ARCHITECTURE.md`](./DATABASE_ARCHITECTURE.md).
- [x] **Phase 3 — Database.** Migrations written for the central registry
      and the business-template schema. **Not yet applied to any real
      Supabase project** — no project exists yet, so the SQL has been
      reviewed for correctness (`docs/SECURITY.md`) but not executed
      against a live Postgres instance. Treat as reviewed-but-unverified
      until run once against a real project.
- [ ] **Phase 3.5 — Verification pass (this task).** Structure inspected,
      secrets scanned (clean), migrations re-reviewed and corrected (3 real
      bugs found and fixed — see `docs/SECURITY.md`), receipts re-analyzed
      with confidence markers (`docs/RECEIPT_AND_DOCUMENT_ANALYSIS.md`).
- [ ] **Phase 4 — Authentication wiring against a real Supabase project.**
      Code is ready in `src/features/auth/`. Blocked on: you creating the
      Central/KMG/Murudeshwara Supabase projects and applying the
      migrations (`supabase/README.md`).
- [ ] **Phase 5 — Design system components** (tables, forms, modals,
      toasts, empty/loading states) — built alongside the first real
      module rather than guessed in the abstract.
- [ ] **Phase 6 — Core modules UI**, in order: Customers → Materials/Stock
      → Quotations → Bills → Payments → Ledger → Vehicles/Drivers/Trips →
      Expenses → Reports → Settings → Audit logs. **Blocked** on the EV vs
      Normal Bill answer and the dimension→quantity formula (see
      `BUSINESS_RULES.md`) before the Bills/Quotations screens can be
      finalized — everything before Bills (Customers, Stock intake) is not
      blocked and can proceed first.
- [ ] **Phase 7 — Integration tests** across modules
      (quotation → bill → stock movement → ledger → payment → outstanding
      balance → report → PDF → audit log), plus the cross-business
      isolation tests from `ARCHITECTURE.md`/spec Rule #27.
- [ ] **Phase 8 — PDF/print documents.**
- [ ] **Phase 9 — Performance pass** against real data volume (see
      `docs/PERFORMANCE.md` for the strategy already designed in).
- [x] **Phase 10 — Security review** (this task) — see `docs/SECURITY.md`.
      Re-run this phase again after Phase 6 adds new tables/functions.
- [ ] **Phase 11 — Testing** (unit/integration/permission/E2E, per
      `docs/SECURITY.md` "Testing performed" — nothing has run against a
      live database yet since none exists).

## What is genuinely done vs. what looks done

Done and verified by inspection: repo structure, git state, `.gitignore`
coverage, absence of secrets, RLS/function logic (corrected), receipt
analysis rigor.

**Not done, despite files existing:** no code in this repo has ever been
executed against a real database (`npm install`, typecheck and build do
now succeed) — see `docs/SECURITY.md` "Testing performed" and the final report for exactly
what could and couldn't be run in this environment. Do not read the
presence of `.tsx`/`.sql` files as evidence the app works end-to-end yet.
