# ARCH.START — Phase 08P Production Readiness Scope Lock

## Accepted predecessor

Phase 08P begins from the closed Phase 08M merge:

- branch: `phase-08p-production-readiness`
- base HEAD: `4aa5f89fab7b55be3bcead533701e7019fcc629c`
- base TREE: `c1a2c324995f198269901609286fb7022e92027f`
- source context SHA-256: `6a326e0f839716580abc63e31145926029127abf56e00d0f95b8f1ad2479e426`

## Ordered passes

1. **P1 — Historical prototype preservation and runtime inventory.**
   Preserve A/B/C source locally and map every live route, redirect, path
   consumer, indexing boundary, mobile defect candidate and injected-control
   boundary. P1 changes no runtime behavior.
2. **P2 — Canonical production routes and compatibility redirects.**
3. **P3 — Mobile layout and horizontal-overflow repair.**
4. **P4 — Floating preview/help control removal after source classification.**
5. **P5 — `archdotstart.com` cutover, Auth URLs, canonical metadata and QR origin.**
6. **P6 — Footer Course Development history bridge.**
7. **P7 — Final Production acceptance.**
8. **After P7 — Course Development content and visual approval.**

## P1 hard exclusions

- no deletion or redirect of `/prototype/a`, `/prototype-review` or `/prototypes`;
- no application UI/CSS mutation;
- no Supabase migration or hosted SQL;
- no Storage mutation;
- no Vercel setting or deployment promotion;
- no domain or environment-variable change;
- no Auth callback change;
- no certificate issuance/revocation operation.

## Preservation authority

The separate owner-retained archive is:

- `ARCHSTART_PHASE_08P_PASS_1_HISTORICAL_ABC_ARCHIVE.zip`
- SHA-256: `47cbf4f7d5ef75d728b01b2f17ee774db83e871c23302408a23469f1c185a584`

It is not committed to Git. Its manifest preserves byte hashes for the Phase 02
review and A/B/C source plus exact external asset references. The full accepted
source context remains the ultimate reconstruction authority.
