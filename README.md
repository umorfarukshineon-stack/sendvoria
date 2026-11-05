# Sendvoria

**Marketing meets Commerce.**

Sendvoria is an email-marketing workspace for managing opted-in contacts, creating campaigns, organizing product links, and measuring engagement. Product purchases happen on the merchant's existing online store.

## Current starter release

- Responsive dashboard and navigation
- Contacts CSV import (first-column email parser, browser session only)
- Product link library (browser session only)
- Campaign draft form and email preview (browser session only)
- Automation and analytics setup placeholders
- Environment-variable template for future integrations

> This is an early frontend starter, not a production email marketing service yet. The current contact/product/campaign data is held in browser memory and is lost on refresh. No emails are sent. No payment, cart, checkout, shipping, or order processing is included.

## Run locally

Requirements: Node.js 20.9+ and npm.

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Planned integrations

1. Supabase Auth + PostgreSQL + Row Level Security for accounts, contacts, consent records, products, campaigns and suppression lists.
2. Email provider integration (start in provider test mode; store API keys only on the server).
3. Unsubscribe, bounce and complaint processing before production sending.
4. Campaign scheduling, templates, personalization, tracking and analytics.
5. Optional external-store tracking/webhooks for conversion attribution.

## Responsible sending

Only email contacts who have explicitly opted in to receive the relevant marketing. Maintain proof of consent, include a working unsubscribe link, honor opt-outs promptly, and suppress bounced or complained addresses. Do not upload scraped or purchased lists. Sending capacity and provider pricing depend on the selected email service and its current plan.

## Environment variables

Copy `.env.example` to `.env.local` when integrations are added. Never commit real API keys, service-role keys, passwords, or customer data.

## License

All rights reserved unless a license is added by the project owner.