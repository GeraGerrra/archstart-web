import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
  TransitionLeaseOwner,
  WorkspaceOperationGuard,
  learnerTextReadiness,
  learnerWorkspaceIdentity,
  shouldClearTerminalTransfer,
  staffReviewDraftKey,
  startTusResumeTransition,
} from "../src/project-workspace/lifecycle.ts";

const root = process.cwd();
const learnerSource = readFileSync(
  join(root, "src/learning/project/ProjectWorkspace.tsx"),
  "utf8",
);
const staffSource = readFileSync(
  join(root, "src/learning/review/StaffProjectWorkspace.tsx"),
  "utf8",
);

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}

async function nextMicrotask(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

test("deferred resume releases its short lease before transfer settlement", async () => {
  const owner = new TransitionLeaseOwner();
  const outcome = deferred<string>();
  let snapshot = { status: "paused", canPause: false, canResume: true };
  let settled = "";

  const started = startTusResumeTransition({
    owner,
    getSnapshot: () => snapshot,
    resume: () => {
      snapshot = { status: "uploading", canPause: true, canResume: false };
      return outcome.promise;
    },
    onSettled: (value) => {
      settled = value;
    },
    onRejected: () => undefined,
  });

  assert.equal(started, true);
  assert.equal(snapshot.status, "uploading");
  assert.equal(owner.busy, false);
  assert.equal(settled, "");
  outcome.resolve("complete");
  await nextMicrotask();
  assert.equal(settled, "complete");
});

test("old resume continuation cannot clear a newer pause or cancel lease", async () => {
  const owner = new TransitionLeaseOwner();
  const outcome = deferred<string>();
  let snapshot = { status: "paused", canPause: false, canResume: true };

  startTusResumeTransition({
    owner,
    getSnapshot: () => snapshot,
    resume: () => {
      snapshot = { status: "uploading", canPause: true, canResume: false };
      return outcome.promise;
    },
    onSettled: () => undefined,
    onRejected: () => undefined,
  });
  const pauseLease = owner.acquire("pause");
  assert.ok(pauseLease);

  outcome.resolve("paused");
  await nextMicrotask();
  assert.equal(owner.active?.id, pauseLease.id);
  assert.equal(owner.active?.kind, "pause");
  assert.equal(owner.release({ id: pauseLease.id + 1, kind: "cancel" }), false);
  assert.equal(owner.active?.id, pauseLease.id);
  assert.equal(owner.release(pauseLease), true);
});

test("repeated resume attempts cannot create parallel control transitions", () => {
  const owner = new TransitionLeaseOwner();
  const outcome = deferred<string>();
  let calls = 0;
  let snapshot = { status: "paused", canPause: false, canResume: true };
  const start = () => startTusResumeTransition({
    owner,
    getSnapshot: () => snapshot,
    resume: () => {
      calls += 1;
      snapshot = { status: "uploading", canPause: true, canResume: false };
      return outcome.promise;
    },
    onSettled: () => undefined,
    onRejected: () => undefined,
  });

  assert.equal(start(), true);
  assert.equal(start(), false);
  assert.equal(calls, 1);
});

test("learner identity preserves same-version edits and resets for project/version changes", () => {
  const versionOne = learnerWorkspaceIdentity({
    projectCode: "M02_P02",
    editableVersionId: "version-1",
    currentVersionId: "version-1",
  });
  const sameVersionRefresh = learnerWorkspaceIdentity({
    projectCode: "M02_P02",
    editableVersionId: "version-1",
    currentVersionId: "version-1",
  });
  const versionTwo = learnerWorkspaceIdentity({
    projectCode: "M02_P02",
    editableVersionId: "version-2",
    currentVersionId: "version-2",
  });
  const otherProject = learnerWorkspaceIdentity({
    projectCode: "M03_P03",
    editableVersionId: null,
    currentVersionId: null,
  });
  const mountedState = {
    identity: versionOne,
    note: "несохранённый текст",
    file: "board.png" as string | null,
  };
  const reconcile = (identity: string) => identity === mountedState.identity
    ? mountedState
    : { identity, note: "", file: null };

  assert.equal(reconcile(sameVersionRefresh), mountedState);
  assert.deepEqual(reconcile(versionTwo), { identity: versionTwo, note: "", file: null });
  assert.deepEqual(reconcile(otherProject), { identity: otherProject, note: "", file: null });
  assert.match(learnerSource, /key=\{workspaceIdentity\}/u);
});

test("send readiness remains false until persisted text reflects the save", () => {
  const validText = Array.from({ length: 120 }, (_, index) => `слово${index}`).join(" ");
  const beforeSave = learnerTextReadiness({
    localLearnerNote: "локальная заметка",
    persistedLearnerNote: "",
    localSupportingText: validText,
    persistedSupportingText: "",
    supportingTextMinWords: 120,
    supportingTextMaxWords: 180,
  });
  assert.equal(beforeSave.hasUnsavedText, true);
  assert.equal(beforeSave.persistedSupportingTextReady, false);

  const afterSaveRefresh = learnerTextReadiness({
    localLearnerNote: "локальная заметка",
    persistedLearnerNote: "локальная заметка",
    localSupportingText: validText,
    persistedSupportingText: validText,
    supportingTextMinWords: 120,
    supportingTextMaxWords: 180,
  });
  assert.equal(afterSaveRefresh.hasUnsavedText, false);
  assert.equal(afterSaveRefresh.persistedSupportingTextReady, true);
  assert.equal(afterSaveRefresh.persistedSupportingTextWordCount, 120);
});

test("staff review draft is stable for one version and blank for a new version", () => {
  const drafts: Record<string, { summary: string }> = {};
  const firstKey = staffReviewDraftKey("version-1");
  drafts[firstKey] = { summary: "черновик проверки" };

  assert.equal(drafts[staffReviewDraftKey("version-1")]?.summary, "черновик проверки");
  assert.equal(drafts[staffReviewDraftKey("version-2")], undefined);
  assert.notEqual(firstKey, staffReviewDraftKey("version-2"));
  assert.match(staffSource, /staffReviewDraftKey\(assignment\.versionId\)/u);
});

test("stale capability continuation cannot start a transport", async () => {
  const guard = new WorkspaceOperationGuard("M02_P02:version-1");
  const operation = guard.capture();
  const capability = deferred<{ status: "success" }>();
  let transportStarts = 0;
  const continuation = (async () => {
    await capability.promise;
    if (!guard.isCurrent(operation)) return;
    transportStarts += 1;
  })();

  guard.invalidate();
  capability.resolve({ status: "success" });
  await continuation;
  assert.equal(transportStarts, 0);
  assert.match(learnerSource, /isCurrent\(operation\)[\s\S]*?transferMode/u);
});

test("terminal cleanup preserves retryable finalization and clears only terminal outcomes", () => {
  for (const status of ["error", "cleanup-failed", "auth-required", "invalid"] as const) {
    assert.equal(shouldClearTerminalTransfer({ kind: "finalization", status }), false);
  }
  for (const status of ["success", "rejected", "denied"] as const) {
    assert.equal(shouldClearTerminalTransfer({ kind: "finalization", status }), true);
  }
  assert.equal(shouldClearTerminalTransfer({ kind: "cancel", confirmed: false }), false);
  assert.equal(shouldClearTerminalTransfer({ kind: "cancel", confirmed: true }), true);
  assert.match(learnerSource, /clearTerminalTransferState/u);
});
