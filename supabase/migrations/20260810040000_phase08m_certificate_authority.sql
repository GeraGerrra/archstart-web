-- ARCH.START Phase 08M.1 — Certificate database authority
-- One learner-owned certificate, exact server-side eligibility, idempotent
-- issuance, minimal public verification, and service-role-only revocation.

begin;

-- ---------------------------------------------------------------------------
-- Accepted predecessor and zero-certificate preflight
-- ---------------------------------------------------------------------------

do $preflight$
declare
  module_count integer;
  lesson_count integer;
  project_count integer;
  current_policy_count integer;
  rubric_count integer;
begin
  if to_regclass('public.profiles') is null
    or to_regclass('public.lesson_completions') is null
    or to_regclass('public.project_submissions') is null
    or to_regclass('private.course_modules') is null
    or to_regclass('private.course_lessons') is null
    or to_regclass('private.course_projects') is null
    or to_regclass('private.project_submission_policies') is null
    or to_regclass('private.project_rubric_criteria') is null
  then
    raise exception using
      errcode = '55000',
      message = 'closed Phase 07 certificate prerequisites are required';
  end if;

  select count(*) into module_count from private.course_modules;
  select count(*) into lesson_count from private.course_lessons;
  select count(*) into project_count from private.course_projects;
  select count(*) into current_policy_count
  from private.project_submission_policies
  where is_current;
  select count(*) into rubric_count from private.project_rubric_criteria;

  if module_count <> 8
    or lesson_count <> 40
    or project_count <> 8
    or current_policy_count <> 8
    or rubric_count <> 40
  then
    raise exception using
      errcode = '55000',
      message = 'closed Phase 07 catalog or project authority is invalid';
  end if;

  if to_regclass('public.course_certificates') is not null
    or to_regprocedure('public.get_my_course_certificate_eligibility()') is not null
    or to_regprocedure('public.issue_my_course_certificate()') is not null
    or to_regprocedure('public.verify_course_certificate(text)') is not null
    or to_regprocedure('public.revoke_course_certificate(text,text)') is not null
    or to_regprocedure('private.course_certificate_eligibility_for_user(uuid)') is not null
  then
    raise exception using
      errcode = '42P07',
      message = 'Phase 08M certificate authority already exists';
  end if;
end;
$preflight$;

-- ---------------------------------------------------------------------------
-- One lifetime certificate row per learner
-- ---------------------------------------------------------------------------

create table public.course_certificates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique
    references auth.users(id)
    on delete restrict,
  certificate_code text not null unique
    default (
      'as-' || pg_catalog.replace(gen_random_uuid()::text, '-', '')
    ),
  display_name_snapshot text not null,
  course_code text not null default 'ARCHSTART_CORE',
  course_version text not null default '2026.08',
  course_title_snapshot text not null
    default 'ARCH.START — русскоязычный вводный курс архитектуры',
  issued_at timestamptz not null default now(),
  revoked_at timestamptz,
  revocation_reason text,
  created_at timestamptz not null default now(),
  constraint course_certificates_code_format
    check (certificate_code ~ '^as-[0-9a-f]{32}$'),
  constraint course_certificates_display_name
    check (
      char_length(display_name_snapshot) between 3 and 161
      and display_name_snapshot = pg_catalog.regexp_replace(
        pg_catalog.btrim(display_name_snapshot),
        '[[:space:]]+',
        ' ',
        'g'
      )
    ),
  constraint course_certificates_course_identity
    check (
      course_code = 'ARCHSTART_CORE'
      and course_version = '2026.08'
      and course_title_snapshot =
        'ARCH.START — русскоязычный вводный курс архитектуры'
    ),
  constraint course_certificates_revocation_state
    check (
      (
        revoked_at is null
        and revocation_reason is null
      )
      or (
        revoked_at is not null
        and revocation_reason is not null
        and char_length(revocation_reason) between 10 and 500
        and revocation_reason = pg_catalog.btrim(revocation_reason)
      )
    )
);

