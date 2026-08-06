-- ARCH.START Phase 07 Pass 2B2 — Project submission workflow activation
-- Activates narrow authenticated database RPCs for learner draft/submission,
-- reviewer assignment, review start, and immutable structured decisions.
--
-- Deliberately excluded from this pass:
-- - Supabase Storage bucket or Storage policies;
-- - file upload/finalization and byte inspection;
-- - learner/reviewer UI;
-- - notifications, email, Dashboard project projection, course eligibility;
-- - certificates.

begin;

-- ---------------------------------------------------------------------------
-- Accepted Pass 2B1 hosted identity preflight
-- ---------------------------------------------------------------------------

do $phase07$
declare
  project_policy_count integer;
  rubric_count integer;
  project_row_count bigint;
  b1_function_match_count integer;
  project_trigger_count integer;
  normally_enabled_trigger_count integer;
begin
  if to_regclass('private.project_submission_policies') is null
    or to_regclass('private.project_rubric_criteria') is null
    or to_regclass('private.project_staff_roles') is null
    or to_regclass('private.project_reviewer_assignments') is null
    or to_regclass('public.project_submissions') is null
    or to_regclass('public.project_submission_versions') is null
    or to_regclass('public.project_submission_files') is null
    or to_regclass('public.project_reviews') is null
    or to_regclass('public.project_review_criteria') is null
    or to_regclass('public.project_status_events') is null
  then
    raise exception using
      errcode = '55000',
      message = 'Accepted Phase 07 Pass 2B1 project schema foundation is required';
  end if;

  select count(*) into project_policy_count
  from private.project_submission_policies
  where is_current;

  select count(*) into rubric_count
  from private.project_rubric_criteria;

  if project_policy_count <> 8 or rubric_count <> 40 then
    raise exception using
      errcode = '55000',
      message = 'Accepted Pass 2B1 project policy/rubric identity is invalid';
  end if;

  select count(*)
  into b1_function_match_count
  from (
    values
      ('private.project_submission_transition_is_allowed(text,text)', 'ba8e1f472cbb6fbd4cddf313289778f4'),
      ('private.project_staff_has_role(uuid,text[])', '485a390ee73f0be5645d4401f479dd37'),
      ('private.project_supporting_text_word_count(text)', '59bd8adf81f62386b3c5bdf9a07a722b'),
      ('private.project_version_meets_submission_policy(uuid)', 'fd2f9322adbd13ca9ba2836a53cc14bf'),
      ('private.project_review_is_complete(uuid,text)', '6e925c263e14b35776a7b3c77b36a12c'),
      ('private.stamp_project_staff_role()', 'cc894aa356dcf2095013113685ad85af'),
      ('private.stamp_project_submission()', 'a82fd3909a8fd1db3bd99f37a3acf330'),
      ('private.guard_project_submission_delete()', '440e470774714bcac3b15b1cb63bcd4d'),
      ('private.stamp_project_submission_version()', '90118748556f13f32a3c168053143bf8'),
      ('private.guard_project_version_delete()', '26bcdc98fd890a6c3cd9b0eb4d1bf601'),
      ('private.stamp_project_submission_file()', 'b6867773f5ba18b11489bd508164ead0'),
      ('private.guard_project_file_delete()', '9c10706a072309296f68e1a045300d6d'),
      ('private.stamp_project_reviewer_assignment()', '8f8154de624513ee02a1be063e74c6cd'),
      ('private.stamp_project_review()', 'd6c01cfce04a878791a45533ec91e0b7'),
      ('private.stamp_project_review_criterion()', 'bc20c81c4e52de9486decd1bf515e4ab'),
      ('private.stamp_project_status_event()', '25ce484c63363644c8f490345c549446'),
      ('private.reject_project_immutable_mutation()', 'e7f3a5072ae7a8f00a0d1d7052e6344f')
  ) as expected(signature, expected_md5)
  where pg_catalog.to_regprocedure(expected.signature) is not null
    and pg_catalog.md5(
      pg_catalog.pg_get_functiondef(
        pg_catalog.to_regprocedure(expected.signature)
      )
    ) = expected.expected_md5;

  if b1_function_match_count <> 17 then
    raise exception using
      errcode = '55000',
      message = 'Accepted Pass 2B1 guard-function identity changed';
  end if;

  select
    count(*),
    count(*) filter (where trigger.tgenabled = 'O')
  into
    project_trigger_count,
    normally_enabled_trigger_count
  from pg_catalog.pg_trigger as trigger
  join pg_catalog.pg_class as relation
    on relation.oid = trigger.tgrelid
  join pg_catalog.pg_namespace as namespace
    on namespace.oid = relation.relnamespace
  where not trigger.tgisinternal
    and (
      (
        namespace.nspname = 'private'
        and relation.relname in (
          'project_staff_roles',
          'project_reviewer_assignments'
        )
      )
      or (
        namespace.nspname = 'public'
        and relation.relname in (
          'project_submissions',
          'project_submission_versions',
          'project_submission_files',
          'project_reviews',
          'project_review_criteria',
          'project_status_events'
        )
      )
    );

  if project_trigger_count <> 16
    or normally_enabled_trigger_count <> 16
  then
    raise exception using
      errcode = '55000',
      message = 'Accepted Pass 2B1 trigger identity changed';
  end if;

  select
    (select count(*) from private.project_staff_roles)
    + (select count(*) from private.project_reviewer_assignments)
    + (select count(*) from public.project_submissions)
    + (select count(*) from public.project_submission_versions)
    + (select count(*) from public.project_submission_files)
    + (select count(*) from public.project_reviews)
    + (select count(*) from public.project_review_criteria)
    + (select count(*) from public.project_status_events)
  into project_row_count;

  if project_row_count <> 0 then
    raise exception using
      errcode = '55000',
      message = 'Pass 2B2 requires the clean zero-row project workflow boundary';
  end if;

  if to_regprocedure('public.set_project_staff_role(uuid,text,boolean,uuid)') is not null
    or to_regprocedure('public.create_project_draft(text)') is not null
    or to_regprocedure('public.update_project_draft(uuid,text,text)') is not null
    or to_regprocedure('public.submit_project(uuid)') is not null
    or to_regprocedure('public.create_project_revision_draft(uuid)') is not null
    or to_regprocedure('public.resubmit_project(uuid)') is not null
    or to_regprocedure('public.assign_project_reviewer(uuid,uuid)') is not null
    or to_regprocedure('public.begin_project_review(uuid)') is not null
    or to_regprocedure('public.decide_project_review(uuid,text,text,jsonb)') is not null
  then
    raise exception using
      errcode = '42P07',
      message = 'Phase 07 Pass 2B2 workflow RPCs already exist';
  end if;

  if exists (
    select 1
    from storage.buckets
    where id = 'project-submissions'
  ) then
    raise exception using
      errcode = '55000',
      message = 'Pass 2B2 must run before the private Storage activation pass';
  end if;
