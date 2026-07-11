/* ════════════════════════════════════════════════════════════════
   LEVEL — Reusable under-maintenance page

   Link to maintenance.html?context=<key> where <key> is one of the
   presets below. Use maintenanceUrl() in JS so links stay in sync.
   ════════════════════════════════════════════════════════════════ */

const GOOGLE_ICON_SVG =
  '<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">' +
  '<path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>' +
  '<path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>' +
  '<path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>' +
  '<path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>' +
  '</svg>'

const BACK_ICON_SVG =
  '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<path d="M19 12H5"/><path d="M12 5l-7 7 7 7"/>' +
  '</svg>'

const DEFAULT_BODY =
  'This feature is being carefully built and will be available very soon. ' +
  "We're making sure it meets LEVEL's standard before we open it up."

function homePage(ctx) {
  return {
    backHref: 'index.html',
    backLabel: 'Back to home',
    actions: [],
    body: DEFAULT_BODY,
    ...ctx,
  }
}

function settingsPage(ctx) {
  return {
    backHref: 'settings.html',
    backLabel: 'Back to Settings',
    actions: [],
    body: DEFAULT_BODY,
    eyebrow: 'Under Maintenance',
    ...ctx,
  }
}

/** @type {Record<string, {
 *   pageTitle: string
 *   eyebrow: string
 *   headline: string
 *   headlineEm: string
 *   body: string
 *   backHref: string
 *   backLabel: string
 *   actions?: Array<{ type: 'google-signup' | 'link', href: string, label: string, className?: string }>
 * }>} */
export const MAINTENANCE_CONTEXTS = {
  default: homePage({
    pageTitle: 'Coming Soon',
    eyebrow: 'Under Maintenance',
    headline: 'Almost',
    headlineEm: 'connected.',
  }),
  signup: homePage({
    pageTitle: 'Early Access',
    eyebrow: 'Early Access',
    headline: 'Almost',
    headlineEm: 'open.',
    body:
      'New member sign-up is opening carefully and intentionally. ' +
      'You can still join with Google while we finish the rest.',
    actions: [
      { type: 'google-signup', href: 'auth.html?signup=google', label: 'Sign up with Google' },
    ],
  }),
  'how-it-works': homePage({
    pageTitle: 'How It Works',
    headline: 'How it',
    headlineEm: 'works.',
    body: 'A full walkthrough of the LEVEL membership journey is on its way.',
  }),
  pricing: homePage({
    pageTitle: 'Pricing',
    headline: 'Membership',
    headlineEm: 'pricing.',
    body: 'Detailed membership tiers and pricing will be published here soon.',
  }),
  concierge: homePage({
    pageTitle: 'Concierge',
    headline: 'Concierge',
    headlineEm: 'service.',
    body: 'Our concierge reservations and recommendations experience is still being refined.',
  }),
  philosophy: homePage({
    pageTitle: 'Philosophy',
    headline: 'Our',
    headlineEm: 'philosophy.',
    body: 'A dedicated philosophy page is being written with the same care we bring to matching.',
  }),
  matching: homePage({
    pageTitle: 'Matching System',
    headline: 'Matching',
    headlineEm: 'system.',
    body: 'A deeper look at how LEVEL curates alignment is coming soon.',
  }),
  inclusivity: homePage({
    pageTitle: 'Inclusivity',
    headline: 'Built for',
    headlineEm: 'everyone.',
    body: 'Our inclusivity charter and community standards page is still being prepared.',
  }),
  stories: homePage({
    pageTitle: 'Member Stories',
    headline: 'Member',
    headlineEm: 'stories.',
    body: 'More member stories and testimonials will be published here soon.',
  }),
  faq: homePage({
    pageTitle: 'FAQ',
    headline: 'Frequently asked',
    headlineEm: 'questions.',
    body: 'A comprehensive FAQ is being assembled and will be available shortly.',
  }),
  safety: homePage({
    pageTitle: 'Safety',
    headline: 'Safety',
    headlineEm: 'center.',
    body: 'Our safety policies, reporting tools, and member protections guide is on the way.',
  }),
  press: homePage({
    pageTitle: 'Press',
    headline: 'Press',
    headlineEm: 'room.',
    body: 'Press resources and media inquiries will be available here soon.',
  }),
  terms: homePage({
    pageTitle: 'Terms of Service',
    headline: 'Terms of',
    headlineEm: 'service.',
    body: 'The standalone terms page is being finalized. Sign-in legal copy remains available on the auth screen.',
  }),
  privacy: homePage({
    pageTitle: 'Privacy Policy',
    headline: 'Privacy',
    headlineEm: 'policy.',
    body: 'The standalone privacy page is being finalized. Sign-in legal copy remains available on the auth screen.',
  }),
  cookies: homePage({
    pageTitle: 'Cookies',
    headline: 'Cookie',
    headlineEm: 'policy.',
    body: 'Our cookie and tracking preferences page is being prepared.',
  }),
  accessibility: homePage({
    pageTitle: 'Accessibility',
    headline: 'Accessibility',
    headlineEm: 'statement.',
    body: 'Our accessibility commitment and accommodation details are being documented.',
  }),
  'app-download': homePage({
    pageTitle: 'Mobile App',
    eyebrow: 'Mobile App',
    headline: 'App',
    headlineEm: 'download.',
    body: 'The LEVEL iOS and Android apps are in development and will be available on the App Store and Google Play soon.',
  }),
  'phone-verify': settingsPage({
    pageTitle: 'Phone Verification',
    eyebrow: 'Verification',
    headline: 'Phone',
    headlineEm: 'verification.',
    body:
      'Phone number verification is being carefully built and will be available very soon. ' +
      "We're making sure it meets LEVEL's security standard before we open it up.",
  }),
  'id-verify': settingsPage({
    pageTitle: 'ID Verification',
    eyebrow: 'Verification',
    headline: 'ID',
    headlineEm: 'verification.',
    body:
      'ID photo verification is being carefully built and will be available very soon. ' +
      "We're making sure it meets LEVEL's security standard before we open it up.",
  }),
  'email-change': settingsPage({
    pageTitle: 'Change Email',
    eyebrow: 'Account',
    headline: 'Change',
    headlineEm: 'email.',
    body: 'Self-service email changes are not available yet. This flow is being built to keep your account secure.',
  }),
  'password-reset': settingsPage({
    pageTitle: 'Reset Password',
    eyebrow: 'Account',
    headline: 'Reset',
    headlineEm: 'password.',
    body: 'Self-service password reset from settings is not available yet. This flow is being built now.',
  }),
  'light-mode': settingsPage({
    pageTitle: 'Light Mode',
    eyebrow: 'Appearance',
    headline: 'Light',
    headlineEm: 'mode.',
    body: 'LEVEL is designed for dark surroundings first. A light theme is being crafted and will arrive soon.',
  }),
}

