import { createClient } from 'npm:@supabase/supabase-js@2'

// Webhook do Resend (email.bounced / email.complained). Assinado com Svix:
// https://resend.com/docs/dashboard/webhooks/verify-webhooks-requests
interface SuppressionPayload {
  email: string
  reason: 'bounce' | 'complaint' | 'unsubscribe'
  message_id?: string
  metadata?: Record<string, unknown>
  is_retry: boolean
  retry_count: number
}

const TOLERANCE_SECONDS = 5 * 60

async function verifySvix(req: Request, body: string, secret: string): Promise<boolean> {
  const id = req.headers.get('svix-id')
  const timestamp = req.headers.get('svix-timestamp')
  const signatures = req.headers.get('svix-signature')
  if (!id || !timestamp || !signatures) return false
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > TOLERANCE_SECONDS) return false

  const keyBytes = Uint8Array.from(atob(secret.replace(/^whsec_/, '')), (c) => c.charCodeAt(0))
  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${id}.${timestamp}.${body}`))
  const expected = btoa(String.fromCharCode(...new Uint8Array(mac)))
  return signatures.split(' ').some((s) => s.split(',')[1] === expected)
}

function jsonResponse(data: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  const webhookSecret = Deno.env.get('RESEND_WEBHOOK_SECRET')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!webhookSecret || !supabaseUrl || !supabaseServiceKey) {
    console.error('Missing required environment variables')
    return jsonResponse({ error: 'Server configuration error' }, 500)
  }

  const body = await req.text()
  if (!(await verifySvix(req, body, webhookSecret))) {
    console.error('Invalid webhook signature')
    return jsonResponse({ error: 'Invalid signature' }, 401)
  }

  let event: { type?: string; data?: { email_id?: string; to?: string[]; bounce?: { type?: string } } }
  try {
    event = JSON.parse(body)
  } catch {
    return jsonResponse({ error: 'Invalid payload' }, 400)
  }

  const reason =
    event.type === 'email.bounced' ? 'bounce' : event.type === 'email.complained' ? 'complaint' : null
  // Só os bounces permanentes suprimem o endereço; outros eventos são ignorados.
  if (!reason || (reason === 'bounce' && event.data?.bounce?.type && event.data.bounce.type !== 'Permanent')) {
    return jsonResponse({ ignored: true })
  }
  const email = event.data?.to?.[0]
  if (!email) return jsonResponse({ error: 'Missing recipient' }, 400)

  const payload: SuppressionPayload = {
    email,
    reason,
    message_id: event.data?.email_id,
    metadata: { resend_event: event.type },
    is_retry: false,
    retry_count: 0,
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  const normalizedEmail = payload.email.toLowerCase()

  // 1. Upsert to suppressed_emails (idempotent — safe for retries)
  const { error: suppressError } = await supabase
    .from('suppressed_emails')
    .upsert(
      {
        email: normalizedEmail,
        reason: payload.reason,
        metadata: payload.metadata ?? null,
      },
      { onConflict: 'email' },
    )

  if (suppressError) {
    console.error('Failed to upsert suppressed email', {
      error: suppressError,
      email_redacted: normalizedEmail[0] + '***@' + normalizedEmail.split('@')[1],
    })
    return jsonResponse({ error: 'Failed to write suppression' }, 500)
  }

  // 2. Append a new log entry for the suppression event (never update existing rows)
  const sendLogStatus = mapReasonToStatus(payload.reason)
  const sendLogMessage = mapReasonToMessage(payload.reason)

  const { error: insertError } = await supabase
    .from('email_send_log')
    .insert({
      message_id: payload.message_id ?? null,
      template_name: 'system',
      recipient_email: normalizedEmail,
      status: sendLogStatus,
      error_message: sendLogMessage,
      metadata: payload.metadata ?? null,
    })

  if (insertError) {
    // Non-fatal — log and continue. The suppression was already recorded.
    console.warn('Failed to insert email_send_log', {
      error: insertError,
    })
  }

  console.log('Suppression processed', {
    email_redacted: normalizedEmail[0] + '***@' + normalizedEmail.split('@')[1],
    reason: payload.reason,
    is_retry: payload.is_retry,
    retry_count: payload.retry_count,
    has_message_id: !!payload.message_id,
  })

  return jsonResponse({ success: true })
})

function mapReasonToStatus(
  reason: string,
): 'bounced' | 'complained' | 'suppressed' {
  switch (reason) {
    case 'bounce':
      return 'bounced'
    case 'complaint':
      return 'complained'
    default:
      return 'suppressed'
  }
}

function mapReasonToMessage(reason: string): string {
  switch (reason) {
    case 'bounce':
      return 'Permanent bounce — email address is invalid or rejected'
    case 'complaint':
      return 'Spam complaint — recipient marked email as spam'
    case 'unsubscribe':
      return 'Recipient unsubscribed'
    default:
      return 'Email suppressed'
  }
}
