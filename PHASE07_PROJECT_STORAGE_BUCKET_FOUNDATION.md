# ARCH.START Phase 07 Pass 2C1 — private project Storage bucket foundation

## Scope

This Storage-configuration-only pass creates the exact private
`project-submissions` bucket and intentionally creates **no** direct browser
policy on `storage.objects`.

## Accepted predecessor

- synchronized `main` at `449430959e0500f11cefda3d8ada6ded5526c5b4`;
- nine Phase 07.2B2/R1 workflow RPCs active;
- eight current submission policies and forty rubric criteria;
- zero project workflow rows;
- zero Storage buckets and zero project Storage policies;
- hosted global file limit shown as 50 MB;
- `storage.buckets` and `storage.objects` both retain RLS.

## Exact bucket

```text
id/name:          project-submissions
public:           false
file size limit:  41,943,040 bytes (40 MiB)
MIME types:       application/pdf, image/png
objects:          0
```

The 40 MiB bucket limit matches the accepted project-policy constraint and is
below the hosted global 50 MB limit.

## Closed browser policy boundary

Pass 2C1 creates zero project-specific `storage.objects` policies. Therefore
`anon` and ordinary `authenticated` Storage clients receive no general list,
read, insert, update or delete authority for project objects.

Pass 2C2 will authenticate the learner on the trusted server, verify ownership
and draft state, create a pending file intent, and mint a short-lived signed
upload token for one exact generated object path. The token is not a general
bucket policy. Upsert remains disabled.

## Explicitly deferred

- Storage objects;
- upload intent/finalization RPCs;
- standard or TUS upload client;
- signed download URLs;
- byte inspection, PDF page inspection and PNG dimensions;
- orphan cleanup;
- learner/reviewer upload UI;
- Vercel, R2, email, gallery and certificates.

## Next pass

`Phase 07.2C2 — upload intent + signed/resumable transfer + byte inspection + atomic finalization`.
It must not begin automatically.
