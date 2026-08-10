begin transaction read only;

do $verification$
declare
  function_name text;
  function_oid oid;
  routine_record record;
  public_execute boolean;
  policy_count integer;
  rubric_count integer;
  active_staff_count integer;
  project_row_count bigint;
  project_storage_object_count bigint;
begin
  foreach function_name in array array[
    'public.get_project_submission_policy_for_service(text)',
    'public.get_project_staff_roles_for_service(uuid)',
    'public.list_active_project_staff_for_service()',
    'public.list_active_project_reviewer_assignments_for_service()',
    'public.list_project_rubric_criteria_for_service(text[])'
  ] loop
    function_oid := pg_catalog.to_regprocedure(function_name);
    if function_oid is null then
      raise exception using
        errcode = '42883',
        message = 'R3 bridge signature is missing: ' || function_name;
    end if;

    select routine.prosecdef, routine.provolatile, routine.proconfig
    into routine_record
    from pg_catalog.pg_proc as routine
    where routine.oid = function_oid;

    select exists (
      select 1
      from pg_catalog.aclexplode(
        coalesce(
          (select routine.proacl from pg_catalog.pg_proc as routine where routine.oid = function_oid),
          pg_catalog.acldefault('f', (select routine.proowner from pg_catalog.pg_proc as routine where routine.oid = function_oid))
        )
      ) as privilege
      where privilege.grantee = 0
        and privilege.privilege_type = 'EXECUTE'
    ) into public_execute;

    if routine_record.prosecdef is not true
      or routine_record.provolatile <> 's'
      or pg_catalog.array_position(routine_record.proconfig, 'search_path=""') is null
      or public_execute
      or pg_catalog.has_function_privilege('anon', function_oid, 'EXECUTE')
      or pg_catalog.has_function_privilege('authenticated', function_oid, 'EXECUTE')
      or not pg_catalog.has_function_privilege('service_role', function_oid, 'EXECUTE')
    then
      raise exception using
        errcode = '42501',
        message = 'R3 bridge security contract is invalid: ' || function_name;
    end if;
  end loop;

  if pg_catalog.has_schema_privilege('anon', 'private', 'USAGE')
    or pg_catalog.has_schema_privilege('authenticated', 'private', 'USAGE')
  then
    raise exception using
      errcode = '42501',
      message = 'private schema is exposed to a browser role';
  end if;

  select count(*) into policy_count
  from private.project_submission_policies
  where is_current;

  select count(*) into rubric_count
  from private.project_rubric_criteria;

  select count(*) into active_staff_count
  from private.project_staff_roles
  where active
    and staff_role in ('reviewer', 'admin');

  select
    (select count(*) from public.project_submissions)
    + (select count(*) from public.project_submission_versions)
    + (select count(*) from public.project_submission_files)
    + (select count(*) from public.project_reviews)
    + (select count(*) from public.project_review_criteria)
    + (select count(*) from public.project_status_events)
  into project_row_count;

  select count(*) into project_storage_object_count
  from storage.objects
  where bucket_id = 'project-submissions';

  if policy_count <> 8
    or rubric_count <> 40
    or active_staff_count <> 2
    or project_row_count <> 0
    or project_storage_object_count <> 0
  then
    raise exception using
      errcode = '55000',
      message = 'R3 preserved hosted QA counts are invalid';
  end if;
end;
$verification$;

select
  5 as exact_bridge_signature_count,
  (select count(*) from private.project_submission_policies where is_current) as current_policy_count,
  (select count(*) from private.project_rubric_criteria) as rubric_criterion_count,
  (
    select count(*)
    from private.project_staff_roles
    where active and staff_role in ('reviewer', 'admin')
  ) as active_qa_staff_role_count,
  (select count(*) from public.project_submissions) as project_submission_count,
  (
    select count(*)
    from storage.objects
    where bucket_id = 'project-submissions'
  ) as project_storage_object_count;

rollback;