end;
$phase07$;

-- ---------------------------------------------------------------------------
-- Trusted service-role staff authority management
-- ---------------------------------------------------------------------------

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

    update private.project_staff_roles
    set active = p_active
    where user_id = p_user_id
      and staff_role = normalized_role;
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

-- ---------------------------------------------------------------------------
-- Learner draft and submission workflows
-- ---------------------------------------------------------------------------

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

  insert into public.project_submissions (
    user_id,
    project_code
  ) values (
    current_user_id,
    normalized_project_code
  ) returning id, current_status
  into found_submission_id, found_submission_status;

  perform pg_catalog.set_config(
    'archstart.project_version_write_authorized',
    'on',
    true
  );

  insert into public.project_submission_versions (
    submission_id
  ) values (
    found_submission_id
  ) returning id, version_number, version_state
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

create or replace function public.update_project_draft(
  p_version_id uuid,
  p_learner_note text,
  p_supporting_text text
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
  normalized_note text := nullif(
    pg_catalog.btrim(coalesce(p_learner_note, '')),
    ''
  );
  normalized_supporting_text text := nullif(
    pg_catalog.btrim(coalesce(p_supporting_text, '')),
    ''
  );
  found_submission_id uuid;
  found_project_code text;
  found_version_number smallint;
  found_version_state text;
  found_submission_status text;
  found_current_version_id uuid;
  old_note text;
  old_supporting_text text;
begin
  if current_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'authenticated user required';
  end if;

  select
    submission.id,
    submission.project_code,
    submission.current_status,
    submission.current_version_id,
    version.version_number,
    version.version_state,
    version.learner_note,
    version.supporting_text
  into
    found_submission_id,
    found_project_code,
    found_submission_status,
    found_current_version_id,
    found_version_number,
    found_version_state,
    old_note,
    old_supporting_text
  from public.project_submission_versions as version
  join public.project_submissions as submission
    on submission.id = version.submission_id
  where version.id = p_version_id
    and version.user_id = current_user_id
  for update of submission, version;

  if found_submission_id is null then
    raise exception using
      errcode = '42501',
      message = 'project draft is not owned by the authenticated user';
  end if;

  if found_version_state <> 'draft' then
    raise exception using
      errcode = '55000',
      message = 'submitted project versions are immutable';
  end if;

  if not (
    (
      found_submission_status = 'draft'
      and found_current_version_id = p_version_id
    )
    or found_submission_status in (
      'revisions_required',
      'not_accepted'
    )
  ) then
    raise exception using
      errcode = '55000',
      message = 'project draft is not editable in the current workflow state';
  end if;

  if old_note is not distinct from normalized_note
    and old_supporting_text is not distinct from normalized_supporting_text
  then
    return query
    select
      found_submission_id,
      p_version_id,
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

  update public.project_submission_versions
  set
    learner_note = normalized_note,
    supporting_text = normalized_supporting_text
  where id = p_version_id;

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
    p_version_id,
    current_user_id,
    'learner',
    'draft_updated',
    found_submission_status,
    found_submission_status,
    pg_catalog.jsonb_build_object(
      'versionNumber',
      found_version_number
    )
  );

  return query
  select
    found_submission_id,
    p_version_id,
    found_project_code,
    found_version_number,
    'draft'::text,
    found_submission_status;
