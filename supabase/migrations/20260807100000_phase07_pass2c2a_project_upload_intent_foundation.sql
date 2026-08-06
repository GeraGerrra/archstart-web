-- ARCH.START Phase 07.2C2A — project upload-intent database foundation
-- Database reservation only. No signed token, transfer, Storage object,
-- Storage policy, byte inspection, final file row, UI, dependency, Vercel,
-- R2, email, gallery, or certificate change.

begin;

-- ---------------------------------------------------------------------------
-- Accepted predecessor and hosted-state preflight
-- ---------------------------------------------------------------------------

do $phase07$
declare
  item record;
  function_oid oid;
  project_row_count bigint;
  project_object_count bigint;
  project_object_policy_count integer;
  storage_rls_count integer;
begin
  if pg_catalog.to_regclass('private.project_upload_intents') is not null
    or pg_catalog.to_regprocedure(
      'public.create_project_upload_intent(uuid,text,text,bigint)'
    ) is not null
    or pg_catalog.to_regprocedure(
      'public.cancel_project_upload_intent(uuid)'
    ) is not null
  then
    raise exception using
      errcode = '55000',
      message = 'Phase 07.2C2A upload-intent surface already exists';
  end if;

  if not exists (
    select 1
    from storage.buckets as bucket
    where bucket.id = 'project-submissions'
      and bucket.name = 'project-submissions'
      and bucket.public is false
      and bucket.file_size_limit = 41943040
      and bucket.allowed_mime_types =
        array['application/pdf', 'image/png']::text[]
  ) then
    raise exception using
      errcode = '55000',
      message = 'accepted Phase 07.2C1 private bucket identity is absent or drifted';
  end if;

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
      message = 'storage.buckets and storage.objects must retain RLS';
  end if;

  select count(*) into project_object_policy_count
  from pg_catalog.pg_policies
  where schemaname = 'storage'
    and tablename = 'objects'
    and (
      policyname ~* 'project'
      or coalesce(qual, '') ~* 'project-submissions'
      or coalesce(with_check, '') ~* 'project-submissions'
    );

  if project_object_policy_count <> 0 then
    raise exception using
      errcode = '55000',
      message = 'project Storage policies must remain absent before Pass 2C2A';
  end if;

  select count(*) into project_object_count
  from storage.objects
  where bucket_id = 'project-submissions';

  if project_object_count <> 0 then
    raise exception using
      errcode = '55000',
      message = 'project Storage bucket must remain empty before Pass 2C2A';
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
  into project_row_count;

  if project_row_count <> 0 then
    raise exception using
      errcode = '55000',
      message = 'project workflow rows must be zero before Pass 2C2A';
  end if;

  if (select count(*) from private.project_submission_policies where is_current) <> 8
    or (select count(*) from private.project_rubric_criteria) <> 40
  then
    raise exception using
      errcode = '55000',
      message = 'project policy or rubric predecessor count drift';
  end if;

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
      ('public.update_project_draft(uuid,text,text)', '77357f0b4b260606b6df1d8219b8d890', 'authenticated'),
      ('private.stamp_project_submission_file()', 'b6867773f5ba18b11489bd508164ead0', 'service_role')
    ) as expected(signature, definition_md5, expected_caller)
  loop
    function_oid := pg_catalog.to_regprocedure(item.signature);

    if function_oid is null
      or pg_catalog.md5(pg_catalog.pg_get_functiondef(function_oid))
        is distinct from item.definition_md5
    then
      raise exception using
        errcode = '55000',
        message = 'accepted project function identity drift: ' || item.signature;
    end if;

    if not exists (
      select 1
      from pg_catalog.pg_proc as procedure
      where procedure.oid = function_oid
        and procedure.prosecdef
        and procedure.proconfig is not distinct from
          array['search_path=""']::text[]
    ) then
      raise exception using
        errcode = '55000',
        message = 'accepted project-function hardening drift: ' || item.signature;
    end if;

    if pg_catalog.has_function_privilege('anon', function_oid, 'EXECUTE') then
      raise exception using
        errcode = '55000',
        message = 'anonymous project-function privilege drift: ' || item.signature;
    end if;

    if item.expected_caller = 'authenticated' then
      if not pg_catalog.has_function_privilege(
          'authenticated',
          function_oid,
          'EXECUTE'
        )
        or pg_catalog.has_function_privilege(
          'service_role',
          function_oid,
          'EXECUTE'
        )
      then
        raise exception using
          errcode = '55000',
          message = 'authenticated project-function privilege drift: ' ||
            item.signature;
      end if;
    elsif item.expected_caller = 'service_role' then
      if pg_catalog.has_function_privilege(
          'authenticated',
          function_oid,
          'EXECUTE'
        )
        or not pg_catalog.has_function_privilege(
          'service_role',
          function_oid,
          'EXECUTE'
        )
      then
        raise exception using
          errcode = '55000',
          message = 'service-role project-function privilege drift: ' ||
            item.signature;
      end if;
    else
      raise exception using
        errcode = '55000',
        message = 'unsupported predecessor caller contract: ' || item.signature;
    end if;
  end loop;
