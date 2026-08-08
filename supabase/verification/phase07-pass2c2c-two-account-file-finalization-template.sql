-- ARCH.START Phase 07.2C2C — rollback-only two-account runtime template
-- Replace USER_A_UUID and USER_B_UUID with two clean auth.users UUIDs.
-- Run once as postgres. The inner subtransaction intentionally rolls back all
-- inserted rows. Any external harness object must use temporary_object_path;
-- delete it through the Storage API before the rollback sentinel. The exact
-- metadata path is also deleted idempotently below and verified absent.
-- This template is rollback-only database evidence. It is not live Storage
-- object cleanup acceptance and does not substitute for later hosted testing.

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
  finalizer_definition text := pg_catalog.pg_get_functiondef(
    pg_catalog.to_regprocedure(
      'public.finalize_project_upload_intent(uuid,uuid,text,bigint,text,smallint,integer,integer)'
    )
  );
  cleanup_definition text := pg_catalog.pg_get_functiondef(
    pg_catalog.to_regprocedure(
      'public.list_stale_project_upload_intents(uuid,integer)'
    )
  );
begin
  if pg_catalog.strpos(finalizer_definition,
      'select candidate.version_id into pre_read_version_id') = 0
    or pg_catalog.strpos(finalizer_definition,
      'select candidate.version_id into pre_read_version_id')
      >= pg_catalog.strpos(finalizer_definition,
        'perform pg_catalog.pg_advisory_xact_lock')
    or finalizer_definition not like
      '%pg_catalog.hashtext(pre_read_version_id::text)%'
    or pg_catalog.strpos(finalizer_definition,
      'select version_candidate.* into version_row') = 0
    or pg_catalog.strpos(finalizer_definition,
      'select version_candidate.* into version_row')
      >= pg_catalog.strpos(finalizer_definition,
        'select candidate.* into intent_row')
    or finalizer_definition not like
      '%intent_row.version_id is distinct from pre_read_version_id%'
    or finalizer_definition not like
      '%intent_row.submission_id is distinct from version_row.submission_id%'
  then
    raise exception using errcode = 'P7R11', message = 'R1 finalizer lock contract failed';
  end if;

  if cleanup_definition not like
      '%intent_row.state in (''pending'', ''expired'', ''cancelled'')%'
    or cleanup_definition not like '%from storage.objects as object_row%'
    or cleanup_definition not like
      '%object_row.name = intent_row.object_path%'
    or cleanup_definition not like
      '%file_row.id = intent_row.planned_file_id%'
    or cleanup_definition not like
      '%file_row.object_path = intent_row.object_path%'
    or cleanup_definition like
      '%file_row.version_id = intent_row.version_id%'
  then
    raise exception using errcode = 'P7R12', message = 'R1 orphan selector contract failed';
  end if;

  if user_a = user_b
    or (select count(*) from auth.users where id in (user_a, user_b)) <> 2
  then
    raise exception using errcode = '22023', message = 'two distinct existing users are required';
  end if;

  if exists (
    select 1 from public.project_submissions where user_id in (user_a, user_b)
  ) or exists (
    select 1 from private.project_staff_roles
    where user_id in (user_a, user_b) or granted_by in (user_a, user_b)
  ) then
    raise exception using errcode = '55000', message = 'test users must start with no project rows';
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

    perform pg_catalog.set_config('archstart.project_staff_write_authorized', 'on', true);
    insert into private.project_staff_roles (
      user_id, staff_role, active, granted_by
    ) values (
      user_b, 'reviewer', true, user_b
    );

    select count(*) into unassigned_reviewer_download_count
    from public.authorize_project_file_download(finalized_a.file_id, user_b);

    perform pg_catalog.set_config('archstart.project_assignment_write_authorized', 'on', true);
    insert into private.project_reviewer_assignments (
      submission_id, reviewer_id, assigned_by
    ) values (
      draft_a.submission_id, user_b, user_b
    );

    select count(*) into assigned_download_count
    from public.authorize_project_file_download(finalized_a.file_id, user_b);

    update private.project_reviewer_assignments
    set released_at = now()
    where submission_id = draft_a.submission_id
      and reviewer_id = user_b
      and released_at is null;

    select count(*) into released_reviewer_download_count
    from public.authorize_project_file_download(finalized_a.file_id, user_b);

    insert into private.project_staff_roles (
      user_id, staff_role, active, granted_by
    ) values (
      user_b, 'admin', true, user_b
    );

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

    -- Exact-path, idempotent metadata cleanup. A real object created by an
    -- external harness must already have been removed through the Storage API.
    delete from storage.objects
    where bucket_id = 'project-submissions'
      and name = temporary_object_path;

    if exists (
      select 1 from storage.objects
      where bucket_id = 'project-submissions'
        and name = temporary_object_path
    ) then
      raise exception using errcode = 'P7C05', message = 'temporary object cleanup failed';
    end if;

    raise exception using
      errcode = 'P7R2C',
      message = 'ARCHSTART_PHASE07_PASS2C2C_ROLLBACK_SENTINEL';
  exception
    when sqlstate 'P7R2C' then null;
  end;

  perform pg_catalog.set_config('request.jwt.claims', '{}', true);

  if exists (
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
    raise exception using errcode = 'P7D2C', message = 'Phase 07.2C2C rollback cleanup failed';
  end if;

  raise notice 'PHASE07_PASS2C2C_TWO_ACCOUNT_RUNTIME=PASS';
  raise notice 'PLANNED_FILE_ID_AND_IDEMPOTENCY=PASS';
  raise notice 'OWNER_ASSIGNED_REVIEWER_ADMIN_MATRIX=PASS';
  raise notice 'OTHER_LEARNER_DENIAL=PASS';
  raise notice 'UNASSIGNED_AND_RELEASED_REVIEWER_DENIAL=PASS';
  raise notice 'TEMPORARY_OBJECT_AND_ROWS_ROLLED_BACK=PASS';
  raise notice 'R1_ORPHAN_SELECTOR_AND_LOCK_ORDER_SOURCE_CONTRACT=PASS';
  raise notice 'LIVE_OBJECT_CLEANUP_ACCEPTANCE=NOT_RUN';
end;
$phase07$;
