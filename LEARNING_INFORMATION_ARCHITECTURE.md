<!-- PHASE03_PASS5A2_CURRENT -->
# LEARNING INFORMATION ARCHITECTURE — PHASE 03 PASS 5A.2

**LOCKED COMPLETION PRESENCE IMPLEMENTED · LIVE BROWSER QA NOT YET RE-RUN · NOT FINAL · NOT ACCEPTED**

Completion remains a route/demo-driven Phase 03 surface with three states:
`locked`, `ready`, and `complete`.

## Established placement

- Lesson completion appears once, after the active content of the final core
  item `Quiz`. Overview, Vocabulary, Video, Slides & Transcript, Practice and
  Resources never duplicate it.
- Module completion appears once at the bottom of the M01 Module Overview.
- M02–M08 receive no module completion control before their real content import.
- No course-level completion or certificate surface exists in this pass.

## Normal and explicit states

- normal M01 Quiz route: locked lesson cutout;
- normal M01 Module route: locked module cutout;
- `lesson-ready` / `module-ready`: enabled local demo control;
- `lesson-complete` / `module-complete`: accepted complete presentation.

Locked means visible but native-disabled. It is not a hidden placeholder and it
does not represent persisted progress or computed eligibility.

---

# PASS 2 V3 RESPONSIVE ADDENDUM

- Mobile primary navigation exposes all three global destinations through a compact `МЕНЮ` drawer and remains separate from the `МОДУЛИ` drawer.
- Mobile Slides & Transcript defaults to one active transcript section below the current slide. `Весь транскрипт` expands all sections and exposes transcript search; thumbnails remain in a horizontal rail.
- The Home collage uses independently scaled paper images over controlled transparent anchor targets; no dangerous target intersections were measured.
- The hidden `Наш пример` field uses a black background with a centered white gate.
- Static Chromium evidence is complete for these visual states; live Next.js interaction execution is still pending.

---

# LEARNING INFORMATION ARCHITECTURE — PHASE 02 V3 SOURCE CHECKPOINT V3

## Status boundary

This document describes the implemented source contract after Recovery Pass 1C V2. It is not browser-QA or production-acceptance evidence. Phase 03 has not started.

## Global hierarchy

Direction A retains four learner levels:

1. Course
2. Module
3. Lesson
4. Learning item

The global header and module strip remain separate rows. The header uses three grid tracks: equal left/right flexible tracks around the intrinsic primary navigation. The brand occupies the left track; an empty utilities cell occupies the right track. This keeps `Главная / Весь курс / Мой курс` centered against the whole header rather than the remaining space after the wordmark.

## Home

The hero uses the eight real tight transparent cutouts in official M01–M08 DOM order.

Wide source composition at and above 1100 px:

- row 1: M01, M02;
- row 2: M03, M04, M05;
- row 3: M06, M07;
- row 4: M08 centered;
- deterministic explicit placement inside a relative stage;
- natural image dimensions and alpha-aware shadows;
- modest overlap only;
- one shared stable-height caption, defaulting to the approved M01 title.

Tablet source keeps the text block first and retains 2–3–2–1 where width permits. Mobile uses two ordered columns, no overlap, restrained rotation and a short title under every cutout.

Project 01 remains a real lower-page example under `Что создают участники`.

## Course and module routes

- Course overview: `/prototype/a/course`
- Module: `/prototype/a/course/[moduleCode]`
- Module project: `/prototype/a/course/[moduleCode]/project`

Default M01 remains an in-progress 2/5 demonstration and shows no module completion control. Completion UI exists only in the explicit query states documented below.

## Lesson workspace

Canonical route template:

`/prototype/a/course/[moduleCode]/[lessonCode]/[item]`

Desktop source layout:

- global header;
- separate module strip;
- left course tree;
- focused item content;
- previous/next item navigation.

Mobile source layout:

- compact primary navigation;
- `МОДУЛИ` control;
- `СОДЕРЖАНИЕ КУРСА` control;
- focused item content;
- previous/next controls in document flow.

