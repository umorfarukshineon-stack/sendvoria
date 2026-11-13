# Sendvoria production setup

Sendvoria is a marketing workspace. Physical products remain on the merchant's external store. Product records in Sendvoria contain display information and an HTTPS product URL; all shopping cart, checkout, payment, shipping and order processing happen on that external store.

## Platform modules

- Authentication and workspace profile: Supabase Auth + profiles.
- Contacts: CSV import, deduplication, status, tags, custom fields and consent metadata.
- Suppression: unsubscribe, hard bounce, spam complaint and manual suppression.
- Product library: product name, description, image, price, currency and external product URL.
- Campaigns: drafts, HTML/text content, subject, audience filters and scheduled-send metadata.
- Automations: welcome, product-click, birthday, inactivity and manual triggers.
- Analytics: sent/delivered/open/click/bounce/complaint/unsubscribe events.
- Store attribution: optional external store order references and revenue signals.

The SQL migrations create the multi-tenant schema, owner-scoped row-level security policies, provider-event deduplication and an append-only contact consent audit trail. This does not by itself prove that a deployed Supabase project has run the migrations.

## Required environment variables

Set these in the deployment service environment (never commit secrets):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-only; required by public unsubscribe and webhook routes)
- `BREVO_API_KEY` (server-only; optional until sending is deliberately enabled)
- `BREVO_WEBHOOK_SECRET` (server-only; sent in the `x-sendvoria-webhook-secret` header)
- `EMAIL_FROM_ADDRESS` (must be a verified sender/domain)
- `EMAIL_FROM_NAME` (default: Sendvoria)

Do not expose a Supabase service-role key to browser code.

## Setup sequence

1. Create a Supabase project on its free tier and copy its project URL and anon/publishable key.
2. Run every SQL file in `supabase/migrations/` in filename order. The tracked history includes `20261105142222_sendvoria_initial_platform.sql`, `20261105144759_optimize_rls_and_campaign_indexes.sql`, `20261105145356_campaign_recipient_deduplication.sql`, `20261106080954_webhook_event_idempotency.sql` and `20261113085402_contact_consent_audit_trail.sql`, followed by `20261113090047_fix_contact_consent_audit_function_search_path.sql`.
3. Add the Supabase URL and anon key to the deployment environment; add the service-role key only as a server-side secret.
4. Redeploy and test registration, login and row-level security with separate test accounts before importing customer data.
5. If using Brevo, configure the webhook with the custom `x-sendvoria-webhook-secret` header and verify delivery, open, click, hard-bounce, complaint and unsubscribe events.
6. Test both browser confirmation unsubscribe and RFC 8058 one-click POST. GET requests must not unsubscribe recipients.
7. Keep live sending disabled until consent evidence, suppression, sender verification, provider webhooks, quota controls and unsubscribe behavior have been independently tested.

## Responsible sending gates

- Only send to recipients with confirmed, documented opt-in. The UI checkbox is an owner attestation, not independent evidence of consent.
- Do not import purchased, scraped or otherwise non-consented lists.
- Unsubscribe must work without login and must immediately suppress further marketing. The endpoint supports RFC 8058 one-click POST; test it with the actual email provider before production.
- Hard bounces, spam complaints and explicit unsubscribes must be suppressed. Soft bounces are recorded but are not automatically treated as permanent suppression.
- Webhook events with provider event IDs are deduplicated. The consent audit migration records opt-in confirmation, consent withdrawal, hard bounces and spam complaints, including source, method, evidence reference, actor/provider and before/after status. Audit rows are owner-readable and append-only; authenticated application roles cannot update or delete them.
- CSV import requires an owner attestation and an original opt-in source. The optional `consent_at` CSV column preserves the original opt-in timestamp when supplied. If omitted, Sendvoria records the import-attestation time instead; that timestamp is not independent proof of the original opt-in. An optional `evidence_reference` column (or workspace default reference) can point to the relevant CRM/form record.
- Authenticated contact history is available at `GET /api/contacts/{contactId}/consent-history` after the migration is applied. Campaign-send concurrency locks, safe retry behavior and end-to-end audit verification still require additional testing.
- Do not claim revenue attribution unless an external-store integration sends verified purchase events.

## Free-tier expectations

Use free tiers only. Free plans have quotas, may sleep or throttle, and can change. 100,000 stored contacts does not mean 100,000 emails can be sent for free. Never configure a paid fallback or automatic upgrade without the owner's explicit approval.
