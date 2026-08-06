-- ARCH.START Phase 07 Pass 2B2 — hosted workflow verification
-- READ-ONLY. Run the whole SELECT once as postgres after the migration.

with expected_rpc(name, signature, expected_caller) as (
  values
    ('set_project_staff_role', 'public.set_project_staff_role(uuid,text,boolean,uuid)', 'service_role'),
    ('create_project_draft', 'public.create_project_draft(text)', 'authenticated'),
    ('update_project_draft', 'public.update_project_draft(uuid,text,text)', 'authenticated'),
    ('submit_project', 'public.submit_project(uuid)', 'authenticated'),
    ('create_project_revision_draft', 'public.create_project_revision_draft(uuid)', 'authenticated'),
    ('resubmit_project', 'public.resubmit_project(uuid)', 'authenticated'),
    ('assign_project_reviewer', 'public.assign_project_reviewer(uuid,uuid)', 'authenticated'),
    ('begin_project_review', 'public.begin_project_review(uuid)', 'authenticated'),
    ('decide_project_review', 'public.decide_project_review(uuid,text,text,jsonb)', 'authenticated')
), rpc as (
  select
    expected.name,
    expected.signature,
    expected.expected_caller,
    procedure.oid,
    procedure.prosecdef,
    procedure.provolatile,
    procedure.proconfig,
    pg_catalog.pg_get_function_result(procedure.oid) as result_type,
    pg_catalog.has_function_privilege('anon', procedure.oid, 'EXECUTE') as anon_execute,
    pg_catalog.has_function_privilege('authenticated', procedure.oid, 'EXECUTE') as authenticated_execute,
    pg_catalog.has_function_privilege('service_role', procedure.oid, 'EXECUTE') as service_role_execute,
    pg_catalog.md5(pg_catalog.pg_get_functiondef(procedure.oid)) as definition_md5,
    pg_catalog.obj_description(procedure.oid, 'pg_proc') as description
  from expected_rpc as expected
  left join pg_catalog.pg_proc as procedure
    on procedure.oid = pg_catalog.to_regprocedure(expected.signature)
), expected_b1_function(signature, expected_md5) as (
  values
    ('private.project_submission_transition_is_allowed(text,text)', 'ba8e1f472cbb6fbd4cddf313289778f4'),
    ('private.project_staff_has_role(uuid,text[])', '485a390ee73f0be5645d4401f479dd37'),
    ('private.project_supporting_text_word_count(text)', '59bd8adf81f62386b3c5bdf9a07a722b'),
    ('private.project_version_meets_submission_policy(uuid)', 'fd2f9322adbd13ca9ba2836a53cc14bf'),
    ('private.project_review_is_complete(uuid,text)', '6e925c263e14b35776a7b3c77b36a12c'),
    ('private.stamp_project_staff_role()', 'cc894aa356dcf2095013113685ad85af'),
    ('private.stamp_project_submission()', 'a82fd3909a8fd1db3bd99f37a3acf330'),
    ('private.guard_project_submission_delete()', '440e470774714bcac3b15b1cb63bcd4d'),
    ('private.stamp_project_submission_version()', '90118748556f13f32a3c168053143bf8'),
    ('private.guard_project_version_delete()', '26bcdc98fd890a6c3cd9b0eb4d1bf601'),
    ('private.stamp_project_submission_file()', 'b6867773f5ba18b11489bd508164ead0'),
    ('private.guard_project_file_delete()', '9c10706a072309296f68e1a045300d6d'),
    ('private.stamp_project_reviewer_assignment()', '8f8154de624513ee02a1be063e74c6cd'),
    ('private.stamp_project_review()', 'd6c01cfce04a878791a45533ec91e0b7'),
    ('private.stamp_project_review_criterion()', 'bc20c81c4e52de9486decd1bf515e4ab'),
    ('private.stamp_project_status_event()', '25ce484c63363644c8f490345c549446'),
    ('private.reject_project_immutable_mutation()', 'e7f3a5072ae7a8f00a0d1d7052e6344f')
), b1_function as (
  select
    expected.signature,
    expected.expected_md5,
    procedure.oid,
    case
      when procedure.oid is null then null
      else pg_catalog.md5(pg_catalog.pg_get_functiondef(procedure.oid))
    end as actual_md5
  from expected_b1_function as expected
  left join pg_catalog.pg_proc as procedure
    on procedure.oid = pg_catalog.to_regprocedure(expected.signature)
), project_trigger as (
  select trigger.tgenabled
  from pg_catalog.pg_trigger as trigger
  join pg_catalog.pg_class as relation
    on relation.oid = trigger.tgrelid
  join pg_catalog.pg_namespace as namespace
    on namespace.oid = relation.relnamespace
  where not trigger.tgisinternal
    and (
      (
        namespace.nspname = 'private'
        and relation.relname in (
          'project_staff_roles',
          'project_reviewer_assignments'
        )
      )
      or (
        namespace.nspname = 'public'
        and relation.relname in (
          'project_submissions',
          'project_submission_versions',
          'project_submission_files',
          'project_reviews',
          'project_review_criteria',
          'project_status_events'
        )
      )
    )
), row_counts as (
  select
    (select count(*) from private.project_submission_policies where is_current) as current_project_policies,
    (select count(*) from private.project_rubric_criteria) as rubric_criteria,
    (select count(*) from private.project_staff_roles) as staff_roles,
    (select count(*) from private.project_reviewer_assignments) as reviewer_assignments,
    (select count(*) from public.project_submissions) as submissions,
    (select count(*) from public.project_submission_versions) as versions,
    (select count(*) from public.project_submission_files) as files,
    (select count(*) from public.project_reviews) as reviews,
    (select count(*) from public.project_review_criteria) as review_criteria,
    (select count(*) from public.project_status_events) as status_events
)
select pg_catalog.jsonb_pretty(
  pg_catalog.jsonb_build_object(
    'schemaVersion', '1.0.0',
    'result',
      case
        when (select count(*) from rpc where oid is not null) = 9
          and (select pg_catalog.bool_and(prosecdef) from rpc where oid is not null)
          and (select pg_catalog.bool_and(proconfig = array['search_path=""']::text[]) from rpc where oid is not null)
          and (select count(*) from rpc where anon_execute) = 0
          and (select count(*) from rpc where authenticated_execute) = 8
          and (select count(*) from rpc where service_role_execute) = 1
          and (select authenticated_execute from rpc where name = 'set_project_staff_role') is false
          and (select service_role_execute from rpc where name = 'set_project_staff_role') is true
          and (select count(*) from b1_function where oid is not null and actual_md5 = expected_md5) = 17
          and (select count(*) from project_trigger) = 16
          and (select count(*) from project_trigger where tgenabled = 'O') = 16
          and not pg_catalog.has_table_privilege('anon', 'public.project_submissions', 'SELECT')
          and not pg_catalog.has_table_privilege('authenticated', 'public.project_submissions', 'INSERT')
          and not pg_catalog.has_table_privilege('authenticated', 'public.project_submission_versions', 'UPDATE')
          and not pg_catalog.has_table_privilege('authenticated', 'public.project_submission_files', 'INSERT')
          and not pg_catalog.has_table_privilege('authenticated', 'public.project_reviews', 'INSERT')
          and not exists (
            select 1 from storage.buckets where id = 'project-submissions'
          )
          and not exists (
            select 1
            from pg_catalog.pg_policies
            where schemaname = 'storage'
              and tablename = 'objects'
              and (
                policyname ~* 'project'
                or coalesce(qual, '') ~* 'project-submissions'
                or coalesce(with_check, '') ~* 'project-submissions'
              )
          )
          and (select current_project_policies from row_counts) = 8
          and (select rubric_criteria from row_counts) = 40
          and (select staff_roles + reviewer_assignments + submissions + versions + files + reviews + review_criteria + status_events from row_counts) = 0
        then 'PASS'
        else 'STOP'
      end,
    'workflowRpcCount',
      (select count(*) from rpc where oid is not null),
    'workflowRpcs',
      coalesce(
        (
          select pg_catalog.jsonb_agg(
            pg_catalog.jsonb_build_object(
              'name', name,
              'signature', signature,
              'expectedCaller', expected_caller,
              'present', oid is not null,
              'securityDefiner', prosecdef,
              'configuration', proconfig,
              'volatility', provolatile,
              'resultType', result_type,
              'anonExecute', anon_execute,
              'authenticatedExecute', authenticated_execute,
              'serviceRoleExecute', service_role_execute,
              'definitionMd5', definition_md5,
              'description', description
            ) order by name
          )
          from rpc
        ),
        '[]'::jsonb
      ),
    'privilegeSummary',
      pg_catalog.jsonb_build_object(
        'anonWorkflowExecuteCount',
          (select count(*) from rpc where anon_execute),
        'authenticatedWorkflowExecuteCount',
          (select count(*) from rpc where authenticated_execute),
        'serviceRoleWorkflowExecuteCount',
          (select count(*) from rpc where service_role_execute),
        'authenticatedCanSetStaffRole',
          (select authenticated_execute from rpc where name = 'set_project_staff_role'),
        'serviceRoleCanSetStaffRole',
          (select service_role_execute from rpc where name = 'set_project_staff_role'),
        'anonCanSelectSubmissions',
          pg_catalog.has_table_privilege('anon', 'public.project_submissions', 'SELECT'),
        'authenticatedCanInsertSubmissions',
          pg_catalog.has_table_privilege('authenticated', 'public.project_submissions', 'INSERT'),
        'authenticatedCanUpdateVersions',
          pg_catalog.has_table_privilege('authenticated', 'public.project_submission_versions', 'UPDATE'),
        'authenticatedCanInsertFiles',
          pg_catalog.has_table_privilege('authenticated', 'public.project_submission_files', 'INSERT'),
        'authenticatedCanInsertReviews',
          pg_catalog.has_table_privilege('authenticated', 'public.project_reviews', 'INSERT')
      ),
    'b1FunctionIdentity',
      pg_catalog.jsonb_build_object(
        'expected', 17,
        'matched',
          (select count(*) from b1_function where oid is not null and actual_md5 = expected_md5),
        'mismatches',
          coalesce(
            (
              select pg_catalog.jsonb_agg(
                pg_catalog.jsonb_build_object(
                  'signature', signature,
                  'expectedMd5', expected_md5,
                  'actualMd5', actual_md5
                ) order by signature
              )
              from b1_function
              where oid is null or actual_md5 is distinct from expected_md5
            ),
            '[]'::jsonb
          )
      ),
    'triggerSummary',
      pg_catalog.jsonb_build_object(
        'expected', 16,
        'found', (select count(*) from project_trigger),
        'enabledNormally',
          (select count(*) from project_trigger where tgenabled = 'O'),
        'disabledOrAlternate',
          (select count(*) from project_trigger where tgenabled <> 'O')
      ),
    'rowCounts',
      (select pg_catalog.to_jsonb(row_counts) from row_counts),
    'storageBoundary',
      pg_catalog.jsonb_build_object(
        'projectBucketExists',
          exists (select 1 from storage.buckets where id = 'project-submissions'),
        'projectObjectPolicies',
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
          )
      )
  )
) as phase07_pass2b2_workflow_verification;
