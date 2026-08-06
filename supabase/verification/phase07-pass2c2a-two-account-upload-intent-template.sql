-- ARCH.START Phase 07.2C2A — two-account upload-intent runtime template
-- Replace USER_A_UUID and USER_B_UUID with two real auth.users UUIDs.
-- Run the entire file once as postgres. Its inner subtransaction is
-- intentionally rolled back; the final visible row must contain only zeros
-- except project_bucket_count_after_rollback = 1.

do $phase07$
declare
  user_a uuid := 'USER_A_UUID'::uuid;
  user_b uuid := 'USER_B_UUID'::uuid;
  draft_a record;
  draft_b record;
  standard_a record;
  standard_a_retry record;
  tus_a record;
  intent_b record;
  cancelled_a record;
  blocked_cross_account boolean := false;
  upload_intents_after_rollback bigint;
  staff_roles_after_rollback bigint;
  reviewer_assignments_after_rollback bigint;
  submissions_after_rollback bigint;
  versions_after_rollback bigint;
  status_events_after_rollback bigint;
  project_files_after_rollback bigint;
  reviews_after_rollback bigint;
  review_criteria_after_rollback bigint;
  project_objects_after_rollback bigint;
  project_bucket_count_after_rollback bigint;
begin
  if user_a = user_b then
    raise exception using
      errcode = '22023',
      message = 'two distinct users are required';
  end if;

  if (
    select count(*)
    from auth.users
    where id in (user_a, user_b)
  ) <> 2 then
    raise exception using
      errcode = '23503',
      message = 'both test UUIDs must exist in auth.users';
  end if;

  if exists (
    select 1
    from private.project_upload_intents
    where user_id in (user_a, user_b)
  )
    or exists (
      select 1
      from private.project_staff_roles
      where user_id in (user_a, user_b)
        or granted_by in (user_a, user_b)
    )
    or exists (
      select 1
      from private.project_reviewer_assignments
      where reviewer_id in (user_a, user_b)
        or assigned_by in (user_a, user_b)
    )
    or exists (
      select 1
      from public.project_submissions
      where user_id in (user_a, user_b)
    )
    or exists (
      select 1
      from public.project_submission_versions
      where user_id in (user_a, user_b)
    )
    or exists (
      select 1
      from public.project_submission_files
      where user_id in (user_a, user_b)
    )
    or exists (
      select 1
      from public.project_reviews
      where user_id in (user_a, user_b)
        or reviewer_id in (user_a, user_b)
    )
    or exists (
      select 1
      from public.project_status_events
      where user_id in (user_a, user_b)
        or actor_id in (user_a, user_b)
    )
    or exists (
      select 1
      from public.project_review_criteria
      where user_id in (user_a, user_b)
    )
  then
    raise exception using
      errcode = '55000',
      message = 'test users must begin with no project workflow rows';
  end if;

  begin
    perform pg_catalog.set_config(
      'request.jwt.claims',
      pg_catalog.jsonb_build_object(
        'role', 'authenticated',
        'sub', user_a::text
      )::text,
      true
    );

    select * into draft_a
    from public.create_project_draft('M01_P01');

    select * into standard_a
    from public.create_project_upload_intent(
      draft_a.version_id,
      'space-reading-board.png',
      'image/png',
      5242880
    );

    select * into standard_a_retry
    from public.create_project_upload_intent(
      draft_a.version_id,
      'space-reading-board.png',
      'image/png',
      5242880
    );

    if standard_a.intent_id is distinct from standard_a_retry.intent_id
      or standard_a_retry.reused is not true
      or standard_a.transfer_mode <> 'standard'
      or standard_a.intent_state <> 'pending'
      or standard_a.bucket_id <> 'project-submissions'
      or standard_a.object_path <> (
        user_a::text || '/' ||
        draft_a.submission_id::text || '/' ||
        draft_a.version_id::text || '/' ||
        standard_a.planned_file_id::text || '.png'
      )
      or pg_catalog.strpos(
        standard_a.object_path,
        'space-reading-board.png'
      ) <> 0
      or standard_a.expires_at < now() + interval '119 minutes'
      or standard_a.expires_at > now() + interval '121 minutes'
    then
      raise exception using
        errcode = 'P7A01',
        message = 'standard upload-intent or idempotent retry contract failed';
    end if;

    select * into tus_a
    from public.create_project_upload_intent(
      draft_a.version_id,
      'space-reading-board-v2.pdf',
      'application/pdf',
      10485760
    );

    if tus_a.intent_id = standard_a.intent_id
      or tus_a.transfer_mode <> 'tus'
      or tus_a.reused is not false
      or not exists (
        select 1
        from private.project_upload_intents as intent_row
        where intent_row.id = standard_a.intent_id
          and intent_row.state = 'cancelled'
          and intent_row.closed_reason = 'superseded_by_new_intent'
      )
    then
      raise exception using
        errcode = 'P7A02',
        message = 'changed-request replacement contract failed';
    end if;

    perform pg_catalog.set_config(
      'request.jwt.claims',
      pg_catalog.jsonb_build_object(
        'role', 'authenticated',
        'sub', user_b::text
      )::text,
      true
    );

    begin
      perform public.cancel_project_upload_intent(tus_a.intent_id);
    exception
      when insufficient_privilege then
        blocked_cross_account := true;
    end;

    if blocked_cross_account is not true then
      raise exception using
        errcode = 'P7A03',
        message = 'cross-account upload-intent cancellation was not blocked';
    end if;

    select * into draft_b
    from public.create_project_draft('M01_P01');

    select * into intent_b
    from public.create_project_upload_intent(
      draft_b.version_id,
      'user-b-board.png',
      'image/png',
      1024
    );

    if intent_b.intent_state <> 'pending'
      or intent_b.object_path !~ ('^' || user_b::text || '/')
    then
      raise exception using
        errcode = 'P7A04',
        message = 'second-account upload-intent contract failed';
    end if;

    perform pg_catalog.set_config(
      'request.jwt.claims',
      pg_catalog.jsonb_build_object(
        'role', 'authenticated',
        'sub', user_a::text
      )::text,
      true
    );

    select * into cancelled_a
    from public.cancel_project_upload_intent(tus_a.intent_id);

    if cancelled_a.intent_state <> 'cancelled'
      or cancelled_a.closed_reason <> 'learner_cancelled'
      or cancelled_a.closed_at is null
    then
      raise exception using
        errcode = 'P7A05',
        message = 'learner cancellation contract failed';
    end if;

    -- Roll back every test row while preserving PL/pgSQL variable values.
    raise exception using
      errcode = 'P7R01',
      message = 'ARCHSTART_PHASE07_PASS2C2A_ROLLBACK_SENTINEL';
  exception
    when sqlstate 'P7R01' then
      null;
  end;

  perform pg_catalog.set_config('request.jwt.claims', '{}', true);

  select count(*) into upload_intents_after_rollback
  from private.project_upload_intents
  where user_id in (user_a, user_b);

  select count(*) into staff_roles_after_rollback
  from private.project_staff_roles
  where user_id in (user_a, user_b)
    or granted_by in (user_a, user_b);

  select count(*) into reviewer_assignments_after_rollback
  from private.project_reviewer_assignments
  where reviewer_id in (user_a, user_b)
    or assigned_by in (user_a, user_b);

  select count(*) into submissions_after_rollback
  from public.project_submissions
  where user_id in (user_a, user_b);

  select count(*) into versions_after_rollback
  from public.project_submission_versions
  where user_id in (user_a, user_b);

  select count(*) into status_events_after_rollback
  from public.project_status_events
  where user_id in (user_a, user_b)
    or actor_id in (user_a, user_b);

  select count(*) into project_files_after_rollback
  from public.project_submission_files
  where user_id in (user_a, user_b);

  select count(*) into reviews_after_rollback
  from public.project_reviews
  where user_id in (user_a, user_b)
    or reviewer_id in (user_a, user_b);

  select count(*) into review_criteria_after_rollback
  from public.project_review_criteria
  where user_id in (user_a, user_b);

  select count(*) into project_objects_after_rollback
  from storage.objects
  where bucket_id = 'project-submissions';

  select count(*) into project_bucket_count_after_rollback
  from storage.buckets
  where id = 'project-submissions';

  if upload_intents_after_rollback <> 0
    or staff_roles_after_rollback <> 0
    or reviewer_assignments_after_rollback <> 0
    or submissions_after_rollback <> 0
    or versions_after_rollback <> 0
    or status_events_after_rollback <> 0
    or project_files_after_rollback <> 0
    or reviews_after_rollback <> 0
    or review_criteria_after_rollback <> 0
    or project_objects_after_rollback <> 0
    or project_bucket_count_after_rollback <> 1
  then
    raise exception using
      errcode = 'P7D22',
      message = 'Phase 07.2C2A rollback cleanup failed';
  end if;

  raise notice 'PHASE07_PASS2C2A_TWO_ACCOUNT_RUNTIME=PASS';
  raise notice 'STANDARD_MODE_AND_RETRY=PASS';
  raise notice 'TUS_MODE_AND_REPLACEMENT=PASS';
  raise notice 'CROSS_ACCOUNT_BLOCK=PASS';
  raise notice 'TEST_ROWS_ROLLED_BACK=PASS';
