-- Cache auth.uid() per statement instead of per row in owner policies.
drop policy if exists "profiles owner access" on public.profiles;
create policy "profiles owner access" on public.profiles for all to authenticated
using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

drop policy if exists "contacts owner access" on public.contacts;
create policy "contacts owner access" on public.contacts for all to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "suppression owner access" on public.suppression_list;
create policy "suppression owner access" on public.suppression_list for all to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "products owner access" on public.products;
create policy "products owner access" on public.products for all to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "campaigns owner access" on public.campaigns;
create policy "campaigns owner access" on public.campaigns for all to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "automations owner access" on public.automations;
create policy "automations owner access" on public.automations for all to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "events owner read" on public.email_events;
create policy "events owner read" on public.email_events for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "attribution owner access" on public.store_attribution;
create policy "attribution owner access" on public.store_attribution for all to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "campaign recipients owner access" on public.campaign_recipients;
create policy "campaign recipients owner access" on public.campaign_recipients for all to authenticated
using (exists (select 1 from public.campaigns c where c.id = campaign_id and c.user_id = (select auth.uid())))
with check (exists (select 1 from public.campaigns c where c.id = campaign_id and c.user_id = (select auth.uid())));

create index if not exists automations_user_id_idx on public.automations(user_id);
create index if not exists campaign_recipients_contact_id_idx on public.campaign_recipients(contact_id);
create index if not exists email_events_campaign_id_idx on public.email_events(campaign_id);
create index if not exists email_events_contact_id_idx on public.email_events(contact_id);
create index if not exists store_attribution_campaign_id_idx on public.store_attribution(campaign_id);
create index if not exists store_attribution_product_id_idx on public.store_attribution(product_id);
create index if not exists store_attribution_user_id_idx on public.store_attribution(user_id);
