# ARCH.START Phase 07.2C2B2A — Standard Signed Direct Transfer Core

## Scope

This pass adds a browser-side transfer engine for the existing `standard`
project-upload capability. It does **not** add a learner UI, issue a capability,
create a Storage object during acceptance, finalize a project file, or modify
hosted database state.

The accepted chain is:

```text
private project-submissions bucket
  → database-owned upload intent
  → trusted server-side signed capability
  → this pass: standard direct browser transfer core
```

Files larger than 6 MiB remain outside this pass and continue to require the
future TUS transport.

## Exact safety boundary

The transfer controller accepts only:

- one browser `File`;
- one server-issued `ProjectUploadCapability`;
- a transport implementation.

Before any network call it verifies:

- `transferMode === "standard"`;
- bucket identity is exactly `project-submissions`;
- intent, version and planned-file UUIDs are valid;
- the object path has the database-owned four-segment UUID shape;
- the object filename is exactly `<planned_file_uuid>.pdf|png`;
- file name, MIME and byte length exactly match the capability;
- the byte length is within `1..6,291,456`;
- the capability and intent deadlines are parseable and still usable;
- the upload token is present but is never logged.

## State machine

```text
idle
  → validating
  → uploading
  → succeeded
  → reset → idle

uploading
  → cancelled

uploading
  → failed
  → retry (one bounded retry only)
  → succeeded | failed
```

A capability may enter `start()` only once per controller instance. A retry is
possible only through the explicit `retry()` method after a retryable network,
rate-limit, or server error. Cancellation is terminal for that capability in
the controller because the client cannot safely prove that a request cancelled
at the edge did not complete at Storage.

## Progress truthfulness

`uploadToSignedUrl` does not expose byte-progress callbacks. Therefore the
standard transport reports:

- `indeterminate` while the request is in flight;
- no fabricated percentage or loaded-byte count;
- exactly `100%` only after Storage confirms the expected object path.

True byte-level progress is deferred to the TUS pass.

## Abort behavior

The Supabase client is created with a request-scoped custom `fetch` carrying the
controller's `AbortSignal`. Cancelling the controller aborts the active HTTP
request rather than merely hiding a late result.

## Storage call

The default adapter uses:

```text
bucket:       project-submissions
method:       uploadToSignedUrl
path:         capability.objectPath
token:        capability.uploadToken
contentType:  capability.declaredMime
cacheControl: 3600
upsert:       false
```

No service key is used in the browser. No direct `storage.objects` access is
introduced.

## Error contract

The controller distinguishes:

- `400 bad-request`;
- `401 unauthorized`;
- `403 forbidden`;
- `409 conflict / asset already exists`;
- `413 too-large`;
- retryable `408`, `429`, `5xx` and network failures;
- malformed Storage responses;
- local capability/file validation failures.

Only retryable failures can use the single bounded retry.

## Explicitly deferred

- TUS dependency and resumable transport;
- real hosted upload acceptance;
- object-byte inspection;
- PDF/PNG signature and shape validation;
- SHA-256 calculation;
- atomic `project_submission_files` finalization;
- orphan cleanup;
- signed download;
- learner upload UI.
