-- ARCH.START Phase 07 Pass 2C1 — private project Storage bucket foundation
-- Scope: create one exact private bucket and preserve a closed browser policy boundary.
-- No Storage objects, object policies, upload token, finalization RPC, UI,
-- dependency, workflow RPC, project table, Vercel, R2, email, gallery, or
-- certificate change.

begin;

do $phase07$
declare
  item record;
  function_oid oid;
  storage_rls_count integer;
  workflow_row_count bigint;
  project_policy_count integer;
  object_count bigint;
begin
  -- Pin the exact merged Phase 07.2B2/R1 workflow authority.
  for item in
    select *
    from (values
      ('public.assign_project_reviewer(uuid,uuid)', '07d99ba9d8ebcb18337212cd22ded91c', 'authenticated'),
      ('public.begin_project_review(uuid)', 'c9097e46fa20eec33673cfd3fca94382', 'authenticated'),
      ('public.create_project_draft(text)', 'b6ab7a9213dbd8dbfdfcb7326f014110', 'authenticated'),
      ('public.create_project_revision_draft(uuid)', 'ca9c53a9a3c12b087b44fad1c168ef73', 'authenticated'),
      ('public.decide_project_review(uuid,text,text,jsonb)', '44729ad70ff5014ec37a1463bc2392dd', 'authenticated'),
      ('public.resubmit_project(uuid)', 'dbc70626c4a2a831533995826d850071', 'authenticated'),
      ('public.set_project_staff_role(uuid,text,boolean,uuid)', '31b71b409acdb83dc8622a4a18949d4b', 'service_role'),
      ('public.submit_project(uuid)', '8525ca4c9241f48660ad33b589110c0a', 'authenticated'),
      ('public.update_project_draft(uuid,text,text)', '77357f0b4b260606b6df1d8219b8d890', 'authenticated')
    ) as expected(signature, definition_md5, expected_caller)
  loop
    function_oid := pg_catalog.to_regprocedure(item.signature);

    if function_oid is null then
      raise exception using
        errcode = '42883',
        message = 'required Phase 07.2B2 workflow function is absent: ' || item.signature;
    end if;

    if pg_catalog.md5(
      pg_catalog.pg_get_functiondef(function_oid)
    ) is distinct from item.definition_md5 then
      raise exception using
        errcode = '55000',
        message = 'Phase 07.2B2 workflow function identity drift: ' || item.signature;
    end if;

    if pg_catalog.has_function_privilege('anon', function_oid, 'EXECUTE') then
      raise exception using
        errcode = '55000',
        message = 'anonymous workflow execute privilege drift: ' || item.signature;
    end if;

    if item.expected_caller = 'authenticated' then
      if not pg_catalog.has_function_privilege('authenticated', function_oid, 'EXECUTE')
        or pg_catalog.has_function_privilege('service_role', function_oid, 'EXECUTE')
      then
        raise exception using
          errcode = '55000',
          message = 'authenticated workflow execute boundary drift: ' || item.signature;
      end if;
    elsif item.expected_caller = 'service_role' then
      if pg_catalog.has_function_privilege('authenticated', function_oid, 'EXECUTE')
        or not pg_catalog.has_function_privilege('service_role', function_oid, 'EXECUTE')
      then
        raise exception using
          errcode = '55000',
          message = 'service-role workflow execute boundary drift: ' || item.signature;
      end if;
    else
      raise exception using
        errcode = '22023',
        message = 'invalid expected workflow caller';
    end if;
  end loop;

  select count(*) into storage_rls_count
  from pg_catalog.pg_class as relation
  join pg_catalog.pg_namespace as namespace
    on namespace.oid = relation.relnamespace
  where namespace.nspname = 'storage'
    and relation.relname in ('buckets', 'objects')
    and relation.relkind in ('r', 'p')
    and relation.relrowsecurity;

  if storage_rls_count <> 2 then
    raise exception using
      errcode = '55000',
      message = 'storage.buckets and storage.objects must both retain RLS';
  end if;

  if exists (
    select 1
    from storage.buckets
    where id = 'project-submissions'
  ) then
    raise exception using
      errcode = '55000',
      message = 'project-submissions bucket already exists before Pass 2C1';
  end if;

  select count(*) into project_policy_count
  from pg_catalog.pg_policies
  where schemaname = 'storage'
    and tablename = 'objects'
    and (
      policyname ~* 'project'
      or coalesce(qual, '') ~* 'project-submissions'
      or coalesce(with_check, '') ~* 'project-submissions'
    );

  if project_policy_count <> 0 then
    raise exception using
      errcode = '55000',
      message = 'project Storage policies must be absent before Pass 2C1';
  end if;

  select count(*) into object_count
  from storage.objects
  where bucket_id = 'project-submissions';

  if object_count <> 0 then
    raise exception using
      errcode = '55000',
      message = 'project Storage objects must be absent before Pass 2C1';
  end if;

  if (select count(*) from private.project_submission_policies where is_current) <> 8
    or (select count(*) from private.project_rubric_criteria) <> 40
  then
    raise exception using
      errcode = '55000',
      message = 'project policy or rubric authority drift';
  end if;

  select
    (select count(*) from private.project_staff_roles)
    + (select count(*) from private.project_reviewer_assignments)
    + (select count(*) from public.project_submissions)
    + (select count(*) from public.project_submission_versions)
    + (select count(*) from public.project_submission_files)
    + (select count(*) from public.project_reviews)
    + (select count(*) from public.project_review_criteria)
    + (select count(*) from public.project_status_events)
  into workflow_row_count;

  if workflow_row_count <> 0 then
    raise exception using
      errcode = '55000',
      message = 'Pass 2C1 requires the accepted zero-row project workflow boundary';
  end if;
