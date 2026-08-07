-- ARCH.START Phase 07.2C2B2A — standard signed-transfer readiness
-- READ-ONLY. Run the whole SELECT once as postgres.
-- This pass has no migration and must leave every hosted row/object count unchanged.

with
expected_function(
  signature,
  expected_caller,
  expected_md5
) as (
  values
    (
      'public.create_project_upload_intent(uuid,text,text,bigint)',
      'authenticated',
      '0807ba2150245b62bd24287cd66c0fdc'
    ),
    (
      'public.cancel_project_upload_intent(uuid)',
      'authenticated',
      '04610018d73892ad60dd3b1b4ca06c51'
    ),
    (
      'private.stamp_project_upload_intent()',
      'service_role',
      '0e8dac189de44fdc0f789312b6ed1bfb'
    ),
    (
      'private.reject_project_upload_intent_delete()',
      'service_role',
      '6e7c445e65917d4b75e6912c24e6c6a4'
    )
),
function_state as (
  select
    expected.signature,
    expected.expected_caller,
    expected.expected_md5,
    procedure.oid,
    case
      when procedure.oid is null then null
      else pg_catalog.md5(
        pg_catalog.pg_get_functiondef(procedure.oid)
      )
    end as definition_md5,
    procedure.prosecdef as security_definer,
    procedure.proconfig as configuration,
    case
      when procedure.oid is null then null
      else pg_catalog.has_function_privilege(
        'anon',
        procedure.oid,
        'EXECUTE'
      )
    end as anon_execute,
    case
      when procedure.oid is null then null
      else pg_catalog.has_function_privilege(
        'authenticated',
        procedure.oid,
        'EXECUTE'
      )
    end as authenticated_execute,
    case
      when procedure.oid is null then null
      else pg_catalog.has_function_privilege(
        'service_role',
        procedure.oid,
        'EXECUTE'
      )
    end as service_role_execute
  from expected_function as expected
  left join pg_catalog.pg_proc as procedure
    on procedure.oid = pg_catalog.to_regprocedure(
      expected.signature
    )
),
intent_table_state as (
  select
    relation.oid,
    relation.relrowsecurity as rls_enabled,
    relation.relforcerowsecurity as force_rls
  from pg_catalog.pg_class as relation
  join pg_catalog.pg_namespace as namespace
    on namespace.oid = relation.relnamespace
  where namespace.nspname = 'private'
    and relation.relname = 'project_upload_intents'
    and relation.relkind in ('r', 'p')
),
bucket_state as (
  select
    bucket.id,
    bucket.name,
    bucket.public,
    bucket.file_size_limit,
    bucket.allowed_mime_types
  from storage.buckets as bucket
  where bucket.id = 'project-submissions'
),
storage_table_state as (
  select
    relation.relname as table_name,
    relation.relrowsecurity as rls_enabled
  from pg_catalog.pg_class as relation
  join pg_catalog.pg_namespace as namespace
    on namespace.oid = relation.relnamespace
  where namespace.nspname = 'storage'
    and relation.relname in ('buckets', 'objects')
    and relation.relkind in ('r', 'p')
),
storage_policy_state as (
  select
    policy.policyname,
    policy.roles,
    policy.cmd,
    policy.qual,
    policy.with_check
  from pg_catalog.pg_policies as policy
  where policy.schemaname = 'storage'
    and policy.tablename = 'objects'
    and (
      policy.policyname ~* 'project'
      or coalesce(policy.qual, '') ~* 'project-submissions'
      or coalesce(policy.with_check, '') ~* 'project-submissions'
    )
),
row_counts as (
  select
    (
      select count(*)
      from private.project_upload_intents
    )::integer as upload_intents,
    (
      select count(*)
      from private.project_staff_roles
    )::integer as staff_roles,
    (
      select count(*)
      from private.project_reviewer_assignments
    )::integer as reviewer_assignments,
    (
      select count(*)
      from public.project_submissions
    )::integer as submissions,
    (
      select count(*)
      from public.project_submission_versions
    )::integer as versions,
    (
      select count(*)
      from public.project_submission_files
    )::integer as files,
    (
      select count(*)
      from public.project_reviews
    )::integer as reviews,
    (
      select count(*)
      from public.project_review_criteria
    )::integer as review_criteria,
    (
      select count(*)
      from public.project_status_events
    )::integer as status_events,
    (
      select count(*)
      from storage.objects
      where bucket_id = 'project-submissions'
    )::integer as project_objects,
    (
      select count(*)
      from private.project_submission_policies
      where is_current
    )::integer as current_project_policies,
    (
      select count(*)
      from private.project_rubric_criteria
    )::integer as rubric_criteria
)
select pg_catalog.jsonb_pretty(
  pg_catalog.jsonb_build_object(
    'schemaVersion',
      '1.0.0',
    'result',
      case
        when (
          select count(*)
          from bucket_state
          where name = 'project-submissions'
            and public is false
            and file_size_limit = 41943040
            and allowed_mime_types = array[
              'application/pdf',
              'image/png'
            ]::text[]
        ) = 1
          and (
            select count(*)
            from storage_table_state
            where rls_enabled
          ) = 2
          and (
            select count(*)
            from storage_policy_state
          ) = 0
          and (
            select count(*)
            from intent_table_state
            where rls_enabled
          ) = 1
          and (
            select count(*)
            from pg_catalog.pg_policies
            where schemaname = 'private'
              and tablename = 'project_upload_intents'
          ) = 0
          and (
            select count(*)
            from function_state
            where oid is not null
              and definition_md5 = expected_md5
              and security_definer
              and configuration
                is not distinct from
                array['search_path=""']::text[]
              and anon_execute is false
              and (
                (
                  expected_caller = 'authenticated'
                  and authenticated_execute
                  and service_role_execute is false
                )
                or
                (
                  expected_caller = 'service_role'
                  and authenticated_execute is false
                  and service_role_execute
                )
              )
          ) = 4
          and (
            select
              upload_intents
              + staff_roles
              + reviewer_assignments
              + submissions
              + versions
              + files
              + reviews
              + review_criteria
              + status_events
              + project_objects
            from row_counts
          ) = 0
          and (
            select current_project_policies
            from row_counts
          ) = 8
          and (
            select rubric_criteria
            from row_counts
          ) = 40
        then 'PASS'
        else 'STOP'
      end,
    'bucket',
      (
        select pg_catalog.to_jsonb(bucket_state)
        from bucket_state
      ),
    'storageTables',
      coalesce(
        (
          select pg_catalog.jsonb_agg(
            pg_catalog.to_jsonb(storage_table_state)
            order by table_name
          )
          from storage_table_state
        ),
        '[]'::jsonb
      ),
    'projectObjectPolicies',
      pg_catalog.jsonb_build_object(
        'count',
          (
            select count(*)
            from storage_policy_state
          ),
        'details',
          coalesce(
            (
              select pg_catalog.jsonb_agg(
                pg_catalog.to_jsonb(storage_policy_state)
                order by policyname
              )
              from storage_policy_state
            ),
            '[]'::jsonb
          )
      ),
    'intentTable',
      pg_catalog.jsonb_build_object(
        'present',
          (
            select count(*)
            from intent_table_state
          ) = 1,
        'rlsEnabled',
          coalesce(
            (
              select rls_enabled
              from intent_table_state
            ),
            false
          ),
        'forceRls',
          coalesce(
            (
              select force_rls
              from intent_table_state
            ),
            false
          ),
        'policyCount',
          (
            select count(*)
            from pg_catalog.pg_policies
            where schemaname = 'private'
              and tablename = 'project_upload_intents'
          )
      ),
    'intentFunctions',
      coalesce(
        (
          select pg_catalog.jsonb_agg(
            pg_catalog.jsonb_build_object(
              'signature', signature,
              'present', oid is not null,
              'expectedMd5', expected_md5,
              'definitionMd5', definition_md5,
              'securityDefiner', security_definer,
              'configuration', configuration,
              'anonExecute', anon_execute,
              'authenticatedExecute', authenticated_execute,
              'serviceRoleExecute', service_role_execute,
              'expectedCaller', expected_caller
            )
            order by signature
          )
          from function_state
        ),
        '[]'::jsonb
      ),
    'rowCounts',
      (
        select pg_catalog.to_jsonb(row_counts)
        from row_counts
      )
  )
) as phase07_pass2c2b2a_standard_transfer_readiness;
