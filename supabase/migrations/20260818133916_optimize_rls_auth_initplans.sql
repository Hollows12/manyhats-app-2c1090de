-- Cache auth.uid() once per statement in RLS policies.
-- This is a performance-only rewrite: policy names, roles, commands, and
-- authorization predicates remain unchanged.

alter policy "Admins read all activity" on public.activity_logs
  using (has_role((select auth.uid()), 'admin'::app_role));

alter policy "Crew read own activity" on public.activity_logs
  using ((actor_id = (select auth.uid())));

alter policy "Staff insert activity" on public.activity_logs
  with check ((is_staff((select auth.uid())) AND (actor_id = (select auth.uid()))));

alter policy "staff manage ai recs" on public.ai_estimate_recommendations
  using (is_staff((select auth.uid())))
  with check (is_staff((select auth.uid())));

alter policy "Admins read audit trails" on public.audit_trails
  using (has_role((select auth.uid()), 'admin'::app_role));

alter policy "Staff insert audit trails" on public.audit_trails
  with check ((is_staff((select auth.uid())) AND (actor_id = (select auth.uid()))));

alter policy co_staff_all on public.change_orders
  using (is_staff((select auth.uid())))
  with check (is_staff((select auth.uid())));

alter policy "Admins read share views" on public.client_file_share_views
  using (( SELECT has_role((select auth.uid()), 'admin'::app_role) AS has_role));

alter policy "Admins manage client file shares" on public.client_file_shares
  using (( SELECT has_role((select auth.uid()), 'admin'::app_role) AS has_role))
  with check (( SELECT has_role((select auth.uid()), 'admin'::app_role) AS has_role));

alter policy clients_client_self_read on public.clients
  using ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.client_id = clients.id)))));

alter policy clients_staff_all on public.clients
  using (is_staff((select auth.uid())))
  with check (is_staff((select auth.uid())));

alter policy concepts_staff_all on public.concept_requests
  using (is_staff((select auth.uid())))
  with check (is_staff((select auth.uid())));

alter policy cb_staff_all on public.container_builds
  using (is_staff((select auth.uid())))
  with check (is_staff((select auth.uid())));

alter policy "own service areas" on public.contractor_service_areas
  using (((contractor_id = (select auth.uid())) OR is_staff((select auth.uid()))))
  with check (((contractor_id = (select auth.uid())) OR has_role((select auth.uid()), 'admin'::app_role)));

alter policy dl_staff_all on public.daily_logs
  using (is_staff((select auth.uid())))
  with check (is_staff((select auth.uid())));

alter policy "Staff manage deposits" on public.deposits
  using (is_staff((select auth.uid())))
  with check (is_staff((select auth.uid())));

alter policy "Admins read error logs" on public.error_logs
  using (has_role((select auth.uid()), 'admin'::app_role));

alter policy "Signed-in users insert own errors" on public.error_logs
  with check (((user_id = (select auth.uid())) OR (user_id IS NULL)));

alter policy elines_staff_all on public.estimate_line_items
  using (is_staff((select auth.uid())))
  with check (is_staff((select auth.uid())));

alter policy estimates_staff_all on public.estimates
  using (is_staff((select auth.uid())))
  with check (is_staff((select auth.uid())));

alter policy "admin write jobs" on public.firecrawl_jobs
  using (has_role((select auth.uid()), 'admin'::app_role))
  with check (has_role((select auth.uid()), 'admin'::app_role));

alter policy "staff read jobs" on public.firecrawl_jobs
  using (is_staff((select auth.uid())));

alter policy hp_staff_all on public.historic_projects
  using (is_staff((select auth.uid())))
  with check (is_staff((select auth.uid())));

alter policy hb_staff_all on public.home_builds
  using (is_staff((select auth.uid())))
  with check (is_staff((select auth.uid())));

alter policy "Admins manage invitations" on public.invitations
  using (has_role((select auth.uid()), 'admin'::app_role))
  with check (has_role((select auth.uid()), 'admin'::app_role));

alter policy "Staff manage invoice items" on public.invoice_line_items
  using (is_staff((select auth.uid())))
  with check (is_staff((select auth.uid())));

alter policy "Staff manage invoices" on public.invoices
  using (is_staff((select auth.uid())))
  with check (is_staff((select auth.uid())));

alter policy jc_staff_all on public.job_costs
  using (is_staff((select auth.uid())))
  with check (is_staff((select auth.uid())));

alter policy tasks_staff_all on public.job_tasks
  using (is_staff((select auth.uid())))
  with check (is_staff((select auth.uid())));

alter policy "admin write knowledge" on public.knowledge_docs
  using (has_role((select auth.uid()), 'admin'::app_role))
  with check (has_role((select auth.uid()), 'admin'::app_role));

alter policy "staff read knowledge" on public.knowledge_docs
  using (is_staff((select auth.uid())));

alter policy kb_staff_all on public.knowledge_entries
  using (is_staff((select auth.uid())))
  with check (is_staff((select auth.uid())));

alter policy lidar_staff_all on public.lidar_scans
  using (is_staff((select auth.uid())))
  with check (is_staff((select auth.uid())));

alter policy mat_admin_delete on public.material_costs
  using (has_role((select auth.uid()), 'admin'::app_role));

alter policy mat_admin_update on public.material_costs
  using (has_role((select auth.uid()), 'admin'::app_role));

