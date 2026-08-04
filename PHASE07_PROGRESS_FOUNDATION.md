# ARCH.START Phase 07 Pass 1A — Progress Database Foundation

## Scope

This pass creates only:

- hidden canonical catalogs for 8 modules, 40 lessons and 8 projects;
- an own-row `public.lesson_activity` table;
- a narrow `record_lesson_activity()` RPC;
- RLS, column-limited grants, timestamp/identity ownership and hosted verification.

It does **not** implement:

- completion rows;
- Quiz attempt persistence or scoring;
- project submission/storage/review;
- reviewer roles;
- learner Dashboard changes;
- certificates.

## Persistence contract

A signed-in learner may record only one current activity row per lesson:

```text
(user_id, lesson_code) -> last_item, started_at, last_visited_at
```

The browser supplies only:

```text
lesson_code
last_item
```

The database owns:

```text
user_id
started_at
last_visited_at
```

`private` course catalogs remain hidden from the Data API. `lesson_activity`
is exposed through `public`, protected by RLS and grants, and can be updated
through `record_lesson_activity()` without any service-role key.

## Accepted item keys

```text
overview
vocabulary
video
lecture-materials
practice
quiz
```

These correspond to the current six primary lesson-item routes. Legacy
`slides` and `transcript` routes remain redirects and are not stored as resume
state.

## Hosted apply boundary

Do not run the migration remotely until:

1. local source gates pass;
2. the branch is reviewed and merged;
3. the production deployment from `main` is Ready.

The migration is transactional. If it errors, do not manually create partial
tables in Table Editor.
