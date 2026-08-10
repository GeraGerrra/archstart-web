# ARCH.START — Phase 08M Certificate MVP Scope Lock

## Accepted predecessor

Phase 08M starts only from the formally closed Phase 07 production source:

- main HEAD: `ffae1946ceba5ce3d0f06e811f2b637b178b4c09`
- main tree: `b7d5bcd48d9063dbd169035e340914f2bf712202`
- Phase 07 status: closed
- M08 accepted file remains attached to version 1, but the submission remains `draft` and unsubmitted.

## Product contract

A learner is eligible to issue one ARCH.START Certificate of Completion only when all three conditions are true:

1. all 40 canonical lesson codes have rows in `public.lesson_completions` for the authenticated learner;
2. all 8 canonical project codes have one learner-owned `public.project_submissions` row with `current_status = 'accepted'`;
3. the learner profile contains non-empty first and last names.

Quiz score is not an eligibility input. Project review is not repeated at certificate time.

## MVP certificate states

- `locked`: eligibility is incomplete and no certificate exists;
- `eligible`: eligibility is complete and no certificate exists;
- `issued`: one valid certificate exists;
- `revoked`: the one certificate exists and has been revoked.

`locked` and `eligible` are computed. `issued` and `revoked` are database-backed.

## Included in Phase 08M

- one certificate authority table;
- authenticated, parameter-free eligibility and issuance RPCs;
- idempotent issuance and immutable name snapshot;
- owner-only private read boundary;
- minimal public verification by unpredictable certificate code;
- service-role-only terminal revocation;
- Dashboard certificate card;
- private printable HTML certificate and browser Save as PDF;
- Preview acceptance and short Production smoke.

## Explicitly excluded

- certificate request/approval workflow;
- a second reviewer queue;
- server-side PDF generation or certificate Storage bucket;
- email, QR code, public graduate registry or name search;
- certificate admin dashboard;
- certificate reissue or name correction after issuance;
- final-feedback subsystem;
- multiple certificate types or separate localized certificates;
- accreditation, university credit or professional-license claims.

## Fixed certificate identity

- course code: `ARCHSTART_CORE`
- course version: `2026.08`
- course title snapshot: `ARCH.START — русскоязычный вводный курс архитектуры`
- certificate code format: `as-` followed by 32 lowercase hexadecimal characters
- one lifetime certificate row per user in this MVP

## Database authority rules

- browser roles cannot insert, update or delete certificate rows;
- browser input never supplies user ID, eligibility, display name, certificate code or timestamps;
- issue uses `auth.uid()` and rechecks eligibility in the database;
- repeated issue calls return the same certificate;
- revoked certificates cannot become valid or be reissued;
- public verification discloses only snapshot name, course title/version, issue date, code and `VALID`/`REVOKED`;
- email, UUID, progress, project files, reviews, staff data and revocation reason are never public.
