create policy "Service role manages portal rate limits"
on private.portal_rate_limits
for all
to service_role
using (true)
with check (true);
