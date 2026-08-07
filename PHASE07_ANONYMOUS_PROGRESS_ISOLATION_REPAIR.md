# Phase 07 Pass 1E-R1 — anonymous progress isolation repair

## Defect

Public selected-A routes rendered Phase 02 demonstration completion values whenever
no authenticated `progressProjection` was supplied. The values were deterministic,
not random database rows, but they looked like personal progress: M01 showed `2 / 5`
and M04 showed `5 / 5`.

## Accepted behavior

- anonymous/public shells show zero completed lessons, zero completed modules and no
  completed projects;
- all public lessons and projects remain available;
- Course Overview starts at `0 / 40`, `0 / 8`, `0 / 8`;
- the public primary action starts at M01 · L01 Overview;
- the disclosure directs learners to «Мой курс» for saved personal progress;
- authenticated `/prototype/a/dashboard` keeps the real own-row projection;
- Phase 02 demo states remain only in explicit showcase fixtures;
- no database, migration, policy, grant, Auth, completion, Quiz, project workflow,
  Storage, dependency, route or environment change.

## Source boundary

This repair is source-only. It changes the selected-A course composition and shell
fallback plus tests/documentation. It does not create or modify learner rows.