end;
$function$;

create or replace function public.submit_project(
  p_version_id uuid
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
  found_submission_id uuid;
  found_project_code text;
  found_version_number smallint;
  found_version_state text;
  found_submission_status text;
  found_current_version_id uuid;
begin
  if current_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'authenticated user required';
  end if;

  select
    submission.id,
    submission.project_code,
    submission.current_status,
    submission.current_version_id,
    version.version_number,
    version.version_state
  into
    found_submission_id,
    found_project_code,
    found_submission_status,
    found_current_version_id,
    found_version_number,
    found_version_state
  from public.project_submission_versions as version
  join public.project_submissions as submission
    on submission.id = version.submission_id
  where version.id = p_version_id
    and version.user_id = current_user_id
  for update of submission, version;

  if found_submission_id is null then
    raise exception using
      errcode = '42501',
      message = 'project version is not owned by the authenticated user';
  end if;

  if found_version_state = 'submitted'
    and found_submission_status = 'submitted'
    and found_current_version_id = p_version_id
  then
    return query
    select
      found_submission_id,
      p_version_id,
      found_project_code,
      found_version_number,
      found_version_state,
      found_submission_status;
    return;
  end if;

  if found_submission_status <> 'draft'
    or found_current_version_id <> p_version_id
    or found_version_state <> 'draft'
  then
    raise exception using
      errcode = '55000',
      message = 'project is not eligible for its initial submission';
  end if;

  perform pg_catalog.set_config(
    'archstart.project_version_write_authorized',
    'on',
    true
  );
  perform pg_catalog.set_config(
    'archstart.project_version_submit_authorized',
    'on',
    true
  );

  update public.project_submission_versions
  set version_state = 'submitted'
  where id = p_version_id;

  perform pg_catalog.set_config(
    'archstart.project_submission_write_authorized',
    'on',
    true
  );
  perform pg_catalog.set_config(
    'archstart.project_transition_authorized',
    'on',
    true
  );

  update public.project_submissions
  set current_status = 'submitted'
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
    p_version_id,
    current_user_id,
    'learner',
    'submitted',
    'draft',
    'submitted',
    pg_catalog.jsonb_build_object(
      'versionNumber',
      found_version_number
    )
  );

  return query
  select
    found_submission_id,
    p_version_id,
    found_project_code,
    found_version_number,
    'submitted'::text,
    'submitted'::text;
end;
$function$;

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

  insert into public.project_submission_versions (
    submission_id
  ) values (
    p_submission_id
  ) returning id, version_number, version_state
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

