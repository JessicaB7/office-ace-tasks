import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WEBHOOK_TOKEN = Deno.env.get("CALENDLY_WEBHOOK_TOKEN")!;

const pick = (answers: Array<{ question?: string; answer?: string }>, ...keys: string[]) => {
  for (const a of answers || []) {
    const q = (a.question || "").toLowerCase();
    if (keys.some((k) => q.includes(k))) return (a.answer || "").trim() || null;
  }
  return null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  if (!WEBHOOK_TOKEN || url.searchParams.get("token") !== WEBHOOK_TOKEN) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const payload = await req.json();
    const event: string = payload?.event || "";
    const p = payload?.payload || {};

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    const email: string | null = p.email || null;
    const name: string = (p.name || [p.first_name, p.last_name].filter(Boolean).join(" ") || email || "Sem nome").trim();
    const answers = p.questions_and_answers || [];
    const phone =
      p.text_reminder_number ||
      pick(answers, "telefone", "telemóvel", "phone", "contacto") ||
      null;
    const meetingDate: string | null = p.scheduled_event?.start_time
      ? new Date(p.scheduled_event.start_time).toISOString().slice(0, 10)
      : null;
    const nif = pick(answers, "nif", "contribuinte");
    const businessArea = pick(answers, "atividade", "área", "area", "negócio", "negocio");
    const notesParts = [
      `Calendly: ${p.scheduled_event?.name || "reunião"}`,
      ...answers.map((a: any) => `${a.question}: ${a.answer}`),
    ];

    if (event === "invitee.canceled") {
      if (email) {
        await supabase
          .from("leads")
          .update({ stage: "perda", loss_reason: "Reunião cancelada (Calendly)" })
          .eq("segment", "comercial")
          .eq("email", email)
          .eq("stage", "reuniao_agendada");
      }
      return new Response(JSON.stringify({ ok: true, action: "canceled" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (event !== "invitee.created") {
      return new Response(JSON.stringify({ ok: true, ignored: event }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Evita duplicados: mesma pessoa + mesma data de reunião
    if (email) {
      const { data: existing } = await supabase
        .from("leads")
        .select("id")
        .eq("segment", "comercial")
        .eq("email", email)
        .eq("meeting_date", meetingDate)
        .maybeSingle();
      if (existing) {
        return new Response(JSON.stringify({ ok: true, action: "duplicate" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const { error } = await supabase.from("leads").insert({
      name,
      email,
      phone,
      nif,
      business_area: businessArea,
      source: "Calendly",
      segment: "comercial",
      stage: "reuniao_agendada",
      meeting: true,
      meeting_date: meetingDate,
      notes: notesParts.join("\n"),
    });

    if (error) {
      console.error("insert lead failed", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, action: "created" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("calendly-webhook error", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
