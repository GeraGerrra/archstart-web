-- ARCH.START Phase 07 Pass 2B2-R1 — PL/pgSQL output qualification repair
-- Runtime-only repair for SQLSTATE 42702 caused by output-parameter names
-- colliding with unqualified table columns inside SECURITY DEFINER RPCs.
-- No schema, state-machine, RLS, Storage, UI, or privilege expansion.

begin;

-- Pin the exact hosted B2 definitions that were independently verified before
-- the two-account runtime test exposed the ambiguity.
do $phase07$
declare
  item record;
begin
  for item in
    select *
    from (values
      ('public.set_project_staff_role(uuid,text,boolean,uuid)', '0c9be5a1a26a2d86d2d91fd8c7a63e61'),
      ('public.create_project_draft(text)', '46e65215aa723612c7f5d44ed1ee2e2e'),
      ('public.create_project_revision_draft(uuid)', '99e4e979f36cd2377f7a47fd20e38821'),
      ('public.assign_project_reviewer(uuid,uuid)', '20ab63f38469af9eca784a4e10441301')
    ) as expected(signature, definition_md5)
  loop
    if pg_catalog.to_regprocedure(item.signature) is null then
      raise exception using
        errcode = '42883',
        message = 'required Pass 2B2 workflow function is absent: ' || item.signature;
    end if;

    if pg_catalog.md5(
      pg_catalog.pg_get_functiondef(
        pg_catalog.to_regprocedure(item.signature)
      )
    ) <> item.definition_md5 then
      raise exception using
        errcode = '55000',
        message = 'hosted Pass 2B2 function identity drift: ' || item.signature;
    end if;
  end loop;

  if exists (
    select 1 from storage.buckets where id = 'project-submissions'
  ) then
    raise exception using
      errcode = '55000',
      message = 'Pass 2B2-R1 must not run after Project Storage activation';
  end if;
end;
$phase07$;

-- Fix a latent UPDATE-WHERE collision for the output parameter staff_role.
create or replace function public.set_project_staff_role(
  p_user_id uuid,
  p_staff_role text,
  p_active boolean,
  p_granted_by uuid
)
returns table (
  staff_user_id uuid,
  staff_role text,
  active boolean,
  granted_at timestamptz,
  revoked_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  normalized_role text := pg_catalog.lower(
    pg_catalog.btrim(coalesce(p_staff_role, ''))
  );
  existing_role private.project_staff_roles%rowtype;
begin
  if p_user_id is null
    or p_granted_by is null
    or p_active is null
  then
    raise exception using
      errcode = '22023',
      message = 'staff user, grantor, and active state are required';
  end if;

  if normalized_role not in ('reviewer', 'admin') then
    raise exception using
      errcode = '22023',
      message = 'invalid project staff role';
  end if;

  perform 1
  from auth.users
  where id = p_user_id;

  if not found then
    raise exception using
      errcode = '23503',
      message = 'project staff user does not exist';
  end if;

  perform 1
  from auth.users
  where id = p_granted_by;

  if not found then
    raise exception using
      errcode = '23503',
      message = 'project staff grantor does not exist';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext(p_user_id::text),
    pg_catalog.hashtext(normalized_role)
  );

  if p_active is false and exists (
    select 1
    from private.project_reviewer_assignments as assignment
    where assignment.reviewer_id = p_user_id
      and assignment.released_at is null
  ) then
    raise exception using
      errcode = '55000',
      message = 'release active reviewer assignments before revoking the project staff role';
  end if;

  select staff.*
  into existing_role
  from private.project_staff_roles as staff
  where staff.user_id = p_user_id
    and staff.staff_role = normalized_role
  for update;

  if existing_role.user_id is null then
    if p_active is not true then
      raise exception using
        errcode = '55000',
        message = 'cannot revoke a project staff role that does not exist';
    end if;

    perform pg_catalog.set_config(
      'archstart.project_staff_write_authorized',
      'on',
      true
    );

    insert into private.project_staff_roles (
      user_id,
      staff_role,
      active,
      granted_by
    ) values (
      p_user_id,
      normalized_role,
      true,
      p_granted_by
    );
  elsif existing_role.active is distinct from p_active then
    perform pg_catalog.set_config(
      'archstart.project_staff_write_authorized',
      'on',
      true
    );

    update private.project_staff_roles as staff
    set active = p_active
    where staff.user_id = p_user_id
      and staff.staff_role = normalized_role;
  end if;

  return query
  select
    staff.user_id,
    staff.staff_role,
    staff.active,
    staff.granted_at,
    staff.revoked_at
  from private.project_staff_roles as staff
  where staff.user_id = p_user_id
    and staff.staff_role = normalized_role;
end;
$function$;

