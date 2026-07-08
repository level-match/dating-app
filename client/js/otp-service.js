/* ============================================================
   LEVEL — OTP Service (MFA factor delivery & verification)
   --------------------------------------------------------------
   Email: Supabase Auth OTP (real inbox delivery when configured).
   Phone: mock until an SMS provider is wired.

   Public contract (stable for mfa.js):
     send*  → { ok:true, expiresAt, resendAt } | { ok:false, reason }
     verify*→ { ok:true } | { ok:false, reason, attemptsLeft? }
   ============================================================ */

import { supabase } from './supabase.js'

const USE_SUPABASE_EMAIL = !!(
  import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY
) && import.meta.env.VITE_USE_SUPABASE_EMAIL !== 'false'

export const OTP_CONFIG = {
  length: 6,
  ttlSeconds: 120,
  /** Supabase default email OTP lifetime (Auth → Providers → Email). */
  supabaseEmailTtlSeconds: 3600,
  resendCooldownSeconds: 30,
  maxAttempts: 5,
  demoCode: '123456',
  latencyMs: 900,
  exposeDemoCode: !USE_SUPABASE_EMAIL,
  useSupabaseEmail: USE_SUPABASE_EMAIL,
}

/** Supabase verifyOtp failures — wrong, reused, and expired tokens all share otp_expired. */
export function mapSupabaseOtpVerifyReason(_error) {
  return 'invalid'
}

const channels = {
  email: { code: null, expiresAt: 0, resendAt: 0, attempts: 0, target: null },
  phone: { code: null, expiresAt: 0, resendAt: 0, attempts: 0, target: null },
}

const now = () => Date.now()
const wait = ms => new Promise(res => setTimeout(res, ms))

function stampChannel(c, ttlSeconds = OTP_CONFIG.ttlSeconds) {
  c.attempts = 0
  c.expiresAt = now() + ttlSeconds * 1000
  c.resendAt = now() + OTP_CONFIG.resendCooldownSeconds * 1000
  return { ok: true, expiresAt: c.expiresAt, resendAt: c.resendAt }
}

function issueCode() {
  return OTP_CONFIG.demoCode
}

/* ─── Mock channel (phone + email fallback) ─── */
async function sendMock(channel, target) {
  await wait(OTP_CONFIG.latencyMs)

  if (!target || (channel === 'phone' && target.replace(/\D/g, '').length < 7)) {
    return { ok: false, reason: 'send_failed' }
  }

  const c = channels[channel]
  c.code = issueCode()
  c.target = target
  const result = stampChannel(c)

  if (OTP_CONFIG.exposeDemoCode) {
    console.info(`[LEVEL MFA] ${channel} code for ${target}: ${c.code}`)
  }
  return result
}

async function verifyMock(channel, code) {
  await wait(Math.round(OTP_CONFIG.latencyMs * 0.7))
  const c = channels[channel]

  if (!c.code) return { ok: false, reason: 'no_otp' }
  if (c.attempts >= OTP_CONFIG.maxAttempts) return { ok: false, reason: 'locked' }

  c.attempts += 1
  if (String(code).trim() !== c.code) {
    return { ok: false, reason: 'invalid', attemptsLeft: Math.max(0, OTP_CONFIG.maxAttempts - c.attempts) }
  }
  if (now() > c.expiresAt) return { ok: false, reason: 'expired' }

  c.code = null
  return { ok: true }
}

/* ─── Supabase email OTP ─── */
async function sendEmailSupabase(email) {
  const target = (email || '').trim().toLowerCase()
  if (!target || !target.includes('@')) {
    return { ok: false, reason: 'send_failed' }
  }

  let { error } = await supabase.auth.signInWithOtp({
    email: target,
    options: { shouldCreateUser: false },
  })

  // User may not exist yet if they landed on MFA without a prior sync.
  if (error && /not found|signup|not allowed/i.test(error.message)) {
    ({ error } = await supabase.auth.signInWithOtp({
      email: target,
      options: { shouldCreateUser: true },
    }))
  }

  if (error) {
    console.error('[otp-service] Supabase send failed:', error.message)
    return { ok: false, reason: 'send_failed' }
  }

  const c = channels.email
  c.code = null
  c.target = target
  return stampChannel(c, OTP_CONFIG.supabaseEmailTtlSeconds)
}

async function verifyEmailSupabase(code) {
  const c = channels.email
  const email = c.target
  const token = String(code).trim()

  if (!email) return { ok: false, reason: 'no_otp' }
  if (c.attempts >= OTP_CONFIG.maxAttempts) return { ok: false, reason: 'locked' }

  c.attempts += 1

  const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' })
  if (error) {
    console.warn('[otp-service] verify failed:', error.code, error.message)
    return {
      ok: false,
      reason: mapSupabaseOtpVerifyReason(error),
      attemptsLeft: Math.max(0, OTP_CONFIG.maxAttempts - c.attempts),
    }
  }

  return { ok: true }
}

export const sendEmailOtp = USE_SUPABASE_EMAIL
  ? sendEmailSupabase
  : (email) => sendMock('email', email)

export const verifyEmailOtp = USE_SUPABASE_EMAIL
  ? verifyEmailSupabase
  : (code) => verifyMock('email', code)

export const sendPhoneOtp = (phone) => sendMock('phone', phone)
export const verifyPhoneOtp = (code) => verifyMock('phone', code)

export function getExpiresAt(channel) { return channels[channel]?.expiresAt || 0 }
export function getResendAt(channel)  { return channels[channel]?.resendAt || 0 }
export function canResend(channel)    { return now() >= (channels[channel]?.resendAt || 0) }
export function isExpired(channel) {
  const c = channels[channel]
  if (!c?.target) return false
  if (USE_SUPABASE_EMAIL && channel === 'email') return now() > c.expiresAt
  return !!(c.code && now() > c.expiresAt)
}
