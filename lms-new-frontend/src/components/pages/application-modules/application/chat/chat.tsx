"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { all_routes } from "../../../../../routes/all_routes";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { OverlayScrollbarsComponent } from "overlayscrollbars-react";
import "overlayscrollbars/overlayscrollbars.css";

import { useAppDispatch, useAppSelector } from "@/core/redux/hooks";
import {
  fetchGroupMessagesThunk,
  fetchPrivateMessagesThunk,
  fetchRecentChatsThunk,
  fetchAllUsersThunk,
  fetchChatGroupsThunk,
  fetchCurrentGroupMessagesThunk,
  fetchUnreadCountsThunk,
  setActiveConversation,
  clearActiveConversation,
  markConversationRead,
  setActiveGroupId,
  addChatGroup,
  removeChatGroup,
  updateGroupMemberCount,
} from "@/core/redux/chatSlice";
import { useChatSocket } from "@/hooks/useChatSocket";
import {
  uploadVoiceMessage,
  createGroup,
  deleteGroup,
  fetchGroupMembers,
  addGroupMember,
  removeGroupMember,
  toggleMemberCanSend,
  markConversationReadApi,
} from "@/services/chatService";
import { media_base_url, resolveImageUrl } from "@/environment";
import { ChatGroup, ChatGroupMember, ChatMessage, ChatUser, RecentChat } from "@/types/chat";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function avatarUrl(profileImg?: string | null, imageUrl?: string | null): string | null {
  const path = profileImg || imageUrl;
  return path ? `${media_base_url}/${path}` : null;
}

/** For ChatUser.avatarUrl — already a raw path, just prepend base */
function chatAvatarUrl(path?: string | null): string | null {
  return path ? `${media_base_url}/${path}` : null;
}

function displayName(d?: { name?: string; firstName?: string; lastName?: string } | null): string {
  if (!d) return "Unknown";
  if (d.name) return d.name;
  return `${d.firstName ?? ""} ${d.lastName ?? ""}`.trim() || "Unknown";
}

function getInitials(name: string): string {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

function toLowerRole(role: string): string {
  return role.toLowerCase().replace("super_admin", "admin");
}

/** HH:MM AM/PM */
function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch { return ""; }
}

/** Relative date label for day separators */
function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  if (sameDay(d, today)) return "Today";
  if (sameDay(d, yesterday)) return "Yesterday";
  return d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

/** Relative timestamp for sidebar last-message */
function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return dayLabel(iso);
}

