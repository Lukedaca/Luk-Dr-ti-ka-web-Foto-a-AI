// Netlify Scheduled Function: každých 5 min pingne chat GET (?warm),
// aby kontejner chat funkce zůstal teplý → první reálný dotaz nepaltí cold start.

export default async () => {
  const base = process.env.URL || process.env.DEPLOY_PRIME_URL || process.env.DEPLOY_URL || "";
  if (!base) {
    return new Response(JSON.stringify({ ok: false, reason: "no_base_url" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  let status = 0;
  try {
    const res = await fetch(`${base}/.netlify/functions/chat?warm=1`, { method: "GET" });
    status = res.status;
  } catch (err) {
    console.warn("[chat-warm] ping failed:", err?.message || err);
  }

  return new Response(JSON.stringify({ ok: true, status }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

export const config = {
  schedule: "*/5 * * * *",
};
