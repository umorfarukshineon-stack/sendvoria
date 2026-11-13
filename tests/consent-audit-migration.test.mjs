import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  new URL("../supabase/migrations/202611130001_consent_audit_trail.sql", import.meta.url),
  "utf8"
);

test("creates an owner-scoped consent audit table with RLS", () => {
  assert.match(migration, /create table if not exists public\.contact_consent_events/i);
  assert.match(migration, /alter table public\.contact_consent_events enable row level security/i);
  assert.match(migration, /for select\s+to authenticated\s+using \(auth\.uid\(\) = user_id\)/i);
  assert.match(migration, /grant select on public\.contact_consent_events to authenticated/i);
});

test("keeps audit events append-only for application roles", () => {
  assert.match(migration, /before update or delete on public\.contact_consent_events/i);
  assert.match(migration, /pg_trigger_depth\(\) > 1/i);
  assert.match(migration, /to_jsonb\(old\) - 'contact_id' - 'actor_user_id'/i);
  assert.match(migration, /revoke all on public\.contact_consent_events from anon, authenticated/i);
  assert.doesNotMatch(migration, /create policy[^;]+for (insert|update|delete|all)/i);
});

test("records opt-in, withdrawal, hard-bounce and complaint transitions", () => {
  for (const event of ["opt_in_confirmed", "consent_withdrawn", "hard_bounce", "spam_complaint"]) {
    assert.ok(migration.includes("'" + event + "'"), "missing audit event " + event);
  }
  assert.match(migration, /after insert or update of status, consent_status on public\.contacts/i);
  assert.match(migration, /new\.consent_evidence_reference/i);
  assert.match(migration, /provider_webhook/i);
  assert.match(migration, /one_click_unsubscribe/i);
  assert.match(migration, /auth\.uid\(\)/i);
  assert.match(migration, /on conflict \(user_id, provider, provider_event_id\) do nothing/i);
  assert.match(migration, /old\.status is distinct from 'unsubscribed'\s+or old\.consent_status is distinct from 'withdrawn'/i);
});
