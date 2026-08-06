-- ARCH.START Phase 07 Pass 2B2 — two-account workflow transaction test
-- Replace USER_A_UUID and USER_B_UUID with two real confirmed test users.
-- Run the WHOLE file once. Every test row is removed by the final ROLLBACK.

begin;

do $phase07$
declare
  user_a constant uuid := 'USER_A_UUID'::uuid;
  user_b constant uuid := 'USER_B_UUID'::uuid;

  submission_id_a uuid;
  submission_id_retry uuid;
  version_id_v1 uuid;
  version_id_v1_retry uuid;
  version_id_v2 uuid;
  version_id_v2_retry uuid;
  assignment_id_b uuid;
  assignment_id_retry uuid;
  review_id_v1 uuid;
  review_id_v1_retry uuid;
  review_id_v2 uuid;
  review_id_v2_retry uuid;

  version_number smallint;
  returned_status text;
  returned_state text;
  returned_score smallint;
  returned_score_retry smallint;

  metric integer;
  direct_browser_dml_blocked boolean := false;
  cross_user_draft_update_blocked boolean := false;
  submit_without_completion_blocked boolean := false;
  self_review_blocked boolean := false;
  unassigned_admin_review_blocked boolean := false;
  unassigned_admin_decision_blocked boolean := false;
  incomplete_review_blocked boolean := false;
  submitted_version_immutable boolean := false;
