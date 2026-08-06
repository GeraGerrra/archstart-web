# ARCH.START Phase 07.2C2A — Project Upload Intent Foundation

## Purpose

This pass creates the database-owned reservation that must exist before a
trusted server may issue a short-lived upload capability. It does not upload a
file and does not create a signed token.

## Exact boundary

The pass creates:

- `private.project_upload_intents`;
- a guarded immutable identity/path trigger;
- an append-preserving delete refusal trigger;
- `public.create_project_upload_intent(uuid,text,text,bigint)`;
- `public.cancel_project_upload_intent(uuid)`;
- hosted verification and a rollback-only two-account runtime template.

The pass does **not** create:

- a `storage.objects` row;
- any Storage policy;
- a signed upload URL/token;
- an upload HTTP endpoint;
- byte inspection, SHA-256 calculation, PDF parsing, PNG parsing, malware
  scanning, file finalization, orphan cleanup, signed download, UI, email,
  gallery, certificate, dependency, Vercel, or R2 change.

## Why the intent exists first

The database, not the browser, owns:

- learner identity;
- submission and draft-version identity;
- policy snapshot;
- bucket and object path;
- accepted MIME and declared byte limit;
- transfer mode (`standard` or `tus`);
- two-hour expiry;
- idempotency and one-pending-intent-per-version;
- lifecycle history.

The original filename is retained only as display metadata. It never enters the
Storage object path.

## Canonical object path

```text
<user_uuid>/<submission_uuid>/<version_uuid>/<planned_file_uuid>.<pdf|png>
```

`planned_file_uuid` is reserved now so Phase 07.2C2C can insert the final
`public.project_submission_files` row with that same ID. The accepted B1 file
trigger will then derive the identical path.

## Transfer-mode contract

```text
1 .. 6,291,456 bytes       => standard
6,291,457 .. 41,943,040    => tus
```

This pass only stores the decision. Phase 07.2C2B will issue the actual signed
capability and perform direct browser-to-Storage transfer.

## State machine

```text
pending -> finalized
pending -> rejected
pending -> cancelled
pending -> expired
```

Terminal states are immutable. Rows are never deleted by learner workflows.

## Retry behavior

- An identical unexpired request for the same version returns the existing
  intent with `reused = true`.
- A changed request closes the old pending intent as `cancelled` and creates a
  new intent.
- An expired pending intent is first closed as `expired`, then replaced.
- A version may have only one pending intent.

## Security boundary

- RLS is enabled.
- No RLS policies are created on the private table.
- `anon` and `authenticated` receive no direct table privileges.
- `service_role` receives only `SELECT`, `INSERT`, and `UPDATE`.
- Table writes require the private transaction-local authorization GUC.
- Only the two narrow authenticated SECURITY DEFINER RPCs are browser-callable.
- Existing project workflow RPCs remain byte-identical.
- The private bucket remains private, empty, and policy-free.
