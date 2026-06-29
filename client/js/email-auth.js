/* ════════════════════════════════════════════════════════════════
   LEVEL — Email-code auth (passwordless registration + login)

   auth.html: user types an email → Supabase emails a 6-digit code →
   a modal collects the code → verifyOtp → bridge into the store → route on.

   Single factor, same as the OAuth path (no separate MFA step).

   Requires (Supabase dashboard):
     - Email provider enabled.
     - The OTP email template must include {{ .Token }} so the message contains
       a 6-digit code (not just a magic link). See backend README step 4.
   ════════════════════════════════════════════════════════════════ */

import { supabase } from './supabase.js'
import { store } from './store.js'
import { apiFetch } from './sso.js'

const DESTINATION = { apply: 'onboarding.html', signin: 'dashboard.html' }

const isValidEmail = (e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)

function panelEls(intent) {
  const id = intent === 'apply' ? 'apply' : 'login'
  return {
    input: document.getElementById(`${id}Email`),
    status: document.getElementById(`${id}EmailStatus`),
  }
}

function setStatus(el, kind, msg) {
  if (!el) return
  if (!msg) { el.classList.remove('show'); el.textContent = ''; return }
  el.dataset.kind = kind
  el.textContent = msg
  el.classList.add('show')
}

/* ─── Entry point wired to the "Continue with email" buttons ─── */
window.handleEmailAuth = async function (intent) {
  const { input, status } = panelEls(intent)
  const email = (input?.value || '').trim().toLowerCase()

  if (!isValidEmail(email)) {
    setStatus(status, 'error', 'Enter a valid email address.')
    input?.focus()
    return
  }

  const btn = input?.parentElement.querySelector('.email-auth-btn')
  if (btn) { btn.disabled = true; btn.dataset.label = btn.textContent; btn.textContent = 'Sending code…' }
  setStatus(status, 'info', 'Sending a code to your inbox…')

  // apply = may create a new user; signin = existing members only.
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: intent === 'apply' },
  })

  if (btn) { btn.disabled = false; btn.textContent = btn.dataset.label || 'Continue with email' }

  if (error) {
    setStatus(status, 'error', friendlySendError(error.message, intent))
    return
  }

  setStatus(status, 'success', `Code sent to ${email}.`)
  openCodeModal(email, intent)
}

function friendlySendError(message = '', intent) {
  if (/not allowed|user not found|signups? not/i.test(message)) {
    return intent === 'signin'
      ? 'No account found for that email. Use “Apply Now” to join.'
      : 'Could not start signup for that email. Please try again.'
  }
  if (/rate|too many|limit|seconds/i.test(message)) {
    return 'Please wait a moment before requesting another code.'
  }
  return 'We couldn’t send a code. Please check the email and try again.'
}

