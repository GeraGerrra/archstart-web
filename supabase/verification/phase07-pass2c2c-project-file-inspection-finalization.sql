-- ARCH.START Phase 07.2C2C-R1E6 — read-only hosted verification
-- Exact function identity is verified with normalized pg_proc.prosrc MD5 values.
-- R1 lock-order and orphan-selector source contracts remain covered by the
-- committed migration-source tests; this hosted query does not perform brittle
-- substring analysis of PL/pgSQL bodies and executes no target function.

with expected_functions(signature, expected_body_md5) as (
  values
    (
      'public.get_project_upload_finalization_context(uuid,uuid)',
      '174932e16cb7838a305aa63a66a49180'
    ),
    (
      'public.finalize_project_upload_intent(uuid,uuid,text,bigint,text,smallint,integer,integer)',
      'fdc4c28fff4683cddd3ebccd3aa986a0'
    ),
    (
      'public.close_project_upload_intent_after_inspection(uuid,uuid,text,text)',
      '0f8176890d5e1bc948ba344f5e1c02d7'
    ),
    (
      'public.list_stale_project_upload_intents(uuid,integer)',
      '492e48dcdf471fafce0b13ecfda05d30'
    ),
    (
      'public.authorize_project_file_download(uuid,uuid)',
      '19e230473177a46977ea264cda187986'
    )
), function_audit as (
  select
    expected.signature,
    procedure.oid is not null as present,
    coalesce(procedure.prosecdef, false) as security_definer,
    procedure.proconfig is not distinct from array['search_path=""']::text[]
      as empty_search_path,
    case when procedure.oid is null then false else
      pg_catalog.has_function_privilege('anon', procedure.oid, 'EXECUTE')
    end as anon_execute,
    case when procedure.oid is null then false else
      pg_catalog.has_function_privilege('authenticated', procedure.oid, 'EXECUTE')
    end as authenticated_execute,
    case when procedure.oid is null then false else
      pg_catalog.has_function_privilege('service_role', procedure.oid, 'EXECUTE')
    end as service_role_execute,
    case when procedure.oid is null then null else
      pg_catalog.md5(
        pg_catalog.btrim(
          pg_catalog.lower(
            pg_catalog.regexp_replace(
              coalesce(procedure.prosrc, ''),
              '[[:space:]]+',
              ' ',
              'g'
            )
          )
        )
      )
    end as actual_body_md5,
    expected.expected_body_md5
  from expected_functions as expected
  left join pg_catalog.pg_proc as procedure
    on procedure.oid = pg_catalog.to_regprocedure(expected.signature)
), boundary as (
  select
    exists (
      select 1
      from storage.buckets as bucket
      where bucket.id = 'project-submissions'
        and bucket.name = 'project-submissions'
        and bucket.public is false
        and bucket.file_size_limit = 41943040
        and bucket.allowed_mime_types =
          array['application/pdf', 'image/png']::text[]
    ) as private_bucket_matches,
    (
      select count(*)
      from pg_catalog.pg_policies
      where schemaname = 'storage'
        and tablename = 'objects'
        and (
          policyname ~* 'project'
          or coalesce(qual, '') ~* 'project-submissions'
          or coalesce(with_check, '') ~* 'project-submissions'
        )
    ) as project_storage_policy_count,
    pg_catalog.has_table_privilege(
      'authenticated', 'private.project_upload_intents', 'SELECT'
    ) as authenticated_intent_select,
    (
      select count(*) from private.project_submission_policies where is_current
    ) as current_policy_count,
    (
      select count(*) from private.project_rubric_criteria
    ) as rubric_criterion_count
), verdict as (
  select
    count(*) = 5
    and bool_and(present)
    and bool_and(security_definer)
    and bool_and(empty_search_path)
    and bool_and(not anon_execute)
    and bool_and(not authenticated_execute)
    and bool_and(service_role_execute)
    and bool_and(actual_body_md5 = expected_body_md5)
    and boundary.private_bucket_matches
    and boundary.project_storage_policy_count = 0
    and boundary.authenticated_intent_select is false
    and boundary.current_policy_count = 8
    and boundary.rubric_criterion_count = 40
      as passed
  from function_audit, boundary
  group by
    boundary.private_bucket_matches,
    boundary.project_storage_policy_count,
    boundary.authenticated_intent_select,
    boundary.current_policy_count,
    boundary.rubric_criterion_count
)
select pg_catalog.jsonb_build_object(
  'check', 'phase07_pass2c2c_project_file_inspection_finalization',
  'verificationRevision', 'R1E6_CATALOG_HASH',
  'result', case when verdict.passed then 'PASS' else 'STOP' end,
  'migrationAppliedExactly', verdict.passed,
  'functions', (
    select pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'signature', signature,
        'present', present,
        'securityDefiner', security_definer,
        'emptySearchPath', empty_search_path,
        'anonExecute', anon_execute,
        'authenticatedExecute', authenticated_execute,
        'serviceRoleExecute', service_role_execute,
        'actualBodyMd5', actual_body_md5,
        'expectedBodyMd5', expected_body_md5,
        'bodyMatches', actual_body_md5 = expected_body_md5
      ) order by signature
    )
    from function_audit
  ),
  'boundary', pg_catalog.to_jsonb(boundary),
  'rowCounts', pg_catalog.jsonb_build_object(
    'uploadIntents', (select count(*) from private.project_upload_intents),
    'files', (select count(*) from public.project_submission_files),
    'projectObjects', (
      select count(*) from storage.objects where bucket_id = 'project-submissions'
    )
  )
) as phase07_pass2c2c_verification
from boundary, verdict;
