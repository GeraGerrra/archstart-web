# ARCH.START Phase 07 Pass 2B1 — Project submission schema foundation

## Status

Database-only foundation. This pass does **not** activate upload, learner submission,
reviewer UI, notifications, Storage, or certificates.

## Accepted predecessor

- Phase 07 Pass 1A–1E hosted progress, Quiz, completion, and Dashboard authorities.
- Exact source identity: `9ba289bf802a11edae20f3e1a1517867d6f9b514`.
- Eight hidden project catalog rows: `M01_P01` through `M08_P08`.

## Created private authorities

- `private.project_submission_policies`
- `private.project_rubric_criteria`
- `private.project_staff_roles`
- `private.project_reviewer_assignments`

Reviewer/admin authority is deliberately not stored in `public.profiles`, learner-editable
metadata, or a public JWT claim.

## Created learner-owned public records

- `public.project_submissions`
- `public.project_submission_versions`
- `public.project_submission_files`
- `public.project_reviews`
- `public.project_review_criteria`
- `public.project_status_events`

All six public tables have RLS. `authenticated` receives own-row SELECT on an explicit
safe column list only. Browser INSERT/UPDATE/DELETE remains absent.

## Frozen policy

- one logical submission per learner/project;
- one editable draft at a time;
- one primary deliverable per version;
- M01–M07: PDF or PNG, one 1920×1080 board;
- M02: additional 120–180 word structured text;
- M08: PDF only, 8–10 pages, each 1920×1080;
- 40 MB hard file limit;
- submitted versions and reviews are immutable;
- all eight rubrics contain five exact accepted criteria totaling 100 points;
- score does not automatically accept a project;
- `accepted` is terminal;
- `not_accepted` and `revisions_required` may lead to a new version;
- no self-review;
- reviewer identity and private object paths are hidden from learner reads.

## Inert workflow boundary

The schema defines the state machine and invariants, but all writes require transaction-local
`archstart.*_authorized` guards. No public workflow RPC exists. Pass 2B2 will add narrow
server-authorized operations that set these guards inside one transaction.

## Explicitly deferred

- private `project-submissions` Storage bucket and Storage RLS;
- resumable uploads and object finalization;
- file signature/page/dimension inspection against real bytes;
- learner Project UI;
- reviewer queue and decision UI;
- notifications;
- retention/account deletion automation;
- course eligibility and certificates.
