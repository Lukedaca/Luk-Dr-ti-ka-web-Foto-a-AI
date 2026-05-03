// Small endpoint for opt-in visitor memory management.

import { runSecurityChecks } from "./_lib/security.mjs";
import { deleteVisitorMemory, getVisitorMemory, normalizeVisitorId } from "./_lib/visitor-memory.mjs";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

export default async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("", { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  let body;
  try {
    body = await req.json();
  } catch (err) {
    return jsonResponse(400, { error: "Invalid request" });
  }

  const security = await runSecurityChecks(req, body, {
    requireTurnstile: false,
    checkInjection: false,
  });
  if (!security.ok) {
    if (security.silent) return jsonResponse(200, { ok: true });
    return jsonResponse(security.status || 403, { error: "Request blocked", reason: security.reason });
  }

  const visitorId = normalizeVisitorId(body.visitor_id);
  if (!visitorId) {
    return jsonResponse(400, { error: "Invalid visitor id" });
  }

  const action = typeof body.action === "string" ? body.action : "";
  if (action === "delete") {
    await deleteVisitorMemory(visitorId);
    return jsonResponse(200, { ok: true, deleted: true });
  }

  if (action === "read") {
    const memory = await getVisitorMemory(visitorId);
    return jsonResponse(200, {
      ok: true,
      memory: memory
        ? {
            first_seen: memory.first_seen,
            last_seen: memory.last_seen,
            message_count: memory.message_count,
            preferences: memory.preferences || {},
          }
        : null,
    });
  }

  return jsonResponse(400, { error: "Unsupported action" });
};
