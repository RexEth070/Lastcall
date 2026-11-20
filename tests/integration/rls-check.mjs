/**
 * Live Supabase RLS Isolation Check (Quality Gate: User A cannot read/mutate User B data).
 * Run after applying supabase/migrations/202611200001_initial_schema.sql:
 *   npm run test:rls
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

function loadEnvLocal() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnvLocal();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secretKey = process.env.SUPABASE_SECRET_KEY;

if (!url || !publishableKey || !secretKey) {
  console.error("Missing Supabase env vars in .env.local");
  process.exit(1);
}

const admin = createClient(url, secretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const runTag = crypto.randomBytes(4).toString("hex");
const emailA = `rls-user-a-${runTag}@lastcall.test`;
const emailB = `rls-user-b-${runTag}@lastcall.test`;
const pw = `RlsTest!${runTag}2026`;

let userAId = null;
let userBId = null;

async function main() {
  // Verify schema exists first
  const probe = await admin.from("subscriptions").select("id").limit(1);
  if (probe.error) {
    console.error("Schema check failed:", probe.error.message);
    process.exit(1);
  }

  const createdA = await admin.auth.admin.createUser({
    email: emailA,
    password: pw,
    email_confirm: true,
  });
  const createdB = await admin.auth.admin.createUser({
    email: emailB,
    password: pw,
    email_confirm: true,
  });
  if (createdA.error || createdB.error) {
    throw new Error(
      `Failed creating test users: ${createdA.error?.message || createdB.error?.message}`,
    );
  }
  userAId = createdA.data.user.id;
  userBId = createdB.data.user.id;

  const clientA = createClient(url, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const clientB = createClient(url, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const anonClient = createClient(url, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  await clientA.auth.signInWithPassword({ email: emailA, password: pw });
  await clientB.auth.signInWithPassword({ email: emailB, password: pw });

  // User B inserts a subscription
  const inserted = await clientB
    .from("subscriptions")
    .insert({
      user_id: userBId,
      service_name: "Private User B Service",
      plan_name: "Pro",
      account_label: "b***@example.com",
      amount_minor: 1500,
      currency: "USD",
      cadence: "monthly",
      next_renewal_at: "2026-12-01T00:00:00.000Z",
      timezone: "UTC",
      policy_type: "unknown",
      notice_period_days: 0,
      safety_buffer_hours: 48,
      policy_confidence: "unknown",
    })
    .select("id")
    .single();

  if (inserted.error) {
    throw new Error(`User B insert failed: ${inserted.error.message}`);
  }
  const subBId = inserted.data.id;

  // Check 1: Unauthenticated anon sees 0 rows
  const anonRead = await anonClient.from("subscriptions").select("id").eq("id", subBId);
  if ((anonRead.data ?? []).length !== 0) {
    throw new Error("RLS VIOLATION: Anonymous client read User B subscription!");
  }

  // Check 2: User A tries to SELECT User B's subscription
  const crossRead = await clientA.from("subscriptions").select("id").eq("id", subBId);
  if ((crossRead.data ?? []).length !== 0) {
    throw new Error("RLS VIOLATION: User A read User B subscription!");
  }

  // Check 3: User A tries to UPDATE User B's subscription
  const crossUpdate = await clientA
    .from("subscriptions")
    .update({ service_name: "Hacked" })
    .eq("id", subBId)
    .select("id");
  if ((crossUpdate.data ?? []).length !== 0) {
    throw new Error("RLS VIOLATION: User A updated User B subscription!");
  }

  console.log("PASS: RLS denied anon read, User A cross-read, and User A cross-update on User B subscription.");
}

main()
  .catch((err) => {
    console.error("RLS CHECK FAILED:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (userAId) await admin.auth.admin.deleteUser(userAId);
    if (userBId) await admin.auth.admin.deleteUser(userBId);
  });
