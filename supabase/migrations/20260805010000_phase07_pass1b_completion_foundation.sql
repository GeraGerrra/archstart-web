-- ARCH.START Phase 07 Pass 1B — lesson/module completion foundation
-- Database-only foundation. Browser write activation remains deferred until
-- secure Quiz-attempt persistence can enforce the lesson-ready prerequisite.

begin;

-- ---------------------------------------------------------------------------
-- Accepted predecessor preflight
-- ---------------------------------------------------------------------------

do $$
declare
  module_count integer;
  lesson_count integer;
  project_count integer;
  activity_rls boolean;
begin
  if to_regclass('private.course_modules') is null
    or to_regclass('private.course_lessons') is null
    or to_regclass('private.course_projects') is null
    or to_regclass('public.lesson_activity') is null
  then
    raise exception using
      errcode = '55000',
      message = 'Phase 07 Pass 1A foundation is required';
  end if;

  select count(*) into module_count
  from private.course_modules;

  select count(*) into lesson_count
  from private.course_lessons;

  select count(*) into project_count
  from private.course_projects;

  select relrowsecurity into activity_rls
  from pg_class
  where oid = 'public.lesson_activity'::regclass;

  if module_count <> 8
    or lesson_count <> 40
    or project_count <> 8
    or activity_rls is not true
  then
    raise exception using
      errcode = '55000',
      message = 'Phase 07 Pass 1A hosted identity is invalid';
  end if;

  if to_regclass('public.lesson_completions') is not null
    or to_regclass('public.module_completions') is not null
  then
    raise exception using
      errcode = '42P07',
      message = 'Phase 07 Pass 1B completion tables already exist';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Immutable learner-owned completion rows
-- ---------------------------------------------------------------------------

create table public.lesson_completions (
  user_id uuid not null default auth.uid()
    references auth.users(id)
    on delete cascade,
  lesson_code text not null
    references private.course_lessons(lesson_code)
    on update cascade
    on delete restrict,
  completed_at timestamptz not null default now(),
  primary key (user_id, lesson_code)
);

create table public.module_completions (
  user_id uuid not null default auth.uid()
    references auth.users(id)
    on delete cascade,
  module_code text not null
    references private.course_modules(module_code)
    on update cascade
    on delete restrict,
  completed_at timestamptz not null default now(),
  primary key (user_id, module_code)
);

create index lesson_completions_recent_idx
on public.lesson_completions (
  user_id,
  completed_at desc
);

create index module_completions_recent_idx
on public.module_completions (
  user_id,
  completed_at desc
);

-- ---------------------------------------------------------------------------
-- Database-owned identity, timestamps, invariants, and invalidation
-- ---------------------------------------------------------------------------

create or replace function private.stamp_lesson_completion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
begin
  if current_user_id is not null then
    new.user_id := current_user_id;
  elsif new.user_id is null then
    raise exception using
      errcode = '23502',
      message = 'lesson completion user_id is required';
  end if;

  new.completed_at := now();
  return new;
end;
$$;

revoke all on function private.stamp_lesson_completion()
from public, anon, authenticated;

create or replace function private.stamp_and_validate_module_completion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  required_lesson_count integer;
  completed_lesson_count integer;
begin
  if current_user_id is not null then
    new.user_id := current_user_id;
  elsif new.user_id is null then
    raise exception using
      errcode = '23502',
      message = 'module completion user_id is required';
  end if;

  select count(*)
  into required_lesson_count
  from private.course_lessons
  where module_code = new.module_code;

  select count(*)
  into completed_lesson_count
  from public.lesson_completions as completion
  join private.course_lessons as lesson
    on lesson.lesson_code = completion.lesson_code
  where completion.user_id = new.user_id
    and lesson.module_code = new.module_code;

  if required_lesson_count <> 5
    or completed_lesson_count <> required_lesson_count
  then
    raise exception using
      errcode = '23514',
      message = 'module completion requires all five lesson completions';
  end if;

  new.completed_at := now();
  return new;
end;
$$;

revoke all on function private.stamp_and_validate_module_completion()
from public, anon, authenticated;

create or replace function private.reject_completion_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception using
    errcode = '55000',
    message = 'completion rows are immutable';
end;
$$;

revoke all on function private.reject_completion_update()
from public, anon, authenticated;

create or replace function private.invalidate_module_completion_after_lesson_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  deleted_module_code text;
begin
  select module_code
  into deleted_module_code
  from private.course_lessons
  where lesson_code = old.lesson_code;

  delete from public.module_completions
  where user_id = old.user_id
    and module_code = deleted_module_code;

  return old;
end;
$$;

revoke all on function private.invalidate_module_completion_after_lesson_delete()
from public, anon, authenticated;

create trigger on_lesson_completion_stamp
before insert on public.lesson_completions
for each row execute function private.stamp_lesson_completion();

create trigger on_lesson_completion_reject_update
before update on public.lesson_completions
for each row execute function private.reject_completion_update();

create trigger on_lesson_completion_invalidate_module
after delete on public.lesson_completions
for each row
execute function private.invalidate_module_completion_after_lesson_delete();

create trigger on_module_completion_stamp_and_validate
before insert on public.module_completions
for each row
execute function private.stamp_and_validate_module_completion();

create trigger on_module_completion_reject_update
before update on public.module_completions
for each row execute function private.reject_completion_update();

-- ---------------------------------------------------------------------------
-- RLS and read-only browser foundation
-- ---------------------------------------------------------------------------

alter table public.lesson_completions enable row level security;
alter table public.module_completions enable row level security;

revoke all on table
  public.lesson_completions,
  public.module_completions
from anon, authenticated;

grant select on table
  public.lesson_completions,
  public.module_completions
to authenticated;

create policy "lesson_completions_select_own"
on public.lesson_completions
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "module_completions_select_own"
on public.module_completions
for select
to authenticated
using ((select auth.uid()) = user_id);

comment on table public.lesson_completions is
  'Phase 07 immutable learner lesson completions. Browser writes are not active in Pass 1B.';

comment on table public.module_completions is
  'Phase 07 immutable learner module completions, valid only after five lesson completions.';

commit;
