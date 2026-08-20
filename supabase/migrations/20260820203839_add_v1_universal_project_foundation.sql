-- V1 universal project foundation.
-- Adds reusable templates, unrestricted custom project metadata, structured
-- Shared Vision fields, and project phases without replacing the existing
-- project_type enum or specialty tables.

alter table public.projects
  add column if not exists project_family text,
  add column if not exists project_subtype text,
  add column if not exists template_key text,
  add column if not exists is_custom_workflow boolean not null default false,
  add column if not exists procurement_type text,
  add column if not exists jurisdiction_context jsonb not null default '{}'::jsonb,
  add column if not exists shared_vision jsonb not null default '{}'::jsonb;

alter table public.projects
  add constraint projects_project_family_check check (
    project_family is null or project_family in (
      'residential', 'custom_building', 'commercial', 'municipal_public',
      'site_civil', 'water_management', 'bridge', 'concrete_masonry',
      'specialty', 'historic', 'custom'
    )
  ),
  add constraint projects_procurement_type_check check (
    procurement_type is null or procurement_type in (
      'private_negotiated', 'competitive_bid', 'design_build',
      'cost_plus', 'time_material', 'unit_price', 'public_bid',
      'government_contract', 'other'
    )
  ),
  add constraint projects_jurisdiction_context_object_check
    check (jsonb_typeof(jurisdiction_context) = 'object'),
  add constraint projects_shared_vision_object_check
    check (jsonb_typeof(shared_vision) = 'object');

create table public.project_templates (
  key text primary key,
  display_name text not null,
  family text not null,
  description text,
  specialty_feature_key text,
  safety_class text not null default 'standard'
    check (safety_class in ('standard', 'permit_review', 'professional_review')),
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_templates_family_check check (family in (
    'residential', 'custom_building', 'commercial', 'municipal_public',
    'site_civil', 'water_management', 'bridge', 'concrete_masonry',
    'specialty', 'historic', 'custom'
  ))
);

create table public.project_template_phases (
  id uuid primary key default gen_random_uuid(),
  template_key text not null references public.project_templates(key) on delete cascade,
  phase_key text not null,
  name text not null,
  description text,
  trade text,
  sort_order integer not null default 0,
  required boolean not null default true,
  permit_checkpoint boolean not null default false,
  inspection_checkpoint boolean not null default false,
  professional_review boolean not null default false,
  default_checklist jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (template_key, phase_key),
  constraint project_template_phases_checklist_array_check
    check (jsonb_typeof(default_checklist) = 'array')
);

create table public.project_phases (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  source_template_key text,
  source_phase_key text,
  name text not null,
  description text,
  trade text,
  sort_order integer not null default 0,
  status text not null default 'not_started'
    check (status in ('not_started', 'ready', 'in_progress', 'blocked', 'complete', 'not_applicable')),
  required boolean not null default true,
  permit_checkpoint boolean not null default false,
  inspection_checkpoint boolean not null default false,
  professional_review boolean not null default false,
  client_visible boolean not null default true,
  dependencies text[] not null default '{}',
  checklist jsonb not null default '[]'::jsonb,
  start_date date,
  end_date date,
  completed_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_phases_checklist_array_check
    check (jsonb_typeof(checklist) = 'array'),
  constraint project_phases_dates_check
    check (end_date is null or start_date is null or end_date >= start_date)
);

create unique index project_phases_template_phase_uidx
  on public.project_phases(project_id, source_template_key, source_phase_key)
  where source_template_key is not null and source_phase_key is not null;
create index project_phases_project_sort_idx
  on public.project_phases(project_id, sort_order);
create index project_template_phases_template_sort_idx
  on public.project_template_phases(template_key, sort_order);
create index projects_template_key_idx on public.projects(template_key)
  where template_key is not null;
create index projects_project_family_idx on public.projects(project_family)
  where project_family is not null;

alter table public.project_templates enable row level security;
alter table public.project_template_phases enable row level security;
alter table public.project_phases enable row level security;

revoke all on public.project_templates, public.project_template_phases,
  public.project_phases from public, anon, authenticated;
grant select on public.project_templates, public.project_template_phases to authenticated;
grant select, insert, update, delete on public.project_phases to authenticated;
grant all on public.project_templates, public.project_template_phases,
  public.project_phases to service_role;

create policy project_templates_staff_read on public.project_templates
  for select to authenticated
  using ((select public.is_staff((select auth.uid()))));

create policy project_template_phases_staff_read on public.project_template_phases
  for select to authenticated
  using ((select public.is_staff((select auth.uid()))));

