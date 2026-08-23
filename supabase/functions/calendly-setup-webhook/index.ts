import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/calendly";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const CALENDLY_API_KEY = Deno.env.get("CALENDLY_API_KEY");
const WEBHOOK_TOKEN = Deno.env.get("CALENDLY_WEBHOOK_TOKEN");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");

const gw = (path: string, init: RequestInit = {}) =>
  fetch(`${GATEWAY_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": CALENDLY_API_KEY!,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (!LOVABLE_API_KEY || !CALENDLY_API_KEY || !WEBHOOK_TOKEN) {
    return json({ error: "Calendly não está configurado" }, 500);
  }

  try {
    const meRes = await gw("/users/me");
    if (!meRes.ok) return json({ error: "Calendly /users/me falhou", details: await meRes.text() }, meRes.status);
    const me = await meRes.json();
    const userUri: string = me.resource.uri;
    const orgUri: string = me.resource.current_organization;

    const callbackUrl = `${SUPABASE_URL}/functions/v1/calendly-webhook?token=${WEBHOOK_TOKEN}`;

    const listRes = await gw(`/webhook_subscriptions?organization=${encodeURIComponent(orgUri)}&user=${encodeURIComponent(userUri)}&scope=user&count=100`);
    if (listRes.ok) {
      const list = await listRes.json();
      const existing = (list.collection || []).find((w: any) => w.callback_url === callbackUrl);
      if (existing) return json({ ok: true, status: "already_configured", subscription: existing.uri });
      // remove subscrições antigas desta app (token diferente)
      for (const w of list.collection || []) {
        if (typeof w.callback_url === "string" && w.callback_url.includes("/calendly-webhook")) {
          await gw(`/webhook_subscriptions/${w.uri.split("/").pop()}`, { method: "DELETE" });
        }
      }
    }

    const createRes = await gw("/webhook_subscriptions", {
      method: "POST",
      body: JSON.stringify({
        url: callbackUrl,
        events: ["invitee.created", "invitee.canceled"],
        organization: orgUri,
        user: userUri,
        scope: "user",
      }),
    });

    if (!createRes.ok) {
      const details = await createRes.text();
      console.error("create webhook failed", createRes.status, details);
      return json({ error: "Não foi possível criar o webhook no Calendly", status: createRes.status, details }, createRes.status);
    }

    const created = await createRes.json();
    return json({ ok: true, status: "created", subscription: created.resource?.uri });
  } catch (e) {
    console.error("calendly-setup-webhook error", e);
    return json({ error: String(e) }, 500);
  }
});
