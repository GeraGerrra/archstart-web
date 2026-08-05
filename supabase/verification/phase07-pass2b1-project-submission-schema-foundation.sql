-- ARCH.START Phase 07 Pass 2B1 — hosted verification
-- Run only after the migration completed successfully.

-- Accepted predecessor catalogs remain exact.
select
  (select count(*) from private.course_modules) as module_count,
  (select count(*) from private.course_lessons) as lesson_count,
  (select count(*) from private.course_projects) as project_count,
  to_regclass('public.lesson_activity') is not null
    as lesson_activity_exists,
  to_regclass('public.quiz_attempts') is not null
    as quiz_attempts_exists,
  to_regclass('public.lesson_completions') is not null
    as lesson_completions_exists,
  to_regclass('public.module_completions') is not null
    as module_completions_exists;

-- Private policy/rubric authority.
select
  (select count(*)
   from private.project_submission_policies
   where is_current) as current_policy_count,
  (select count(*)
   from private.project_rubric_criteria) as rubric_criterion_count,
  (select count(*)
   from private.project_staff_roles) as staff_role_rows,
  (select count(*)
   from private.project_reviewer_assignments) as assignment_rows;

select
  project_code,
  policy_version,
  content_version,
  format_type,
  allowed_mime_types,
  max_file_bytes,
  min_page_count,
  max_page_count,
  supporting_text_min_words,
  supporting_text_max_words,
  rubric_version,
  is_current
from private.project_submission_policies
order by project_code;

select
  project_code,
  rubric_version,
  count(*) as criterion_count,
  sum(max_points) as total_points
from private.project_rubric_criteria
group by project_code, rubric_version
order by project_code;

-- Public tables and RLS.
select
  table_name,
  to_regclass('public.' || table_name) is not null as table_exists,
  (
    select relation.relrowsecurity
    from pg_class as relation
    where relation.oid = to_regclass('public.' || table_name)
  ) as rls_enabled
from unnest(array[
  'project_submissions',
  'project_submission_versions',
  'project_submission_files',
  'project_reviews',
  'project_review_criteria',
  'project_status_events'
]) as tables(table_name)
order by table_name;

-- Exactly six own-row SELECT policies.
select
  tablename,
  policyname,
  cmd,
  roles
from pg_policies
where schemaname = 'public'
  and tablename like 'project_%'
order by tablename, policyname;

-- Browser DML remains absent; service role is prepared for future narrow RPCs.
select
  table_name,
  has_table_privilege(
    'anon',
    'public.' || table_name,
    'SELECT'
  ) as anon_select,
  has_table_privilege(
    'authenticated',
    'public.' || table_name,
    'INSERT'
  ) as authenticated_insert,
  has_table_privilege(
    'authenticated',
    'public.' || table_name,
    'UPDATE'
  ) as authenticated_update,
  has_table_privilege(
    'authenticated',
    'public.' || table_name,
    'DELETE'
  ) as authenticated_delete,
  has_table_privilege(
    'service_role',
    'public.' || table_name,
    'SELECT'
  ) as service_role_select
from unnest(array[
  'project_submissions',
  'project_submission_versions',
  'project_submission_files',
  'project_reviews',
  'project_review_criteria',
  'project_status_events'
]) as tables(table_name)
order by table_name;

-- Sensitive identifiers and object locations are not learner-readable.
select
  has_column_privilege(
    'authenticated',
    'public.project_submission_files',
    'object_path',
    'SELECT'
  ) as learner_can_select_object_path,
  has_column_privilege(
    'authenticated',
    'public.project_submission_files',
    'bucket_id',
    'SELECT'
  ) as learner_can_select_bucket_id,
  has_column_privilege(
    'authenticated',
    'public.project_reviews',
    'reviewer_id',
    'SELECT'
  ) as learner_can_select_reviewer_id,
  has_column_privilege(
    'authenticated',
    'public.project_status_events',
    'actor_id',
    'SELECT'
  ) as learner_can_select_actor_id;

-- Trigger inventory.
select
  namespace.nspname as schema_name,
  relation.relname as table_name,
  trigger.tgname as trigger_name,
  trigger.tgenabled as trigger_enabled
from pg_trigger as trigger
join pg_class as relation
  on relation.oid = trigger.tgrelid
join pg_namespace as namespace
  on namespace.oid = relation.relnamespace
where not trigger.tgisinternal
  and (
    (namespace.nspname = 'public' and relation.relname like 'project_%')
    or (
      namespace.nspname = 'private'
      and relation.relname in (
        'project_staff_roles',
        'project_reviewer_assignments'
      )
    )
  )
order by schema_name, table_name, trigger_name;

-- Workflow and Storage remain deliberately inactive.
select
  to_regprocedure('public.create_project_draft(text)') is null
    as create_project_draft_rpc_absent,
  to_regprocedure('public.submit_project(uuid)') is null
    as submit_project_rpc_absent,
  to_regprocedure('public.begin_project_review(uuid)') is null
    as begin_review_rpc_absent,
  to_regprocedure('public.decide_project_review(uuid,text)') is null
    as decide_review_rpc_absent,
  not exists (
    select 1
    from storage.buckets
    where id = 'project-submissions'
  ) as project_storage_bucket_absent;

-- Foundation creates no learner/staff data.
select
  (select count(*) from public.project_submissions)
    as submission_rows,
  (select count(*) from public.project_submission_versions)
    as version_rows,
  (select count(*) from public.project_submission_files)
    as file_rows,
  (select count(*) from public.project_reviews)
    as review_rows,
  (select count(*) from public.project_review_criteria)
    as review_criterion_rows,
  (select count(*) from public.project_status_events)
    as status_event_rows,
  (select count(*) from private.project_staff_roles)
    as staff_rows,
  (select count(*) from private.project_reviewer_assignments)
    as reviewer_assignment_rows;