-- Fix the observed RETURNING version_number/version_state collision.
create or replace function public.create_project_draft(
  p_project_code text
)
returns table (
  submission_id uuid,
  version_id uuid,
  project_code text,
  version_number smallint,
  version_state text,
  submission_status text
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  current_user_id uuid := (select auth.uid());
  normalized_project_code text := pg_catalog.upper(
    pg_catalog.btrim(coalesce(p_project_code, ''))
  );
  found_submission_id uuid;
  found_version_id uuid;
  found_version_number smallint;
  found_version_state text;
  found_submission_status text;
begin
  if current_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'authenticated user required';
  end if;

  if not exists (
    select 1
    from private.project_submission_policies as policy
    where policy.project_code = normalized_project_code
      and policy.is_current
  ) then
    raise exception using
      errcode = '22023',
      message = 'unknown or inactive project submission policy';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext(current_user_id::text),
    pg_catalog.hashtext(normalized_project_code)
  );

  select
    submission.id,
    submission.current_version_id,
    submission.current_status
  into
    found_submission_id,
    found_version_id,
    found_submission_status
  from public.project_submissions as submission
  where submission.user_id = current_user_id
    and submission.project_code = normalized_project_code
  for update;

  if found_submission_id is not null then
    if found_submission_status <> 'draft' then
      raise exception using
        errcode = '55000',
        message = 'an existing project submission is not in initial draft state';
    end if;

    if found_version_id is null then
      raise exception using
        errcode = '55000',
        message = 'existing draft submission has no current version';
    end if;

    select version.version_number, version.version_state
    into found_version_number, found_version_state
    from public.project_submission_versions as version
    where version.id = found_version_id
      and version.submission_id = found_submission_id
    for update;

    if found_version_state <> 'draft' then
      raise exception using
        errcode = '55000',
        message = 'existing project draft version is not editable';
    end if;

    return query
    select
      found_submission_id,
      found_version_id,
      normalized_project_code,
      found_version_number,
      found_version_state,
      found_submission_status;
    return;
  end if;

  perform pg_catalog.set_config(
    'archstart.project_submission_write_authorized',
    'on',
    true
  );

  insert into public.project_submissions as inserted_submission (
    user_id,
    project_code
  ) values (
    current_user_id,
    normalized_project_code
  ) returning
    inserted_submission.id,
    inserted_submission.current_status
  into found_submission_id, found_submission_status;

  perform pg_catalog.set_config(
    'archstart.project_version_write_authorized',
    'on',
    true
  );

  insert into public.project_submission_versions as inserted_version (
    submission_id
  ) values (
    found_submission_id
  ) returning
    inserted_version.id,
    inserted_version.version_number,
    inserted_version.version_state
  into found_version_id, found_version_number, found_version_state;

  perform pg_catalog.set_config(
    'archstart.project_current_version_write_authorized',
    'on',
    true
  );

  update public.project_submissions
  set current_version_id = found_version_id
  where id = found_submission_id;

  perform pg_catalog.set_config(
    'archstart.project_event_write_authorized',
    'on',
    true
  );

  insert into public.project_status_events (
    submission_id,
    version_id,
    actor_id,
    actor_role,
    event_type,
    from_status,
    to_status,
    public_payload
  ) values (
    found_submission_id,
    found_version_id,
    current_user_id,
    'learner',
    'draft_created',
    null,
    'draft',
    pg_catalog.jsonb_build_object(
      'versionNumber',
      found_version_number
    )
  );

  return query
  select
    found_submission_id,
    found_version_id,
    normalized_project_code,
    found_version_number,
    found_version_state,
    found_submission_status;
end;
$function$;

