'use strict';

const ModerationAlert = require('../models/ModerationAlert');
const Notification = require('../models/Notifications');
const Admin = require('../models/Admin');
const ClassSession = require('../models/ClassSession');
const { Op } = require('sequelize');

const LMS_WEBHOOK_SECRET = process.env.LMS_WEBHOOK_SECRET || 'qalms_ai_webhook_secret_key';
const AI_MODERATION_URL = process.env.AI_MODERATION_URL || 'http://localhost:8000';

/**
 * GET /api/admin/moderation/alerts
 * Filterable, paginated list of moderation alerts.
 */
exports.getAlerts = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;

    const where = {};
    if (req.query.status) where.status = req.query.status;
    if (req.query.source) where.source = req.query.source;
    if (req.query.riskLevel) where.riskLevel = req.query.riskLevel;
    if (req.query.sessionId) where.sessionId = Number(req.query.sessionId);

    if (req.query.search) {
      where[Op.or] = [
        { text: { [Op.like]: `%${req.query.search}%` } },
        { senderName: { [Op.like]: `%${req.query.search}%` } },
        { category: { [Op.like]: `%${req.query.search}%` } },
      ];
    }

    const { count, rows } = await ModerationAlert.findAndCountAll({
      where,
      limit,
      offset,
      order: [['createdAt', 'DESC']],
      include: [
        { model: Admin, as: 'ReviewedByAdmin', attributes: ['id', 'name', 'username'] },
        { model: ClassSession, as: 'Session', attributes: ['id', 'roomId', 'date', 'startTime', 'endTime'] },
      ],
    });

    return res.json({
      total: count,
      page,
      totalPages: Math.ceil(count / limit),
      alerts: rows,
    });
  } catch (err) {
    console.error('[moderationController.getAlerts] Error:', err);
    return res.status(500).json({ message: 'Server error retrieving alerts', error: err.message });
  }
};

/**
 * GET /api/admin/moderation/alerts/:id
 */
exports.getAlertById = async (req, res) => {
  try {
    const { id } = req.params;
    const alert = await ModerationAlert.findByPk(id, {
      include: [
        { model: Admin, as: 'ReviewedByAdmin', attributes: ['id', 'name', 'username'] },
        { model: ClassSession, as: 'Session', attributes: ['id', 'roomId', 'date', 'startTime', 'endTime'] },
      ],
    });

    if (!alert) {
      return res.status(404).json({ message: 'Moderation alert not found' });
    }

    return res.json({ alert });
  } catch (err) {
    console.error('[moderationController.getAlertById] Error:', err);
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
};

/**
 * PATCH /api/admin/moderation/alerts/:id/review
 * Admin marks alert status and adds notes.
 */
exports.reviewAlert = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, reviewNote } = req.body;

    const allowedStatuses = ['reviewed', 'false_alarm', 'action_taken', 'pending'];
    if (!status || !allowedStatuses.includes(status)) {
      return res.status(400).json({ message: `Status must be one of: ${allowedStatuses.join(', ')}` });
    }

    const alert = await ModerationAlert.findByPk(id);
    if (!alert) {
      return res.status(404).json({ message: 'Moderation alert not found' });
    }

    await alert.update({
      status,
      reviewNote: reviewNote || alert.reviewNote,
      reviewedBy: req.userId || null,
      reviewedAt: new Date(),
    });

    return res.json({ message: 'Alert reviewed successfully', alert });
  } catch (err) {
    console.error('[moderationController.reviewAlert] Error:', err);
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
};

/**
 * GET /api/admin/moderation/stats
 * Dashboard overview numbers.
 */
exports.getStats = async (req, res) => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [total, pending, highRisk, todayCount, chatCount, voiceCount] = await Promise.all([
      ModerationAlert.count(),
      ModerationAlert.count({ where: { status: 'pending' } }),
      ModerationAlert.count({ where: { riskLevel: 'high' } }),
      ModerationAlert.count({ where: { createdAt: { [Op.gte]: todayStart } } }),
      ModerationAlert.count({ where: { source: 'chat' } }),
      ModerationAlert.count({ where: { source: 'voice' } }),
    ]);

    return res.json({
      total,
      pending,
      highRisk,
      todayCount,
      chatCount,
      voiceCount,
    });
  } catch (err) {
    console.error('[moderationController.getStats] Error:', err);
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
};

