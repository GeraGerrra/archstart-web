import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migrationSource = readFileSync(
  new URL(
    "../supabase/migrations/" +
      "20260806030000_phase07_pass2b2r1_" +
      "plpgsql_output_qualification_repair.sql",
    import.meta.url,
  ),
  "utf8",
);

test(
  "Pass 2B2-R1 postconditions use valid schema-qualified strpos calls",
  () => {
    // The invalid schema-qualified POSITION syntax must be absent.
    assert.doesNotMatch(
      migrationSource,
      /pg_catalog\.position\s*\(/u,
    );

    // The repaired migration must contain exactly seven STRPOS checks.
    assert.equal(
      migrationSource.match(/pg_catalog\.strpos\s*\(/gu)?.length,
      7,
    );

    // Normalize formatting only; retain exact variables and searched fragments.
    const normalizedMigration = migrationSource.replace(/\s+/gu, " ");

    const expectedCalls = [
      "pg_catalog.strpos( create_draft_definition, 'inserted_version.version_number' )",
      "pg_catalog.strpos( create_draft_definition, 'inserted_version.version_state' )",
      "pg_catalog.strpos( create_revision_definition, 'inserted_version.version_number' )",
      "pg_catalog.strpos( create_revision_definition, 'inserted_version.version_state' )",
      "pg_catalog.strpos( assignment_definition, 'inserted_assignment.assigned_at' )",
      "pg_catalog.strpos( staff_definition, 'update private.project_staff_roles as staff' )",
      "pg_catalog.strpos( staff_definition, 'staff.staff_role = normalized_role' )",
    ];

    for (const expectedCall of expectedCalls) {
      assert.ok(
        normalizedMigration.includes(expectedCall),
        `Missing valid strpos check: ${expectedCall}`,
      );
    }

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
