# Phase 07 Pass 1E — signed-in Dashboard and progress projection

## Product contract

- `/prototype/a/dashboard` remains authenticated and onboarding-gated;
- Dashboard reads use the session-aware Supabase client and own-row RLS;
- `SUPABASE_SECRET_KEY` is not used for Dashboard reads;
- course and module progress are derived only from explicit completion rows;
- Quiz attempts remain activity evidence and never inflate completion counts;
- canonical lesson-item visits record only `lesson_code` and `last_item` through
  the accepted `record_lesson_activity()` security-invoker RPC;
- `Continue Learning` uses the latest valid activity when its lesson is not
  complete, otherwise the next unfinished lesson in official order;
- a latest Quiz attempt is a fallback resume anchor when no activity row exists;
- an empty database renders a truthful zero-progress and empty-history state;
- the module map remains in official M01–M08 order;
- the selected-A shell on the signed-in Dashboard uses the same real projection
  rather than the Phase 02 demo state;
- the public Course Overview remains unchanged and continues to identify its
  progress as demonstration data.

## Source-only boundary

No Supabase migration is required. Pass 1A already created the activity table,
RPC, grants and RLS; Passes 1B–1D2 already created and activated Quiz and
completion authorities.

This pass changes no table grants, policies, triggers, hosted configuration,
R2 assets, Quiz answer authority, completion mutation contract, project submission and review workflow, reviewer
role or certificate behavior.

## Continue Learning precedence

1. latest valid `lesson_activity` row for an unfinished lesson;
2. next unfinished lesson after a completed latest activity row, with one wrap
   to the first unfinished lesson;
3. latest Quiz attempt when no activity row exists;
4. first unfinished lesson in official course order;
5. Course Overview after all forty lessons are complete.

Legacy `slides`, `transcript` and conditional `resources` routes are not stored
as resume state. The existing six canonical Pass 1A item keys remain exact.

## Truthful history panel

With no persisted activity, the Dashboard states that history is empty and
shows zero lesson/module counts. With persisted data, it shows the latest
lesson/item, latest aggregate Quiz score when one exists, and explicit lesson
completion count. It never exposes answers, correctness per question, or
canonical explanations.
