# ARCH.START Phase 07 Pass 1C — Quiz-Attempt Foundation

## Scope

This pass creates one immutable learner-owned data set:

```text
public.quiz_attempts
```

It preserves the accepted Phase 07.1A activity foundation and Phase 07.1B
lesson/module completion foundation.

## Stored attempt record

Each row stores:

```text
id
user_id
lesson_code
selected_answers
score
question_count
answer_key_sha256
submitted_at
```

`selected_answers` contains exactly five learner-selected question/option ID
pairs. It contains no correct option, answer key, canonical explanation, or
per-question correctness result.

`score` is an aggregate field reserved for the later server-scoring pass.
Pass 1C creates storage and invariants only; it does not create a scorer.

## Security boundary

Authenticated users may read only their own Quiz-attempt rows.

Browser writes remain disabled:

```text
INSERT  false
UPDATE  false
DELETE  false
```

No public `submit_quiz_attempt` RPC exists in this pass. The existing
`generated/server` answer authority is not copied into the public database
schema and is not imported by browser-facing code.

## Integrity

- exactly five selected answers;
- JSON object with string values only;
- score between 0 and 5;
- question count fixed at 5;
- 64-character lowercase answer-authority SHA-256;
- database-owned user identity and submission timestamp;
- attempts cannot be updated.

## Deferred

A later bounded pass will:

1. load the existing server-only answer authority on the server;
2. validate public question and option IDs;
3. compute the aggregate score on the server;
4. insert an immutable attempt;
5. activate lesson completion only after an attempt exists;
6. activate module completion only after five lesson completions;
7. connect the accepted Quiz and Completion UI.

## Not included

- answer-key rows in Supabase;
- browser or public scoring;
- Quiz UI changes;
- completion write RPCs;
- progress percentages;
- Dashboard integration;
- project submission/review;
- reviewer roles;
- certificates.
