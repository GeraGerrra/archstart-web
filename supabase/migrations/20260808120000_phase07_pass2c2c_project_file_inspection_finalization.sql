-- ARCH.START Phase 07.2C2C — project file inspection/finalization backend
-- Source-only migration. It creates no Storage object, public Storage policy,
-- UI, notification, certificate, deployment configuration, or Phase 08 code.

begin;

do $phase07$
declare
  bucket_matches boolean;
  project_policy_count integer;
begin
  if pg_catalog.to_regclass('private.project_upload_intents') is null
    or pg_catalog.to_regclass('public.project_submission_files') is null
    or pg_catalog.to_regprocedure(
      'public.create_project_upload_intent(uuid,text,text,bigint)'
    ) is null
    or pg_catalog.to_regprocedure(
      'public.cancel_project_upload_intent(uuid)'
    ) is null
  then
    raise exception using
      errcode = '55000',
      message = 'accepted Phase 07.2C2A upload-intent foundation is required';
  end if;

  if pg_catalog.to_regprocedure(
      'public.get_project_upload_finalization_context(uuid,uuid)'
    ) is not null
    or pg_catalog.to_regprocedure(
      'public.finalize_project_upload_intent(uuid,uuid,text,bigint,text,smallint,integer,integer)'
    ) is not null
    or pg_catalog.to_regprocedure(
      'public.close_project_upload_intent_after_inspection(uuid,uuid,text,text)'
    ) is not null
    or pg_catalog.to_regprocedure(
      'public.list_stale_project_upload_intents(uuid,integer)'
    ) is not null
    or pg_catalog.to_regprocedure(
      'public.authorize_project_file_download(uuid,uuid)'
    ) is not null
  then
    raise exception using
      errcode = '55000',
      message = 'Phase 07.2C2C finalization surface already exists';
  end if;

  select exists (
    select 1
    from storage.buckets as bucket
    where bucket.id = 'project-submissions'
      and bucket.name = 'project-submissions'
      and bucket.public is false
      and bucket.file_size_limit = 41943040
      and bucket.allowed_mime_types =
        array['application/pdf', 'image/png']::text[]
  ) into bucket_matches;

  select count(*) into project_policy_count
  from pg_catalog.pg_policies
  where schemaname = 'storage'
    and tablename = 'objects'
    and (
      policyname ~* 'project'
      or coalesce(qual, '') ~* 'project-submissions'
      or coalesce(with_check, '') ~* 'project-submissions'
    );

  if bucket_matches is not true or project_policy_count <> 0 then
    raise exception using
      errcode = '55000',
      message = 'accepted private project Storage boundary is absent or widened';
  end if;

  if (select count(*) from private.project_submission_policies where is_current) <> 8
    or (select count(*) from private.project_rubric_criteria) <> 40
    or pg_catalog.has_table_privilege(
      'authenticated', 'private.project_upload_intents', 'SELECT'
    )
  then
    raise exception using
      errcode = '55000',
      message = 'accepted project policy or private intent boundary drift';
  end if;
end;
$phase07$;

