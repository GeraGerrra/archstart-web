# ARCH.START Phase 08P · Pass 1 — Historical Prototype Preservation and Runtime Inventory

## Verdict

`PASS — source-only inventory candidate`

The accepted source was independently reconstructed to TREE `c1a2c324995f198269901609286fb7022e92027f` from
`ARCHSTART_PHASE_08P_P1_SOURCE_CONTEXT.zip` (`6a326e0f839716580abc63e31145926029127abf56e00d0f95b8f1ad2479e426`). P1 introduces only documentation, a
machine-readable inventory and a focused source-contract test. No runtime file,
SQL migration, Storage object, Vercel setting or domain is changed.

## Historical A/B/C preservation

A dedicated owner-local archive was built before later route cleanup:

- file: `ARCHSTART_PHASE_08P_PASS_1_HISTORICAL_ABC_ARCHIVE.zip`
- SHA-256: `47cbf4f7d5ef75d728b01b2f17ee774db83e871c23302408a23469f1c185a584`
- preserved source files: 36
- preserved source bytes: 2481934
- exact external asset references: 4

The archive includes `/prototype-review`, all 12 generated A/B/C historical
surfaces, generic prototype components, full CSS/tokens, M01 canonical data and
the accepted asset manifest. It intentionally does not duplicate the accepted
~1 GB external asset corpus; those bytes remain governed by exact manifest
paths and SHA-256 values.

## Current route topology

### Live product still nested under a prototype prefix

- `/` redirects to `/prototype/a/home`.
- `/prototype/a` redirects to `/prototype/a/home`.
- selected-A fixed pages: Home, Course, Dashboard, Certificate and Staff Review.
- 8 module pages and 8 module-project pages.
- 240 canonical lesson-item pages (40 lessons × 6 items).
- 80 legacy `slides` / `transcript` redirects.

Total selected-A route instances represented by the current App Router source:
**342**.

### Stable routes already outside the prefix

Auth, onboarding, profile and public certificate verification already use
root-level routes. Public certificate verification is `/certificate/[certificateCode]`.

### Historical routes

`/prototype-review` plus 12 `/prototypes/a|b|c/...` surfaces remain deployed and
noindexed. These are history evidence, not the Russian learner product.

## Route-normalization blast radius

The exact string `/prototype/a` appears in:

- 63 runtime-source lines across 28 runtime files;
- 18 test lines;
- 3 script lines;
- 5 deployment-evidence lines;
- 54 documentation/authority lines.

Therefore P2 must be a coordinated route-layer change rather than a folder rename.
It must update route files, path builders, guards, Auth destinations, revalidation,
certificate controls, staff links, output tracing and affected tests together.

## Floating black control

The source contains no `@vercel/toolbar` dependency, no toolbar import and no
application-owned fixed circular control. The only `position: fixed` declarations
are the skip link and modal/drawer overlays. The visible black circle is therefore
classified for P4 as a **deployment/browser injection candidate**, not something
to delete blindly from application code.

## Mobile Course Overview defect

The defect is now browser-reproduced, not merely suspected. Headless Chromium
rendering of all eight real module cards against the accepted CSS measured every
card wider than the content viewport at 390, 412 and 430 CSS px:

- 390 px viewport: card `456.8125 px`, right edge `472.8125 px`;
- 412 px viewport: card `477.09375 px`, right edge `493.09375 px`;
- 430 px viewport: card `493.921875 px`, right edge `509.921875 px`.

The compound root cause is exact: the later mobile `.asa h2` rule has equal
specificity and overrides the card-specific 22 px heading rule, while the `1fr`
course track, card and identity text track retain automatic minimum widths. The
large heading min-content width therefore expands the whole card. `body`
`overflow-x:hidden` and `.asa` `overflow-x:clip` hide the overflow and make the
right borders look displaced. At 640 and 920 px the cards fit.

P1 records the proof only. P3 will apply the bounded `minmax(0,1fr)`,
`min-width:0`, card-heading cascade and wrapping repair.

## SEO and domain readiness

The root metadata and all prototype layouts are currently `noindex`; canonical
metadata is absent. `NEXT_PUBLIC_SITE_URL` controls both Auth callback origins and
certificate QR URLs. Therefore domain cutover cannot be performed as an isolated
Vercel alias change: P5 must update Vercel, Supabase Auth URL policy, environment
variables, canonical metadata and QR verification origin as one accepted operation.

## Next authorized pass

P2 may begin only after this inventory is committed and the external archive is
stored by the owner. P2 will introduce canonical learner routes and compatibility
redirects while preserving current behavior and server authority.
