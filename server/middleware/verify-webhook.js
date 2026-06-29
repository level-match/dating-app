const crypto = require('crypto')

/* ─── Raw body capture ───────────────────────────────────────────
   Must run BEFORE express.json() on webhook routes. We need the raw
   request body string to recompute the HMAC — once JSON.parse() has
   run, the original byte stream is gone and signature verification fails. */
function rawBodySaver(req, res, next) {
  let data = ''
  req.setEncoding('utf8')
  req.on('data', chunk => { data += chunk })
  req.on('end', () => {
    req.rawBody = data
    next()
  })
}

/* ─── PayMongo webhook verification ─────────────────────────────
   Header: Paymongo-Signature
   Format: "t=<unix_timestamp>,te=<hmac_test>,li=<hmac_live>"
   HMAC:   SHA-256 of "<timestamp>.<rawBody>" using the webhook secret.
   Docs:   https://developers.paymongo.com/docs/webhooks-2 */
function verifyPayMongoWebhook(req, res, next) {
  const sigHeader = req.headers['paymongo-signature']
  if (!sigHeader) {
    return res.status(400).json({ error: 'MISSING_SIGNATURE', message: 'No Paymongo-Signature header.' })
  }

  const parts = Object.fromEntries(
    sigHeader.split(',').map(pair => {
      const idx = pair.indexOf('=')
      return [pair.slice(0, idx).trim(), pair.slice(idx + 1).trim()]
    })
  )
  const timestamp    = parts['t']
  const receivedHmac = parts['li'] || parts['te'] // prefer live; fall back to test

  if (!timestamp || !receivedHmac) {
    return res.status(400).json({ error: 'MALFORMED_SIGNATURE', message: 'Paymongo-Signature header is malformed.' })
  }

  // Reject stale webhooks (> 5 minutes old) to reduce replay window
  const ageSeconds = Math.abs(Date.now() / 1000 - Number(timestamp))
  if (ageSeconds > 300) {
    return res.status(400).json({ error: 'STALE_WEBHOOK', message: 'Webhook timestamp is too old.' })
  }

  const expected = crypto
    .createHmac('sha256', process.env.PAYMONGO_WEBHOOK_SECRET)
    .update(`${timestamp}.${req.rawBody}`)
    .digest('hex')

  if (!timingSafeCompare(expected, receivedHmac)) {
    return res.status(401).json({ error: 'INVALID_SIGNATURE', message: 'Paymongo webhook signature mismatch.' })
  }

  req.webhookPayload = JSON.parse(req.rawBody)
  next()
}

/* ─── Stripe webhook verification ───────────────────────────────
   Header: Stripe-Signature
   Format: "t=<unix_timestamp>,v1=<hmac_sha256>"
   HMAC:   SHA-256 of "<timestamp>.<rawBody>" using the endpoint secret.
   Docs:   https://stripe.com/docs/webhooks/signatures */
function verifyStripeWebhook(req, res, next) {
  const sigHeader = req.headers['stripe-signature']
  if (!sigHeader) {
    return res.status(400).json({ error: 'MISSING_SIGNATURE', message: 'No Stripe-Signature header.' })
  }

  const parts = Object.fromEntries(
    sigHeader.split(',').map(pair => {
      const idx = pair.indexOf('=')
      return [pair.slice(0, idx).trim(), pair.slice(idx + 1).trim()]
    })
  )
  const timestamp    = parts['t']
  const receivedHmac = parts['v1']

  if (!timestamp || !receivedHmac) {
    return res.status(400).json({ error: 'MALFORMED_SIGNATURE', message: 'Stripe-Signature header is malformed.' })
  }

  const ageSeconds = Math.abs(Date.now() / 1000 - Number(timestamp))
  if (ageSeconds > 300) {
    return res.status(400).json({ error: 'STALE_WEBHOOK', message: 'Stripe webhook timestamp is too old.' })
  }

  const expected = crypto
    .createHmac('sha256', process.env.STRIPE_WEBHOOK_SECRET)
    .update(`${timestamp}.${req.rawBody}`)
    .digest('hex')

  if (!timingSafeCompare(expected, receivedHmac)) {
    return res.status(401).json({ error: 'INVALID_SIGNATURE', message: 'Stripe webhook signature mismatch.' })
  }

  req.webhookPayload = JSON.parse(req.rawBody)
  next()
}

/* Timing-safe hex string comparison — prevents timing oracle attacks */
function timingSafeCompare(a, b) {
  try {
    return crypto.timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'))
  } catch {
    return false // length mismatch or invalid hex
  }
}

module.exports = { rawBodySaver, verifyPayMongoWebhook, verifyStripeWebhook }
