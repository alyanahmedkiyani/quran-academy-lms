'use strict';

const express = require('express');
const router = express.Router();
const moderationController = require('../controllers/moderationController');
const isAuth = require('../middleware/is-auth');

// Middleware to ensure user is admin
const requireAdmin = (req, res, next) => {
  if (req.userType !== 'admin') {
    return res.status(403).json({ message: 'Access denied: Admin role required.' });
  }
  next();
};

// Webhook from AI voice service (secret-token protected, no user session needed)
router.post('/webhook', moderationController.receiveVoiceAlertWebhook);

// Admin-protected moderation endpoints
router.get('/alerts', isAuth, requireAdmin, moderationController.getAlerts);
router.get('/stats', isAuth, requireAdmin, moderationController.getStats);
router.get('/alerts/:id', isAuth, requireAdmin, moderationController.getAlertById);
router.patch('/alerts/:id/review', isAuth, requireAdmin, moderationController.reviewAlert);
router.get('/clips/:id', isAuth, requireAdmin, moderationController.streamClip);

module.exports = router;
