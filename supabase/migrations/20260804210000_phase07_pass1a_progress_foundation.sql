-- ARCH.START Phase 07 Pass 1A — progress database foundation
-- Scope: hidden course catalogs + own-row lesson activity only.
-- No completion, quiz-attempt, project-submission, reviewer, or certificate tables.

begin;

-- Phase 06 already created private; retain it as a non-exposed schema.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Hidden immutable course catalogs
-- ---------------------------------------------------------------------------

create table if not exists private.course_modules (
  module_code text primary key,
  module_number smallint not null unique,
  lesson_count smallint not null default 5,
  created_at timestamptz not null default now(),
  constraint course_modules_code_format
    check (module_code ~ '^M0[1-8]$'),
  constraint course_modules_number_range
    check (module_number between 1 and 8),
  constraint course_modules_lesson_count
    check (lesson_count = 5)
);

create table if not exists private.course_lessons (
  lesson_code text primary key,
  module_code text not null
    references private.course_modules(module_code)
    on update cascade
    on delete restrict,
  lesson_number smallint not null,
  created_at timestamptz not null default now(),
  constraint course_lessons_code_format
    check (lesson_code ~ '^M0[1-8]_L0[1-5]$'),
  constraint course_lessons_number_range
    check (lesson_number between 1 and 5),
  constraint course_lessons_module_number_unique
    unique (module_code, lesson_number)
);

create table if not exists private.course_projects (
  project_code text primary key,
  module_code text not null unique
    references private.course_modules(module_code)
    on update cascade
    on delete restrict,
  project_number smallint not null unique,
  created_at timestamptz not null default now(),
  constraint course_projects_code_format
    check (project_code ~ '^M0[1-8]_P0[1-8]$'),
  constraint course_projects_number_range
    check (project_number between 1 and 8)
);

insert into private.course_modules (
  module_code,
  module_number,
  lesson_count
)
select
  'M' || lpad(module_number::text, 2, '0'),
  module_number,
  5
from generate_series(1, 8) as module_number
on conflict (module_code) do update
set
  module_number = excluded.module_number,
  lesson_count = excluded.lesson_count;

insert into private.course_lessons (
  lesson_code,
  module_code,
  lesson_number
)
select
  'M' || lpad(module_number::text, 2, '0') ||
    '_L' || lpad(lesson_number::text, 2, '0'),
  'M' || lpad(module_number::text, 2, '0'),
  lesson_number
from generate_series(1, 8) as module_number
cross join generate_series(1, 5) as lesson_number
on conflict (lesson_code) do update
set
  module_code = excluded.module_code,
  lesson_number = excluded.lesson_number;

insert into private.course_projects (
  project_code,
  module_code,
  project_number
)
select
  'M' || lpad(project_number::text, 2, '0') ||
    '_P' || lpad(project_number::text, 2, '0'),
  'M' || lpad(project_number::text, 2, '0'),
  project_number
from generate_series(1, 8) as project_number
on conflict (project_code) do update
set
  module_code = excluded.module_code,
  project_number = excluded.project_number;

revoke all on all tables in schema private
from public, anon, authenticated;
revoke all on all sequences in schema private
from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Own-row lesson activity
-- ---------------------------------------------------------------------------

create table if not exists public.lesson_activity (
  user_id uuid not null default auth.uid()
    references auth.users(id)
    on delete cascade,
  lesson_code text not null
    references private.course_lessons(lesson_code)
    on update cascade
    on delete restrict,
  last_item text not null,
  started_at timestamptz not null default now(),
  last_visited_at timestamptz not null default now(),
  primary key (user_id, lesson_code),
  constraint lesson_activity_item
    check (
      last_item in (
        'overview',
        'vocabulary',
        'video',
        'lecture-materials',
        'practice',
        'quiz'
      )
    )
);

create index if not exists lesson_activity_resume_idx
on public.lesson_activity (user_id, last_visited_at desc);

alter table public.lesson_activity enable row level security;

revoke all on table public.lesson_activity from anon, authenticated;
grant select on table public.lesson_activity to authenticated;
grant insert (lesson_code, last_item)
  on table public.lesson_activity
  to authenticated;
grant update (last_item)
  on table public.lesson_activity
  to authenticated;

-- The trigger owns identity and timestamps. Direct browser writes cannot
-- choose another user, rewrite catalog identity, or forge activity times.
create or replace function private.stamp_lesson_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'authenticated user required';
  end if;

  if tg_op = 'INSERT' then
    new.user_id := current_user_id;
    new.started_at := now();
  else
    if old.user_id <> current_user_id then
      raise exception using
        errcode = '42501',
        message = 'lesson activity owner mismatch';
    end if;

    new.user_id := old.user_id;
    new.lesson_code := old.lesson_code;
    new.started_at := old.started_at;
  end if;

  new.last_visited_at := now();
  return new;
end;
$$;

revoke all on function private.stamp_lesson_activity() from public;

-- Recreate so a retry cannot leave a duplicate or stale trigger binding.
drop trigger if exists on_lesson_activity_stamp
on public.lesson_activity;

create trigger on_lesson_activity_stamp
before insert or update on public.lesson_activity
for each row execute function private.stamp_lesson_activity();

drop policy if exists "lesson_activity_select_own"
on public.lesson_activity;
create policy "lesson_activity_select_own"
on public.lesson_activity
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "lesson_activity_insert_own"
on public.lesson_activity;
create policy "lesson_activity_insert_own"
on public.lesson_activity
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "lesson_activity_update_own"
on public.lesson_activity;
create policy "lesson_activity_update_own"
on public.lesson_activity
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

-- A narrow RPC gives the browser one deterministic insert-or-update action.
-- It is SECURITY INVOKER and therefore remains subject to grants and RLS.
create or replace function public.record_lesson_activity(
  p_lesson_code text,
  p_last_item text
)
returns table (
  user_id uuid,
  lesson_code text,
  last_item text,
  started_at timestamptz,
  last_visited_at timestamptz
)
language sql
security invoker
set search_path = ''
as $$
  insert into public.lesson_activity (
    lesson_code,
    last_item
  )
  values (
    p_lesson_code,
    p_last_item
  )
  on conflict on constraint lesson_activity_pkey
  do update set
    last_item = excluded.last_item
  returning
    lesson_activity.user_id,
    lesson_activity.lesson_code,
    lesson_activity.last_item,
    lesson_activity.started_at,
    lesson_activity.last_visited_at;
$$;

revoke all on function public.record_lesson_activity(text, text)
from public, anon, authenticated;
grant execute on function public.record_lesson_activity(text, text)
to authenticated;

commit;
