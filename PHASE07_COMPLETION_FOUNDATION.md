# ARCH.START Phase 07 Pass 1B — Completion Foundation

## Scope

This pass adds two immutable learner-owned data sets:

```text
public.lesson_completions
public.module_completions
```

It preserves the accepted Pass 1A catalogs and `lesson_activity`.

## Lesson completion

A row is uniquely identified by:

```text
user_id + lesson_code
```

The database owns `completed_at`. Completion rows are immutable.

## Module completion

A row is uniquely identified by:

```text
user_id + module_code
```

The database rejects module completion unless that same user has exactly the
five canonical lesson completion rows belonging to the module.

If any lesson completion is later removed, the corresponding module completion
is automatically removed by a database trigger.

## Browser boundary in Pass 1B

Authenticated users may read only their own completion rows.

Browser writes remain deliberately disabled:

```text
INSERT  false
UPDATE  false
DELETE  false
```

No public completion RPC exists in this pass.

This prevents a learner from fabricating completion before secure Quiz-attempt
persistence can enforce the accepted `locked -> ready -> complete` prerequisite.

## Deferred activation

A later bounded pass will:

1. add secure Quiz attempts and server-owned scoring;
2. add completion write RPCs with explicit prerequisites;
3. grant only those RPCs to authenticated users;
4. connect the existing Completion UI to persistent rows.

## Not included

- learner-facing UI changes;
- progress percentages;
- Continue Learning;
- Quiz-attempt storage;
- project submission/review;
- reviewer/admin roles;
- certificates.