create index course_certificates_issued_at_idx
on public.course_certificates (issued_at desc, id);

alter table public.course_certificates enable row level security;

revoke all on table public.course_certificates
from public, anon, authenticated, service_role;

grant select (
  id,
  certificate_code,
  display_name_snapshot,
  course_code,
  course_version,
  course_title_snapshot,
  issued_at,
  revoked_at,
  created_at
)
on public.course_certificates
to authenticated;

drop policy if exists "course_certificates_select_own"
on public.course_certificates;

create policy "course_certificates_select_own"
on public.course_certificates
for select
to authenticated
using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- Private exact eligibility projection shared by read and issue RPCs
-- ---------------------------------------------------------------------------

create or replace function private.course_certificate_eligibility_for_user(
  p_user_id uuid
)
returns table (
  completed_lessons integer,
  required_lessons integer,
  accepted_projects integer,
  required_projects integer,
  profile_name_ready boolean,
  display_name text
)
language sql
stable
security definer
set search_path = ''
as $function$
  with normalized_profile as (
    select
      nullif(
        pg_catalog.regexp_replace(
          pg_catalog.btrim(coalesce(profile.first_name, '')),
          '[[:space:]]+',
          ' ',
          'g'
        ),
        ''
      ) as first_name,
      nullif(
        pg_catalog.regexp_replace(
          pg_catalog.btrim(coalesce(profile.last_name, '')),
          '[[:space:]]+',
          ' ',
          'g'
        ),
        ''
      ) as last_name
    from public.profiles as profile
    where profile.user_id = p_user_id
  )
  select
    (
      select count(*)::integer
      from private.course_lessons as lesson
      join public.lesson_completions as completion
        on completion.lesson_code = lesson.lesson_code
       and completion.user_id = p_user_id
    ) as completed_lessons,
    (
      select count(*)::integer
      from private.course_lessons
    ) as required_lessons,
    (
      select count(*)::integer
      from private.course_projects as project
      join public.project_submissions as submission
        on submission.project_code = project.project_code
       and submission.user_id = p_user_id
       and submission.current_status = 'accepted'
    ) as accepted_projects,
    (
      select count(*)::integer
      from private.course_projects
    ) as required_projects,
    coalesce(
      (
        select
          profile.first_name is not null
          and profile.last_name is not null
        from normalized_profile as profile
      ),
      false
    ) as profile_name_ready,
    (
      select profile.first_name || ' ' || profile.last_name
      from normalized_profile as profile
      where profile.first_name is not null
        and profile.last_name is not null
    ) as display_name;
$function$;

revoke all on function
  private.course_certificate_eligibility_for_user(uuid)
from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Authenticated parameter-free eligibility projection
-- ---------------------------------------------------------------------------

