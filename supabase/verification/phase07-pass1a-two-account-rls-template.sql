-- ARCH.START Phase 07 Pass 1A — two-account RLS transaction template
-- Replace USER_A_UUID and USER_B_UUID locally. Do not send UUIDs to chat.
-- The final ROLLBACK removes every test row.

begin;

-- USER A records M01_L01 activity.
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"role":"authenticated","sub":"USER_A_UUID"}',
  true
);

select *
from public.record_lesson_activity('M01_L01', 'overview');

select
  count(*)::integer as user_a_rows_visible
from public.lesson_activity;

-- USER B must not see USER A's row.
reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"role":"authenticated","sub":"USER_B_UUID"}',
  true
);

select
  count(*)::integer as user_b_rows_visible_before_own_write
from public.lesson_activity;

select *
from public.record_lesson_activity('M02_L03', 'video');

select
  count(*)::integer as user_b_rows_visible_after_own_write
from public.lesson_activity;

-- USER A must still see only USER A's row and may update it through the RPC.
reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"role":"authenticated","sub":"USER_A_UUID"}',
  true
);

select *
from public.record_lesson_activity('M01_L01', 'quiz');

select
  count(*)::integer as user_a_rows_visible_after_update,
  min(last_item) as user_a_last_item
from public.lesson_activity;

rollback;
