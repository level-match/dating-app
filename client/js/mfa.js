import { store } from './store.js'
import { initBodyFade } from './app.js'
import {
  sendEmailOtp, verifyEmailOtp,
  getExpiresAt, getResendAt, OTP_CONFIG,
} from './otp-service.js'
import { supabase } from './supabase.js'

initBodyFade()

/* ─── Route guard ───────────────────────────────────────────────
   Only an authenticated session that still owes MFA belongs here. */
if (!store.isLoggedIn()) {
  window.location.replace('auth.html')
} else if (store.isMfaComplete()) {
  window.location.replace(store.getPendingDestination())
}

const user = store.getUser() || {}
const mfa = store.getMfaState() || {}

/* ─── Helpers ─── */
const $ = id => document.getElementById(id)

function maskEmail(email) {
  if (!email || !email.includes('@')) return email || 'your email'
  const [local, domain] = email.split('@')
  const head = local[0]
  return `${head}${'•'.repeat(Math.max(2, local.length - 1))}@${domain}`
}

function setStatus(el, kind, message) {
  if (!el) return
  if (!message) { el.classList.remove('show'); return }
  el.dataset.kind = kind
  el.textContent = message
  el.classList.add('show')
}

function setStep(stepEl, state) { if (stepEl) stepEl.dataset.state = state }

function fmt(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

if (OTP_CONFIG.useSupabaseEmail) {
  $('mfaHint').textContent = 'A 6-digit code will be sent to your email. Check spam if it doesn’t arrive within a minute.'
} else if (OTP_CONFIG.exposeDemoCode) {
  $('mfaHint').innerHTML = `Demo email code <span class="mfa-demo-code">${OTP_CONFIG.demoCode}</span>.`
}

/* ─── OTP code-input wiring (auto-advance, backspace, paste) ─── */
function wireOtpInputs(row, onComplete) {
  const inputs = Array.from(row.querySelectorAll('.verify-input'))
  const code = () => inputs.map(i => i.value.trim()).join('')
  inputs.forEach((input, i) => {
    input.addEventListener('input', e => {
      const v = e.target.value.replace(/\D/g, '').slice(0, 1)
      e.target.value = v
      e.target.classList.toggle('filled', !!v)
      row.dataset.error = 'false'
      if (v && i < inputs.length - 1) inputs[i + 1].focus()
      if (i === inputs.length - 1 && code().length === 6) onComplete()
    })
    input.addEventListener('keydown', e => {
      if (e.key === 'Backspace' && !e.target.value && i > 0) inputs[i - 1].focus()
      else if (e.key === 'Enter' && code().length === 6) onComplete()
    })
    input.addEventListener('paste', e => {
      e.preventDefault()
      const pasted = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g, '').slice(0, 6)
      pasted.split('').forEach((ch, idx) => {
        if (inputs[idx]) { inputs[idx].value = ch; inputs[idx].classList.add('filled') }
      })
      inputs[Math.min(pasted.length, inputs.length - 1)].focus()
      if (pasted.length === 6) onComplete()
    })
  })
  return {
    inputs,
    code,
    reset() { inputs.forEach(i => { i.value = ''; i.classList.remove('filled') }); row.dataset.error = 'false' },
    setError() { row.dataset.error = 'true' },
    setDisabled(d) { inputs.forEach(i => { i.disabled = d }) },
    focus() { inputs[0]?.focus() },
  }
}

