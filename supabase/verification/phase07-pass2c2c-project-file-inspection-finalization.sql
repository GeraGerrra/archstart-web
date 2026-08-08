-- ARCH.START Phase 07.2C2C-R1E2 — read-only hosted verification
-- Uses pg_proc.prosrc directly. It does not invoke the function-definition
-- deparser and does not execute any target function.

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
), function_catalog as (
  select
    expected.signature,
    expected.expected_body_md5,
    procedure.oid,
    procedure.prosecdef,
    procedure.proconfig,
    procedure.prosrc,
    case
      when procedure.oid is null then ''
      else pg_catalog.btrim(
        pg_catalog.lower(
          pg_catalog.regexp_replace(
            coalesce(procedure.prosrc, ''),
            '[[:space:]]+',
            ' ',
            'g'
          )
        )
      )
    end as normalized_source
  from expected_functions as expected
  left join pg_catalog.pg_proc as procedure
    on procedure.oid = pg_catalog.to_regprocedure(expected.signature)
), function_audit as (
  select
    catalog.signature,
    catalog.oid is not null as present,
    coalesce(catalog.prosecdef, false) as security_definer,
    catalog.proconfig is not distinct from array['search_path=""']::text[]
      as empty_search_path,
    case when catalog.oid is null then false else
      pg_catalog.has_function_privilege('anon', catalog.oid, 'EXECUTE')
    end as anon_execute,
    case when catalog.oid is null then false else
      pg_catalog.has_function_privilege('authenticated', catalog.oid, 'EXECUTE')
    end as authenticated_execute,
    case when catalog.oid is null then false else
      pg_catalog.has_function_privilege('service_role', catalog.oid, 'EXECUTE')
    end as service_role_execute,
    case when catalog.oid is null then false else
      pg_catalog.md5(catalog.normalized_source) = catalog.expected_body_md5
    end as body_matches
  from function_catalog as catalog
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
), repair_source as (
  select
    coalesce((
      select catalog.normalized_source
      from function_catalog as catalog
      where catalog.signature =
        'public.finalize_project_upload_intent(uuid,uuid,text,bigint,text,smallint,integer,integer)'
    ), '') as finalizer_definition,
    coalesce((
      select catalog.normalized_source
      from function_catalog as catalog
      where catalog.signature =
        'public.list_stale_project_upload_intents(uuid,integer)'
    ), '') as cleanup_definition
), repair_contract as (
  select
    pg_catalog.strpos(finalizer_definition,
      'select candidate.version_id into pre_read_version_id') > 0
      and pg_catalog.strpos(finalizer_definition,
        'select candidate.version_id into pre_read_version_id')
        < pg_catalog.strpos(finalizer_definition,
          'perform pg_catalog.pg_advisory_xact_lock')
      as finalizer_identity_pre_read_before_advisory_lock,
    pg_catalog.strpos(finalizer_definition,
      'pg_catalog.hashtext(pre_read_version_id::text)') > 0
      as finalizer_uses_user_version_advisory_lock,
    pg_catalog.strpos(finalizer_definition,
      'select version_candidate.* into version_row') > 0
      and pg_catalog.strpos(finalizer_definition,
        'select version_candidate.* into version_row')
        < pg_catalog.strpos(finalizer_definition,
          'select candidate.* into intent_row')
      as finalizer_locks_version_before_intent,
    finalizer_definition like
      '%intent_row.user_id is distinct from p_requester_id%'
      and finalizer_definition like
        '%intent_row.version_id is distinct from pre_read_version_id%'
      and finalizer_definition like
        '%intent_row.submission_id is distinct from version_row.submission_id%'
      as finalizer_revalidates_locked_identity,
    cleanup_definition like
      '%intent_row.state in (''pending'', ''expired'', ''cancelled'')%'
      and cleanup_definition like
        '%intent_row.state in (''expired'', ''cancelled'')%'
      as cleanup_covers_expired_pending_and_terminal_states,
    cleanup_definition like '%from storage.objects as object_row%'
      and cleanup_definition like
        '%object_row.bucket_id = intent_row.bucket_id%'
      and cleanup_definition like
        '%object_row.name = intent_row.object_path%'
      as terminal_cleanup_requires_exact_object_existence,
    cleanup_definition like '%intent_row.finalized_file_id is null%'
      and cleanup_definition like
        '%file_row.id = intent_row.planned_file_id%'
      and cleanup_definition like
        '%file_row.bucket_id = intent_row.bucket_id%'
      and cleanup_definition like
        '%file_row.object_path = intent_row.object_path%'
      as actual_finalized_identity_and_path_protected,
    cleanup_definition not like
      '%file_row.version_id = intent_row.version_id%'
      as competing_different_file_does_not_blanket_protect_orphan
  from repair_source
), verdict as (
  select
    (select count(*) from function_audit) = 5
    and not exists (
      select 1 from function_audit
      where not present
        or not security_definer
        or not empty_search_path
        or anon_execute
        or authenticated_execute
        or not service_role_execute
        or not body_matches
    )
    and boundary.private_bucket_matches
    and boundary.project_storage_policy_count = 0
    and boundary.authenticated_intent_select is false
    and boundary.current_policy_count = 8
    and boundary.rubric_criterion_count = 40
    and repair_contract.finalizer_identity_pre_read_before_advisory_lock
    and repair_contract.finalizer_uses_user_version_advisory_lock
    and repair_contract.finalizer_locks_version_before_intent
    and repair_contract.finalizer_revalidates_locked_identity
    and repair_contract.cleanup_covers_expired_pending_and_terminal_states
    and repair_contract.terminal_cleanup_requires_exact_object_existence
    and repair_contract.actual_finalized_identity_and_path_protected
    and repair_contract.competing_different_file_does_not_blanket_protect_orphan
      as passed
  from boundary, repair_contract
)
select pg_catalog.jsonb_build_object(
  'check', 'phase07_pass2c2c_project_file_inspection_finalization',
  'verificationRevision', 'R1E2_PROSRC',
  'result', case when verdict.passed then 'PASS' else 'STOP' end,
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
        'bodyMatches', body_matches
      ) order by signature
    ) from function_audit
  ),
  'boundary', pg_catalog.to_jsonb(boundary),
  'r1Repair', pg_catalog.to_jsonb(repair_contract),
  'rowCounts', pg_catalog.jsonb_build_object(
    'uploadIntents', (select count(*) from private.project_upload_intents),
    'files', (select count(*) from public.project_submission_files),
    'projectObjects', (
      select count(*) from storage.objects where bucket_id = 'project-submissions'
    )
  )
) as phase07_pass2c2c_verification
from boundary, repair_contract, verdict;
