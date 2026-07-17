/**
 * PayMongo Hosted Checkout (Checkout Sessions API).
 * Docs: https://docs.paymongo.com/docs/payment-channels-hosted-checkout
 */

const PAYMONGO_CHECKOUT_URL = 'https://api.paymongo.com/v2/checkout_sessions'

// Only include methods enabled on the PayMongo account (override via env).
const DEFAULT_PAYMENT_METHODS = ['qrph']

function getSecretKey() {
  const key = process.env.PAYMONGO_SECRET_KEY
  if (!key || key.includes('xxxxxxxx')) {
    const err = new Error('PAYMONGO_SECRET_KEY is not configured.')
    err.code = 'PAYMONGO_NOT_CONFIGURED'
    throw err
  }
  return key
}

function authHeader(secretKey) {
  return `Basic ${Buffer.from(`${secretKey}:`).toString('base64')}`
}

function paymentMethodTypes() {
  const raw = process.env.PAYMONGO_PAYMENT_METHODS
  if (!raw) return DEFAULT_PAYMENT_METHODS
  return raw.split(',').map(s => s.trim()).filter(Boolean)
}

function frontendOrigin() {
  return (process.env.FRONTEND_ORIGIN || 'http://localhost:3000').replace(/\/$/, '')
}

function membershipReturnUrls() {
  const base = frontendOrigin()
  return {
    successUrl: `${base}/membership.html?payment=success`,
    cancelUrl:  `${base}/membership.html?payment=cancelled`,
  }
}

/**
 * Create a PayMongo Checkout Session and return the hosted checkout URL.
 * @param {{
 *   amountCentavos: number,
 *   description: string,
 *   referenceNumber: string,
 *   metadata?: Record<string, string>,
 * }} opts
 */
async function createCheckoutSession({
  amountCentavos,
  description,
  referenceNumber,
  metadata = {},
}) {
  if (!Number.isInteger(amountCentavos) || amountCentavos < 100) {
    const err = new Error('Checkout amount must be at least 100 centavos (₱1.00).')
    err.code = 'INVALID_AMOUNT'
    throw err
  }

  const secretKey = getSecretKey()
  const { successUrl, cancelUrl } = membershipReturnUrls()

  const response = await fetch(PAYMONGO_CHECKOUT_URL, {
    method: 'POST',
    headers: {
      Authorization: authHeader(secretKey),
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      data: {
        attributes: {
          send_email_receipt: true,
          show_description: true,
          show_line_items: true,
          description,
          line_items: [
            {
              name: description,
              amount: amountCentavos,
              currency: 'PHP',
              quantity: 1,
            },
          ],
          payment_method_types: paymentMethodTypes(),
          success_url: successUrl,
          cancel_url: cancelUrl,
          reference_number: String(referenceNumber).slice(0, 100),
          metadata: Object.fromEntries(
            Object.entries(metadata).map(([k, v]) => [k, String(v)])
          ),
        },
      },
    }),
  })

  const json = await response.json().catch(() => ({}))

  if (!response.ok) {
    const detail = json.errors?.[0]?.detail
      || json.errors?.[0]?.title
      || `PayMongo error (${response.status})`
    const err = new Error(detail)
    err.code = 'PAYMONGO_ERROR'
    err.status = response.status
    err.body = json
    throw err
  }

  const session = json.data
  const checkoutUrl = session?.attributes?.checkout_url
  if (!session?.id || !checkoutUrl) {
    const err = new Error('PayMongo returned an incomplete checkout session.')
    err.code = 'PAYMONGO_ERROR'
    err.body = json
    throw err
  }

  return {
    id: session.id,
    checkoutUrl,
    referenceNumber: session.attributes?.reference_number || referenceNumber,
  }
}

/**
 * Normalize PayMongo webhook payload shapes (classic + checkout session).
 */
function normalizeWebhookEvent(payload) {
  // Hosted Checkout style: { data: { type: 'checkout_session.payment.paid', data: { id, attributes } } }
  if (payload?.data?.type && String(payload.data.type).includes('.')) {
    return {
      eventId:   payload.data.id || payload.id || `${payload.data.type}:${payload.data.created_at || Date.now()}`,
      eventType: payload.data.type,
      resource:  payload.data.data || null,
    }
  }

  // Classic: { data: { id: 'evt_…', attributes: { type, data } } }
  if (payload?.data?.attributes?.type) {
    return {
      eventId:   payload.data.id,
      eventType: payload.data.attributes.type,
      resource:  payload.data.attributes.data || null,
    }
  }

  // Flat / test payloads
  return {
    eventId:   payload?.data?.id || payload?.id,
    eventType: payload?.type,
    resource:  payload?.data || null,
  }
}

/**
 * Resolve the provider payment id we stored in payment_ledger.
 * Prefer checkout session id (cs_…); fall back to reference_number / payment id.
 */
function resolveProviderPaymentId(resource) {
  if (!resource) return null
  if (typeof resource === 'string') return resource

  const attrs = resource.attributes || {}
  return (
    resource.id
    || attrs.external_reference_number
    || attrs.reference_number
    || null
  )
}

module.exports = {
  createCheckoutSession,
  normalizeWebhookEvent,
  resolveProviderPaymentId,
  membershipReturnUrls,
}
