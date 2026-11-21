const { DataTypes } = require("sequelize");
const sequelize = require("../utils/database");

const ModerationAlert = sequelize.define("ModerationAlert", {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  source: {
    type: DataTypes.ENUM("chat", "voice"),
    allowNull: false,
    defaultValue: "chat",
  },
  sessionId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  roomId: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  senderId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  senderType: {
    type: DataTypes.ENUM("teacher", "student", "admin", "parent"),
    allowNull: true,
  },
  senderName: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  receiverId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  receiverType: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  category: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: "personal_information",
  },
  riskLevel: {
    type: DataTypes.ENUM("high", "medium", "low", "none_or_contextual"),
    allowNull: false,
    defaultValue: "medium",
  },
  intent: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  text: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  confidence: {
    type: DataTypes.FLOAT,
    defaultValue: 0.0,
  },
  findings: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  clipUrl: {
    type: DataTypes.STRING(1000),
    allowNull: true,
  },
  clipSha256: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM("pending", "reviewed", "false_alarm", "action_taken"),
    allowNull: false,
    defaultValue: "pending",
  },
  reviewNote: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  reviewedBy: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  reviewedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
});

module.exports = ModerationAlert;
