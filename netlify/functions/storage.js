// netlify/functions/storage.js
// Netlify Blobs-backed key-value store for TheGlobalDesk
// GET    /.netlify/functions/storage?key=xxx         → { value }  (public, no auth needed)
// POST   /.netlify/functions/storage  { key, value } → { ok }     (requires Admin API key)
// DELETE /.netlify/functions/storage?key=xxx         → { ok }     (requires Admin API key)
//
// 🔒 SECURITY:
// POST and DELETE require the header:  x-admin-key: YOUR_SECRET_KEY
// Set the secret in Netlify → Site configuration → Environment variables
// Variable name:  ADMIN_SECRET_KEY
// Variable value: (a strong password you choose — keep it private!)

import { getStore } from "@netlify/blobs";

const STORE_NAME = "globaldesk";

// CORS headers
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-admin-key",
};

export default async function handler(req, context) {
  // Preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }

  const store = getStore(STORE_NAME);
  const url   = new URL(req.url);
  const key   = url.searchParams.get("key");

  // ── GET is PUBLIC — anyone can read ──
  if (req.method === "GET") {
    if (!key) return json({ error: "key required" }, 400);
    try {
      const value = await store.get(key);
      if (value === null) return json({ value: null }, 200);
      return json({ value }, 200);
    } catch (err) {
      return json({ error: String(err) }, 500);
    }
  }

  // ── POST and DELETE require Admin API Key ──
  const adminKey = req.headers.get("x-admin-key");
  const secretKey = Netlify.env.get("ADMIN_SECRET_KEY");

  // Block if env variable not set at all
  if (!secretKey) {
    console.error("ADMIN_SECRET_KEY environment variable is not set!");
    return json({ error: "Server misconfiguration" }, 500);
  }

  // Block if wrong or missing key
  if (!adminKey || adminKey !== secretKey) {
    return json({ error: "Unauthorized — invalid or missing admin key" }, 401);
  }

  try {
    // ── POST ──
    if (req.method === "POST") {
      const body = await req.json();
      if (!body.key) return json({ error: "key required" }, 400);
      await store.set(body.key, body.value ?? "");
      return json({ ok: true }, 200);
    }

    // ── DELETE ──
    if (req.method === "DELETE") {
      if (!key) return json({ error: "key required" }, 400);
      await store.delete(key);
      return json({ ok: true }, 200);
    }

    return json({ error: "method not allowed" }, 405);

  } catch (err) {
    console.error("storage function error:", err);
    return json({ error: String(err) }, 500);
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

export const config = {
  path: "/.netlify/functions/storage",
};