/** Build a maintenance page URL for a known context preset. */
export function maintenanceUrl(context = 'default') {
  if (!context || context === 'default') return 'maintenance.html'
  return `maintenance.html?context=${encodeURIComponent(context)}`
}

/** Set href / click handlers on elements with `data-maintenance="<context>"`. */
export function wireMaintenanceLinks(root = document) {
  root.querySelectorAll('[data-maintenance]').forEach(el => {
    const context = el.dataset.maintenance
    if (!context) return
    const href = maintenanceUrl(context)

    if (el.tagName === 'A') {
      el.href = href
      return
    }

    el.addEventListener('click', () => {
      window.location.href = href
    })
  })
}

/** Resolve a context key to its preset, falling back to default. */
export function getMaintenanceContext(contextKey) {
  return MAINTENANCE_CONTEXTS[contextKey] || MAINTENANCE_CONTEXTS.default
}

function isSafeRelativePath(path) {
  if (!path || typeof path !== 'string') return false
  if (path.startsWith('//') || path.includes('://')) return false
  if (path.startsWith('/') || path.startsWith('\\')) return false
  return /^[a-z0-9._/?=&%-]+$/i.test(path)
}

function renderAction(action) {
  const el = document.createElement('a')
  el.href = action.href

  if (action.type === 'google-signup') {
    el.className = 'action-btn action-btn--google'
    el.innerHTML = `${GOOGLE_ICON_SVG}<span>${action.label}</span>`
    return el
  }

  el.className = action.className || 'action-btn action-btn--secondary'
  el.textContent = action.label
  return el
}

/** Apply the active context to maintenance.html. */
export function initMaintenancePage() {
  const params = new URLSearchParams(window.location.search)
  const contextKey = params.get('context') || 'default'
  const ctx = { ...getMaintenanceContext(contextKey) }

  const returnTo = params.get('return')
  if (returnTo && isSafeRelativePath(returnTo)) {
    ctx.backHref = returnTo
  }

  document.title = `LEVEL — ${ctx.pageTitle}`

  const eyebrow = document.getElementById('maintEyebrow')
  const headline = document.getElementById('maintHeadline')
  const body = document.getElementById('maintBody')
  const backBtn = document.getElementById('maintBackBtn')
  const actionsEl = document.getElementById('maintActions')

  if (eyebrow) eyebrow.textContent = ctx.eyebrow
  if (headline) {
    headline.innerHTML = `${ctx.headline}<br><em>${ctx.headlineEm}</em>`
  }
  if (body) body.textContent = ctx.body

  if (backBtn) {
    backBtn.href = ctx.backHref
    backBtn.innerHTML = `${BACK_ICON_SVG}<span class="back-label">${ctx.backLabel}</span>`
  }

  if (actionsEl) {
    actionsEl.innerHTML = ''
    for (const action of ctx.actions || []) {
      actionsEl.appendChild(renderAction(action))
    }
    actionsEl.hidden = !(ctx.actions || []).length
  }
}
