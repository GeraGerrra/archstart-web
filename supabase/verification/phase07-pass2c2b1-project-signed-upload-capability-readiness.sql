-- ARCH.START Phase 07.2C2B1 — signed-upload capability readiness
-- READ-ONLY. Run the complete SELECT as postgres before and after the source pass.
-- It returns aggregate/schema metadata only and creates no token or object.

with intent_functions(signature, expected_caller) as (
  values
    ('public.create_project_upload_intent(uuid,text,text,bigint)', 'authenticated'),
    ('public.cancel_project_upload_intent(uuid)', 'authenticated'),
    ('private.stamp_project_upload_intent()', 'service_role'),
    ('private.reject_project_upload_intent_delete()', 'service_role')
), intent_function_state as (
  select
    expected.signature,
    expected.expected_caller,
    procedure.oid,
    procedure.prosecdef as security_definer,
    procedure.proconfig as configuration,
    case when procedure.oid is null then null
      else pg_catalog.has_function_privilege('anon', procedure.oid, 'EXECUTE')
    end as anon_execute,
    case when procedure.oid is null then null
      else pg_catalog.has_function_privilege('authenticated', procedure.oid, 'EXECUTE')
    end as authenticated_execute,
    case when procedure.oid is null then null
      else pg_catalog.has_function_privilege('service_role', procedure.oid, 'EXECUTE')
    end as service_role_execute
  from intent_functions as expected
  left join pg_catalog.pg_proc as procedure
    on procedure.oid = pg_catalog.to_regprocedure(expected.signature)
), row_counts as (
  select
    (select count(*) from private.project_upload_intents)::integer as upload_intents,
    (select count(*) from private.project_staff_roles)::integer as staff_roles,
    (select count(*) from private.project_reviewer_assignments)::integer as reviewer_assignments,
    (select count(*) from public.project_submissions)::integer as submissions,
    (select count(*) from public.project_submission_versions)::integer as versions,
    (select count(*) from public.project_submission_files)::integer as files,
    (select count(*) from public.project_reviews)::integer as reviews,
    (select count(*) from public.project_review_criteria)::integer as review_criteria,
    (select count(*) from public.project_status_events)::integer as status_events,
    (select count(*) from storage.objects where bucket_id = 'project-submissions')::integer as project_objects
), storage_boundary as (
  select
    exists (
      select 1
      from storage.buckets as bucket
      where bucket.id = 'project-submissions'
        and bucket.name = 'project-submissions'
        and bucket.public is false
        and bucket.file_size_limit = 41943040
        and bucket.allowed_mime_types = array['application/pdf', 'image/png']::text[]
    ) as exact_bucket,
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
    )::integer as project_object_policies
), intent_table_boundary as (
  select
    relation.oid,
    relation.relrowsecurity as rls_enabled
  from pg_catalog.pg_class as relation
  join pg_catalog.pg_namespace as namespace
    on namespace.oid = relation.relnamespace
  where namespace.nspname = 'private'
    and relation.relname = 'project_upload_intents'
    and relation.relkind in ('r', 'p')
)
select pg_catalog.jsonb_pretty(
  pg_catalog.jsonb_build_object(
    'schemaVersion', '1.0.0',
    'result',
      case
        when (select exact_bucket from storage_boundary)
          and (select project_object_policies from storage_boundary) = 0
          and (select count(*) from intent_table_boundary where rls_enabled) = 1
          and (select count(*) from pg_catalog.pg_policies where schemaname = 'private' and tablename = 'project_upload_intents') = 0
          and (
            select count(*)
            from intent_function_state
            where oid is not null
              and security_definer
              and configuration is not distinct from array['search_path=""']::text[]
              and anon_execute is false
              and (
                expected_caller = 'authenticated'
                and authenticated_execute
                and service_role_execute is false
                or expected_caller = 'service_role'
                and authenticated_execute is false
                and service_role_execute
              )
          ) = 4
          and (
            select upload_intents + staff_roles + reviewer_assignments + submissions
              + versions + files + reviews + review_criteria + status_events
              + project_objects
            from row_counts
          ) = 0
          and (select count(*) from private.project_submission_policies where is_current) = 8
          and (select count(*) from private.project_rubric_criteria) = 40
        then 'PASS'
        else 'STOP'
      end,
    'bucket',
      pg_catalog.jsonb_build_object(
        'id', 'project-submissions',
        'exact', (select exact_bucket from storage_boundary),
        'projectObjectPolicies', (select project_object_policies from storage_boundary)
      ),
    'intentTable',
      pg_catalog.jsonb_build_object(
        'present', (select count(*) from intent_table_boundary) = 1,
        'rlsEnabled', (select count(*) from intent_table_boundary where rls_enabled) = 1,
        'policyCount', (select count(*) from pg_catalog.pg_policies where schemaname = 'private' and tablename = 'project_upload_intents')
      ),
    'intentFunctions',
      coalesce(
        (
          select pg_catalog.jsonb_agg(
            pg_catalog.jsonb_build_object(
              'signature', signature,
              'present', oid is not null,
              'expectedCaller', expected_caller,
              'securityDefiner', security_definer,
              'configuration', configuration,
              'anonExecute', anon_execute,
              'authenticatedExecute', authenticated_execute,
              'serviceRoleExecute', service_role_execute
            ) order by signature
          )
          from intent_function_state
        ),
        '[]'::jsonb
      ),
    'rowCounts', (select pg_catalog.to_jsonb(row_counts) from row_counts),
    'catalogCounts',
      pg_catalog.jsonb_build_object(
        'currentProjectPolicies', (select count(*) from private.project_submission_policies where is_current),
        'rubricCriteria', (select count(*) from private.project_rubric_criteria)
      )
  )
) as phase07_pass2c2b1_signed_upload_readiness;
