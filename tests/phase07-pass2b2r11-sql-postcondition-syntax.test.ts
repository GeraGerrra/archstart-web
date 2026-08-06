import assert from "node:assert/strict";
import {
  readdirSync,
  readFileSync,
} from "node:fs";
import {
  join,
  relative,
} from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repositoryRoot = fileURLToPath(
  new URL("../", import.meta.url),
);

const supabaseRoot = fileURLToPath(
  new URL("../supabase/", import.meta.url),
);

const migrationPath = fileURLToPath(
  new URL(
    "../supabase/migrations/" +
      "20260806030000_phase07_pass2b2r1_" +
      "plpgsql_output_qualification_repair.sql",
    import.meta.url,
  ),
);

const verificationPath = fileURLToPath(
  new URL(
    "../supabase/verification/" +
      "phase07-pass2b2r1-" +
      "plpgsql-output-qualification-repair.sql",
    import.meta.url,
  ),
);

const migrationSource = readFileSync(
  migrationPath,
  "utf8",
);

const verificationSource = readFileSync(
  verificationPath,
  "utf8",
);

const collectSqlFiles = (
  directory: string,
): string[] => {
  const files: string[] = [];

  for (
    const entry of readdirSync(
      directory,
      { withFileTypes: true },
    )
  ) {
    const candidate = join(
      directory,
      entry.name,
    );

    if (entry.isDirectory()) {
      files.push(
        ...collectSqlFiles(candidate),
      );
      continue;
    }

    if (
      entry.isFile()
      && entry.name.endsWith(".sql")
    ) {
      files.push(candidate);
    }
  }

  return files;
};

test(
  "all Supabase SQL avoids invalid schema-qualified POSITION syntax",
  () => {
    const offenders = collectSqlFiles(
      supabaseRoot,
    )
      .filter((filePath) =>
        /pg_catalog\.position\s*\(/u.test(
          readFileSync(filePath, "utf8"),
        ),
      )
      .map((filePath) =>
        relative(
          repositoryRoot,
          filePath,
        ),
      )
      .sort();

    assert.deepEqual(
      offenders,
      [],
    );
  },
);

test(
  "Pass 2B2-R1 migration and verification use valid STRPOS calls",
  () => {
    assert.doesNotMatch(
      migrationSource,
      /pg_catalog\.position\s*\(/u,
    );

    assert.doesNotMatch(
      verificationSource,
      /pg_catalog\.position\s*\(/u,
    );

    assert.equal(
      migrationSource.match(
        /pg_catalog\.strpos\s*\(/gu,
      )?.length,
      7,
    );

    const compactMigration =
      migrationSource.replace(/\s+/gu, "");

    const expectedMigrationCalls = [
      "pg_catalog.strpos(" +
        "create_draft_definition," +
        "'inserted_version.version_number'" +
        ")",
      "pg_catalog.strpos(" +
        "create_draft_definition," +
        "'inserted_version.version_state'" +
        ")",
      "pg_catalog.strpos(" +
        "create_revision_definition," +
        "'inserted_version.version_number'" +
        ")",
      "pg_catalog.strpos(" +
        "create_revision_definition," +
        "'inserted_version.version_state'" +
        ")",
      "pg_catalog.strpos(" +
        "assignment_definition," +
        "'inserted_assignment.assigned_at'" +
        ")",
      "pg_catalog.strpos(" +
        "staff_definition," +
        "'updateprivate.project_staff_rolesasstaff'" +
        ")",
      "pg_catalog.strpos(" +
        "staff_definition," +
        "'staff.staff_role=normalized_role'" +
        ")",
    ];

    for (
      const expectedCall
      of expectedMigrationCalls
    ) {
      assert.ok(
        compactMigration.includes(
          expectedCall,
        ),
        `Missing migration STRPOS call: ${expectedCall}`,
      );
    }

    const compactVerification =
      verificationSource.replace(/\s+/gu, "");

    assert.ok(
      compactVerification.includes(
        "pg_catalog.strpos(" +
          "function_state.definition," +
          "fragment" +
          ")>0aspresent",
      ),
      "Hosted verification does not use the valid STRPOS expression",
    );

    assert.match(
      migrationSource,
      /^[ \t]*begin;[ \t]*$/mu,
    );

    assert.match(
      migrationSource,
      /^[ \t]*commit;[ \t]*$/mu,
    );
  },
);