end;
$phase07$;

-- ---------------------------------------------------------------------------
-- Private intent table and guarded lifecycle
-- ---------------------------------------------------------------------------

create table private.project_upload_intents (
  id uuid primary key default gen_random_uuid(),
  planned_file_id uuid not null unique default gen_random_uuid(),
  user_id uuid not null
    references auth.users(id)
    on delete cascade,
  submission_id uuid not null
    references public.project_submissions(id)
    on delete cascade,
  version_id uuid not null,
  project_code text not null,
  policy_version smallint not null,
  bucket_id text not null default 'project-submissions',
  object_path text not null unique,
  original_filename text not null,
  declared_mime text not null,
  declared_size_bytes bigint not null,
  transfer_mode text not null,
  state text not null default 'pending',
  expires_at timestamptz not null,
  closed_at timestamptz,
  closed_reason text,
  finalized_file_id uuid unique
    references public.project_submission_files(id)
    on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_upload_intent_version_fk
    foreign key (submission_id, version_id)
    references public.project_submission_versions(submission_id, id)
    on delete cascade,
  constraint project_upload_intent_policy_fk
    foreign key (project_code, policy_version)
    references private.project_submission_policies(project_code, policy_version)
    on update cascade
    on delete restrict,
  constraint project_upload_intent_bucket
    check (bucket_id = 'project-submissions'),
  constraint project_upload_intent_filename
    check (
      char_length(original_filename) between 1 and 255
      and pg_catalog.strpos(original_filename, '/') = 0
      and pg_catalog.strpos(original_filename, pg_catalog.chr(92)) = 0
      and (
        declared_mime = 'application/pdf'
        and pg_catalog.right(pg_catalog.lower(original_filename), 4) = '.pdf'
        or declared_mime = 'image/png'
        and pg_catalog.right(pg_catalog.lower(original_filename), 4) = '.png'
      )
    ),
  constraint project_upload_intent_mime
    check (declared_mime in ('application/pdf', 'image/png')),
  constraint project_upload_intent_size
    check (declared_size_bytes between 1 and 41943040),
  constraint project_upload_intent_transfer_mode
    check (
      declared_size_bytes <= 6291456 and transfer_mode = 'standard'
      or declared_size_bytes > 6291456 and transfer_mode = 'tus'
    ),
  constraint project_upload_intent_state
    check (
      state in ('pending', 'finalized', 'rejected', 'cancelled', 'expired')
    ),
  constraint project_upload_intent_expiry
    check (expires_at = created_at + interval '2 hours'),
  constraint project_upload_intent_close_reason
    check (closed_reason is null or char_length(closed_reason) between 1 and 240),
  constraint project_upload_intent_final_file_identity
    check (finalized_file_id is null or finalized_file_id = planned_file_id),
  constraint project_upload_intent_lifecycle
    check (
      state = 'pending'
      and closed_at is null
      and closed_reason is null
      and finalized_file_id is null
      or state = 'finalized'
      and closed_at is not null
      and closed_reason is not null
      and finalized_file_id is not null
      or state in ('rejected', 'cancelled', 'expired')
      and closed_at is not null
      and closed_reason is not null
      and finalized_file_id is null
    ),
  constraint project_upload_intent_object_path
    check (
      object_path =
        user_id::text || '/' ||
        submission_id::text || '/' ||
        version_id::text || '/' ||
        planned_file_id::text || '.' ||
        case declared_mime
          when 'application/pdf' then 'pdf'
          when 'image/png' then 'png'
        end
    )
);

