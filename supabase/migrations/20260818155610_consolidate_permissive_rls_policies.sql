-- Consolidate overlapping permissive policies without changing access semantics.

drop policy "Admins read all activity" on public.activity_logs;
drop policy "Crew read own activity" on public.activity_logs;
create policy "Activity read access"
on public.activity_logs for select to authenticated
using (
  public.has_role((select auth.uid()), 'admin'::public.app_role)
  or actor_id = (select auth.uid())
);

drop policy "admin write jobs" on public.firecrawl_jobs;
create policy "admin insert jobs"
on public.firecrawl_jobs for insert to authenticated
with check (public.has_role((select auth.uid()), 'admin'::public.app_role));
create policy "admin update jobs"
on public.firecrawl_jobs for update to authenticated
using (public.has_role((select auth.uid()), 'admin'::public.app_role))
with check (public.has_role((select auth.uid()), 'admin'::public.app_role));
create policy "admin delete jobs"
on public.firecrawl_jobs for delete to authenticated
using (public.has_role((select auth.uid()), 'admin'::public.app_role));

drop policy "admin write knowledge" on public.knowledge_docs;
create policy "admin insert knowledge"
on public.knowledge_docs for insert to authenticated
with check (public.has_role((select auth.uid()), 'admin'::public.app_role));
create policy "admin update knowledge"
on public.knowledge_docs for update to authenticated
using (public.has_role((select auth.uid()), 'admin'::public.app_role))
with check (public.has_role((select auth.uid()), 'admin'::public.app_role));
create policy "admin delete knowledge"
on public.knowledge_docs for delete to authenticated
using (public.has_role((select auth.uid()), 'admin'::public.app_role));

drop policy "admin write prices" on public.material_prices;
create policy "admin insert prices"
on public.material_prices for insert to authenticated
with check (public.has_role((select auth.uid()), 'admin'::public.app_role));
create policy "admin update prices"
on public.material_prices for update to authenticated
using (public.has_role((select auth.uid()), 'admin'::public.app_role))
with check (public.has_role((select auth.uid()), 'admin'::public.app_role));
create policy "admin delete prices"
on public.material_prices for delete to authenticated
using (public.has_role((select auth.uid()), 'admin'::public.app_role));

drop policy "admin write materials" on public.materials;
create policy "admin insert materials"
on public.materials for insert to authenticated
with check (public.has_role((select auth.uid()), 'admin'::public.app_role));
create policy "admin update materials"
on public.materials for update to authenticated
using (public.has_role((select auth.uid()), 'admin'::public.app_role))
with check (public.has_role((select auth.uid()), 'admin'::public.app_role));
create policy "admin delete materials"
on public.materials for delete to authenticated
using (public.has_role((select auth.uid()), 'admin'::public.app_role));

drop policy "pr_admin_write" on public.production_rates;
create policy "admin insert production rates"
on public.production_rates for insert to authenticated
with check (public.has_role((select auth.uid()), 'admin'::public.app_role));
create policy "admin update production rates"
on public.production_rates for update to authenticated
using (public.has_role((select auth.uid()), 'admin'::public.app_role))
with check (public.has_role((select auth.uid()), 'admin'::public.app_role));
create policy "admin delete production rates"
on public.production_rates for delete to authenticated
using (public.has_role((select auth.uid()), 'admin'::public.app_role));

drop policy "admin write suppliers" on public.suppliers;
create policy "admin insert suppliers"
on public.suppliers for insert to authenticated
with check (public.has_role((select auth.uid()), 'admin'::public.app_role));
create policy "admin update suppliers"
on public.suppliers for update to authenticated
using (public.has_role((select auth.uid()), 'admin'::public.app_role))
with check (public.has_role((select auth.uid()), 'admin'::public.app_role));
create policy "admin delete suppliers"
on public.suppliers for delete to authenticated
using (public.has_role((select auth.uid()), 'admin'::public.app_role));