/* ─── Email OTP stage ─── */
function createOtpStage(opts) {
  const { channel, sendFn, verifyFn, els, onVerified } = opts
  const otp = wireOtpInputs(els.row, () => verify())
  let ticker = null
  let busy = false

  function stopTicker() { if (ticker) { clearInterval(ticker); ticker = null } }

  function tick() {
    const now = Date.now()
    const expMs = getExpiresAt(channel) - now
    const resendMs = getResendAt(channel) - now

    if (expMs <= 0) {
      els.countdown.textContent = 'Code expired'
      els.countdown.classList.add('expired')
      els.verifyBtn.disabled = true
      otp.setDisabled(true)
      els.resend.disabled = false
      els.resend.textContent = 'Resend code'
      stopTicker()
      setStatus(els.status, 'error', 'Your code expired. Request a new one to continue.')
      return
    }
    els.countdown.classList.remove('expired')
    els.countdown.textContent = `Code expires in ${fmt(expMs)}`
    if (resendMs > 0) {
      els.resend.disabled = true
      els.resend.textContent = `Resend in ${fmt(resendMs)}`
    } else {
      els.resend.disabled = false
      els.resend.textContent = 'Resend code'
    }
  }

  function startTicker() { stopTicker(); tick(); ticker = setInterval(tick, 1000) }

  async function send(target, { isResend = false } = {}) {
    if (busy) return
    busy = true
    els.loading.classList.add('show')
    setStatus(els.status, 'info', '')
    els.status.classList.remove('show')

    const res = await sendFn(target)
    els.loading.classList.remove('show')
    busy = false

    if (!res.ok) {
      setStatus(els.status, 'error', 'We couldn’t send the code. Please try again.')
      return false
    }

    els.otpBlock.style.display = 'block'
    otp.reset(); otp.setDisabled(false)
    els.verifyBtn.disabled = false
    const mask = opts.maskTarget ? opts.maskTarget(target) : target
    setStatus(els.status, 'success', `${isResend ? 'A new code' : 'A 6-digit code'} is on its way to ${mask}.`)
    startTicker()
    otp.focus()
    return true
  }

  async function verify() {
    if (busy) return
    const code = otp.code()
    if (code.length < 6) { otp.setError(); setStatus(els.status, 'error', 'Enter all six digits.'); return }

    busy = true
    els.verifyBtn.disabled = true
    els.loading.classList.add('show')

    const res = await verifyFn(code)
    els.loading.classList.remove('show')
    busy = false

    if (res.ok) {
      stopTicker()
      otp.setDisabled(true)
      els.countdown.textContent = ''
      els.resend.style.display = 'none'
      setStatus(els.status, 'success', 'Verified.')
      onVerified()
      return
    }

    otp.setError()
    els.verifyBtn.disabled = false
    // Supabase returns otp_expired for wrong codes too — only the countdown means "expired".
    const reason = (OTP_CONFIG.useSupabaseEmail && res.reason === 'expired')
      ? 'invalid'
      : res.reason
    const messages = {
      expired: 'That code has expired. Tap “Resend code” for a new one.',
      invalid: res.attemptsLeft != null
        ? `That code isn’t right. ${res.attemptsLeft} attempt${res.attemptsLeft === 1 ? '' : 's'} left.`
        : 'That code isn’t right. Please try again.',
      locked: 'Too many attempts. Please request a new code.',
      no_otp: 'Please request a code first.',
    }
    setStatus(els.status, 'error', messages[reason] || 'Verification failed. Please try again.')
    otp.reset(); otp.focus()
  }

  els.verifyBtn.addEventListener('click', verify)
  els.resend.addEventListener('click', () => send(opts.currentTarget(), { isResend: true }))

  return { send }
}

/* ─── EMAIL STAGE (MFA is email-only until SMS is wired) ─── */
let emailAddr = user.email || ''

const emailStage = createOtpStage({
  channel: 'email',
  sendFn: sendEmailOtp,
  verifyFn: verifyEmailOtp,
  currentTarget: () => emailAddr,
  maskTarget: maskEmail,
  els: {
    row: $('emailOtpRow'),
    otpBlock: $('emailOtpBlock'),
    loading: $('emailLoading'),
    status: $('emailStatus'),
    countdown: $('emailCountdown'),
    resend: $('emailResend'),
    verifyBtn: $('emailVerifyBtn'),
  },
  onVerified: () => {
    store.markEmailVerified()
    setStep($('stepEmail'), 'done')
    finishMfa()
  },
})

function showStage(id) {
  document.querySelectorAll('.mfa-stage').forEach(s => s.classList.remove('active'))
  $(id).classList.add('active')
}

function finishMfa() {
  const dest = store.completeMfa()
  showStage('successStage')
  setStep($('stepEmail'), 'done')
  $('mfaHint').textContent = ''
  setTimeout(() => window.location.replace(dest), 1400)
}

async function bootEmailStage() {
  if (!emailAddr) {
    const { data: { session } } = await supabase.auth.getSession()
    emailAddr = session?.user?.email || ''
  }

  $('emailTarget').textContent = maskEmail(emailAddr)

  if (!emailAddr) {
    setStatus($('emailStatus'), 'error', 'No email on your account. Sign in again from the auth page.')
    return
  }

  if (mfa.email && mfa.email.verified) {
    finishMfa()
  } else {
    emailStage.send(emailAddr)
  }
}

bootEmailStage()
