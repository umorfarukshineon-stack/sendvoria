create unique index if not exists campaign_recipients_campaign_contact_uidx
on public.campaign_recipients(campaign_id, contact_id)
where contact_id is not null;

create index if not exists campaign_recipients_sent_at_idx
on public.campaign_recipients(sent_at) where status = 'sent';