create or replace function public.get_project_upload_finalization_context(
  p_intent_id uuid,
  p_requester_id uuid
)
returns table (
  context_status text,
  intent_id uuid,
  planned_file_id uuid,
  finalized_file_id uuid,
  user_id uuid,
  submission_id uuid,
  version_id uuid,
  project_code text,
  policy_version smallint,
  bucket_id text,
  object_path text,
  original_filename text,
  declared_mime text,
  declared_size_bytes bigint,
  format_type text,
  allowed_mime_types text[],
  max_file_bytes bigint,
  expected_width integer,
  expected_height integer,
  min_page_count smallint,
  max_page_count smallint
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  intent_row private.project_upload_intents%rowtype;
  version_state text;
  version_user_id uuid;
  version_project_code text;
  version_policy_version smallint;
  submission_status text;
  submission_user_id uuid;
  policy_row private.project_submission_policies%rowtype;
  competing_file_id uuid;
  canonical_path text;
  status_value text;
begin
  if p_intent_id is null or p_requester_id is null then
    return;
  end if;

  select candidate.* into intent_row
  from private.project_upload_intents as candidate
  where candidate.id = p_intent_id
    and candidate.user_id = p_requester_id;

  if intent_row.id is null then
    return;
  end if;

  if intent_row.state = 'finalized' then
    if intent_row.finalized_file_id = intent_row.planned_file_id
      and exists (
        select 1
        from public.project_submission_files as file_row
        where file_row.id = intent_row.planned_file_id
          and file_row.version_id = intent_row.version_id
          and file_row.user_id = intent_row.user_id
          and file_row.bucket_id = intent_row.bucket_id
          and file_row.object_path = intent_row.object_path
          and file_row.validation_status = 'valid'
      )
    then
      return query select
        'finalized'::text,
        intent_row.id,
        intent_row.planned_file_id,
        intent_row.finalized_file_id,
        null::uuid,
        null::uuid,
        null::uuid,
        null::text,
        null::smallint,
        null::text,
        null::text,
        null::text,
        null::text,
        null::bigint,
        null::text,
        null::text[],
        null::bigint,
        null::integer,
        null::integer,
        null::smallint,
        null::smallint;
    end if;
    return;
  end if;

  if intent_row.state <> 'pending' then
    return;
  end if;

  select
    version_row.version_state,
    version_row.user_id,
    version_row.project_code,
    version_row.policy_version,
    submission_row.current_status,
    submission_row.user_id
  into
    version_state,
    version_user_id,
    version_project_code,
    version_policy_version,
    submission_status,
    submission_user_id
  from public.project_submission_versions as version_row
  join public.project_submissions as submission_row
    on submission_row.id = version_row.submission_id
  where version_row.id = intent_row.version_id
    and version_row.submission_id = intent_row.submission_id;

  select policy.* into policy_row
  from private.project_submission_policies as policy
  where policy.project_code = intent_row.project_code
    and policy.policy_version = intent_row.policy_version;

  select file_row.id into competing_file_id
  from public.project_submission_files as file_row
  where file_row.version_id = intent_row.version_id
  limit 1;

  canonical_path :=
    intent_row.user_id::text || '/' ||
    intent_row.submission_id::text || '/' ||
    intent_row.version_id::text || '/' ||
    intent_row.planned_file_id::text || '.' ||
    case intent_row.declared_mime
      when 'application/pdf' then 'pdf'
      when 'image/png' then 'png'
      else 'invalid'
    end;

  if competing_file_id is not null then
    status_value := 'blocked';
  elsif intent_row.expires_at <= now() then
    status_value := 'cleanup_expired';
  elsif version_state is distinct from 'draft'
    or submission_status not in ('draft', 'revisions_required', 'not_accepted')
    or version_user_id is distinct from intent_row.user_id
    or submission_user_id is distinct from intent_row.user_id
    or version_project_code is distinct from intent_row.project_code
    or version_policy_version is distinct from intent_row.policy_version
    or intent_row.bucket_id <> 'project-submissions'
    or intent_row.object_path <> canonical_path
    or not (intent_row.declared_mime = any(policy_row.allowed_mime_types))
    or intent_row.declared_size_bytes < 1
    or intent_row.declared_size_bytes > policy_row.max_file_bytes
  then
    status_value := 'cleanup_inconsistent';
  else
    status_value := 'inspect';
  end if;

  if status_value = 'blocked' then
    return query select
      status_value,
      intent_row.id,
      intent_row.planned_file_id,
      null::uuid,
      null::uuid,
      null::uuid,
      null::uuid,
      null::text,
      null::smallint,
      null::text,
      null::text,
      null::text,
      null::text,
      null::bigint,
      null::text,
      null::text[],
      null::bigint,
      null::integer,
      null::integer,
      null::smallint,
      null::smallint;
    return;
  end if;

  return query select
    status_value,
    intent_row.id,
    intent_row.planned_file_id,
    null::uuid,
    intent_row.user_id,
    intent_row.submission_id,
    intent_row.version_id,
    intent_row.project_code,
    intent_row.policy_version,
    intent_row.bucket_id,
    intent_row.object_path,
    intent_row.original_filename,
    intent_row.declared_mime,
    intent_row.declared_size_bytes,
    case when status_value = 'inspect' then policy_row.format_type else null end,
    case when status_value = 'inspect' then policy_row.allowed_mime_types else null end,
    case when status_value = 'inspect' then policy_row.max_file_bytes else null end,
    case when status_value = 'inspect' then policy_row.expected_width else null end,
    case when status_value = 'inspect' then policy_row.expected_height else null end,
    case when status_value = 'inspect' then policy_row.min_page_count else null end,
    case when status_value = 'inspect' then policy_row.max_page_count else null end;
end;
$function$;

create or replace function public.finalize_project_upload_intent(
  p_intent_id uuid,
  p_requester_id uuid,
  p_sha256 text,
  p_actual_size_bytes bigint,
  p_detected_mime text,
  p_page_count smallint,
  p_pixel_width integer,
  p_pixel_height integer
)
returns table (
  intent_id uuid,
  file_id uuid,
  intent_state text,
  reused boolean
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  pre_read_version_id uuid;
  intent_row private.project_upload_intents%rowtype;
  version_row public.project_submission_versions%rowtype;
  submission_row public.project_submissions%rowtype;
  policy_row private.project_submission_policies%rowtype;
  competing_file_id uuid;
  canonical_path text;
  normalized_sha256 text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_sha256, '')));
