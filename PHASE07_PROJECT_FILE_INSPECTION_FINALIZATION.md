# ARCH.START Phase 07.2C2C — project file inspection and finalization

This bounded backend/security source pass completes the server-owned step after
the accepted signed standard or TUS transfer. It does **not** add project UI,
public Storage access, hosted mutation, notification, certificate, deployment,
or Phase 08 code.

## Accepted authority

- Source: `main@bb0d07169dac4f7e065d84a126a7e875e1bdc62c`.
- Git tree: `f0c55125b41a4cb53933ec4a2d33bc7f554e82c7`.
- Source-context SHA-256:
  `9426609bacaf04475a0bcef8858668ab2d336357ca8de6fb6ac1aec30edecf9c`.
- Accepted bucket: private `project-submissions`, 41,943,040-byte maximum,
  PDF/PNG only, with no project Storage object policies.
- Accepted object path:
  `<user_uuid>/<submission_uuid>/<version_uuid>/<planned_file_uuid>.<pdf|png>`.

## Server-owned finalization

The browser submits only `intentId`. The server derives the authenticated user
from verified Supabase session claims and calls a service-role-only context RPC.
That RPC returns inspection context only for the owned, pending, unexpired,
editable draft with an unchanged frozen policy and canonical path. Finalized
retries return only the planned file identity. Expired or inconsistent rows
return a cleanup disposition rather than usable inspection context.

The server downloads only the database-owned private object, enforces 1 through
41,943,040 bytes, requires exact equality with the declared size, and calculates
a lowercase SHA-256 with Node crypto. It never logs bytes, parser errors, tokens,
private paths, signed URLs, or credentials.

PNG inspection verifies the canonical signature, a 13-byte first `IHDR`, legal
bit-depth/color-type combinations, compression/filter/interlace fields, and the
IHDR CRC. Frozen policy then requires a single-board PNG of exactly 1920 × 1080.

PDF inspection uses the pinned maintained server dependency `pdfjs-dist@6.2.108`.
Page count comes from the parser, never regex. Malformed, encrypted, unsupported,
or unreadable PDFs receive allowlisted public rejection codes. Single-board PDF
requires one page; M08 preserves its frozen 8–10-page range.

`finalize_project_upload_intent` performs a non-locking identity-only pre-read
of the owned intent's version, takes the same `(requester user, version)`
transaction advisory lock as intent creation, locks the version and submission
before the intent, and then revalidates the locked intent's user/version/
submission identity. Inside that transaction it rechecks draft state, expiry,
policy, MIME, byte size, canonical path, planned file identity, and absence of a
competing file; sets only the accepted transaction-local trigger guards; inserts
one valid `project_submission_files` row with `id = planned_file_id`; and closes
the intent as finalized. The compatible lock order and existing unique
constraints preserve idempotent retry and exactly-one-file behavior.

## Rejection and cleanup

Only allowlisted stable reason codes can be persisted. An invalid object is
removed at its exact trusted path before its still-pending intent is closed.
Absent-object removal is idempotent. A failed removal returns `cleanup-failed`
and never reports finalization. Raw filenames, URLs, parser messages, bytes, or
secrets are never used as close reasons.

The optional stale cleanup action accepts no browser-controlled path or batch
size. It requires an authenticated active admin and requests exactly twenty
rows. Expired pending intents remain eligible even when their exact object is
already absent, preserving idempotent closure. Terminal `expired` or `cancelled`
intents are eligible after their original expiry only while their exact reserved
object still exists in `storage.objects`, so removal naturally bounds repeat
selection without rewriting immutable history. An actual finalized file with
the same ID or exact bucket/path is always protected; a different finalized file
on the version does not blanket-protect a competing orphan object. The server
still revalidates the canonical path, removes only that exact object, and returns
stable counts/status codes. No cron, route, UI, or Vercel configuration is added.

## Authorized private download

The download action accepts only `fileId`. A service-role-only authorization RPC
allows the valid file owner, an active admin, or an active reviewer assigned to
that submission. Everyone else, including another learner and an unassigned
reviewer, receives the same non-disclosing denial. The action returns only a
60-second signed URL and expiry; bucket and object path are never separate
response fields.

## Verification boundary

The migration is supplied as source only. Hosted Supabase, real Storage, Git,
Vercel, deployment, and Phase 08 remain unchanged. Read-only hosted SQL and a
separate rollback-only two-account template expose the R1 selector and lock-order
postconditions for later supervised acceptance. The template validates planned
identity, idempotency, owner/admin/assigned-reviewer access, denial isolation,
exact-path metadata cleanup, and rollback of all inserted rows; it explicitly
does not claim live Storage-object cleanup acceptance.
