# ARCH.START Phase 07.2C2B2B — Resumable TUS Transfer Core

## Scope

This pass adds the browser-side resumable transport for an existing server-issued
project-upload capability whose `transferMode` is `tus`. This pass does not
perform a live TUS upload. It does **not** add a learner UI, mint a signed
capability, create or finalize a project file row, change hosted database state,
or add a Storage policy.

The accepted chain is:

```text
private project-submissions bucket
  → database-owned upload intent
  → trusted server-side signed capability
  → standard direct transfer for files up to 6 MiB
  → this pass: resumable TUS transfer for files above 6 MiB and up to 40 MiB
```

## Exact size boundary

```text
standard maximum: 6,291,456 bytes
TUS minimum:       6,291,457 bytes
absolute maximum: 41,943,040 bytes
TUS chunk:         6,291,456 bytes
```

The controller rejects a capability or browser `File` outside this exact range.

## Direct Storage endpoint

The browser adapter derives only this endpoint shape from the accepted public
Supabase project URL:

```text
https://<20-character-project-ref>.storage.supabase.co/storage/v1/upload/resumable
```

It rejects custom origins, HTTP, credentials, ports, query strings, fragments,
and alternate paths. Every stored or newly returned upload URL must remain on
the same HTTPS origin and below the exact resumable endpoint path.

## Signed authentication and overwrite boundary

The adapter passes only:

```text
x-signature: <server-issued signed upload token>
x-upsert: false
```

It does not add a service-role key, secret key, publishable-key authorization
header, or direct `storage.objects` authority.

## TUS options

```text
library:                     tus-js-client 4.3.1
chunkSize:                   6 * 1024 * 1024
parallelUploads:             1
uploadDataDuringCreation:    true
storeFingerprintForResuming: true
removeFingerprintOnSuccess:  true
request retry delays:        0 ms, 1,500 ms, 3,000 ms
```

The upload fingerprint binds the browser file to the database-owned bucket,
object path, intent and planned-file identity. A matching local file cannot
silently resume a TUS URL created for another project path.

## Previous-upload validation

Before calling `resumeFromPreviousUpload`, every returned entry must match:

- exact file byte length;
- exact `project-submissions` bucket metadata;
- exact database-owned object path;
- exact MIME type;
- exact cache-control metadata;
- one non-parallel upload URL;
- the accepted direct Storage origin and resumable path;
- a parseable creation time no older than 24 hours.

If the previous-upload set contains an unsafe entry, the controller refuses to
start and attempts remote termination instead of silently trusting or ignoring
that entry.

## State machine

```text
idle
  → validating
  → uploading
  → succeeded

uploading
  → paused
  → uploading

uploading | paused
  → cancelled

uploading
  → failed
  → retry (one controller-level retry only)
  → uploading
  → succeeded | failed
```

A capability can enter public `start()` only once per controller instance.
Concurrent `start()` calls share the same active operation and never create a
second TUS session.

## Progress truthfulness

The controller reports real `bytesUploaded` and `bytesTotal` from TUS progress
callbacks. It caps the visible percentage at `99` while transfer callbacks are
still in flight and reports `100` only after the TUS success callback and a safe
final upload URL.

## Pause, resume and cancel

```text
pause:  upload.abort(false)
resume: upload.start()
cancel: upload.abort(true)
```

A failed termination is reported as `termination-failed`; the controller never
claims that a remote TUS session was deleted when termination could not be
confirmed.

## Retry contract

Request-level retry is allowed only for:

- network failures;
- `408 Request Timeout`;
- `423 Locked`;
- `429 Too Many Requests`;
- `5xx` Storage failures.

It is explicitly forbidden for:

- `400 Bad Request`;
- `401 Unauthorized`;
- `403 Forbidden`;
- `409 Conflict`;
- `413 Payload Too Large`;
- invalid file/capability data;
- unsafe endpoint or upload URL.

`409` never becomes an automatic overwrite or retry.

## Source and dependency ownership

This pass is the sole owner of the TUS dependency and resumable transport.
Earlier B1 and B2A tests are narrowed only enough to preserve their original
boundaries:

- B1 remains signed-capability minting only;
- B2A remains standard `uploadToSignedUrl` transport only;
- B2B owns `tus-js-client` and resumable upload behavior.

## Explicitly deferred

- live hosted TUS upload acceptance;
- a real signed-capability request during acceptance;
- pause/resume testing against a live Storage object;
- guaranteed cleanup of a temporary hosted object;
- file magic-byte inspection;
- PDF page and PNG dimension validation;
- SHA-256 calculation;
- atomic `project_submission_files` finalization;
- orphan cleanup;
- signed reviewer download;
- learner upload UI.