create policy project_phases_read on public.project_phases
  for select to authenticated
  using (
    (select public.is_staff((select auth.uid())))
    or (
      client_visible
      and exists (
        select 1
        from public.projects p
        join public.profiles profile on profile.client_id = p.client_id
        where p.id = project_phases.project_id
          and profile.id = (select auth.uid())
      )
    )
  );

create policy project_phases_staff_insert on public.project_phases
  for insert to authenticated
  with check ((select public.is_staff((select auth.uid()))));

create policy project_phases_staff_update on public.project_phases
  for update to authenticated
  using ((select public.is_staff((select auth.uid()))))
  with check ((select public.is_staff((select auth.uid()))));

create policy project_phases_staff_delete on public.project_phases
  for delete to authenticated
  using ((select public.is_staff((select auth.uid()))));

create trigger trg_project_templates_updated
before update on public.project_templates
for each row execute function public.set_updated_at();

create trigger trg_project_phases_updated
before update on public.project_phases
for each row execute function public.set_updated_at();

insert into public.project_templates
  (key, display_name, family, description, specialty_feature_key, safety_class, sort_order)
values
  ('residential_standard', 'Residential Build / Remodel', 'residential', 'Standard residential construction, remodeling, additions and repair.', null, 'permit_review', 10),
  ('custom_building', 'Custom Building', 'custom_building', 'Barndominiums, pole barns, shops, garages, cabins and container construction.', null, 'permit_review', 20),
  ('commercial_ti', 'Commercial / Tenant Improvement', 'commercial', 'Commercial, retail, office, restaurant, warehouse and institutional work.', null, 'professional_review', 30),
  ('municipal_public_works', 'Municipal / Public Works', 'municipal_public', 'City, county, state, VA, federal and other public work.', null, 'professional_review', 40),
  ('site_civil_excavation', 'Excavation / Site & Land Management', 'site_civil', 'Excavation, clearing, grading, utilities, roads, parking and erosion control.', null, 'permit_review', 50),
  ('water_management', 'Drainage / Water Management', 'water_management', 'French, trench and curtain drains, swales, culverts, stormwater and runoff control.', 'site_intelligence', 'professional_review', 60),
  ('bridge_crossing', 'Bridge / Crossing', 'bridge', 'Bridge, access crossing and engineered water-crossing workflow.', 'site_intelligence', 'professional_review', 70),
  ('concrete_masonry', 'Concrete / Masonry', 'concrete_masonry', 'Foundations, flatwork, decorative concrete, CMU, veneer and masonry work.', null, 'permit_review', 80),
  ('pool_spa', 'Pool / Spa Installation', 'specialty', 'Pool and spa excavation, shell/liner, utilities, equipment, decking, barrier and startup.', null, 'permit_review', 90),
  ('sentinel_septic', 'Septic Install / Repair', 'specialty', 'Septic installation, repair, replacement, mapping, inspection and closeout.', 'sentinel_septic', 'professional_review', 100),
  ('historic_restoration', 'Historic Restoration', 'historic', 'Preservation-aware restoration, masonry and specialty documentation.', null, 'professional_review', 110),
  ('fully_custom', 'Fully Custom Project', 'custom', 'Start with a blank workflow and add any phases, trades, tasks and checkpoints.', null, 'standard', 999)
on conflict (key) do update set
  display_name = excluded.display_name,
  family = excluded.family,
  description = excluded.description,
  specialty_feature_key = excluded.specialty_feature_key,
  safety_class = excluded.safety_class,
  sort_order = excluded.sort_order,
  active = true;

insert into public.project_template_phases
  (template_key, phase_key, name, trade, sort_order, permit_checkpoint, inspection_checkpoint, professional_review)