## Canonical learning-item order

1. `Обзор` / `Overview`
2. `Словарь` / `Vocabulary`
3. `Видео` / `Video`
4. `Слайды и транскрипт` / `Slides & Transcript`
5. `Практика` / `Practice`
6. `Квиз` / `Quiz`
7. `Материалы` / `Resources`, only when accepted resource records exist

The technical ID for the merged item is `lecture-materials`. Legacy `transcript` and `slides` routes redirect to it and are not separate learner branches.

## Lesson-specific asset contract

`src/prototypes/selected-a/lesson-assets.ts` is the typed source of truth for approved browser visual assets.

### M01_L01

- Vocabulary: real sanitized three-page PDF, page fallbacks, term index, zoom, fullscreen, open and download controls, plus manual reviewed control.
- Slides & Transcript: 24 approved slide images, sanitized presentation PDF, transcript search and bidirectional slide/section synchronization.
- Practice: real approved example behind the deliberate reveal with zoom and hide-again behavior.

### M01_L02–M01_L05

- Vocabulary: no L01 request or fallback; only `Материал будет добавлен после публикации утверждённого файла.`
- Slides & Transcript: no L01 slide/PDF URL, no thumbnails, count or download; the selected lesson’s canonical transcript remains readable.
- Practice: canonical task, tools, ordered steps and self-check remain; `Наш пример` is omitted because no approved lesson-specific example exists.

Structured vocabulary records may remain canonical data, but they do not imply that a visual PDF has been approved.

## Item responsibilities

### Overview

Objective, concise outcomes, expected duration and branch summary.

### Vocabulary

Renders the approved lesson-specific visual object when present; otherwise renders the quiet pending state without dead controls.

### Video

Uses the heading `Видеолекция` and the one approved pending sentence. It does not explain YouTube IDs, fake thumbnails or implementation plans.

### Слайды и транскрипт

Keeps slides and transcript in one focused learning item. Visual controls are conditional on lesson-specific approved slide assets; transcript text is lesson-specific canonical content.

### Practice

Contains canonical task, tools, ordered steps and self-checks. The Russian-first `Наш пример` reveal exists only when the registry supplies an approved example.

### Quiz

Contains public question and option text only. A local form submission says `Ответы отправлены.` and does not claim scoring or persistence.

### Resources

Conditional on accepted resource records.

## Explicit completion demo states

Lesson route query states:

- default: no completion control;
- `?state=lesson-ready`: incomplete cutout completion control;
- `?state=lesson-complete`: completed cutout state.

Module route query states:

- default: no completion control and M01 remains 2/5;
- `?state=module-ready`: incomplete module completion control;
- `?state=module-complete`: completed state and 5/5 Phase 02 demonstration progress.

The cutout remains the semantic completion button. The completed mark is a restrained angular graphite SVG. These states are local Phase 02 demonstrations, not persistent learner records.

## Final-item progression

- M01_L01–M01_L04: the final item continues to the next lesson Overview.
- M01_L05: the final item continues to `/prototype/a/course/m01/project` with `Перейти к Project 01`.
- M01_L05 completed next action uses the same resolver and route.

## Responsive and accessibility source contract

- pointer and keyboard access for cutouts, slide controls, transcript sections and reveal controls;
- stable caption height and non-hover-only mobile labels;
- visible focus states;
- polite live regions for reveal and completion status;
- reduced-motion suppression for nonessential motion while retaining the completed graphite mark;
- prepared browser assertions for complete-header nav centering and header/module-strip separation.

Source-transpiled static Chromium behavior at 1440, 1280, 1024, 920 and 390 px passed the recorded geometry/overflow checks.

Final Pass 3 V2 then verified the real production Next.js application. Keyboard focus, focus traps, Escape, focus return, pointer continuity, application-router Back/Forward, runtime redirects, the focused mobile transcript, the horizontal slide rail, RevealExample dialogs, completion and reduced motion all passed. The information architecture is accepted for Phase 02 V3. No persistent progress or Phase 03 architecture was added.
