import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WEBHOOK_TOKEN = Deno.env.get("CALENDLY_WEBHOOK_TOKEN")!;

// Leads da sessão de diagnóstico vivem no segmento que a vista Comercial → Leads mostra
const SEGMENT = "contabilidade";
// Quem recebe a notificação de cada sessão agendada (emails dos colaboradores)
const NOTIFY_EMAILS = ["angelaoliveira@contabilistaexplica.pt"];

const pick = (answers: Array<{ question?: string; answer?: string }>, ...keys: string[]) => {
  for (const a of answers || []) {
    const q = (a.question || "").toLowerCase();
    if (keys.some((k) => q.includes(k))) return (a.answer || "").trim() || null;
  }
  return null;
};

// Data e hora em Portugal (evita que uma sessão às 23h30 UTC caia no dia seguinte/anterior)
const lisbon = (iso: string) => {
  const d = new Date(iso);
  const date = d.toLocaleDateString("sv-SE", { timeZone: "Europe/Lisbon" });
  const time = d.toLocaleTimeString("pt-PT", { timeZone: "Europe/Lisbon", hour: "2-digit", minute: "2-digit" });
  return { date, time };
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  if (!WEBHOOK_TOKEN || url.searchParams.get("token") !== WEBHOOK_TOKEN) {
    return json({ error: "unauthorized" }, 401);
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
      pick(answers, "telefone", "telemóvel", "phone", "contacto", "whatsapp") ||
      null;
    const start = p.scheduled_event?.start_time ? lisbon(p.scheduled_event.start_time) : null;
    const meetingDate = start?.date ?? null;
    const joinUrl: string | null = p.scheduled_event?.location?.join_url || null;
    const nif = pick(answers, "nif", "contribuinte");
    const businessArea = pick(answers, "atividade", "área", "area", "negócio", "negocio");
    const notesParts = [
      `Calendly: ${p.scheduled_event?.name || "reunião"}${start ? ` · ${start.date} às ${start.time}` : ""}`,
      ...(joinUrl ? [`Link da sessão: ${joinUrl}`] : []),
      ...(p.payment ? [`Pagamento: ${p.payment.amount ?? ""} ${p.payment.currency ?? ""} (${p.payment.successful ? "pago" : "por confirmar"})`] : []),
      ...answers.map((a: any) => `${a.question}: ${a.answer}`),
    ];

    if (event === "invitee.canceled") {
      // Numa remarcação o Calendly cancela a marcação antiga e cria uma nova: a lead mantém-se
      if (email && !p.rescheduled) {
        await supabase
          .from("leads")
          .update({ stage: "perda", loss_reason: "Reunião cancelada (Calendly)" })
          .eq("segment", SEGMENT)
          .eq("email", email)
          .eq("stage", "reuniao_agendada");
      }
      return json({ ok: true, action: p.rescheduled ? "rescheduled" : "canceled" });
    }

    if (event !== "invitee.created") return json({ ok: true, ignored: event });

    // Remarcação ou duplicado: a mesma pessoa já tem uma lead à espera da sessão → atualiza a data
    if (email) {
      const { data: existing } = await supabase
        .from("leads")
        .select("id")
        .eq("segment", SEGMENT)
        .ilike("email", email)
        .eq("stage", "reuniao_agendada")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (existing) {
        await supabase.from("leads").update({ meeting_date: meetingDate, notes: notesParts.join("\n") }).eq("id", existing.id);
        return json({ ok: true, action: "updated" });
      }
    }

    const { error } = await supabase.from("leads").insert({
      name,
      email,
      phone,
      nif,
      business_area: businessArea,
      source: "Calendly",
      segment: SEGMENT,
      stage: "reuniao_agendada",
      meeting: true,
      meeting_date: meetingDate,
      notes: notesParts.join("\n"),
    });

    if (error) {
      console.error("insert lead failed", error);
      return json({ error: error.message }, 500);
    }

    const { data: recipients } = await supabase
      .from("collaborators")
      .select("user_id")
      .in("email", NOTIFY_EMAILS)
      .eq("active", true)
      .not("user_id", "is", null);
    if (recipients?.length) {
      await supabase.from("notifications").insert(
        recipients.map((r: { user_id: string }) => ({
          user_id: r.user_id,
          title: "Nova sessão de diagnóstico",
          message: `${name}${start ? ` · ${start.date.split("-").reverse().join("/")} às ${start.time}` : ""}. Envia a mensagem de confirmação.`,
          type: "calendly_lead",
        })),
      );
    }

    return json({ ok: true, action: "created" });
  } catch (e) {
    console.error("calendly-webhook error", e);
    return json({ error: String(e) }, 500);
  }
});