begin
  if p_intent_id is null or p_requester_id is null then
    raise exception using errcode = '22023', message = 'finalization identity is required';
  end if;

  -- Identity-only pre-read: the version key is needed to take the same
  -- transaction lock as create_project_upload_intent. It is never returned.
  select candidate.version_id into pre_read_version_id
  from private.project_upload_intents as candidate
  where candidate.id = p_intent_id
    and candidate.user_id = p_requester_id;

  if pre_read_version_id is null then
    raise exception using errcode = '42501', message = 'owned upload intent not found';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext(p_requester_id::text),
    pg_catalog.hashtext(pre_read_version_id::text)
  );

  -- Match create_project_upload_intent: version/submission rows are locked
  -- before the potentially conflicting intent row.
  select version_candidate.* into version_row
  from public.project_submission_versions as version_candidate
  where version_candidate.id = pre_read_version_id
    and version_candidate.user_id = p_requester_id
  for update;

  select submission_candidate.* into submission_row
  from public.project_submissions as submission_candidate
  where submission_candidate.id = version_row.submission_id
    and submission_candidate.user_id = p_requester_id
  for update;

  select candidate.* into intent_row
  from private.project_upload_intents as candidate
  where candidate.id = p_intent_id
  for update;

  if intent_row.id is null then
    raise exception using errcode = '42501', message = 'owned upload intent not found';
  end if;

  if version_row.id is null
    or submission_row.id is null
    or intent_row.user_id is distinct from p_requester_id
    or intent_row.version_id is distinct from pre_read_version_id
    or intent_row.submission_id is distinct from version_row.submission_id
    or submission_row.id is distinct from version_row.submission_id
  then
    raise exception using errcode = '55000', message = 'locked upload intent identity is inconsistent';
  end if;

  if intent_row.state = 'finalized' then
    if intent_row.finalized_file_id = intent_row.planned_file_id
      and exists (
        select 1
        from public.project_submission_files as file_row
        where file_row.id = intent_row.planned_file_id
          and file_row.version_id = intent_row.version_id
          and file_row.user_id = intent_row.user_id
          and file_row.object_path = intent_row.object_path
          and file_row.validation_status = 'valid'
      )
    then
      return query select intent_row.id, intent_row.planned_file_id, 'finalized'::text, true;
      return;
    end if;
    raise exception using errcode = '55000', message = 'finalized upload identity is inconsistent';
  end if;

  if intent_row.state <> 'pending' or intent_row.expires_at <= now() then
    raise exception using errcode = '55000', message = 'upload intent is not finalizable';
  end if;

  select policy_candidate.* into policy_row
  from private.project_submission_policies as policy_candidate
  where policy_candidate.project_code = intent_row.project_code
    and policy_candidate.policy_version = intent_row.policy_version;

  canonical_path :=
    intent_row.user_id::text || '/' ||
    intent_row.submission_id::text || '/' ||
    intent_row.version_id::text || '/' ||
    intent_row.planned_file_id::text || '.' ||
    case intent_row.declared_mime
      when 'application/pdf' then 'pdf'
      when 'image/png' then 'png'
      else 'invalid'
    end;

  if version_row.id is null
    or submission_row.id is null
    or policy_row.project_code is null
    or version_row.version_state <> 'draft'
    or submission_row.current_status not in ('draft', 'revisions_required', 'not_accepted')
    or version_row.user_id is distinct from intent_row.user_id
    or submission_row.user_id is distinct from intent_row.user_id
    or version_row.project_code is distinct from intent_row.project_code
    or version_row.policy_version is distinct from intent_row.policy_version
    or intent_row.bucket_id <> 'project-submissions'
    or intent_row.object_path <> canonical_path
  then
    raise exception using errcode = '55000', message = 'trusted finalization context is inconsistent';
  end if;

  select file_row.id into competing_file_id
  from public.project_submission_files as file_row
  where file_row.version_id = intent_row.version_id
  limit 1
  for update;

  if competing_file_id is not null then
    raise exception using errcode = '23505', message = 'project version already has a final file';
  end if;

  if normalized_sha256 !~ '^[0-9a-f]{64}$'
    or p_actual_size_bytes is distinct from intent_row.declared_size_bytes
    or p_actual_size_bytes < 1
    or p_actual_size_bytes > 41943040
    or p_actual_size_bytes > policy_row.max_file_bytes
    or p_detected_mime is distinct from intent_row.declared_mime
    or not (p_detected_mime = any(policy_row.allowed_mime_types))
  then
    raise exception using errcode = '23514', message = 'inspected file facts do not satisfy frozen policy';
  end if;

  if p_detected_mime = 'application/pdf' then
    if p_page_count is null
      or p_page_count < policy_row.min_page_count
      or p_page_count > policy_row.max_page_count
      or p_pixel_width is not null
      or p_pixel_height is not null
    then
      raise exception using errcode = '23514', message = 'inspected PDF shape does not satisfy frozen policy';
    end if;
  elsif p_detected_mime = 'image/png' then
    if policy_row.format_type <> 'SINGLE_BOARD'
      or p_page_count is not null
      or p_pixel_width is distinct from policy_row.expected_width
      or p_pixel_height is distinct from policy_row.expected_height
    then
      raise exception using errcode = '23514', message = 'inspected PNG shape does not satisfy frozen policy';
    end if;
  else
    raise exception using errcode = '23514', message = 'inspected MIME is unsupported';
  end if;

  perform pg_catalog.set_config('archstart.project_file_write_authorized', 'on', true);
  perform pg_catalog.set_config('archstart.project_upload_intent_write_authorized', 'on', true);

  insert into public.project_submission_files (
    id,
    version_id,
    user_id,
    file_role,
    bucket_id,
    object_path,
    original_filename,
    declared_mime,
    detected_mime,
    size_bytes,
    sha256,
    validation_status,
    scan_status,
    page_count,
    pixel_width,
    pixel_height
  ) values (
    intent_row.planned_file_id,
    intent_row.version_id,
    intent_row.user_id,
    'primary',
    intent_row.bucket_id,
    intent_row.object_path,
    intent_row.original_filename,
    intent_row.declared_mime,
    p_detected_mime,
    p_actual_size_bytes,
    normalized_sha256,
    'valid',
    'not_required',
    p_page_count,
    p_pixel_width,
    p_pixel_height
  );

  update private.project_upload_intents as updated_intent
  set
    state = 'finalized',
    closed_at = now(),
    closed_reason = 'validated_and_finalized',
    finalized_file_id = intent_row.planned_file_id
  where updated_intent.id = intent_row.id;

  return query select intent_row.id, intent_row.planned_file_id, 'finalized'::text, false;
