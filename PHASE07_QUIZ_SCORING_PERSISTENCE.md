# ARCH.START Phase 07 Pass 1D1 — Server Quiz Scoring and Attempt Persistence

## Scope

This pass activates authenticated Quiz-attempt submission through a Next.js
Server Action while preserving the browser answer-leak boundary.

The public browser sends only:

```text
lessonCode
selectedAnswers: question ID -> selected option ID
```

The server:

1. verifies the authenticated Supabase session;
2. loads the browser-safe public Quiz record;
3. loads the existing `generated/server/quiz-answer-keys.json` authority;
4. verifies question IDs, option IDs, lesson code, Quiz version and five-answer
   completeness;
5. computes only the aggregate score;
6. inserts one immutable `public.quiz_attempts` row using a separate server-only
   Supabase secret client;
7. returns only status, aggregate score, question count, attempt ID and
   submission time.

## Secret-key boundary

The elevated client reads exactly:

```text
SUPABASE_SECRET_KEY
```

It does not accept a `NEXT_PUBLIC_` variable, does not read cookies, does not
persist sessions and is never imported by browser-safe source.

The secret key is not added to Git, the control pack, `.env.example`, browser
bundles or test fixtures.

## Answer authority

The existing raw answer file remains only at:

```text
generated/server/quiz-answer-keys.json
```

No correct option or canonical explanation is copied into Supabase tables,
public JSON, client props, Server Action results or UI messages.

## Production tracing

`next.config.ts` explicitly includes the server answer authority and all 40
public Quiz JSON files in server output tracing. Existing production browser
bundle scans remain mandatory.

## UI behavior

- unsigned visitor: local selections remain possible, but submission returns an
  instruction to sign in and creates no row;
- signed-in learner: attempt is scored and saved, and the aggregate result is
  shown;
- showcase/static-renderer use without a Server Action retains the accepted
  local demo behavior;
- no per-question correctness or explanation is shown.

## Deliberately deferred to Pass 1D2

- lesson completion activation;
- lesson completion undo;
- module completion activation/undo;
- persistent initial completion state;
- module/course progress percentages;
- Dashboard integration.

The split is intentional because the current Quiz and cutout completion
controls are separate client islands. Pass 1D1 proves scoring and persistence
before introducing a shared persistent completion coordinator.
