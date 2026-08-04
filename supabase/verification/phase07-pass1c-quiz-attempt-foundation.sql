-- ARCH.START Phase 07 Pass 1C — hosted verification
-- Run only after the accepted migration completed successfully.

-- Accepted predecessors remain present and exact.
select
  (select count(*) from private.course_modules) as module_count,
  (select count(*) from private.course_lessons) as lesson_count,
  (select count(*) from private.course_projects) as project_count,
  to_regclass('public.lesson_activity') is not null
    as lesson_activity_exists,
  to_regclass('public.lesson_completions') is not null
    as lesson_completions_exists,
  to_regclass('public.module_completions') is not null
    as module_completions_exists;

-- Quiz-attempt table and RLS.
select
  to_regclass('public.quiz_attempts') is not null
    as quiz_attempts_exists,
  (
    select relrowsecurity
    from pg_class
    where oid = 'public.quiz_attempts'::regclass
  ) as quiz_attempts_rls_enabled;

-- Exactly one own-row SELECT policy.
select
  policyname,
  cmd,
  roles
from pg_policies
where schemaname = 'public'
  and tablename = 'quiz_attempts'
order by policyname;

-- Browser roles: authenticated may read own rows; all writes remain disabled.
select
  has_table_privilege(
    'anon',
    'public.quiz_attempts',
    'SELECT'
  ) as anon_select,
  has_table_privilege(
    'authenticated',
    'public.quiz_attempts',
    'SELECT'
  ) as authenticated_select,
  has_table_privilege(
    'authenticated',
    'public.quiz_attempts',
    'INSERT'
  ) as authenticated_insert,
  has_table_privilege(
    'authenticated',
    'public.quiz_attempts',
    'UPDATE'
  ) as authenticated_update,
  has_table_privilege(
    'authenticated',
    'public.quiz_attempts',
    'DELETE'
  ) as authenticated_delete;

-- No Quiz-attempt column is directly writable by authenticated.
select
  column_name,
  has_column_privilege(
    'authenticated',
    'public.quiz_attempts',
    column_name,
    'INSERT'
  ) as can_insert,
  has_column_privilege(
    'authenticated',
    'public.quiz_attempts',
    column_name,
    'UPDATE'
  ) as can_update
from information_schema.columns
where table_schema = 'public'
  and table_name = 'quiz_attempts'
order by ordinal_position;

-- Trigger inventory.
select
  tgname as trigger_name,
  tgenabled as trigger_enabled
from pg_trigger
where not tgisinternal
  and tgrelid = 'public.quiz_attempts'::regclass
order by trigger_name;

-- No browser submission/scoring/completion activation RPC is present.
select
  to_regprocedure('public.submit_quiz_attempt(text,jsonb)') is null
    as submit_quiz_attempt_rpc_absent,
  to_regprocedure('public.complete_lesson(text)') is null
    as complete_lesson_rpc_absent,
  to_regprocedure('public.undo_lesson_completion(text)') is null
    as undo_lesson_rpc_absent,
  to_regprocedure('public.complete_module(text)') is null
    as complete_module_rpc_absent,
  to_regprocedure('public.undo_module_completion(text)') is null
    as undo_module_rpc_absent;

-- No correct-answer or explanation columns exist in the public table.
select
  count(*)::integer as forbidden_quiz_attempt_columns
from information_schema.columns
where table_schema = 'public'
  and table_name = 'quiz_attempts'
  and column_name in (
    'correct_option_id',
    'correct_answer',
    'canonical_explanation',
    'answer_key'
  );

-- Expected constraints and indexes are present.
select
  conname as constraint_name,
  pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = 'public.quiz_attempts'::regclass
order by conname;

select
  indexname,
  indexdef
from pg_indexes
where schemaname = 'public'
  and tablename = 'quiz_attempts'
order by indexname;

-- Migration creates no learner attempt data.
select count(*) as quiz_attempt_rows
from public.quiz_attempts;
