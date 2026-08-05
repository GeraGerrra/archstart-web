-- ARCH.START Phase 07 Pass 1D1.1
-- Service-role Quiz validator privilege repair.
--
-- The server-side Quiz action already authenticates the learner, calculates
-- score on the server, and uses a Supabase secret key for the narrow INSERT.
-- Pass 1C revoked access to the private JSON-shape validator from browser roles
-- but omitted the service_role privileges required by the quiz_attempts CHECK.

begin;

do $$
begin
  if to_regclass('public.quiz_attempts') is null then
    raise exception using
      errcode = '55000',
      message = 'Phase 07 Pass 1C quiz_attempts is required';
  end if;

  if to_regprocedure(
    'private.quiz_answers_shape_is_valid(jsonb)'
  ) is null then
    raise exception using
      errcode = '55000',
      message = 'Phase 07 Pass 1C answer-shape validator is required';
  end if;

  if not has_table_privilege(
    'service_role',
    'public.quiz_attempts',
    'INSERT'
  ) then
    raise exception using
      errcode = '42501',
      message = 'service_role INSERT privilege is unexpectedly absent';
  end if;

  if not has_table_privilege(
    'service_role',
    'public.quiz_attempts',
    'SELECT'
  ) then
    raise exception using
      errcode = '42501',
      message = 'service_role SELECT privilege is unexpectedly absent';
  end if;
end;
$$;

grant usage
on schema private
to service_role;

grant execute
on function private.quiz_answers_shape_is_valid(jsonb)
to service_role;

do $$
begin
  if not has_schema_privilege(
    'service_role',
    'private',
    'USAGE'
  ) then
    raise exception using
      errcode = '42501',
      message = 'service_role private-schema USAGE grant failed';
  end if;

  if not has_function_privilege(
    'service_role',
    'private.quiz_answers_shape_is_valid(jsonb)',
    'EXECUTE'
  ) then
    raise exception using
      errcode = '42501',
      message = 'service_role Quiz-validator EXECUTE grant failed';
  end if;
end;
$$;

commit;
