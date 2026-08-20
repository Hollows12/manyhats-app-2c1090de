-- Cover V1 foreign keys used during account cleanup and referential checks.

create index if not exists project_phases_created_by_idx
  on public.project_phases (created_by);

create index if not exists proposal_acceptance_snapshots_selected_option_idx
  on public.proposal_acceptance_snapshots (selected_option_id);
