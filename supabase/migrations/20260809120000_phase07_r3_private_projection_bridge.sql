begin;

create or replace function public.get_project_submission_policy_for_service(
  p_project_code text
)
returns table (
  project_code text,
  format_type text,
  allowed_mime_types text[],
  max_file_bytes bigint,
  expected_width integer,
  expected_height integer,
  min_page_count smallint,
  max_page_count smallint,
  supporting_text_min_words integer,
  supporting_text_max_words integer
)
language sql
stable
security definer
set search_path = ''
as $function$
  select
    policy.project_code,
    policy.format_type,
    policy.allowed_mime_types,
    policy.max_file_bytes,
    policy.expected_width,
    policy.expected_height,
    policy.min_page_count,
    policy.max_page_count,
    policy.supporting_text_min_words,
    policy.supporting_text_max_words
  from private.project_submission_policies as policy
  where policy.project_code = p_project_code
    and policy.is_current;
$function$;

create or replace function public.get_project_staff_roles_for_service(
  p_user_id uuid
)
returns table (
  user_id uuid,
  staff_role text
)
language sql
stable
security definer
set search_path = ''
as $function$
  select staff.user_id, staff.staff_role
  from private.project_staff_roles as staff
  where staff.user_id = p_user_id
    and staff.active
    and staff.staff_role in ('reviewer', 'admin')
  order by staff.staff_role, staff.user_id;
$function$;

create or replace function public.list_active_project_staff_for_service()
returns table (
  user_id uuid,
  staff_role text
)
language sql
stable
security definer
set search_path = ''
as $function$
  select staff.user_id, staff.staff_role
  from private.project_staff_roles as staff
  where staff.active
    and staff.staff_role in ('reviewer', 'admin')
  order by staff.staff_role, staff.user_id;
$function$;

create or replace function public.list_active_project_reviewer_assignments_for_service()
returns table (
  submission_id uuid,
  reviewer_id uuid
)
language sql
stable
security definer
set search_path = ''
as $function$
  select assignment.submission_id, assignment.reviewer_id
  from private.project_reviewer_assignments as assignment
  where assignment.released_at is null
  order by assignment.submission_id, assignment.reviewer_id;
$function$;

create or replace function public.list_project_rubric_criteria_for_service(
  p_project_codes text[]
)
returns table (
  project_code text,
  rubric_version smallint,
  criterion_number smallint,
  title text,
  description text,
  max_points smallint
)
language sql
stable
security definer
set search_path = ''
as $function$
  select
    criterion.project_code,
    criterion.rubric_version,
    criterion.criterion_number,
    criterion.title,
    criterion.description,
    criterion.max_points
  from private.project_rubric_criteria as criterion
  where criterion.project_code = any (p_project_codes)
  order by
    criterion.project_code,
    criterion.rubric_version,
    criterion.criterion_number;
$function$;

revoke all on function public.get_project_submission_policy_for_service(text)
from public, anon, authenticated;
revoke all on function public.get_project_staff_roles_for_service(uuid)
from public, anon, authenticated;
revoke all on function public.list_active_project_staff_for_service()
from public, anon, authenticated;
revoke all on function public.list_active_project_reviewer_assignments_for_service()
from public, anon, authenticated;
revoke all on function public.list_project_rubric_criteria_for_service(text[])
from public, anon, authenticated;

grant execute on function public.get_project_submission_policy_for_service(text)
to service_role;
grant execute on function public.get_project_staff_roles_for_service(uuid)
to service_role;
grant execute on function public.list_active_project_staff_for_service()
to service_role;
grant execute on function public.list_active_project_reviewer_assignments_for_service()
to service_role;
grant execute on function public.list_project_rubric_criteria_for_service(text[])
to service_role;

comment on function public.get_project_submission_policy_for_service(text) is
  'Service-role-only projection of the current private project submission policy.';
comment on function public.get_project_staff_roles_for_service(uuid) is
  'Service-role-only projection of active reviewer/admin roles for one user.';
comment on function public.list_active_project_staff_for_service() is
  'Service-role-only projection of active reviewer/admin staff.';
comment on function public.list_active_project_reviewer_assignments_for_service() is
  'Service-role-only projection of unreleased project reviewer assignments.';
comment on function public.list_project_rubric_criteria_for_service(text[]) is
  'Service-role-only projection of private rubric criteria for requested projects.';

do $postcondition$
declare
  function_name text;
  function_oid oid;
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
        message = 'private projection bridge function is missing: ' || function_name;
    end if;

    if not pg_catalog.has_function_privilege(
      'service_role',
      function_oid,
      'EXECUTE'
    )
      or pg_catalog.has_function_privilege('anon', function_oid, 'EXECUTE')
      or pg_catalog.has_function_privilege('authenticated', function_oid, 'EXECUTE')
      or exists (
        select 1
        from pg_catalog.aclexplode(
          coalesce(
            (select routine.proacl from pg_catalog.pg_proc as routine where routine.oid = function_oid),
            pg_catalog.acldefault('f', (select routine.proowner from pg_catalog.pg_proc as routine where routine.oid = function_oid))
          )
        ) as privilege
        where privilege.grantee = 0
          and privilege.privilege_type = 'EXECUTE'
      )
    then
      raise exception using
        errcode = '42501',
        message = 'private projection bridge privilege contract is invalid: ' || function_name;
    end if;
  end loop;
end;
$postcondition$;

commit;