end;
$phase07$;

-- Supabase supports SQL creation of bucket rows. This adds configuration only;
-- no file object is created. Forty MiB is below the observed hosted 50 MB global
-- limit and exactly matches the accepted project submission policy ceiling.
insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
) values (
  'project-submissions',
  'project-submissions',
  false,
  41943040,
  array['application/pdf', 'image/png']::text[]
);

-- Deliberately create no storage.objects policy in Pass 2C1. The bucket stays
-- inert for anon/authenticated clients. Pass 2C2 will mint one exact short-lived
-- signed upload token from trusted server code after ownership and draft checks.

do $phase07$
declare
  item record;
  function_oid oid;
  exact_bucket_count integer;
  project_bucket_count integer;
  project_policy_count integer;
  object_count bigint;
  workflow_row_count bigint;
begin
  select count(*) into project_bucket_count
  from storage.buckets
  where id = 'project-submissions';

  select count(*) into exact_bucket_count
  from storage.buckets
  where id = 'project-submissions'
    and name = 'project-submissions'
    and public is false
    and file_size_limit = 41943040
    and allowed_mime_types = array['application/pdf', 'image/png']::text[];

  if project_bucket_count <> 1 or exact_bucket_count <> 1 then
    raise exception using
      errcode = '55000',
      message = 'project-submissions bucket metadata is not exact';
  end if;

  select count(*) into project_policy_count
  from pg_catalog.pg_policies
  where schemaname = 'storage'
    and tablename = 'objects'
    and (
      policyname ~* 'project'
      or coalesce(qual, '') ~* 'project-submissions'
      or coalesce(with_check, '') ~* 'project-submissions'
    );

  if project_policy_count <> 0 then
    raise exception using
      errcode = '55000',
      message = 'Pass 2C1 must preserve a closed browser Storage policy boundary';
  end if;

  select count(*) into object_count
  from storage.objects
  where bucket_id = 'project-submissions';

  if object_count <> 0 then
    raise exception using
      errcode = '55000',
      message = 'Pass 2C1 must not create project Storage objects';
  end if;

  select
    (select count(*) from private.project_staff_roles)
    + (select count(*) from private.project_reviewer_assignments)
    + (select count(*) from public.project_submissions)
    + (select count(*) from public.project_submission_versions)
    + (select count(*) from public.project_submission_files)
    + (select count(*) from public.project_reviews)
    + (select count(*) from public.project_review_criteria)
    + (select count(*) from public.project_status_events)
  into workflow_row_count;

  if workflow_row_count <> 0 then
    raise exception using
      errcode = '55000',
      message = 'Pass 2C1 must not create project workflow rows';
  end if;

  -- Re-pin all nine workflow definitions and execution privileges after the
  -- Storage-only mutation.
  for item in
    select *
    from (values
      ('public.assign_project_reviewer(uuid,uuid)', '07d99ba9d8ebcb18337212cd22ded91c', 'authenticated'),
      ('public.begin_project_review(uuid)', 'c9097e46fa20eec33673cfd3fca94382', 'authenticated'),
      ('public.create_project_draft(text)', 'b6ab7a9213dbd8dbfdfcb7326f014110', 'authenticated'),
      ('public.create_project_revision_draft(uuid)', 'ca9c53a9a3c12b087b44fad1c168ef73', 'authenticated'),
      ('public.decide_project_review(uuid,text,text,jsonb)', '44729ad70ff5014ec37a1463bc2392dd', 'authenticated'),
      ('public.resubmit_project(uuid)', 'dbc70626c4a2a831533995826d850071', 'authenticated'),
      ('public.set_project_staff_role(uuid,text,boolean,uuid)', '31b71b409acdb83dc8622a4a18949d4b', 'service_role'),
      ('public.submit_project(uuid)', '8525ca4c9241f48660ad33b589110c0a', 'authenticated'),
      ('public.update_project_draft(uuid,text,text)', '77357f0b4b260606b6df1d8219b8d890', 'authenticated')
    ) as expected(signature, definition_md5, expected_caller)
  loop
    function_oid := pg_catalog.to_regprocedure(item.signature);

    if function_oid is null
      or pg_catalog.md5(pg_catalog.pg_get_functiondef(function_oid))
        is distinct from item.definition_md5
      or pg_catalog.has_function_privilege('anon', function_oid, 'EXECUTE')
    then
      raise exception using
        errcode = '55000',
        message = 'workflow function changed during Pass 2C1: ' || item.signature;
    end if;

    if item.expected_caller = 'authenticated' and (
      not pg_catalog.has_function_privilege('authenticated', function_oid, 'EXECUTE')
      or pg_catalog.has_function_privilege('service_role', function_oid, 'EXECUTE')
    ) then
      raise exception using
        errcode = '55000',
        message = 'authenticated workflow privilege changed during Pass 2C1: ' || item.signature;
    end if;

    if item.expected_caller = 'service_role' and (
      pg_catalog.has_function_privilege('authenticated', function_oid, 'EXECUTE')
      or not pg_catalog.has_function_privilege('service_role', function_oid, 'EXECUTE')
    ) then
      raise exception using
        errcode = '55000',
        message = 'service-role workflow privilege changed during Pass 2C1: ' || item.signature;
    end if;
  end loop;
end;
$phase07$;

commit;
