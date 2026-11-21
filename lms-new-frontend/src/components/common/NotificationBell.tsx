"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { io, Socket } from "socket.io-client";
import { useAppDispatch, useAppSelector } from "@/core/redux/hooks";
import {
  setNotifications,
  addNotification,
  markRead,
  markAllRead,
  removeNotification,
} from "@/core/redux/notificationSlice";
import { markConversationRead } from "@/core/redux/chatSlice";
import {
  fetchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
} from "@/services/notificationService";
import { socket_url } from "@/environment";
import { AppNotification, NotificationPriority } from "@/types/notification";
import Link from "next/link";
import { all_routes } from "@/routes/all_routes";

// ── Priority config ────────────────────────────────────────────────────────────

interface PriorityConfig {
  label: string;
  color: string;         // badge/text color CSS value
  bgRow: string;         // unread row bg
  bgRowRead: string;     // read row bg
  borderLeft: string;    // left-border accent
  iconBg: string;        // icon circle bg
  badgeCls: string;      // Bootstrap badge class
  pillBg: string;        // section header pill bg
  pillColor: string;
}

const PRIORITY: Record<NotificationPriority, PriorityConfig> = {
  critical: {
    label: "Critical",
    color: "#dc3545",
    bgRow: "#fff5f5",
    bgRowRead: "#fff",
    borderLeft: "3px solid #dc3545",
    iconBg: "rgba(220,53,69,0.10)",
    badgeCls: "bg-danger",
    pillBg: "#dc3545",
    pillColor: "#fff",
  },
  warning: {
    label: "Warning",
    color: "#fd7e14",
    bgRow: "#fffaf3",
    bgRowRead: "#fff",
    borderLeft: "3px solid #fd7e14",
    iconBg: "rgba(253,126,20,0.10)",
    badgeCls: "bg-warning",
    pillBg: "#fd7e14",
    pillColor: "#fff",
  },
  info: {
    label: "Info",
    color: "#0d6efd",
    bgRow: "#f5f8ff",
    bgRowRead: "#fff",
    borderLeft: "3px solid #0d6efd",
    iconBg: "rgba(13,110,253,0.08)",
    badgeCls: "bg-primary",
    pillBg: "#0d6efd",
    pillColor: "#fff",
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const roleToUserType = (roleName?: string): string | null => {
  if (!roleName) return null;
  if (roleName === "SUPER_ADMIN" || roleName === "ADMIN") return "admin";
  if (roleName === "TEACHER") return "teacher";
  if (roleName === "STUDENT") return "student";
  if (roleName === "PARENT") return "parent";
  return null;
};

const timeAgo = (dateStr: string): string => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

const iconForTitle = (title: string, priority: NotificationPriority): string => {
  const t = title.toLowerCase();
  if (priority === "critical") {
    if (t.includes("brute") || t.includes("attack") || t.includes("attempt")) return "ti ti-shield-lock";
    if (t.includes("no-show") || t.includes("no show")) return "ti ti-user-off";
    if (t.includes("permission") || t.includes("role")) return "ti ti-lock";
    return "ti ti-alert-octagon";
  }
  if (priority === "warning") {
    if (t.includes("overdue")) return "ti ti-clock-exclamation";
    if (t.includes("stale") || t.includes("pending")) return "ti ti-hourglass";
    if (t.includes("auto-ended") || t.includes("auto ended")) return "ti ti-video-off";
    if (t.includes("late") || t.includes("checkout")) return "ti ti-user-exclamation";
    if (t.includes("rating") || t.includes("feedback")) return "ti ti-star-off";
    if (t.includes("cancelled")) return "ti ti-ban";
    if (t.includes("revoke")) return "ti ti-certificate-off";
    return "ti ti-alert-triangle";
  }
  // info
  if (t.includes("assignment")) return "ti ti-clipboard-text";
  if (t.includes("quiz")) return "ti ti-help-circle";
  if (t.includes("grade") || t.includes("graded")) return "ti ti-star";
  if (t.includes("class") || t.includes("session")) return "ti ti-video";
  if (t.includes("approved")) return "ti ti-circle-check";
  if (t.includes("rejected")) return "ti ti-circle-x";
  if (t.includes("plan") || t.includes("upgrade")) return "ti ti-package";
  if (t.includes("certificate")) return "ti ti-certificate";
  return "ti ti-bell";
};

const resolvePriority = (n: AppNotification): NotificationPriority =>
  n.priority ?? "info";

// ── Single notification row ────────────────────────────────────────────────────

interface NotifRowProps {
  n: AppNotification;
  onRead: (id: number) => void;
  onDelete: (e: React.MouseEvent, id: number) => void;
}

const NotifRow = ({ n, onRead, onDelete }: NotifRowProps) => {
  const priority = resolvePriority(n);
  const cfg = PRIORITY[priority];
  const icon = iconForTitle(n.title, priority);

  return (
    <div
      className="d-flex align-items-start gap-3 px-3 py-2 border-bottom notification-item"
      style={{
        cursor: "pointer",
        background: !n.isRead ? cfg.bgRow : cfg.bgRowRead,
        borderLeft: !n.isRead ? cfg.borderLeft : "3px solid transparent",
        transition: "background 0.2s",
      }}
      onClick={() => !n.isRead && onRead(n.id)}
    >
      {/* Priority icon */}
      <div
        className="d-flex align-items-center justify-content-center flex-shrink-0 rounded-circle"
        style={{ width: 36, height: 36, background: cfg.iconBg }}
      >
        <i className={`${icon} fs-16`} style={{ color: cfg.color }} />
      </div>

      {/* Content */}
      <div className="flex-grow-1 overflow-hidden">
        <div className="d-flex align-items-center gap-1 mb-0">
          <p className="mb-0 fw-semibold" style={{ fontSize: 13, color: !n.isRead ? "#1a1a2e" : "#6c757d" }}>
            {n.title}
          </p>
          {priority !== "info" && (
            <span
              className="badge rounded-pill ms-1"
              style={{ fontSize: 9, background: cfg.pillBg, color: cfg.pillColor, padding: "2px 6px" }}
            >
              {cfg.label}
            </span>
          )}
        </div>
        <p className="mb-0" style={{ fontSize: 12, lineHeight: 1.4, color: "#6c757d" }}>
          {n.message}
        </p>
        <span style={{ fontSize: 11, color: "#adb5bd" }}>
          <i className="ti ti-clock me-1" />
          {timeAgo(n.createdAt)}
        </span>
      </div>

      {/* Actions */}
      <div className="d-flex flex-column align-items-center gap-1 flex-shrink-0">
        {!n.isRead && (
          <span
            title="Unread"
            style={{ width: 8, height: 8, borderRadius: "50%", background: cfg.color, display: "block", flexShrink: 0 }}
          />
        )}
        <button
          type="button"
          className="btn btn-sm p-0"
          style={{ lineHeight: 1, color: "#adb5bd" }}
          title="Dismiss"
          onClick={(e) => onDelete(e, n.id)}
        >
          <i className="ti ti-x fs-12" />
        </button>
      </div>
    </div>
  );
};

// ── Section header ─────────────────────────────────────────────────────────────

const SectionHeader = ({ priority, count }: { priority: NotificationPriority; count: number }) => {
  const cfg = PRIORITY[priority];
  return (
    <div
      className="d-flex align-items-center gap-2 px-3 py-1"
      style={{ background: "#f8f9fa", borderBottom: "1px solid #e9ecef" }}
    >
      <span
        className="rounded-pill d-inline-flex align-items-center gap-1"
        style={{ background: cfg.pillBg, color: cfg.pillColor, fontSize: 10, fontWeight: 700, padding: "2px 8px" }}
      >
        {priority === "critical" && <i className="ti ti-alert-octagon" style={{ fontSize: 10 }} />}
        {priority === "warning"  && <i className="ti ti-alert-triangle" style={{ fontSize: 10 }} />}
        {priority === "info"     && <i className="ti ti-info-circle" style={{ fontSize: 10 }} />}
        {cfg.label.toUpperCase()}
      </span>
      <span style={{ fontSize: 11, color: "#6c757d" }}>{count} notification{count !== 1 ? "s" : ""}</span>
    </div>
  );
};

// ── Main Component ─────────────────────────────────────────────────────────────

export default function NotificationBell() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const { items, unreadCount } = useAppSelector((s) => s.notifications);
  const chatUnreadCounts = useAppSelector((s) => s.chat?.unreadCounts ?? {});
  const totalChatUnread: number = Object.values(chatUnreadCounts as Record<string, number>).reduce((s, n) => s + n, 0);
  const totalBadge = unreadCount + totalChatUnread;
  const socketRef = useRef<Socket | null>(null);
  const [activeTab, setActiveTab] = useState<"all" | NotificationPriority>("all");

  const userId = user?.id ? String(user.id) : null;
  const userType = roleToUserType(user?.role?.name);

  const load = useCallback(async () => {
    if (!userId || !userType) return;
    try {
      const res = await fetchNotifications(userId, userType);
      dispatch(setNotifications(res));
    } catch { /* non-fatal */ }
  }, [userId, userType, dispatch]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!userId || !userType) return;
    const sock = io(socket_url, { transports: ["websocket"], autoConnect: true });
    socketRef.current = sock;
    sock.on("newNotification", (notification: AppNotification) => {
      if (String(notification.userId) === userId && notification.userType === userType) {
        dispatch(addNotification(notification));
      }
    });
    return () => { sock.disconnect(); socketRef.current = null; };
  }, [userId, userType, dispatch]);

  const handleMarkRead = async (id: number) => {
    dispatch(markRead(id));
    try { await markNotificationRead(id); } catch { /* non-fatal */ }
  };

  const handleMarkAllRead = async () => {
    if (!userId || !userType) return;
    dispatch(markAllRead());
    try { await markAllNotificationsRead(userId, userType); } catch { /* non-fatal */ }
  };

  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    dispatch(removeNotification(id));
    try { await deleteNotification(id); } catch { /* non-fatal */ }
  };

  const handleClearChatUnread = () => {
    Object.keys(chatUnreadCounts).forEach((conversationId) => {
      dispatch(markConversationRead(conversationId));
    });
  };

  // Group by priority
  const grouped: Record<NotificationPriority, AppNotification[]> = {
    critical: items.filter((n) => resolvePriority(n) === "critical"),
    warning:  items.filter((n) => resolvePriority(n) === "warning"),
    info:     items.filter((n) => resolvePriority(n) === "info"),
  };

  const displayedItems =
    activeTab === "all"
      ? [
          ...grouped.critical,
          ...grouped.warning,
          ...grouped.info,
        ]
      : grouped[activeTab];

  const criticalUnread = grouped.critical.filter((n) => !n.isRead).length;
  const warningUnread  = grouped.warning.filter((n) => !n.isRead).length;

  // Bell color: red if any critical unread, orange if warning, default otherwise
  const bellColor = criticalUnread > 0 ? "#dc3545" : warningUnread > 0 ? "#fd7e14" : undefined;

  const TAB_OPTIONS: { key: "all" | NotificationPriority; label: string; count: number; color?: string }[] = [
    { key: "all",      label: "All",      count: items.length },
    { key: "critical", label: "Critical", count: grouped.critical.length, color: "#dc3545" },
    { key: "warning",  label: "Warning",  count: grouped.warning.length,  color: "#fd7e14" },
    { key: "info",     label: "Info",     count: grouped.info.length,     color: "#0d6efd" },
  ];

  return (
    <div className="dropdown me-3">
      <button
        className="topbar-link btn btn-icon dropdown-toggle drop-arrow-none position-relative"
        data-bs-toggle="dropdown"
        data-bs-offset="0,24"
        data-bs-auto-close="outside"
        type="button"
        aria-haspopup="false"
        aria-expanded="false"
        onClick={load}
      >
        <i className="ti ti-bell fs-16 animate-ring" style={bellColor ? { color: bellColor } : undefined} />
        {totalBadge > 0 && (
          <span
            className="position-absolute top-0 start-100 translate-middle badge rounded-pill"
            style={{
              fontSize: 10,
              minWidth: 16,
              padding: "2px 5px",
              background: criticalUnread > 0 ? "#dc3545" : warningUnread > 0 ? "#fd7e14" : "#0d6efd",
            }}
          >
            {totalBadge > 99 ? "99+" : totalBadge}
          </span>
        )}
      </button>

      <div
        className="dropdown-menu p-0 dropdown-menu-end dropdown-menu-lg"
        style={{ minWidth: 360, maxWidth: 400, background: "#fff", color: "#212529" }}
      >
        {/* Header */}
        <div className="p-3 border-bottom d-flex align-items-center justify-content-between" style={{ background: "#fff" }}>
          <h6 className="mb-0 fw-bold fs-15" style={{ color: "#212529" }}>
            Notifications
            {unreadCount > 0 && (
              <span
                className="badge ms-2 rounded-pill"
                style={{
                  fontSize: 11,
                  background: criticalUnread > 0 ? "#dc3545" : warningUnread > 0 ? "#fd7e14" : "#0d6efd",
                }}
              >
                {unreadCount}
              </span>
            )}
          </h6>
          {unreadCount > 0 && (
            <button
              type="button"
              className="btn btn-link btn-sm p-0 text-decoration-none"
              style={{ fontSize: 12, color: "#0d6efd" }}
              onClick={handleMarkAllRead}
            >
              Mark all read
            </button>
          )}
        </div>

        {/* Critical banner — shown only if there are unread critical alerts */}
        {criticalUnread > 0 && (
          <div
            className="d-flex align-items-center gap-2 px-3 py-2"
            style={{ background: "#fff5f5", borderBottom: "1px solid #f5c6cb" }}
          >
            <i className="ti ti-alert-octagon text-danger fs-16" />
            <span style={{ fontSize: 12, color: "#842029", fontWeight: 600 }}>
              {criticalUnread} critical alert{criticalUnread > 1 ? "s" : ""} require{criticalUnread === 1 ? "s" : ""} your attention
            </span>
          </div>
        )}

        {/* Chat messages banner */}
        {totalChatUnread > 0 && (
          <Link
            href={all_routes.chat}
            className="d-flex align-items-center gap-2 px-3 py-2 text-decoration-none"
            style={{ background: "#f0f7ff", borderBottom: "1px solid #bee3f8" }}
            onClick={handleClearChatUnread}
          >
            <i className="ti ti-message-circle fs-16" style={{ color: "#0d6efd" }} />
            <span style={{ fontSize: 12, color: "#1e40af", fontWeight: 600 }}>
              {totalChatUnread} unread message{totalChatUnread > 1 ? "s" : ""}
            </span>
            <span className="ms-auto" style={{ fontSize: 11, color: "#3b82f6" }}>
              Go to chat <i className="ti ti-arrow-right" style={{ fontSize: 10 }} />
            </span>
          </Link>
        )}

        {/* Priority tabs */}
        <div className="d-flex border-bottom" style={{ background: "#f8f9fa" }}>
          {TAB_OPTIONS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              style={{
                flex: 1,
                border: "none",
                borderBottom: activeTab === tab.key ? `2px solid ${tab.color ?? "#495057"}` : "2px solid transparent",
                background: "transparent",
                padding: "8px 4px",
                fontSize: 11,
                fontWeight: activeTab === tab.key ? 700 : 500,
                color: activeTab === tab.key ? (tab.color ?? "#495057") : "#6c757d",
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              {tab.label}
              {tab.count > 0 && (
                <span
                  className="badge rounded-pill ms-1"
                  style={{
                    fontSize: 9,
                    background: activeTab === tab.key ? (tab.color ?? "#495057") : "#dee2e6",
                    color: activeTab === tab.key ? "#fff" : "#495057",
                    padding: "2px 5px",
                  }}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Body */}
        <div style={{ maxHeight: 380, overflowY: "auto", background: "#fff" }} className="notification-body">
          {displayedItems.length === 0 ? (
            <div className="text-center py-5 px-3">
              <i className="ti ti-bell-off fs-36 d-block mb-2" style={{ color: "#adb5bd" }} />
              <p className="mb-0" style={{ fontSize: 13, color: "#6c757d" }}>
                {activeTab === "all" ? "You're all caught up!" : `No ${activeTab} notifications`}
              </p>
            </div>
          ) : activeTab === "all" ? (
            // Grouped view
            (["critical", "warning", "info"] as NotificationPriority[]).map((p) =>
              grouped[p].length === 0 ? null : (
                <div key={p}>
                  <SectionHeader priority={p} count={grouped[p].length} />
                  {grouped[p].map((n) => (
                    <NotifRow key={n.id} n={n} onRead={handleMarkRead} onDelete={handleDelete} />
                  ))}
                </div>
              )
            )
          ) : (
            displayedItems.map((n) => (
              <NotifRow key={n.id} n={n} onRead={handleMarkRead} onDelete={handleDelete} />
            ))
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="p-2 border-top d-flex align-items-center justify-content-between" style={{ background: "#f8f9fa" }}>
            <button
              type="button"
              className="btn btn-link btn-sm text-decoration-none p-0"
              style={{ fontSize: 12, color: "#6c757d" }}
              onClick={handleMarkAllRead}
            >
              Clear all
            </button>
            <span style={{ fontSize: 11, color: "#adb5bd" }}>
              {items.length} total
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