create or replace function public.resubmit_project(
  p_version_id uuid
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
  found_submission_id uuid;
  found_project_code text;
  found_version_number smallint;
  found_version_state text;
  found_submission_status text;
  found_current_version_id uuid;
  previous_status text;
begin
  if current_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'authenticated user required';
  end if;

  select
    submission.id,
    submission.project_code,
    submission.current_status,
    submission.current_version_id,
    version.version_number,
    version.version_state
  into
    found_submission_id,
    found_project_code,
    found_submission_status,
    found_current_version_id,
    found_version_number,
    found_version_state
  from public.project_submission_versions as version
  join public.project_submissions as submission
    on submission.id = version.submission_id
  where version.id = p_version_id
    and version.user_id = current_user_id
  for update of submission, version;

  if found_submission_id is null then
    raise exception using
      errcode = '42501',
      message = 'project version is not owned by the authenticated user';
  end if;

  if found_version_state = 'submitted'
    and found_submission_status = 'resubmitted'
    and found_current_version_id = p_version_id
  then
    return query
    select
      found_submission_id,
      p_version_id,
      found_project_code,
      found_version_number,
      found_version_state,
      found_submission_status;
    return;
  end if;

  if found_submission_status not in (
    'revisions_required',
    'not_accepted'
  )
    or found_version_state <> 'draft'
  then
    raise exception using
      errcode = '55000',
      message = 'project is not eligible for resubmission';
  end if;

  previous_status := found_submission_status;

  perform pg_catalog.set_config(
    'archstart.project_version_write_authorized',
    'on',
    true
  );
  perform pg_catalog.set_config(
    'archstart.project_version_submit_authorized',
    'on',
    true
  );

  update public.project_submission_versions
  set version_state = 'submitted'
  where id = p_version_id;

  perform pg_catalog.set_config(
    'archstart.project_submission_write_authorized',
    'on',
    true
  );
  perform pg_catalog.set_config(
    'archstart.project_current_version_write_authorized',
    'on',
    true
  );
  perform pg_catalog.set_config(
    'archstart.project_transition_authorized',
    'on',
    true
  );

  update public.project_submissions
  set
    current_version_id = p_version_id,
    current_status = 'resubmitted'
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
    p_version_id,
    current_user_id,
    'learner',
    'resubmitted',
    previous_status,
    'resubmitted',
    pg_catalog.jsonb_build_object(
      'versionNumber',
      found_version_number
    )
  );

  return query
  select
    found_submission_id,
    p_version_id,
    found_project_code,
    found_version_number,
    'submitted'::text,
    'resubmitted'::text;
end;
$function$;

-- ---------------------------------------------------------------------------
-- Reviewer assignment and review workflows
-- ---------------------------------------------------------------------------

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

  insert into private.project_reviewer_assignments (
    submission_id,
    reviewer_id,
    assigned_by
  ) values (
    p_submission_id,
    p_reviewer_id,
    current_user_id
  ) returning id, assigned_at
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

create or replace function public.begin_project_review(
  p_submission_id uuid
)
returns table (
  submission_id uuid,
  version_id uuid,
  submission_status text
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  current_user_id uuid := (select auth.uid());
  found_version_id uuid;
  found_submission_status text;
  actor_role text;
begin
  if current_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'authenticated user required';
  end if;

  if not private.project_staff_has_role(
    current_user_id,
    array['reviewer', 'admin']::text[]
  ) then
    raise exception using
      errcode = '42501',
      message = 'active reviewer or admin role required';
  end if;

  select submission.current_version_id, submission.current_status
  into found_version_id, found_submission_status
  from public.project_submissions as submission
  where submission.id = p_submission_id
    and exists (
      select 1
      from private.project_reviewer_assignments as assignment
      where assignment.submission_id = submission.id
        and assignment.reviewer_id = current_user_id
        and assignment.released_at is null
    )
  for update;

  if found_version_id is null then
    raise exception using
      errcode = '42501',
      message = 'project review is not assigned to the authenticated user';
  end if;

  if found_submission_status = 'under_review' then
    return query
    select p_submission_id, found_version_id, found_submission_status;
    return;
  end if;

  if found_submission_status not in ('submitted', 'resubmitted') then
    raise exception using
      errcode = '55000',
      message = 'project is not ready to begin review';
  end if;

  actor_role := case
    when private.project_staff_has_role(
      current_user_id,
      array['admin']::text[]
    ) then 'admin'
    else 'reviewer'
  end;

  perform pg_catalog.set_config(
    'archstart.project_submission_write_authorized',
    'on',
    true
  );
  perform pg_catalog.set_config(
    'archstart.project_transition_authorized',
    'on',
    true
  );

  update public.project_submissions
  set current_status = 'under_review'
  where id = p_submission_id;

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
    actor_role,
    'review_started',
    found_submission_status,
    'under_review',
    '{}'::jsonb
  );

  return query
  select p_submission_id, found_version_id, 'under_review'::text;
