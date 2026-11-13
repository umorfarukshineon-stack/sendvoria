-- Append-only consent and suppression audit history.
-- This migration is additive: it does not delete or rewrite existing contacts.

alter table public.contacts
  add column if not exists consent_method text,
  add column if not exists consent_evidence_reference text,
  add column if not exists status_source text,
  add column if not exists status_provider text,
  add column if not exists status_provider_event_id text;

create table if not exists public.contact_consent_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null,
  email_snapshot text not null,
  event_type text not null check (event_type in (
    'opt_in_confirmed',
    'consent_withdrawn',
    'hard_bounce',
    'spam_complaint'
  )),
  source text not null check (length(btrim(source)) > 0),
  method text,
  evidence_reference text,
  provider text not null default 'sendvoria',
  provider_event_id text,
  actor_user_id uuid references auth.users(id) on delete set null,
  occurred_at timestamptz not null default now(),
  recorded_at timestamptz not null default now(),
  previous_status text,
  new_status text,
  previous_consent_status text,
  new_consent_status text,
  metadata jsonb not null default '{}'::jsonb,
  constraint contact_consent_events_provider_event_unique
    unique (user_id, provider, provider_event_id)
);

create index if not exists contact_consent_events_owner_contact_time_idx
  on public.contact_consent_events (user_id, contact_id, recorded_at desc);
create index if not exists contact_consent_events_owner_email_time_idx
  on public.contact_consent_events (user_id, email_snapshot, recorded_at desc);

alter table public.contact_consent_events enable row level security;

drop policy if exists "contact consent audit owner read" on public.contact_consent_events;
create policy "contact consent audit owner read"
  on public.contact_consent_events
  for select
  to authenticated
  using (auth.uid() = user_id);

-- Authenticated users can read their own audit events only. Inserts are performed
-- by the SECURITY DEFINER trigger below; clients receive no UPDATE/DELETE rights.
revoke all on public.contact_consent_events from anon, authenticated;
grant select on public.contact_consent_events to authenticated;

create or replace function public.prevent_contact_consent_event_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Contact consent audit events are append-only.'
    using errcode = '55000';
end;
$$;

drop trigger if exists contact_consent_events_immutable on public.contact_consent_events;
create trigger contact_consent_events_immutable
  before update or delete on public.contact_consent_events
  for each row execute function public.prevent_contact_consent_event_mutation();

create or replace function public.capture_contact_consent_event()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_event_type text;
  v_source text;
  v_provider text;
  v_provider_event_id text;
  v_previous_status text;
  v_previous_consent_status text;
  v_occurred_at timestamptz := now();
begin
  if tg_op = 'UPDATE' then
    v_previous_status := old.status;
    v_previous_consent_status := old.consent_status;
  end if;

  if new.status = 'complained'
     and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    v_event_type := 'spam_complaint';
  elsif new.status = 'bounced'
     and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    v_event_type := 'hard_bounce';
  elsif (new.status = 'unsubscribed' or new.consent_status = 'withdrawn')
     and (
       tg_op = 'INSERT'
       or old.status is distinct from new.status
       or old.consent_status is distinct from new.consent_status
     ) then
    if tg_op = 'INSERT'
       or (old.status is distinct from 'unsubscribed'
           or old.consent_status is distinct from 'withdrawn') then
      v_event_type := 'consent_withdrawn';
    end if;
  elsif new.status = 'subscribed'
     and new.consent_status = 'confirmed'
     and (
       tg_op = 'INSERT'
       or old.status is distinct from new.status
       or old.consent_status is distinct from new.consent_status
     ) then
    v_event_type := 'opt_in_confirmed';
  end if;

  if v_event_type is null then
    return new;
  end if;

  if v_event_type = 'opt_in_confirmed' then
    v_source := coalesce(nullif(btrim(new.consent_source), ''), 'Owner-attested contact import');
    v_provider := 'sendvoria';
    v_provider_event_id := null;
    v_occurred_at := coalesce(new.consent_at, now());
  else
    v_source := coalesce(nullif(btrim(new.status_source), ''), 'Contact status transition');
    v_provider := coalesce(nullif(btrim(new.status_provider), ''), 'sendvoria');
    v_provider_event_id := new.status_provider_event_id;
  end if;

  insert into public.contact_consent_events (
    user_id,
    contact_id,
    email_snapshot,
    event_type,
    source,
    method,
    evidence_reference,
    provider,
    provider_event_id,
    actor_user_id,
    occurred_at,
    previous_status,
    new_status,
    previous_consent_status,
    new_consent_status,
    metadata
  ) values (
    new.user_id,
    new.id,
    new.email,
    v_event_type,
    v_source,
    new.consent_method,
    new.consent_evidence_reference,
    v_provider,
    v_provider_event_id,
    auth.uid(),
    v_occurred_at,
    v_previous_status,
    new.status,
    v_previous_consent_status,
    new.consent_status,
    jsonb_build_object(
      'trigger_operation', tg_op,
      'status_source', new.status_source
    )
  )
  on conflict (user_id, provider, provider_event_id) do nothing;

  return new;
end;
$$;

drop trigger if exists contacts_capture_consent_event on public.contacts;
create trigger contacts_capture_consent_event
  after insert or update of status, consent_status on public.contacts
  for each row execute function public.capture_contact_consent_event();

revoke all on function public.capture_contact_consent_event() from public, anon, authenticated;
revoke all on function public.prevent_contact_consent_event_mutation() from public, anon, authenticated;
