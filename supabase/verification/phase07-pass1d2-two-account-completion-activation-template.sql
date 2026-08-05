-- ARCH.START Phase 07 Pass 1D2 — two-account transaction template
-- Replace USER_A_UUID and USER_B_UUID. Run the whole block once; it rolls back.

begin;

select set_config(
  'request.jwt.claims',
  '{}',
  true
);

create temporary table phase07_pass1d2_results (
  metric text primary key,
  integer_value integer,
  boolean_value boolean
) on commit drop;

grant select, insert, update
on table phase07_pass1d2_results
to authenticated, service_role;

-- A lesson cannot complete before any Quiz attempt exists.
set local role service_role;

do $$
begin
  begin
    insert into public.lesson_completions (
      user_id,
      lesson_code
    )
    values (
      'USER_A_UUID'::uuid,
      'M01_L01'
    );

    insert into phase07_pass1d2_results (
      metric,
      boolean_value
    ) values (
      'lesson_without_attempt_blocked',
      false
    );
  exception
    when check_violation then
      insert into phase07_pass1d2_results (
        metric,
        boolean_value
      ) values (
        'lesson_without_attempt_blocked',
        true
      );
  end;
end;
$$;

reset role;

-- User A receives five attempts; User B receives four.
set local role service_role;

insert into public.quiz_attempts (
  user_id,
  lesson_code,
  selected_answers,
  score,
  question_count,
  answer_key_sha256
)
select
  'USER_A_UUID'::uuid,
  'M01_L0' || lesson_number::text,
  '{"Q01":"A","Q02":"B","Q03":"C","Q04":"D","Q05":"A"}'::jsonb,
  lesson_number - 1,
  5,
  repeat('a', 64)
from generate_series(1, 5) as lesson_number;

insert into public.quiz_attempts (
  user_id,
  lesson_code,
  selected_answers,
  score,
  question_count,
  answer_key_sha256
)
select
  'USER_B_UUID'::uuid,
  'M01_L0' || lesson_number::text,
  '{"Q01":"A","Q02":"B","Q03":"C","Q04":"D","Q05":"A"}'::jsonb,
  0,
  5,
  repeat('b', 64)
from generate_series(1, 4) as lesson_number;

insert into public.lesson_completions (
  user_id,
  lesson_code
)
select
  'USER_A_UUID'::uuid,
  'M01_L0' || lesson_number::text
from generate_series(1, 5) as lesson_number;

insert into public.lesson_completions (
  user_id,
  lesson_code
)
select
  'USER_B_UUID'::uuid,
  'M01_L0' || lesson_number::text
from generate_series(1, 4) as lesson_number;

insert into public.module_completions (
  user_id,
  module_code
)
values (
  'USER_A_UUID'::uuid,
  'M01'
);

reset role;

-- User B remains blocked at four of five lessons.
set local role service_role;

do $$
begin
  begin
    insert into public.module_completions (
      user_id,
      module_code
    )
    values (
      'USER_B_UUID'::uuid,
      'M01'
    );

    insert into phase07_pass1d2_results (
      metric,
      boolean_value
    ) values (
      'user_b_module_completion_blocked',
      false
    );
  exception
    when check_violation then
      insert into phase07_pass1d2_results (
        metric,
        boolean_value
      ) values (
        'user_b_module_completion_blocked',
        true
      );
  end;
end;
$$;

reset role;

-- User A own-row visibility.
set local role authenticated;

select set_config(
  'request.jwt.claims',
  '{"role":"authenticated","sub":"USER_A_UUID"}',
  true
);

insert into phase07_pass1d2_results (
  metric,
  integer_value
)
select 'user_a_lesson_rows_visible', count(*)::integer
from public.lesson_completions;

insert into phase07_pass1d2_results (
  metric,
  integer_value
)
select 'user_a_module_rows_visible', count(*)::integer
from public.module_completions;

reset role;

-- User B own-row visibility.
set local role authenticated;

select set_config(
  'request.jwt.claims',
  '{"role":"authenticated","sub":"USER_B_UUID"}',
  true
);

insert into phase07_pass1d2_results (
  metric,
  integer_value
)
select 'user_b_lesson_rows_visible', count(*)::integer
from public.lesson_completions;

insert into phase07_pass1d2_results (
  metric,
  integer_value
)
select 'user_b_module_rows_visible', count(*)::integer
from public.module_completions;

reset role;

-- Removing one lesson completion invalidates A's module completion but keeps attempts.
set local role service_role;

delete from public.lesson_completions
where user_id = 'USER_A_UUID'::uuid
  and lesson_code = 'M01_L05';

reset role;

insert into phase07_pass1d2_results (
  metric,
  integer_value
)
select
  'user_a_module_rows_after_lesson_delete',
  count(*)::integer
from public.module_completions
where user_id = 'USER_A_UUID'::uuid
  and module_code = 'M01';

insert into phase07_pass1d2_results (
  metric,
  integer_value
)
select
  'user_a_quiz_attempts_after_lesson_delete',
  count(*)::integer
from public.quiz_attempts
where user_id = 'USER_A_UUID'::uuid
  and lesson_code like 'M01_L0%';

select
  (
    select boolean_value
    from phase07_pass1d2_results
    where metric = 'lesson_without_attempt_blocked'
  ) as lesson_without_attempt_blocked,
  (
    select boolean_value
    from phase07_pass1d2_results
    where metric = 'user_b_module_completion_blocked'
  ) as user_b_module_completion_blocked,
  (
    select integer_value
    from phase07_pass1d2_results
    where metric = 'user_a_lesson_rows_visible'
  ) as user_a_lesson_rows_visible,
  (
    select integer_value
    from phase07_pass1d2_results
    where metric = 'user_a_module_rows_visible'
  ) as user_a_module_rows_visible,
  (
    select integer_value
    from phase07_pass1d2_results
    where metric = 'user_b_lesson_rows_visible'
  ) as user_b_lesson_rows_visible,
  (
    select integer_value
    from phase07_pass1d2_results
    where metric = 'user_b_module_rows_visible'
  ) as user_b_module_rows_visible,
  (
    select integer_value
    from phase07_pass1d2_results
    where metric = 'user_a_module_rows_after_lesson_delete'
  ) as user_a_module_rows_after_lesson_delete,
  (
    select integer_value
    from phase07_pass1d2_results
    where metric = 'user_a_quiz_attempts_after_lesson_delete'
  ) as user_a_quiz_attempts_after_lesson_delete;

rollback;
