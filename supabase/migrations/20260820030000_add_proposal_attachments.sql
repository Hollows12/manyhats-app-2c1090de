-- Secure contractor proposal attachments for V1.
-- Files remain private; clients receive attachment access only through a
-- separately authorized portal flow.

create table public.proposal_attachments (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.proposals(id) on delete cascade,
  file_name text not null check (
    char_length(btrim(file_name)) between 1 and 255
    and file_name !~ '[\\/]'
  ),
  storage_path text not null unique check (
    storage_path ~ '^[0-9a-fA-F-]{36}/[0-9a-fA-F-]{36}-[^/]+$'
  ),
  mime_type text not null check (
    mime_type in (
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp'
    )
  ),
  size_bytes bigint not null check (
    size_bytes > 0 and size_bytes <= 26214400
  ),
  uploaded_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create index proposal_attachments_proposal_created_idx
  on public.proposal_attachments(proposal_id, created_at desc);

create index proposal_attachments_uploaded_by_idx
  on public.proposal_attachments(uploaded_by);

alter table public.proposal_attachments enable row level security;

revoke all on public.proposal_attachments from public, anon, authenticated;
grant select, insert, delete on public.proposal_attachments to authenticated;
grant all on public.proposal_attachments to service_role;

create policy proposal_attachments_staff_select
on public.proposal_attachments
for select
to authenticated
using (
  public.is_staff((select auth.uid()))
  and public.has_entitlement('proposal_attachments')
  and exists (
    select 1
    from public.proposals
    where proposals.id = proposal_attachments.proposal_id
  )
);

create policy proposal_attachments_staff_insert
on public.proposal_attachments
for insert
to authenticated
with check (
  uploaded_by = (select auth.uid())
  and public.is_staff((select auth.uid()))
  and public.has_entitlement('proposal_attachments')
  and exists (
    select 1
    from public.proposals
    where proposals.id = proposal_attachments.proposal_id
  )
);

create policy proposal_attachments_staff_delete
on public.proposal_attachments
for delete
to authenticated
using (
  uploaded_by = (select auth.uid())
  and public.is_staff((select auth.uid()))
  and public.has_entitlement('proposal_attachments')
  and exists (
    select 1
    from public.proposals
    where proposals.id = proposal_attachments.proposal_id
  )
);

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'proposal-attachments',
  'proposal-attachments',
  false,
  26214400,
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp'
  ]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy proposal_attachment_objects_staff_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'proposal-attachments'
  and owner_id = (select auth.uid())::text
  and public.is_staff((select auth.uid()))
  and public.has_entitlement('proposal_attachments')
  and case
    when split_part(name, '/', 1) ~
      '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
    then exists (
      select 1
      from public.proposals
      where proposals.id = split_part(name, '/', 1)::uuid
    )
    else false
  end
);

create policy proposal_attachment_objects_staff_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'proposal-attachments'
  and public.is_staff((select auth.uid()))
  and public.has_entitlement('proposal_attachments')
  and case
    when split_part(name, '/', 1) ~
      '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
    then exists (
      select 1
      from public.proposal_attachments
      where proposal_attachments.proposal_id =
        split_part(storage.objects.name, '/', 1)::uuid
        and proposal_attachments.storage_path = storage.objects.name
    )
    else false
  end
);

create policy proposal_attachment_objects_staff_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'proposal-attachments'
  and owner_id = (select auth.uid())::text
  and public.is_staff((select auth.uid()))
  and public.has_entitlement('proposal_attachments')
  and exists (
    select 1
    from public.proposal_attachments
    where proposal_attachments.storage_path = storage.objects.name
      and proposal_attachments.uploaded_by = (select auth.uid())
  )
);

comment on table public.proposal_attachments is
  'Private proposal files uploaded by entitled staff. Storage objects use proposal_id/uuid-filename paths.';
