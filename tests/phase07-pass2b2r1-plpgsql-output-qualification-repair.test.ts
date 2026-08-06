import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationPath = new URL(
  "../supabase/migrations/20260806030000_phase07_pass2b2r1_plpgsql_output_qualification_repair.sql",
  import.meta.url,
);

const verificationPath = new URL(
  "../supabase/verification/phase07-pass2b2r1-plpgsql-output-qualification-repair.sql",
  import.meta.url,
);

const migration = await readFile(migrationPath, "utf8");
const verification = await readFile(verificationPath, "utf8");

test("Pass 2B2-R1 replaces only the four ambiguity-bearing workflow functions", () => {
  const functions = [...migration.matchAll(/create or replace function public\.(\w+)/gu)]
    .map((match) => match[1]);

  assert.deepEqual(functions, [
    "set_project_staff_role",
    "create_project_draft",
    "create_project_revision_draft",
    "assign_project_reviewer",
  ]);
});

test("all RETURNING fields that collide with TABLE outputs are target-qualified", () => {
  assert.match(migration, /inserted_version\.version_number/u);
  assert.match(migration, /inserted_version\.version_state/u);
  assert.match(migration, /inserted_assignment\.assigned_at/u);
  assert.match(migration, /inserted_submission\.current_status/u);

  assert.doesNotMatch(
    migration,
    /returning\s+id\s*,\s*version_number\s*,\s*version_state/iu,
  );
  assert.doesNotMatch(
    migration,
    /returning\s+id\s*,\s*assigned_at/iu,
  );
});

test("the staff-role UPDATE branch qualifies the shadowed output column", () => {
  assert.match(
    migration,
    /update private\.project_staff_roles as staff[\s\S]*?staff\.staff_role = normalized_role/u,
  );
  assert.doesNotMatch(
    migration,
    /where user_id = p_user_id\s+and staff_role = normalized_role/u,
  );
});

test("repair is identity-pinned, transactional, and does not widen scope", () => {
  assert.match(migration, /^begin;/mu);
  assert.match(migration, /^commit;/mu);
  assert.match(migration, /46e65215aa723612c7f5d44ed1ee2e2e/u);
  assert.match(migration, /99e4e979f36cd2377f7a47fd20e38821/u);
  assert.match(migration, /20ab63f38469af9eca784a4e10441301/u);
  assert.match(migration, /0c9be5a1a26a2d86d2d91fd8c7a63e61/u);

  assert.doesNotMatch(migration, /create\s+table/iu);
  assert.doesNotMatch(migration, /alter\s+table/iu);
  assert.doesNotMatch(migration, /insert\s+into\s+storage\./iu);
  assert.doesNotMatch(migration, /create\s+policy/iu);
});

test("verification checks qualification, privilege, zero-row, and Storage boundaries", () => {
  assert.match(verification, /qualificationFragments/u);
  assert.match(verification, /anonExecute/u);
  assert.match(verification, /authenticatedExecute/u);
  assert.match(verification, /serviceRoleExecute/u);
  assert.match(verification, /rowCounts/u);
  assert.match(verification, /project_bucket_exists/u);
  assert.match(verification, /project_object_policies/u);
});
