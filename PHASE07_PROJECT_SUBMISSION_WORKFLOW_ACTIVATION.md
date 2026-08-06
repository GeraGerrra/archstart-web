# ARCH.START Phase 07 Pass 2B2 — Project submission workflow activation

## Authority

This pass starts only from the accepted merged `main` commit:

```text
8e26589e2e4a7688cbeb789b2511f021df813f99
```

The accepted Pass 2B1 hosted boundary contains:

- eight current project-submission policies;
- forty rubric criteria;
- four private and six public project tables;
- sixteen enabled database triggers;
- zero staff, assignment, submission, version, file, review, criterion, and event rows;
- no `project-submissions` Storage bucket;
- no project Storage policy;
- no public project workflow RPC.

## Exact scope

Pass 2B2 adds nine narrow database RPCs. It does not add UI or Storage.

### Trusted service role

```text
set_project_staff_role
```

This is the only staff-bootstrap surface. It is executable only by
`service_role`. It creates, activates, or revokes the private `reviewer` and
`admin` authority records. An active assignment must be released before the
reviewer role can be revoked.

### Learner

```text
create_project_draft
update_project_draft
submit_project
create_project_revision_draft
resubmit_project
```

The learner identity always comes from `auth.uid()`. The client does not supply
`user_id`, workflow status, score, reviewer identity, or timestamps.

### Reviewer/admin

```text
assign_project_reviewer
begin_project_review
decide_project_review
```

Reviewer/admin authorization comes only from the private database role table.
An admin assigns one active reviewer. The assigned reviewer or assigned admin
may begin and decide the review. Self-review remains prohibited.

## Workflow

```text
draft
  -> submitted
  -> under_review
  -> revisions_required | accepted | not_accepted

revisions_required | not_accepted
  -> resubmitted
  -> under_review
  -> revisions_required | accepted | not_accepted
```

`accepted` is terminal. `not_accepted` remains resubmittable.

## Submission prerequisite

The existing Pass 2B1 trigger remains authoritative. A version cannot move from
`draft` to `submitted` unless all of the following are true:

- exactly one valid file-metadata row exists for the version;
- MIME, size, page/canvas shape, validation and scan states match the current
  project policy;
- M02 supporting text contains 120–180 words;
- M08 is a PDF with 8–10 pages;
- the learner has completed all five lessons in the matching module.

There is no minimum Quiz-score threshold.

Because Pass 2C has not created Storage or file finalization yet, this pass does
not make production uploads available. It only activates the safe workflow
state machine around the already accepted schema.

## Review authority

`decide_project_review` accepts exactly five criterion objects containing only:

```text
criterion_number
awarded_points
comment
```

The database:

1. validates the five numbers against the active rubric;
2. loads titles, descriptions and maximum points from the private catalog;
3. computes the total score;
4. creates one immutable review row;
5. creates five immutable criterion snapshots;
6. transitions the submission;
7. writes the public status event;
8. releases the assignment when the result is `accepted`.

Acceptance is an explicit reviewer decision and is never derived from a score
threshold.

## Concurrency and retry contract

- draft creation is serialized by user/project advisory lock;
- revision creation is serialized by user/submission advisory lock;
- staff bootstrap is serialized by user/role advisory lock;
- owned learner rows are filtered by `auth.uid()` before `FOR UPDATE`;
- review rows are locked only for the active assignee or the immutable review's original reviewer;
- all mutable authorized workflow rows are selected `FOR UPDATE` before transition;
- unique indexes remain the final duplicate guard;
- exact network retries return the existing draft, assignment, review or final
  state instead of creating duplicate rows or events;
- unassigned reviewer/admin accounts receive one generic authorization failure
  instead of a submission-existence oracle;
- a retry with different immutable review content is rejected.

## Security

Every RPC is `SECURITY DEFINER`, has an empty `search_path`, and uses
schema-qualified relation references. Public/default execute is revoked.

- `anon`: no workflow RPC;
- `authenticated`: eight user/session RPCs;
- `service_role`: only staff-role authority management;
- direct browser `INSERT`, `UPDATE`, and `DELETE` on project tables remain
  revoked;
- learner RLS projections remain own-row only;
- object paths, reviewer IDs, and event actor IDs remain outside learner column
  grants.

## Explicit exclusions

This pass does not create or change:

- Supabase Storage bucket, policies, objects, upload endpoint, signed URL or
  resumable upload;
- file-byte inspection or file finalization;
- learner, reviewer, admin or Dashboard UI;
- Vercel environment variables;
- R2 configuration;
- Resend/email or notifications;
- public project gallery;
- certificate tables, certificate registry, QR verification, or eligibility.

## Hosted execution order

1. Run the local control pack and obtain every local PASS line.
2. Review the exact six changed paths.
3. Commit, push, open a PR, and wait for Vercel Preview `Ready`.
4. Run the migration once as `postgres` in Supabase SQL Editor.
5. Run the read-only hosted verification.
6. Run the full two-account rollback test with two real test-account UUIDs.
7. Confirm every project workflow table returns to the pre-test row count.
8. Merge only after all hosted checks pass.
9. Synchronize and clean `main`.
10. Stop before Phase 07.2C.
