-- Add the single-company V1 settings record used by web and Flutter clients.
-- Legal identity is intentionally immutable in V1; admins may edit operating
-- contact details and the approved navy/gold presentation palette.

create table public.company_settings (
  id uuid primary key default gen_random_uuid(),
  settings_key text not null unique default 'primary'
    check (settings_key = 'primary'),
  legal_name text not null default 'ManyHats Construction LLC'
    check (legal_name = 'ManyHats Construction LLC'),
  owner_name text not null default 'Mike Canter'
    check (owner_name = 'Mike Canter'),
  owner_title text not null default 'CEO & Owner',
  phone text not null default '740-600-1374'
    check (char_length(phone) between 7 and 30),
  email text,
  website text,
  tagline text not null default 'Veteran-Owned Contractor'
    check (char_length(tagline) between 2 and 120),
  specialties text not null default 'Heavy Civil · Concrete · Masonry · Utilities · Historic Restoration'
    check (char_length(specialties) between 2 and 500),
  primary_color text not null default '#0B1F3A'
    check (primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  accent_color text not null default '#C9A227'
    check (accent_color ~ '^#[0-9A-Fa-f]{6}$'),
  proposal_theme text not null default 'professional'
    check (proposal_theme in ('professional', 'modern', 'classic')),
  default_terms text,
  default_warranty text,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.company_settings enable row level security;

grant select, update on public.company_settings to authenticated;
grant all on public.company_settings to service_role;

create policy company_settings_staff_read
on public.company_settings for select to authenticated
using (public.is_staff((select auth.uid())));

create policy company_settings_admin_update
on public.company_settings for update to authenticated
using (public.has_role((select auth.uid()), 'admin'::public.app_role))
with check (
  public.has_role((select auth.uid()), 'admin'::public.app_role)
  and settings_key = 'primary'
  and legal_name = 'ManyHats Construction LLC'
  and owner_name = 'Mike Canter'
);

create or replace function public.touch_company_settings()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;

revoke all on function public.touch_company_settings()
from public, anon, authenticated;

create trigger company_settings_touch_updated_at
before update on public.company_settings
for each row execute function public.touch_company_settings();

insert into public.company_settings (settings_key)
values ('primary');
