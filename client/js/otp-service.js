/* ============================================================
   LEVEL — OTP Service (MFA factor delivery & verification)
   --------------------------------------------------------------
   REAL IMPLEMENTATION backed by Supabase Auth. Preserves the exact
   return contract the mock used, so js/mfa.js needs no changes:

     send*  → { ok:true, expiresAt:number, resendAt:number }
            | { ok:false, reason:'send_failed' }
     verify*→ { ok:true }
            | { ok:false, reason:'invalid'|'expired'|'locked'|'no_otp' }

   Email factor : supabase.auth.signInWithOtp + verifyOtp(type:'email')
   Phone factor : supabase.auth.updateUser({phone}) + verifyOtp(type:'phone_change')
                  (the user is already signed in via OAuth, so we ATTACH +
                   confirm a phone number rather than start a new login)

   Dashboard prerequisites (see backend README):
     - Email: provider enabled, and the email template set to send {{ .Token }}
       (a 6-digit code, not a magic link).
     - Phone: an SMS provider (Twilio / Vonage / MessageBird / Textlocal) must
       be configured under Authentication → Providers → Phone, or sends fail.
   ============================================================ */

import { supabase } from './supabase.js'

export const OTP_CONFIG = {
  length: 6,
  ttlSeconds: 300,            // email token lifetime (UI countdown hint)
  phoneTtlSeconds: 60,        // SMS OTP lifetime (UI countdown hint)
  resendCooldownSeconds: 60,  // Supabase rate-limits OTP resends
  maxAttempts: 5,
  exposeDemoCode: false,      // real OTP — never a demo code
}

/* Per-channel runtime state. `target` is the email/phone the code was sent to;
   verify*() reuses it (the UI's verify call only passes the code). */
const channels = {
  email: { target: null, expiresAt: 0, resendAt: 0, attempts: 0 },
  phone: { target: null, expiresAt: 0, resendAt: 0, attempts: 0 },
}

const now = () => Date.now()

/** Best-effort E.164 normalization (Supabase requires it for phone OTP). */
function toE164(raw) {
  const trimmed = (raw || '').trim()
  if (trimmed.startsWith('+')) return '+' + trimmed.slice(1).replace(/\D/g, '')
  return '+' + trimmed.replace(/\D/g, '')
}

/** Map a Supabase verify error message to the UI's reason vocabulary. */
function mapVerifyReason(message = '') {
  if (/expired/i.test(message)) return 'expired'
  if (/invalid|incorrect|not found/i.test(message)) return 'invalid'
  if (/rate|too many|limit/i.test(message)) return 'locked'
  return 'invalid'
}

function startTimers(channel) {
  const ttl = channel === 'phone' ? OTP_CONFIG.phoneTtlSeconds : OTP_CONFIG.ttlSeconds
  channels[channel].attempts = 0
  channels[channel].expiresAt = now() + ttl * 1000
  channels[channel].resendAt = now() + OTP_CONFIG.resendCooldownSeconds * 1000
}

/* ─── Email factor ─── */
export async function sendEmailOtp(email) {
  if (!email) return { ok: false, reason: 'send_failed' }
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false },
  })
  if (error) {
    console.warn('[otp] email send failed:', error.message)
    return { ok: false, reason: 'send_failed' }
  }
  channels.email.target = email
  startTimers('email')
  return { ok: true, expiresAt: channels.email.expiresAt, resendAt: channels.email.resendAt }
}

export async function verifyEmailOtp(code) {
  const email = channels.email.target
  if (!email) return { ok: false, reason: 'no_otp' }
  if (now() > channels.email.expiresAt) return { ok: false, reason: 'expired' }

  channels.email.attempts += 1
  const { error } = await supabase.auth.verifyOtp({ email, token: String(code).trim(), type: 'email' })
  if (error) {
    const reason = mapVerifyReason(error.message)
    return reason === 'invalid'
      ? { ok: false, reason, attemptsLeft: Math.max(0, OTP_CONFIG.maxAttempts - channels.email.attempts) }
      : { ok: false, reason }
  }
  channels.email.target = null // burn
  return { ok: true }
}

/* ─── Phone factor ─── */
export async function sendPhoneOtp(phone) {
  const e164 = toE164(phone)
  if (e164.replace(/\D/g, '').length < 7) return { ok: false, reason: 'send_failed' }

  // Attach the phone to the already-signed-in user; Supabase texts an OTP.
  const { error } = await supabase.auth.updateUser({ phone: e164 })
  if (error) {
    console.warn('[otp] phone send failed:', error.message)
    return { ok: false, reason: 'send_failed' }
  }
  channels.phone.target = e164
  startTimers('phone')
  return { ok: true, expiresAt: channels.phone.expiresAt, resendAt: channels.phone.resendAt }
}

export async function verifyPhoneOtp(code) {
  const phone = channels.phone.target
  if (!phone) return { ok: false, reason: 'no_otp' }
  if (now() > channels.phone.expiresAt) return { ok: false, reason: 'expired' }

  channels.phone.attempts += 1
  const { error } = await supabase.auth.verifyOtp({ phone, token: String(code).trim(), type: 'phone_change' })
  if (error) {
    const reason = mapVerifyReason(error.message)
    return reason === 'invalid'
      ? { ok: false, reason, attemptsLeft: Math.max(0, OTP_CONFIG.maxAttempts - channels.phone.attempts) }
      : { ok: false, reason }
  }
  channels.phone.target = null // burn
  return { ok: true }
}

/* ─── Helpers the UI uses for countdowns/resend gating ─── */
export function getExpiresAt(channel) { return channels[channel]?.expiresAt || 0 }
export function getResendAt(channel)  { return channels[channel]?.resendAt || 0 }
export function canResend(channel)    { return now() >= (channels[channel]?.resendAt || 0) }
export function isExpired(channel) {
  const c = channels[channel]
  return !!(c && c.target && now() > c.expiresAt)
}
