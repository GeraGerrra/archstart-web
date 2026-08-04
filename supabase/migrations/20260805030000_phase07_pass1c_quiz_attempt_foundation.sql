-- ARCH.START Phase 07 Pass 1C — secure Quiz-attempt database foundation
-- Database-only foundation. Scoring, answer-key loading, browser submission,
-- completion activation, and learner UI integration remain deferred.

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
  lesson_completion_rls boolean;
  module_completion_rls boolean;
begin
  if to_regclass('private.course_modules') is null
    or to_regclass('private.course_lessons') is null
    or to_regclass('private.course_projects') is null
    or to_regclass('public.lesson_activity') is null
    or to_regclass('public.lesson_completions') is null
    or to_regclass('public.module_completions') is null
  then
    raise exception using
      errcode = '55000',
      message = 'Phase 07 Pass 1A and Pass 1B foundations are required';
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

  select relrowsecurity into lesson_completion_rls
  from pg_class
  where oid = 'public.lesson_completions'::regclass;

  select relrowsecurity into module_completion_rls
  from pg_class
  where oid = 'public.module_completions'::regclass;

  if module_count <> 8
    or lesson_count <> 40
    or project_count <> 8
    or activity_rls is not true
    or lesson_completion_rls is not true
    or module_completion_rls is not true
  then
    raise exception using
      errcode = '55000',
      message = 'Accepted Phase 07 hosted predecessor identity is invalid';
  end if;

  if to_regclass('public.quiz_attempts') is not null then
    raise exception using
      errcode = '42P07',
      message = 'Phase 07 Pass 1C quiz_attempts already exists';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Browser-safe answer-shape validation
-- ---------------------------------------------------------------------------

create or replace function private.quiz_answers_shape_is_valid(
  p_answers jsonb
)
returns boolean
language sql
immutable
strict
set search_path = ''
as $$
  select
    pg_catalog.jsonb_typeof(p_answers) = 'object'
    and pg_catalog.jsonb_object_length(p_answers) = 5
    and not exists (
      select 1
      from pg_catalog.jsonb_each(p_answers) as entry(question_id, option_value)
      where question_id !~ '^[A-Za-z0-9._:-]{1,128}$'
        or pg_catalog.jsonb_typeof(option_value) <> 'string'
        or pg_catalog.length(option_value #>> '{}') < 1
        or pg_catalog.length(option_value #>> '{}') > 128
    );
$$;

revoke all on function private.quiz_answers_shape_is_valid(jsonb)
from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Immutable learner-owned Quiz attempts
-- ---------------------------------------------------------------------------

create table public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid()
    references auth.users(id)
    on delete cascade,
  lesson_code text not null
    references private.course_lessons(lesson_code)
    on update cascade
    on delete restrict,
  selected_answers jsonb not null,
  score smallint not null,
  question_count smallint not null default 5,
  answer_key_sha256 text not null,
  submitted_at timestamptz not null default now(),
  constraint quiz_attempts_question_count
    check (question_count = 5),
  constraint quiz_attempts_score_range
    check (score between 0 and question_count),
  constraint quiz_attempts_answer_key_sha256
    check (answer_key_sha256 ~ '^[0-9a-f]{64}$'),
  constraint quiz_attempts_answers_shape
    check (private.quiz_answers_shape_is_valid(selected_answers))
);

create index quiz_attempts_user_lesson_recent_idx
on public.quiz_attempts (
  user_id,
  lesson_code,
  submitted_at desc
);

create index quiz_attempts_user_recent_idx
on public.quiz_attempts (
  user_id,
  submitted_at desc
);

create or replace function private.stamp_quiz_attempt()
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
      message = 'quiz attempt user_id is required';
  end if;

  new.id := coalesce(new.id, gen_random_uuid());
  new.submitted_at := now();

  return new;
end;
$$;

revoke all on function private.stamp_quiz_attempt()
from public, anon, authenticated;

create or replace function private.reject_quiz_attempt_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception using
    errcode = '55000',
    message = 'quiz attempts are immutable';
end;
$$;

revoke all on function private.reject_quiz_attempt_update()
from public, anon, authenticated;

create trigger on_quiz_attempt_stamp
before insert on public.quiz_attempts
for each row execute function private.stamp_quiz_attempt();

create trigger on_quiz_attempt_reject_update
before update on public.quiz_attempts
for each row execute function private.reject_quiz_attempt_update();

-- ---------------------------------------------------------------------------
-- Own-row read RLS; browser writes remain disabled
-- ---------------------------------------------------------------------------

alter table public.quiz_attempts enable row level security;

revoke all on table public.quiz_attempts
from anon, authenticated;

grant select on table public.quiz_attempts
to authenticated;

create policy "quiz_attempts_select_own"
on public.quiz_attempts
for select
to authenticated
using ((select auth.uid()) = user_id);

comment on table public.quiz_attempts is
  'Phase 07 immutable learner Quiz attempts. Browser submission and scoring are not active in Pass 1C.';

comment on column public.quiz_attempts.selected_answers is
  'Five learner-selected question/option identifiers; contains no correct-answer data.';

comment on column public.quiz_attempts.score is
  'Aggregate server-owned score. Pass 1C creates storage only; no browser scorer exists.';

commit;
