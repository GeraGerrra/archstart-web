-- ARCH.START Phase 07 Pass 1D2 — hosted verification
-- Run only after the accepted migration succeeds.

select
  to_regclass('public.quiz_attempts') is not null
    as quiz_attempts_exists,
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

select
  has_table_privilege(
    'service_role',
    'public.lesson_completions',
    'SELECT'
  ) as service_role_lesson_select,
  has_table_privilege(
    'service_role',
    'public.lesson_completions',
    'INSERT'
  ) as service_role_lesson_insert,
  has_table_privilege(
    'service_role',
    'public.lesson_completions',
    'DELETE'
  ) as service_role_lesson_delete,
  has_table_privilege(
    'service_role',
    'public.module_completions',
    'SELECT'
  ) as service_role_module_select,
  has_table_privilege(
    'service_role',
    'public.module_completions',
    'INSERT'
  ) as service_role_module_insert,
  has_table_privilege(
    'service_role',
    'public.module_completions',
    'DELETE'
  ) as service_role_module_delete;

select
  has_table_privilege(
    'anon',
    'public.lesson_completions',
    'INSERT'
  ) as anon_lesson_insert,
  has_table_privilege(
    'authenticated',
    'public.lesson_completions',
    'INSERT'
  ) as authenticated_lesson_insert,
  has_table_privilege(
    'authenticated',
    'public.lesson_completions',
    'DELETE'
  ) as authenticated_lesson_delete,
  has_table_privilege(
    'anon',
    'public.module_completions',
    'INSERT'
  ) as anon_module_insert,
  has_table_privilege(
    'authenticated',
    'public.module_completions',
    'INSERT'
  ) as authenticated_module_insert,
  has_table_privilege(
    'authenticated',
    'public.module_completions',
    'DELETE'
  ) as authenticated_module_delete;

select
  position(
    'public.quiz_attempts'
    in pg_get_functiondef(
      'private.stamp_lesson_completion()'::regprocedure
    )
  ) > 0 as lesson_prerequisite_reads_quiz_attempts,
  position(
    'attempt.score'
    in pg_get_functiondef(
      'private.stamp_lesson_completion()'::regprocedure
    )
  ) = 0 as no_minimum_score_threshold,
  has_function_privilege(
    'service_role',
    'private.stamp_lesson_completion()',
    'EXECUTE'
  ) as service_role_can_execute_lesson_stamp,
  has_function_privilege(
    'service_role',
    'private.stamp_and_validate_module_completion()',
    'EXECUTE'
  ) as service_role_can_execute_module_validator;

select
  to_regprocedure('public.complete_lesson(text)') is null
    as public_complete_lesson_rpc_absent,
  to_regprocedure('public.undo_lesson_completion(text)') is null
    as public_undo_lesson_rpc_absent,
  to_regprocedure('public.complete_module(text)') is null
    as public_complete_module_rpc_absent,
  to_regprocedure('public.undo_module_completion(text)') is null
    as public_undo_module_rpc_absent;

select
  (select count(*) from public.quiz_attempts)
    as quiz_attempt_rows,
  (select count(*) from public.lesson_completions)
    as lesson_completion_rows,
  (select count(*) from public.module_completions)
    as module_completion_rows;
