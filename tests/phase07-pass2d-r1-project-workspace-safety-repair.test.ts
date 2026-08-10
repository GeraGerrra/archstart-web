import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
  FINALIZATION_RETRY_MESSAGE,
  UNEXPECTED_WORKSPACE_ERROR_MESSAGE,
  finalizationKeepsRetry,
  isReusableIntentConflict,
  isTusSessionOpen,
  parseCriterionPoints,
} from "../src/project-workspace/client-state.ts";

const root = process.cwd();
const read = (path: string): string => readFileSync(join(root, path), "utf8");
const learner = read("src/learning/project/ProjectWorkspace.tsx");
const staff = read("src/learning/review/StaffProjectWorkspace.tsx");
const actions = read("src/server/project-workspace-actions.ts");
const session = read("src/server/project-workspace-session.ts");
const projection = read("src/server/project-workspace-projection.ts");
const finalizationRuntime = read("src/server/project-file-finalization-runtime.ts");
const types = read("src/project-workspace/types.ts");
const shell = read("src/prototypes/selected-a/shell-adapter.tsx");

function actionSlice(name: string): string {
  const start = actions.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} is missing`);
  const next = actions.indexOf("\nexport async function ", start + 1);
  return actions.slice(start, next < 0 ? actions.length : next);
}

test("all learner server entries enforce onboarding before RPC or delegation", () => {
  assert.match(session, /\.from\("profiles"\)[\s\S]*?\.eq\("user_id", session\.userId\)[\s\S]*?onboarding_completed_at/u);
  for (const name of [
    "finalizeProjectWorkspaceUploadAction",
    "requestProjectWorkspaceUploadCapabilityAction",
    "requestLearnerProjectFileDownloadAction",
    "createProjectDraftAction",
    "updateProjectDraftAction",
    "versionWorkflowAction",
    "createProjectRevisionDraftAction",
  ]) {
    const source = actionSlice(name);
    const guard = source.indexOf("await onboardedLearnerProjectSession()");
    const rpc = source.indexOf(".rpc(");
    const rawDelegation = Math.max(
      source.indexOf("finalizeProjectUploadAction(inputValue)"),
      source.indexOf("requestProjectUploadCapabilityAction(inputValue)"),
      source.indexOf("requestProjectFileDownloadAction(inputValue)"),
    );
    assert.ok(guard >= 0, `${name} has no onboarding guard`);
    if (rpc >= 0) assert.ok(guard < rpc, `${name} guards after RPC`);
    if (rawDelegation >= 0) assert.ok(guard < rawDelegation, `${name} guards after delegation`);
  }
});

test("learner client imports only guarded capability, finalization and download wrappers", () => {
  assert.match(learner, /requestProjectWorkspaceUploadCapabilityAction/u);
  assert.match(learner, /finalizeProjectWorkspaceUploadAction/u);
  assert.match(learner, /requestLearnerProjectFileDownloadAction/u);
  assert.doesNotMatch(learner, /project-upload-capability-action|project-file-finalization-action|project-file-download-action/u);
});

test("paused TUS remains an open upload lock", () => {
  assert.equal(isTusSessionOpen({ status: "paused" } as never), true);
  assert.equal(isTusSessionOpen({ status: "uploading" } as never), true);
  assert.equal(isTusSessionOpen({ status: "failed" } as never), false);
  assert.match(learner, /uploadLocked = tusSessionOpen \|\| Boolean\(pendingFinalizationIntentId\)/u);
  assert.match(learner, /disabled=\{interactionLocked\}/u);
  assert.match(learner, /isTusSessionOpen\(tusControllerRef\.current\?\.getSnapshot\(\) \?\? null\)/u);
});

test("pause, resume and cancel share one explicit transition lock", () => {
  assert.match(learner, /tusTransitionRef\.current/u);
  assert.match(learner, /controller\[transition\]\(\)/u);
  for (const transition of ["pause", "resume", "cancel"]) {
    assert.match(learner, new RegExp(`controlTusUpload\\("${transition}"\\)`, "u"));
  }
  assert.match(learner, /tusTransitionBusy \|\| finalizing/u);
  const terminal = learner.indexOf('transition === "cancel" && snapshot.status === "cancelled"');
  const clear = learner.indexOf("clearTerminalTransferState()", terminal);
  assert.ok(terminal >= 0 && terminal < clear);
});

test("pending finalization blocks upload and keeps exactly one retry control", () => {
  assert.equal((learner.match(/Повторить проверку файла/gu) ?? []).length, 1);
  assert.match(learner, /pendingFinalizationIntentIdRef\.current = intentId/u);
  assert.match(learner, /pendingFinalizationIntentIdRef\.current/u);
  assert.equal(finalizationKeepsRetry({ status: "error", message: "safe" }), true);
  assert.equal(finalizationKeepsRetry({ status: "cleanup-failed", message: "safe" }), true);
  assert.equal(finalizationKeepsRetry({ status: "rejected", message: "safe" }), false);
  assert.equal(finalizationKeepsRetry({ status: "denied", message: "safe" }), false);
  assert.equal(finalizationKeepsRetry({ status: "success", fileId: "safe", reused: false, message: "safe" }), false);
});

test("a reused exact-path conflict enters finalization for the same intent", () => {
  assert.equal(isReusableIntentConflict({ status: "failed", errorCode: "conflict" } as never, true), true);
  assert.equal(isReusableIntentConflict({ status: "failed", errorCode: "conflict" } as never, false), false);
  assert.match(learner, /isReusableIntentConflict\(snapshot, capabilityResult\.capability\.reusedIntent\)[\s\S]*?finalizeTransfer\(capabilityResult\.capability\.intentId\)/u);
});

test("accepted finalization core is restored byte-for-byte", () => {
  const value = readFileSync(join(root, "src/server/project-file-finalization-action.ts"));
  assert.equal(createHash("sha256").update(value).digest("hex"), "e3143626534299337d0da5a57331aa1013b6b6cf23ccb70f50f594498512f93d");
  assert.match(value.toString("utf8"), /PROJECT_FILE_REJECTION_REASONS/u);
  assert.match(value.toString("utf8"), /isStableProjectFileRejectionReason/u);
  assert.match(finalizationRuntime, /^import "server-only";/u);
  assert.doesNotMatch(finalizationRuntime, /^"use server";/u);
  assert.equal(`"use server";\n\n${finalizationRuntime}`, value.toString("utf8"));
  assert.doesNotMatch(actions, /^import[\s\S]*?from "\.\/project-file-finalization-runtime";$/mu);
  assert.match(actions, /await import\(\s*"\.\/project-file-finalization-runtime"\s*\)/u);
});

test("revision decisions keep the previous submitted file downloadable", () => {
  assert.match(learner, /revisionReadOnly = projection\.status === "revisions_required"[\s\S]*?"not_accepted"/u);
  assert.match(learner, /revisionReadOnly && projection\.currentFile/u);
  assert.match(learner, /Скачать предыдущий отправленный файл/u);
});

test("active staff assignments include and display note and M02 text only after assignment scope", () => {
  const assignmentScope = projection.indexOf('.rpc("list_active_project_reviewer_assignments_for_service")');
  const textRead = projection.indexOf('.select("id,learner_note,supporting_text")');
  assert.ok(assignmentScope >= 0 && assignmentScope < textRead);
  assert.match(projection, /assignedVersionIds[\s\S]*?ownSubmissionRows/u);
  assert.match(types, /learnerNote: string \| null;[\s\S]*?supportingText: string \| null;/u);
  assert.match(staff, /assignment\.learnerNote/u);
  assert.match(staff, /assignment\.projectCode === "M02_P02" && assignment\.supportingText/u);
  assert.doesNotMatch(`${projection}\n${staff}`, /email|object_path|uploadToken|access_token/iu);
});

test("blank criterion points are rejected before numeric conversion", () => {
  assert.equal(parseCriterionPoints("", 20), null);
  assert.equal(parseCriterionPoints("   ", 20), null);
  assert.equal(parseCriterionPoints("0", 20), 0);
  assert.equal(parseCriterionPoints("21", 20), null);
  assert.doesNotMatch(staff, /Number\(criterion\.awardedPoints\)/u);
  assert.match(staff, /parseCriterionPoints/u);
});

test("unexpected client promise failures use fixed safe Russian copy", () => {
  assert.match(UNEXPECTED_WORKSPACE_ERROR_MESSAGE, /^[А-ЯЁ]/u);
  assert.match(FINALIZATION_RETRY_MESSAGE, /Повторите проверку файла/u);
  assert.ok((learner.match(/catch \{/gu) ?? []).length >= 5);
  assert.ok((staff.match(/catch \{/gu) ?? []).length >= 2);
  assert.doesNotMatch(`${learner}\n${staff}`, /String\(error\)|error\.message|JSON\.stringify\(error\)/u);
});

test("repair adds no Pass 2D migration or Phase 08 and accepts the later bounded progress-fixture replacement", () => {
  assert.equal(readdirSync(join(root, "supabase/migrations")).filter((name) => /pass2d/iu.test(name)).length, 0);
  assert.match(shell, /ANONYMOUS_SHELL_PROGRESS_PROJECTION/u);
  assert.doesNotMatch(shell, /lesson\.moduleCode === "M04"/u);
  assert.doesNotMatch(`${actions}\n${projection}\n${learner}\n${staff}`, /phase08|certificate|verification_registry/iu);
});