values
  ('residential_standard', 'intake', 'Shared Vision & Existing Conditions', 'preconstruction', 10, false, false, false),
  ('residential_standard', 'design_permit', 'Design, Selections & Permits', 'preconstruction', 20, true, false, true),
  ('residential_standard', 'site_structure', 'Site, Foundation & Structure', 'general', 30, false, true, false),
  ('residential_standard', 'rough_ins', 'Rough Mechanical / Electrical / Plumbing', 'mep', 40, false, true, false),
  ('residential_standard', 'finishes', 'Finishes & Fixtures', 'general', 50, false, false, false),
  ('residential_standard', 'closeout', 'Punch, Final Inspection & Closeout', 'general', 60, false, true, false),
  ('custom_building', 'vision_engineering', 'Shared Vision, Site & Engineering', 'preconstruction', 10, true, false, true),
  ('custom_building', 'site_foundation', 'Sitework & Foundation', 'sitework', 20, false, true, false),
  ('custom_building', 'shell', 'Structure, Shell & Weatherproofing', 'general', 30, false, true, false),
  ('custom_building', 'systems', 'Utilities & Building Systems', 'mep', 40, false, true, false),
  ('custom_building', 'interior', 'Interior Buildout & Finishes', 'general', 50, false, false, false),
  ('custom_building', 'closeout', 'Final Inspection & Closeout', 'general', 60, false, true, false),
  ('commercial_ti', 'due_diligence', 'Due Diligence & Existing Conditions', 'preconstruction', 10, false, false, true),
  ('commercial_ti', 'design_submittal', 'Design, Submittals & Permits', 'preconstruction', 20, true, false, true),
  ('commercial_ti', 'demolition', 'Selective Demolition & Protection', 'general', 30, false, false, false),
  ('commercial_ti', 'buildout', 'Buildout & Building Systems', 'general', 40, false, true, false),
  ('commercial_ti', 'commissioning', 'Commissioning, Inspection & Closeout', 'general', 50, false, true, true),
  ('municipal_public_works', 'procurement', 'Solicitation, Bonds & Compliance Setup', 'administration', 10, true, false, true),
  ('municipal_public_works', 'submittals', 'Submittals, RFIs & Preconstruction', 'administration', 20, false, false, true),
  ('municipal_public_works', 'construction', 'Construction & Certified Field Records', 'general', 30, false, true, false),
  ('municipal_public_works', 'pay_apps', 'Pay Applications, Retainage & Compliance', 'administration', 40, false, false, false),
  ('municipal_public_works', 'closeout', 'Final Inspection, Turnover & Closeout', 'administration', 50, false, true, true),
  ('site_civil_excavation', 'site_capture', 'Site Capture, Utilities & Constraints', 'sitework', 10, true, false, true),
  ('site_civil_excavation', 'clearing', 'Clearing, Access & Erosion Controls', 'sitework', 20, false, true, false),
  ('site_civil_excavation', 'earthwork', 'Excavation, Grading & Cut / Fill', 'sitework', 30, false, true, false),
  ('site_civil_excavation', 'utilities', 'Utilities, Drainage & Aggregate', 'sitework', 40, false, true, false),
  ('site_civil_excavation', 'stabilization', 'Stabilization, As-Builts & Closeout', 'sitework', 50, false, true, false),
  ('water_management', 'capture_analysis', 'LiDAR / Elevation Capture & Water-Path Analysis', 'sitework', 10, true, false, true),
  ('water_management', 'alternatives', 'Placement Alternatives & Contractor Approval', 'preconstruction', 20, false, false, true),
  ('water_management', 'installation', 'Drainage / Water-Control Installation', 'sitework', 30, false, true, false),
  ('water_management', 'outfall', 'Outfall, Stabilization & Erosion Protection', 'sitework', 40, false, true, false),
  ('water_management', 'verification', 'Performance Verification & Closeout', 'sitework', 50, false, true, false),
  ('bridge_crossing', 'survey_constraints', 'Survey, Site Constraints & Hydrology Inputs', 'preconstruction', 10, true, false, true),
  ('bridge_crossing', 'engineering', 'Engineering, Permits & Approved Design', 'preconstruction', 20, true, false, true),
  ('bridge_crossing', 'foundations', 'Abutments, Foundations & Bearing Work', 'sitework', 30, false, true, true),
  ('bridge_crossing', 'structure', 'Structural Installation', 'structural', 40, false, true, true),
  ('bridge_crossing', 'approaches', 'Approaches, Drainage & Protection', 'sitework', 50, false, true, false),
  ('bridge_crossing', 'closeout', 'Load / Final Inspection & Closeout', 'structural', 60, false, true, true),
  ('concrete_masonry', 'capture_layout', 'Site Capture, Layout & Engineering Review', 'preconstruction', 10, true, false, true),
  ('concrete_masonry', 'subgrade', 'Excavation, Subgrade & Reinforcement', 'sitework', 20, false, true, false),
  ('concrete_masonry', 'placement', 'Placement / Masonry Construction', 'concrete_masonry', 30, false, true, false),
  ('concrete_masonry', 'cure_finish', 'Cure, Finish, Protection & Cleanup', 'concrete_masonry', 40, false, false, false),
  ('concrete_masonry', 'closeout', 'Final Review & Closeout', 'concrete_masonry', 50, false, true, false),
  ('pool_spa', 'design_permit', 'Site, Design, Utilities & Permits', 'preconstruction', 10, true, false, true),
  ('pool_spa', 'excavation_drainage', 'Excavation, Base & Drainage', 'sitework', 20, false, true, false),
  ('pool_spa', 'shell', 'Shell / Liner Construction', 'pool', 30, false, true, false),
  ('pool_spa', 'plumbing_electrical', 'Plumbing, Electrical Bonding & Equipment', 'pool', 40, false, true, true),
  ('pool_spa', 'deck_barrier', 'Decking, Barrier / Fence & Site Restoration', 'general', 50, false, true, false),
  ('pool_spa', 'startup', 'Inspection, Startup, Water Balance & Closeout', 'pool', 60, false, true, false),
  ('sentinel_septic', 'property_capture', 'Property, GPS / LiDAR & Existing-System Capture', 'septic', 10, true, false, true),
  ('sentinel_septic', 'soil_design', 'Soil, Drainage, Design & Permit Support', 'septic', 20, true, false, true),
  ('sentinel_septic', 'excavation_install', 'Excavation, Tank, Distribution & Field Work', 'septic', 30, false, true, false),
  ('sentinel_septic', 'inspection', 'Inspection, Testing & Corrections', 'septic', 40, false, true, true),
  ('sentinel_septic', 'as_built', 'As-Built Mapping, Client File & Maintenance Plan', 'septic', 50, false, false, false),
  ('historic_restoration', 'documentation', 'Existing Conditions & Preservation Documentation', 'restoration', 10, true, false, true),
  ('historic_restoration', 'research_mockup', 'Material Research, Samples & Mockups', 'restoration', 20, false, false, true),
  ('historic_restoration', 'stabilization', 'Protection & Stabilization', 'restoration', 30, false, true, true),
  ('historic_restoration', 'restoration', 'Restoration Work', 'restoration', 40, false, true, false),
  ('historic_restoration', 'closeout', 'Final Documentation & Closeout', 'restoration', 50, false, true, true),
  ('fully_custom', 'shared_vision', 'Shared Vision & Requirements', 'custom', 10, false, false, false),
  ('fully_custom', 'planning', 'Custom Planning', 'custom', 20, false, false, false),
  ('fully_custom', 'delivery', 'Custom Project Delivery', 'custom', 30, false, false, false),
  ('fully_custom', 'closeout', 'Custom Closeout', 'custom', 40, false, false, false)
