-- ARCH.START Phase 07.2C2C-R1E6 — rollback-only two-account database runtime template
-- Replace USER_A_UUID and USER_B_UUID with two clean auth.users UUIDs.
-- Run once as postgres. No source introspection; no direct Storage-table DML.
-- The inner subtransaction intentionally rolls back every inserted database row.
-- This database-only harness does NOT upload a real Storage object. Supabase
-- protects storage.objects from direct DELETE; real object cleanup must use the
-- Storage API and remains a separate live acceptance step. This query only
-- verifies that no object exists at the reserved exact path.

do $phase07$
declare
  user_a uuid := 'USER_A_UUID'::uuid;
  user_b uuid := 'USER_B_UUID'::uuid;
  draft_a record;
  intent_a record;
  context_a record;
  finalized_a record;
  finalized_retry record;
  owner_download_count integer;
  denied_download_count integer;
  unassigned_reviewer_download_count integer;
  assigned_download_count integer;
  released_reviewer_download_count integer;
  admin_download_count integer;
  temporary_object_path text;
begin
  -- Function-body and privilege identity is a separate prerequisite proven by
  -- the accepted hosted function-catalog diagnostic. This rollback runtime
  -- deliberately performs no function-source introspection.

  if user_a = user_b
    or (select count(*) from auth.users where id in (user_a, user_b)) <> 2
  then
    raise exception using errcode = '22023', message = 'two distinct existing users are required';
  end if;

  if exists (
    select 1 from public.lesson_activity where user_id in (user_a, user_b)
  ) or exists (
    select 1 from public.lesson_completions where user_id in (user_a, user_b)
  ) or exists (
    select 1 from public.module_completions where user_id in (user_a, user_b)
  ) or exists (
    select 1 from public.quiz_attempts where user_id in (user_a, user_b)
  ) or exists (
    select 1 from public.project_submissions where user_id in (user_a, user_b)
  ) or exists (
    select 1 from private.project_staff_roles
    where user_id in (user_a, user_b) or granted_by in (user_a, user_b)
  ) or exists (
    select 1 from private.project_reviewer_assignments
    where reviewer_id in (user_a, user_b) or assigned_by in (user_a, user_b)
  ) then
    raise exception using
      errcode = '55000',
      message = 'test users must start with no progress, project, staff, or assignment rows';
  end if;

  begin
    perform pg_catalog.set_config(
      'request.jwt.claims',
      pg_catalog.jsonb_build_object('role', 'authenticated', 'sub', user_a::text)::text,
      true
    );

    select * into draft_a from public.create_project_draft('M01_P01');
    select * into intent_a
    from public.create_project_upload_intent(
      draft_a.version_id,
      'phase07-2c2c-board.png',
      'image/png',
      1024
    );
    temporary_object_path := intent_a.object_path;

    select * into context_a
    from public.get_project_upload_finalization_context(
      intent_a.intent_id,
      user_a
    );

    if context_a.context_status <> 'inspect'
      or context_a.object_path <> temporary_object_path
      or context_a.planned_file_id <> intent_a.planned_file_id
    then
      raise exception using errcode = 'P7C01', message = 'trusted context contract failed';
    end if;

    if (
      select count(*)
      from public.get_project_upload_finalization_context(intent_a.intent_id, user_b)
    ) <> 0 then
      raise exception using errcode = 'P7C02', message = 'cross-account context was disclosed';
    end if;

    select * into finalized_a
    from public.finalize_project_upload_intent(
      intent_a.intent_id,
      user_a,
      pg_catalog.repeat('a', 64),
      1024,
      'image/png',
      null,
      1920,
      1080
    );
    select * into finalized_retry
    from public.finalize_project_upload_intent(
      intent_a.intent_id,
      user_a,
      pg_catalog.repeat('a', 64),
      1024,
      'image/png',
      null,
      1920,
      1080
    );

    if finalized_a.file_id <> intent_a.planned_file_id
      or finalized_a.reused
      or finalized_retry.file_id <> finalized_a.file_id
      or finalized_retry.reused is not true
      or (select count(*) from public.project_submission_files where version_id = draft_a.version_id) <> 1
    then
      raise exception using errcode = 'P7C03', message = 'idempotent finalization contract failed';
    end if;

    select count(*) into owner_download_count
    from public.authorize_project_file_download(finalized_a.file_id, user_a);
    select count(*) into denied_download_count
    from public.authorize_project_file_download(finalized_a.file_id, user_b);

    insert into public.quiz_attempts (
      user_id,
      lesson_code,
      selected_answers,
      score,
      question_count,
      answer_key_sha256
    )
    select
      user_a,
      'M01_L0' || lesson_number::text,
      '{"Q01":"A","Q02":"B","Q03":"C","Q04":"D","Q05":"A"}'::jsonb,
      0,
      5,
      pg_catalog.repeat('b', 64)
    from pg_catalog.generate_series(1, 5) as lesson_number;

    insert into public.lesson_completions (user_id, lesson_code)
    select user_a, 'M01_L0' || lesson_number::text
    from pg_catalog.generate_series(1, 5) as lesson_number;

    perform 1 from public.submit_project(draft_a.version_id);

    -- The assignment trigger requires assigned_by to hold an active admin
    -- role at INSERT time. User A is therefore provisioned as the temporary
    -- admin grantor before User B is provisioned as reviewer. Both rows are
    -- inside this rollback-only subtransaction.
    perform pg_catalog.set_config('archstart.project_staff_write_authorized', 'on', true);
    insert into private.project_staff_roles (
      user_id, staff_role, active, granted_by
    ) values
      (user_a, 'admin', true, user_a),
      (user_b, 'reviewer', true, user_a);

    if not private.project_staff_has_role(
      user_a,
      array['admin']::text[]
    ) or not private.project_staff_has_role(
      user_b,
      array['reviewer']::text[]
    ) then
      raise exception using
        errcode = 'P7C06',
        message = 'temporary admin/reviewer role setup failed';
    end if;

    select count(*) into unassigned_reviewer_download_count
    from public.authorize_project_file_download(finalized_a.file_id, user_b);

    perform pg_catalog.set_config('archstart.project_assignment_write_authorized', 'on', true);
    insert into private.project_reviewer_assignments (
      submission_id, reviewer_id, assigned_by
    ) values (
      draft_a.submission_id, user_b, user_a
    );

    if not exists (
      select 1
      from private.project_reviewer_assignments as assignment
      where assignment.submission_id = draft_a.submission_id
        and assignment.reviewer_id = user_b
        and assignment.assigned_by = user_a
        and assignment.released_at is null
    ) then
      raise exception using
        errcode = 'P7C07',
        message = 'active reviewer assignment was not created';
    end if;

    select count(*) into assigned_download_count
    from public.authorize_project_file_download(finalized_a.file_id, user_b);

    update private.project_reviewer_assignments
    set released_at = now()
    where submission_id = draft_a.submission_id
      and reviewer_id = user_b
      and released_at is null;

    if exists (
      select 1
      from private.project_reviewer_assignments as assignment
      where assignment.submission_id = draft_a.submission_id
        and assignment.reviewer_id = user_b
        and assignment.released_at is null
    ) then
      raise exception using
        errcode = 'P7C08',
        message = 'reviewer assignment release failed';
    end if;

    select count(*) into released_reviewer_download_count
    from public.authorize_project_file_download(finalized_a.file_id, user_b);

    insert into private.project_staff_roles (
      user_id, staff_role, active, granted_by
    ) values (
      user_b, 'admin', true, user_a
    );

    if not private.project_staff_has_role(
      user_b,
      array['admin']::text[]
    ) then
      raise exception using
        errcode = 'P7C09',
        message = 'temporary admin role setup failed';
    end if;

    select count(*) into admin_download_count
    from public.authorize_project_file_download(finalized_a.file_id, user_b);

    if owner_download_count <> 1
      or denied_download_count <> 0
      or unassigned_reviewer_download_count <> 0
      or assigned_download_count <> 1
      or released_reviewer_download_count <> 0
      or admin_download_count <> 1
    then
      raise exception using errcode = 'P7C04', message = 'download authorization matrix failed';
    end if;

    -- This is a database-only rollback harness: no real Storage object was
    -- uploaded. Direct mutation of the protected Storage metadata table is
    -- intentionally forbidden and must never be attempted here. A real object,
    -- present, is a hard STOP and must later be removed through the Storage API.
    if exists (
      select 1 from storage.objects
      where bucket_id = 'project-submissions'
        and name = temporary_object_path
    ) then
      raise exception using
        errcode = 'P7C05',
        message = 'unexpected Storage object exists in database-only runtime';
    end if;

    raise exception using
      errcode = 'P7R2C',
      message = 'ARCHSTART_PHASE07_PASS2C2C_ROLLBACK_SENTINEL';
  exception
    when sqlstate 'P7R2C' then null;
  end;

  perform pg_catalog.set_config('request.jwt.claims', '{}', true);

  if exists (
    select 1 from public.lesson_activity where user_id in (user_a, user_b)
  ) or exists (
    select 1 from public.lesson_completions where user_id in (user_a, user_b)
  ) or exists (
    select 1 from public.module_completions where user_id in (user_a, user_b)
  ) or exists (
    select 1 from public.quiz_attempts where user_id in (user_a, user_b)
  ) or exists (
    select 1 from public.project_submissions where user_id in (user_a, user_b)
  ) or exists (
    select 1 from public.project_submission_versions where user_id in (user_a, user_b)
  ) or exists (
    select 1 from public.project_submission_files where user_id in (user_a, user_b)
  ) or exists (
    select 1 from private.project_upload_intents where user_id in (user_a, user_b)
  ) or exists (
    select 1 from private.project_staff_roles
    where user_id in (user_a, user_b) or granted_by in (user_a, user_b)
  ) or exists (
    select 1 from private.project_reviewer_assignments
    where reviewer_id in (user_a, user_b) or assigned_by in (user_a, user_b)
  ) or exists (
    select 1 from storage.objects
    where bucket_id = 'project-submissions'
      and name = temporary_object_path
  ) then
    raise exception using
      errcode = 'P7D2C',
      message = 'Phase 07.2C2C rollback cleanup failed';
  end if;

  raise notice 'PHASE07_PASS2C2C_TWO_ACCOUNT_RUNTIME=PASS';
  raise notice 'PLANNED_FILE_ID_AND_IDEMPOTENCY=PASS';
  raise notice 'OWNER_ASSIGNED_REVIEWER_ADMIN_MATRIX=PASS';
  raise notice 'ACTIVE_ADMIN_ASSIGNMENT_AUTHORITY=PASS';
  raise notice 'OTHER_LEARNER_DENIAL=PASS';
  raise notice 'UNASSIGNED_AND_RELEASED_REVIEWER_DENIAL=PASS';
  raise notice 'TEMPORARY_OBJECT_AND_ROWS_ROLLED_BACK=PASS';
  raise notice 'LIVE_OBJECT_CLEANUP_ACCEPTANCE=NOT_RUN';
end;
$phase07$;
