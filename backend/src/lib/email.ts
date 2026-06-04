// src/lib/email.ts
// ─────────────────────────────────────────────
// Transactional email helper (Resend HTTP API).
//
// Optional — if RESEND_API_KEY is not set, emails are skipped (and the
// caller can still surface the link in the UI). This keeps local dev and
// un-configured deployments working without crashing.
//
// Env vars:
//   RESEND_API_KEY  — Resend API key (https://resend.com)
//   EMAIL_FROM      — sender, e.g. "Cirvio <noreply@yourdomain.com>"
//                     (defaults to Resend's onboarding sender for testing)
//   FRONTEND_URL    — base URL for building links, e.g. https://app.cirvio.com
// ─────────────────────────────────────────────

const RESEND_ENDPOINT = 'https://api.resend.com/emails'

export function isEmailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY
}

/** Base URL of the frontend, used to build action links. No trailing slash. */
export function frontendUrl(): string {
  return (process.env.FRONTEND_URL || 'http://localhost:4200').replace(/\/+$/, '')
}

interface SendEmailInput {
  to: string
  subject: string
  html: string
}

/**
 * Send an email. Returns true if it was dispatched, false if email isn't
 * configured (or the send failed) — never throws, so callers don't have to
 * make email a hard dependency of their request.
 */
export async function sendEmail({ to, subject, html }: SendEmailInput): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return false

  const from = process.env.EMAIL_FROM || 'Cirvio <onboarding@resend.dev>'
  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to, subject, html }),
    })
    if (!res.ok) {
      console.error('[email] send failed:', res.status, await res.text().catch(() => ''))
      return false
    }
    return true
  } catch (err) {
    console.error('[email] send error:', (err as Error).message)
    return false
  }
}

const BRAND = '#1b4332' // cirvio hunter green

function layout(title: string, bodyHtml: string): string {
  return `
  <div style="font-family:ui-sans-serif,system-ui,Segoe UI,Roboto,sans-serif;background:#f5f5f4;padding:32px 0;">
    <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e7e5e4;">
      <div style="background:${BRAND};padding:20px 28px;">
        <span style="color:#fff;font-size:18px;font-weight:700;letter-spacing:0.04em;">CIRVIO</span>
      </div>
      <div style="padding:28px;">
        <h1 style="font-size:18px;color:#1c1917;margin:0 0 14px;">${title}</h1>
        ${bodyHtml}
      </div>
      <div style="padding:16px 28px;border-top:1px solid #f0eeec;">
        <p style="font-size:12px;color:#a8a29e;margin:0;">Sent by Cirvio. If you weren't expecting this, you can ignore it.</p>
      </div>
    </div>
  </div>`
}

function button(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;background:${BRAND};color:#fff;text-decoration:none;font-size:14px;font-weight:600;padding:11px 22px;border-radius:8px;">${label}</a>`
}

/** Invitation to join a tenant workspace. */
export async function sendInviteEmail(opts: {  to: string
  inviteUrl: string
  orgName: string
  role: string
  inviterName?: string
}): Promise<boolean> {
  const roleLabel = opts.role.replace(/_/g, ' ').toLowerCase()
  const who = opts.inviterName ? `${opts.inviterName} has invited you` : 'You have been invited'
  const html = layout(
    `Join ${opts.orgName} on Cirvio`,
    `<p style="font-size:14px;color:#44403c;line-height:1.6;margin:0 0 20px;">
       ${who} to join <strong>${opts.orgName}</strong> as a <strong>${roleLabel}</strong>.
       Click below to set your password and activate your account.
     </p>
     <p style="margin:0 0 22px;">${button(opts.inviteUrl, 'Accept invitation')}</p>
     <p style="font-size:12px;color:#a8a29e;line-height:1.5;margin:0;">
       Or paste this link into your browser:<br>
       <span style="color:#78716c;word-break:break-all;">${opts.inviteUrl}</span>
     </p>`,
  )
  return sendEmail({ to: opts.to, subject: `You're invited to ${opts.orgName} on Cirvio`, html })
}

/** Password reset link. */
export async function sendPasswordResetEmail(opts: {
  to: string
  resetUrl: string
}): Promise<boolean> {
  const html = layout(
    'Reset your password',
    `<p style="font-size:14px;color:#44403c;line-height:1.6;margin:0 0 20px;">
       We received a request to reset your Cirvio password. Click below to choose
       a new one. This link expires in 1 hour.
     </p>
     <p style="margin:0 0 22px;">${button(opts.resetUrl, 'Reset password')}</p>
     <p style="font-size:12px;color:#a8a29e;line-height:1.5;margin:0;">
       If you didn't request this, you can safely ignore this email — your
       password won't change.<br><br>
       Or paste this link into your browser:<br>
       <span style="color:#78716c;word-break:break-all;">${opts.resetUrl}</span>
     </p>`,
  )
  return sendEmail({ to: opts.to, subject: 'Reset your Cirvio password', html })
}
