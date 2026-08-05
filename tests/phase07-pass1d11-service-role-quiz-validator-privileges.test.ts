import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/"
      + "20260805040000_phase07_pass1d11_"
      + "service_role_quiz_validator_privileges.sql",
  ),
  "utf8",
);

test("repair grants only the two required service-role privileges", () => {
  assert.match(
    migration,
    /grant\s+usage\s+on\s+schema\s+private\s+to\s+service_role/iu,
  );

  assert.match(
    migration,
    /grant\s+execute\s+on\s+function\s+private\.quiz_answers_shape_is_valid\(jsonb\)\s+to\s+service_role/iu,
  );

  assert.doesNotMatch(
    migration,
    /grant\s+(?:insert|update|delete|all)[^;]*public\.quiz_attempts/iu,
  );

  assert.doesNotMatch(
    migration,
    /grant[\s\S]*\b(?:anon|authenticated)\b/iu,
  );
});

test("repair preserves RLS and does not redefine accepted objects", () => {
  assert.doesNotMatch(
    migration,
    /alter\s+table\s+public\.quiz_attempts\s+disable\s+row\s+level\s+security/iu,
  );

  assert.doesNotMatch(
    migration,
    /create\s+(?:or\s+replace\s+)?function/iu,
  );

  assert.doesNotMatch(
    migration,
    /create\s+table/iu,
  );

  assert.doesNotMatch(
    migration,
    /drop\s+(?:table|function|schema)/iu,
  );
});

test("repair requires accepted Pass 1C objects and existing table grants", () => {
  assert.match(
    migration,
    /to_regclass\('public\.quiz_attempts'\)/u,
  );

  assert.match(
    migration,
    /to_regprocedure\(\s*'private\.quiz_answers_shape_is_valid\(jsonb\)'/u,
  );

  assert.match(
    migration,
    /has_table_privilege\(\s*'service_role',\s*'public\.quiz_attempts',\s*'INSERT'/u,
  );

  assert.match(
    migration,
    /has_table_privilege\(\s*'service_role',\s*'public\.quiz_attempts',\s*'SELECT'/u,
  );
});

test("repair source contains no credential value", () => {
  assert.doesNotMatch(
    migration,
    /sb_secret_[A-Za-z0-9_-]{12,}|service_role_key|BEGIN PRIVATE KEY/gu,
  );
});
