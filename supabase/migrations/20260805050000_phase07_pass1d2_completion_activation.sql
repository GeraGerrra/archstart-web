-- ARCH.START Phase 07 Pass 1D2 — persistent lesson/module completion activation
-- Any valid persisted Quiz attempt unlocks its lesson. No score threshold is
-- introduced. Module completion still requires five lesson completions.

begin;

-- ---------------------------------------------------------------------------
-- Accepted predecessor preflight
-- ---------------------------------------------------------------------------

do $$
declare
  lesson_completion_rls boolean;
  module_completion_rls boolean;
begin
  if to_regclass('public.quiz_attempts') is null
    or to_regclass('public.lesson_completions') is null
    or to_regclass('public.module_completions') is null
    or to_regprocedure('private.stamp_lesson_completion()') is null
    or to_regprocedure('private.stamp_and_validate_module_completion()') is null
    or to_regprocedure('private.reject_completion_update()') is null
    or to_regprocedure('private.invalidate_module_completion_after_lesson_delete()') is null
  then
    raise exception using
      errcode = '55000',
      message = 'Phase 07 Pass 1B, Pass 1C, and Pass 1D1.1 are required';
  end if;

  select relrowsecurity into lesson_completion_rls
  from pg_class
  where oid = 'public.lesson_completions'::regclass;

  select relrowsecurity into module_completion_rls
  from pg_class
  where oid = 'public.module_completions'::regclass;

  if lesson_completion_rls is not true
    or module_completion_rls is not true
    or not has_schema_privilege('service_role', 'private', 'USAGE')
    or not has_table_privilege('service_role', 'public.quiz_attempts', 'SELECT')
  then
    raise exception using
      errcode = '55000',
      message = 'Accepted hosted completion/Quiz security identity is invalid';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Lesson completion prerequisite: at least one persisted Quiz attempt
-- ---------------------------------------------------------------------------

create or replace function private.stamp_lesson_completion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  quiz_attempt_exists boolean;
begin
  if current_user_id is not null then
    new.user_id := current_user_id;
  elsif new.user_id is null then
    raise exception using
      errcode = '23502',
      message = 'lesson completion user_id is required';
  end if;

  select exists (
    select 1
    from public.quiz_attempts as attempt
    where attempt.user_id = new.user_id
      and attempt.lesson_code = new.lesson_code
  )
  into quiz_attempt_exists;

  if quiz_attempt_exists is not true then
    raise exception using
      errcode = '23514',
      message = 'lesson completion requires a persisted Quiz attempt';
  end if;

  new.completed_at := now();
  return new;
end;
$$;

revoke all on function private.stamp_lesson_completion()
from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Narrow server-only write activation
-- ---------------------------------------------------------------------------

grant usage
on schema private
to service_role;

grant execute on function
  private.stamp_lesson_completion(),
  private.stamp_and_validate_module_completion(),
  private.reject_completion_update(),
  private.invalidate_module_completion_after_lesson_delete()
to service_role;

grant select, insert, delete on table
  public.lesson_completions,
  public.module_completions
to service_role;

revoke insert, update, delete on table
  public.lesson_completions,
  public.module_completions
from anon, authenticated;

grant select on table
  public.lesson_completions,
  public.module_completions
to authenticated;

comment on table public.lesson_completions is
  'Learner lesson completions activated server-side after any valid persisted Quiz attempt.';

comment on table public.module_completions is
  'Learner module completions activated server-side after all five lesson completions.';

-- ---------------------------------------------------------------------------
-- Postcondition checks
-- ---------------------------------------------------------------------------

do $$
begin
  if not has_table_privilege(
    'service_role',
    'public.lesson_completions',
    'SELECT'
  )
    or not has_table_privilege(
      'service_role',
      'public.lesson_completions',
      'INSERT'
    )
    or not has_table_privilege(
      'service_role',
      'public.lesson_completions',
      'DELETE'
    )
    or not has_table_privilege(
      'service_role',
      'public.module_completions',
      'SELECT'
    )
    or not has_table_privilege(
      'service_role',
      'public.module_completions',
      'INSERT'
    )
    or not has_table_privilege(
      'service_role',
      'public.module_completions',
      'DELETE'
    )
    or has_table_privilege(
      'authenticated',
      'public.lesson_completions',
      'INSERT'
    )
    or has_table_privilege(
      'authenticated',
      'public.module_completions',
      'DELETE'
    )
  then
    raise exception using
      errcode = '42501',
      message = 'Phase 07 Pass 1D2 completion privilege activation failed';
  end if;
end;
$$;

commit;
