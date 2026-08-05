# ARCH.START Phase 07 Pass 1D1.1

## Cause

The production Server Action reached the Supabase Data API and attempted an
INSERT into `public.quiz_attempts`.

Hosted diagnostics showed:

```text
service_role_can_insert_attempt = true
service_role_can_select_attempt = true
service_role_can_execute_answer_validator = false
service_role_has_private_schema_usage = false
```

`public.quiz_attempts` has a CHECK constraint that invokes:

```text
private.quiz_answers_shape_is_valid(jsonb)
```

The accepted Pass 1C migration revoked access from browser roles but omitted the
narrow service-role privileges required by the server-side INSERT.

## Repair

Grant only:

```text
USAGE on schema private -> service_role
EXECUTE on private.quiz_answers_shape_is_valid(jsonb) -> service_role
```

## Preserved boundaries

- no browser INSERT;
- no RLS change;
- no table-wide new grant;
- no function rewrite;
- no Quiz answer disclosure;
- no application source change;
- no Vercel environment-variable change;
- no learner rows created by the migration.
