// netlify/functions/storage.js
// Netlify Blobs-backed key-value store for TheGlobalDesk
//
// 🔒 SECURITY:
// POST and DELETE only accepted from your own site origin.
// GET is public (visitors need to read your published content).
// On first ever run, seeds the default admin password hash (admin123) into Blobs.

import { getStore } from "@netlify/blobs";

const STORE_NAME    = "globaldesk";
const ALLOWED_ORIGIN = "https://theglobaldeskhimank.netlify.app";
const PASS_KEY       = "tgd3_pass_hash_shared";

const CORS = {
  "Access-Control-Allow-Origin":  ALLOWED_ORIGIN,
  "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// SHA-256 helper (runs in Netlify's edge runtime)
async function sha256(str) {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(str)
  );
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

export default async function handler(req, context) {

  // Preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }

  const store = getStore(STORE_NAME);
  const url   = new URL(req.url);
  const key   = url.searchParams.get("key");

  // ── GET — public, anyone can read ──
  if (req.method === "GET") {
    if (!key) return json({ error: "key required" }, 400);
    try {
      let value = await store.get(key);

      // 🔒 First-ever run: if password hash not yet seeded, seed it now
      if (key === PASS_KEY && (value === null || value === "")) {
        const defaultHash = await sha256("admin123");
        await store.set(PASS_KEY, defaultHash);
        value = defaultHash;
        console.log("[storage] Seeded default password hash into Netlify Blobs");
      }

      if (value === null) return json({ value: null }, 200);
      return json({ value }, 200);
    } catch (err) {
      return json({ error: String(err) }, 500);
    }
  }

  // ── POST and DELETE — only from your own site ──
  const origin = req.headers.get("origin") || "";
  if (origin !== ALLOWED_ORIGIN) {
    return json({ error: "Forbidden" }, 403);
  }

  try {
    if (req.method === "POST") {
      const body = await req.json();
      if (!body.key) return json({ error: "key required" }, 400);
      await store.set(body.key, body.value ?? "");
      return json({ ok: true }, 200);
    }

    if (req.method === "DELETE") {
      if (!key) return json({ error: "key required" }, 400);
      await store.delete(key);
      return json({ ok: true }, 200);
    }

    return json({ error: "method not allowed" }, 405);

  } catch (err) {
    console.error("storage error:", err);
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
