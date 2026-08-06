import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();
const migration = readFileSync(
  join(
    root,
    "supabase/migrations/20260807100000_phase07_pass2c2a_project_upload_intent_foundation.sql",
  ),
  "utf8",
);
const verification = readFileSync(
  join(
    root,
    "supabase/verification/phase07-pass2c2a-project-upload-intent-foundation.sql",
  ),
  "utf8",
);
const runtimeTemplate = readFileSync(
  join(
    root,
    "supabase/verification/phase07-pass2c2a-two-account-upload-intent-template.sql",
  ),
  "utf8",
);
const documentation = readFileSync(
  join(root, "PHASE07_PROJECT_UPLOAD_INTENT_FOUNDATION.md"),
  "utf8",
);
const contract = JSON.parse(
  readFileSync(join(root, "PHASE07_PROJECT_UPLOAD_INTENT_V1.json"), "utf8"),
) as {
  acceptedSource: {
    gitHead: string;
    authorityResult: string;
    bucket: {
      id: string;
      public: boolean;
      fileSizeLimitBytes: number;
      projectObjectPolicies: number;
      projectObjects: number;
    };
  };
  uploadIntent: {
    table: string;
    expirySeconds: number;
    standardUploadMaximumBytes: number;
    absoluteMaximumBytes: number;
    transferModes: string[];
    states: string[];
    objectPathShape: string;
  };
  rpcs: { signature: string; caller: string }[];
  accessModel: {
    anonDirectTableAccess: boolean;
    authenticatedDirectTableAccess: boolean;
    serviceRoleDelete: boolean;
    rlsEnabled: boolean;
    rlsPolicyCount: number;
    gucGuardedWrites: boolean;
  };
  scopeBoundary: Record<string, boolean>;
};

const executable = migration.replace(/--.*$/gmu, "");

const predecessorDigests = [
  "07d99ba9d8ebcb18337212cd22ded91c",
  "c9097e46fa20eec33673cfd3fca94382",
  "b6ab7a9213dbd8dbfdfcb7326f014110",
  "ca9c53a9a3c12b087b44fad1c168ef73",
  "44729ad70ff5014ec37a1463bc2392dd",
  "dbc70626c4a2a831533995826d850071",
  "31b71b409acdb83dc8622a4a18949d4b",
  "8525ca4c9241f48660ad33b589110c0a",
  "77357f0b4b260606b6df1d8219b8d890",
  "b6867773f5ba18b11489bd508164ead0",
];

const expectedConstraintNames = [
  "project_upload_intents_pkey",
  "project_upload_intents_planned_file_id_key",
  "project_upload_intents_user_id_fkey",
  "project_upload_intents_submission_id_fkey",
  "project_upload_intents_finalized_file_id_key",
  "project_upload_intents_finalized_file_id_fkey",
  "project_upload_intent_version_fk",
  "project_upload_intent_policy_fk",
  "project_upload_intent_bucket",
  "project_upload_intent_filename",
  "project_upload_intent_mime",
  "project_upload_intent_size",
  "project_upload_intent_transfer_mode",
  "project_upload_intent_state",
  "project_upload_intent_expiry",
  "project_upload_intent_close_reason",
  "project_upload_intent_final_file_identity",
  "project_upload_intent_lifecycle",
  "project_upload_intent_object_path",
  "project_upload_intents_object_path_key",
];

test("Pass 2C2A is pinned to the accepted private bucket and workflow authority", () => {
  assert.equal(
    contract.acceptedSource.gitHead,
    "1cd30e549027c8b2d13a2b04904dcc8d54f4d52c",
  );
  assert.equal(contract.acceptedSource.authorityResult, "PASS");
  assert.equal(contract.acceptedSource.bucket.id, "project-submissions");
  assert.equal(contract.acceptedSource.bucket.public, false);
  assert.equal(contract.acceptedSource.bucket.fileSizeLimitBytes, 41_943_040);
  assert.equal(contract.acceptedSource.bucket.projectObjectPolicies, 0);
  assert.equal(contract.acceptedSource.bucket.projectObjects, 0);

  for (const digest of predecessorDigests) {
    assert.match(migration, new RegExp(digest, "u"));
    assert.match(verification, new RegExp(digest, "u"));
  }

  assert.match(migration, /expected_caller = 'authenticated'/u);
  assert.match(migration, /expected_caller = 'service_role'/u);
  assert.match(migration, /accepted project-function hardening drift/u);
});