create unique index project_upload_intent_one_pending_version_idx
on private.project_upload_intents (version_id)
where state = 'pending';

create index project_upload_intents_user_recent_idx
on private.project_upload_intents (user_id, created_at desc);

create index project_upload_intents_pending_expiry_idx
on private.project_upload_intents (expires_at)
where state = 'pending';

create or replace function private.stamp_project_upload_intent()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  owner_id uuid;
  parent_project_code text;
  parent_policy_version smallint;
  parent_version_state text;
  parent_submission_status text;
  policy_mime_types text[];
  policy_max_bytes bigint;
  extension text;
  stamp timestamptz := now();
begin
  if coalesce(
    pg_catalog.current_setting(
      'archstart.project_upload_intent_write_authorized',
      true
    ),
    ''
  ) <> 'on'
  then
    raise exception using
      errcode = '42501',
      message = 'project upload-intent writes require an authorized workflow';
  end if;

  if tg_op = 'INSERT' then
    select
      version_row.user_id,
      version_row.project_code,
      version_row.policy_version,
      version_row.version_state,
      submission_row.current_status,
      policy_row.allowed_mime_types,
      policy_row.max_file_bytes
    into
      owner_id,
      parent_project_code,
      parent_policy_version,
      parent_version_state,
      parent_submission_status,
      policy_mime_types,
      policy_max_bytes
    from public.project_submission_versions as version_row
    join public.project_submissions as submission_row
      on submission_row.id = version_row.submission_id
    join private.project_submission_policies as policy_row
      on policy_row.project_code = version_row.project_code
      and policy_row.policy_version = version_row.policy_version
    where version_row.id = new.version_id
      and version_row.submission_id = new.submission_id;

    if owner_id is null then
      raise exception using
        errcode = '23503',
        message = 'project upload-intent parent draft does not exist';
    end if;

    if new.user_id is distinct from owner_id then
      raise exception using
        errcode = '42501',
        message = 'project upload-intent owner mismatch';
    end if;

    if parent_version_state <> 'draft'
      or parent_submission_status not in (
        'draft',
        'revisions_required',
        'not_accepted'
      )
    then
      raise exception using
        errcode = '55000',
        message = 'project upload intent requires an editable draft';
    end if;

    new.original_filename := pg_catalog.btrim(new.original_filename);
    new.declared_mime := pg_catalog.lower(
      pg_catalog.btrim(new.declared_mime)
    );

    if not (new.declared_mime = any(policy_mime_types))
      or new.declared_size_bytes < 1
      or new.declared_size_bytes > policy_max_bytes
    then
      raise exception using
        errcode = '23514',
        message = 'declared project file does not satisfy the version policy';
    end if;

    extension := case new.declared_mime
      when 'application/pdf' then 'pdf'
      when 'image/png' then 'png'
      else null
    end;

    if extension is null then
      raise exception using
        errcode = '23514',
        message = 'unsupported project upload MIME type';
    end if;

    new.id := coalesce(new.id, gen_random_uuid());
    new.planned_file_id := coalesce(new.planned_file_id, gen_random_uuid());
    new.user_id := owner_id;
    new.project_code := parent_project_code;
    new.policy_version := parent_policy_version;
    new.bucket_id := 'project-submissions';
    new.transfer_mode := case
      when new.declared_size_bytes <= 6291456 then 'standard'
      else 'tus'
    end;
    new.state := 'pending';
    new.created_at := stamp;
    new.updated_at := stamp;
    new.expires_at := stamp + interval '2 hours';
    new.closed_at := null;
    new.closed_reason := null;
    new.finalized_file_id := null;
    new.object_path :=
      owner_id::text || '/' ||
      new.submission_id::text || '/' ||
      new.version_id::text || '/' ||
      new.planned_file_id::text || '.' || extension;

    return new;
  end if;

  new.id := old.id;
  new.planned_file_id := old.planned_file_id;
  new.user_id := old.user_id;
  new.submission_id := old.submission_id;
  new.version_id := old.version_id;
  new.project_code := old.project_code;
  new.policy_version := old.policy_version;
  new.bucket_id := old.bucket_id;
  new.object_path := old.object_path;
  new.original_filename := old.original_filename;
  new.declared_mime := old.declared_mime;
  new.declared_size_bytes := old.declared_size_bytes;
  new.transfer_mode := old.transfer_mode;
  new.expires_at := old.expires_at;
  new.created_at := old.created_at;

  if old.state <> 'pending' and new.state is distinct from old.state then
    raise exception using
      errcode = '55000',
      message = 'terminal project upload-intent state is immutable';
  end if;

  if new.state = old.state then
    new.closed_at := old.closed_at;
    new.closed_reason := old.closed_reason;
    new.finalized_file_id := old.finalized_file_id;
  elsif new.state = 'finalized' then
    new.closed_at := coalesce(new.closed_at, stamp);

    if new.closed_reason is null
      or new.finalized_file_id is distinct from old.planned_file_id
    then
      raise exception using
        errcode = '23514',
        message = 'finalized upload intent requires its planned file identity';
    end if;
  elsif new.state in ('rejected', 'cancelled', 'expired') then
    new.closed_at := coalesce(new.closed_at, stamp);
    new.finalized_file_id := null;

    if new.closed_reason is null then
      raise exception using
        errcode = '23514',
        message = 'closed upload intent requires a reason';
    end if;
  else
    raise exception using
      errcode = '23514',
      message = 'invalid project upload-intent transition';
  end if;

  new.updated_at := stamp;
  return new;
