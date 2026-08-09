# ARCH.START Phase 07.2D-R1 — Project Workspace Safety Repair

This source-only repair preserves the Phase 07.2D learner and staff workspace and closes the eight independently audited safety and completeness gaps.

## Learner boundary

- Every learner workflow, upload-capability, finalization, and download Server Action passes through one authenticated-and-onboarded session guard.
- The guard reads only the current learner's `profiles.onboarding_completed_at` row through the session client.
- The browser imports guarded workspace actions and never imports raw capability or finalization actions.

## Upload lifecycle

- A validating, uploading, or paused TUS controller remains owned by the workspace and locks new file selection and capability creation.
- Pause, resume, and cancel share one transition mutex; controller ownership is cleared after confirmed terminal cancellation.
- A successfully transferred object retains its intent until finalization succeeds or returns a terminal rejection/denial.
- Transient finalization failures expose one retry control. A conflict from the same reused intent is sent to the production finalizer, which independently verifies object bytes and policy.

## Review completeness

- Revision decisions retain an authorized read-only download of the previous submitted file.
- Active staff assignments include the submitted learner note and the M02 supporting text without exposing email, object paths, tokens, or role rows.
- Blank criterion point inputs are rejected before numeric conversion, and unexpected client promise failures use fixed safe Russian copy.

## Preserved boundaries

- `src/server/project-file-finalization-action.ts` remains byte-identical to the accepted merged base.
- Its build-compatible production runtime mirror is server-only; the guarded Server Action remains outside the accepted core file.
- No migration, dependency, Git operation, hosted mutation, Phase 08 feature, or anonymous M01/M04 fixture repair is included.
