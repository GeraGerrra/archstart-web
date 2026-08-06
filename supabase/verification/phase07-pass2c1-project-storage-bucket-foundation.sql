-- ARCH.START Phase 07 Pass 2C1 — hosted verification
-- READ-ONLY. Run the whole SELECT once as postgres after the migration.

with expected_rpc(signature, expected_md5, expected_caller) as (
  values
    ('public.assign_project_reviewer(uuid,uuid)', '07d99ba9d8ebcb18337212cd22ded91c', 'authenticated'),
    ('public.begin_project_review(uuid)', 'c9097e46fa20eec33673cfd3fca94382', 'authenticated'),
    ('public.create_project_draft(text)', 'b6ab7a9213dbd8dbfdfcb7326f014110', 'authenticated'),
    ('public.create_project_revision_draft(uuid)', 'ca9c53a9a3c12b087b44fad1c168ef73', 'authenticated'),
    ('public.decide_project_review(uuid,text,text,jsonb)', '44729ad70ff5014ec37a1463bc2392dd', 'authenticated'),
    ('public.resubmit_project(uuid)', 'dbc70626c4a2a831533995826d850071', 'authenticated'),
    ('public.set_project_staff_role(uuid,text,boolean,uuid)', '31b71b409acdb83dc8622a4a18949d4b', 'service_role'),
    ('public.submit_project(uuid)', '8525ca4c9241f48660ad33b589110c0a', 'authenticated'),
    ('public.update_project_draft(uuid,text,text)', '77357f0b4b260606b6df1d8219b8d890', 'authenticated')
), rpc_state as (
  select
    expected.signature,
    expected.expected_md5,
    expected.expected_caller,
    procedure.oid,
    case
      when procedure.oid is null then null
      else pg_catalog.md5(pg_catalog.pg_get_functiondef(procedure.oid))
    end as actual_md5,
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
  from expected_rpc as expected
  left join pg_catalog.pg_proc as procedure
    on procedure.oid = pg_catalog.to_regprocedure(expected.signature)
), storage_table_state as (
  select
    relation.relname as table_name,
    relation.relrowsecurity as rls_enabled,
    relation.relforcerowsecurity as force_rls
  from pg_catalog.pg_class as relation
  join pg_catalog.pg_namespace as namespace
    on namespace.oid = relation.relnamespace
  where namespace.nspname = 'storage'
    and relation.relname in ('buckets', 'objects')
    and relation.relkind in ('r', 'p')
), bucket_state as (
  select
    bucket.id,
    bucket.name,
    bucket.public,
    bucket.file_size_limit,
    bucket.allowed_mime_types,
    bucket.created_at,
    bucket.updated_at
  from storage.buckets as bucket
  where bucket.id = 'project-submissions'
), project_policy_state as (
  select
    policy.policyname,
    policy.permissive,
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
), row_counts as (
  select
    (select count(*) from private.project_staff_roles)::integer as staff_roles,
    (select count(*) from private.project_reviewer_assignments)::integer as reviewer_assignments,
    (select count(*) from public.project_submissions)::integer as submissions,
    (select count(*) from public.project_submission_versions)::integer as versions,
    (select count(*) from public.project_submission_files)::integer as files,
    (select count(*) from public.project_reviews)::integer as reviews,
    (select count(*) from public.project_review_criteria)::integer as review_criteria,
    (select count(*) from public.project_status_events)::integer as status_events,
    (
      select count(*) from storage.objects
      where bucket_id = 'project-submissions'
    )::integer as project_objects
)
select pg_catalog.jsonb_pretty(
  pg_catalog.jsonb_build_object(
    'schemaVersion', '1.0.0',
    'result',
      case
        when (select count(*) from bucket_state) = 1
          and (select count(*) from bucket_state where name = 'project-submissions') = 1
          and (select count(*) from bucket_state where public is false) = 1
          and (select count(*) from bucket_state where file_size_limit = 41943040) = 1
          and (
            select count(*) from bucket_state
            where allowed_mime_types = array['application/pdf', 'image/png']::text[]
          ) = 1
          and (select count(*) from storage_table_state where rls_enabled) = 2
          and (select count(*) from project_policy_state) = 0
          and (
            select staff_roles + reviewer_assignments + submissions + versions
              + files + reviews + review_criteria + status_events + project_objects
            from row_counts
          ) = 0
          and (
            select count(*)
            from rpc_state
            where oid is not null
              and actual_md5 = expected_md5
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
          ) = 9
        then 'PASS'
        else 'STOP'
      end,
    'bucket',
      pg_catalog.jsonb_build_object(
        'expected',
          pg_catalog.jsonb_build_object(
            'id', 'project-submissions',
            'name', 'project-submissions',
            'public', false,
            'fileSizeLimit', 41943040,
            'allowedMimeTypes', array['application/pdf', 'image/png']::text[]
          ),
        'actual',
          (select pg_catalog.to_jsonb(bucket_state) from bucket_state)
      ),
    'closedBrowserPolicyBoundary',
      pg_catalog.jsonb_build_object(
        'projectObjectPolicyCount', (select count(*) from project_policy_state),
        'details', coalesce(
          (
            select pg_catalog.jsonb_agg(
              pg_catalog.to_jsonb(project_policy_state) order by policyname
            )
            from project_policy_state
          ),
          '[]'::jsonb
        )
      ),
    'storageTables',
      coalesce(
        (
          select pg_catalog.jsonb_agg(
            pg_catalog.to_jsonb(storage_table_state) order by table_name
          )
          from storage_table_state
        ),
        '[]'::jsonb
      ),
    'workflowRpcs',
      coalesce(
        (
          select pg_catalog.jsonb_agg(
            pg_catalog.jsonb_build_object(
              'signature', signature,
              'present', oid is not null,
              'definitionMd5', actual_md5,
              'expectedMd5', expected_md5,
              'securityDefiner', security_definer,
              'configuration', configuration,
              'anonExecute', anon_execute,
              'authenticatedExecute', authenticated_execute,
              'serviceRoleExecute', service_role_execute,
              'expectedCaller', expected_caller
            ) order by signature
          )
          from rpc_state
        ),
        '[]'::jsonb
      ),
    'rowCounts',
      (select pg_catalog.to_jsonb(row_counts) from row_counts)
  )
) as phase07_pass2c1_storage_verification;