end;
$function$;

create or replace function private.reject_project_upload_intent_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  raise exception using
    errcode = '42501',
    message = 'project upload-intent history is immutable';
end;
$function$;

create trigger on_project_upload_intent_stamp
before insert or update on private.project_upload_intents
for each row execute function private.stamp_project_upload_intent();

create trigger on_project_upload_intent_reject_delete
before delete on private.project_upload_intents
for each row execute function private.reject_project_upload_intent_delete();

alter table private.project_upload_intents enable row level security;

revoke all on table private.project_upload_intents
from public, anon, authenticated;

grant select, insert, update
on table private.project_upload_intents
  to service_role;

-- ---------------------------------------------------------------------------
-- Narrow authenticated intent workflows
-- ---------------------------------------------------------------------------

create or replace function public.create_project_upload_intent(
  p_version_id uuid,
  p_original_filename text,
  p_declared_mime text,
  p_declared_size_bytes bigint
)
returns table (
  intent_id uuid,
  planned_file_id uuid,
  submission_id uuid,
  version_id uuid,
  bucket_id text,
  object_path text,
  original_filename text,
  declared_mime text,
  declared_size_bytes bigint,
  transfer_mode text,
  intent_state text,
  expires_at timestamptz,
  reused boolean
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  current_user_id uuid := (select auth.uid());
  normalized_filename text := pg_catalog.btrim(
    coalesce(p_original_filename, '')
  );
  normalized_mime text := pg_catalog.lower(
    pg_catalog.btrim(coalesce(p_declared_mime, ''))
  );
  found_submission_id uuid;
  found_project_code text;
  found_policy_version smallint;
  found_version_state text;
  found_submission_status text;
  policy_mime_types text[];
  policy_max_bytes bigint;
  existing_intent private.project_upload_intents%rowtype;
  created_intent private.project_upload_intents%rowtype;
begin
  if current_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'authenticated user required';
  end if;

  if p_version_id is null
    or normalized_filename = ''
    or normalized_mime = ''
    or p_declared_size_bytes is null
  then
    raise exception using
      errcode = '22023',
      message = 'version, filename, MIME, and byte size are required';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext(current_user_id::text),
    pg_catalog.hashtext(p_version_id::text)
  );

  select
    version_row.submission_id,
    version_row.project_code,
    version_row.policy_version,
    version_row.version_state,
    submission_row.current_status,
    policy_row.allowed_mime_types,
    policy_row.max_file_bytes
  into
    found_submission_id,
    found_project_code,
    found_policy_version,
    found_version_state,
    found_submission_status,
    policy_mime_types,
    policy_max_bytes
  from public.project_submission_versions as version_row
  join public.project_submissions as submission_row
    on submission_row.id = version_row.submission_id
  join private.project_submission_policies as policy_row
    on policy_row.project_code = version_row.project_code
    and policy_row.policy_version = version_row.policy_version
  where version_row.id = p_version_id
    and version_row.user_id = current_user_id
    and submission_row.user_id = current_user_id
  for update of version_row, submission_row;

  if found_submission_id is null then
    raise exception using
      errcode = '42501',
      message = 'owned project draft not found';
  end if;

  if found_version_state <> 'draft'
    or found_submission_status not in (
      'draft',
      'revisions_required',
      'not_accepted'
    )
  then
    raise exception using
      errcode = '55000',
      message = 'project upload intent requires an editable draft';
  end if;

  if char_length(normalized_filename) > 255
    or pg_catalog.strpos(normalized_filename, '/') <> 0
    or pg_catalog.strpos(normalized_filename, pg_catalog.chr(92)) <> 0
    or (
      normalized_mime = 'application/pdf'
      and pg_catalog.right(pg_catalog.lower(normalized_filename), 4) <> '.pdf'
    )
    or (
      normalized_mime = 'image/png'
      and pg_catalog.right(pg_catalog.lower(normalized_filename), 4) <> '.png'
    )
  then
    raise exception using
      errcode = '22023',
      message = 'project filename does not match the declared MIME type';
  end if;

  if not (normalized_mime = any(policy_mime_types))
    or p_declared_size_bytes < 1
    or p_declared_size_bytes > policy_max_bytes
  then
    raise exception using
      errcode = '23514',
      message = 'declared project file does not satisfy the version policy';
  end if;

  if exists (
    select 1
    from public.project_submission_files as file_row
    where file_row.version_id = p_version_id
  ) then
    raise exception using
      errcode = '55000',
      message = 'project version already has finalized file metadata';
  end if;

  select intent_row.*
  into existing_intent
  from private.project_upload_intents as intent_row
  where intent_row.version_id = p_version_id
    and intent_row.state = 'pending'
  for update;

  if existing_intent.id is not null then
    if existing_intent.expires_at <= now() then
      perform pg_catalog.set_config(
        'archstart.project_upload_intent_write_authorized',
        'on',
        true
      );

      update private.project_upload_intents as intent_row
      set
        state = 'expired',
        closed_at = now(),
        closed_reason = 'expired_before_retry'
      where intent_row.id = existing_intent.id;
    elsif existing_intent.original_filename = normalized_filename
      and existing_intent.declared_mime = normalized_mime
      and existing_intent.declared_size_bytes = p_declared_size_bytes
    then
      return query
      select
        intent_row.id,
        intent_row.planned_file_id,
        intent_row.submission_id,
        intent_row.version_id,
        intent_row.bucket_id,
        intent_row.object_path,
        intent_row.original_filename,
        intent_row.declared_mime,
        intent_row.declared_size_bytes,
        intent_row.transfer_mode,
        intent_row.state,
        intent_row.expires_at,
        true
      from private.project_upload_intents as intent_row
      where intent_row.id = existing_intent.id;
      return;
    else
      perform pg_catalog.set_config(
        'archstart.project_upload_intent_write_authorized',
        'on',
        true
      );

      update private.project_upload_intents as intent_row
      set
        state = 'cancelled',
        closed_at = now(),
        closed_reason = 'superseded_by_new_intent'
      where intent_row.id = existing_intent.id;
    end if;
  end if;

  perform pg_catalog.set_config(
    'archstart.project_upload_intent_write_authorized',
    'on',
    true
  );

  insert into private.project_upload_intents (
    user_id,
    submission_id,
    version_id,
    project_code,
    policy_version,
    original_filename,
    declared_mime,
    declared_size_bytes,
    expires_at
  ) values (
    current_user_id,
    found_submission_id,
    p_version_id,
    found_project_code,
    found_policy_version,
    normalized_filename,
    normalized_mime,
    p_declared_size_bytes,
    now() + interval '2 hours'
  ) returning * into created_intent;

  return query
  select
    intent_row.id,
    intent_row.planned_file_id,
    intent_row.submission_id,
    intent_row.version_id,
    intent_row.bucket_id,
    intent_row.object_path,
    intent_row.original_filename,
    intent_row.declared_mime,
    intent_row.declared_size_bytes,
    intent_row.transfer_mode,
    intent_row.state,
    intent_row.expires_at,
    false
  from private.project_upload_intents as intent_row
  where intent_row.id = created_intent.id;
