-- ARCH.START Phase 08M.1 — hosted read-only certificate authority verification

begin transaction read only;

do $verification$
declare
  expected_columns text[] := array[
    'id',
    'user_id',
    'certificate_code',
    'display_name_snapshot',
    'course_code',
    'course_version',
    'course_title_snapshot',
    'issued_at',
    'revoked_at',
    'revocation_reason',
    'created_at'
  ]::text[];
  actual_columns text[];
  function_name text;
  function_oid oid;
  routine_record record;
  public_execute boolean;
  certificate_row_count bigint;
  certificate_storage_bucket_count bigint;
begin
  if to_regclass('public.course_certificates') is null then
    raise exception using errcode = '42P01', message = 'course certificate table is missing';
  end if;

  select pg_catalog.array_agg(column_name order by ordinal_position)
  into actual_columns
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'course_certificates';

  if actual_columns is distinct from expected_columns then
    raise exception using
      errcode = '55000',
      message = 'course certificate column contract is invalid';
  end if;

  if (select count(*) from private.course_modules) <> 8
    or (select count(*) from private.course_lessons) <> 40
    or (select count(*) from private.course_projects) <> 8
    or (select count(*) from private.project_submission_policies where is_current) <> 8
    or (select count(*) from private.project_rubric_criteria) <> 40
  then
    raise exception using
      errcode = '55000',
      message = 'Phase 07 predecessor authority changed';
  end if;

  if not (
    select relation.relrowsecurity
    from pg_catalog.pg_class as relation
    where relation.oid = 'public.course_certificates'::regclass
  )
    or (
      select count(*)
      from pg_catalog.pg_policies
      where schemaname = 'public'
        and tablename = 'course_certificates'
        and policyname = 'course_certificates_select_own'
        and cmd = 'SELECT'
    ) <> 1
  then
    raise exception using
      errcode = '42501',
      message = 'course certificate RLS contract is invalid';
  end if;

  if pg_catalog.has_table_privilege('anon', 'public.course_certificates', 'SELECT')
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
      message = 'course certificate browser/service table grants are invalid';
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
      or pg_catalog.array_position(routine_record.proconfig, 'search_path=""') is null
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
      message = 'certificate RPC grant contract is invalid';
  end if;

  select count(*) into certificate_row_count
  from public.course_certificates;

  select count(*) into certificate_storage_bucket_count
  from storage.buckets
  where id like '%certificate%'
    or name like '%certificate%';

  if certificate_row_count <> 0
    or certificate_storage_bucket_count <> 0
  then
    raise exception using
      errcode = '55000',
      message = 'certificate foundation zero-row/no-storage boundary is invalid';
  end if;
end;
$verification$;

select pg_catalog.jsonb_build_object(
  'check', 'phase08m_certificate_authority',
  'result', 'PASS',
  'catalogs', pg_catalog.jsonb_build_object(
    'modules', (select count(*) from private.course_modules),
    'lessons', (select count(*) from private.course_lessons),
    'projects', (select count(*) from private.course_projects)
  ),
  'certificateRows', (select count(*) from public.course_certificates),
  'certificateStorageBuckets', (
    select count(*)
    from storage.buckets
    where id like '%certificate%'
      or name like '%certificate%'
  ),
  'browserWritesDenied', true,
  'publicVerificationEnabled', true,
  'serviceOnlyRevocation', true
) as phase08m_certificate_authority_verification;

rollback;
