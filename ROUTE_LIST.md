<!-- PHASE06_PASS1_CURRENT -->
# ARCH.START Route List — Phase 06 Pass 1

| Route | Access | Purpose |
|---|---|---|
| `/auth/sign-up` | public | email/password registration |
| `/auth/sign-in` | public | email/password sign-in |
| `/auth/check-email` | public | truthful confirmation/recovery notice |
| `/auth/confirm` | public route handler | PKCE or token-hash exchange |
| `/auth/forgot-password` | public | non-enumerating reset request |
| `/auth/update-password` | authenticated recovery session | set new password |
| `/onboarding` | authenticated | first-run profile completion |
| `/profile` | authenticated + onboarded | edit own profile and sign out |
| `/prototype/a/dashboard` | authenticated + onboarded | truthful account shell |

All `/prototype/a/course` module, lesson, project, Quiz and Further Study routes
remain public and unchanged. Phase 07/08 routes or workflows were not added.

<!-- PHASE03_PASS5A3_HISTORICAL -->
# ARCH.START Route List — Phase 03 Pass 5A.3 Source Checkpoint

**PROJECT ROUTES NOW REACHABLE FROM UPPER MODULE NAVIGATION · LIVE BROWSER QA NOT RUN · NOT FINAL · NOT ACCEPTED**

No route was added, removed or rewritten.

## Existing project route family

| Module | Existing project destination | Desktop module panel | Mobile module drawer |
|---|---|---|---|
| M01 | `/prototype/a/course/m01/project` | native link | native link |
| M02 | `/prototype/a/course/m02/project` | native link | native link |
| M03 | `/prototype/a/course/m03/project` | native link | native link |
| M04 | `/prototype/a/course/m04/project` | native link | native link |
| M05 | `/prototype/a/course/m05/project` | native link | native link |
| M06 | `/prototype/a/course/m06/project` | native link | native link |
| M07 | `/prototype/a/course/m07/project` | native link | native link |
| M08 | `/prototype/a/course/m08/project` | native link | native link |

The adapter remains the single route source through
`module.project.href = pathProject(module.code)`. Existing module-page and
lesson links remain unchanged. The project card/row falls back to non-interactive
content only when `href` is absent. No click-handler route surrogate or nested
interactive control was introduced.

**LIVE BROWSER QA NOT RUN**  
**PASS 5B NOT STARTED**  
**PHASE 04 NOT STARTED**

<!-- PHASE03_PASS5A2_HISTORICAL -->
# ARCH.START Route List — Phase 03 Pass 5A.2 Source Checkpoint

**LOCKED COMPLETION PRESENCE IMPLEMENTED · LIVE BROWSER QA NOT YET RE-RUN · NOT FINAL · NOT ACCEPTED**

No public path was added.

## Completion route-state matrix

| Route | No completion query | Explicit ready | Explicit complete |
|---|---|---|---|
| `/prototype/a/course/m01/l01/quiz` (also L02–L05) | locked lesson | `?state=lesson-ready` | `?state=lesson-complete` |
| `/prototype/a/course/m01` | locked module | `?state=module-ready` | `?state=module-complete` |

Non-Quiz M01 lesson-item routes render no completion control. M02–M08 module
routes render no Phase 03 completion control. `/dev/design-system` remains a
development-only, production-prohibited route and is absent from public
navigation. Pass 5B and Phase 04 are not started.

<!-- PHASE03_PASS5A_PREVIOUS -->
<!-- PHASE03_PASS5A_CURRENT -->
# ARCH.START Route List — Phase 03 Browser QA Checkpoint

**PHASE 03 BROWSER QA CHECKPOINT · BROWSER QA INFRASTRUCTURE BLOCKED · NOT FINAL · NOT ACCEPTED**

Supplemental local HTTP requests returned 200 for `/dev/design-system` and the
required selected-A smoke routes. Live browser routing, interaction and
viewport verification remain unexecuted. Replit is required to complete Pass
5A.

<!-- PHASE03_PASS4B_HISTORICAL -->
# ARCH.START Route List — Phase 03 Source Checkpoint

**PHASE 03 SOURCE CHECKPOINT · PASS 4B COMPLETE FOR SOURCE · NOT FINAL · NOT ACCEPTED**

## New development-only route

| Route | Environment | Navigation | Purpose |
|---|---|---|---|
| `/dev/design-system` | development only; `notFound()` in production | absent from public navigation | approved reusable component/state showcase |

All accepted public and learner routes remain unchanged. Browser QA, final
acceptance and Phase 04 are not started.

<!-- HISTORICAL_RECORDS -->

## Historical records preserved below

# PASS 2 V3 ROUTE QA ADDENDUM

