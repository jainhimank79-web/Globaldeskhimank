// netlify/functions/storage.js
// Netlify Blobs-backed key-value store for TheGlobalDesk
// GET  /.netlify/functions/storage?key=xxx          → { value }
// POST /.netlify/functions/storage  { key, value }  → { ok }
// DELETE /.netlify/functions/storage?key=xxx        → { ok }

import { getStore } from "@netlify/blobs";

const STORE_NAME = "globaldesk";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export default async function handler(req, context) {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }

  const store = getStore(STORE_NAME);
  const url   = new URL(req.url);
  const key   = url.searchParams.get("key");

  try {
    if (req.method === "GET") {
      if (!key) return json({ error: "key required" }, 400);
      const value = await store.get(key);
      if (value === null) return json({ value: null }, 200);
      return json({ value }, 200);
    }

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
