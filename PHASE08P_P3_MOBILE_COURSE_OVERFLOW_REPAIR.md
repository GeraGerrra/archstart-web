# ARCH.START — Phase 08P Pass 3 Mobile Course Overflow Repair

## Accepted predecessor

Pass 3 starts from the hosted-accepted canonical-route commit on
`phase-08p-production-readiness`:

- HEAD: `ece3e92253c95fda9eb103ba40aa53cf53382424`
- TREE: `5917f60ad09d107d829a8b8a9bc7094bc6f5a2d7`
- source context SHA-256: `7a164a90754c7f4255907502fa1f1aec25bf68992566bc695479dbece5d71fbc`
- source files: `486`

P2 canonical routes, legacy `308` redirects, learner state, staff access and
runtime logs were accepted before this pass. P3 does not reopen that route or
authority work.

## Defect

At mobile widths the `/course` module cards expanded beyond their one-column
grid. `body { overflow-x: hidden }` and `.asa { overflow-x: clip }` concealed
the oversized geometry, so the right card borders appeared displaced instead
of exposing a scrollbar.

The browser-reproduced root cause recorded in P1 had three parts:

1. the later mobile `.asa h2` rule had equal specificity and overrode the
   intended `22px` module-card heading;
2. automatic minimum sizes remained active in the card, identity, lesson and
   project grid tracks;
3. the one-column grid used `1fr` rather than an explicitly shrinkable
   `minmax(0, 1fr)` track.

At `390px`, the accepted P2 source produced a `456.8125px` card inside a
`343px` grid. Similar overflow existed at `320`, `360`, `375`, `412` and
`430px`.

## Repair

The repair is intentionally limited to `app/globals.css`:

- make each course module a bounded `width: 100%`, `min-width: 0` flex item;
- make identity, lesson and project text tracks `minmax(0, 1fr)`;
- give text-bearing children `min-width: 0` and explicit wrapping;
- make the single-column course grid `minmax(0, 1fr)` at `<= 920px`;
- reassert the approved `22px / 1.18` module-card heading after the generic
  mobile `.asa h2` rule;
- preserve the generic mobile heading scale for every non-card heading;
- do not use clipping or hidden overflow as the repair.

No React markup changes are required.

## Browser geometry acceptance

An isolated Chromium geometry harness loaded the exact production CSS, design
tokens and all eight real module, lesson and project strings. After the repair:

| Viewport | Document client | Grid | Widest card | Card overflow |
|---:|---:|---:|---:|:---:|
| 320 | 305 | 273 | 273 | no |
| 360 | 345 | 313 | 313 | no |
| 375 | 360 | 328 | 328 | no |
| 390 | 375 | 343 | 343 | no |
| 412 | 397 | 365 | 365 | no |
| 430 | 415 | 383 | 383 | no |
| 640 | 625 | 593 | 593 | no |
| 641 | 626 | 574.75 | 574.75 | no |
| 920 | 905 | 831.40625 | 831.40625 | no |
| 921 | 906 | 832.34375 | 405.171875 | no |

At `1024px` and `1440px`, grid and card widths remain unchanged from the
accepted predecessor. At the `920/921px` responsive boundary, the prior
internal `15px` grid scroll overflow at `921px` is also removed.

Hosted Preview acceptance must still verify the real `/course` surface at
`320`, `360`, `375`, `390`, `412`, `430`, tablet and desktop widths.

## Scope boundary

P3 changes exactly five paths: one CSS file, two authority documents and two
tests. It does not change:

- routes or redirects;
- Auth, onboarding or profile behavior;
- learner progress, Quiz, projects or certificates;
- Supabase migrations, database rows or Storage;
- dependencies or lockfile;
- Vercel settings, domain or environment variables;
- the historical A/B/C archive;
- the floating preview/help control;
- footer Course Development content.

P4 remains responsible for the floating control, P5 for `archdotstart.com`, P6
for the footer history bridge, and P7 for final Production acceptance.