The source-transpiled static review rendered 56 selected-A routes/states at 1440 px and 8 selected routes at 390 px without broken images or horizontal overflow. Legacy `/slides` and `/transcript` redirect source remains present. Runtime redirects, Next.js query-state routing and browser Back/Forward remain pending the live app run.

---

# ROUTE AND DEMO-STATE LIST — PHASE 02 V3 SOURCE CHECKPOINT V3

## Next.js prototype routes

```text
/prototype/a                         -> redirects to /prototype/a/home
/prototype/a/home
/prototype/a/dashboard
/prototype/a/course
/prototype/a/course/[moduleCode]
/prototype/a/course/[moduleCode]/project
/prototype/a/course/[moduleCode]/[lessonCode]/[item]
```

All routes under `/prototype` inherit the existing noindex/nofollow/nocache boundary.

## M01 canonical lesson-item map

For each of `l01`, `l02`, `l03`, `l04`, `l05`:

```text
/prototype/a/course/m01/{lesson}/overview
/prototype/a/course/m01/{lesson}/vocabulary
/prototype/a/course/m01/{lesson}/video
/prototype/a/course/m01/{lesson}/lecture-materials
/prototype/a/course/m01/{lesson}/practice
/prototype/a/course/m01/{lesson}/quiz
```

Canonical learner title for `lecture-materials`:

```text
RU: Слайды и транскрипт
EN: Slides & Transcript
```

Current M01 accepted resource arrays are empty, so `/resources` is not generated as a canonical branch.

## Legacy redirects

```text
/prototype/a/course/m01/{lesson}/transcript -> .../{lesson}/lecture-materials
/prototype/a/course/m01/{lesson}/slides     -> .../{lesson}/lecture-materials
```

Legacy URLs do not create separate learner items.

## Lesson-specific visual behavior

- `m01/l01`: registry-backed Vocabulary PDF/pages, 24 slide images/presentation PDF and Practice example.
- `m01/l02` through `m01/l05`: no L01 visual URLs; Vocabulary and slide pane use the approved pending sentence; transcript/task data remains lesson-specific; Practice example section is omitted.

## Explicit lesson completion states

```text
/prototype/a/course/m01/l01/quiz
  default: no completion control

/prototype/a/course/m01/l01/quiz?state=lesson-ready
  incomplete lesson completion control

/prototype/a/course/m01/l01/quiz?state=lesson-complete
  completed lesson state
```

The same explicit state handling applies to valid M01 lesson routes; completion is rendered only on the Quiz item.

## Explicit module completion states

```text
/prototype/a/course/m01
  default: 2/5, no module completion control

/prototype/a/course/m01?state=module-ready
  incomplete module completion control

/prototype/a/course/m01?state=module-complete
  completed state, 5/5 Phase 02 demonstration progress
```

These query states are non-persistent Phase 02 demonstrations.

## Final-item next actions

```text
M01_L01 final item -> /prototype/a/course/m01/l02/overview
M01_L02 final item -> /prototype/a/course/m01/l03/overview
M01_L03 final item -> /prototype/a/course/m01/l04/overview
M01_L04 final item -> /prototype/a/course/m01/l05/overview
M01_L05 final item -> /prototype/a/course/m01/project
```

M01_L05 completed next action uses the same Project 01 route and never returns to L05.

## Module and project routes demonstrated

```text
/prototype/a/course/m01 ... /prototype/a/course/m08
/prototype/a/course/m01/project ... /prototype/a/course/m08/project
```

M02–M08 module pages use accepted course summary records only. Full lesson import for those modules was not started.

## Prepared static-review state paths

The dependency-free renderer source prepares these local static-review paths:

```text
/states/selected-a/module-menu-open
/states/selected-a/mobile-modules-open
/states/selected-a/lesson-ready
/states/selected-a/lesson-complete
/states/selected-a/module-ready
/states/selected-a/module-complete
/states/selected-a/mobile-contents-open
```

The header-centering measurements at 1440, 1280, 1024 and 920 px were executed against the live production application and passed.

## Review/history routes

```text
/prototype-review
/prototypes/b/home
/prototypes/b/dashboard
/prototypes/b/module/m01
/prototypes/b/lesson/m01-l01
/prototypes/c/home
/prototypes/c/dashboard
/prototypes/c/module/m01
/prototypes/c/lesson/m01-l01
```

B and C remain design-history evidence only.

## Final runtime verification

- All selected-A routes listed above were crawled at desktop and 390 px.
- `/prototype/a/course/m01/l01/slides` and `/prototype/a/course/m01/l01/transcript` return runtime redirects to `/prototype/a/course/m01/l01/lecture-materials`.
- Explicit `lesson-ready`, `lesson-complete`, `module-ready` and `module-complete` query states were exercised in React.
- `/prototype-review` returns 200.
- A nonexistent selected-A route returns the expected 404.
- No Phase 03 route exists.
