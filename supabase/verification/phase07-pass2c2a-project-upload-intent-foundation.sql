-- ARCH.START Phase 07.2C2A hosted verification
-- READ-ONLY. Run after the migration and before the two-account runtime test.

with
expected_column(column_name, ordinal_position, udt_name, is_nullable) as (
  values
    ('id', 1, 'uuid', 'NO'),
    ('planned_file_id', 2, 'uuid', 'NO'),
    ('user_id', 3, 'uuid', 'NO'),
    ('submission_id', 4, 'uuid', 'NO'),
    ('version_id', 5, 'uuid', 'NO'),
    ('project_code', 6, 'text', 'NO'),
    ('policy_version', 7, 'int2', 'NO'),
    ('bucket_id', 8, 'text', 'NO'),
    ('object_path', 9, 'text', 'NO'),
    ('original_filename', 10, 'text', 'NO'),
    ('declared_mime', 11, 'text', 'NO'),
    ('declared_size_bytes', 12, 'int8', 'NO'),
    ('transfer_mode', 13, 'text', 'NO'),
    ('state', 14, 'text', 'NO'),
    ('expires_at', 15, 'timestamptz', 'NO'),
    ('closed_at', 16, 'timestamptz', 'YES'),
    ('closed_reason', 17, 'text', 'YES'),
    ('finalized_file_id', 18, 'uuid', 'YES'),
    ('created_at', 19, 'timestamptz', 'NO'),
    ('updated_at', 20, 'timestamptz', 'NO')
), column_state as (
  select
    expected.column_name,
    expected.ordinal_position,
    expected.udt_name,
    expected.is_nullable,
    actual.column_name is not null as present,
    actual.ordinal_position as actual_ordinal,
    actual.udt_name as actual_udt,
    actual.is_nullable as actual_nullable
  from expected_column as expected
  left join information_schema.columns as actual
    on actual.table_schema = 'private'
    and actual.table_name = 'project_upload_intents'
    and actual.column_name = expected.column_name
), expected_constraint(name) as (
  values
    ('project_upload_intents_pkey'),
    ('project_upload_intents_planned_file_id_key'),
    ('project_upload_intents_user_id_fkey'),
    ('project_upload_intents_submission_id_fkey'),
    ('project_upload_intents_finalized_file_id_key'),
    ('project_upload_intents_finalized_file_id_fkey'),
    ('project_upload_intent_version_fk'),
    ('project_upload_intent_policy_fk'),
    ('project_upload_intent_bucket'),
    ('project_upload_intent_filename'),
    ('project_upload_intent_mime'),
    ('project_upload_intent_size'),
    ('project_upload_intent_transfer_mode'),
    ('project_upload_intent_state'),
    ('project_upload_intent_expiry'),
    ('project_upload_intent_close_reason'),
    ('project_upload_intent_final_file_identity'),
    ('project_upload_intent_lifecycle'),
    ('project_upload_intent_object_path'),
    ('project_upload_intents_object_path_key')
), constraint_state as (
  select
    expected.name,
    constraint_row.oid is not null as present,
    case when constraint_row.oid is null then null
      else pg_catalog.pg_get_constraintdef(constraint_row.oid, true) end
      as definition
  from expected_constraint as expected
  left join pg_catalog.pg_constraint as constraint_row
    on constraint_row.conname = expected.name
    and constraint_row.conrelid =
      pg_catalog.to_regclass('private.project_upload_intents')
), expected_index(name) as (
  values
    ('project_upload_intent_one_pending_version_idx'),
    ('project_upload_intents_user_recent_idx'),
    ('project_upload_intents_pending_expiry_idx')
), index_state as (
  select
    expected.name,
    index_row.indexname is not null as present,
    index_row.indexdef as definition
  from expected_index as expected
  left join pg_catalog.pg_indexes as index_row
    on index_row.schemaname = 'private'
    and index_row.tablename = 'project_upload_intents'
    and index_row.indexname = expected.name
), expected_trigger(name) as (
  values
    ('on_project_upload_intent_stamp'),
    ('on_project_upload_intent_reject_delete')
), trigger_state as (
  select
    expected.name as trigger_name,
    trigger_row.oid is not null as present,
    trigger_row.tgenabled as enabled,
    case when trigger_row.oid is null then null
      else pg_catalog.pg_get_triggerdef(trigger_row.oid, true) end
      as definition
  from expected_trigger as expected
  left join pg_catalog.pg_trigger as trigger_row
    on trigger_row.tgrelid =
      pg_catalog.to_regclass('private.project_upload_intents')
    and trigger_row.tgname = expected.name
    and not trigger_row.tgisinternal
), expected_rpc(signature) as (
  values
    ('public.create_project_upload_intent(uuid,text,text,bigint)'),
    ('public.cancel_project_upload_intent(uuid)')
), rpc_state as (
  select
    expected.signature,
    procedure.oid,
    procedure.prosecdef as security_definer,
    procedure.proconfig as configuration,
    case when procedure.oid is null then null
      else pg_catalog.md5(pg_catalog.pg_get_functiondef(procedure.oid)) end
      as definition_md5,
    case when procedure.oid is null then null
      else pg_catalog.has_function_privilege('anon', procedure.oid, 'EXECUTE') end
      as anon_execute,
    case when procedure.oid is null then null
      else pg_catalog.has_function_privilege('authenticated', procedure.oid, 'EXECUTE') end
      as authenticated_execute,
    case when procedure.oid is null then null
      else pg_catalog.has_function_privilege('service_role', procedure.oid, 'EXECUTE') end
      as service_role_execute
  from expected_rpc as expected
  left join pg_catalog.pg_proc as procedure
    on procedure.oid = pg_catalog.to_regprocedure(expected.signature)
), expected_helper(signature) as (
  values
    ('private.stamp_project_upload_intent()'),
    ('private.reject_project_upload_intent_delete()')
), helper_state as (
  select
    expected.signature,
    procedure.oid,
    procedure.prosecdef as security_definer,
    procedure.proconfig as configuration,
    case when procedure.oid is null then null
      else pg_catalog.md5(pg_catalog.pg_get_functiondef(procedure.oid)) end
      as definition_md5,
    case when procedure.oid is null then null
      else pg_catalog.has_function_privilege('anon', procedure.oid, 'EXECUTE') end
      as anon_execute,
    case when procedure.oid is null then null
      else pg_catalog.has_function_privilege('authenticated', procedure.oid, 'EXECUTE') end
      as authenticated_execute,
    case when procedure.oid is null then null
      else pg_catalog.has_function_privilege('service_role', procedure.oid, 'EXECUTE') end
      as service_role_execute
  from expected_helper as expected
  left join pg_catalog.pg_proc as procedure
    on procedure.oid = pg_catalog.to_regprocedure(expected.signature)
), expected_predecessor(signature, expected_md5, expected_caller) as (
  values
    ('public.assign_project_reviewer(uuid,uuid)', '07d99ba9d8ebcb18337212cd22ded91c', 'authenticated'),
    ('public.begin_project_review(uuid)', 'c9097e46fa20eec33673cfd3fca94382', 'authenticated'),
    ('public.create_project_draft(text)', 'b6ab7a9213dbd8dbfdfcb7326f014110', 'authenticated'),
    ('public.create_project_revision_draft(uuid)', 'ca9c53a9a3c12b087b44fad1c168ef73', 'authenticated'),
    ('public.decide_project_review(uuid,text,text,jsonb)', '44729ad70ff5014ec37a1463bc2392dd', 'authenticated'),
    ('public.resubmit_project(uuid)', 'dbc70626c4a2a831533995826d850071', 'authenticated'),
    ('public.set_project_staff_role(uuid,text,boolean,uuid)', '31b71b409acdb83dc8622a4a18949d4b', 'service_role'),
    ('public.submit_project(uuid)', '8525ca4c9241f48660ad33b589110c0a', 'authenticated'),
    ('public.update_project_draft(uuid,text,text)', '77357f0b4b260606b6df1d8219b8d890', 'authenticated'),
    ('private.stamp_project_submission_file()', 'b6867773f5ba18b11489bd508164ead0', 'service_role')
), predecessor_state as (
  select
    expected.signature,
    expected.expected_md5,
    expected.expected_caller,
    procedure.oid,
    case when procedure.oid is null then null
      else pg_catalog.md5(pg_catalog.pg_get_functiondef(procedure.oid)) end
      as actual_md5,
    procedure.prosecdef as security_definer,
    procedure.proconfig as configuration,
    case when procedure.oid is null then null
      else pg_catalog.has_function_privilege('anon', procedure.oid, 'EXECUTE') end
      as anon_execute,
    case when procedure.oid is null then null
      else pg_catalog.has_function_privilege('authenticated', procedure.oid, 'EXECUTE') end
      as authenticated_execute,
    case when procedure.oid is null then null
      else pg_catalog.has_function_privilege('service_role', procedure.oid, 'EXECUTE') end
      as service_role_execute
  from expected_predecessor as expected
  left join pg_catalog.pg_proc as procedure
    on procedure.oid = pg_catalog.to_regprocedure(expected.signature)
), table_state as (
  select
    relation.relrowsecurity as rls_enabled,
    pg_catalog.has_schema_privilege('anon', 'private', 'USAGE')
      as anon_private_schema_usage,
    pg_catalog.has_schema_privilege('authenticated', 'private', 'USAGE')
      as authenticated_private_schema_usage,
    pg_catalog.has_schema_privilege('service_role', 'private', 'USAGE')
      as service_role_private_schema_usage,
    pg_catalog.has_table_privilege('anon', relation.oid, 'SELECT')
      as anon_select,
    pg_catalog.has_table_privilege('anon', relation.oid, 'INSERT')
      as anon_insert,
    pg_catalog.has_table_privilege('anon', relation.oid, 'UPDATE')
      as anon_update,
    pg_catalog.has_table_privilege('anon', relation.oid, 'DELETE')
      as anon_delete,
    pg_catalog.has_table_privilege('authenticated', relation.oid, 'SELECT')
      as authenticated_select,
    pg_catalog.has_table_privilege('authenticated', relation.oid, 'INSERT')
      as authenticated_insert,
    pg_catalog.has_table_privilege('authenticated', relation.oid, 'UPDATE')
      as authenticated_update,
    pg_catalog.has_table_privilege('authenticated', relation.oid, 'DELETE')
      as authenticated_delete,
    pg_catalog.has_table_privilege('service_role', relation.oid, 'SELECT')
      as service_role_select,
    pg_catalog.has_table_privilege('service_role', relation.oid, 'INSERT')
      as service_role_insert,
    pg_catalog.has_table_privilege('service_role', relation.oid, 'UPDATE')
      as service_role_update,
    pg_catalog.has_table_privilege('service_role', relation.oid, 'DELETE')
      as service_role_delete,
    pg_catalog.has_table_privilege('service_role', relation.oid, 'TRUNCATE')
      as service_role_truncate,
    pg_catalog.has_table_privilege('service_role', relation.oid, 'REFERENCES')
      as service_role_references,
    pg_catalog.has_table_privilege('service_role', relation.oid, 'TRIGGER')
      as service_role_trigger
  from pg_catalog.pg_class as relation
  where relation.oid = pg_catalog.to_regclass('private.project_upload_intents')
), catalog_counts as (
  select
    (select count(*) from information_schema.columns
      where table_schema = 'private'
        and table_name = 'project_upload_intents') as columns,
    (select count(*) from pg_catalog.pg_constraint
      where conrelid = pg_catalog.to_regclass('private.project_upload_intents'))
      as constraints,
    (select count(*) from pg_catalog.pg_indexes
      where schemaname = 'private'
        and tablename = 'project_upload_intents') as indexes,
    (select count(*) from pg_catalog.pg_trigger
      where tgrelid = pg_catalog.to_regclass('private.project_upload_intents')
        and not tgisinternal) as triggers,
    (select count(*) from pg_catalog.pg_policies
      where schemaname = 'private'
        and tablename = 'project_upload_intents') as policies
), bucket_state as (
  select id, name, public, file_size_limit, allowed_mime_types
  from storage.buckets
  where id = 'project-submissions'
), storage_boundary as (
  select
    (select count(*) from pg_catalog.pg_policies
      where schemaname = 'storage'
        and tablename = 'objects'
        and (
          policyname ~* 'project'
          or coalesce(qual, '') ~* 'project-submissions'
          or coalesce(with_check, '') ~* 'project-submissions'
        )) as project_object_policies,
    (select count(*) from storage.objects
      where bucket_id = 'project-submissions') as project_objects
), row_counts as (
  select
    (select count(*) from private.project_upload_intents) as upload_intents,
    (select count(*) from private.project_staff_roles) as staff_roles,
    (select count(*) from private.project_reviewer_assignments) as reviewer_assignments,
    (select count(*) from public.project_submissions) as submissions,
    (select count(*) from public.project_submission_versions) as versions,
    (select count(*) from public.project_submission_files) as files,
    (select count(*) from public.project_reviews) as reviews,
    (select count(*) from public.project_review_criteria) as review_criteria,
    (select count(*) from public.project_status_events) as status_events,
    (select count(*) from private.project_submission_policies where is_current)
      as current_project_policies,
    (select count(*) from private.project_rubric_criteria) as rubric_criteria
)
select pg_catalog.jsonb_pretty(
  pg_catalog.jsonb_build_object(
    'schemaVersion', '1.0.0',
    'result',
      case
        when (select count(*) from column_state
          where present
            and ordinal_position = actual_ordinal
            and udt_name = actual_udt
            and is_nullable = actual_nullable) = 20
          and (select columns from catalog_counts) = 20
          and (select count(*) from constraint_state where present) = 20
          and (select constraints from catalog_counts) = 20
          and (select count(*) from index_state where present) = 3
          and (select indexes from catalog_counts) = 7
          and (select count(*) from trigger_state
            where present and enabled = 'O') = 2
          and (select triggers from catalog_counts) = 2
          and (select policies from catalog_counts) = 0
          and (select
            rls_enabled
            and anon_private_schema_usage is false
            and authenticated_private_schema_usage is false
            and service_role_private_schema_usage
            and anon_select is false
            and anon_insert is false
            and anon_update is false
            and anon_delete is false
            and authenticated_select is false
            and authenticated_insert is false
            and authenticated_update is false
            and authenticated_delete is false
            and service_role_select
            and service_role_insert
            and service_role_update
            and service_role_delete is false
            and service_role_truncate is false
            and service_role_references is false
            and service_role_trigger is false
            from table_state)
          and (select count(*) from rpc_state
            where oid is not null
              and security_definer
              and configuration is not distinct from array['search_path=""']::text[]
              and anon_execute is false
              and authenticated_execute
              and service_role_execute is false) = 2
          and (select count(*) from helper_state
            where oid is not null
              and security_definer
              and configuration is not distinct from array['search_path=""']::text[]
              and anon_execute is false
              and authenticated_execute is false
              and service_role_execute) = 2
          and (select count(*) from predecessor_state
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
              )) = 10
          and (select count(*) from bucket_state
            where name = 'project-submissions'
              and public is false
              and file_size_limit = 41943040
              and allowed_mime_types =
                array['application/pdf', 'image/png']::text[]) = 1
          and (select project_object_policies from storage_boundary) = 0
          and (select project_objects from storage_boundary) = 0
          and (select current_project_policies from row_counts) = 8
          and (select rubric_criteria from row_counts) = 40
          and (select upload_intents + staff_roles + reviewer_assignments
            + submissions + versions + files + reviews + review_criteria
            + status_events from row_counts) = 0
        then 'PASS'
        else 'STOP'
      end,
    'catalogCounts', (select pg_catalog.to_jsonb(catalog_counts) from catalog_counts),
    'columns', coalesce((select pg_catalog.jsonb_agg(
      pg_catalog.to_jsonb(column_state) order by ordinal_position)
      from column_state), '[]'::jsonb),
    'constraints', coalesce((select pg_catalog.jsonb_agg(
      pg_catalog.to_jsonb(constraint_state) order by name)
      from constraint_state), '[]'::jsonb),
    'indexes', coalesce((select pg_catalog.jsonb_agg(
      pg_catalog.to_jsonb(index_state) order by name)
      from index_state), '[]'::jsonb),
    'triggers', coalesce((select pg_catalog.jsonb_agg(
      pg_catalog.to_jsonb(trigger_state) order by trigger_name)
      from trigger_state), '[]'::jsonb),
    'tableBoundary', (select pg_catalog.to_jsonb(table_state) from table_state),
    'rpcs', coalesce((select pg_catalog.jsonb_agg(
      pg_catalog.to_jsonb(rpc_state) order by signature)
      from rpc_state), '[]'::jsonb),
    'helperFunctions', coalesce((select pg_catalog.jsonb_agg(
      pg_catalog.to_jsonb(helper_state) order by signature)
      from helper_state), '[]'::jsonb),
    'predecessorFunctions', coalesce((select pg_catalog.jsonb_agg(
      pg_catalog.to_jsonb(predecessor_state) order by signature)
      from predecessor_state), '[]'::jsonb),
    'bucket', (select pg_catalog.to_jsonb(bucket_state) from bucket_state),
    'storageBoundary', (select pg_catalog.to_jsonb(storage_boundary) from storage_boundary),
    'rowCounts', (select pg_catalog.to_jsonb(row_counts) from row_counts)
  )
) as phase07_pass2c2a_upload_intent_verification;
