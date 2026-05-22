import { json } from "@remix-run/node";

// ── Supabase helper ────────────────────────────────────────────────────────────
async function supabaseFetch(path, options = {}) {
  const url = `${process.env.SUPABASE_URL}/rest/v1${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      Prefer: "return=representation",
      ...options.headers,
    },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Supabase error ${res.status}: ${err}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

// ── CORS / security headers ────────────────────────────────────────────────────
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-admin-secret",
};

// Validate the shared secret so only our own UI can call this
function isAuthorized(request) {
  const secret = request.headers.get("x-admin-secret");
  return secret === (process.env.ADMIN_SECRET || "polar3d-admin-secret");
}

// OPTIONS preflight
export const loader = async ({ request }) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  return json({ ok: true }, { headers: corsHeaders });
};

export const action = async ({ request }) => {
  // Handle CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (!isAuthorized(request)) {
    return json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, { status: 400, headers: corsHeaders });
  }

  const { intent, ...data } = body;
  console.log("[api.admin] intent:", intent, "data:", JSON.stringify(data));

  try {
    switch (intent) {
      // ── Materials ────────────────────────────────────────────────────────────
      case "saveMaterial": {
        const { id, isNew, colors: rawColors, ...rest } = data;
        const colors = typeof rawColors === "string"
          ? rawColors.split(",").map((c) => c.trim()).filter(Boolean)
          : rawColors ?? [];

        const payload = { ...rest, colors };

        if (isNew) {
          const result = await supabaseFetch("/materials", {
            method: "POST",
            body: JSON.stringify({ id, ...payload }),
          });
          return json({ success: true, data: result }, { headers: corsHeaders });
        } else {
          const result = await supabaseFetch(`/materials?id=eq.${id}`, {
            method: "PATCH",
            body: JSON.stringify(payload),
          });
          return json({ success: true, data: result }, { headers: corsHeaders });
        }
      }

      case "deleteMaterial": {
        await supabaseFetch(`/materials?id=eq.${data.id}`, { method: "DELETE" });
        return json({ success: true }, { headers: corsHeaders });
      }

      case "toggleMaterial": {
        const result = await supabaseFetch(`/materials?id=eq.${data.id}`, {
          method: "PATCH",
          body: JSON.stringify({ is_active: !data.is_active }),
        });
        return json({ success: true, data: result }, { headers: corsHeaders });
      }

      // ── Settings ─────────────────────────────────────────────────────────────
      case "saveSetting": {
        const result = await supabaseFetch(`/app_settings?key=eq.${data.key}`, {
          method: "PATCH",
          body: JSON.stringify({ value: data.value }),
        });
        return json({ success: true, data: result }, { headers: corsHeaders });
      }

      // ── Read ─────────────────────────────────────────────────────────────────
      case "getMaterials": {
        const result = await supabaseFetch("/materials?order=type.asc,label.asc&select=*");
        return json({ success: true, data: result }, { headers: corsHeaders });
      }

      case "getSettings": {
        const result = await supabaseFetch("/app_settings?order=key.asc&select=*");
        return json({ success: true, data: result }, { headers: corsHeaders });
      }

      default:
        return json({ error: `Unknown intent: ${intent}` }, { status: 400, headers: corsHeaders });
    }
  } catch (err) {
    console.error("[api.admin] Error:", err.message);
    return json({ error: err.message }, { status: 500, headers: corsHeaders });
  }
};
