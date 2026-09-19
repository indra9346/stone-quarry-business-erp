# Development Plan

Phased, per the "do not build everything blindly at once" instruction.
Status reflects what is **actually implemented and verified**, not intent.

- [x] **Phase 1 — Audit.** Greenfield repo; nothing pre-existing to inspect.
- [x] **Phase 2 — Architecture.** [`ARCHITECTURE.md`](./ARCHITECTURE.md),
      [`DATABASE_ARCHITECTURE.md`](./DATABASE_ARCHITECTURE.md).
- [x] **Phase 3 — Database.** Central registry + business-template
      migrations (`001`–`012`), corrected against the real source documents
      (`docs/RECEIPT_AND_DOCUMENT_ANALYSIS.md`) and verified on real
      PostgreSQL with `npm run test:db` (261 checks: schema, arithmetic,
      NULL semantics, ledger, stock, RLS, grants, audit, KMG/Murudeshwara
      identity).
- [x] **Phase 3.5 — Verification and correction pass.** Bill arithmetic
      moved into the database; payment/ledger/stock/audit write paths
      hardened; measurement sheets added; withdrawn payment-recipient
      concept removed; seed data made generic (see `docs/SECURITY.md`).
- [ ] **Phase 3.6 — Provision hosted databases.** Create the Central, KMG and
      Murudeshwara Supabase projects and apply the migrations. **Not done**:
      needs your Supabase account access; nothing here creates projects or
      handles credentials.
- [ ] **Phase 4 — Authentication wiring against a real Supabase project.**
      Code is ready in `src/features/auth/`. Blocked on Phase 3.6.
- [ ] **Phase 5 — Design system components** (tables, forms, modals,
      toasts, empty/loading states) — built alongside the first real
      module rather than guessed in the abstract.
- [ ] **Phase 6 — Core modules UI**, in order: Customers → Materials/Stock
      → Quotations → Bills → Payments → Ledger → Vehicles/Drivers/Trips →
      Expenses → Reports → Settings → Audit logs. **Blocked** on the EV Bill
      format, a real quotation sample, and (for measurement sheets) the
      PCS/unit/quantity meaning — see `BUSINESS_RULES.md` — before those
      screens can be finalized — everything before Bills (Customers, Stock intake) is not
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

## What is genuinely done vs. what is not

Done and verified: repo structure, git state, absence of secrets, the
complete database schema exercised on real PostgreSQL (`npm run test:db`),
role/RLS/grant behaviour, and corrected document analysis.

Not done: no hosted Supabase project exists; no operational module UI is
built; the app has never talked to a live database.
