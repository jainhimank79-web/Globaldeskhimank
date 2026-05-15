// netlify/functions/storage.js
// Netlify Blobs-backed key-value store for TheGlobalDesk
//
// 🔒 SECURITY APPROACH:
// Rather than using an API key (which conflicts with the site's SHA-256 password hashing),
// this function restricts write/delete access to requests coming from your own site domain.
// GET is public (anyone can read your published content — that's intentional).
// POST and DELETE are restricted to your own site origin only.

import { getStore } from "@netlify/blobs";

const STORE_NAME = "globaldesk";

// Your site's domain — requests from other origins cannot write or delete data
const ALLOWED_ORIGIN = "https://theglobaldeskhimank.netlify.app";

const CORS = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export default async function handler(req, context) {
  // Preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }

  const store = getStore(STORE_NAME);
  const url   = new URL(req.url);
  const key   = url.searchParams.get("key");

  // ── GET is PUBLIC — anyone can read published content ──
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

  // ── POST and DELETE — only allowed from your own site ──
  const origin = req.headers.get("origin") || "";
  if (origin !== ALLOWED_ORIGIN) {
    return json({ error: "Forbidden — requests only accepted from the site itself" }, 403);
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