alter policy mat_admin_write on public.material_costs
  with check (has_role((select auth.uid()), 'admin'::app_role));

alter policy mat_staff_read on public.material_costs
  using (is_staff((select auth.uid())));

alter policy "admin write prices" on public.material_prices
  using (has_role((select auth.uid()), 'admin'::app_role))
  with check (has_role((select auth.uid()), 'admin'::app_role));

alter policy "staff read prices" on public.material_prices
  using (is_staff((select auth.uid())));

alter policy "admin write materials" on public.materials
  using (has_role((select auth.uid()), 'admin'::app_role))
  with check (has_role((select auth.uid()), 'admin'::app_role));

alter policy "staff read materials" on public.materials
  using (is_staff((select auth.uid())));

alter policy measurements_staff_all on public.measurements
  using (is_staff((select auth.uid())))
  with check (is_staff((select auth.uid())));

alter policy notif_staff_insert on public.notifications
  with check (is_staff((select auth.uid())));

alter policy notif_staff_read on public.notifications
  using ((is_staff((select auth.uid())) AND ((user_id IS NULL) OR (user_id = (select auth.uid())))));

alter policy notif_staff_update on public.notifications
  using ((is_staff((select auth.uid())) AND ((user_id IS NULL) OR (user_id = (select auth.uid())))))
  with check ((is_staff((select auth.uid())) AND ((user_id IS NULL) OR (user_id = (select auth.uid())))));

alter policy "Staff manage payments" on public.payments
  using (is_staff((select auth.uid())))
  with check (is_staff((select auth.uid())));

alter policy "own preferred vendors" on public.preferred_vendors
  using (((contractor_id = (select auth.uid())) OR is_staff((select auth.uid()))))
  with check (((contractor_id = (select auth.uid())) OR is_staff((select auth.uid()))));

alter policy pr_admin_write on public.production_rates
  using (has_role((select auth.uid()), 'admin'::app_role))
  with check (has_role((select auth.uid()), 'admin'::app_role));

alter policy pr_staff_read on public.production_rates
  using (is_staff((select auth.uid())));

alter policy profiles_insert_self on public.profiles
  with check (((select auth.uid()) = id));

alter policy profiles_select_self_or_staff on public.profiles
  using ((((select auth.uid()) = id) OR is_staff((select auth.uid()))));

alter policy profiles_update_self on public.profiles
  using (((select auth.uid()) = id));

alter policy "Staff manage progress billings" on public.progress_billings
  using (is_staff((select auth.uid())))
  with check (is_staff((select auth.uid())));

alter policy photos_staff_all on public.project_photos
  using (is_staff((select auth.uid())))
  with check (is_staff((select auth.uid())));

alter policy projects_client_read on public.projects
  using ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.client_id = projects.client_id)))));

alter policy projects_staff_all on public.projects
  using (is_staff((select auth.uid())))
  with check (is_staff((select auth.uid())));

alter policy popts_client_read on public.proposal_options
  using ((EXISTS ( SELECT 1
   FROM ((proposals pr
     JOIN projects pj ON ((pj.id = pr.project_id)))
     JOIN profiles p ON ((p.client_id = pj.client_id)))
  WHERE ((pr.id = proposal_options.proposal_id) AND (p.id = (select auth.uid()))))));

alter policy popts_staff_all on public.proposal_options
  using (is_staff((select auth.uid())))
  with check (is_staff((select auth.uid())));

alter policy psigs_client_insert on public.proposal_signatures
  with check ((EXISTS ( SELECT 1
   FROM ((proposals pr
     JOIN projects pj ON ((pj.id = pr.project_id)))
     JOIN profiles p ON ((p.client_id = pj.client_id)))
  WHERE ((pr.id = proposal_signatures.proposal_id) AND (p.id = (select auth.uid()))))));

alter policy psigs_staff_all on public.proposal_signatures
  using (is_staff((select auth.uid())))
  with check (is_staff((select auth.uid())));

alter policy proposals_client_read on public.proposals
  using ((EXISTS ( SELECT 1
   FROM (projects pr
     JOIN profiles p ON ((p.client_id = pr.client_id)))
  WHERE ((pr.id = proposals.project_id) AND (p.id = (select auth.uid()))))));

alter policy proposals_staff_all on public.proposals
  using (is_staff((select auth.uid())))
  with check (is_staff((select auth.uid())));

alter policy "Staff manage receipts" on public.receipts
  using (is_staff((select auth.uid())))
  with check (is_staff((select auth.uid())));

alter policy sp_staff_all on public.septic_projects
  using (is_staff((select auth.uid())))
  with check (is_staff((select auth.uid())));

alter policy "admin write suppliers" on public.suppliers
  using (has_role((select auth.uid()), 'admin'::app_role))
  with check (has_role((select auth.uid()), 'admin'::app_role));

alter policy "staff read suppliers" on public.suppliers
  using (is_staff((select auth.uid())));

alter policy user_roles_admin_all on public.user_roles
  using (has_role((select auth.uid()), 'admin'::app_role))
  with check (has_role((select auth.uid()), 'admin'::app_role));

alter policy user_roles_select_self_or_admin on public.user_roles
  using (((user_id = (select auth.uid())) OR has_role((select auth.uid()), 'admin'::app_role)));

alter policy voice_staff_all on public.voice_notes
  using (is_staff((select auth.uid())))
  with check (is_staff((select auth.uid())));
