-- ARCH.START Phase 07 Pass 1A — hosted verification
-- Run only after the migration completed successfully.

-- 1. Existing Phase 06 profile authority remains present.
select
  to_regclass('public.profiles') is not null as profiles_exists,
  (
    select relrowsecurity
    from pg_class
    where oid = 'public.profiles'::regclass
  ) as profiles_rls_enabled;

-- 2. Hidden catalog identity.
select
  (select count(*) from private.course_modules) as module_count,
  (select count(*) from private.course_lessons) as lesson_count,
  (select count(*) from private.course_projects) as project_count;

select
  min(module_code) as first_module,
  max(module_code) as last_module,
  min(lesson_code) as first_lesson,
  max(lesson_code) as last_lesson
from private.course_lessons;

-- 3. Private schema is not directly available to browser roles.
select
  has_schema_privilege('anon', 'private', 'USAGE')
    as anon_private_schema_usage,
  has_schema_privilege('authenticated', 'private', 'USAGE')
    as authenticated_private_schema_usage;

-- 4. Activity table and RLS.
select
  to_regclass('public.lesson_activity') is not null
    as lesson_activity_exists,
  (
    select relrowsecurity
    from pg_class
    where oid = 'public.lesson_activity'::regclass
  ) as lesson_activity_rls_enabled;

select
  policyname,
  cmd,
  roles
from pg_policies
where schemaname = 'public'
  and tablename = 'lesson_activity'
order by policyname;

-- 5. Grants. Table-wide INSERT/UPDATE must remain false because writes are
-- column-limited. SELECT is allowed only to authenticated.
select
  has_table_privilege('anon', 'public.lesson_activity', 'SELECT')
    as anon_select,
  has_table_privilege('authenticated', 'public.lesson_activity', 'SELECT')
    as authenticated_select,
  has_table_privilege('authenticated', 'public.lesson_activity', 'INSERT')
    as authenticated_table_wide_insert,
  has_table_privilege('authenticated', 'public.lesson_activity', 'UPDATE')
    as authenticated_table_wide_update,
  has_table_privilege('authenticated', 'public.lesson_activity', 'DELETE')
    as authenticated_delete;

select
  column_name,
  has_column_privilege(
    'authenticated',
    'public.lesson_activity',
    column_name,
    'INSERT'
  ) as can_insert,
  has_column_privilege(
    'authenticated',
    'public.lesson_activity',
    column_name,
    'UPDATE'
  ) as can_update
from information_schema.columns
where table_schema = 'public'
  and table_name = 'lesson_activity'
order by ordinal_position;

-- 6. RPC and trigger.
select
  has_function_privilege(
    'anon',
    'public.record_lesson_activity(text,text)',
    'EXECUTE'
  ) as anon_can_execute,
  has_function_privilege(
    'authenticated',
    'public.record_lesson_activity(text,text)',
    'EXECUTE'
  ) as authenticated_can_execute;

select
  tgname as trigger_name,
  tgenabled as trigger_enabled
from pg_trigger
where tgrelid = 'public.lesson_activity'::regclass
  and not tgisinternal;

-- 7. Foundation must not create learner data by itself.
select count(*) as lesson_activity_rows
from public.lesson_activity;