end;
$function$;

create or replace function public.decide_project_review(
  p_submission_id uuid,
  p_decision text,
  p_summary text,
  p_criteria jsonb
)
returns table (
  submission_id uuid,
  version_id uuid,
  review_id uuid,
  decision text,
  score smallint,
  submission_status text
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  current_user_id uuid := (select auth.uid());
  normalized_decision text := pg_catalog.lower(
    pg_catalog.btrim(coalesce(p_decision, ''))
  );
  normalized_summary text := pg_catalog.btrim(coalesce(p_summary, ''));
  found_version_id uuid;
  found_project_code text;
  found_rubric_version smallint;
  found_submission_status text;
  actor_role text;
  assignment_id uuid;
  existing_review_id uuid;
  existing_reviewer_id uuid;
  existing_decision text;
  existing_summary text;
  existing_score smallint;
  input_count integer;
  distinct_criterion_count integer;
  matched_catalog_count integer;
  invalid_criterion_count integer;
  computed_score integer;
  input_criteria_json jsonb;
  existing_criteria_json jsonb;
begin
  if current_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'authenticated user required';
  end if;

  if not private.project_staff_has_role(
    current_user_id,
    array['reviewer', 'admin']::text[]
  ) then
    raise exception using
      errcode = '42501',
      message = 'active reviewer or admin role required';
  end if;

  if normalized_decision not in (
    'revisions_required',
    'accepted',
    'not_accepted'
  ) then
    raise exception using
      errcode = '22023',
      message = 'invalid project review decision';
  end if;

  if char_length(normalized_summary) not between 1 and 5000 then
    raise exception using
      errcode = '22023',
      message = 'project review summary must contain 1–5000 characters';
  end if;

  if pg_catalog.jsonb_typeof(p_criteria) <> 'array'
    or pg_catalog.jsonb_array_length(p_criteria) <> 5
  then
    raise exception using
      errcode = '22023',
      message = 'project review requires exactly five criterion results';
  end if;

  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(p_criteria) as item(value)
    where pg_catalog.jsonb_typeof(item.value) <> 'object'
  ) then
    raise exception using
      errcode = '22023',
      message = 'every project criterion result must be a JSON object';
  end if;

  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(p_criteria) as item(value)
    cross join lateral pg_catalog.jsonb_object_keys(item.value) as key(name)
    where key.name not in (
      'criterion_number',
      'awarded_points',
      'comment'
    )
  ) then
    raise exception using
      errcode = '22023',
      message = 'project criterion result contains an unsupported field';
  end if;

  -- The row is locked only when the caller is the active assignee or the
  -- immutable review's original reviewer. This avoids cross-submission lock
  -- or existence oracles for other authenticated staff accounts.
  select
    submission.current_version_id,
    submission.current_status,
    version.project_code,
    version.rubric_version
  into
    found_version_id,
    found_submission_status,
    found_project_code,
    found_rubric_version
  from public.project_submissions as submission
  join public.project_submission_versions as version
    on version.id = submission.current_version_id
  where submission.id = p_submission_id
    and (
      exists (
        select 1
        from private.project_reviewer_assignments as assignment
        where assignment.submission_id = submission.id
          and assignment.reviewer_id = current_user_id
          and assignment.released_at is null
      )
      or exists (
        select 1
        from public.project_reviews as review
        where review.version_id = version.id
          and review.reviewer_id = current_user_id
      )
    )
  for update of submission, version;

  if found_version_id is null then
    raise exception using
      errcode = '42501',
      message = 'project review is not authorized for the authenticated user';
  end if;

  select
    review.id,
    review.reviewer_id,
    review.decision,
    review.summary,
    review.score
  into
    existing_review_id,
    existing_reviewer_id,
    existing_decision,
    existing_summary,
    existing_score
  from public.project_reviews as review
  where review.version_id = found_version_id;

  if existing_review_id is null then
    select assignment.id
    into assignment_id
    from private.project_reviewer_assignments as assignment
    where assignment.submission_id = p_submission_id
      and assignment.reviewer_id = current_user_id
      and assignment.released_at is null
    for update;

    if assignment_id is null then
      raise exception using
        errcode = '42501',
        message = 'project review is not assigned to the authenticated user';
    end if;

    if found_submission_status <> 'under_review' then
      raise exception using
        errcode = '55000',
        message = 'project decision requires an active review';
    end if;
  elsif existing_reviewer_id <> current_user_id then
    raise exception using
      errcode = '42501',
      message = 'project review is not owned by the authenticated reviewer';
  end if;

  with input as (
    select
      record.criterion_number,
      record.awarded_points,
      nullif(
        pg_catalog.btrim(coalesce(record.comment, '')),
        ''
      ) as comment
    from pg_catalog.jsonb_to_recordset(p_criteria) as record(
      criterion_number smallint,
      awarded_points smallint,
      comment text
    )
  ), checked as (
    select
      input.criterion_number,
      input.awarded_points,
      input.comment,
      catalog.max_points
    from input
    left join private.project_rubric_criteria as catalog
      on catalog.project_code = found_project_code
      and catalog.rubric_version = found_rubric_version
      and catalog.criterion_number = input.criterion_number
  )
  select
    count(*),
    count(distinct criterion_number),
    count(max_points),
    count(*) filter (
      where criterion_number is null
        or awarded_points is null
        or max_points is null
        or awarded_points < 0
        or awarded_points > max_points
        or (comment is not null and char_length(comment) > 2000)
    ),
    coalesce(sum(awarded_points), 0),
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'criterion_number', criterion_number,
        'awarded_points', awarded_points,
        'comment', comment
      ) order by criterion_number
    )
  into
    input_count,
    distinct_criterion_count,
    matched_catalog_count,
    invalid_criterion_count,
    computed_score,
    input_criteria_json
  from checked;

  if input_count <> 5
    or distinct_criterion_count <> 5
    or matched_catalog_count <> 5
    or invalid_criterion_count <> 0
  then
    raise exception using
      errcode = '22023',
      message = 'project criterion results do not match the active five-criterion rubric';
  end if;

  if existing_review_id is not null then
    select pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'criterion_number', criterion.criterion_number,
        'awarded_points', criterion.awarded_points,
        'comment', nullif(
          pg_catalog.btrim(coalesce(criterion.comment, '')),
          ''
        )
      ) order by criterion.criterion_number
    )
    into existing_criteria_json
    from public.project_review_criteria as criterion
    where criterion.review_id = existing_review_id;

    if existing_decision = normalized_decision
      and existing_summary = normalized_summary
      and existing_score = computed_score
      and existing_criteria_json = input_criteria_json
      and found_submission_status = normalized_decision
    then
      return query
      select
        p_submission_id,
        found_version_id,
        existing_review_id,
        existing_decision,
        existing_score,
        found_submission_status;
      return;
    end if;

    raise exception using
      errcode = '55000',
      message = 'a different immutable review already exists for this project version';
  end if;

  actor_role := case
    when private.project_staff_has_role(
      current_user_id,
      array['admin']::text[]
    ) then 'admin'
    else 'reviewer'
  end;

  perform pg_catalog.set_config(
    'archstart.project_review_write_authorized',
    'on',
    true
  );

  insert into public.project_reviews (
    version_id,
    reviewer_id,
    decision,
    summary,
    score,
    rubric_version
  ) values (
    found_version_id,
    current_user_id,
    normalized_decision,
    normalized_summary,
    computed_score,
    found_rubric_version
  ) returning id into existing_review_id;

  insert into public.project_review_criteria (
    review_id,
    criterion_number,
    criterion_title_snapshot,
    criterion_description_snapshot,
    max_points,
    awarded_points,
    comment
  )
  select
    existing_review_id,
    record.criterion_number,
    'database-owned',
    'database-owned',
    1,
    record.awarded_points,
    nullif(
      pg_catalog.btrim(coalesce(record.comment, '')),
      ''
    )
  from pg_catalog.jsonb_to_recordset(p_criteria) as record(
    criterion_number smallint,
    awarded_points smallint,
    comment text
  )
  order by record.criterion_number;

  perform pg_catalog.set_config(
    'archstart.project_submission_write_authorized',
    'on',
    true
  );
  perform pg_catalog.set_config(
    'archstart.project_transition_authorized',
    'on',
    true
  );

  update public.project_submissions
  set current_status = normalized_decision
  where id = p_submission_id;

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
    actor_role,
    normalized_decision,
    'under_review',
    normalized_decision,
    pg_catalog.jsonb_build_object('score', computed_score)
  );

  if normalized_decision = 'accepted' then
    perform pg_catalog.set_config(
      'archstart.project_assignment_write_authorized',
      'on',
      true
    );

    update private.project_reviewer_assignments
    set released_at = now()
    where id = assignment_id;

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
      actor_role,
      'assignment_released',
      'accepted',
      'accepted',
      pg_catalog.jsonb_build_object('reason', 'accepted')
    );
  end if;

  return query
  select
    p_submission_id,
    found_version_id,
    existing_review_id,
    normalized_decision,
    computed_score::smallint,
    normalized_decision;