end;
$function$;

create or replace function public.close_project_upload_intent_after_inspection(
  p_intent_id uuid,
  p_requester_id uuid,
  p_close_state text,
  p_reason text
)
returns table (
  intent_id uuid,
  intent_state text,
  closed_reason text,
  reused boolean
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  intent_row private.project_upload_intents%rowtype;
  requester_is_admin boolean;
  stable_reasons constant text[] := array[
    'object_missing',
    'object_size_out_of_bounds',
    'declared_size_mismatch',
    'unsupported_actual_mime',
    'declared_mime_mismatch',
    'malformed_png',
    'invalid_png_dimensions',
    'malformed_pdf',
    'encrypted_or_unsupported_pdf',
    'invalid_pdf_page_count',
    'frozen_policy_mismatch',
    'expired_before_finalization',
    'inconsistent_finalization_context',
    'expired_stale_cleanup'
  ]::text[];
begin
  if p_intent_id is null
    or p_requester_id is null
    or p_close_state not in ('rejected', 'expired')
    or not (p_reason = any(stable_reasons))
    or (p_close_state = 'expired') is distinct from
      (p_reason in ('expired_before_finalization', 'expired_stale_cleanup'))
  then
    raise exception using errcode = '22023', message = 'stable close state and reason are required';
  end if;

  requester_is_admin := private.project_staff_has_role(
    p_requester_id,
    array['admin']::text[]
  );

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext(p_requester_id::text),
    pg_catalog.hashtext(p_intent_id::text)
  );

  select candidate.* into intent_row
  from private.project_upload_intents as candidate
  where candidate.id = p_intent_id
    and (candidate.user_id = p_requester_id or requester_is_admin)
  for update;

  if intent_row.id is null then
    raise exception using errcode = '42501', message = 'closable upload intent not found';
  end if;

  if intent_row.state = 'finalized' then
    raise exception using errcode = '55000', message = 'finalized upload intent cannot be closed';
  end if;

  if intent_row.state <> 'pending' then
    return query select intent_row.id, intent_row.state, intent_row.closed_reason, true;
    return;
  end if;

  perform pg_catalog.set_config('archstart.project_upload_intent_write_authorized', 'on', true);
  update private.project_upload_intents as updated_intent
  set
    state = p_close_state,
    closed_at = now(),
    closed_reason = p_reason,
    finalized_file_id = null
  where updated_intent.id = intent_row.id;

  return query select intent_row.id, p_close_state, p_reason, false;
