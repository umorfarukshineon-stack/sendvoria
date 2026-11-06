-- Deduplicate webhook retries without deleting any historical analytics.
-- PostgreSQL permits multiple NULL values in a unique index, so events without
-- a stable provider event ID remain insertable.
alter table public.email_events
  add column if not exists provider_event_fingerprint text;

create unique index if not exists email_events_provider_event_fingerprint_uidx
  on public.email_events (user_id, provider_event_fingerprint);