drop policy clients_client_self_read on public.clients;
drop policy clients_staff_all on public.clients;
create policy clients_read
on public.clients for select to authenticated
using (
  public.is_staff((select auth.uid()))
  or exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.client_id = clients.id
  )
);
create policy clients_staff_insert
on public.clients for insert to authenticated
with check (public.is_staff((select auth.uid())));
create policy clients_staff_update
on public.clients for update to authenticated
using (public.is_staff((select auth.uid())))
with check (public.is_staff((select auth.uid())));
create policy clients_staff_delete
on public.clients for delete to authenticated
using (public.is_staff((select auth.uid())));

drop policy projects_client_read on public.projects;
drop policy projects_staff_all on public.projects;
create policy projects_read
on public.projects for select to authenticated
using (
  public.is_staff((select auth.uid()))
  or exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.client_id = projects.client_id
  )
);
create policy projects_staff_insert
on public.projects for insert to authenticated
with check (public.is_staff((select auth.uid())));
create policy projects_staff_update
on public.projects for update to authenticated
using (public.is_staff((select auth.uid())))
with check (public.is_staff((select auth.uid())));
create policy projects_staff_delete
on public.projects for delete to authenticated
using (public.is_staff((select auth.uid())));

drop policy popts_client_read on public.proposal_options;
drop policy popts_staff_all on public.proposal_options;
create policy popts_read
on public.proposal_options for select to authenticated
using (
  public.is_staff((select auth.uid()))
  or exists (
    select 1
    from public.proposals pr
    join public.projects pj on pj.id = pr.project_id
    join public.profiles p on p.client_id = pj.client_id
    where pr.id = proposal_options.proposal_id
      and p.id = (select auth.uid())
  )
);
create policy popts_staff_insert
on public.proposal_options for insert to authenticated
with check (public.is_staff((select auth.uid())));
create policy popts_staff_update
on public.proposal_options for update to authenticated
using (public.is_staff((select auth.uid())))
with check (public.is_staff((select auth.uid())));
create policy popts_staff_delete
on public.proposal_options for delete to authenticated
using (public.is_staff((select auth.uid())));

drop policy proposals_client_read on public.proposals;
drop policy proposals_staff_all on public.proposals;
create policy proposals_read
on public.proposals for select to authenticated
using (
  public.is_staff((select auth.uid()))
  or exists (
    select 1
    from public.projects pr
    join public.profiles p on p.client_id = pr.client_id
    where pr.id = proposals.project_id
      and p.id = (select auth.uid())
  )
);
create policy proposals_staff_insert
on public.proposals for insert to authenticated
with check (public.is_staff((select auth.uid())));
create policy proposals_staff_update
on public.proposals for update to authenticated
using (public.is_staff((select auth.uid())))
with check (public.is_staff((select auth.uid())));
create policy proposals_staff_delete
on public.proposals for delete to authenticated
using (public.is_staff((select auth.uid())));

drop policy psigs_client_insert on public.proposal_signatures;
drop policy psigs_staff_all on public.proposal_signatures;
create policy psigs_staff_read
on public.proposal_signatures for select to authenticated
using (public.is_staff((select auth.uid())));
create policy psigs_insert
on public.proposal_signatures for insert to authenticated
with check (
  public.is_staff((select auth.uid()))
  or exists (
    select 1
    from public.proposals pr
    join public.projects pj on pj.id = pr.project_id
    join public.profiles p on p.client_id = pj.client_id
    where pr.id = proposal_signatures.proposal_id
      and p.id = (select auth.uid())
  )
);
create policy psigs_staff_update
on public.proposal_signatures for update to authenticated
using (public.is_staff((select auth.uid())))
with check (public.is_staff((select auth.uid())));
create policy psigs_staff_delete
on public.proposal_signatures for delete to authenticated
using (public.is_staff((select auth.uid())));

drop policy user_roles_admin_all on public.user_roles;
create policy user_roles_admin_insert
on public.user_roles for insert to authenticated
with check (public.has_role((select auth.uid()), 'admin'::public.app_role));
create policy user_roles_admin_update
on public.user_roles for update to authenticated
using (public.has_role((select auth.uid()), 'admin'::public.app_role))
with check (public.has_role((select auth.uid()), 'admin'::public.app_role));
create policy user_roles_admin_delete
on public.user_roles for delete to authenticated
using (public.has_role((select auth.uid()), 'admin'::public.app_role));