/** Format seconds → "1:05". Returns "0:00" for NaN / Infinity / negative. */
function formatDuration(seconds: number): string {
  if (!isFinite(seconds) || isNaN(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

/** Coloured role chip */
function RoleBadge({ role }: { role: string }) {
  return (
    <span className={`chat-role-badge role-${role}`}>{role}</span>
  );
}

/** Avatar with optional online ring */
function UserAvatar({
  url, name, size = 36, online = false, className = "",
}: {
  url: string | null; name: string; size?: number;
  online?: boolean; className?: string;
}) {
  const ringClass = online ? "online-pulse" : "";
  if (url) {
    return (
      <span className={`avatar flex-shrink-0 ${online ? "online" : ""} ${className}`}
        style={{ width: size, height: size }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={name} className={ringClass}
          style={{ width: size, height: size, objectFit: "cover", borderRadius: "50%" }} />
      </span>
    );
  }
  return (
    <span
      className={`avatar flex-shrink-0 badge-soft-purple fw-bold d-flex align-items-center justify-content-center ${online ? "online" : ""} ${className} ${ringClass}`}
      style={{ width: size, height: size, fontSize: size * 0.36, borderRadius: "50%" }}
    >
      {getInitials(name)}
    </span>
  );
}

/** Three-dot action menu — custom fixed-position dropdown, escapes all stacking contexts */
function MessageDropdown({
  message, canDelete, onCopy, onDelete, side,
}: {
  message: ChatMessage; canDelete: boolean;
  onCopy: () => void; onDelete: () => void;
  side: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const openMenu = useCallback(() => {
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    const menuWidth = 148;
    setMenuPos({
      top: rect.bottom + 4,
      left: side === "right"
        ? Math.max(4, rect.right - menuWidth)
        : rect.left,
    });
    setOpen(true);
  }, [side]);

  // Close on outside click or scroll
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node) &&
          !btnRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const closeOnScroll = () => setOpen(false);
    document.addEventListener("mousedown", close);
    window.addEventListener("scroll", closeOnScroll, true);
    return () => {
      document.removeEventListener("mousedown", close);
      window.removeEventListener("scroll", closeOnScroll, true);
    };
  }, [open]);

  return (
    <div className={`msg-action ${side === "left" ? "ms-2" : "me-2"}`}>
      <button
        ref={btnRef}
        type="button"
        className="btn btn-sm btn-icon btn-light p-1"
        style={{ lineHeight: 1 }}
        onClick={open ? () => setOpen(false) : openMenu}
        aria-label="Message actions"
      >
        <i className="ti ti-dots-vertical fs-14" />
      </button>

      {open && typeof document !== "undefined" && createPortal(
        <div
          ref={menuRef}
          style={{
            position: "fixed",
            top: menuPos.top,
            left: menuPos.left,
            zIndex: 9999,
            background: "#fff",
            border: "1px solid #E2E8F0",
            borderRadius: 10,
            padding: "4px",
            boxShadow: "0 4px 16px rgba(0,0,0,.12), 0 1px 4px rgba(0,0,0,.06)",
            minWidth: 148,
          }}
        >
          <button
            type="button"
            className="dropdown-item rounded d-flex align-items-center gap-2"
            style={{ fontSize: 13, padding: "7px 10px" }}
            onClick={() => { onCopy(); setOpen(false); }}
          >
            <i className="ti ti-copy" style={{ color: "#2563EB", fontSize: 14 }} />
            Copy
          </button>
          {canDelete && (
            <button
              type="button"
              className="dropdown-item rounded d-flex align-items-center gap-2 text-danger"
              style={{ fontSize: 13, padding: "7px 10px" }}
              onClick={() => { onDelete(); setOpen(false); }}
            >
              <i className="ti ti-trash" style={{ fontSize: 14 }} />
              Delete
            </button>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}

/** Horizontal day-divider between message groups */
function DaySeparator({ label }: { label: string }) {
  return <div className="chat-day-separator">{label}</div>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

const ChatComponent = () => {
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((s) => s.auth);
  const {
    groupMessages, privateMessages, recentChats, allUsers,
    onlineUsers, activeConversation, unreadCounts,
    chatGroups, activeGroupId, currentGroupMessages,
  } = useAppSelector((s) => s.chat);

  const searchParams  = useSearchParams();
  const fromParam     = searchParams.get("from");
  const targetId      = searchParams.get("targetId");
  const targetType    = searchParams.get("targetType");
  const targetName    = searchParams.get("targetName");

  const userId   = user?.id ?? "";
  const userType = toLowerRole(user?.role?.name ?? "");
  const isAdmin  = userType === "admin";
  const isParent = userType === "parent";

  const {
    isConnected, sendGroupMessage, sendPrivateMessage,
    sendVoiceGroupMessage, sendVoicePrivateMessage,
    sendChatGroupMessage,
    deleteMessage, chatError, clearChatSocketError,
    socketRef,
  } = useChatSocket(userId, userType);

  const [mode, setMode]               = useState<"group" | "private" | "chatgroup">(() => activeConversation ? "private" : "group");

  // Bootstrap conversation from URL params (survives refresh + fixes navigation race)
  useEffect(() => {
    if (targetId && targetType) {
      dispatch(setActiveConversation({
        userId:      Number(targetId),
        userType:    targetType as "TEACHER" | "STUDENT" | "PARENT" | "ADMIN",
        displayName: targetName ? decodeURIComponent(targetName) : targetType,
        avatarUrl:   null,
      }));
      setMode("private");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetId, targetType]);

  const [sidebarTab, setSidebarTab]   = useState<"channels" | "groups" | "dms">("dms");
  const [inputText, setInputText]     = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showPicker, setShowPicker]   = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");
  const [copied, setCopied]           = useState(false);

  // ── Group management state ────────────────────────────────────────────────
  const [showCreateGroup, setShowCreateGroup]     = useState(false);
  const [newGroupName, setNewGroupName]           = useState("");
  const [groupCreating, setGroupCreating]         = useState(false);
  const [showManageGroup, setShowManageGroup]     = useState(false);
  const [managingGroup, setManagingGroup]         = useState<ChatGroup | null>(null);
  const [groupMembers, setGroupMembers]           = useState<ChatGroupMember[]>([]);
  const [membersLoading, setMembersLoading]       = useState(false);
  const [showAddMember, setShowAddMember]         = useState(false);
  const [addMemberSearch, setAddMemberSearch]     = useState("");
  const [groupError, setGroupError]               = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingGroupId, setDeletingGroupId]     = useState<number | null>(null);

  // ── Voice recording ───────────────────────────────────────────────────────
  const [recording, setRecording]   = useState(false);
  const [recSeconds, setRecSeconds] = useState(0);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef   = useRef<Blob[]>([]);
  const recTimerRef      = useRef<ReturnType<typeof setInterval> | null>(null);
  const recSecondsRef    = useRef(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef       = useRef<HTMLInputElement>(null);

  // ── Load ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!userId || !userType) return;
    dispatch(fetchGroupMessagesThunk());
    dispatch(fetchPrivateMessagesThunk({ userId, userType }));
    dispatch(fetchRecentChatsThunk({ userId, userType }));
    dispatch(fetchAllUsersThunk({ userId, userType }));
    dispatch(fetchChatGroupsThunk({ userId: parseInt(userId as string), userType }));
    dispatch(fetchUnreadCountsThunk({ userId, userType }));
  }, [userId, userType, dispatch]);

  // ── Load group messages when active group changes ──────────────────────────
  useEffect(() => {
    if (activeGroupId !== null) {
      dispatch(fetchCurrentGroupMessagesThunk(activeGroupId));
    }
  }, [activeGroupId, dispatch]);

  // ── Auto-scroll ───────────────────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [groupMessages, privateMessages, currentGroupMessages, activeConversation]);

  // ── Error auto-clear ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!chatError) return;
    const t = setTimeout(clearChatSocketError, 4000);
    return () => clearTimeout(t);
  }, [chatError, clearChatSocketError]);

  // ── Voice recording cleanup on unmount ────────────────────────────────────
  useEffect(() => {
    return () => {
      if (recTimerRef.current) clearInterval(recTimerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  // ── Recording helpers ─────────────────────────────────────────────────────
  const startRecording = async () => {
    // Guard: API availability
    if (!navigator.mediaDevices?.getUserMedia) {
      setVoiceError("Your browser does not support voice recording.");
      return;
    }
    if (typeof MediaRecorder === "undefined") {
      setVoiceError("Your browser does not support MediaRecorder.");
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      console.error("[Voice] getUserMedia failed:", err);
      setVoiceError("Microphone access denied. Please allow microphone access and try again.");
      return;
    }

    try {
      // Pick the best supported MIME type
      const PREFERRED = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4", ""];
      const mimeType  = PREFERRED.find((t) => !t || MediaRecorder.isTypeSupported(t)) ?? "";
      const mr = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      const actualMime = mr.mimeType || "audio/webm";

      audioChunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const duration = recSecondsRef.current;
        const blob = new Blob(audioChunksRef.current, { type: actualMime });
        audioChunksRef.current = [];
        setRecording(false);
        setRecSeconds(0);
        recSecondsRef.current = 0;
        handleVoiceSend(blob, duration);
      };
      mr.start(100);
      mediaRecorderRef.current = mr;
      recSecondsRef.current = 0;
      setRecSeconds(0);
      setRecording(true);
      recTimerRef.current = setInterval(() => {
        recSecondsRef.current += 1;
        setRecSeconds((s) => s + 1);
      }, 1000);

    } catch (err) {
      console.error("[Voice] MediaRecorder setup failed:", err);
      stream.getTracks().forEach((t) => t.stop());
      setVoiceError("Could not start recording. Please try again.");
    }
  };

  const stopRecording = () => {
    if (recTimerRef.current) { clearInterval(recTimerRef.current); recTimerRef.current = null; }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
  };

  const handleVoiceSend = async (blob: Blob, duration: number) => {
    try {
      if (blob.size === 0) {
        setVoiceError("Recording was empty. Please try again.");
        return;
      }
      const { mediaUrl } = await uploadVoiceMessage(blob);
      if (mode === "group") {
        sendVoiceGroupMessage(parseInt(userId as string), userType, mediaUrl, duration);
      } else if (mode === "chatgroup" && activeGroupId !== null) {
        sendChatGroupMessage(activeGroupId, parseInt(userId as string), userType, "", "voice", mediaUrl, duration);
      } else if (activeConversation) {
        sendVoicePrivateMessage(
          parseInt(userId as string), userType,
          activeConversation.userId, activeConversation.userType,
          mediaUrl, duration
        );
      }
    } catch (err) {
      console.error("[Voice] Upload/send failed:", err);
      setVoiceError("Failed to upload voice message. Please try again.");
    }
  };

  // ── Filtered private messages for active convo ────────────────────────────
  const filteredPrivate = useMemo(() => {
    if (!activeConversation) return [];
    const { userId: otherId, userType: otherType } = activeConversation;
    const myId = parseInt(userId);
    return privateMessages.filter((m) =>
      (m.senderId === myId && m.senderType === userType && m.receiverId === otherId && m.receiverType === otherType) ||
      (m.senderId === otherId && m.senderType === otherType && m.receiverId === myId && m.receiverType === userType)
    );
  }, [activeConversation, privateMessages, userId, userType]);

  // ── Sidebar search ────────────────────────────────────────────────────────
  const filteredRecent = useMemo(() => {
    if (!searchQuery) return recentChats;
    const q = searchQuery.toLowerCase();
    return recentChats.filter((rc) => displayName(rc.otherUserDetails).toLowerCase().includes(q));
  }, [recentChats, searchQuery]);

  // ── Online check ──────────────────────────────────────────────────────────
  const isOnline = (id: number, type: string) =>
    onlineUsers.some((u) => u.details != null && (u.details as { id?: number }).id === id && u.userType === type);

  // ── Send ──────────────────────────────────────────────────────────────────
  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    const text = inputText.trim();
    if (!text) return;
    if (mode === "group") {
      sendGroupMessage(text, parseInt(userId), userType);
    } else if (mode === "chatgroup" && activeGroupId !== null) {
      sendChatGroupMessage(activeGroupId, parseInt(userId as string), userType, text);
    } else if (activeConversation) {
      sendPrivateMessage(text, parseInt(userId), userType, activeConversation.userId, activeConversation.userType);
    }
    setInputText("");
    inputRef.current?.focus();
  };

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = (msg: ChatMessage) => deleteMessage(msg.id, parseInt(userId), userType);

  // ── Copy ──────────────────────────────────────────────────────────────────
  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const canDelete = (msg: ChatMessage) =>
    isAdmin || (msg.senderId === parseInt(userId) && msg.senderType === userType);

  // ── Group management ──────────────────────────────────────────────────────
  const openChatGroup = (group: ChatGroup) => {
    dispatch(setActiveGroupId(group.id));
    setMode("chatgroup");
    dispatch(clearActiveConversation());
  };

  const handleCreateGroup = async () => {
    const name = newGroupName.trim();
    if (!name) return;
    setGroupCreating(true);
    setGroupError(null);
    try {
      const group = await createGroup(name, parseInt(userId as string), userType);
      dispatch(addChatGroup(group));
      setNewGroupName("");
      setShowCreateGroup(false);
      openChatGroup(group);
    } catch (err: unknown) {
      setGroupError(err instanceof Error ? err.message : "Failed to create group.");
    } finally {
      setGroupCreating(false);
    }
  };

  const handleDeleteGroup = async (groupId: number) => {
    if (!confirm("Delete this group and all its messages?")) return;
    try {
      await deleteGroup(groupId);
      dispatch(removeChatGroup(groupId));
      if (activeGroupId === groupId) setMode("group");
      setShowManageGroup(false);
    } catch (err: unknown) {
      setGroupError(err instanceof Error ? err.message : "Failed to delete group.");
    }
  };

  const openManageGroup = async (group: ChatGroup) => {
    setManagingGroup(group);
    setShowManageGroup(true);
    setMembersLoading(true);
    setGroupError(null);
    try {
      const members = await fetchGroupMembers(group.id);
      setGroupMembers(members);
    } catch {
      setGroupError("Failed to load members.");
    } finally {
      setMembersLoading(false);
    }
  };

  const handleRemoveMember = async (member: ChatGroupMember) => {
    if (!managingGroup) return;
    try {
      await removeGroupMember(managingGroup.id, member.id);
      setGroupMembers((prev) => prev.filter((m) => m.id !== member.id));
      dispatch(updateGroupMemberCount({ groupId: managingGroup.id, delta: -1 }));
      // Tell the removed user's socket to leave the room
      socketRef.current?.emit("leaveGroup", { groupId: managingGroup.id });
    } catch {
      setGroupError("Failed to remove member.");
    }
  };

  const handleToggleCanSend = async (member: ChatGroupMember) => {
    if (!managingGroup) return;
    try {
      const updated = await toggleMemberCanSend(managingGroup.id, member.id, !member.canSend);
      setGroupMembers((prev) => prev.map((m) => m.id === member.id ? { ...m, canSend: updated.canSend } : m));
    } catch {
      setGroupError("Failed to update send permission.");
    }
  };

  const handleAddMember = async (u: ChatUser) => {
    if (!managingGroup) return;
    try {
      const member = await addGroupMember(managingGroup.id, u.id, u.userType);
      setGroupMembers((prev) => [...prev, member]);
      dispatch(updateGroupMemberCount({ groupId: managingGroup.id, delta: 1 }));
      // Tell the added user's socket to join the room if they're online
      socketRef.current?.emit("joinGroup", { groupId: managingGroup.id });
      setShowAddMember(false);
      setAddMemberSearch("");
    } catch (err: unknown) {
      setGroupError(err instanceof Error ? err.message : "Failed to add member.");
    }
  };

  // ── Open private conversation ──────────────────────────────────────────────
  const openConvo = (rc: RecentChat) => {
    const other = rc.otherUserDetails;
    if (!other) return;
    dispatch(setActiveConversation({
      userId: other.id ?? 0,
      userType: other.userType ?? "",
      displayName: displayName(other),
      avatarUrl: avatarUrl(other.profileImg, other.imageUrl),
    }));
    // Clear unread badge for this conversation
    dispatch(markConversationRead(`${other.userType}-${other.id}`));
    // Persist read state to backend
    markConversationReadApi(userId, userType, other.id ?? 0, other.userType).catch(() => {});
    setMode("private");
  };

  const openFromPicker = (u: ChatUser) => {
    // If there's already a conversation with this user, reuse its existing data
    const existingRc = recentChats.find(
      (rc) =>
        Number(rc.otherUserDetails?.id) === u.id &&
        rc.otherUserDetails?.userType === u.userType
    );
    if (existingRc) {
      openConvo(existingRc);
    } else {
      dispatch(setActiveConversation({
        userId: u.id, userType: u.userType,
        displayName: u.displayName, avatarUrl: chatAvatarUrl(u.avatarUrl) || null,
      }));
      dispatch(markConversationRead(`${u.userType}-${u.id}`));
      markConversationReadApi(userId, userType, u.id, u.userType).catch(() => {});
      setMode("private");
    }
    setShowPicker(false);
    setPickerSearch("");
  };

  // ── Messages with day separators ──────────────────────────────────────────
  const displayMessages: ChatMessage[] =
    mode === "group" ? groupMessages :
    mode === "chatgroup" ? currentGroupMessages :
    filteredPrivate;

  type Row = { type: "separator"; label: string } | { type: "message"; msg: ChatMessage };

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    let lastDay = "";
    for (const msg of displayMessages) {
      const d = dayLabel(msg.createdAt);
      if (d !== lastDay) { out.push({ type: "separator", label: d }); lastDay = d; }
      out.push({ type: "message", msg });
    }
    return out;
  }, [displayMessages]);


  // ── Picker filtered users (exclude self) ─────────────────────────────────
  const filteredUsers = useMemo(() => {
    const myId = parseInt(userId as string);
    const selfExcluded = allUsers.filter(
      (u) => !(u.id === myId && u.userType === userType)
    );
    if (!pickerSearch) return selfExcluded;
    const q = pickerSearch.toLowerCase();
    return selfExcluded.filter((u) =>
      u.displayName.toLowerCase().includes(q) || u.username.toLowerCase().includes(q)
    );
  }, [allUsers, pickerSearch, userId, userType]);

  // ── Total unread count across all private conversations ──────────────────
  const totalUnread = useMemo(
    () => Object.values(unreadCounts).reduce((sum, n) => sum + n, 0),
    [unreadCounts]
  );

  // ── Header info ───────────────────────────────────────────────────────────
  const activeGroup  = chatGroups.find((g) => g.id === activeGroupId) ?? null;
  const headerName   =
    mode === "group" ? "Group Chat" :
    mode === "chatgroup" ? (activeGroup?.name ?? "Group") :
    (activeConversation?.displayName ?? "Select a conversation");
  const headerOnline = mode === "private" && activeConversation
    ? isOnline(activeConversation.userId, activeConversation.userType) : false;
  const onlineCount  = onlineUsers.length;

  // ── Add-member filtered list (exclude already-members) ────────────────────
  const existingMemberKeys = new Set(groupMembers.map((m) => `${m.userType}-${m.userId}`));
  const addMemberFiltered = useMemo(() => {
    const myId = parseInt(userId as string);
    const q = addMemberSearch.toLowerCase();
    return allUsers.filter((u) => {
      if (u.id === myId && u.userType === userType) return false; // exclude self
      if (existingMemberKeys.has(`${u.userType}-${u.id}`)) return false;
      if (!q) return true;
      return u.displayName.toLowerCase().includes(q) || u.username.toLowerCase().includes(q);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allUsers, addMemberSearch, groupMembers, userId, userType]);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <>
      <div className="page-wrapper">
        <div className="content">

          {/* ── Page Header ── */}
          <div className="d-flex align-items-sm-center flex-sm-row flex-column gap-2 pb-3">
            <div className="flex-grow-1 d-flex align-items-center gap-2">
              {fromParam === "students" && (
                <Link
                  href={all_routes.manageStudents}
                  className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1"
                >
                  <i className="ti ti-arrow-left" />
                  Back to Students
                </Link>
              )}
              <h4 className="fs-18 fw-semibold mb-0">Chat</h4>
            </div>
          </div>

          {/* ── Error banner ── */}
          {(chatError || voiceError) && (
            <div className="alert alert-danger alert-dismissible d-flex align-items-center gap-2 mb-3 rounded-3">
              <i className="ti ti-alert-triangle fs-16" />
              <span className="flex-fill">{chatError || voiceError}</span>
              <button type="button" className="btn-close" onClick={() => { clearChatSocketError(); setVoiceError(null); }} />
            </div>
          )}

          {/* ── Copied toast ── */}
          {copied && (
            <div className="position-fixed bottom-0 end-0 p-3" style={{ zIndex: 9999 }}>
              <div className="toast show align-items-center border-0 rounded-3 shadow"
                style={{ background: "#0F172A", color: "#fff" }}>
                <div className="toast-body d-flex align-items-center gap-2">
                  <i className="ti ti-check fs-14" style={{ color: "#22C55E" }} />
                  <span style={{ fontSize: 13 }}>Copied to clipboard</span>
                </div>
              </div>
            </div>
          )}

          {/* ── Main chat card ── */}
          <div className="card mb-0 overflow-hidden"
            style={{ borderRadius: 16, border: "1px solid #E2E8F0", boxShadow: "0 1px 3px rgba(0,0,0,.06)" }}>
            <div className="card-body p-0">
              <div className="d-md-flex" style={{ minHeight: "calc(100vh - 12rem)" }}>

                {/* ══════════════════ SIDEBAR ══════════════════ */}
                <div className="chat-user-nav">

                  {/* ── User profile header ── */}
                  <div className="chat-sidebar-header">
                    <div className="d-flex align-items-center gap-3">
                      <div className="position-relative flex-shrink-0">
                        <UserAvatar
                          url={avatarUrl(user?.profileImg ?? null, null)}
                          name={user?.username ?? "Me"}
                          size={38}
                        />
                        <span
                          className="position-absolute border border-white rounded-circle"
                          style={{ width: 10, height: 10, background: "#22C55E", bottom: 0, right: 0 }}
                        />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <p className="chat-user-name text-truncate">{user?.username ?? "You"}</p>
                        <div className="chat-user-meta">
                          <RoleBadge role={userType} />
                          <span className="online-dot" />
                          <span className="chat-online-count">{onlineCount} online</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ── Tab bar ── */}
                  <div className="chat-tab-bar">
                    {(["dms", "groups", "channels"] as const).map((tab) => (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => setSidebarTab(tab)}
                        className={`chat-tab-btn ${sidebarTab === tab ? "active" : ""}`}
                      >
                        {tab === "dms" ? (
                          <span className="d-flex align-items-center gap-1">
                            Messages
                            {totalUnread > 0 && (
                              <span style={{ background: "#EF4444", color: "#fff", borderRadius: 10, fontSize: 9, fontWeight: 700, padding: "1px 5px", lineHeight: 1.4 }}>
                                {totalUnread > 99 ? "99+" : totalUnread}
                              </span>
                            )}
                          </span>
                        ) : tab === "groups" ? "Groups" : "Announcements"}
                      </button>
                    ))}
                  </div>

                  {/* ── Tab content ── */}
                  <OverlayScrollbarsComponent
                    style={{ flex: 1, maxHeight: "calc(100vh - 22rem)" }}
                    className="chat-users px-2 pt-1 pb-3"
                  >

                    {/* ── Channels tab ── */}
                    {sidebarTab === "channels" && (
                      <div className="px-1 pt-2">
                        <p className="chat-section-label">Public</p>
                        <div
                          role="button" tabIndex={0}
                          className={`d-flex align-items-center gap-3 user-list mb-1 ${mode === "group" ? "active" : ""}`}
                          onClick={() => { setMode("group"); dispatch(clearActiveConversation()); }}
                          onKeyDown={(e) => e.key === "Enter" && (setMode("group"), dispatch(clearActiveConversation()))}
                        >
                          <span
                            className="flex-shrink-0 d-flex align-items-center justify-content-center"
                            style={{
                              width: 40, height: 40, borderRadius: 10,
                              background: "#EEF2FF", color: "#4F46E5", fontSize: 17, flexShrink: 0,
                            }}
                          >
                            <i className="ti ti-users" />
                          </span>
                          <div className="flex-fill overflow-hidden">
                            <div className="d-flex align-items-center justify-content-between gap-2">
                              <h6 className="fs-13 fw-semibold mb-0 text-truncate" style={{ color: "#0F172A" }}>Group Chat</h6>
                              <span style={{ fontSize: 10, color: "#94A3B8", whiteSpace: "nowrap" }}>
                                {groupMessages.length > 0 ? relativeTime(groupMessages[groupMessages.length - 1].createdAt) : ""}
                              </span>
                            </div>
                            <p className="mb-0 text-truncate" style={{ fontSize: 12, color: "#94A3B8" }}>
                              {groupMessages.length > 0
                                ? groupMessages[groupMessages.length - 1].message
                                : "No messages yet"}
                            </p>
                          </div>
                          <span
                            style={{ width: 7, height: 7, borderRadius: "50%", flexShrink: 0,
                              background: isConnected ? "#22C55E" : "#CBD5E1" }}
                          />
                        </div>
                      </div>
                    )}

                    {/* ── Groups tab ── */}
                    {sidebarTab === "groups" && (
                      <div className="px-1 pt-2">
                        <div className="d-flex align-items-center justify-content-between px-1 mb-1">
                          <p className="chat-section-label mb-0">Your Groups</p>
                          {isAdmin && (
                            <button
                              type="button"
                              className="btn btn-sm d-flex align-items-center justify-content-center p-0"
                              title="Create new group"
                              style={{ width: 24, height: 24, borderRadius: 6, background: "#EFF6FF", color: "#2563EB", border: "none" }}
                              onClick={() => setShowCreateGroup(true)}
                            >
                              <i className="ti ti-plus" style={{ fontSize: 13 }} />
                            </button>
                          )}
                        </div>
                        {chatGroups.length === 0 ? (
                          <div className="text-center py-4" style={{ color: "#94A3B8", fontSize: 13 }}>
                            <i className="ti ti-users-group d-block mb-1" style={{ fontSize: 22 }} />
                            No groups yet
                          </div>
                        ) : (
                          chatGroups.map((g) => {
                            const isAct = mode === "chatgroup" && activeGroupId === g.id;
                            return (
                              <div
                                key={g.id}
                                role="button" tabIndex={0}
                                className={`d-flex align-items-center gap-3 user-list mb-1 ${isAct ? "active" : ""}`}
                                onClick={() => openChatGroup(g)}
                                onKeyDown={(e) => e.key === "Enter" && openChatGroup(g)}
                              >
                                <span
                                  className="flex-shrink-0 d-flex align-items-center justify-content-center"
                                  style={{
                                    width: 40, height: 40, borderRadius: 10,
                                    background: "#EFF6FF", color: "#2563EB", fontSize: 17,
                                  }}
                                >
                                  <i className="ti ti-users-group" />
                                </span>
                                <div className="flex-fill overflow-hidden">
                                  <h6 className="fs-13 fw-semibold mb-0 text-truncate" style={{ color: "#0F172A" }}>{g.name}</h6>
                                  <p className="mb-0" style={{ fontSize: 12, color: "#94A3B8" }}>
                                    {g.memberCount ?? 0} member{(g.memberCount ?? 0) !== 1 ? "s" : ""}
                                  </p>
                                </div>
                                {isAdmin && (
                                  <button
                                    type="button"
                                    className="btn p-0 d-flex align-items-center justify-content-center flex-shrink-0"
                                    title="Manage group"
                                    style={{ width: 28, height: 28, borderRadius: 6, background: "transparent",
                                      border: "none", color: "#94A3B8" }}
                                    onClick={(e) => { e.stopPropagation(); openManageGroup(g); }}
                                  >
                                    <i className="ti ti-settings" style={{ fontSize: 14 }} />
                                  </button>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}

                    {/* ── DMs tab ── */}
                    {sidebarTab === "dms" && (
                      <>
                        {/* Search */}
                        <div className="chat-search-wrap">
                          <i className="ti ti-search chat-search-icon" />
                          <input
                            type="text"
                            placeholder="Search conversations…"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                          />
                        </div>

                        {/* New Conversation (admin-only) */}
                        {isAdmin && (
                          <div className="px-1 pb-1">
                            <button
                              type="button"
                              className="btn w-100 d-flex align-items-center justify-content-center gap-2"
                              style={{
                                borderRadius: 8, fontSize: 12, fontWeight: 600,
                                border: "1.5px dashed #BFDBFE", color: "#2563EB",
                                background: "transparent", padding: "7px 12px",
                              }}
                              onClick={() => setShowPicker(true)}
                            >
                              <i className="ti ti-plus" style={{ fontSize: 14 }} />
                              New Conversation
                            </button>
                          </div>
                        )}

                        {/* Recent chats */}
                        <div className="px-1 pt-1">
                          {filteredRecent.length > 0 && (
                            <p className="chat-section-label">Recent</p>
                          )}
                          {filteredRecent.map((rc, rcIdx) => {
                            const other = rc.otherUserDetails;
                            if (!other) return null;
                            const name   = displayName(other);
                            const url    = avatarUrl(other.profileImg, other.imageUrl);
                            const online = isOnline(other.id ?? 0, other.userType ?? "");
                            const isAct  = mode === "private" &&
                              activeConversation?.userId === (other.id ?? 0) &&
                              activeConversation?.userType === other.userType;
                            const unread = unreadCounts[`${other.userType}-${other.id}`] ?? 0;

                            return (
                              <div
                                key={`${other.userType}-${other.id}`}
                                role="button" tabIndex={0}
                                className={`d-flex align-items-center gap-3 user-list mb-1 ${isAct ? "active" : ""}`}
                                onClick={() => openConvo(rc)}
                                onKeyDown={(e) => e.key === "Enter" && openConvo(rc)}
                              >
                                <div className="position-relative flex-shrink-0">
                                  <UserAvatar url={url} name={name} size={40} />
                                  {unread > 0 && (
                                    <span
                                      className="position-absolute d-flex align-items-center justify-content-center fw-bold"
                                      style={{ width: 18, height: 18, borderRadius: "50%", background: "#EF4444", color: "#fff", fontSize: 9, top: -3, right: -3, border: "1.5px solid #fff" }}
                                    >
                                      {unread > 99 ? "99+" : unread}
                                    </span>
                                  )}
                                  {online && (
                                    <span
                                      className="position-absolute border border-white rounded-circle"
                                      style={{ width: 10, height: 10, background: "#22C55E", bottom: 0, right: 0 }}
                                    />
                                  )}
                                </div>
                                <div className="flex-fill overflow-hidden">
                                  <div className="d-flex align-items-center justify-content-between gap-2">
                                    <h6 className={`mb-0 text-truncate ${unread > 0 ? "fw-bold" : "fw-semibold"}`}
                                      style={{ fontSize: 13, color: "#0F172A" }}>
                                      {name}
                                    </h6>
                                    <span style={{ fontSize: 10, color: "#94A3B8", whiteSpace: "nowrap", flexShrink: 0 }}>
                                      {relativeTime(rc.createdAt)}
                                    </span>
                                  </div>
                                  <div className="d-flex align-items-center justify-content-between gap-1">
                                    <div className="d-flex align-items-center gap-1 overflow-hidden">
                                      <RoleBadge role={other.userType ?? ""} />
                                      <p className="mb-0 text-truncate" style={{ fontSize: 12, color: "#94A3B8" }}>
                                        {rc.message?.slice(0, 28)}{(rc.message?.length ?? 0) > 28 ? "…" : ""}
                                      </p>
                                    </div>
                                    {unread > 0 && !isAct && (
                                      <span className="unread-badge flex-shrink-0">
                                        {unread > 99 ? "99+" : unread}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {searchQuery && filteredRecent.length === 0 && (
                          <p className="text-center py-3" style={{ fontSize: 13, color: "#94A3B8" }}>
                            No results for &ldquo;{searchQuery}&rdquo;
                          </p>
                        )}
                        {!searchQuery && recentChats.length === 0 && (
                          <div className="text-center py-4" style={{ color: "#94A3B8", fontSize: 13 }}>
                            <i className="ti ti-message-off d-block mb-1" style={{ fontSize: 22 }} />
                            No direct messages yet
                          </div>
                        )}
                      </>
                    )}

                  </OverlayScrollbarsComponent>
                </div>
                {/* ══════════════════ END SIDEBAR ══════════════════ */}

                {/* ══════════════════ MAIN AREA ══════════════════ */}
                <div className="flex-fill d-flex flex-column" style={{ minWidth: 0 }}>

                  {/* ── Chat header ── */}
                  <div className="chat-main-header">
                    <div className="d-flex align-items-center gap-3">
                      {mode === "group" ? (
                        <span
                          className="flex-shrink-0 d-flex align-items-center justify-content-center"
                          style={{
                            width: 44, height: 44, borderRadius: 12,
                            background: "#EEF2FF", color: "#4F46E5", fontSize: 20,
                          }}
                        >
                          <i className="ti ti-users" />
                        </span>
                      ) : mode === "chatgroup" ? (
                        <span
                          className="flex-shrink-0 d-flex align-items-center justify-content-center"
                          style={{
                            width: 44, height: 44, borderRadius: 12,
                            background: "#EFF6FF", color: "#2563EB", fontSize: 20,
                          }}
                        >
                          <i className="ti ti-users-group" />
                        </span>
                      ) : (
                        <div className="position-relative flex-shrink-0">
                          <UserAvatar
                            url={activeConversation?.avatarUrl ?? null}
                            name={activeConversation?.displayName ?? ""}
                            size={44}
                          />
                          {headerOnline && (
                            <span
                              className="position-absolute border border-white rounded-circle"
                              style={{ width: 12, height: 12, background: "#22C55E", bottom: 0, right: 0 }}
                            />
                          )}
                        </div>
                      )}
                      <div>
                        <p className="chat-header-title">{headerName}</p>
                        <div className="chat-header-meta">
                          {mode === "group" ? (
                            <>
                              <span className={`chat-status-badge ${isConnected ? "status-live" : "status-connecting"}`}>
                                {isConnected ? "Live" : "Connecting"}
                              </span>
                              <span>{onlineCount} members online</span>
                            </>
                          ) : mode === "chatgroup" ? (
                            <>
                              <span className={`chat-status-badge ${isConnected ? "status-live" : "status-connecting"}`}>
                                {isConnected ? "Live" : "Connecting"}
                              </span>
                              <span>{activeGroup?.memberCount ?? 0} members</span>
                            </>
                          ) : (
                            <>
                              <span className={`chat-status-badge ${headerOnline ? "status-online" : "status-offline"}`}>
                                {headerOnline ? "Online" : "Offline"}
                              </span>
                              {activeConversation && <RoleBadge role={activeConversation.userType} />}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    {/* Admin manage button */}
                    {isAdmin && mode === "chatgroup" && activeGroup && (
                      <button
                        type="button"
                        className="btn btn-sm d-flex align-items-center gap-2"
                        style={{
                          borderRadius: 8, fontSize: 12, fontWeight: 600,
                          background: "#F8FAFC", border: "1px solid #E2E8F0",
                          color: "#334155", padding: "6px 12px",
                        }}
                        onClick={() => openManageGroup(activeGroup)}
                      >
                        <i className="ti ti-settings" style={{ fontSize: 13 }} />
                        Manage
                      </button>
                    )}
                  </div>

                  {/* ── Messages ── */}
                  <OverlayScrollbarsComponent
                    style={{ flex: 1, maxHeight: "calc(100vh - 22rem)" }}
                    className="message-body px-4 py-3"
                  >
                    {displayMessages.length === 0 ? (
                      <div className="chat-empty-state">
                        <div className="empty-icon-wrap">
                          <i className={`ti ${mode === "group" || mode === "chatgroup" ? "ti-messages" : "ti-message-2"}`} />
                        </div>
                        <h6>
                          {mode === "group" ? "No messages yet" : mode === "chatgroup" ? `${headerName}` : "No messages yet"}
                        </h6>
                        <p>
                          {mode === "group"
                            ? "Be the first to say something to everyone in the group."
                            : mode === "chatgroup"
                            ? "Be the first to send a message to this group."
                            : activeConversation
                            ? `Start your conversation with ${activeConversation.displayName}.`
                            : "Select a conversation from the sidebar to begin."}
                        </p>
                      </div>
                    ) : (
                      rows.map((row, i) => {
                        if (row.type === "separator") {
                          return <DaySeparator key={`sep-${i}`} label={row.label} />;
                        }

                        const { msg } = row;
                        const isMine = msg.senderId === parseInt(userId) && msg.senderType === userType;
                        const name   = displayName(msg.senderDetails);
                        const url    = avatarUrl(msg.senderDetails?.profileImg, msg.senderDetails?.imageUrl);
                        const time   = formatTime(msg.createdAt);
                        const role   = msg.senderType;

                        if (!isMine) {
                          return (
                            <div key={msg.id} className="chat-list mb-3">
                              <div className="d-flex align-items-end gap-2">
                                <UserAvatar url={url} name={name} size={32} className="flex-shrink-0 mb-1" />
                                <div style={{ minWidth: 0 }}>
                                  <div className="chat-msg-meta">
                                    <span className="chat-sender-name">{name}</span>
                                    <RoleBadge role={role} />
                                    <span className="chat-msg-time">{time}</span>
                                  </div>
                                  <div className="d-flex align-items-center gap-1">
                                    <div className="message-box receive-message">
                                      {msg.messageType === "voice" && msg.mediaUrl ? (
                                        <div className="voice-msg-bubble">
                                          <i className="ti ti-microphone-2 voice-msg-icon" />
                                          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                                          <audio controls src={`${resolveImageUrl(msg.mediaUrl)}`} />
                                          {msg.mediaDuration != null && (
                                            <span className="voice-msg-dur">{formatDuration(msg.mediaDuration)}</span>
                                          )}
                                        </div>
                                      ) : (
                                        <p className="mb-0 fs-14" style={{ lineHeight: 1.6 }}>{msg.message}</p>
                                      )}
                                    </div>
                                    <MessageDropdown
                                      message={msg} canDelete={canDelete(msg)}
                                      onCopy={() => handleCopy(msg.message)}
                                      onDelete={() => handleDelete(msg)}
                                      side="left"
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        }

                        // Sent message
                        return (
                          <div key={msg.id} className="chat-list chat-list-sent mb-3">
                            <div className="d-flex align-items-end justify-content-end gap-2">
                              <div style={{ minWidth: 0 }}>
                                <div className="chat-msg-meta justify-content-end">
                                  <span className="chat-msg-time">{time}</span>
                                  <i className="ti ti-checks" style={{ fontSize: 11, color: "#22C55E" }} />
                                </div>
                                <div className="d-flex align-items-center justify-content-end gap-1">
                                  <MessageDropdown
                                    message={msg} canDelete={canDelete(msg)}
                                    onCopy={() => handleCopy(msg.message)}
                                    onDelete={() => handleDelete(msg)}
                                    side="right"
                                  />
                                  <div className="message-box sent-message">
                                    {msg.messageType === "voice" && msg.mediaUrl ? (
                                      <div className="voice-msg-bubble">
                                        <i className="ti ti-microphone-2 voice-msg-icon" />
                                        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                                        <audio controls src={`${resolveImageUrl(msg.mediaUrl)}`} />
                                        {msg.mediaDuration != null && (
                                          <span className="voice-msg-dur">{formatDuration(msg.mediaDuration)}</span>
                                        )}
                                      </div>
                                    ) : (
                                      <p className="mb-0 fs-14" style={{ lineHeight: 1.6 }}>{msg.message}</p>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <UserAvatar url={url} name={name} size={32} className="flex-shrink-0 mb-1" />
                            </div>
                          </div>
                        );
                      })
                    )}
                    <div ref={messagesEndRef} />
                  </OverlayScrollbarsComponent>

                  {/* ── Input area / banners ── */}
                  {(mode === "group" && !isAdmin) ? (
                    <div className="readonly-banner">
                      <i className="ti ti-eye-off fs-14" />
                      Announcements are sent by admins only — you can read but not post.
                    </div>
                  ) : ((mode === "group" && isAdmin) || (mode === "private" && activeConversation) || (mode === "chatgroup" && activeGroupId !== null)) ? (
                    <form onSubmit={handleSend} className="message-footer">
                      {recording ? (
                        <div className="chat-recording-wrap">
                          <span className="rec-pulse" />
                          <span className="rec-label">REC</span>
                          <span className="rec-timer">{formatDuration(recSeconds)}</span>
                        </div>
                      ) : (
                        <div className="chat-input-wrap">
                          <input
                            ref={inputRef}
                            type="text"
                            placeholder={
                              !isConnected
                                ? "Connecting…"
                                : mode === "group"
                                ? "Message everyone…"
                                : mode === "chatgroup"
                                ? `Message ${headerName}…`
                                : `Message ${activeConversation?.displayName ?? ""}…`
                            }
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                          />
                          {inputText && (
                            <span className="input-hint">Enter ↵</span>
                          )}
                        </div>
                      )}

                      {/* Mic / Stop */}
                      {recording ? (
                        <button
                          type="button"
                          className="btn btn-danger btn-send btn-mic-recording"
                          onClick={stopRecording}
                          title="Stop recording"
                          aria-label="Stop recording"
                        >
                          <i className="ti ti-player-stop-filled" style={{ fontSize: 15 }} />
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-send"
                          onClick={startRecording}
                          disabled={!isConnected}
                          title="Record voice message"
                          aria-label="Record voice message"
                          style={{ background: "#F1F5F9", border: "none", color: "#64748B" }}
                        >
                          <i className="ti ti-microphone" style={{ fontSize: 15 }} />
                        </button>
                      )}

                      {/* Send */}
                      <button
                        type="submit"
                        className="btn btn-primary btn-send"
                        disabled={!isConnected || !inputText.trim() || recording}
                        title="Send message"
                        aria-label="Send message"
                      >
                        <i className="ti ti-send" style={{ fontSize: 15 }} />
                      </button>
                    </form>
                  ) : mode === "private" && !activeConversation ? (
                    <div className="info-banner">
                      <i className="ti ti-arrow-left fs-14" />
                      Select a conversation from the sidebar to start messaging.
                    </div>
                  ) : mode === "chatgroup" && activeGroupId === null ? (
                    <div className="info-banner">
                      <i className="ti ti-arrow-left fs-14" />
                      Select a group from the sidebar.
                    </div>
                  ) : null}
                </div>
                {/* ══════════════════ END MAIN AREA ══════════════════ */}

              </div>
            </div>
          </div>

        </div>
      </div>

      {/* ══════════════════ Create Group Modal ══════════════════ */}
      {showCreateGroup && (
        <div
          className="modal fade show d-block"
          tabIndex={-1}
          style={{ backgroundColor: "rgba(15,23,42,.5)", zIndex: 1055 }}
          onClick={(e) => e.target === e.currentTarget && setShowCreateGroup(false)}
        >
          <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: 420 }}>
            <div className="modal-content border-0 shadow-lg" style={{ borderRadius: 16 }}>
              <div className="modal-header border-0 px-5 pt-5 pb-0">
                <div>
                  <h5 className="fw-bold mb-1" style={{ color: "#0F172A" }}>Create a Group</h5>
                  <p className="mb-0" style={{ fontSize: 13, color: "#64748B" }}>
                    Give your group a name to get started
                  </p>
                </div>
                <button type="button" className="btn-close ms-auto" onClick={() => setShowCreateGroup(false)} />
              </div>
              <div className="modal-body px-5 pb-5 pt-4">
                {groupError && (
                  <div className="alert alert-danger py-2 px-3 mb-3" style={{ borderRadius: 8, fontSize: 13 }}>
                    {groupError}
                  </div>
                )}
                <label className="form-label fw-semibold mb-1" style={{ fontSize: 13, color: "#334155" }}>
                  Group Name
                </label>
                <input
                  type="text"
                  className="form-control mb-4"
                  style={{ borderRadius: 10, fontSize: 14, padding: "10px 14px" }}
                  placeholder="e.g. English A1 — Week 3"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreateGroup()}
                  autoFocus
                />
                <div className="d-flex gap-2 justify-content-end">
                  <button
                    type="button"
                    className="btn"
                    style={{ borderRadius: 8, fontSize: 13, background: "#F1F5F9",
                      border: "none", color: "#334155", padding: "8px 16px" }}
                    onClick={() => setShowCreateGroup(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ borderRadius: 8, fontSize: 13, padding: "8px 20px" }}
                    disabled={groupCreating || !newGroupName.trim()}
                    onClick={handleCreateGroup}
                  >
                    {groupCreating ? "Creating…" : "Create Group"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════ Manage Group Modal ══════════════════ */}
      {showManageGroup && managingGroup && (
        <div
          className="modal fade show d-block"
          tabIndex={-1}
          style={{ backgroundColor: "rgba(15,23,42,.5)", zIndex: 1055 }}
          onClick={(e) => e.target === e.currentTarget && setShowManageGroup(false)}
        >
          <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: 520 }}>
            <div className="modal-content border-0 shadow-lg" style={{ borderRadius: 16 }}>
              {/* Modal header */}
              <div className="d-flex align-items-start justify-content-between px-5 pt-5 pb-0">
                <div className="d-flex align-items-center gap-3">
                  <span
                    className="d-flex align-items-center justify-content-center"
                    style={{ width: 44, height: 44, borderRadius: 12,
                      background: "#EFF6FF", color: "#2563EB", fontSize: 20, flexShrink: 0 }}
                  >
                    <i className="ti ti-users-group" />
                  </span>
                  <div>
                    <h5 className="fw-bold mb-0" style={{ color: "#0F172A" }}>{managingGroup.name}</h5>
                    <p className="mb-0" style={{ fontSize: 12, color: "#64748B" }}>Manage members &amp; permissions</p>
                  </div>
                </div>
                <button type="button" className="btn-close mt-1" onClick={() => setShowManageGroup(false)} />
              </div>
              <div className="modal-body px-5 pb-5 pt-4">
                {groupError && (
                  <div className="alert alert-danger py-2 px-3 mb-3" style={{ borderRadius: 8, fontSize: 13 }}>
                    {groupError}
                  </div>
                )}

                {/* Add member */}
                {!showAddMember ? (
                  <button
                    type="button"
                    className="btn btn-sm d-flex align-items-center gap-2 mb-4"
                    style={{
                      borderRadius: 8, fontSize: 12, fontWeight: 600,
                      background: "#EFF6FF", border: "none", color: "#2563EB", padding: "7px 14px",
                    }}
                    onClick={() => setShowAddMember(true)}
                  >
                    <i className="ti ti-user-plus" style={{ fontSize: 14 }} />
                    Add Member
                  </button>
                ) : (
                  <div className="mb-4 p-3 rounded-3" style={{ background: "#F8FAFC", border: "1px solid #E2E8F0" }}>
                    <div className="d-flex align-items-center justify-content-between mb-2">
                      <span className="fw-semibold" style={{ fontSize: 13, color: "#0F172A" }}>Add a member</span>
                      <button type="button" className="btn-close" style={{ fontSize: 10 }}
                        onClick={() => { setShowAddMember(false); setAddMemberSearch(""); }} />
                    </div>
                    <input
                      type="text"
                      className="form-control form-control-sm mb-2"
                      style={{ borderRadius: 8, fontSize: 13 }}
                      placeholder="Search users…"
                      value={addMemberSearch}
                      onChange={(e) => setAddMemberSearch(e.target.value)}
                      autoFocus
                    />
                    <div style={{ maxHeight: 200, overflowY: "auto" }}>
                      {addMemberFiltered.length === 0 ? (
                        <p className="text-center py-2 mb-0" style={{ fontSize: 13, color: "#94A3B8" }}>No users to add</p>
                      ) : (
                        addMemberFiltered.map((u) => (
                          <div
                            key={`${u.userType}-${u.id}`}
                            role="button" tabIndex={0}
                            className="d-flex align-items-center gap-2 user-picker-row"
                            onClick={() => handleAddMember(u)}
                            onKeyDown={(e) => e.key === "Enter" && handleAddMember(u)}
                          >
                            <UserAvatar url={chatAvatarUrl(u.avatarUrl)} name={u.displayName} size={34} />
                            <div className="flex-fill">
                              <span className="fw-semibold" style={{ fontSize: 13 }}>{u.displayName}</span>
                              {" "}<RoleBadge role={u.userType} />
                            </div>
                            <i className="ti ti-user-plus" style={{ fontSize: 14, color: "#2563EB" }} />
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {/* Members list */}
                <p className="fw-semibold mb-3" style={{ fontSize: 13, color: "#334155" }}>
                  Members
                  <span className="ms-2 px-2 py-0" style={{
                    fontSize: 11, fontWeight: 700, background: "#F1F5F9",
                    color: "#64748B", borderRadius: 20, padding: "1px 7px",
                  }}>
                    {groupMembers.length}
                  </span>
                </p>
                {membersLoading ? (
                  <div className="text-center py-3" style={{ fontSize: 13, color: "#94A3B8" }}>
                    <i className="ti ti-loader d-block mb-1" style={{ fontSize: 20 }} />
                    Loading members…
                  </div>
                ) : groupMembers.length === 0 ? (
                  <p className="text-center py-2 mb-0" style={{ fontSize: 13, color: "#94A3B8" }}>No members yet</p>
                ) : (
                  <div style={{ maxHeight: 300, overflowY: "auto" }}>
                    {groupMembers.map((m) => {
                      const info = m.userInfo;
                      const name = info?.displayName ?? `${m.userType} #${m.userId}`;
                      const url  = chatAvatarUrl(info?.avatarUrl);
                      return (
                        <div key={m.id} className="group-member-row">
                          <UserAvatar url={url} name={name} size={36} />
                          <div className="flex-fill" style={{ minWidth: 0 }}>
                            <span className="member-name">{name}</span>
                            {" "}<RoleBadge role={m.userType} />
                          </div>
                          {/* canSend toggle */}
                          <button
                            type="button"
                            className="btn btn-sm d-flex align-items-center gap-1"
                            style={{
                              borderRadius: 6, fontSize: 11, fontWeight: 600, padding: "4px 10px",
                              background: m.canSend ? "#ECFDF5" : "#F1F5F9",
                              border: "none",
                              color: m.canSend ? "#059669" : "#94A3B8",
                            }}
                            onClick={() => handleToggleCanSend(m)}
                            title={m.canSend ? "Restrict from sending" : "Allow to send"}
                          >
                            <i className={`ti ${m.canSend ? "ti-volume" : "ti-volume-off"}`} style={{ fontSize: 12 }} />
                            {m.canSend ? "Can Send" : "Muted"}
                          </button>
                          {/* Remove */}
                          <button
                            type="button"
                            className="btn btn-sm d-flex align-items-center justify-content-center"
                            style={{ width: 30, height: 30, borderRadius: 8, background: "#FEF2F2",
                              border: "none", color: "#EF4444", flexShrink: 0, padding: 0 }}
                            onClick={() => handleRemoveMember(m)}
                            title="Remove from group"
                            aria-label="Remove member"
                          >
                            <i className="ti ti-user-minus" style={{ fontSize: 13 }} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Delete group */}
                <div className="mt-4 pt-4 border-top d-flex justify-content-between align-items-center">
                  <p className="mb-0" style={{ fontSize: 12, color: "#94A3B8" }}>
                    Deleting a group removes all messages permanently.
                  </p>
                  <button
                    type="button"
                    className="btn btn-sm d-flex align-items-center gap-2"
                    style={{ borderRadius: 8, fontSize: 12, fontWeight: 600,
                      background: "#FEF2F2", border: "none", color: "#EF4444", padding: "7px 14px" }}
                    onClick={() => handleDeleteGroup(managingGroup.id)}
                  >
                    <i className="ti ti-trash" style={{ fontSize: 13 }} />
                    Delete Group
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════ User Picker Modal ══════════════════ */}
      {showPicker && (
        <div
          className="modal fade show d-block"
          tabIndex={-1}
          style={{ backgroundColor: "rgba(15,23,42,.5)", zIndex: 1055 }}
          onClick={(e) => e.target === e.currentTarget && setShowPicker(false)}
        >
          <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: 460 }}>
            <div className="modal-content border-0 shadow-lg" style={{ borderRadius: 16 }}>
              <div className="d-flex align-items-start justify-content-between px-5 pt-5 pb-0">
                <div>
                  <h5 className="fw-bold mb-1" style={{ color: "#0F172A" }}>New Conversation</h5>
                  <p className="mb-0" style={{ fontSize: 13, color: "#64748B" }}>
                    Choose a person to start a private chat
                  </p>
                </div>
                <button type="button" className="btn-close" onClick={() => setShowPicker(false)} />
              </div>
              <div className="modal-body px-5 pt-4 pb-5">
                {/* Search */}
                <div className="position-relative mb-3">
                  <i className="ti ti-search position-absolute"
                    style={{ left: 12, top: "50%", transform: "translateY(-50%)", color: "#94A3B8", fontSize: 14 }} />
                  <input
                    type="text"
                    className="form-control"
                    style={{ borderRadius: 10, fontSize: 13, paddingLeft: 36, background: "#F8FAFC",
                      border: "1.5px solid #E2E8F0" }}
                    placeholder="Search by name or username…"
                    value={pickerSearch}
                    onChange={(e) => setPickerSearch(e.target.value)}
                    autoFocus
                  />
                </div>

                <div style={{ maxHeight: 380, overflowY: "auto" }}>
                  {filteredUsers.length === 0 ? (
                    <div className="text-center py-5" style={{ color: "#94A3B8" }}>
                      <i className="ti ti-user-off d-block mb-2" style={{ fontSize: 28 }} />
                      <p className="mb-0" style={{ fontSize: 13 }}>No users found</p>
                    </div>
                  ) : (
                    filteredUsers.map((u) => {
                      const online = isOnline(u.id, u.userType);
                      return (
                        <div
                          key={`${u.userType}-${u.id}`}
                          role="button" tabIndex={0}
                          className="user-picker-row d-flex align-items-center gap-3"
                          onClick={() => openFromPicker(u)}
                          onKeyDown={(e) => e.key === "Enter" && openFromPicker(u)}
                        >
                          <div className="position-relative flex-shrink-0">
                            <UserAvatar url={chatAvatarUrl(u.avatarUrl)} name={u.displayName} size={42} />
                            {online && (
                              <span
                                className="position-absolute border border-white rounded-circle"
                                style={{ width: 10, height: 10, background: "#22C55E", bottom: 0, right: 0 }}
                              />
                            )}
                          </div>
                          <div className="flex-fill" style={{ minWidth: 0 }}>
                            <div className="d-flex align-items-center gap-2">
                              <span className="fw-semibold text-truncate" style={{ fontSize: 14, color: "#0F172A" }}>
                                {u.displayName}
                              </span>
                              <RoleBadge role={u.userType} />
                            </div>
                            <span style={{ fontSize: 12, color: "#94A3B8" }}>@{u.username}</span>
                          </div>
                          <i className="ti ti-chevron-right" style={{ color: "#CBD5E1", fontSize: 16 }} />
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ChatComponent;
