import { createClient } from "npm:@supabase/supabase-js@2";

// ============================================================
// Polls the BUK (buk.pt) booking calendar for consultancy bookings,
// creates the corresponding lead in Consultorias (segment = 'consultoria'),
// and sends a WhatsApp confirmation via the Meta WhatsApp Cloud API when a
// phone number is available.
//
// Invoked only by pg_cron (see the POST-MIGRATION comment in
// supabase/migrations/20260902120000_buk_whatsapp_integration.sql) — no CORS,
// same auth pattern as supabase/functions/process-email-queue/index.ts.
//
// DATA SOURCE — confirmed live 2026-09-02 (not guessed): BUK has no
// self-service webhook/API in the Extensões UI (Pro+ items there are
// Google Reserve, Google Reviews, BUK Faturação, Embed, Programa de
// Fidelização — none of them a generic outbound webhook), so getting a real
// booking API still requires contacting BUK support for the Pro+ plan.
// BUT: BUK already publishes a public iCal feed (Extensões > Google Calendar,
// already active, synced to jessicabrandao.cc@gmail.com) at a URL of the form
//   https://calendar.buk.pt/stores/<store_id>/ical/<token>
// which we poll instead. Verified live: it lists only non-cancelled bookings
// (CONFIRMED), each with a stable UID, SUMMARY (client name), DTSTART (UTC),
// and DESCRIPTION ("Consultoria Individual - Equipa Contabilista Explica" for
// Diogo's bookings, "Consultoria Individual - Jéssica Brandão" for Jéssica's
// — confirmed against the "Lista de marcações" report, 1:1 for every row).
//
// LIMITATION: the iCal feed has NO phone number or email — only name, date
// and service. So this pipeline reliably auto-creates the consultoria lead,
// but cannot send a WhatsApp confirmation until a phone number is available
// from another source (BUK Pro+ API, or manual entry). WhatsApp sending is
// skipped automatically when client_phone is null — see whatsappConfigured
// below — so the lead import never depends on WhatsApp working.
// ============================================================

const COOLDOWN_MINUTES_ON_ERROR = 5;
const WHATSAPP_TEMPLATE_NAME_DEFAULT = "confirmacao_marcacao";

interface BukBooking {
  id: string; // iCal UID — stable per booking, used as external_booking_id
  client_name: string;
  client_phone: string | null; // not available from the iCal feed today
  client_email: string | null; // not available from the iCal feed today
  start_time: string; // ISO datetime (UTC)
  description: string; // raw iCal DESCRIPTION, used to infer given_by
}

