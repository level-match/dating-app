const express = require('express')
const { authenticateSupabase } = require('../middleware/supabase-auth')
const matchSvc = require('../services/match.service')

const router = express.Router()

router.use(authenticateSupabase)

/* ─── GET /api/matches ──────────────────────────────────────────
   Curated introductions for the authenticated user.
   Geographic reach and daily delivery are enforced from subscription tier. */
router.get('/matches', async (req, res) => {
  const payload = await matchSvc.getMatchesForUser(req.auth.userId)
  res.json(payload)
})

module.exports = router
