-- ARCH.START Phase 07 Pass 1B — hosted verification
-- Run only after the accepted migration completed successfully.

-- Accepted predecessor remains present and exact.
select
  (select count(*) from private.course_modules) as module_count,
  (select count(*) from private.course_lessons) as lesson_count,
  (select count(*) from private.course_projects) as project_count,
  to_regclass('public.lesson_activity') is not null
    as lesson_activity_exists,
  (
    select relrowsecurity
    from pg_class
    where oid = 'public.lesson_activity'::regclass
  ) as lesson_activity_rls_enabled;

-- Completion tables and RLS.
select
  to_regclass('public.lesson_completions') is not null
    as lesson_completions_exists,
  to_regclass('public.module_completions') is not null
    as module_completions_exists,
  (
    select relrowsecurity
    from pg_class
    where oid = 'public.lesson_completions'::regclass
  ) as lesson_completions_rls_enabled,
  (
    select relrowsecurity
    from pg_class
    where oid = 'public.module_completions'::regclass
  ) as module_completions_rls_enabled;

-- Exactly two own-row SELECT policies.
select
  tablename,
  policyname,
  cmd,
  roles
from pg_policies
where schemaname = 'public'
  and tablename in (
    'lesson_completions',
    'module_completions'
  )
order by tablename, policyname;

-- Browser roles: authenticated may read own rows; all writes remain disabled.
select
  has_table_privilege(
    'anon',
    'public.lesson_completions',
    'SELECT'
  ) as anon_lesson_select,
  has_table_privilege(
    'anon',
    'public.module_completions',
    'SELECT'
  ) as anon_module_select,
  has_table_privilege(
    'authenticated',
    'public.lesson_completions',
    'SELECT'
  ) as authenticated_lesson_select,
  has_table_privilege(
    'authenticated',
    'public.module_completions',
    'SELECT'
  ) as authenticated_module_select,
  has_table_privilege(
    'authenticated',
    'public.lesson_completions',
    'INSERT'
  ) as authenticated_lesson_insert,
  has_table_privilege(
    'authenticated',
    'public.lesson_completions',
    'UPDATE'
  ) as authenticated_lesson_update,
  has_table_privilege(
    'authenticated',
    'public.lesson_completions',
    'DELETE'
  ) as authenticated_lesson_delete,
  has_table_privilege(
    'authenticated',
    'public.module_completions',
    'INSERT'
  ) as authenticated_module_insert,
  has_table_privilege(
    'authenticated',
    'public.module_completions',
    'UPDATE'
  ) as authenticated_module_update,
  has_table_privilege(
    'authenticated',
    'public.module_completions',
    'DELETE'
  ) as authenticated_module_delete;

-- No completion column may be inserted or updated directly by authenticated.
select
  table_name,
  column_name,
  has_column_privilege(
    'authenticated',
    'public.' || table_name,
    column_name,
    'INSERT'
  ) as can_insert,
  has_column_privilege(
    'authenticated',
    'public.' || table_name,
    column_name,
    'UPDATE'
  ) as can_update
from information_schema.columns
where table_schema = 'public'
  and table_name in (
    'lesson_completions',
    'module_completions'
  )
order by table_name, ordinal_position;

-- Trigger inventory.
select
  tgrelid::regclass::text as table_name,
  tgname as trigger_name,
  tgenabled as trigger_enabled
from pg_trigger
where not tgisinternal
  and tgrelid in (
    'public.lesson_completions'::regclass,
    'public.module_completions'::regclass
  )
order by table_name, trigger_name;

-- No public completion write RPC is active in this pass.
select
  to_regprocedure('public.complete_lesson(text)') is null
    as complete_lesson_rpc_absent,
  to_regprocedure('public.undo_lesson_completion(text)') is null
    as undo_lesson_rpc_absent,
  to_regprocedure('public.complete_module(text)') is null
    as complete_module_rpc_absent,
  to_regprocedure('public.undo_module_completion(text)') is null
    as undo_module_rpc_absent;

-- Migration creates no learner completion data.
select
  (select count(*) from public.lesson_completions)
    as lesson_completion_rows,
  (select count(*) from public.module_completions)
    as module_completion_rows;
