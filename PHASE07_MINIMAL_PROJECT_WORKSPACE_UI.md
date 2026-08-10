# Phase 07.2D — Minimal project workspace UI

This pass activates the accepted Phase 07 project backend in the selected-A UI.

## Learner boundary

- Public project instructions remain readable without a session.
- Anonymous visitors receive only a sign-in destination; learner, staff, file and policy rows are not queried.
- Signed-in users who have not completed onboarding receive only the onboarding action.
- Onboarded learners read their project records through the session client and own-row RLS.
- Private active policy data is projected only after authentication and onboarding.
- Draft, revision, upload, submit and resubmit mutations call the accepted RPC/action surface.
- A finalized primary file is fixed to its version. This UI does not invent deletion or replacement.
- Standard upload is used through 6 MiB; larger files through 40 MiB use the accepted TUS controller.

## Staff boundary

- `/prototype/a/review` is dynamic and protected by session, onboarding and active staff-role checks.
- The secret client is server-only and is used only after authentication and role authorization.
- Browser projections contain display names, authorized assignment identifiers, finalized file identifiers and rubric display data; they do not contain emails, role rows, object paths, upload tokens or credentials.
- Assignment, review start and review decision mutations call the accepted workflow RPCs.
- The review form is rendered only from an exact five-criterion database rubric.

## Dashboard

The signed-in Dashboard retains lesson progress and adds eight own-row project statuses. The staff workspace link is projected only for an active reviewer or admin.

## Deferred boundary

The known anonymous M01/M04 sidebar fixture in `selectedAStatusForLesson()` remains unchanged. It is deferred until Phase 07 closure and before any Phase 08 rescope.

No migration, Storage policy, notification, certificate, QR, registry, revocation or Phase 08 source is part of this pass.
