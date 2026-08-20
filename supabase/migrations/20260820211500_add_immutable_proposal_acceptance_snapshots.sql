-- V1 private-beta integrity: preserve the exact agreement accepted by a client.

create table if not exists public.proposal_acceptance_snapshots (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.proposals(id) on delete restrict,
  signature_id uuid not null references public.proposal_signatures(id) on delete restrict,
  selected_option_id uuid references public.proposal_options(id) on delete restrict,
  snapshot jsonb not null,
  snapshot_sha256 text not null,
  accepted_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint proposal_acceptance_snapshots_signature_key unique (signature_id),
  constraint proposal_acceptance_snapshots_hash_format
    check (snapshot_sha256 ~ '^[0-9a-f]{64}$')
);

create index if not exists idx_proposal_acceptance_snapshots_proposal
  on public.proposal_acceptance_snapshots (proposal_id, accepted_at desc);

alter table public.proposal_acceptance_snapshots enable row level security;

revoke all on table public.proposal_acceptance_snapshots from public, anon, authenticated;
grant select on table public.proposal_acceptance_snapshots to authenticated;
grant all on table public.proposal_acceptance_snapshots to service_role;

drop policy if exists proposal_acceptance_snapshots_staff_select
  on public.proposal_acceptance_snapshots;
create policy proposal_acceptance_snapshots_staff_select
  on public.proposal_acceptance_snapshots
  for select
  to authenticated
  using (public.is_staff((select auth.uid())));

create or replace function public.capture_proposal_acceptance_snapshot()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  _proposal public.proposals%rowtype;
  _options jsonb;
  _snapshot jsonb;
begin
  select *
  into _proposal
  from public.proposals
  where id = new.proposal_id
  for update;

  if not found then
    raise exception 'proposal_not_found';
  end if;

  select coalesce(
    jsonb_agg(to_jsonb(option_row) order by option_row.sort_order, option_row.id),
    '[]'::jsonb
  )
  into _options
  from public.proposal_options option_row
  where option_row.proposal_id = new.proposal_id;

  _snapshot := jsonb_build_object(
    'schema_version', 1,
    'proposal', to_jsonb(_proposal)
      - 'portal_token'
      - 'portal_pin_hash',
    'options', _options,
    'selected_option_id', new.selected_option_id,
    'signature', to_jsonb(new),
    'accepted_at', new.signed_at
  );

  insert into public.proposal_acceptance_snapshots (
    proposal_id,
    signature_id,
    selected_option_id,
    snapshot,
    snapshot_sha256,
    accepted_at
  ) values (
    new.proposal_id,
    new.id,
    new.selected_option_id,
    _snapshot,
    encode(extensions.digest(convert_to(_snapshot::text, 'UTF8'), 'sha256'), 'hex'),
    new.signed_at
  )
  on conflict (signature_id) do nothing;

  return new;
end;
$$;

revoke all on function public.capture_proposal_acceptance_snapshot()
  from public, anon, authenticated;
grant execute on function public.capture_proposal_acceptance_snapshot()
  to service_role;

drop trigger if exists trg_capture_proposal_acceptance_snapshot
  on public.proposal_signatures;
create trigger trg_capture_proposal_acceptance_snapshot
after insert on public.proposal_signatures
for each row execute function public.capture_proposal_acceptance_snapshot();

create or replace function public.prevent_accepted_proposal_legal_edits()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.proposal_acceptance_snapshots
    where proposal_id = old.id
  ) and (
    new.project_id is distinct from old.project_id
    or new.proposal_number is distinct from old.proposal_number
    or new.executive_summary is distinct from old.executive_summary
    or new.existing_conditions is distinct from old.existing_conditions
    or new.scope_of_work is distinct from old.scope_of_work
    or new.recommendation is distinct from old.recommendation
    or new.timeline is distinct from old.timeline
    or new.warranty_length is distinct from old.warranty_length
    or new.warranty_notes is distinct from old.warranty_notes
    or new.exclusions is distinct from old.exclusions
    or new.payment_terms is distinct from old.payment_terms
    or new.grant_friendly is distinct from old.grant_friendly
    or new.attached_photo_ids is distinct from old.attached_photo_ids
    or new.attached_concept_ids is distinct from old.attached_concept_ids
  ) then
    raise exception 'accepted_proposal_is_immutable';
  end if;

  return new;
end;
$$;

revoke all on function public.prevent_accepted_proposal_legal_edits()
  from public, anon, authenticated;
grant execute on function public.prevent_accepted_proposal_legal_edits()
  to service_role;

drop trigger if exists trg_prevent_accepted_proposal_legal_edits
  on public.proposals;
create trigger trg_prevent_accepted_proposal_legal_edits
before update on public.proposals
for each row execute function public.prevent_accepted_proposal_legal_edits();

create or replace function public.prevent_accepted_proposal_option_edits()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  _proposal_id uuid;
begin
  if tg_op = 'DELETE' then
    _proposal_id := old.proposal_id;
  else
    _proposal_id := new.proposal_id;
  end if;

  if exists (
    select 1
    from public.proposal_acceptance_snapshots
    where proposal_id = _proposal_id
  ) then
    raise exception 'accepted_proposal_options_are_immutable';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

revoke all on function public.prevent_accepted_proposal_option_edits()
  from public, anon, authenticated;
grant execute on function public.prevent_accepted_proposal_option_edits()
  to service_role;

drop trigger if exists trg_prevent_accepted_proposal_option_edits
  on public.proposal_options;
create trigger trg_prevent_accepted_proposal_option_edits
before insert or update or delete on public.proposal_options
for each row execute function public.prevent_accepted_proposal_option_edits();

comment on table public.proposal_acceptance_snapshots is
  'Append-only legal record of the exact proposal, options, selected option, and signature accepted by a client.';