end;
$function$;

create or replace function public.list_stale_project_upload_intents(
  p_requester_id uuid,
  p_limit integer
)
returns table (
  intent_id uuid,
  planned_file_id uuid,
  user_id uuid,
  submission_id uuid,
  version_id uuid,
  bucket_id text,
  object_path text,
  declared_mime text
)
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if p_requester_id is null
    or p_limit is distinct from 20
    or not private.project_staff_has_role(
      p_requester_id,
      array['admin']::text[]
    )
  then
    raise exception using errcode = '42501', message = 'active admin is required';
  end if;

  return query
  select
    intent_row.id,
    intent_row.planned_file_id,
    intent_row.user_id,
    intent_row.submission_id,
    intent_row.version_id,
    intent_row.bucket_id,
    intent_row.object_path,
    intent_row.declared_mime
  from private.project_upload_intents as intent_row
  where intent_row.state in ('pending', 'expired', 'cancelled')
    and intent_row.expires_at <= now()
    and intent_row.finalized_file_id is null
    and (
      intent_row.state = 'pending'
      or (
        intent_row.state in ('expired', 'cancelled')
        and exists (
          select 1
          from storage.objects as object_row
          where object_row.bucket_id = intent_row.bucket_id
            and object_row.name = intent_row.object_path
        )
      )
    )
    and not exists (
      select 1
      from public.project_submission_files as file_row
      where file_row.id = intent_row.planned_file_id
        or (
          file_row.bucket_id = intent_row.bucket_id
          and file_row.object_path = intent_row.object_path
        )
    )
  order by intent_row.expires_at, intent_row.id
  limit 20;
end;
$function$;

