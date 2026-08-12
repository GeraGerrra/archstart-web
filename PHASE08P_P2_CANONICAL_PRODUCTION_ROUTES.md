# ARCH.START Phase 08P · Pass 2 — Canonical Production Routes and Compatibility Redirects

## Verdict

`SOURCE CANDIDATE — canonical route layer implemented; Preview acceptance pending`

P2 starts from the committed P1 authority:

- branch: `phase-08p-production-readiness`
- HEAD: `2d22d354a89f34ccd07848688131328dae822f3a`
- TREE: `3b63d00672d25c922c4f457c4df18e8b7c395d2b`
- source context: `ARCHSTART_PHASE_08P_PASS_2_SOURCE_CONTEXT.zip`
- source context SHA-256: `6c7f2057999d1d7b41d66fc4e44a46bca0fd0cb77fa86aeb9cfb5d822495b28e`

## Canonical learner and staff routes

The selected Studio Precision product is now first-class at root-level paths:

- `/` — public Home;
- `/course` — course overview;
- `/course/[moduleCode]` — module overview;
- `/course/[moduleCode]/[lessonCode]/[item]` — lesson item;
- `/course/[moduleCode]/project` — project workspace;
- `/dashboard` — authenticated learner Dashboard;
- `/review` — authenticated and server-authorized staff workspace;
- `/certificate` — private learner certificate;
- `/certificate/[certificateCode]` — public verification, unchanged.

The route wrappers retain the accepted progress, Quiz, completion, project,
review, certificate and anonymous-projection implementations. No authority is
moved into the browser and no payload gains identity, role, score or certificate
control.

## Compatibility redirects

`next.config.ts` installs permanent method-preserving redirects from the former
selected-A URLs:

- `/prototype/a` and `/prototype/a/home` → `/`;
- `/prototype/a/course` → `/course`;
- `/prototype/a/course/:path*` → `/course/:path*`;
- `/prototype/a/dashboard` → `/dashboard`;
- `/prototype/a/review` → `/review`;
- `/prototype/a/certificate` → `/certificate`;
- old `slides` and `transcript` aliases → canonical `lecture-materials`.

Equivalent `/course/.../slides` and `/course/.../transcript` aliases also
redirect to `lecture-materials`. Redirect rules are ordered before the generic
course wildcard. Next.js forwards query parameters not consumed by the
destination, preserving QA state queries, module expansion and Auth return
state. Permanent redirects use 308 semantics and therefore do not rewrite POST
to GET.

The old selected-A route files remain source-preserved during P2 as a dormant
fallback and regression reference, but the redirect table intercepts those
public URLs before the filesystem route. Historical `/prototype-review` and
`/prototypes/a|b|c/...` routes remain byte-preserved and noindexed until P6.

## Central path authority

`src/routing/production-routes.ts` owns:

- canonical route constants;
- module, project and lesson path builders;
- legacy pathname canonicalization used by Auth destinations;
- exact protected-route classification;
- the compatibility redirect table.

Selected-A shell links, Dashboard actions, certificate controls, completion
revalidation and project-workspace revalidation now consume canonical paths.

## Authentication boundary

The proxy protects only exact private surfaces. `/certificate` is protected,
while `/certificate/[certificateCode]` remains public. Legacy private paths are
also recognized in case a request reaches the proxy before redirect handling.
Safe Auth destinations canonicalize former selected-A pathnames and retain
query and fragment components.

## Output tracing

The PDF worker trace is attached to both canonical project/review routes and the
legacy fallback routes. This preserves project PDF inspection on Vercel while
compatibility routing is accepted.

## Explicit non-goals

P2 changes no:

- CSS or mobile geometry — deferred to P3;
- floating Vercel/browser control — deferred to P4;
- environment variable, custom domain, Auth Site URL or QR origin — deferred to P5;
- footer history destination or Course Development content — deferred to P6;
- Supabase schema, RLS, RPC, Storage object or certificate row;
- dependency or lockfile.

## Preview acceptance required before P2 acceptance

The owner must verify on the exact Preview deployment:

1. canonical Home, Course, module, lesson and project routes;
2. anonymous zero-state and authenticated learner progress parity;
3. Dashboard, private certificate and public certificate verification;
4. staff review authorization and denied-user redirect;
5. old `/prototype/a/...` URLs return one compatibility redirect and preserve
   query parameters;
6. old slides/transcript URLs land directly on `lecture-materials`;
7. Runtime Logs contain no warning, error or fatal entries caused by P2.

The source candidate is committed and pushed only after the local owner gate. P2 is accepted only after the exact Vercel Preview passes the checks above. P3 must not begin before that Preview acceptance.