-- Fix the equivalent revision-draft RETURNING collision before it is reached.
create or replace function public.create_project_revision_draft(
  p_submission_id uuid
)
returns table (
  submission_id uuid,
  version_id uuid,
  project_code text,
  version_number smallint,
  version_state text,
  submission_status text
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  current_user_id uuid := (select auth.uid());
  found_project_code text;
  found_submission_status text;
  found_version_id uuid;
  found_version_number smallint;
  found_version_state text;
begin
  if current_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'authenticated user required';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext(current_user_id::text),
    pg_catalog.hashtext(p_submission_id::text)
  );

  select submission.project_code, submission.current_status
  into found_project_code, found_submission_status
  from public.project_submissions as submission
  where submission.id = p_submission_id
    and submission.user_id = current_user_id
  for update;

  if found_project_code is null then
    raise exception using
      errcode = '42501',
      message = 'project submission is not owned by the authenticated user';
  end if;

  if found_submission_status not in (
    'revisions_required',
    'not_accepted'
  ) then
    raise exception using
      errcode = '55000',
      message = 'project revision requires reviewer feedback';
  end if;

  select version.id, version.version_number, version.version_state
  into found_version_id, found_version_number, found_version_state
  from public.project_submission_versions as version
  where version.submission_id = p_submission_id
    and version.version_state = 'draft'
  for update;

  if found_version_id is not null then
    return query
    select
      p_submission_id,
      found_version_id,
      found_project_code,
      found_version_number,
      found_version_state,
      found_submission_status;
    return;
  end if;

  perform pg_catalog.set_config(
    'archstart.project_version_write_authorized',
    'on',
    true
  );

  insert into public.project_submission_versions as inserted_version (
    submission_id
  ) values (
    p_submission_id
  ) returning
    inserted_version.id,
    inserted_version.version_number,
    inserted_version.version_state
  into found_version_id, found_version_number, found_version_state;

  perform pg_catalog.set_config(
    'archstart.project_event_write_authorized',
    'on',
    true
  );

  insert into public.project_status_events (
    submission_id,
    version_id,
    actor_id,
    actor_role,
    event_type,
    from_status,
    to_status,
    public_payload
  ) values (
    p_submission_id,
    found_version_id,
    current_user_id,
    'learner',
    'draft_created',
    found_submission_status,
    found_submission_status,
    pg_catalog.jsonb_build_object(
      'versionNumber',
      found_version_number,
      'revision',
      true
    )
  );

  return query
  select
    p_submission_id,
    found_version_id,
    found_project_code,
    found_version_number,
    found_version_state,
    found_submission_status;
end;
$function$;

