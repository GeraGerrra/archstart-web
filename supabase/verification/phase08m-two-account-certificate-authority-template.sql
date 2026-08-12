-- ARCH.START Phase 08M.1 — rollback-only two-account negative/runtime template
-- Replace USER_A_UUID and USER_B_UUID with two distinct clean auth.users UUIDs.
-- Clean means no lesson completions, project submissions or certificate rows.
-- Run once as postgres after the migration and hosted read-only verification.

begin;

do $phase08m$
declare
  user_a uuid := 'USER_A_UUID'::uuid;
  user_b uuid := 'USER_B_UUID'::uuid;
  eligibility_a record;
  eligibility_b record;
  issue_denied_a boolean := false;
  issue_denied_b boolean := false;
begin
  if user_a = user_b
    or (select count(*) from auth.users where id in (user_a, user_b)) <> 2
  then
    raise exception using
      errcode = '22023',
      message = 'two distinct existing users are required';
  end if;

  if exists (
    select 1 from public.lesson_completions where user_id in (user_a, user_b)
  ) or exists (
    select 1 from public.project_submissions where user_id in (user_a, user_b)
  ) or exists (
    select 1 from public.course_certificates where user_id in (user_a, user_b)
  ) then
    raise exception using
      errcode = '55000',
      message = 'certificate foundation test users must start clean';
  end if;

  perform pg_catalog.set_config(
    'request.jwt.claims',
    pg_catalog.jsonb_build_object(
      'role', 'authenticated',
      'sub', user_a::text
    )::text,
    true
  );

  select * into eligibility_a
  from public.get_my_course_certificate_eligibility();

  if eligibility_a.certificate_state <> 'locked'
    or eligibility_a.completed_lessons <> 0
    or eligibility_a.required_lessons <> 40
    or eligibility_a.accepted_projects <> 0
    or eligibility_a.required_projects <> 8
    or eligibility_a.certificate_id is not null
  then
    raise exception using
      errcode = 'P8M01',
      message = 'clean user A certificate projection is invalid';
  end if;

  begin
    perform 1 from public.issue_my_course_certificate();
  exception
    when check_violation then
      issue_denied_a := true;
  end;

  perform pg_catalog.set_config(
    'request.jwt.claims',
    pg_catalog.jsonb_build_object(
      'role', 'authenticated',
      'sub', user_b::text
    )::text,
    true
  );

  select * into eligibility_b
  from public.get_my_course_certificate_eligibility();

  if eligibility_b.certificate_state <> 'locked'
    or eligibility_b.completed_lessons <> 0
    or eligibility_b.required_lessons <> 40
    or eligibility_b.accepted_projects <> 0
    or eligibility_b.required_projects <> 8
    or eligibility_b.certificate_id is not null
  then
    raise exception using
      errcode = 'P8M02',
      message = 'clean user B certificate projection is invalid';
  end if;

  begin
    perform 1 from public.issue_my_course_certificate();
  exception
    when check_violation then
      issue_denied_b := true;
  end;

  if issue_denied_a is not true
    or issue_denied_b is not true
    or exists (
      select 1
      from public.course_certificates
      where user_id in (user_a, user_b)
    )
  then
    raise exception using
      errcode = 'P8M03',
      message = 'ineligible issuance denial or zero-row boundary failed';
  end if;

  if pg_catalog.has_function_privilege(
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
      errcode = 'P8M04',
      message = 'certificate RPC privilege matrix failed';
  end if;

  perform pg_catalog.set_config('request.jwt.claims', '{}', true);

  raise notice 'PHASE08M_TWO_ACCOUNT_LOCKED_PROJECTION=PASS';
  raise notice 'PHASE08M_INELIGIBLE_ISSUE_DENIAL=PASS';
  raise notice 'PHASE08M_PARAMETER_FREE_IDENTITY=PASS';
  raise notice 'PHASE08M_SERVICE_ONLY_REVOCATION_GRANT=PASS';
  raise notice 'PHASE08M_ZERO_CERTIFICATE_ROWS_PRESERVED=PASS';
end;
$phase08m$;

rollback;
