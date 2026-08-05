-- ARCH.START Phase 07 Pass 1D1.1 — hosted verification
-- Run after the repair migration succeeds.

select
  to_regrole('service_role') is not null
    as service_role_exists,

  (
    select rolbypassrls
    from pg_roles
    where rolname = 'service_role'
  ) as service_role_bypasses_rls,

  has_table_privilege(
    'service_role',
    'public.quiz_attempts',
    'INSERT'
  ) as service_role_can_insert_attempt,

  has_table_privilege(
    'service_role',
    'public.quiz_attempts',
    'SELECT'
  ) as service_role_can_select_attempt,

  has_function_privilege(
    'service_role',
    'private.quiz_answers_shape_is_valid(jsonb)',
    'EXECUTE'
  ) as service_role_can_execute_answer_validator,

  has_schema_privilege(
    'service_role',
    'private',
    'USAGE'
  ) as service_role_has_private_schema_usage;

-- Browser-write and RLS boundaries must remain unchanged.
select
  has_table_privilege(
    'anon',
    'public.quiz_attempts',
    'INSERT'
  ) as anon_can_insert_attempt,

  has_table_privilege(
    'authenticated',
    'public.quiz_attempts',
    'INSERT'
  ) as authenticated_can_insert_attempt,

  (
    select relrowsecurity
    from pg_class
    where oid = 'public.quiz_attempts'::regclass
  ) as quiz_attempts_rls_enabled;

-- Repair must not create learner data.
select
  (select count(*) from public.quiz_attempts)
    as quiz_attempt_rows_after_repair,

  (select count(*) from public.lesson_completions)
    as lesson_completion_rows_after_repair,

  (select count(*) from public.module_completions)
    as module_completion_rows_after_repair;
