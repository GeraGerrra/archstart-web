# Phase 07 Pass 1D2 — persistent lesson/module completion activation

## Product contract

- any valid persisted Quiz attempt unlocks its own lesson;
- no minimum Quiz score is introduced;
- the learner explicitly activates the existing lesson cutout;
- five lesson completions unlock the module cutout;
- the learner explicitly activates the module cutout;
- undoing a lesson keeps Quiz attempts and invalidates module completion;
- undoing a module keeps all lesson completions;
- anonymous users remain locked;
- browser roles retain read-only own-row access;
- all writes remain inside authenticated Server Actions using the existing
  production-only Supabase secret client.

## Source scope

This pass adds a forward-only completion activation migration, server state
loaders, four authenticated Server Actions, persistent completion controls, and
route wiring for the existing Quiz and Module surfaces.

## Explicitly deferred

- Course Overview and Dashboard progress;
- Continue Learning;
- project submissions and review;
- reviewer roles;
- certificates;
- per-question correctness disclosure.
## Client refresh dependency

`QuizShell` and `CutoutCompletionButton` use the documented client-only
`next/navigation` router refresh API after successful Server Actions so the
current route immediately re-reads server-owned completion state.

The Quiz and Completion boundary checkers allow exactly this framework
dependency while continuing to forbid route-module imports, generated records,
server answer authority, secrets, broad `any`, CSS side-effect imports, cycles,
and reverse dependencies.