create or replace function public.get_my_course_certificate_eligibility()
returns table (
  certificate_state text,
  completed_lessons integer,
  required_lessons integer,
  accepted_projects integer,
  required_projects integer,
  profile_name_ready boolean,
  display_name_preview text,
  certificate_id uuid,
  certificate_code text,
  issued_at timestamptz,
  revoked_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  current_user_id uuid := (select auth.uid());
  eligibility record;
  certificate_row public.course_certificates%rowtype;
  computed_state text;
begin
  if current_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'authenticated user required';
  end if;

  select * into eligibility
  from private.course_certificate_eligibility_for_user(current_user_id);

  select certificate.* into certificate_row
  from public.course_certificates as certificate
  where certificate.user_id = current_user_id;

  if certificate_row.id is not null then
    computed_state := case
      when certificate_row.revoked_at is null then 'issued'
      else 'revoked'
    end;
  elsif eligibility.required_lessons = 40
    and eligibility.completed_lessons = eligibility.required_lessons
    and eligibility.required_projects = 8
    and eligibility.accepted_projects = eligibility.required_projects
    and eligibility.profile_name_ready
  then
    computed_state := 'eligible';
  else
    computed_state := 'locked';
  end if;

  return query select
    computed_state,
    eligibility.completed_lessons,
    eligibility.required_lessons,
    eligibility.accepted_projects,
    eligibility.required_projects,
    eligibility.profile_name_ready,
    eligibility.display_name,
    certificate_row.id,
    certificate_row.certificate_code,
    certificate_row.issued_at,
    certificate_row.revoked_at;
end;
$function$;

-- ---------------------------------------------------------------------------
-- Idempotent self-issuance with a profile-row serialization lock
-- ---------------------------------------------------------------------------

create or replace function public.issue_my_course_certificate()
returns table (
  certificate_id uuid,
  certificate_code text,
  display_name_snapshot text,
  course_title_snapshot text,
  course_version text,
  issued_at timestamptz,
  reused boolean
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  current_user_id uuid := (select auth.uid());
  eligibility record;
  certificate_row public.course_certificates%rowtype;
begin
  if current_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'authenticated user required';
  end if;

  perform 1
  from public.profiles as profile
  where profile.user_id = current_user_id
  for update;

  if not found then
    raise exception using
      errcode = '23514',
      message = 'completed learner profile is required';
  end if;

  select certificate.* into certificate_row
  from public.course_certificates as certificate
  where certificate.user_id = current_user_id
  for update;

  if certificate_row.id is not null then
    if certificate_row.revoked_at is not null then
      raise exception using
        errcode = '55000',
        message = 'course certificate has been revoked';
    end if;

    return query select
      certificate_row.id,
      certificate_row.certificate_code,
      certificate_row.display_name_snapshot,
      certificate_row.course_title_snapshot,
      certificate_row.course_version,
      certificate_row.issued_at,
      true;
    return;
  end if;

  select * into eligibility
  from private.course_certificate_eligibility_for_user(current_user_id);

  if eligibility.required_lessons <> 40
    or eligibility.completed_lessons <> eligibility.required_lessons
    or eligibility.required_projects <> 8
    or eligibility.accepted_projects <> eligibility.required_projects
    or eligibility.profile_name_ready is not true
    or eligibility.display_name is null
  then
    raise exception using
      errcode = '23514',
      message = 'course certificate eligibility is incomplete';
  end if;

  insert into public.course_certificates (
    user_id,
    display_name_snapshot
  )
  values (
    current_user_id,
    eligibility.display_name
  )
  returning * into certificate_row;

  return query select
    certificate_row.id,
    certificate_row.certificate_code,
    certificate_row.display_name_snapshot,
    certificate_row.course_title_snapshot,
    certificate_row.course_version,
    certificate_row.issued_at,
    false;
end;
$function$;

-- ---------------------------------------------------------------------------
-- Minimal public verification; unknown and malformed codes both return 0 rows
-- ---------------------------------------------------------------------------

create or replace function public.verify_course_certificate(
  p_certificate_code text
)
returns table (
  certificate_code text,
  display_name_snapshot text,
  course_title_snapshot text,
  course_version text,
  issued_at timestamptz,
  certificate_status text
)
language sql
stable
security definer
set search_path = ''
as $function$
  select
    certificate.certificate_code,
    certificate.display_name_snapshot,
    certificate.course_title_snapshot,
    certificate.course_version,
    certificate.issued_at,
    case
      when certificate.revoked_at is null then 'VALID'::text
      else 'REVOKED'::text
    end as certificate_status
  from public.course_certificates as certificate
  where certificate.certificate_code = pg_catalog.lower(
    pg_catalog.btrim(coalesce(p_certificate_code, ''))
  );
$function$;

-- ---------------------------------------------------------------------------
-- Service-role-only terminal and idempotent revocation
-- ---------------------------------------------------------------------------

create or replace function public.revoke_course_certificate(
  p_certificate_code text,
  p_reason text
)
returns table (
  certificate_id uuid,
  certificate_code text,
  revoked_at timestamptz,
  already_revoked boolean
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  normalized_code text := pg_catalog.lower(
    pg_catalog.btrim(coalesce(p_certificate_code, ''))
  );
  normalized_reason text := pg_catalog.btrim(coalesce(p_reason, ''));
  certificate_row public.course_certificates%rowtype;
begin
  if normalized_code !~ '^as-[0-9a-f]{32}$'
    or char_length(normalized_reason) not between 10 and 500
  then
    raise exception using
      errcode = '22023',
      message = 'valid certificate code and bounded revocation reason are required';
  end if;

  select certificate.* into certificate_row
  from public.course_certificates as certificate
  where certificate.certificate_code = normalized_code
  for update;

  if certificate_row.id is null then
    raise exception using
      errcode = '22023',
      message = 'certificate not found';
  end if;

  if certificate_row.revoked_at is not null then
    return query select
      certificate_row.id,
      certificate_row.certificate_code,
      certificate_row.revoked_at,
      true;
    return;
  end if;

  update public.course_certificates as certificate
  set
    revoked_at = now(),
    revocation_reason = normalized_reason
  where certificate.id = certificate_row.id
  returning certificate.* into certificate_row;

  return query select
    certificate_row.id,
    certificate_row.certificate_code,
    certificate_row.revoked_at,
    false;
end;
$function$;

-- ---------------------------------------------------------------------------
-- Exact grants
-- ---------------------------------------------------------------------------

revoke all on function
  public.get_my_course_certificate_eligibility(),
  public.issue_my_course_certificate(),
  public.verify_course_certificate(text),
  public.revoke_course_certificate(text, text)
from public, anon, authenticated, service_role;

grant execute on function
  public.get_my_course_certificate_eligibility(),
  public.issue_my_course_certificate()
to authenticated;

grant execute on function public.verify_course_certificate(text)
to anon, authenticated, service_role;

grant execute on function public.revoke_course_certificate(text, text)
to service_role;

comment on table public.course_certificates is
  'One lifetime ARCH.START Certificate of Completion per learner. Browser writes are disabled.';
comment on function public.get_my_course_certificate_eligibility() is
  'Authenticated parameter-free certificate eligibility and current-state projection.';
comment on function public.issue_my_course_certificate() is
  'Authenticated idempotent self-issuance after exact 40-lesson, 8-accepted-project and profile-name checks.';
comment on function public.verify_course_certificate(text) is
  'Minimal public certificate verification. Unknown or malformed codes return no row.';
comment on function public.revoke_course_certificate(text, text) is
  'Service-role-only terminal certificate revocation.';

-- ---------------------------------------------------------------------------
-- Migration postconditions
-- ---------------------------------------------------------------------------

do $postcondition$
declare
  function_name text;
  function_oid oid;
  routine_record record;
  public_execute boolean;
  policy_count integer;
  certificate_row_count bigint;
begin
  if to_regclass('public.course_certificates') is null then
    raise exception using
      errcode = '42P01',
      message = 'course certificate table is missing';
  end if;

  if not (
    select relation.relrowsecurity
    from pg_catalog.pg_class as relation
    where relation.oid = 'public.course_certificates'::regclass
  ) then
    raise exception using
      errcode = '42501',
      message = 'course certificate RLS is disabled';
  end if;

  select count(*) into policy_count
  from pg_catalog.pg_policies
  where schemaname = 'public'
    and tablename = 'course_certificates'
    and policyname = 'course_certificates_select_own'
    and cmd = 'SELECT';

  if policy_count <> 1
    or pg_catalog.has_table_privilege(
      'anon',
      'public.course_certificates',
      'SELECT'
    )
    or not pg_catalog.has_column_privilege(
      'authenticated',
      'public.course_certificates',
      'certificate_code',
      'SELECT'
    )
    or pg_catalog.has_column_privilege(
      'authenticated',
      'public.course_certificates',
      'user_id',
      'SELECT'
    )
    or pg_catalog.has_column_privilege(
      'authenticated',
      'public.course_certificates',
      'revocation_reason',
      'SELECT'
    )
    or pg_catalog.has_table_privilege(
      'authenticated',
      'public.course_certificates',
      'INSERT'
    )
    or pg_catalog.has_table_privilege(
      'authenticated',
      'public.course_certificates',
      'UPDATE'
    )
    or pg_catalog.has_table_privilege(
      'authenticated',
      'public.course_certificates',
      'DELETE'
    )
    or pg_catalog.has_table_privilege(
      'service_role',
      'public.course_certificates',
      'INSERT'
    )
    or pg_catalog.has_table_privilege(
      'service_role',
      'public.course_certificates',
      'UPDATE'
    )
    or pg_catalog.has_table_privilege(
      'service_role',
      'public.course_certificates',
      'DELETE'
    )
  then
    raise exception using
      errcode = '42501',
      message = 'course certificate table privilege contract is invalid';
  end if;

  foreach function_name in array array[
    'public.get_my_course_certificate_eligibility()',
    'public.issue_my_course_certificate()',
    'public.verify_course_certificate(text)',
    'public.revoke_course_certificate(text,text)',
    'private.course_certificate_eligibility_for_user(uuid)'
  ] loop
    function_oid := pg_catalog.to_regprocedure(function_name);

    if function_oid is null then
      raise exception using
        errcode = '42883',
        message = 'certificate function is missing: ' || function_name;
    end if;

    select routine.prosecdef, routine.proconfig
    into routine_record
    from pg_catalog.pg_proc as routine
    where routine.oid = function_oid;

    select exists (
      select 1
      from pg_catalog.aclexplode(
        coalesce(
          (
            select routine.proacl
            from pg_catalog.pg_proc as routine
            where routine.oid = function_oid
          ),
          pg_catalog.acldefault(
            'f',
            (
              select routine.proowner
              from pg_catalog.pg_proc as routine
              where routine.oid = function_oid
            )
          )
        )
      ) as privilege
      where privilege.grantee = 0
        and privilege.privilege_type = 'EXECUTE'
    ) into public_execute;

    if routine_record.prosecdef is not true
      or pg_catalog.array_position(
        routine_record.proconfig,
        'search_path=""'
      ) is null
      or public_execute
    then
      raise exception using
        errcode = '42501',
        message = 'certificate function hardening is invalid: ' || function_name;
    end if;
  end loop;

  if not pg_catalog.has_function_privilege(
      'authenticated',
      'public.get_my_course_certificate_eligibility()',
      'EXECUTE'
    )
    or not pg_catalog.has_function_privilege(
      'authenticated',
      'public.issue_my_course_certificate()',
      'EXECUTE'
    )
    or not pg_catalog.has_function_privilege(
      'anon',
      'public.verify_course_certificate(text)',
      'EXECUTE'
    )
    or not pg_catalog.has_function_privilege(
      'authenticated',
      'public.verify_course_certificate(text)',
      'EXECUTE'
    )
    or pg_catalog.has_function_privilege(
      'anon',
      'public.issue_my_course_certificate()',
      'EXECUTE'
    )
    or pg_catalog.has_function_privilege(
      'authenticated',
      'public.revoke_course_certificate(text,text)',
      'EXECUTE'
    )
    or not pg_catalog.has_function_privilege(
      'service_role',
      'public.revoke_course_certificate(text,text)',
      'EXECUTE'
    )
  then
    raise exception using
      errcode = '42501',
      message = 'certificate function privilege contract is invalid';
  end if;

  select count(*) into certificate_row_count
  from public.course_certificates;

  if certificate_row_count <> 0 then
    raise exception using
      errcode = '55000',
      message = 'certificate authority migration must start with zero rows';
  end if;
end;
$postcondition$;

commit;
