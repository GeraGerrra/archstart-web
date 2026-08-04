-- ARCH.START Phase 07 Pass 1B — two-account completion transaction
-- Replace USER_A_UUID and USER_B_UUID locally.
-- Do not send UUIDs to chat. The final ROLLBACK removes all test rows.

begin;

-- Ensure administrative seed operations are not stamped from stale claims.
select set_config(
  'request.jwt.claims',
  '{}',
  true
);

-- USER A receives all five M01 lesson completion rows.
insert into public.lesson_completions (
  user_id,
  lesson_code
)
select
  'USER_A_UUID'::uuid,
  'M01_L0' || lesson_number::text
from generate_series(1, 5) as lesson_number;

-- USER B receives only four M01 lesson completion rows.
insert into public.lesson_completions (
  user_id,
  lesson_code
)
select
  'USER_B_UUID'::uuid,
  'M01_L0' || lesson_number::text
from generate_series(1, 4) as lesson_number;

-- USER A may receive M01 module completion.
insert into public.module_completions (
  user_id,
  module_code
)
values (
  'USER_A_UUID'::uuid,
  'M01'
);

-- USER B must be rejected because one lesson is missing.
create temporary table phase07_pass1b_flags (
  metric text primary key,
  passed boolean not null
) on commit drop;

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

    insert into phase07_pass1b_flags (
      metric,
      passed
    )
    values (
      'user_b_module_completion_blocked',
      false
    );
  exception
    when check_violation then
      insert into phase07_pass1b_flags (
        metric,
        passed
      )
      values (
        'user_b_module_completion_blocked',
        true
      );
  end;
end;
$$;

select
  metric,
  passed
from phase07_pass1b_flags
order by metric;

-- USER A sees only A's five lessons and one module.
set local role authenticated;

select set_config(
  'request.jwt.claims',
  '{"role":"authenticated","sub":"USER_A_UUID"}',
  true
);

select
  count(*)::integer as user_a_lesson_rows_visible
from public.lesson_completions;

select
  count(*)::integer as user_a_module_rows_visible
from public.module_completions;

-- USER B sees only B's four lessons and no module.
reset role;
set local role authenticated;

select set_config(
  'request.jwt.claims',
  '{"role":"authenticated","sub":"USER_B_UUID"}',
  true
);

select
  count(*)::integer as user_b_lesson_rows_visible
from public.lesson_completions;

select
  count(*)::integer as user_b_module_rows_visible
from public.module_completions;

-- Removing one USER A lesson automatically invalidates A's module completion.
reset role;

delete from public.lesson_completions
where user_id = 'USER_A_UUID'::uuid
  and lesson_code = 'M01_L05';

select
  count(*)::integer as user_a_module_rows_after_lesson_delete
from public.module_completions
where user_id = 'USER_A_UUID'::uuid
  and module_code = 'M01';

rollback;