end;
$function$;

-- ---------------------------------------------------------------------------
-- Function privileges: RPCs are the only activated write surface
-- ---------------------------------------------------------------------------

revoke all on function
  public.set_project_staff_role(uuid, text, boolean, uuid),
  public.create_project_draft(text),
  public.update_project_draft(uuid, text, text),
  public.submit_project(uuid),
  public.create_project_revision_draft(uuid),
  public.resubmit_project(uuid),
  public.assign_project_reviewer(uuid, uuid),
  public.begin_project_review(uuid),
  public.decide_project_review(uuid, text, text, jsonb)
from public, anon, authenticated, service_role;

grant execute on function
  public.create_project_draft(text),
  public.update_project_draft(uuid, text, text),
  public.submit_project(uuid),
  public.create_project_revision_draft(uuid),
  public.resubmit_project(uuid),
  public.assign_project_reviewer(uuid, uuid),
  public.begin_project_review(uuid),
  public.decide_project_review(uuid, text, text, jsonb)
to authenticated;

grant execute on function
  public.set_project_staff_role(uuid, text, boolean, uuid)
to service_role;

comment on function public.set_project_staff_role(uuid, text, boolean, uuid) is
  'Service-role-only project reviewer/admin authority management. First admin bootstrap remains an explicit trusted-server action.';