end;
$phase07$;

-- Visible rollback proof. This query is read-only and runs after the DO block.
select
  (
    select count(*)
    from private.project_upload_intents
    where user_id in (
      'USER_A_UUID'::uuid,
      'USER_B_UUID'::uuid
    )
  ) as upload_intents_after_rollback,
  (
    select count(*)
    from private.project_staff_roles
    where user_id in (
      'USER_A_UUID'::uuid,
      'USER_B_UUID'::uuid
    )
      or granted_by in (
        'USER_A_UUID'::uuid,
        'USER_B_UUID'::uuid
      )
  ) as staff_roles_after_rollback,
  (
    select count(*)
    from private.project_reviewer_assignments
    where reviewer_id in (
      'USER_A_UUID'::uuid,
      'USER_B_UUID'::uuid
    )
      or assigned_by in (
        'USER_A_UUID'::uuid,
        'USER_B_UUID'::uuid
      )
  ) as reviewer_assignments_after_rollback,
  (
    select count(*)
    from public.project_submissions
    where user_id in (
      'USER_A_UUID'::uuid,
      'USER_B_UUID'::uuid
    )
  ) as submissions_after_rollback,
  (
    select count(*)
    from public.project_submission_versions
    where user_id in (
      'USER_A_UUID'::uuid,
      'USER_B_UUID'::uuid
    )
  ) as versions_after_rollback,
  (
    select count(*)
    from public.project_status_events
    where user_id in (
      'USER_A_UUID'::uuid,
      'USER_B_UUID'::uuid
    )
      or actor_id in (
        'USER_A_UUID'::uuid,
        'USER_B_UUID'::uuid
      )
  ) as status_events_after_rollback,
  (
    select count(*)
    from public.project_submission_files
    where user_id in (
      'USER_A_UUID'::uuid,
      'USER_B_UUID'::uuid
    )
  ) as project_files_after_rollback,
  (
    select count(*)
    from public.project_reviews
    where user_id in (
      'USER_A_UUID'::uuid,
      'USER_B_UUID'::uuid
    )
      or reviewer_id in (
        'USER_A_UUID'::uuid,
        'USER_B_UUID'::uuid
      )
  ) as reviews_after_rollback,
  (
    select count(*)
    from public.project_review_criteria
    where user_id in (
      'USER_A_UUID'::uuid,
      'USER_B_UUID'::uuid
    )
  ) as review_criteria_after_rollback,
  (
    select count(*)
    from storage.objects
    where bucket_id = 'project-submissions'
  ) as project_objects_after_rollback,
  (
    select count(*)
    from storage.buckets
    where id = 'project-submissions'
  ) as project_bucket_count_after_rollback;
