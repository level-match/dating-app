const express = require('express')
const { authenticateSupabase } = require('../middleware/supabase-auth')
const { isUuid } = require('../utils/uuid')
const chatSvc = require('../services/chat.service')

const router = express.Router()

router.use(authenticateSupabase)

function invalidConnectionId(res) {
  return res.status(400).json({
    error: 'INVALID_CONNECTION_ID',
    message: 'connectionId must be a valid UUID.',
  })
}

/* ─── GET /api/chat/inbox ───────────────────────────────────────
   Conversations, pending requests, and last-message previews. */
router.get('/chat/inbox', async (req, res) => {
  const payload = await chatSvc.getInbox(req.auth.userId)
  res.json(payload)
})

/* ─── GET /api/chat/connections/:connectionId/messages ──────────
   Message history for an accepted connection. */
router.get('/chat/connections/:connectionId/messages', async (req, res) => {
  if (!isUuid(req.params.connectionId)) return invalidConnectionId(res)

  const payload = await chatSvc.getMessages(req.params.connectionId, req.auth.userId)
  res.json(payload)
})

/* ─── POST /api/chat/connections/:connectionId/messages ─────────
   Send a message on an accepted connection. */
router.post('/chat/connections/:connectionId/messages', async (req, res) => {
  if (!isUuid(req.params.connectionId)) return invalidConnectionId(res)

  const result = await chatSvc.sendMessage(
    req.params.connectionId,
    req.auth.userId,
    req.body?.body ?? req.body?.text ?? req.body?.message,
  )
  res.status(201).json(result)
})

module.exports = router