comment on function public.create_project_draft(text) is
  'Authenticated learner creates or idempotently reuses the one initial project draft.';

comment on function public.update_project_draft(uuid, text, text) is
  'Authenticated learner updates note/supporting text on an owned editable draft only.';

comment on function public.submit_project(uuid) is
  'Authenticated learner submits the owned initial draft after file and 5/5 lesson prerequisites pass.';

comment on function public.create_project_revision_draft(uuid) is
  'Authenticated learner creates or reuses one revision draft after revisions_required or not_accepted.';

comment on function public.resubmit_project(uuid) is
  'Authenticated learner locks the revision version and atomically promotes it as the resubmitted current version.';

comment on function public.assign_project_reviewer(uuid, uuid) is
  'Active project admin idempotently assigns or reassigns an active reviewer without exposing reviewer identity to learner rows.';

comment on function public.begin_project_review(uuid) is
  'Assigned active reviewer/admin moves submitted or resubmitted work into under_review.';

comment on function public.decide_project_review(uuid, text, text, jsonb) is
  'Assigned reviewer/admin atomically records five rubric criteria, computes score, stores immutable review, transitions status, and never derives acceptance from a score threshold.';

-- ---------------------------------------------------------------------------
-- Postcondition checks
-- ---------------------------------------------------------------------------

do $phase07$
declare
  workflow_function_count integer;
  authenticated_execute_count integer;
  anon_execute_count integer;
  service_role_staff_execute boolean;
  unauthorized_browser_dml boolean;
