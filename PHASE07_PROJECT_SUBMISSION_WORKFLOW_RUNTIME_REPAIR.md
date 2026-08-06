# ARCH.START Phase 07 Pass 2B2-R1 — PL/pgSQL output qualification repair

## Incident

The hosted B2 migration and metadata verification passed, but the first full
runtime workflow test failed inside `public.create_project_draft(text)` with
SQLSTATE `42702`: `version_number` was ambiguous between a `RETURNS TABLE`
output variable and `public.project_submission_versions.version_number` in an
unqualified `INSERT ... RETURNING` clause.

## Scope

This repair replaces exactly four existing RPC definitions without changing
signatures, state transitions, tables, RLS, Storage, or UI:

- `set_project_staff_role` — qualify a latent `staff_role` UPDATE predicate;
- `create_project_draft` — qualify target-table RETURNING columns;
- `create_project_revision_draft` — qualify the equivalent revision RETURNING;
- `assign_project_reviewer` — qualify `assigned_at` in RETURNING.

The repair reasserts the original `8 authenticated + 1 service-role-only`
execution boundary and keeps `search_path = ''` on every function.

## Deliberately unchanged

- all B1 schema and 16 triggers;
- all nine RPC signatures and workflow semantics;
- 5/5 lesson prerequisite and no Quiz score threshold;
- immutable submitted versions and reviews;
- Storage bucket/policies (still absent);
- learner/reviewer UI (still deferred);
- Vercel, R2, Resend, environment variables, and certificates.
