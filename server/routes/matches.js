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

/* ─── GET /api/matches/eligibility ──────────────────────────────
   Server-authoritative intent + alignment eligibility. */
router.get('/matches/eligibility', async (req, res) => {
  const payload = await matchSvc.getMatchingEligibility(req.auth.userId)
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

/* ─── POST /api/matches/:profileId/decline ───────────────────────
   Decline an incoming connection request. */
router.post('/matches/:profileId/decline', async (req, res) => {
  if (!isUuid(req.params.profileId)) return invalidProfileId(res)

  const result = await matchSvc.declineConnectionRequest(req.auth.userId, req.params.profileId)
  res.json({
    connection: {
      id: result.connection.id,
      status: result.connection.status,
    },
    message: 'Connection request declined.',
  })
})

/* ─── POST /api/matches/:profileId/withdraw ─────────────────────
   Withdraw an outgoing connection request. */
router.post('/matches/:profileId/withdraw', async (req, res) => {
  if (!isUuid(req.params.profileId)) return invalidProfileId(res)

  const result = await matchSvc.withdrawConnectionRequest(req.auth.userId, req.params.profileId)
  res.json({
    connection: {
      id: result.connection.id,
      status: result.connection.status,
    },
    message: 'Connection request withdrawn.',
  })
})

/* ─── POST /api/matches/:profileId/pass ─────────────────────────
   Pass on a curated match (excluded from future discovery). */
router.post('/matches/:profileId/pass', async (req, res) => {
  if (!isUuid(req.params.profileId)) return invalidProfileId(res)

  const result = await matchSvc.passMatchProfile(req.auth.userId, req.params.profileId)
  res.json({
    ok: result.ok,
    profileId: result.profileId,
    message: 'Profile passed — it will not appear in your queue again.',
  })
})

module.exports = router
