# Sendvoria

**Marketing meets Commerce.**

Sendvoria is an email-marketing workspace for permission-based contacts, campaign drafts, product promotion and engagement reporting. Physical products stay on the merchant's external store: Sendvoria stores product details and HTTPS product links only. Customers add to cart and check out on that external store.

## Current implementation

- Supabase Auth and server-side session handling.
- PostgreSQL tables with owner-scoped Row Level Security.
- Contacts CSV import with owner attestation, original opt-in source and optional evidence/timestamp fields.
- Append-only consent audit history for opt-in confirmation, withdrawal, hard bounce and spam complaint events.
- Product link library with external HTTPS URLs.
- Campaign drafts and scheduled-send metadata.
- Public unsubscribe confirmation page and RFC 8058 one-click POST support.
- Brevo webhook processing for delivery, open, click, bounce, complaint and unsubscribe events.
- Provider webhook event deduplication when Brevo supplies an event ID.
- Analytics and health endpoints.

This is not a production-ready bulk email service. Live sending is disabled unless the owner explicitly configures the server-side gates, and it must remain disabled until the sender domain, unsubscribe flow, suppression handling, consent evidence and provider webhooks have been tested. A contact checkbox is an owner attestation; it does not independently prove how or when a person opted in.

## Local setup

Requirements: Node.js 20.9+ and npm.

```bash
npm install
cp .env.example .env.local
npm test
npm run dev
```

Open http://localhost:3000.

## Supabase setup

1. Create a Supabase project on its free tier.
2. Apply the SQL migrations in `supabase/migrations/` in filename order, including `202611130001_consent_audit_trail.sql`.
3. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in your local environment and deployment service.
4. Test registration, login and owner isolation before importing real contacts.
5. Keep `SUPABASE_SERVICE_ROLE_KEY` server-only; it is used by public unsubscribe and provider webhook routes.

## Email provider setup

Brevo integration is optional. Keep `BREVO_API_KEY`, `EMAIL_FROM_ADDRESS`, `EMAIL_FROM_NAME` and `BREVO_WEBHOOK_SECRET` in server-side environment variables only. Configure the webhook secret using the `x-sendvoria-webhook-secret` request header; query-string secrets are not accepted.

The unsubscribe URL is sent in both the `List-Unsubscribe` and `List-Unsubscribe-Post` headers. Browser GET requests show a confirmation page; RFC 8058 POST requests unsubscribe directly without requiring a login. Hard bounces, spam complaints and explicit unsubscribes are added to the suppression list. Soft bounces are recorded but are not treated as permanent suppression.

Live delivery requires both `SENDER_DOMAIN_VERIFIED=true` and `SENDVORIA_LIVE_SENDING_ENABLED=true`, as well as valid provider and unsubscribe configuration. Keep these values false until compliance and deliverability testing is complete. Never test against the full 100,000-contact audience.

## Responsible sending

Only email contacts with explicit, documented permission for the relevant marketing. Retain the original opt-in evidence, source and timestamp; honor opt-outs promptly; and suppress hard bounces and complaints. Do not upload scraped or purchased lists. Stored contacts do not imply free sending capacity: provider limits and pricing vary by plan.

## Commerce boundary

Sendvoria does not implement carts, checkout, payments, shipping or order fulfillment. Product calls to action link to the merchant's external product/store page.

## Secrets and customer data

Never commit API keys, service-role keys, passwords, access tokens or customer email lists. Use deployment environment settings for secrets. The repository is public, so keep production data out of Git.

## License

All rights reserved unless a license is added by the project owner.
