/* ============================================================
   LEVEL — OTP Service (MFA factor delivery & verification)
   --------------------------------------------------------------
   MOCK IMPLEMENTATION. Simulates a backend OTP provider entirely on
   the frontend: network latency, per-channel codes, expiry, resend
   cooldown, and success/failure results.

   ┌─ Replacing with a real backend ────────────────────────────┐
   │ Swap the bodies of sendEmailOtp / verifyEmailOtp /          │
   │ sendPhoneOtp / verifyPhoneOtp with `fetch()` calls to your  │
   │ API. Keep the SAME return shapes documented below and the   │
   │ rest of the app (mfa.js) needs no changes.                  │
   │                                                             │
   │   send*  → { ok:true, expiresAt:number, resendAt:number }   │
   │           | { ok:false, reason:'send_failed' }              │
   │   verify*→ { ok:true }                                       │
   │           | { ok:false, reason:'invalid'|'expired'|'locked' }│
   └─────────────────────────────────────────────────────────────┘
   ============================================================ */

export const OTP_CONFIG = {
  length: 6,
  ttlSeconds: 120,       // code lifetime
  resendCooldownSeconds: 30,
  maxAttempts: 5,
  // Mock-only knobs:
  demoCode: '123456',    // accepted code while no real backend is wired
  latencyMs: 900,        // simulated round-trip
  exposeDemoCode: true,  // lets the UI show the demo code as a hint
}

/* Per-channel runtime state (in-memory; a real impl keeps this server-side). */
const channels = {
  email: { code: null, expiresAt: 0, resendAt: 0, attempts: 0, target: null },
  phone: { code: null, expiresAt: 0, resendAt: 0, attempts: 0, target: null },
}

const now = () => Date.now()
const wait = ms => new Promise(res => setTimeout(res, ms))

/* In mock mode we always issue the demo code; a real backend issues its own. */
function issueCode() {
  return OTP_CONFIG.demoCode
}

async function send(channel, target) {
  await wait(OTP_CONFIG.latencyMs)

  // Simulate a delivery failure for obviously invalid targets so the UI's
  // error state is reachable in the demo.
  if (!target || (channel === 'phone' && target.replace(/\D/g, '').length < 7)) {
    return { ok: false, reason: 'send_failed' }
  }

  const c = channels[channel]
  c.code = issueCode()
  c.target = target
  c.attempts = 0
  c.expiresAt = now() + OTP_CONFIG.ttlSeconds * 1000
  c.resendAt = now() + OTP_CONFIG.resendCooldownSeconds * 1000

  if (OTP_CONFIG.exposeDemoCode) {
    // Dev affordance only — a real OTP is never logged client-side.
    console.info(`[LEVEL MFA] ${channel} code for ${target}: ${c.code}`)
  }
  return { ok: true, expiresAt: c.expiresAt, resendAt: c.resendAt }
}

async function verify(channel, code) {
  await wait(Math.round(OTP_CONFIG.latencyMs * 0.7))
  const c = channels[channel]

  if (!c.code) return { ok: false, reason: 'no_otp' }
  if (now() > c.expiresAt) return { ok: false, reason: 'expired' }
  if (c.attempts >= OTP_CONFIG.maxAttempts) return { ok: false, reason: 'locked' }

  c.attempts += 1
  if (String(code).trim() !== c.code) {
    return { ok: false, reason: 'invalid', attemptsLeft: Math.max(0, OTP_CONFIG.maxAttempts - c.attempts) }
  }

  // Burn the code on success so it can't be reused.
  c.code = null
  return { ok: true }
}

/* ─── Public API (stable contract) ─── */
export const sendEmailOtp   = (email)  => send('email', email)
export const verifyEmailOtp = (code)   => verify('email', code)
export const sendPhoneOtp   = (phone)  => send('phone', phone)
export const verifyPhoneOtp = (code)   => verify('phone', code)

/* Helpers the UI uses for countdowns/resend gating. */
export function getExpiresAt(channel) { return channels[channel]?.expiresAt || 0 }
export function getResendAt(channel)  { return channels[channel]?.resendAt || 0 }
export function canResend(channel)    { return now() >= (channels[channel]?.resendAt || 0) }
export function isExpired(channel) {
  const c = channels[channel]
  return !!(c && c.code && now() > c.expiresAt)
}