end;
$function$;

create or replace function public.cancel_project_upload_intent(
  p_intent_id uuid
)
returns table (
  intent_id uuid,
  intent_state text,
  closed_at timestamptz,
  closed_reason text
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  current_user_id uuid := (select auth.uid());
  existing_intent private.project_upload_intents%rowtype;
begin
  if current_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'authenticated user required';
  end if;

  if p_intent_id is null then
    raise exception using
      errcode = '22023',
      message = 'upload intent is required';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext(current_user_id::text),
    pg_catalog.hashtext(p_intent_id::text)
  );

  select intent_row.*
  into existing_intent
  from private.project_upload_intents as intent_row
  where intent_row.id = p_intent_id
    and intent_row.user_id = current_user_id
  for update;

  if existing_intent.id is null then
    raise exception using
      errcode = '42501',
      message = 'owned upload intent not found';
  end if;

  if existing_intent.state = 'pending' then
    perform pg_catalog.set_config(
      'archstart.project_upload_intent_write_authorized',
      'on',
      true
    );

    update private.project_upload_intents as intent_row
    set
      state = case
        when intent_row.expires_at <= now() then 'expired'
        else 'cancelled'
      end,
      closed_at = now(),
      closed_reason = case
        when intent_row.expires_at <= now() then 'expired_on_cancel'
        else 'learner_cancelled'
      end
    where intent_row.id = existing_intent.id;
  end if;

  return query
  select
    intent_row.id,
    intent_row.state,
    intent_row.closed_at,
    intent_row.closed_reason
  from private.project_upload_intents as intent_row
  where intent_row.id = existing_intent.id;