test("Pass 2C2A creates one private intent table with exact reservation fields", () => {
  assert.equal(contract.uploadIntent.table, "private.project_upload_intents");
  assert.equal(
    migration.match(/create table private\.project_upload_intents/gu)?.length,
    1,
  );

  for (const column of [
    "planned_file_id",
    "user_id",
    "submission_id",
    "version_id",
    "project_code",
    "policy_version",
    "bucket_id",
    "object_path",
    "original_filename",
    "declared_mime",
    "declared_size_bytes",
    "transfer_mode",
    "state",
    "expires_at",
    "closed_at",
    "closed_reason",
    "finalized_file_id",
  ]) {
    assert.match(migration, new RegExp(`\\b${column}\\b`, "u"));
  }

  assert.match(migration, /expected_column_count integer := 20/u);
  assert.match(migration, /expected_constraint_count integer := 20/u);
  assert.match(migration, /expected_total_index_count integer := 7/u);

  for (const name of expectedConstraintNames) {
    assert.match(migration, new RegExp(name, "u"));
    assert.match(verification, new RegExp(name, "u"));
  }

  assert.match(migration, /object_path =\s*user_id::text \|\| '\/'/u);
  assert.match(migration, /planned_file_id::text/u);
  assert.match(
    documentation,
    /original filename.*never enters the\s+Storage object path/isu,
  );
});

test("intent policy enforces two-hour expiry, 40 MiB ceiling, and standard versus TUS", () => {
  assert.equal(contract.uploadIntent.expirySeconds, 7_200);
  assert.equal(contract.uploadIntent.standardUploadMaximumBytes, 6_291_456);
  assert.equal(contract.uploadIntent.absoluteMaximumBytes, 41_943_040);
  assert.deepEqual(contract.uploadIntent.transferModes, ["standard", "tus"]);
  assert.deepEqual(contract.uploadIntent.states, [
    "pending",
    "finalized",
    "rejected",
    "cancelled",
    "expired",
  ]);

  assert.match(migration, /interval '2 hours'/u);
  assert.match(migration, /declared_size_bytes between 1 and 41943040/u);
  assert.match(
    migration,
    /declared_size_bytes <= 6291456 and transfer_mode = 'standard'/u,
  );
  assert.match(
    migration,
    /declared_size_bytes > 6291456 and transfer_mode = 'tus'/u,
  );
  assert.match(migration, /where state = 'pending'/u);
});

test("two narrow authenticated RPCs own idempotency and cancellation", () => {
  assert.deepEqual(
    contract.rpcs.map((rpc) => rpc.signature),
    [
      "public.create_project_upload_intent(uuid,text,text,bigint)",
      "public.cancel_project_upload_intent(uuid)",
    ],
  );
  assert.equal(migration.match(/create or replace function public\./gu)?.length, 2);
  assert.match(migration, /reused boolean/u);
  assert.match(migration, /superseded_by_new_intent/u);
  assert.match(migration, /expired_before_retry/u);
  assert.match(migration, /learner_cancelled/u);
  assert.match(migration, /grant execute on function[\s\S]*to authenticated;/u);
  assert.doesNotMatch(executable, /grant execute on function[\s\S]*to anon;/iu);
});

test("private table remains exact, direct-browser denied, and GUC guarded", () => {
  assert.equal(contract.accessModel.anonDirectTableAccess, false);
  assert.equal(contract.accessModel.authenticatedDirectTableAccess, false);
  assert.equal(contract.accessModel.serviceRoleDelete, false);
  assert.equal(contract.accessModel.rlsEnabled, true);
  assert.equal(contract.accessModel.rlsPolicyCount, 0);
  assert.equal(contract.accessModel.gucGuardedWrites, true);

  assert.match(
    migration,
    /alter table private\.project_upload_intents enable row level security/u,
  );
  assert.match(
    migration,
    /revoke all on table private\.project_upload_intents\s+from public, anon, authenticated;/u,
  );
  assert.match(
    migration,
    /grant select, insert, update\s+on table private\.project_upload_intents\s+to service_role;/u,
  );
  assert.doesNotMatch(executable, /create\s+policy/iu);
  assert.match(migration, /archstart\.project_upload_intent_write_authorized/u);
  assert.match(migration, /project upload-intent history is immutable/u);

  for (const role of ["anon", "authenticated"]) {
    for (const privilege of ["SELECT", "INSERT", "UPDATE", "DELETE"]) {
      assert.match(
        migration,
        new RegExp(
          `has_table_privilege\\(\\s*'${role}',\\s*'private\\.project_upload_intents',\\s*'${privilege}'`,
          "u",
        ),
      );
    }
  }
  for (const privilege of [
    "SELECT",
    "INSERT",
    "UPDATE",
    "DELETE",
    "TRUNCATE",
    "REFERENCES",
    "TRIGGER",
  ]) {
    assert.match(
      migration,
      new RegExp(
        `has_table_privilege\\(\\s*'service_role',\\s*'private\\.project_upload_intents',\\s*'${privilege}'`,
        "u",
      ),
    );
  }
});

