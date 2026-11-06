-- Prevent duplicate provider webhook deliveries from inflating analytics.
-- PostgreSQL permits multiple NULL values in a unique index, so events without
-- a provider event ID remain insertable while identified events are deduplicated.

delete from public.email_events older
using public.email_events newer
where older.user_id = newer.user_id
  and older.provider_event_id is not null
  and older.provider_event_id = newer.provider_event_id
  and older.event_type = newer.event_type
  and older.id > newer.id;

create unique index if not exists email_events_provider_event_type_uidx
  on public.email_events (user_id, provider_event_id, event_type);
