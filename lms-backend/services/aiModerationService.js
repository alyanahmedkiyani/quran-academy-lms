'use strict';

const ModerationAlert = require('../models/ModerationAlert');
const Notification = require('../models/Notifications');
const Admin = require('../models/Admin');

const AI_MODERATION_URL = process.env.AI_MODERATION_URL || 'http://localhost:8000';
const AI_MODERATION_ENABLED = process.env.AI_MODERATION_ENABLED !== 'false';

let isServiceDownLogged = false;

/**
 * Call the Python AI moderation service to check text for PII & unauthorized solicitations.
 * Non-blocking, fails safely without interrupting chat or class operations.
 */
async function checkText(text, metadata = {}) {
  if (!AI_MODERATION_ENABLED || !text || typeof text !== 'string' || !text.trim()) {
    return { alert: false };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 2000); // 2 second max timeout

  try {
    const res = await fetch(`${AI_MODERATION_URL}/api/moderation/check-text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        senderId: metadata.senderId,
        senderType: metadata.senderType,
        senderName: metadata.senderName,
        sessionId: metadata.sessionId,
        roomId: metadata.roomId,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      return { alert: false };
    }

    isServiceDownLogged = false;
    return await res.json();
  } catch (err) {
    clearTimeout(timeoutId);
    if (!isServiceDownLogged) {
      console.warn(`[aiModerationService] AI service unavailable at ${AI_MODERATION_URL}: ${err.message}`);
      isServiceDownLogged = true;
    }
    return { alert: false };
  }
}

/**
 * Save detected violation to ModerationAlerts and broadcast real-time alert to admins.
 */
async function recordAlert({ source = 'chat', text, metadata = {}, result = {}, io = null }) {
  try {
    const alert = await ModerationAlert.create({
      source,
      sessionId: metadata.sessionId ? Number(metadata.sessionId) : null,
      roomId: metadata.roomId || null,
      senderId: metadata.senderId ? Number(metadata.senderId) : null,
      senderType: metadata.senderType || 'student',
      senderName: metadata.senderName || 'Unknown User',
      receiverId: metadata.receiverId ? Number(metadata.receiverId) : null,
      receiverType: metadata.receiverType || null,
      category: result.category || 'personal_information',
      riskLevel: result.risk_level || 'medium',
      intent: result.intent || 'Policy violation detected',
      text: text,
      confidence: result.confidence || 0.0,
      findings: JSON.stringify(result.findings || []),
      clipUrl: metadata.clipUrl || null,
      clipSha256: metadata.clipSha256 || null,
      status: 'pending',
    });

    // Create Notification records for all registered admins
    const notifTitle = `AI Moderation Alert: ${(result.category || 'Warning').replace(/_/g, ' ').toUpperCase()}`;
    const notifMsg = `[${metadata.senderName || 'User'} (${metadata.senderType || ''})] in ${source}: "${text.slice(0, 160)}"`;

    try {
      const allAdmins = await Admin.findAll({ attributes: ['id'] });
      const adminList = allAdmins && allAdmins.length > 0 ? allAdmins : [{ id: 1 }];

      let firstNotif = null;
      for (const admin of adminList) {
        const notif = await Notification.create({
          userId: admin.id,
          userType: 'admin',
          title: notifTitle,
          message: notifMsg,
          priority: result.risk_level === 'high' ? 'critical' : 'warning',
        });
        if (!firstNotif) firstNotif = notif;
      }

      if (io) {
        // Emit real-time alert ONLY to authenticated admin sockets in 'admins' room
        io.to('admins').emit('aiModerationAlert', alert.toJSON());
        if (firstNotif) {
          io.to('admins').emit('newNotification', firstNotif.toJSON());
        }
      }
    } catch (notifErr) {
      console.error('[aiModerationService] Error creating notification:', notifErr.message);
    }

    console.log(`[aiModerationService] Alert recorded [${alert.id}] Category: ${alert.category} (${alert.riskLevel}) by ${metadata.senderName}`);
    return alert;
  } catch (err) {
    console.error('[aiModerationService] Error saving alert:', err.message);
    return null;
  }
}

/**
 * Convenience helper to inspect incoming chat messages asynchronously.
 */
function inspectMessage(messageText, metadata = {}, io = null) {
  setImmediate(async () => {
    try {
      const res = await checkText(messageText, metadata);
      if (res && res.alert) {
        await recordAlert({
          source: 'chat',
          text: messageText,
          metadata,
          result: res,
          io,
        });
      }
    } catch (e) {
      console.error('[aiModerationService] inspectMessage error:', e.message);
    }
  });
}

module.exports = {
  checkText,
  recordAlert,
  inspectMessage,
};