on conflict (template_key, phase_key) do update set
  name = excluded.name,
  trade = excluded.trade,
  sort_order = excluded.sort_order,
  permit_checkpoint = excluded.permit_checkpoint,
  inspection_checkpoint = excluded.inspection_checkpoint,
  professional_review = excluded.professional_review;

alter table public.projects
  add constraint projects_template_key_fk
  foreign key (template_key) references public.project_templates(key);

create or replace function public.apply_project_template(
  _project_id uuid,
  _template_key text
) returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  _inserted integer;
begin
  if (select auth.uid()) is null
     or not public.is_staff((select auth.uid())) then
    raise exception 'staff access required' using errcode = '42501';
  end if;

  if not exists (select 1 from public.projects p where p.id = _project_id) then
    raise exception 'project not found' using errcode = 'P0002';
  end if;

  if not exists (
    select 1 from public.project_templates t
    where t.key = _template_key and t.active
  ) then
    raise exception 'active project template not found' using errcode = 'P0002';
  end if;

  if exists (
    select 1
    from public.project_templates t
    where t.key = _template_key
      and t.specialty_feature_key is not null
      and not public.has_entitlement(t.specialty_feature_key)
  ) then
    raise exception 'project template subscription upgrade required'
      using errcode = '42501';
  end if;

  update public.projects p
  set template_key = _template_key,
      project_family = t.family,
      is_custom_workflow = (_template_key = 'fully_custom')
  from public.project_templates t
  where p.id = _project_id and t.key = _template_key;

  insert into public.project_phases (
    project_id, source_template_key, source_phase_key, name, description,
    trade, sort_order, required, permit_checkpoint, inspection_checkpoint,
    professional_review, checklist, created_by
  )
  select
    _project_id, tp.template_key, tp.phase_key, tp.name, tp.description,
    tp.trade, tp.sort_order, tp.required, tp.permit_checkpoint,
    tp.inspection_checkpoint, tp.professional_review,
    tp.default_checklist, (select auth.uid())
  from public.project_template_phases tp
  where tp.template_key = _template_key
  on conflict (project_id, source_template_key, source_phase_key)
    where source_template_key is not null and source_phase_key is not null
  do nothing;

  get diagnostics _inserted = row_count;
  return _inserted;
end;
$$;

revoke all on function public.apply_project_template(uuid, text)
  from public, anon, authenticated;
grant execute on function public.apply_project_template(uuid, text)
  to authenticated, service_role;

comment on function public.apply_project_template(uuid, text) is
  'Staff-only SECURITY INVOKER helper that idempotently expands a reusable V1 project template into editable project phases.';

insert into public.plan_entitlements(plan_key, feature_key)
values
  ('business', 'site_intelligence'),
  ('enterprise', 'site_intelligence')
on conflict (plan_key, feature_key) do nothing;