begin
  select count(*) into workflow_function_count
  from pg_proc as procedure
  join pg_namespace as namespace
    on namespace.oid = procedure.pronamespace
  where namespace.nspname = 'public'
    and procedure.proname in (
      'set_project_staff_role',
      'create_project_draft',
      'update_project_draft',
      'submit_project',
      'create_project_revision_draft',
      'resubmit_project',
      'assign_project_reviewer',
      'begin_project_review',
      'decide_project_review'
    );

  if workflow_function_count <> 9 then
    raise exception using
      errcode = '55000',
      message = 'Pass 2B2 must create exactly nine workflow RPCs';
  end if;

  select count(*) into authenticated_execute_count
  from pg_proc as procedure
  join pg_namespace as namespace
    on namespace.oid = procedure.pronamespace
  where namespace.nspname = 'public'
    and procedure.proname in (
      'create_project_draft',
      'update_project_draft',
      'submit_project',
      'create_project_revision_draft',
      'resubmit_project',
      'assign_project_reviewer',
      'begin_project_review',
      'decide_project_review'
    )
    and has_function_privilege(
      'authenticated',
      procedure.oid,
      'EXECUTE'
    );

  select count(*) into anon_execute_count
  from pg_proc as procedure
  join pg_namespace as namespace
    on namespace.oid = procedure.pronamespace
  where namespace.nspname = 'public'
    and procedure.proname in (
      'set_project_staff_role',
      'create_project_draft',
      'update_project_draft',
      'submit_project',
      'create_project_revision_draft',
      'resubmit_project',
      'assign_project_reviewer',
      'begin_project_review',
      'decide_project_review'
    )
    and has_function_privilege(
      'anon',
      procedure.oid,
      'EXECUTE'
    );

  service_role_staff_execute := has_function_privilege(
    'service_role',
    'public.set_project_staff_role(uuid,text,boolean,uuid)',
    'EXECUTE'
  );

  unauthorized_browser_dml :=
    has_table_privilege(
      'authenticated',
      'public.project_submissions',
      'INSERT'
    )
    or has_table_privilege(
      'authenticated',
      'public.project_submission_versions',
      'UPDATE'
    )
    or has_table_privilege(
      'authenticated',
      'public.project_reviews',
      'INSERT'
    );

  if authenticated_execute_count <> 8
    or anon_execute_count <> 0
    or service_role_staff_execute is not true
    or unauthorized_browser_dml is true
    or has_function_privilege(
      'authenticated',
      'public.set_project_staff_role(uuid,text,boolean,uuid)',
      'EXECUTE'
    )
  then
    raise exception using
      errcode = '42501',
      message = 'Pass 2B2 workflow privilege boundary is invalid';
  end if;

  if exists (
    select 1
    from pg_proc as procedure
    join pg_namespace as namespace
      on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and procedure.proname in (
        'set_project_staff_role',
        'create_project_draft',
        'update_project_draft',
        'submit_project',
        'create_project_revision_draft',
        'resubmit_project',
        'assign_project_reviewer',
        'begin_project_review',
        'decide_project_review'
      )
      and (
        procedure.prosecdef is not true
        or procedure.proconfig is distinct from array['search_path=""']::text[]
      )
  ) then
    raise exception using
      errcode = '42501',
      message = 'workflow RPCs must be security-definer functions with an empty search_path';
  end if;

  if exists (
    select 1
    from storage.buckets
    where id = 'project-submissions'
  )
    or exists (
      select 1
      from pg_policies
      where schemaname = 'storage'
        and tablename = 'objects'
        and (
          policyname ~* 'project'
          or coalesce(qual, '') ~* 'project-submissions'
          or coalesce(with_check, '') ~* 'project-submissions'
        )
    )
  then
    raise exception using
      errcode = '55000',
      message = 'Pass 2B2 must not activate project Storage';
  end if;

  if (
    select
      (select count(*) from private.project_staff_roles)
      + (select count(*) from private.project_reviewer_assignments)
      + (select count(*) from public.project_submissions)
      + (select count(*) from public.project_submission_versions)
      + (select count(*) from public.project_submission_files)
      + (select count(*) from public.project_reviews)
      + (select count(*) from public.project_review_criteria)
      + (select count(*) from public.project_status_events)
  ) <> 0 then
    raise exception using
      errcode = '55000',
      message = 'Pass 2B2 migration must not create project workflow rows';
  end if;
end;
$phase07$;

commit;
