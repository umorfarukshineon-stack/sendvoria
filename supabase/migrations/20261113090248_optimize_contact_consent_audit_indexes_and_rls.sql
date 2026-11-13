-- Keep the owner policy statement-stable and index both nullable foreign keys.
drop policy if exists "contact consent audit owner read" on public.contact_consent_events;
create policy "contact consent audit owner read"
  on public.contact_consent_events
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create index if not exists contact_consent_events_contact_id_idx
  on public.contact_consent_events (contact_id);

create index if not exists contact_consent_events_actor_user_id_idx
  on public.contact_consent_events (actor_user_id);
