import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();
const migration = readFileSync(
  join(
    root,
    "supabase/migrations/20260806180000_phase07_pass2c1_project_storage_bucket_foundation.sql",
  ),
  "utf8",
);
const verification = readFileSync(
  join(
    root,
    "supabase/verification/phase07-pass2c1-project-storage-bucket-foundation.sql",
  ),
  "utf8",
);
const documentation = readFileSync(
  join(root, "PHASE07_PROJECT_STORAGE_BUCKET_FOUNDATION.md"),
  "utf8",
);
const contract = JSON.parse(
  readFileSync(join(root, "PHASE07_PROJECT_STORAGE_BUCKET_V1.json"), "utf8"),
) as {
  acceptedSource: {
    gitHead: string;
    b2WorkflowRpcCount: number;
    projectWorkflowRows: number;
    storageBucketCount: number;
    projectStoragePolicyCount: number;
  };
  bucket: {
    id: string;
    public: boolean;
    fileSizeLimitBytes: number;
    allowedMimeTypes: string[];
  };
  accessModel: {
    defaultDeny: boolean;
    anonProjectObjectPolicies: number;
    authenticatedProjectObjectPolicies: number;
    directBrowserList: boolean;
    directBrowserRead: boolean;
    directBrowserInsert: boolean;
    directBrowserUpdate: boolean;
    directBrowserDelete: boolean;
    upsert: boolean;
  };
  scope: {
    createsBucket: boolean;
    createsStorageObjects: boolean;
    createsProjectObjectPolicies: boolean;
    changesWorkflowRpcDefinitions: boolean;
    changesAppOrUi: boolean;
    changesDependencies: boolean;
  };
};

const executableMigration = migration.replace(/--.*$/gmu, "");

const expectedRpcMd5 = [
  "07d99ba9d8ebcb18337212cd22ded91c",
  "c9097e46fa20eec33673cfd3fca94382",
  "b6ab7a9213dbd8dbfdfcb7326f014110",
  "ca9c53a9a3c12b087b44fad1c168ef73",
  "44729ad70ff5014ec37a1463bc2392dd",
  "dbc70626c4a2a831533995826d850071",
  "31b71b409acdb83dc8622a4a18949d4b",
  "8525ca4c9241f48660ad33b589110c0a",
  "77357f0b4b260606b6df1d8219b8d890",
];

test("Pass 2C1 is pinned to the merged Phase 07.2B2/R1 authority", () => {
  assert.equal(
    contract.acceptedSource.gitHead,
    "449430959e0500f11cefda3d8ada6ded5526c5b4",
  );
  assert.equal(contract.acceptedSource.b2WorkflowRpcCount, 9);
  assert.equal(contract.acceptedSource.projectWorkflowRows, 0);
  assert.equal(contract.acceptedSource.storageBucketCount, 0);
  assert.equal(contract.acceptedSource.projectStoragePolicyCount, 0);

  for (const digest of expectedRpcMd5) {
    assert.match(migration, new RegExp(digest, "u"));
    assert.match(verification, new RegExp(digest, "u"));
  }
});

test("Pass 2C1 creates one exact private bucket", () => {
  assert.equal(contract.bucket.id, "project-submissions");
  assert.equal(contract.bucket.public, false);
  assert.equal(contract.bucket.fileSizeLimitBytes, 41_943_040);
  assert.deepEqual(contract.bucket.allowedMimeTypes, [
    "application/pdf",
    "image/png",
  ]);

  assert.equal(migration.match(/insert into storage\.buckets/gu)?.length, 1);
  assert.match(
    migration,
    /'project-submissions',\s*'project-submissions',\s*false,\s*41943040/u,
  );
  assert.match(
    migration,
    /array\['application\/pdf', 'image\/png'\]::text\[\]/u,
  );
  assert.match(migration, /file_size_limit = 41943040/u);
  assert.match(
    migration,
    /allowed_mime_types = array\['application\/pdf', 'image\/png'\]::text\[\]/u,
  );
});

test("Pass 2C1 preserves a closed browser Storage policy boundary", () => {
  assert.equal(contract.accessModel.defaultDeny, true);
  assert.equal(contract.accessModel.anonProjectObjectPolicies, 0);
  assert.equal(contract.accessModel.authenticatedProjectObjectPolicies, 0);
  assert.equal(contract.accessModel.directBrowserList, false);
  assert.equal(contract.accessModel.directBrowserRead, false);
  assert.equal(contract.accessModel.directBrowserInsert, false);
  assert.equal(contract.accessModel.directBrowserUpdate, false);
  assert.equal(contract.accessModel.directBrowserDelete, false);
  assert.equal(contract.accessModel.upsert, false);

  assert.doesNotMatch(executableMigration, /create\s+policy/iu);
  assert.doesNotMatch(
    executableMigration,
    /insert into storage\.objects|update storage\.objects|delete from storage\.objects/iu,
  );
  assert.doesNotMatch(executableMigration, /grant\s+.*(?:authenticated|anon)/iu);
  assert.match(
    migration,
    /must preserve a closed browser Storage policy boundary/u,
  );
  assert.match(
    documentation,
    /creates zero project-specific `storage\.objects` policies/u,
  );
  assert.match(documentation, /signed\s+upload\s+token/u);
});

test("Pass 2C1 does not widen product, workflow, or hosted scope", () => {
  assert.equal(contract.scope.createsBucket, true);
  assert.equal(contract.scope.createsStorageObjects, false);
  assert.equal(contract.scope.createsProjectObjectPolicies, false);
  assert.equal(contract.scope.changesWorkflowRpcDefinitions, false);
  assert.equal(contract.scope.changesAppOrUi, false);
  assert.equal(contract.scope.changesDependencies, false);

  assert.doesNotMatch(executableMigration, /create or replace function public\./iu);
  assert.doesNotMatch(
    executableMigration,
    /alter table public\.project_|create table|drop table|drop function/iu,
  );
  assert.doesNotMatch(
    executableMigration,
    /next_public_|cloudflare|resend|create\s+table[^;]*(?:certificate|gallery)/iu,
  );
  assert.doesNotMatch(
    executableMigration,
    /createSignedUploadUrl|uploadToSignedUrl|tus-js-client|uppy/iu,
  );
});

test("migration is transactional and self-verifies zero rows and objects", () => {
  assert.match(migration, /^begin;$/mu);
  assert.match(migration, /^commit;$/mu);
  assert.equal(migration.match(/\$phase07\$/gu)?.length, 4);
  assert.match(migration, /workflow_row_count <> 0/u);
  assert.match(migration, /object_count <> 0/u);
  assert.match(migration, /project_policy_count <> 0/u);
});

test("hosted verification proves bucket, RLS, RPC, and closed policy boundary", () => {
  for (const marker of [
    "phase07_pass2c1_storage_verification",
    "closedBrowserPolicyBoundary",
    "projectObjectPolicyCount",
    "workflowRpcs",
    "rowCounts",
    "fileSizeLimit",
    "allowedMimeTypes",
  ]) {
    assert.match(verification, new RegExp(marker, "u"));
  }

  assert.match(verification, /then 'PASS'\s+else 'STOP'/u);
  assert.match(verification, /project_objects/u);
  assert.match(
    verification,
    /configuration is not distinct from array\['search_path=""'\]::text\[\]/u,
  );
});