end;
$function$;

revoke all on function
  private.stamp_project_upload_intent(),
  private.reject_project_upload_intent_delete(),
  public.create_project_upload_intent(uuid, text, text, bigint),
  public.cancel_project_upload_intent(uuid)
from public, anon, authenticated, service_role;

grant execute on function
  private.stamp_project_upload_intent(),
  private.reject_project_upload_intent_delete()
to service_role;

grant execute on function
  public.create_project_upload_intent(uuid, text, text, bigint),
  public.cancel_project_upload_intent(uuid)
to authenticated;

-- ---------------------------------------------------------------------------
-- Exact postconditions
-- ---------------------------------------------------------------------------

do $phase07$
declare
  expected_column_count integer := 20;
  actual_column_count integer;
  expected_constraint_count integer := 20;
  actual_constraint_count integer;
  expected_trigger_count integer := 2;
  actual_trigger_count integer;
  expected_index_count integer := 3;
  actual_index_count integer;
  expected_total_index_count integer := 7;
  actual_total_index_count integer;
  named_constraint_count integer;
  policy_count integer;
  project_object_count bigint;
  project_object_policy_count integer;
  intent_row_count bigint;
  rpc_count integer;
begin
  select count(*) into actual_column_count
  from information_schema.columns
  where table_schema = 'private'
    and table_name = 'project_upload_intents';

  if actual_column_count <> expected_column_count then
    raise exception using
      errcode = '55000',
      message = 'project upload-intent column postcondition failed';
  end if;

  select count(*) into actual_constraint_count
  from pg_catalog.pg_constraint as constraint_row
  join pg_catalog.pg_class as relation
    on relation.oid = constraint_row.conrelid
  join pg_catalog.pg_namespace as namespace
    on namespace.oid = relation.relnamespace
  where namespace.nspname = 'private'
    and relation.relname = 'project_upload_intents';

  if actual_constraint_count <> expected_constraint_count then
    raise exception using
      errcode = '55000',
      message = 'project upload-intent constraint postcondition failed';
  end if;

  select count(*) into named_constraint_count
  from (values
    ('project_upload_intents_pkey'),
    ('project_upload_intents_planned_file_id_key'),
    ('project_upload_intents_user_id_fkey'),
    ('project_upload_intents_submission_id_fkey'),
    ('project_upload_intents_finalized_file_id_key'),
    ('project_upload_intents_finalized_file_id_fkey'),
    ('project_upload_intent_version_fk'),
    ('project_upload_intent_policy_fk'),
    ('project_upload_intent_bucket'),
    ('project_upload_intent_filename'),
    ('project_upload_intent_mime'),
    ('project_upload_intent_size'),
    ('project_upload_intent_transfer_mode'),
    ('project_upload_intent_state'),
    ('project_upload_intent_expiry'),
    ('project_upload_intent_close_reason'),
    ('project_upload_intent_final_file_identity'),
    ('project_upload_intent_lifecycle'),
    ('project_upload_intent_object_path'),
    ('project_upload_intents_object_path_key')
  ) as expected(name)
  join pg_catalog.pg_constraint as constraint_row
    on constraint_row.conname = expected.name
    and constraint_row.conrelid =
      pg_catalog.to_regclass('private.project_upload_intents');

  if named_constraint_count <> expected_constraint_count then
    raise exception using
      errcode = '55000',
      message = 'project upload-intent named-constraint postcondition failed';
  end if;

  select count(*) into actual_trigger_count
  from pg_catalog.pg_trigger as trigger_row
  join pg_catalog.pg_class as relation
    on relation.oid = trigger_row.tgrelid
  join pg_catalog.pg_namespace as namespace
    on namespace.oid = relation.relnamespace
  where namespace.nspname = 'private'
    and relation.relname = 'project_upload_intents'
    and not trigger_row.tgisinternal
    and trigger_row.tgenabled = 'O';

  if actual_trigger_count <> expected_trigger_count
    or (
      select count(*)
      from pg_catalog.pg_trigger as trigger_row
      where trigger_row.tgrelid =
          pg_catalog.to_regclass('private.project_upload_intents')
        and not trigger_row.tgisinternal
        and trigger_row.tgenabled = 'O'
        and trigger_row.tgname in (
          'on_project_upload_intent_stamp',
          'on_project_upload_intent_reject_delete'
        )
    ) <> expected_trigger_count
  then
    raise exception using
      errcode = '55000',
      message = 'project upload-intent trigger postcondition failed';
  end if;

  select count(*) into actual_index_count
  from pg_catalog.pg_indexes
  where schemaname = 'private'
    and tablename = 'project_upload_intents'
    and indexname in (
      'project_upload_intent_one_pending_version_idx',
      'project_upload_intents_user_recent_idx',
      'project_upload_intents_pending_expiry_idx'
    );

  if actual_index_count <> expected_index_count then
    raise exception using
      errcode = '55000',
      message = 'project upload-intent index postcondition failed';
  end if;

  select count(*) into actual_total_index_count
  from pg_catalog.pg_indexes
  where schemaname = 'private'
    and tablename = 'project_upload_intents';

  if actual_total_index_count <> expected_total_index_count then
    raise exception using
      errcode = '55000',
      message = 'project upload-intent total-index postcondition failed';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_class as relation
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = relation.relnamespace
    where namespace.nspname = 'private'
      and relation.relname = 'project_upload_intents'
      and relation.relrowsecurity
  ) then
    raise exception using
      errcode = '55000',
      message = 'project upload-intent RLS postcondition failed';
  end if;

  select count(*) into policy_count
  from pg_catalog.pg_policies
  where schemaname = 'private'
    and tablename = 'project_upload_intents';

  if policy_count <> 0
    or pg_catalog.has_schema_privilege('anon', 'private', 'USAGE')
    or pg_catalog.has_schema_privilege('authenticated', 'private', 'USAGE')
    or not pg_catalog.has_schema_privilege('service_role', 'private', 'USAGE')
    or pg_catalog.has_table_privilege(
      'anon', 'private.project_upload_intents', 'SELECT'
    )
    or pg_catalog.has_table_privilege(
      'anon', 'private.project_upload_intents', 'INSERT'
    )
    or pg_catalog.has_table_privilege(
      'anon', 'private.project_upload_intents', 'UPDATE'
    )
    or pg_catalog.has_table_privilege(
      'anon', 'private.project_upload_intents', 'DELETE'
    )
    or pg_catalog.has_table_privilege(
      'authenticated', 'private.project_upload_intents', 'SELECT'
    )
    or pg_catalog.has_table_privilege(
      'authenticated', 'private.project_upload_intents', 'INSERT'
    )
    or pg_catalog.has_table_privilege(
      'authenticated', 'private.project_upload_intents', 'UPDATE'
    )
    or pg_catalog.has_table_privilege(
      'authenticated', 'private.project_upload_intents', 'DELETE'
    )
    or not pg_catalog.has_table_privilege(
      'service_role', 'private.project_upload_intents', 'SELECT'
    )
    or not pg_catalog.has_table_privilege(
      'service_role', 'private.project_upload_intents', 'INSERT'
    )
    or not pg_catalog.has_table_privilege(
      'service_role', 'private.project_upload_intents', 'UPDATE'
    )
    or pg_catalog.has_table_privilege(
      'service_role', 'private.project_upload_intents', 'DELETE'
    )
    or pg_catalog.has_table_privilege(
      'service_role', 'private.project_upload_intents', 'TRUNCATE'
    )
    or pg_catalog.has_table_privilege(
      'service_role', 'private.project_upload_intents', 'REFERENCES'
    )
    or pg_catalog.has_table_privilege(
      'service_role', 'private.project_upload_intents', 'TRIGGER'
    )
  then
    raise exception using
      errcode = '55000',
      message = 'project upload-intent table privilege postcondition failed';
  end if;

  select count(*) into rpc_count
  from (values
    ('public.create_project_upload_intent(uuid,text,text,bigint)'),
    ('public.cancel_project_upload_intent(uuid)')
  ) as expected(signature)
  join pg_catalog.pg_proc as procedure
    on procedure.oid = pg_catalog.to_regprocedure(expected.signature)
  where procedure.prosecdef
    and procedure.proconfig is not distinct from array['search_path=""']::text[]
    and pg_catalog.has_function_privilege(
      'authenticated',
      procedure.oid,
      'EXECUTE'
    )
    and not pg_catalog.has_function_privilege(
      'anon',
      procedure.oid,
      'EXECUTE'
    )
    and not pg_catalog.has_function_privilege(
      'service_role',
      procedure.oid,
      'EXECUTE'
    );

  if rpc_count <> 2 then
    raise exception using
      errcode = '55000',
      message = 'project upload-intent RPC postcondition failed';
  end if;

  select count(*) into intent_row_count
  from private.project_upload_intents;

  if intent_row_count <> 0 then
    raise exception using
      errcode = '55000',
      message = 'Pass 2C2A must create no upload-intent rows';
  end if;

  select count(*) into project_object_policy_count
  from pg_catalog.pg_policies
  where schemaname = 'storage'
    and tablename = 'objects'
    and (
      policyname ~* 'project'
      or coalesce(qual, '') ~* 'project-submissions'
      or coalesce(with_check, '') ~* 'project-submissions'
    );

  select count(*) into project_object_count
  from storage.objects
  where bucket_id = 'project-submissions';

  if project_object_policy_count <> 0 or project_object_count <> 0 then
    raise exception using
      errcode = '55000',
      message = 'Pass 2C2A widened the closed Storage boundary';
  end if;
end;
$phase07$;

commit;
