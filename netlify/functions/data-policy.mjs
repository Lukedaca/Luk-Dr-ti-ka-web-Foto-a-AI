// DataPolicy endpoint for Lukáš Drštička personal portfolio.
// Returns active tenant policy, visitor memory policy and compliance details.

import {
  createPersonalPortfolioTenantPolicy,
  createPersonalPortfolioProviderRegister,
} from "./_lib/tenant-policy.mjs";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

export default async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("", { status: 204, headers: corsHeaders });
  }

  const tenant = createPersonalPortfolioTenantPolicy();
  const providers = createPersonalPortfolioProviderRegister();

  return new Response(
    JSON.stringify({
      tenantId: tenant.tenantId,
      domain: tenant.domain,
      processingMode: tenant.processingMode,
      dataMode: tenant.dataMode,
      visitorMemory: {
        enabled: tenant.retention.visitorMemory,
        ttlDays: 180,
        consentRequired: true,
        optInOnly: true,
        redaction: "automatic-pii-scrub",
      },
      voice: {
        enabled: tenant.voice.enabled,
        mode: tenant.voice.mode,
        provider: tenant.voice.provider || "local",
        locales: tenant.voice.locales,
      },
      providers,
    }),
    {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    },
  );
};
