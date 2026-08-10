# ARCH.START Phase 07.2E — Authenticated Progress Truth and Cross-Surface Status Repair

## Purpose

This source-only repair removes the remaining Phase 02 demonstration progress
from production Selected-A surfaces and gives every public/signed-in route one
shared read-only progress projection.

## Product truth model

- Header progress counts persisted lesson completions only (`completed / 40`).
- Database `module_completions` remains lesson-only evidence and is not redefined.
- A module is fully complete in product UI only when all five lessons are complete
  **and** its project submission status is `accepted`.
- Project status is displayed independently from lesson progress.
- Anonymous course, module, lesson and project surfaces use exact zero progress.
- Signed-in surfaces use only the current account's server projection.

## Mixed hosted acceptance fixture

- M01: five lessons complete, project accepted, product module complete.
- M08: five lessons complete, project draft with a valid PDF, product module not complete.
- M02–M07: zero lesson progress and no project submission.

## Repaired surfaces

- shared header;
- Home and Course Overview;
- course module cards;
- module strip and module menu;
- module overview;
- lesson workspace sidebar;
- project overview/workspace shell;
- Dashboard shared shell projection.

## Additional truthful UI repairs

- M08 no longer mentions an M02 supporting-text prerequisite;
- files below one MiB render in KiB rather than `0 MB`;
- module completion copy explicitly describes lesson completion, while project
  acceptance remains a separate product state.

## Bounded scope

No Supabase migration, database mutation, Storage mutation, dependency change,
project workflow change, upload/TUS change, review change, certificate, email,
analytics or Phase 08 source is introduced.
