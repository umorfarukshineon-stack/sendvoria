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

The SQL migration creates the initial multi-tenant schema and row-level security policies. Frontend screens and sending workflows must be connected to these tables before calling the app production-ready.

## Required environment variables

Set these in Render's service environment (never commit secrets):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `BREVO_API_KEY` (server-side only; optional until sending is implemented)
- `EMAIL_FROM_ADDRESS` (must be a verified sender/domain)
- `EMAIL_FROM_NAME` (default: Sendvoria)

Do not expose a Supabase service-role key to browser code. If a privileged server operation is later required, keep its key server-only and enforce user authorization in every route.

## Setup sequence

1. Create a Supabase project on its free tier and copy its project URL and anon/publishable key.
2. Run `supabase/migrations/202611050001_initial_platform.sql` in the Supabase SQL Editor.
3. Add the Supabase URL and anon key to Render environment variables.
4. Redeploy and test registration, login and row-level security before importing customer data.
5. Configure an email provider in test mode, verify sender identity, and implement unsubscribe/bounce/complaint webhooks before enabling campaign delivery.

## Responsible sending gates

- Only send to recipients with confirmed, documented opt-in.
- Do not import purchased, scraped or otherwise non-consented lists.
- Unsubscribe must work without login and must immediately suppress further marketing.
- Hard bounces and spam complaints must be suppressed.
- Add provider rate limits, campaign throttling, idempotency and audit logging.
- Do not claim revenue attribution unless an external-store integration sends verified purchase events.

## Free-tier expectations

Use free tiers only. Free plans have quotas, may sleep or throttle, and can change. 100,000 stored contacts does not mean 100,000 emails can be sent for free. Never configure a paid fallback or automatic upgrade without the owner's explicit approval.