function parseJwtClaims(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    const payload = parts[1]
      .replaceAll("-", "+")
      .replaceAll("_", "/")
      .padEnd(Math.ceil(parts[1].length / 4) * 4, "=");
    return JSON.parse(atob(payload)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

// Portugal-only normalization: strips everything but digits, adds the 351
// country code when a bare 9-digit local number is given. No formatting
// precedent exists elsewhere in the repo (leads.phone is stored raw).
function normalizePhone(raw: string): string {
  const digits = raw.replace(/[^\d]/g, "");
  if (digits.startsWith("351")) return digits;
  if (digits.length === 9) return `351${digits}`;
  return digits;
}

// Maps the BUK service name (iCal DESCRIPTION) to the "given_by" values used
// across Consultorias (see src/components/comercial/LeadFormDialog.tsx).
// Empirically, every BUK booking with Diogo uses the service "Consultoria
// Individual - Equipa Contabilista Explica", and every booking with Jéssica
// uses "Consultoria Individual - Jéssica Brandão" — confirmed against the
// "Lista de marcações" report for all bookings since Aug 2026. Revisit this
// mapping if BUK's service names change.
function mapGivenBy(description: string | null | undefined): string | null {
  const d = (description || "").toLowerCase();
  if (d.includes("jéssica") || d.includes("jessica")) return "Jéssica";
  if (d.includes("equipa contabilista explica")) return "Diogo";
  return null;
}

// Mirrors the auto follow-up logic in LeadFormDialog.tsx (15 dias para
// consultoria), computed at noon local time to avoid timezone drift.
function plusDays(dateISO: string, days: number): string {
  const d = new Date(`${dateISO}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// Minimal iCal VEVENT parser — just the fields BUK's feed actually sends
// (UID, SUMMARY, DTSTART, DESCRIPTION). No RRULE/timezone handling needed:
// BUK's feed uses one VEVENT per booking with UTC DTSTART (trailing "Z").
function parseIcsBookings(ics: string): BukBooking[] {
  const bookings: BukBooking[] = [];
  const veventBlocks = ics.split("BEGIN:VEVENT").slice(1);

  for (const block of veventBlocks) {
    const body = block.split("END:VEVENT")[0];
    const getField = (name: string): string | null => {
      const match = body.match(new RegExp(`^${name}(?:;[^:]*)?:(.*)$`, "m"));
      return match ? match[1].trim() : null;
    };

    const uid = getField("UID");
    const summary = getField("SUMMARY");
    const dtstart = getField("DTSTART");
    const description = getField("DESCRIPTION") || "";
    if (!uid || !summary || !dtstart) continue;

    // DTSTART like "20260804T093000Z" -> "2026-08-04T09:30:00Z"
    const m = dtstart.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z?$/);
    if (!m) continue;
    const [, y, mo, da, h, mi, s] = m;
    const startTime = `${y}-${mo}-${da}T${h}:${mi}:${s}Z`;

    bookings.push({
      id: uid,
      client_name: summary,
      client_phone: null,
      client_email: null,
      start_time: startTime,
      description,
    });
  }

  return bookings;
}

async function fetchBukBookings(): Promise<BukBooking[]> {
  const icalUrl = Deno.env.get("BUK_ICAL_URL");
  if (!icalUrl) {
    throw new Error("BUK_ICAL_URL não configurado");
  }

  const res = await fetch(icalUrl);
  if (!res.ok) {
    throw Object.assign(new Error(`BUK iCal fetch error: ${res.status}`), { status: res.status });
  }

  const text = await res.text();
  return parseIcsBookings(text);
}

async function sendWhatsAppConfirmation(
  phone: string,
  name: string,
  whenLabel: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
  const accessToken = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
  const templateName = Deno.env.get("WHATSAPP_TEMPLATE_NAME") || WHATSAPP_TEMPLATE_NAME_DEFAULT;

  if (!phoneNumberId || !accessToken) {
    return { ok: false, error: "WHATSAPP_PHONE_NUMBER_ID / WHATSAPP_ACCESS_TOKEN não configurados" };
  }

  try {
    const res = await fetch(`https://graph.facebook.com/v20.0/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: normalizePhone(phone),
        type: "template",
        template: {
          name: templateName,
          language: { code: "pt_PT" },
          components: [
            {
              type: "body",
              parameters: [{ type: "text", text: name }, { type: "text", text: whenLabel }],
            },
          ],
        },
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      return { ok: false, error: `WhatsApp API ${res.status}: ${body.slice(0, 500)}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

Deno.serve(async (req) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("Missing required environment variables");
    return new Response(JSON.stringify({ error: "Server configuration error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Defense in depth: verify_jwt=true already requires a valid JWT at the
  // gateway layer. This adds an explicit role check so only service-role
  // callers (i.e. pg_cron) can trigger polling.
  const token = authHeader.slice("Bearer ".length).trim();
  const claims = parseJwtClaims(token);
  if (claims?.role !== "service_role") {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { data: state } = await supabase
    .from("buk_sync_state")
    .select("cooldown_until")
    .single();

  if (state?.cooldown_until && new Date(state.cooldown_until) > new Date()) {
    return new Response(JSON.stringify({ skipped: true, reason: "cooldown" }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  let bookings: BukBooking[] = [];

  try {
    // The iCal feed always returns the full set of non-cancelled bookings
    // (no server-side "since" filter available) — dedupe against leads
    // below handles re-fetching the same small feed on every run.
    bookings = await fetchBukBookings();
  } catch (error) {
    console.error("Failed to fetch BUK bookings", error);
    await supabase
      .from("buk_sync_state")
      .update({
        cooldown_until: new Date(Date.now() + COOLDOWN_MINUTES_ON_ERROR * 60 * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", 1);
    return new Response(JSON.stringify({ error: "buk_fetch_failed" }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }

  let created = 0;
  let sent = 0;

  for (const booking of bookings) {
    // Dedupe: skip bookings already imported as a lead (mirrors the
    // email/calendar-invite dedupe pattern used by calendly-webhook).
    const { data: existing } = await supabase
      .from("leads")
      .select("id")
      .eq("external_booking_id", booking.id)
      .maybeSingle();
    if (existing) continue;

    const meetingDate = booking.start_time.slice(0, 10);
    const nextFollowup = plusDays(meetingDate, 15);
    const timeLabel = new Date(booking.start_time).toLocaleString("pt-PT", {
      dateStyle: "short",
      timeStyle: "short",
    });

    const { data: inserted, error: insertError } = await supabase
      .from("leads")
      .insert({
        name: booking.client_name || "Sem nome",
        phone: booking.client_phone,
        email: booking.client_email,
        segment: "consultoria",
        stage: "reuniao_agendada",
        meeting: true,
        meeting_date: meetingDate,
        given_by: mapGivenBy(booking.description),
        next_followup: nextFollowup,
        source: "BUK",
        external_booking_id: booking.id,
        notes: `BUK: ${booking.description || "sessão de consultoria"}`,
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("Failed to insert consultoria lead", { booking: booking.id, error: insertError });
      continue;
    }
    created++;

    // WhatsApp é opcional e depende de haver telefone: o feed do BUK usado
    // hoje (iCal) não inclui contacto, por isso o envio fica normalmente
    // ignorado até haver outra fonte de telefone — a lead é sempre criada.
    const whatsappConfigured =
      !!Deno.env.get("WHATSAPP_PHONE_NUMBER_ID") && !!Deno.env.get("WHATSAPP_ACCESS_TOKEN");

    if (whatsappConfigured && booking.client_phone) {
      const sendResult = await sendWhatsAppConfirmation(
        booking.client_phone,
        booking.client_name || "",
        timeLabel
      );
      await supabase.from("whatsapp_send_log").insert({
        booking_external_id: booking.id,
        lead_id: inserted?.id ?? null,
        phone: booking.client_phone,
        template_name: Deno.env.get("WHATSAPP_TEMPLATE_NAME") || WHATSAPP_TEMPLATE_NAME_DEFAULT,
        status: sendResult.ok ? "sent" : "failed",
        error_message: sendResult.ok ? null : sendResult.error,
      });
      if (sendResult.ok) sent++;
      else console.error("WhatsApp send failed", { booking: booking.id, error: sendResult.error });
    }
  }

  await supabase
    .from("buk_sync_state")
    .update({
      last_polled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);

  return new Response(JSON.stringify({ fetched: bookings.length, created, sent }), {
    headers: { "Content-Type": "application/json" },
  });
});