begin
  if user_a = user_b then
    raise exception using
      errcode = 'P7B20',
      message = 'User A and User B must be different test accounts';
  end if;

  if not exists (select 1 from auth.users where id = user_a)
    or not exists (select 1 from auth.users where id = user_b)
  then
    raise exception using
      errcode = 'P7B21',
      message = 'Both test UUIDs must exist in auth.users';
  end if;

  if exists (
    select 1
    from private.project_staff_roles
    where user_id in (user_a, user_b)
  ) or exists (
    select 1
    from public.project_submissions
    where user_id in (user_a, user_b)
  ) or exists (
    select 1
    from public.quiz_attempts
    where user_id in (user_a, user_b)
      and lesson_code like 'M01_L0%'
  ) or exists (
    select 1
    from public.lesson_completions
    where user_id in (user_a, user_b)
      and lesson_code like 'M01_L0%'
  )
  then
    raise exception using
      errcode = 'P7B22',
      message = 'The two test users must have a clean M01/project baseline';
  end if;

  perform pg_catalog.set_config('request.jwt.claims', '{}', true);
  execute 'set local role service_role';

  -- Trusted bootstrap is service-role-only and idempotent.
  perform 1
  from public.set_project_staff_role(
    user_a,
    'admin',
    true,
    user_a
  );

  perform 1
  from public.set_project_staff_role(
    user_a,
    'admin',
    true,
    user_a
  );

  perform 1
  from public.set_project_staff_role(
    user_b,
    'reviewer',
    true,
    user_a
  );

  perform 1
  from public.set_project_staff_role(
    user_b,
    'reviewer',
    true,
    user_a
  );

  select count(*) into metric
  from private.project_staff_roles
  where user_id in (user_a, user_b)
    and active;

  if metric <> 2 then
    raise exception using
      errcode = 'P7B23',
      message = 'staff-role bootstrap was not idempotent';
  end if;

  execute 'reset role';
  execute 'set local role authenticated';
  perform pg_catalog.set_config(
    'request.jwt.claims',
    pg_catalog.jsonb_build_object(
      'role', 'authenticated',
      'sub', user_a::text
    )::text,
    true
  );

  -- Browser relation DML remains blocked; only the RPC may write.
  begin
    insert into public.project_submissions (
      user_id,
      project_code
    ) values (
      user_a,
      'M01_P01'
    );
  exception
    when insufficient_privilege then
      direct_browser_dml_blocked := true;
  end;

  if direct_browser_dml_blocked is not true then
    raise exception using
      errcode = 'P7B24',
      message = 'authenticated direct project DML was unexpectedly accepted';
  end if;

  select
    result.submission_id,
    result.version_id,
    result.version_number,
    result.version_state,
    result.submission_status
  into
    submission_id_a,
    version_id_v1,
    version_number,
    returned_state,
    returned_status
  from public.create_project_draft('M01_P01') as result;

  if version_number <> 1
    or returned_state <> 'draft'
    or returned_status <> 'draft'
  then
    raise exception using
      errcode = 'P7B25',
      message = 'initial project draft result is invalid';
  end if;

  select result.submission_id, result.version_id
  into submission_id_retry, version_id_v1_retry
  from public.create_project_draft('M01_P01') as result;

  if submission_id_retry <> submission_id_a
    or version_id_v1_retry <> version_id_v1
  then
    raise exception using
      errcode = 'P7B26',
      message = 'initial project draft retry created a duplicate';
  end if;

  perform 1
  from public.update_project_draft(
    version_id_v1,
    'Первый вариант проекта.',
    null
  );

  perform 1
  from public.update_project_draft(
    version_id_v1,
    'Первый вариант проекта.',
    null
  );

  execute 'reset role';
  execute 'set local role authenticated';
  perform pg_catalog.set_config(
    'request.jwt.claims',
    pg_catalog.jsonb_build_object(
      'role', 'authenticated',
      'sub', user_b::text
    )::text,
    true
  );

  begin
    perform 1
    from public.update_project_draft(
      version_id_v1,
      'cross-user mutation',
      null
    );
  exception
    when insufficient_privilege then
      cross_user_draft_update_blocked := true;
  end;

  if cross_user_draft_update_blocked is not true then
    raise exception using
      errcode = 'P7B39',
      message = 'cross-user draft update was unexpectedly accepted';
  end if;

  -- File metadata is inserted only by the trusted test boundary. Pass 2C will
  -- later own real Storage upload/finalization.
  execute 'reset role';
  execute 'set local role service_role';
  perform pg_catalog.set_config('request.jwt.claims', '{}', true);
  perform pg_catalog.set_config(
    'archstart.project_file_write_authorized',
    'on',
    true
  );

  insert into public.project_submission_files (
    version_id,
    original_filename,
    declared_mime,
    detected_mime,
    size_bytes,
    sha256,
    validation_status,
    scan_status,
    page_count
  ) values (
    version_id_v1,
    'm01-v1.pdf',
    'application/pdf',
    'application/pdf',
    1024,
    repeat('a', 64),
    'valid',
    'not_required',
    1
  );

  execute 'reset role';
  execute 'set local role authenticated';
  perform pg_catalog.set_config(
    'request.jwt.claims',
    pg_catalog.jsonb_build_object(
      'role', 'authenticated',
      'sub', user_a::text
    )::text,
    true
  );

  begin
    perform 1
    from public.submit_project(version_id_v1);
  exception
    when check_violation then
      submit_without_completion_blocked := true;
  end;

  if submit_without_completion_blocked is not true then
    raise exception using
      errcode = 'P7B27',
      message = 'submission without 5/5 lesson completions was unexpectedly accepted';
  end if;

  -- Score zero is intentional: completion/submission has no Quiz-score floor.
  execute 'reset role';
  execute 'set local role service_role';
  perform pg_catalog.set_config('request.jwt.claims', '{}', true);

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
    repeat('b', 64)
  from pg_catalog.generate_series(1, 5) as lesson_number;

  insert into public.lesson_completions (
    user_id,
    lesson_code
  )
  select
    user_a,
    'M01_L0' || lesson_number::text
  from pg_catalog.generate_series(1, 5) as lesson_number;

  execute 'reset role';
  execute 'set local role authenticated';
  perform pg_catalog.set_config(
    'request.jwt.claims',
    pg_catalog.jsonb_build_object(
      'role', 'authenticated',
      'sub', user_a::text
    )::text,
    true
  );

  select result.submission_id, result.version_id, result.submission_status
  into submission_id_retry, version_id_v1_retry, returned_status
  from public.submit_project(version_id_v1) as result;

  if submission_id_retry <> submission_id_a
    or version_id_v1_retry <> version_id_v1
    or returned_status <> 'submitted'
  then
    raise exception using
      errcode = 'P7B28',
      message = 'initial project submission result is invalid';
  end if;

  perform 1 from public.submit_project(version_id_v1);

  -- An active admin is still not a reviewer until explicitly assigned.
  begin
    perform 1
    from public.begin_project_review(submission_id_a);
  exception
    when insufficient_privilege then
      unassigned_admin_review_blocked := true;
  end;

  begin
    perform 1
    from public.decide_project_review(
      submission_id_a,
      'revisions_required',
      'Unauthorized decision attempt.',
      pg_catalog.jsonb_build_array(
        pg_catalog.jsonb_build_object('criterion_number', 1, 'awarded_points', 0, 'comment', null),
        pg_catalog.jsonb_build_object('criterion_number', 2, 'awarded_points', 0, 'comment', null),
        pg_catalog.jsonb_build_object('criterion_number', 3, 'awarded_points', 0, 'comment', null),
        pg_catalog.jsonb_build_object('criterion_number', 4, 'awarded_points', 0, 'comment', null),
        pg_catalog.jsonb_build_object('criterion_number', 5, 'awarded_points', 0, 'comment', null)
      )
    );
  exception
    when insufficient_privilege then
      unassigned_admin_decision_blocked := true;
  end;

  if unassigned_admin_review_blocked is not true
    or unassigned_admin_decision_blocked is not true
  then
    raise exception using
      errcode = 'P7B40',
      message = 'unassigned admin unexpectedly acquired review authority';
  end if;

  -- Admin cannot assign the learner to review their own project.
  begin
    perform 1
    from public.assign_project_reviewer(
      submission_id_a,
      user_a
    );
  exception
    when check_violation then
      self_review_blocked := true;
  end;

  if self_review_blocked is not true then
    raise exception using
      errcode = 'P7B29',
      message = 'self-review assignment was unexpectedly accepted';
  end if;

  select result.assignment_id
  into assignment_id_b
  from public.assign_project_reviewer(
    submission_id_a,
    user_b
  ) as result;

  select result.assignment_id
  into assignment_id_retry
  from public.assign_project_reviewer(
    submission_id_a,
    user_b
  ) as result;

  if assignment_id_retry <> assignment_id_b then
    raise exception using
      errcode = 'P7B30',
      message = 'reviewer-assignment retry created a duplicate';
  end if;

  -- Reviewer authority does not widen learner-table RLS visibility.
  execute 'reset role';
  execute 'set local role authenticated';
  perform pg_catalog.set_config(
    'request.jwt.claims',
    pg_catalog.jsonb_build_object(
      'role', 'authenticated',
      'sub', user_b::text
    )::text,
    true
  );

  select count(*) into metric
  from public.project_submissions;

  if metric <> 0 then
    raise exception using
      errcode = 'P7B31',
      message = 'reviewer unexpectedly received learner-row visibility';
  end if;

  perform 1 from public.begin_project_review(submission_id_a);
  perform 1 from public.begin_project_review(submission_id_a);

  begin
    perform 1
    from public.decide_project_review(
      submission_id_a,
      'revisions_required',
      'Нужны точечные правки.',
      pg_catalog.jsonb_build_array(
        pg_catalog.jsonb_build_object('criterion_number', 1, 'awarded_points', 20, 'comment', null),
        pg_catalog.jsonb_build_object('criterion_number', 2, 'awarded_points', 10, 'comment', null),
        pg_catalog.jsonb_build_object('criterion_number', 3, 'awarded_points', 20, 'comment', null),
        pg_catalog.jsonb_build_object('criterion_number', 4, 'awarded_points', 20, 'comment', null)
      )
    );
  exception
    when invalid_parameter_value then
      incomplete_review_blocked := true;
  end;

  if incomplete_review_blocked is not true then
    raise exception using
      errcode = 'P7B32',
      message = 'four-criterion review was unexpectedly accepted';
  end if;

  select result.review_id, result.score, result.submission_status
  into review_id_v1, returned_score, returned_status
  from public.decide_project_review(
    submission_id_a,
    'revisions_required',
    'Нужны точечные правки.',
    pg_catalog.jsonb_build_array(
      pg_catalog.jsonb_build_object('criterion_number', 1, 'awarded_points', 20, 'comment', 'Уточнить диагноз.'),
      pg_catalog.jsonb_build_object('criterion_number', 2, 'awarded_points', 10, 'comment', 'Уточнить сценарий.'),
      pg_catalog.jsonb_build_object('criterion_number', 3, 'awarded_points', 20, 'comment', 'Добавить доказательство.'),
      pg_catalog.jsonb_build_object('criterion_number', 4, 'awarded_points', 20, 'comment', 'Усилить итерации.'),
      pg_catalog.jsonb_build_object('criterion_number', 5, 'awarded_points', 10, 'comment', 'Иерархия читается.')
    )
  ) as result;

  select result.review_id, result.score
  into review_id_v1_retry, returned_score_retry
  from public.decide_project_review(
    submission_id_a,
    'revisions_required',
    'Нужны точечные правки.',
    pg_catalog.jsonb_build_array(
      pg_catalog.jsonb_build_object('criterion_number', 1, 'awarded_points', 20, 'comment', 'Уточнить диагноз.'),
      pg_catalog.jsonb_build_object('criterion_number', 2, 'awarded_points', 10, 'comment', 'Уточнить сценарий.'),
      pg_catalog.jsonb_build_object('criterion_number', 3, 'awarded_points', 20, 'comment', 'Добавить доказательство.'),
      pg_catalog.jsonb_build_object('criterion_number', 4, 'awarded_points', 20, 'comment', 'Усилить итерации.'),
      pg_catalog.jsonb_build_object('criterion_number', 5, 'awarded_points', 10, 'comment', 'Иерархия читается.')
    )
  ) as result;

  if review_id_v1_retry <> review_id_v1
    or returned_score <> 80
    or returned_score_retry <> 80
    or returned_status <> 'revisions_required'
  then
    raise exception using
      errcode = 'P7B33',
      message = 'first review or its retry is invalid';
  end if;

  -- Learner creates exactly one new draft version.
  execute 'reset role';
  execute 'set local role authenticated';
  perform pg_catalog.set_config(
    'request.jwt.claims',
    pg_catalog.jsonb_build_object(
      'role', 'authenticated',
      'sub', user_a::text
    )::text,
    true
  );

  select result.version_id, result.version_number
  into version_id_v2, version_number
  from public.create_project_revision_draft(submission_id_a) as result;

  select result.version_id
  into version_id_v2_retry
  from public.create_project_revision_draft(submission_id_a) as result;

  if version_id_v2_retry <> version_id_v2
    or version_number <> 2
  then
    raise exception using
      errcode = 'P7B34',
      message = 'revision-draft retry created a duplicate version';
  end if;

  perform 1
  from public.update_project_draft(
    version_id_v2,
    'Исправленный вариант проекта.',
    null
  );

  perform 1
  from public.update_project_draft(
    version_id_v2,
    'Исправленный вариант проекта.',
    null
  );

  execute 'reset role';
  execute 'set local role service_role';
  perform pg_catalog.set_config('request.jwt.claims', '{}', true);
  perform pg_catalog.set_config(
    'archstart.project_file_write_authorized',
    'on',
    true
  );

  insert into public.project_submission_files (
    version_id,
    original_filename,
    declared_mime,
    detected_mime,
    size_bytes,
    sha256,
    validation_status,
    scan_status,
    page_count
  ) values (
    version_id_v2,
    'm01-v2.pdf',
    'application/pdf',
    'application/pdf',
    2048,
    repeat('c', 64),
    'valid',
    'not_required',
    1
  );

  execute 'reset role';
  execute 'set local role authenticated';
  perform pg_catalog.set_config(
    'request.jwt.claims',
    pg_catalog.jsonb_build_object(
      'role', 'authenticated',
      'sub', user_a::text
    )::text,
    true
  );

  perform 1 from public.resubmit_project(version_id_v2);
  perform 1 from public.resubmit_project(version_id_v2);

  execute 'reset role';
  execute 'set local role authenticated';
  perform pg_catalog.set_config(
    'request.jwt.claims',
    pg_catalog.jsonb_build_object(
      'role', 'authenticated',
      'sub', user_b::text
    )::text,
    true
  );

  perform 1 from public.begin_project_review(submission_id_a);
  perform 1 from public.begin_project_review(submission_id_a);

  -- Explicit acceptance with score 5 proves there is no automatic score floor.
  select result.review_id, result.score, result.submission_status
  into review_id_v2, returned_score, returned_status
  from public.decide_project_review(
    submission_id_a,
    'accepted',
    'Проект принят после проверки исправленной версии.',
    pg_catalog.jsonb_build_array(
      pg_catalog.jsonb_build_object('criterion_number', 1, 'awarded_points', 1, 'comment', null),
      pg_catalog.jsonb_build_object('criterion_number', 2, 'awarded_points', 1, 'comment', null),
      pg_catalog.jsonb_build_object('criterion_number', 3, 'awarded_points', 1, 'comment', null),
      pg_catalog.jsonb_build_object('criterion_number', 4, 'awarded_points', 1, 'comment', null),
      pg_catalog.jsonb_build_object('criterion_number', 5, 'awarded_points', 1, 'comment', null)
    )
  ) as result;

  -- Accepted releases the assignment; an identical network retry must still
  -- return the immutable review rather than fail or create a duplicate.
  select result.review_id, result.score
  into review_id_v2_retry, returned_score_retry
  from public.decide_project_review(
    submission_id_a,
    'accepted',
    'Проект принят после проверки исправленной версии.',
    pg_catalog.jsonb_build_array(
      pg_catalog.jsonb_build_object('criterion_number', 1, 'awarded_points', 1, 'comment', null),
      pg_catalog.jsonb_build_object('criterion_number', 2, 'awarded_points', 1, 'comment', null),
      pg_catalog.jsonb_build_object('criterion_number', 3, 'awarded_points', 1, 'comment', null),
      pg_catalog.jsonb_build_object('criterion_number', 4, 'awarded_points', 1, 'comment', null),
      pg_catalog.jsonb_build_object('criterion_number', 5, 'awarded_points', 1, 'comment', null)
    )
  ) as result;

  if review_id_v2_retry <> review_id_v2
    or returned_score <> 5
    or returned_score_retry <> 5
    or returned_status <> 'accepted'
  then
    raise exception using
      errcode = 'P7B35',
      message = 'accepted review or post-release retry is invalid';
  end if;

  -- Submitted version content remains immutable even for service_role DML.
  execute 'reset role';
  execute 'set local role service_role';
  perform pg_catalog.set_config('request.jwt.claims', '{}', true);
  perform pg_catalog.set_config(
    'archstart.project_version_write_authorized',
    'on',
    true
  );

  begin
    update public.project_submission_versions
    set learner_note = 'forbidden mutation'
    where id = version_id_v2;
  exception
    when object_not_in_prerequisite_state then
      submitted_version_immutable := true;
  end;

  if submitted_version_immutable is not true then
    raise exception using
      errcode = 'P7B36',
      message = 'submitted project version was unexpectedly mutable';
  end if;

  -- Exact row and event cardinality proves retry idempotency.
  if (select count(*) from public.project_submissions where user_id = user_a) <> 1
    or (select count(*) from public.project_submission_versions where user_id = user_a) <> 2
    or (select count(*) from public.project_submission_files where user_id = user_a) <> 2
    or (select count(*) from public.project_reviews where user_id = user_a) <> 2
    or (select count(*) from public.project_review_criteria where user_id = user_a) <> 10
    or (select count(*) from private.project_reviewer_assignments where submission_id = submission_id_a) <> 1
    or (select count(*) from private.project_reviewer_assignments where submission_id = submission_id_a and released_at is null) <> 0
    or (select count(*) from public.project_status_events where submission_id = submission_id_a) <> 12
    or (select count(*) from public.project_status_events where submission_id = submission_id_a and event_type = 'draft_created') <> 2
    or (select count(*) from public.project_status_events where submission_id = submission_id_a and event_type = 'draft_updated') <> 2
    or (select count(*) from public.project_status_events where submission_id = submission_id_a and event_type = 'submitted') <> 1
    or (select count(*) from public.project_status_events where submission_id = submission_id_a and event_type = 'reviewer_assigned') <> 1
    or (select count(*) from public.project_status_events where submission_id = submission_id_a and event_type = 'review_started') <> 2
    or (select count(*) from public.project_status_events where submission_id = submission_id_a and event_type = 'revisions_required') <> 1
    or (select count(*) from public.project_status_events where submission_id = submission_id_a and event_type = 'resubmitted') <> 1
    or (select count(*) from public.project_status_events where submission_id = submission_id_a and event_type = 'accepted') <> 1
    or (select count(*) from public.project_status_events where submission_id = submission_id_a and event_type = 'assignment_released') <> 1
  then
    raise exception using
      errcode = 'P7B37',
      message = 'workflow row/event cardinality or retry idempotency is invalid';
  end if;

  if not exists (
    select 1
    from public.project_submissions
    where id = submission_id_a
      and current_version_id = version_id_v2
      and current_status = 'accepted'
      and submitted_at is not null
      and accepted_at is not null
  ) then
    raise exception using
      errcode = 'P7B38',
      message = 'final accepted submission state is invalid';
  end if;

  execute 'reset role';
  perform pg_catalog.set_config('request.jwt.claims', '{}', true);

  raise notice 'PHASE07_PASS2B2_TWO_ACCOUNT_WORKFLOW=PASS';
  raise notice 'IDEMPOTENT_RETRIES=PASS';
  raise notice 'ACCEPTED_WITH_SCORE_5_NO_THRESHOLD=PASS';
  raise notice 'TEST_ROWS_WILL_ROLL_BACK=PASS';
end;
$phase07$;

rollback;

-- The one visible result row must contain only zeros.
select
  (
    select count(*)
    from private.project_staff_roles
    where user_id in (
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
  ) as assignments_after_rollback,
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
    from public.project_submission_files
    where user_id in (
      'USER_A_UUID'::uuid,
      'USER_B_UUID'::uuid
    )
  ) as files_after_rollback,
  (
    select count(*)
    from public.project_reviews
    where user_id in (
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
    from public.project_status_events
    where user_id in (
      'USER_A_UUID'::uuid,
      'USER_B_UUID'::uuid
    )
  ) as status_events_after_rollback,
  (
    select count(*)
    from public.quiz_attempts
    where user_id in (
      'USER_A_UUID'::uuid,
      'USER_B_UUID'::uuid
    )
      and lesson_code like 'M01_L0%'
  ) as quiz_attempts_after_rollback,
  (
    select count(*)
    from public.lesson_completions
    where user_id in (
      'USER_A_UUID'::uuid,
      'USER_B_UUID'::uuid
    )
      and lesson_code like 'M01_L0%'
  ) as lesson_completions_after_rollback;