create or replace function public.authorize_project_file_download(
  p_file_id uuid,
  p_requester_id uuid
)
returns table (
  file_id uuid,
  user_id uuid,
  submission_id uuid,
  version_id uuid,
  bucket_id text,
  object_path text,
  declared_mime text
)
language sql
stable
security definer
set search_path = ''
as $function$
  select
    file_row.id,
    file_row.user_id,
    version_row.submission_id,
    file_row.version_id,
    file_row.bucket_id,
    file_row.object_path,
    file_row.declared_mime
  from public.project_submission_files as file_row
  join public.project_submission_versions as version_row
    on version_row.id = file_row.version_id
  where file_row.id = p_file_id
    and file_row.validation_status = 'valid'
    and (
      file_row.user_id = p_requester_id
      or private.project_staff_has_role(
        p_requester_id,
        array['admin']::text[]
      )
      or (
        private.project_staff_has_role(
          p_requester_id,
          array['reviewer']::text[]
        )
        and exists (
          select 1
          from private.project_reviewer_assignments as assignment
          where assignment.submission_id = version_row.submission_id
            and assignment.reviewer_id = p_requester_id
            and assignment.released_at is null
        )
      )
    );
$function$;

revoke all on function
  public.get_project_upload_finalization_context(uuid, uuid),
  public.finalize_project_upload_intent(uuid, uuid, text, bigint, text, smallint, integer, integer),
  public.close_project_upload_intent_after_inspection(uuid, uuid, text, text),
  public.list_stale_project_upload_intents(uuid, integer),
  public.authorize_project_file_download(uuid, uuid)
from public, anon, authenticated, service_role;

grant execute on function
  public.get_project_upload_finalization_context(uuid, uuid),
  public.finalize_project_upload_intent(uuid, uuid, text, bigint, text, smallint, integer, integer),
  public.close_project_upload_intent_after_inspection(uuid, uuid, text, text),
  public.list_stale_project_upload_intents(uuid, integer),
  public.authorize_project_file_download(uuid, uuid)
to service_role;

comment on function public.get_project_upload_finalization_context(uuid, uuid) is
  'Service-role-only trusted context resolver. Expired/inconsistent rows expose cleanup disposition, never inspection context.';
comment on function public.finalize_project_upload_intent(uuid, uuid, text, bigint, text, smallint, integer, integer) is
  'Service-role-only idempotent transactional finalizer for one inspected project file.';
comment on function public.close_project_upload_intent_after_inspection(uuid, uuid, text, text) is
  'Service-role-only allowlisted close operation used only after exact-path cleanup.';
comment on function public.list_stale_project_upload_intents(uuid, integer) is
  'Service-role-only fixed twenty-row cleanup batch for an active admin.';
comment on function public.authorize_project_file_download(uuid, uuid) is
  'Service-role-only owner/admin/assigned-reviewer private download authorization.';

do $phase07$
declare
  item record;
  function_oid oid;
  accepted_count integer := 0;
begin
  for item in
    select * from (values
      ('public.get_project_upload_finalization_context(uuid,uuid)'),
      ('public.finalize_project_upload_intent(uuid,uuid,text,bigint,text,smallint,integer,integer)'),
      ('public.close_project_upload_intent_after_inspection(uuid,uuid,text,text)'),
      ('public.list_stale_project_upload_intents(uuid,integer)'),
      ('public.authorize_project_file_download(uuid,uuid)')
    ) as expected(signature)
  loop
    function_oid := pg_catalog.to_regprocedure(item.signature);
    if function_oid is null
      or not exists (
        select 1 from pg_catalog.pg_proc as procedure
        where procedure.oid = function_oid
          and procedure.prosecdef
          and procedure.proconfig is not distinct from array['search_path=""']::text[]
      )
      or pg_catalog.has_function_privilege('anon', function_oid, 'EXECUTE')
      or pg_catalog.has_function_privilege('authenticated', function_oid, 'EXECUTE')
      or not pg_catalog.has_function_privilege('service_role', function_oid, 'EXECUTE')
    then
      raise exception using
        errcode = '55000',
        message = 'Phase 07.2C2C RPC hardening postcondition failed: ' || item.signature;
    end if;
    accepted_count := accepted_count + 1;
  end loop;

  if accepted_count <> 5
    or exists (
      select 1
      from pg_catalog.pg_policies
      where schemaname = 'storage'
        and tablename = 'objects'
        and (
          policyname ~* 'project'
          or coalesce(qual, '') ~* 'project-submissions'
          or coalesce(with_check, '') ~* 'project-submissions'
        )
    )
  then
    raise exception using errcode = '55000', message = 'Phase 07.2C2C boundary postcondition failed';
  end if;
end;
$phase07$;

commit;
