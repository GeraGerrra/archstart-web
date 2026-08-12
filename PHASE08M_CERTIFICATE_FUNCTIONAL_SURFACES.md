# ARCH.START — Phase 08M Pass 2 Certificate Functional Surfaces

## Accepted predecessor

- branch: `phase-08m-certificate-mvp`
- Pass 1 commit: `c00bbf09eaf83476719011d12ac4176894f0f3e5`
- Pass 1 tree: `5a1ef0134511be38e505c708fe2b20c583d46607`
- hosted certificate authority: accepted
- certificate rows before Pass 2: `0`
- certificate Storage buckets: `0`

## Included functional layer

Pass 2 adds only the application layer over the accepted certificate database authority:

- server-only parsing and projection of `get_my_course_certificate_eligibility()`;
- owner-only snapshot read through the accepted RLS table boundary;
- parameter-free `issueMyCourseCertificateAction()`;
- truthful Dashboard states: locked, eligible, issued, revoked and unavailable;
- private functional route `/prototype/a/certificate`;
- public functional route `/certificate/[certificateCode]`;
- public `noindex`, `nofollow`, minimal disclosure and generic not-found behavior;
- fixed safe Russian error messages;
- focused source tests and full predecessor regression gates.

## Security and ownership

- browser input supplies no user ID, display name, eligibility, certificate code, timestamps or course identity;
- issue reuses the accepted authenticated database RPC;
- issued display name is read from the immutable certificate snapshot, not from the current profile;
- private certificate data remains behind authenticated own-row RLS;
- public verification exposes only snapshot name, course title/version, issue date, code and VALID/REVOKED;
- email, user UUID, progress details, project files, reviews, staff data and revocation reason are not public;
- malformed and unknown codes produce the same public not-found state;
- no certificate Storage, PDF generation, QR, email or admin certificate UI is added.

## Explicit visual boundary

The private certificate route is a functional semantic skeleton only. Pass 2 does not finalize:

- A4 composition;
- print stylesheet or Save as PDF control;
- final typography;
- architectural image/cutout treatment;
- decorative frame, drawing grid or ornament;
- QR code.

The final HTML/CSS certificate art direction remains blocked by the explicit owner gate:

`PHASE08M_CERTIFICATE_VISUAL_DESIGN_GATE`.
