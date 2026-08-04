-- ARCH.START Phase 07 Pass 1C — two-account Quiz-attempt transaction
-- Replace USER_A_UUID and USER_B_UUID locally.
-- Do not send UUIDs to chat. The final ROLLBACK removes every test row.

begin;

select set_config(
  'request.jwt.claims',
  '{}',
  true
);

-- Administrative test seeds: two attempts for A, one attempt for B.
insert into public.quiz_attempts (
  user_id,
  lesson_code,
  selected_answers,
  score,
  question_count,
  answer_key_sha256
)
values
  (
    'USER_A_UUID'::uuid,
    'M01_L01',
    '{"Q01":"A","Q02":"B","Q03":"C","Q04":"D","Q05":"A"}'::jsonb,
    3,
    5,
    repeat('a', 64)
  ),
  (
    'USER_A_UUID'::uuid,
    'M01_L01',
    '{"Q01":"B","Q02":"B","Q03":"C","Q04":"D","Q05":"A"}'::jsonb,
    5,
    5,
    repeat('b', 64)
  ),
  (
    'USER_B_UUID'::uuid,
    'M02_L03',
    '{"Q01":"A","Q02":"A","Q03":"A","Q04":"A","Q05":"A"}'::jsonb,
    2,
    5,
    repeat('c', 64)
  );

-- Malformed answer shape must be rejected.
do $$
begin
  begin
    insert into public.quiz_attempts (
      user_id,
      lesson_code,
      selected_answers,
      score,
      question_count,
      answer_key_sha256
    )
    values (
      'USER_A_UUID'::uuid,
      'M01_L02',
      '{"Q01":"A"}'::jsonb,
      1,
      5,
      repeat('d', 64)
    );

    raise exception using
      errcode = 'P0001',
      message = 'STOP: malformed Quiz attempt was unexpectedly accepted';
  exception
    when check_violation then
      null;
  end;
end;
$$;

-- Existing attempts must be immutable.
do $$
begin
  begin
    update public.quiz_attempts
    set score = 0
    where user_id = 'USER_A_UUID'::uuid
      and lesson_code = 'M01_L01';

    raise exception using
      errcode = 'P0001',
      message = 'STOP: Quiz attempt update was unexpectedly accepted';
  exception
    when object_not_in_prerequisite_state then
      null;
  end;
end;
$$;

-- USER A sees only two A rows and the correct aggregate history.
set local role authenticated;

select set_config(
  'request.jwt.claims',
  '{"role":"authenticated","sub":"USER_A_UUID"}',
  true
);

select
  count(*)::integer as user_a_attempts_visible,
  max(score)::integer as user_a_best_score,
  count(distinct lesson_code)::integer as user_a_lessons_with_attempts
from public.quiz_attempts;

-- USER B sees only one B row.
reset role;
set local role authenticated;

select set_config(
  'request.jwt.claims',
  '{"role":"authenticated","sub":"USER_B_UUID"}',
  true
);

select
  count(*)::integer as user_b_attempts_visible,
  max(score)::integer as user_b_best_score,
  count(distinct lesson_code)::integer as user_b_lessons_with_attempts
from public.quiz_attempts;

reset role;
rollback;
