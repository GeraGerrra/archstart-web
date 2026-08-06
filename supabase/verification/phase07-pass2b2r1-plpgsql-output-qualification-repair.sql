-- ARCH.START Phase 07 Pass 2B2-R1 — hosted verification
-- READ-ONLY. Run after the repair migration and before rerunning the two-account test.

with repaired_function(signature, expected_caller, required_fragments) as (
  values
    (
      'public.set_project_staff_role(uuid,text,boolean,uuid)',
      'service_role',
      array[
        'update private.project_staff_roles as staff',
        'staff.staff_role = normalized_role'
      ]::text[]
    ),
    (
      'public.create_project_draft(text)',
      'authenticated',
      array[
        'inserted_submission.current_status',
        'inserted_version.version_number',
        'inserted_version.version_state'
      ]::text[]
    ),
    (
      'public.create_project_revision_draft(uuid)',
      'authenticated',
      array[
        'inserted_version.version_number',
        'inserted_version.version_state'
      ]::text[]
    ),
    (
      'public.assign_project_reviewer(uuid,uuid)',
      'authenticated',
      array[
        'inserted_assignment.id',
        'inserted_assignment.assigned_at'
      ]::text[]
    )
), function_state as (
  select
    expected.signature,
    expected.expected_caller,
    procedure.oid,
    procedure.prosecdef,
    procedure.proconfig,
    pg_catalog.pg_get_functiondef(procedure.oid) as definition,
    pg_catalog.md5(pg_catalog.pg_get_functiondef(procedure.oid)) as definition_md5,
    pg_catalog.has_function_privilege('anon', procedure.oid, 'EXECUTE') as anon_execute,
    pg_catalog.has_function_privilege('authenticated', procedure.oid, 'EXECUTE') as authenticated_execute,
    pg_catalog.has_function_privilege('service_role', procedure.oid, 'EXECUTE') as service_role_execute,
    expected.required_fragments
  from repaired_function as expected
  left join pg_catalog.pg_proc as procedure
    on procedure.oid = pg_catalog.to_regprocedure(expected.signature)
), fragment_state as (
  select
    function_state.signature,
    fragment,
    pg_catalog.position(fragment in function_state.definition) > 0 as present
  from function_state
  cross join lateral pg_catalog.unnest(
    function_state.required_fragments
  ) as fragment
), row_counts as (
  select
    (select count(*) from private.project_staff_roles) as staff_roles,
    (select count(*) from private.project_reviewer_assignments) as assignments,
    (select count(*) from public.project_submissions) as submissions,
    (select count(*) from public.project_submission_versions) as versions,
    (select count(*) from public.project_submission_files) as files,
    (select count(*) from public.project_reviews) as reviews,
    (select count(*) from public.project_review_criteria) as review_criteria,
    (select count(*) from public.project_status_events) as status_events,
    (select count(*) from public.quiz_attempts) as quiz_attempts,
    (select count(*) from public.lesson_completions) as lesson_completions
), storage_state as (
  select
    exists (
      select 1 from storage.buckets where id = 'project-submissions'
    ) as project_bucket_exists,
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
    ) as project_object_policies
)
select pg_catalog.jsonb_pretty(
  pg_catalog.jsonb_build_object(
    'schemaVersion', '1.0.0',
    'result', case
      when (select count(*) from function_state where oid is not null) = 4
        and (select count(*) from function_state where prosecdef) = 4
        and (select count(*) from function_state where proconfig = array['search_path=""']::text[]) = 4
        and (select count(*) from fragment_state where present) = (select count(*) from fragment_state)
        and (select count(*) from function_state where anon_execute) = 0
        and (select count(*) from function_state where expected_caller = 'authenticated' and authenticated_execute) = 3
        and (select count(*) from function_state where expected_caller = 'service_role' and service_role_execute) = 1
        and (select count(*) from function_state where expected_caller = 'service_role' and authenticated_execute) = 0
        and (
          select staff_roles + assignments + submissions + versions + files + reviews + review_criteria + status_events + quiz_attempts + lesson_completions
          from row_counts
        ) = 0
        and (select project_bucket_exists from storage_state) is false
        and (select project_object_policies from storage_state) = 0
      then 'PASS'
      else 'STOP'
    end,
    'functions', (
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'signature', signature,
          'present', oid is not null,
          'definitionMd5', definition_md5,
          'securityDefiner', prosecdef,
          'configuration', proconfig,
          'anonExecute', anon_execute,
          'authenticatedExecute', authenticated_execute,
          'serviceRoleExecute', service_role_execute
        ) order by signature
      ) from function_state
    ),
    'qualificationFragments', (
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'signature', signature,
          'fragment', fragment,
          'present', present
        ) order by signature, fragment
      ) from fragment_state
    ),
    'rowCounts', (select pg_catalog.to_jsonb(row_counts) from row_counts),
    'storageBoundary', (select pg_catalog.to_jsonb(storage_state) from storage_state)
  )
) as phase07_pass2b2r1_verification;
