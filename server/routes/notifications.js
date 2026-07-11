const express = require('express')
const { authenticateSupabase } = require('../middleware/supabase-auth')
const notificationSvc = require('../services/notification.service')

const router = express.Router()

router.use(authenticateSupabase)

router.get('/notifications/feed', async (req, res) => {
  const payload = await notificationSvc.getNotificationFeed(req.auth.userId)
  res.json(payload)
})

router.post('/notifications/:notificationId/read', async (req, res) => {
  await notificationSvc.markRead(req.auth.userId, req.params.notificationId)
  res.json({ ok: true })
})

router.post('/notifications/read-all', async (req, res) => {
  const feed = await notificationSvc.getNotificationFeed(req.auth.userId)
  const ids = (feed.notifications || []).map(n => n.id)
  await notificationSvc.markAllRead(req.auth.userId, ids)
  res.json({ ok: true, marked: ids.length })
})

module.exports = router
