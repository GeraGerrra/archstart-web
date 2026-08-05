-- ARCH.START Phase 07 Pass 2B1 — two-account transaction test
-- Replace USER_A_UUID and USER_B_UUID, then run the WHOLE block once.
-- The final ROLLBACK removes every test row.

begin;

do $phase07$
declare
  user_a constant uuid := 'USER_A_UUID'::uuid;
  user_b constant uuid := 'USER_B_UUID'::uuid;
  submission_a uuid;
  submission_b uuid;
  version_a uuid;
  version_b uuid;
  file_a uuid;
  assignment_a uuid;
  review_a uuid;
  own_count integer;
  other_count integer;
  direct_browser_insert_blocked boolean := false;
  invalid_transition_blocked boolean := false;
  submission_prerequisite_blocked boolean := false;
  self_review_blocked boolean := false;
  submitted_version_immutable boolean := false;
begin
  perform set_config(
    'request.jwt.claims',
    '{}',
    true
  );

  execute 'set local role service_role';

  perform set_config(
    'archstart.project_staff_write_authorized',
    'on',
    true
  );

  insert into private.project_staff_roles (
    user_id,
    staff_role,
    granted_by
  ) values
    (user_a, 'admin', user_a),
    (user_b, 'reviewer', user_a);

  perform set_config(
    'archstart.project_submission_write_authorized',
    'on',
    true
  );

  insert into public.project_submissions (
    user_id,
    project_code
  ) values (
    user_a,
    'M01_P01'
  ) returning id into submission_a;

  insert into public.project_submissions (
    user_id,
    project_code
  ) values (
    user_b,
    'M02_P02'
  ) returning id into submission_b;

  perform set_config(
    'archstart.project_version_write_authorized',
    'on',
    true
  );

  insert into public.project_submission_versions (
    submission_id,
    learner_note
  ) values (
    submission_a,
    'User A draft'
  ) returning id into version_a;

  insert into public.project_submission_versions (
    submission_id,
    learner_note,
    supporting_text
  ) values (
    submission_b,
    'User B draft',
    repeat('слово ', 120)
  ) returning id into version_b;

  perform set_config(
    'archstart.project_current_version_write_authorized',
    'on',
    true
  );

  update public.project_submissions
  set current_version_id = version_a
  where id = submission_a;

  update public.project_submissions
  set current_version_id = version_b
  where id = submission_b;

  perform set_config(
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
    version_a,
    'm01-board.pdf',
    'application/pdf',
    'application/pdf',
    1024,
    repeat('a', 64),
    'valid',
    'not_required',
    1
  ) returning id into file_a;

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
    version_b,
    'm02-board.pdf',
    'application/pdf',
    'application/pdf',
    2048,
    repeat('b', 64),
    'valid',
    'not_required',
    1
  );

  -- Browser roles cannot create project rows directly.
  execute 'set local role authenticated';
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'role', 'authenticated',
      'sub', user_a::text
    )::text,
    true
  );

  begin
    insert into public.project_submissions (
      user_id,
      project_code
    ) values (
      user_a,
      'M03_P03'
    );
  exception
    when insufficient_privilege then
      direct_browser_insert_blocked := true;
  end;

  if direct_browser_insert_blocked is not true then
    raise exception using
      errcode = 'P7B11',
      message = 'authenticated project insert was unexpectedly accepted';
  end if;

  select count(*) into own_count
  from public.project_submissions;

  if own_count <> 1 then
    raise exception using
      errcode = 'P7B12',
      message = 'User A own-row submission visibility is invalid';
  end if;

  select count(*) into own_count
  from public.project_submission_versions;

  if own_count <> 1 then
    raise exception using
      errcode = 'P7B13',
      message = 'User A own-row version visibility is invalid';
  end if;

  select count(*) into own_count
  from public.project_submission_files;

  if own_count <> 1 then
    raise exception using
      errcode = 'P7B14',
      message = 'User A own-row file metadata visibility is invalid';
  end if;

  execute 'reset role';
  execute 'set local role service_role';
  perform set_config('request.jwt.claims', '{}', true);

  -- Invalid direct draft → accepted transition remains blocked.
  perform set_config(
    'archstart.project_transition_authorized',
    'on',
    true
  );

  begin
    update public.project_submissions
    set current_status = 'accepted'
    where id = submission_b;
  exception
    when check_violation then
      invalid_transition_blocked := true;
  end;

  if invalid_transition_blocked is not true then
    raise exception using
      errcode = 'P7B15',
      message = 'invalid draft-to-accepted transition was unexpectedly accepted';
  end if;

  -- A structurally valid file is still insufficient until all five lessons
  -- in the matching module are explicitly completed.
  perform set_config(
    'archstart.project_version_submit_authorized',
    'on',
    true
  );

  begin
    update public.project_submission_versions
    set version_state = 'submitted'
    where id = version_a;
  exception
    when check_violation then
      submission_prerequisite_blocked := true;
  end;

  if submission_prerequisite_blocked is not true then
    raise exception using
      errcode = 'P7B16',
      message = 'project submission prerequisite was unexpectedly bypassed';
  end if;

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
    repeat('c', 64)
  from generate_series(1, 5) as lesson_number;

  insert into public.lesson_completions (
    user_id,
    lesson_code
  )
  select
    user_a,
    'M01_L0' || lesson_number::text
  from generate_series(1, 5) as lesson_number;

  update public.project_submission_versions
  set version_state = 'submitted'
  where id = version_a;

  update public.project_submissions
  set current_status = 'submitted'
  where id = submission_a;

  perform set_config(
    'archstart.project_assignment_write_authorized',
    'on',
    true
  );

  begin
    insert into private.project_reviewer_assignments (
      submission_id,
      reviewer_id,
      assigned_by
    ) values (
      submission_a,
      user_a,
      user_a
    );
  exception
    when check_violation then
      self_review_blocked := true;
  end;

  if self_review_blocked is not true then
    raise exception using
      errcode = 'P7B17',
      message = 'self-review assignment was unexpectedly accepted';
  end if;

  insert into private.project_reviewer_assignments (
    submission_id,
    reviewer_id,
    assigned_by
  ) values (
    submission_a,
    user_b,
    user_a
  ) returning id into assignment_a;

  update public.project_submissions
  set current_status = 'under_review'
  where id = submission_a;

  perform set_config(
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
    version_a,
    user_b,
    'revisions_required',
    'Нужны точечные правки по доказательствам.',
    80,
    1
  ) returning id into review_a;

  insert into public.project_review_criteria (
    review_id,
    criterion_number,
    criterion_title_snapshot,
    criterion_description_snapshot,
    max_points,
    awarded_points,
    comment
  ) values
    (review_a, 1, 'ignored', 'ignored', 1, 20, 'Уточнить диагноз.'),
    (review_a, 2, 'ignored', 'ignored', 1, 15, 'Сценарий читается.'),
    (review_a, 3, 'ignored', 'ignored', 1, 20, 'Добавить доказательство.'),
    (review_a, 4, 'ignored', 'ignored', 1, 15, 'Усилить итерации.'),
    (review_a, 5, 'ignored', 'ignored', 1, 10, 'Иерархия ясная.');

  update public.project_submissions
  set current_status = 'revisions_required'
  where id = submission_a;

  perform set_config(
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
    submission_a,
    version_a,
    user_b,
    'reviewer',
    'revisions_required',
    'under_review',
    'revisions_required',
    jsonb_build_object('message', 'Нужны правки')
  );

  begin
    update public.project_submission_versions
    set learner_note = 'forbidden edit'
    where id = version_a;
  exception
    when object_not_in_prerequisite_state then
      submitted_version_immutable := true;
  end;

  if submitted_version_immutable is not true then
    raise exception using
      errcode = 'P7B18',
      message = 'submitted version mutation was unexpectedly accepted';
  end if;

  -- User B remains isolated from User A learner records, even though User B is
  -- the assigned reviewer. Reviewer access will be server-projected in Pass 2B2.
  execute 'set local role authenticated';
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'role', 'authenticated',
      'sub', user_b::text
    )::text,
    true
  );

  select count(*) into own_count
  from public.project_submissions;

  if own_count <> 1 then
    raise exception using
      errcode = 'P7B19',
      message = 'User B own-row submission visibility is invalid';
  end if;

  select count(*) into other_count
  from public.project_reviews;

  if other_count <> 0 then
    raise exception using
      errcode = 'P7B20',
      message = 'Reviewer browser session unexpectedly sees another learner review';
  end if;

  execute 'reset role';

  if (
    select count(*)
    from private.project_rubric_criteria
  ) <> 40 then
    raise exception using
      errcode = 'P7B21',
      message = 'rubric catalog count changed during transaction test';
  end if;

  raise notice
    'PHASE07_PASS2B1_TWO_ACCOUNT=PASS; direct_insert_blocked=%, invalid_transition_blocked=%, prerequisite_blocked=%, self_review_blocked=%, submitted_version_immutable=%',
    direct_browser_insert_blocked,
    invalid_transition_blocked,
    submission_prerequisite_blocked,
    self_review_blocked,
    submitted_version_immutable;
end;
$phase07$;

rollback;