test("Pass 2C2A does not implement transfer, signed capability, or finalization", () => {
  for (const value of Object.values(contract.scopeBoundary)) {
    if (value !== false) assert.fail("every deferred-scope flag must remain false");
  }

  assert.doesNotMatch(
    executable,
    /insert into storage\.objects|update storage\.objects|delete from storage\.objects/iu,
  );
  assert.doesNotMatch(
    executable,
    /createSignedUploadUrl|uploadToSignedUrl|x-signature|tus-js-client|@uppy/iu,
  );
  assert.doesNotMatch(
    executable,
    /insert into public\.project_submission_files/iu,
  );
  assert.doesNotMatch(executable, /next_public_|cloudflare|vercel|resend/iu);
  assert.match(
    documentation,
    /does not upload a\s+file and does not create a signed token/isu,
  );
});

test("hosted verification proves exact catalog, privilege, predecessor, and Storage boundaries", () => {
  assert.match(verification, /phase07_pass2c2a_upload_intent_verification/u);
  assert.match(verification, /then 'PASS'\s+else 'STOP'/u);
  assert.match(verification, /'catalogCounts'/u);
  assert.match(verification, /\(select columns from catalog_counts\) = 20/u);
  assert.match(verification, /\(select constraints from catalog_counts\) = 20/u);
  assert.match(verification, /\(select indexes from catalog_counts\) = 7/u);
  assert.match(verification, /\(select triggers from catalog_counts\) = 2/u);
  assert.match(verification, /\(select policies from catalog_counts\) = 0/u);
  assert.match(verification, /'predecessorFunctions'/u);
  assert.match(verification, /project_object_policies/u);
  assert.match(verification, /project_objects/u);
  assert.match(verification, /service_role_private_schema_usage/u);
});

test("runtime template validates two real clean accounts and exposes rollback proof", () => {
  assert.equal(runtimeTemplate.match(/^do \$phase07\$/gmu)?.length, 1);
  assert.match(runtimeTemplate, /both test UUIDs must exist in auth\.users/u);
  assert.match(runtimeTemplate, /test users must begin with no project workflow rows/u);
  assert.match(runtimeTemplate, /ARCHSTART_PHASE07_PASS2C2A_ROLLBACK_SENTINEL/u);
  assert.match(runtimeTemplate, /Visible rollback proof/u);
  for (const field of [
    "upload_intents_after_rollback",
    "staff_roles_after_rollback",
    "reviewer_assignments_after_rollback",
    "submissions_after_rollback",
    "versions_after_rollback",
    "status_events_after_rollback",
    "project_files_after_rollback",
    "reviews_after_rollback",
    "review_criteria_after_rollback",
    "project_objects_after_rollback",
    "project_bucket_count_after_rollback",
  ]) {
    assert.match(runtimeTemplate, new RegExp(`as ${field}`, "u"));
  }
  assert.match(runtimeTemplate, /project_bucket_count_after_rollback <> 1/u);
  assert.match(
    runtimeTemplate,
    /from public\.project_status_events[\s\S]*or actor_id in/u,
  );
  assert.doesNotMatch(runtimeTemplate, /^begin;$/mu);
  assert.doesNotMatch(runtimeTemplate, /create temporary table/iu);
});

test("migration delimiters and transactional boundary are balanced", () => {
  assert.match(migration, /^begin;$/mu);
  assert.match(migration, /^commit;$/mu);
  assert.equal(migration.match(/\$phase07\$/gu)?.length, 4);
  assert.equal(migration.match(/\$function\$/gu)?.length, 8);
  assert.equal(runtimeTemplate.match(/\$phase07\$/gu)?.length, 2);
});

test("Pass 2C2A source contains no credential-shaped values", () => {
  const combined = [migration, verification, runtimeTemplate, documentation].join("\n");
  assert.doesNotMatch(combined, /sb_secret_[A-Za-z0-9_-]+/u);
  assert.doesNotMatch(combined, /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/u);
  assert.doesNotMatch(combined, /postgres(?:ql)?:\/\/[^\s]+/iu);
});