/**
 * POST /api/admin/moderation/webhook
 * Webhook endpoint for the AI voice moderation service to report live audio alerts.
 */
exports.receiveVoiceAlertWebhook = async (req, res) => {
  try {
    const secret = req.headers['x-ai-webhook-secret'] || req.body.secret;
    if (secret !== LMS_WEBHOOK_SECRET) {
      return res.status(401).json({ message: 'Invalid webhook secret' });
    }

    const {
      sessionId,
      roomId,
      speakerId,
      speakerType,
      speakerName,
      category,
      riskLevel,
      intent,
      text,
      confidence,
      findings,
      clipUrl,
      clipSha256,
    } = req.body;

    const alert = await ModerationAlert.create({
      source: 'voice',
      sessionId: sessionId ? Number(sessionId) : null,
      roomId: roomId || null,
      senderId: speakerId ? Number(speakerId) : null,
      senderType: speakerType || 'student',
      senderName: speakerName || 'Class Participant',
      category: category || 'personal_information',
      riskLevel: riskLevel || 'high',
      intent: intent || 'Personal info shared via voice',
      text: text || '',
      confidence: confidence || 0.8,
      findings: typeof findings === 'object' ? JSON.stringify(findings) : (findings || null),
      clipUrl: clipUrl || null,
      clipSha256: clipSha256 || null,
      status: 'pending',
    });

    // Notify admins via socket and database notification
    try {
      const io = await require('../socket').getIO();
      const allAdmins = await Admin.findAll({ attributes: ['id'] });
      const adminList = allAdmins && allAdmins.length > 0 ? allAdmins : [{ id: 1 }];

      const notifTitle = `VOICE Moderation Alert: ${(category || 'VIOLATION').replace(/_/g, ' ').toUpperCase()}`;
      const notifMsg = `[${speakerName || 'Speaker'} (${speakerType || ''})] in session ${sessionId || roomId || ''}: "${(text || '').slice(0, 160)}"`;

      let firstNotif = null;
      for (const admin of adminList) {
        const notif = await Notification.create({
          userId: admin.id,
          userType: 'admin',
          title: notifTitle,
          message: notifMsg,
          priority: 'critical',
        });
        if (!firstNotif) firstNotif = notif;
      }

      if (io) {
        // Broadcast strictly to admins room
        io.to('admins').emit('aiModerationAlert', alert.toJSON());
        if (firstNotif) {
          io.to('admins').emit('newNotification', firstNotif.toJSON());
        }
      }
    } catch (notifErr) {
      console.warn('[receiveVoiceAlertWebhook] Socket/Notification delivery warning:', notifErr.message);
    }

    return res.status(201).json({ message: 'Voice alert recorded', alertId: alert.id });
  } catch (err) {
    console.error('[receiveVoiceAlertWebhook] Error:', err);
    return res.status(500).json({ message: 'Webhook processing error', error: err.message });
  }
};

/**
 * GET /api/admin/moderation/clips/:id
 * Securely proxy audio clips from AI service.
 */
exports.streamClip = async (req, res) => {
  try {
    const { id } = req.params;
    const alert = await ModerationAlert.findByPk(id);
    if (!alert || !alert.clipUrl) {
      return res.status(404).json({ message: 'Audio clip not found for this alert' });
    }

    const clipResponse = await fetch(alert.clipUrl);
    if (!clipResponse.ok) {
      return res.status(404).json({ message: 'Clip file unavailable' });
    }

    res.setHeader('Content-Type', 'audio/wav');
    const arrayBuffer = await clipResponse.arrayBuffer();
    return res.send(Buffer.from(arrayBuffer));
  } catch (err) {
    console.error('[streamClip] Error:', err);
    return res.status(500).json({ message: 'Error streaming clip', error: err.message });
  }
};
