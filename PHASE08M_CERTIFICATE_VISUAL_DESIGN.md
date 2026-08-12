# ARCH.START — Phase 08M Pass 3 Certificate Visual Design and Browser PDF

## Accepted predecessor

- branch: `phase-08m-certificate-mvp`
- accepted Pass 2 HEAD: `78b00596918c746ee5faaee75bd16e8e78989af3`
- accepted Pass 2 tree: `d3f28631571a9503493325d7953ec81688218d8b`
- Pass 1 hosted certificate authority: accepted
- Pass 2 functional surfaces and positive/negative hosted acceptance: accepted
- positive-QA fixture cleanup: accepted

## Owner visual authority

The explicit `PHASE08M_CERTIFICATE_VISUAL_DESIGN_GATE` is opened by the owner-approved Canva composition and its clean architectural background.

Frozen decisions:

- use the supplied 2048 × 1447 architectural facade background byte-for-byte;
- keep the certificate background on the app-owned `/certificate-assets/` path so the existing external `/prototype-assets/` redirect cannot replace or break it;
- preserve the approved asymmetric composition as closely as responsive HTML permits;
- IBM Plex Sans Regular for certificate text;
- IBM Plex Sans Medium for `ARCH.START`;
- dynamic learner value is first name plus last name only;
- the name area may adapt its size and two-line balance for long names;
- generate a real QR code that points only to the existing public certificate verification route;
- preserve the exact course title/version, issue date, certificate code and non-accreditation disclaimer;
- revoked records use the same composition with a clear terminal overlay;
- print as one A4 landscape page through the browser print dialog.

## Bounded implementation

Pass 3 adds:

- one approved local PNG background asset;
- one server-rendered certificate artwork component;
- one real SVG QR generated from `NEXT_PUBLIC_SITE_URL + /certificate/[certificateCode]`;
- one client-only browser print control with no authority payload;
- A4 landscape print CSS;
- the same artwork on private issued/revoked and public VALID/REVOKED surfaces;
- deterministic name-layout logic and focused tests.

Pass 3 does not add:

- a database migration or new RPC;
- certificate Storage or server-side PDF generation;
- email, public registry, search or admin certificate UI;
- user UUID, email, progress, project, review or revocation reason disclosure;
- certificate reissue or name correction after issuance;
- Phase 09 work.

The QR is a visual verification affordance approved at the owner gate. It encodes no private payload and does not modify the accepted certificate database authority.
