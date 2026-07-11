const express = require('express')
const { authenticateSupabase } = require('../middleware/supabase-auth')
const { isUuid } = require('../utils/uuid')
const matchSvc = require('../services/match.service')

const router = express.Router()

router.use(authenticateSupabase)

function invalidProfileId(res) {
  return res.status(400).json({
    error: 'INVALID_PROFILE_ID',
    message: 'profileId must be a valid UUID.',
  })
}

/* ─── GET /api/matches ──────────────────────────────────────────
   Curated introductions for the authenticated user. */
router.get('/matches', async (req, res) => {
  const payload = await matchSvc.getMatchesForUser(req.auth.userId)
  res.json(payload)
})

/* ─── GET /api/matches/:profileId ───────────────────────────────
   Public profile for a curated match. */
router.get('/matches/:profileId', async (req, res) => {
  if (!isUuid(req.params.profileId)) return invalidProfileId(res)

  const payload = await matchSvc.getMatchProfile(req.auth.userId, req.params.profileId)
  res.json(payload)
})

/* ─── POST /api/matches/:profileId/request ──────────────────────
   Send a connection request (auto-mutual if they already requested you). */
router.post('/matches/:profileId/request', async (req, res) => {
  if (!isUuid(req.params.profileId)) return invalidProfileId(res)

  const result = await matchSvc.sendConnectionRequest(req.auth.userId, req.params.profileId)
  res.status(result.mutual ? 200 : 201).json({
    connection: {
      id: result.connection.id,
      status: result.connection.status,
      mutual: result.mutual,
    },
    profile: result.profile,
    message: result.mutual
      ? 'Connection accepted — you can message each other now.'
      : 'Connection request sent.',
  })
})

/* ─── POST /api/matches/:profileId/accept ───────────────────────
   Accept an incoming connection request. */
router.post('/matches/:profileId/accept', async (req, res) => {
  if (!isUuid(req.params.profileId)) return invalidProfileId(res)

  const result = await matchSvc.acceptConnectionRequest(req.auth.userId, req.params.profileId)
  res.json({
    connection: {
      id: result.connection.id,
      status: result.connection.status,
      mutual: true,
    },
    profile: result.profile,
    message: 'Connection accepted — messaging is now unlocked.',
  })
})

module.exports = router
