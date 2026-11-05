-- Sendvoria initial schema: external-store commerce links only.
-- Apply this migration in a Supabase project before enabling backend features.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  workspace_name text not null default 'My Workspace',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  first_name text,
  last_name text,
  status text not null default 'pending' check (status in ('pending','subscribed','unsubscribed','bounced','complained')),
  consent_status text not null default 'unknown' check (consent_status in ('unknown','pending','confirmed','withdrawn')),
  consent_source text,
  consent_at timestamptz,
  consent_ip inet,
  unsubscribe_token uuid not null default gen_random_uuid(),
  tags text[] not null default '{}',
  custom_fields jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, email)
);
create index if not exists contacts_user_status_idx on public.contacts(user_id, status);
create index if not exists contacts_user_email_idx on public.contacts(user_id, email);

create table if not exists public.suppression_list (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  reason text not null check (reason in ('unsubscribe','hard_bounce','spam_complaint','manual')),
  source text,
  created_at timestamptz not null default now(),
  unique(user_id, email)
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  image_url text,
  price numeric(12,2),
  currency text not null default 'USD',
  external_url text not null check (external_url ~ '^https://'),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists products_user_created_idx on public.products(user_id, created_at desc);

create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  subject text not null,
  preview_text text,
  html_content text,
  text_content text,
  status text not null default 'draft' check (status in ('draft','scheduled','queued','sending','sent','paused','failed')),
  scheduled_at timestamptz,
  sent_at timestamptz,
  audience_filter jsonb not null default '{}'::jsonb,
  provider_campaign_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists campaigns_user_created_idx on public.campaigns(user_id, created_at desc);

create table if not exists public.campaign_recipients (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null,
  email text not null,
  status text not null default 'pending' check (status in ('pending','sent','delivered','bounced','complained','failed')),
  provider_message_id text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists campaign_recipients_campaign_idx on public.campaign_recipients(campaign_id, status);

create table if not exists public.automations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  trigger_type text not null check (trigger_type in ('welcome','product_click','birthday','inactivity','manual')),
  is_active boolean not null default false,
  configuration jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.email_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  campaign_id uuid references public.campaigns(id) on delete set null,
  contact_id uuid references public.contacts(id) on delete set null,
  event_type text not null check (event_type in ('sent','delivered','open','click','bounce','complaint','unsubscribe')),
  url text,
  provider_event_id text,
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);
create index if not exists email_events_user_date_idx on public.email_events(user_id, occurred_at desc);

create table if not exists public.store_attribution (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  campaign_id uuid references public.campaigns(id) on delete set null,
  product_id uuid references public.products(id) on delete set null,
  external_order_reference text,
  revenue numeric(12,2),
  currency text not null default 'USD',
  attributed_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['profiles','contacts','products','campaigns','automations'] loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

alter table public.profiles enable row level security;
alter table public.contacts enable row level security;
alter table public.suppression_list enable row level security;
alter table public.products enable row level security;
alter table public.campaigns enable row level security;
alter table public.campaign_recipients enable row level security;
alter table public.automations enable row level security;
alter table public.email_events enable row level security;
alter table public.store_attribution enable row level security;

create policy "profiles owner access" on public.profiles for all using (auth.uid() = id) with check (auth.uid() = id);
create policy "contacts owner access" on public.contacts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "suppression owner access" on public.suppression_list for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "products owner access" on public.products for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "campaigns owner access" on public.campaigns for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "automations owner access" on public.automations for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "events owner read" on public.email_events for select using (auth.uid() = user_id);
create policy "attribution owner access" on public.store_attribution for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "campaign recipients owner access" on public.campaign_recipients for all
  using (exists (select 1 from public.campaigns c where c.id = campaign_id and c.user_id = auth.uid()))
  with check (exists (select 1 from public.campaigns c where c.id = campaign_id and c.user_id = auth.uid()));

-- Create a profile automatically when a new Supabase Auth user registers.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id, full_name) values (new.id, coalesce(new.raw_user_meta_data->>'full_name',''));
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();