/* ─── 6-digit code modal ─── */
function openCodeModal(email, intent) {
  document.getElementById('emailCodeOverlay')?.remove()

  const overlay = document.createElement('div')
  overlay.id = 'emailCodeOverlay'
  overlay.style.cssText =
    'position:fixed;inset:0;z-index:3000;display:flex;align-items:center;justify-content:center;padding:20px;' +
    'background:rgba(1,15,36,0.88);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);'

  const boxStyle =
    'flex:1;min-width:0;height:56px;text-align:center;font-family:var(--font-serif);font-size:1.5rem;' +
    'color:#FDFCF8;background:rgba(255,255,255,0.04);border:1.5px solid rgba(255,255,255,0.14);' +
    'border-radius:12px;outline:none;'

  overlay.innerHTML = `
    <div style="width:100%;max-width:420px;background:rgba(6,12,26,0.94);border:1px solid var(--border-mid);
                border-radius:20px;padding:34px 30px;box-shadow:var(--shadow-2xl);">
      <div style="font-family:var(--font-serif);font-size:1.5rem;font-weight:300;color:var(--text-primary);">Check your email</div>
      <p style="font-family:var(--font-sans);font-size:var(--text-sm);color:var(--text-secondary);line-height:1.6;margin:10px 0 22px;">
        Enter the 6-digit code we sent to <strong style="color:var(--text-primary);">${email}</strong>.
      </p>
      <div id="ecRow" style="display:flex;gap:8px;margin-bottom:14px;">
        ${Array.from({ length: 6 }).map((_, i) =>
          `<input type="text" inputmode="numeric" maxlength="1" aria-label="Digit ${i + 1}" style="${boxStyle}">`).join('')}
      </div>
      <div id="ecError" style="display:none;font-family:var(--font-sans);font-size:var(--text-xs);color:#FCA5A5;margin-bottom:12px;"></div>
      <button id="ecVerify" class="btn btn-gold" style="width:100%;justify-content:center;">Verify &amp; continue</button>
      <div style="display:flex;justify-content:space-between;margin-top:16px;font-family:var(--font-sans);font-size:var(--text-xs);">
        <button id="ecResend" style="color:var(--ocean-300);background:none;cursor:pointer;">Resend code</button>
        <button id="ecCancel" style="color:var(--text-muted);background:none;cursor:pointer;">Use a different email</button>
      </div>
    </div>`

  document.body.appendChild(overlay)

  const inputs = Array.from(overlay.querySelectorAll('#ecRow input'))
  const errEl = overlay.querySelector('#ecError')
  const verifyBtn = overlay.querySelector('#ecVerify')
  const code = () => inputs.map((i) => i.value.trim()).join('')
  const showErr = (m) => { errEl.textContent = m || ''; errEl.style.display = m ? 'block' : 'none' }

  inputs.forEach((input, i) => {
    input.addEventListener('input', (e) => {
      e.target.value = e.target.value.replace(/\D/g, '').slice(0, 1)
      showErr('')
      if (e.target.value && i < inputs.length - 1) inputs[i + 1].focus()
      if (i === inputs.length - 1 && code().length === 6) doVerify()
    })
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !e.target.value && i > 0) inputs[i - 1].focus()
      else if (e.key === 'Enter' && code().length === 6) doVerify()
    })
    input.addEventListener('paste', (e) => {
      e.preventDefault()
      const digits = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g, '').slice(0, 6)
      digits.split('').forEach((d, idx) => { if (inputs[idx]) inputs[idx].value = d })
      inputs[Math.min(digits.length, inputs.length - 1)].focus()
      if (digits.length === 6) doVerify()
    })
  })
  inputs[0]?.focus()

  let busy = false
  async function doVerify() {
    if (busy) return
    const token = code()
    if (token.length < 6) { showErr('Enter all six digits.'); return }
    busy = true
    verifyBtn.disabled = true
    verifyBtn.textContent = 'Verifying…'
    showErr('')

    const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' })
    if (error) {
      busy = false
      verifyBtn.disabled = false
      verifyBtn.textContent = 'Verify & continue'
      showErr(/expired/i.test(error.message) ? 'That code expired — resend a new one.' : 'That code isn’t right. Try again.')
      inputs.forEach((i) => { i.value = '' }); inputs[0].focus()
      return
    }
    await finishSession(email, intent)
  }

  overlay.querySelector('#ecVerify').addEventListener('click', doVerify)
  overlay.querySelector('#ecCancel').addEventListener('click', () => overlay.remove())
  overlay.querySelector('#ecResend').addEventListener('click', async () => {
    showErr('')
    const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: intent === 'apply' } })
    showErr(error ? 'Couldn’t resend. Wait a moment and retry.' : '')
    if (!error) { const ok = overlay.querySelector('#ecError'); ok.style.color = '#A7E0C8'; ok.textContent = 'New code sent.'; ok.style.display = 'block' }
  })
}

/* ─── Bridge the verified session into the app store, then route on ─── */
async function finishSession(email, intent) {
  let profile = null
  try {
    const res = await apiFetch('/api/me')
    if (res.ok) profile = (await res.json()).profile
  } catch { /* backend optional — fall back to defaults */ }

  const def = store.getDefaultUser()
  store.setUser({
    ...def,
    firstName: profile?.firstName || def.firstName,
    lastName: profile?.lastName || '',
    email,
    profession: profile?.profession || '',
    authProvider: 'email',
  })

  window.location.replace(DESTINATION[intent])
}
