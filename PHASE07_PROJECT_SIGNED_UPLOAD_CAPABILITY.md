# ARCH.START Phase 07.2C2B1 — Trusted Signed-Upload Capability

## Purpose

This source-only pass adds the trusted server boundary that turns an owned,
validated Phase 07.2C2A upload intent into one path-scoped signed upload token.
It does not send file bytes and does not create a Storage object.

## Why 2C2B is split

Phase 07.2C2B is divided into two independently auditable passes:

1. **2C2B1** — authenticate, reserve/refresh the database intent, and mint a
   signed capability with the server-only Supabase secret client;
2. **2C2B2** — consume that capability in the browser through standard and TUS
   direct-to-Storage transports and run live object-transfer evidence.

The split prevents secret-bearing server logic from being reviewed in the same
change as browser networking, resumability, progress, and cancellation code.

## Server action contract

`requestProjectUploadCapabilityAction(input)`:

1. authenticates the Supabase session and obtains the trusted user claim;
2. validates only file metadata supplied by the browser;
3. calls `create_project_upload_intent` with the learner session;
4. replaces a reused intent when less than 115 minutes remain;
5. validates the returned bucket, path, owner prefix, version and metadata;
6. creates a signed upload URL with the server-only secret client and
   `upsert: false`;
7. returns only the exact path, transfer mode, intent identifiers, deadline and
   opaque upload token.

The browser cannot provide or override:

- user ID;
- submission ID;
- planned file ID;
- bucket ID;
- object path;
- transfer mode;
- intent state;
- expiry;
- signed token;
- service/secret key.

## Capability boundary

The same `uploadToken` will later be consumed by:

- `uploadToSignedUrl(path, token, file)` for `standard` intents;
- the TUS `x-signature` header for `tus` intents.

The client-visible deadline is capped by the database intent expiry. Tokens are
never logged and no signed URL is persisted.

## Exact non-goals

This pass creates no:

- database migration;
- new table, RPC, policy or grant;
- Storage object;
- Storage object policy;
- direct browser transfer;
- TUS dependency;
- upload UI;
- byte inspection, digest, PDF/PNG shape validation or final file row;
- Vercel/R2/environment change.

## Acceptance

Acceptance requires exact seven-path source scope, all local gates, a matching
Vercel Preview, the read-only hosted readiness result `PASS`, merge, Production
`Ready`, clean synchronized `main`, and a second readiness `PASS`.

Actual signed-token and Storage-object runtime evidence is intentionally
required in Phase 07.2C2B2, where the capability has a real consumer.