-- Fix the equivalent reviewer-assignment assigned_at collision before it is reached.
create or replace function public.assign_project_reviewer(
  p_submission_id uuid,
  p_reviewer_id uuid
)
returns table (
  assignment_id uuid,
  submission_id uuid,
  reviewer_id uuid,
  assigned_at timestamptz,
  released_previous boolean
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  current_user_id uuid := (select auth.uid());
  owner_id uuid;
  found_submission_status text;
  active_assignment_id uuid;
  active_reviewer_id uuid;
  found_assignment_id uuid;
  found_assigned_at timestamptz;
  did_release_previous boolean := false;
begin
  if current_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'authenticated user required';
  end if;

  if not private.project_staff_has_role(
    current_user_id,
    array['admin']::text[]
  ) then
    raise exception using
      errcode = '42501',
      message = 'active project admin role required';
  end if;

  select submission.user_id, submission.current_status
  into owner_id, found_submission_status
  from public.project_submissions as submission
  where submission.id = p_submission_id
  for update;

  if owner_id is null then
    raise exception using
      errcode = '23503',
      message = 'project submission does not exist';
  end if;

  if found_submission_status not in (
    'submitted',
    'resubmitted',
    'under_review'
  ) then
    raise exception using
      errcode = '55000',
      message = 'reviewer assignment requires a submitted project';
  end if;

  if p_reviewer_id = owner_id then
    raise exception using
      errcode = '23514',
      message = 'reviewers cannot review their own project submission';
  end if;

  if not private.project_staff_has_role(
    p_reviewer_id,
    array['reviewer', 'admin']::text[]
  ) then
    raise exception using
      errcode = '42501',
      message = 'assigned user lacks an active reviewer role';
  end if;

  select assignment.id, assignment.reviewer_id
  into active_assignment_id, active_reviewer_id
  from private.project_reviewer_assignments as assignment
  where assignment.submission_id = p_submission_id
    and assignment.released_at is null
  for update;

  if active_assignment_id is not null
    and active_reviewer_id = p_reviewer_id
  then
    return query
    select
      assignment.id,
      assignment.submission_id,
      assignment.reviewer_id,
      assignment.assigned_at,
      false
    from private.project_reviewer_assignments as assignment
    where assignment.id = active_assignment_id;
    return;
  end if;

  perform pg_catalog.set_config(
    'archstart.project_assignment_write_authorized',
    'on',
    true
  );

  if active_assignment_id is not null then
    update private.project_reviewer_assignments
    set released_at = now()
    where id = active_assignment_id;

    did_release_previous := true;

    perform pg_catalog.set_config(
      'archstart.project_event_write_authorized',
      'on',
      true
    );

    insert into public.project_status_events (
      submission_id,
      version_id,
      actor_id,
      actor_role,
      event_type,
      from_status,
      to_status,
      public_payload
    )
    select
      submission.id,
      submission.current_version_id,
      current_user_id,
      'admin',
      'assignment_released',
      submission.current_status,
      submission.current_status,
      pg_catalog.jsonb_build_object('reason', 'reassigned')
    from public.project_submissions as submission
    where submission.id = p_submission_id;
  end if;

  insert into private.project_reviewer_assignments as inserted_assignment (
    submission_id,
    reviewer_id,
    assigned_by
  ) values (
    p_submission_id,
    p_reviewer_id,
    current_user_id
  ) returning
    inserted_assignment.id,
    inserted_assignment.assigned_at
  into found_assignment_id, found_assigned_at;

  perform pg_catalog.set_config(
    'archstart.project_event_write_authorized',
    'on',
    true
  );

  insert into public.project_status_events (
    submission_id,
    version_id,
    actor_id,
    actor_role,
    event_type,
    from_status,
    to_status,
    public_payload
  )
  select
    submission.id,
    submission.current_version_id,
    current_user_id,
    'admin',
    'reviewer_assigned',
    submission.current_status,
    submission.current_status,
    pg_catalog.jsonb_build_object('assignment', 'active')
  from public.project_submissions as submission
  where submission.id = p_submission_id;

  return query
  select
    found_assignment_id,
    p_submission_id,
    p_reviewer_id,
    found_assigned_at,
    did_release_previous;
end;
$function$;

-- Reassert the exact original function-execution boundary.
revoke all on function
  public.set_project_staff_role(uuid, text, boolean, uuid),
  public.create_project_draft(text),
  public.create_project_revision_draft(uuid),
  public.assign_project_reviewer(uuid, uuid)
from public, anon, authenticated, service_role;

grant execute on function
  public.create_project_draft(text),
  public.create_project_revision_draft(uuid),
  public.assign_project_reviewer(uuid, uuid)
to authenticated;

grant execute on function
  public.set_project_staff_role(uuid, text, boolean, uuid)
to service_role;

-- Runtime-shape and security postconditions.
do $phase07$
declare
  create_draft_definition text;
  create_revision_definition text;
  assignment_definition text;
  staff_definition text;
begin
  create_draft_definition := pg_catalog.pg_get_functiondef(
    'public.create_project_draft(text)'::regprocedure
  );
  create_revision_definition := pg_catalog.pg_get_functiondef(
    'public.create_project_revision_draft(uuid)'::regprocedure
  );
  assignment_definition := pg_catalog.pg_get_functiondef(
    'public.assign_project_reviewer(uuid,uuid)'::regprocedure
  );
  staff_definition := pg_catalog.pg_get_functiondef(
    'public.set_project_staff_role(uuid,text,boolean,uuid)'::regprocedure
  );

  if pg_catalog.position(
    'inserted_version.version_number' in create_draft_definition
  ) = 0
    or pg_catalog.position(
      'inserted_version.version_state' in create_draft_definition
    ) = 0
    or pg_catalog.position(
      'inserted_version.version_number' in create_revision_definition
    ) = 0
    or pg_catalog.position(
      'inserted_version.version_state' in create_revision_definition
    ) = 0
    or pg_catalog.position(
      'inserted_assignment.assigned_at' in assignment_definition
    ) = 0
    or pg_catalog.position(
      'update private.project_staff_roles as staff' in staff_definition
    ) = 0
    or pg_catalog.position(
      'staff.staff_role = normalized_role' in staff_definition
    ) = 0
  then
    raise exception using
      errcode = '55000',
      message = 'Pass 2B2-R1 qualification postcondition failed';
  end if;

  if pg_catalog.has_function_privilege(
      'anon',
      'public.create_project_draft(text)',
      'EXECUTE'
    )
    or not pg_catalog.has_function_privilege(
      'authenticated',
      'public.create_project_draft(text)',
      'EXECUTE'
    )
    or not pg_catalog.has_function_privilege(
      'authenticated',
      'public.create_project_revision_draft(uuid)',
      'EXECUTE'
    )
    or not pg_catalog.has_function_privilege(
      'authenticated',
      'public.assign_project_reviewer(uuid,uuid)',
      'EXECUTE'
    )
    or pg_catalog.has_function_privilege(
      'authenticated',
      'public.set_project_staff_role(uuid,text,boolean,uuid)',
      'EXECUTE'
    )
    or not pg_catalog.has_function_privilege(
      'service_role',
      'public.set_project_staff_role(uuid,text,boolean,uuid)',
      'EXECUTE'
    )
  then
    raise exception using
      errcode = '42501',
      message = 'Pass 2B2-R1 function privilege boundary changed';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_proc as procedure
    where procedure.oid in (
      'public.set_project_staff_role(uuid,text,boolean,uuid)'::regprocedure,
      'public.create_project_draft(text)'::regprocedure,
      'public.create_project_revision_draft(uuid)'::regprocedure,
      'public.assign_project_reviewer(uuid,uuid)'::regprocedure
    )
      and (
        procedure.prosecdef is not true
        or procedure.proconfig is distinct from array['search_path=""']::text[]
      )
  ) then
    raise exception using
      errcode = '42501',
      message = 'Pass 2B2-R1 security-definer boundary changed';
  end if;
end;
$phase07$;

commit;
