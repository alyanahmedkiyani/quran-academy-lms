import { createAsyncThunk, createSlice, PayloadAction } from "@reduxjs/toolkit";
import {
  getGroupMessages,
  getPrivateMessages,
  getRecentChats,
  getAllChatUsers,
  fetchGroups,
  fetchGroupMessages,
  fetchUnreadCounts,
} from "@/services/chatService";
import { ChatGroup, ChatMessage, ChatUser, OnlineUser, RecentChat, SenderDetails } from "@/types/chat";

type AsyncStatus = "idle" | "loading" | "succeeded" | "failed";

export interface ActiveConversation {
  userId: number;
  userType: string;
  displayName: string;
  avatarUrl?: string | null;
}

interface ChatState {
  groupMessages: ChatMessage[];
  groupStatus: AsyncStatus;

  privateMessages: ChatMessage[];
  privateStatus: AsyncStatus;

  recentChats: RecentChat[];
  recentStatus: AsyncStatus;

  allUsers: ChatUser[];
  usersStatus: AsyncStatus;

  onlineUsers: OnlineUser[];

  activeConversation: ActiveConversation | null;

  /** key = `${userType}-${userId}`, value = unread message count */
  unreadCounts: Record<string, number>;

  error: string | null;

  // ── Group chat ────────────────────────────────────────────
  chatGroups: ChatGroup[];
  chatGroupsStatus: AsyncStatus;
  /** ID of the group currently open in the chat panel */
  activeGroupId: number | null;
  /** Messages for the currently active group */
  currentGroupMessages: ChatMessage[];
  currentGroupMessagesStatus: AsyncStatus;
}

const initialState: ChatState = {
  groupMessages: [],
  groupStatus: "idle",

  privateMessages: [],
  privateStatus: "idle",

  recentChats: [],
  recentStatus: "idle",

  allUsers: [],
  usersStatus: "idle",

  onlineUsers: [],

  activeConversation: null,

  unreadCounts: {},

  error: null,

  chatGroups: [],
  chatGroupsStatus: "idle",
  activeGroupId: null,
  currentGroupMessages: [],
  currentGroupMessagesStatus: "idle",
};

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message || fallback);
  }
  return fallback;
};

// ─────────────────────────────────────────────────────────────────────────────
// Thunks
// ─────────────────────────────────────────────────────────────────────────────

export const fetchGroupMessagesThunk = createAsyncThunk<
  ChatMessage[],
  void,
  { rejectValue: string }
>("chat/fetchGroupMessages", async (_, { rejectWithValue }) => {
  try {
    return await getGroupMessages();
  } catch (error) {
    return rejectWithValue(getErrorMessage(error, "Unable to load group messages."));
  }
});

export const fetchPrivateMessagesThunk = createAsyncThunk<
  ChatMessage[],
  { userId: string; userType: string },
  { rejectValue: string }
>("chat/fetchPrivateMessages", async ({ userId, userType }, { rejectWithValue }) => {
  try {
    return await getPrivateMessages(userId, userType);
  } catch (error) {
    return rejectWithValue(getErrorMessage(error, "Unable to load private messages."));
  }
});

export const fetchRecentChatsThunk = createAsyncThunk<
  RecentChat[],
  { userId: string; userType: string },
  { rejectValue: string }
>("chat/fetchRecentChats", async ({ userId, userType }, { rejectWithValue }) => {
  try {
    return await getRecentChats(userId, userType);
  } catch (error) {
    return rejectWithValue(getErrorMessage(error, "Unable to load recent chats."));
  }
});

export const fetchAllUsersThunk = createAsyncThunk<
  ChatUser[],
  { userId: string | number; userType: string },
  { rejectValue: string }
>("chat/fetchAllUsers", async ({ userId, userType }, { rejectWithValue }) => {
  try {
    return await getAllChatUsers(userId, userType);
  } catch (error) {
    return rejectWithValue(getErrorMessage(error, "Unable to load users."));
  }
});

export const fetchUnreadCountsThunk = createAsyncThunk<
  Record<string, number>,
  { userId: string; userType: string },
  { rejectValue: string }
>("chat/fetchUnreadCounts", async ({ userId, userType }, { rejectWithValue }) => {
  try {
    return await fetchUnreadCounts(userId, userType);
  } catch (error) {
    return rejectWithValue(getErrorMessage(error, "Unable to load unread counts."));
  }
});

export const fetchChatGroupsThunk = createAsyncThunk<
  ChatGroup[],
  { userId: number; userType: string },
  { rejectValue: string }
>("chat/fetchChatGroups", async ({ userId, userType }, { rejectWithValue }) => {
  try {
    return await fetchGroups(userId, userType);
  } catch (error) {
    return rejectWithValue(getErrorMessage(error, "Unable to load groups."));
  }
});

export const fetchCurrentGroupMessagesThunk = createAsyncThunk<
  ChatMessage[],
  number,
  { rejectValue: string }
>("chat/fetchCurrentGroupMessages", async (groupId, { rejectWithValue }) => {
  try {
    return await fetchGroupMessages(groupId);
  } catch (error) {
    return rejectWithValue(getErrorMessage(error, "Unable to load group messages."));
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Slice
// ─────────────────────────────────────────────────────────────────────────────
const chatSlice = createSlice({
  name: "chat",
  initialState,
  reducers: {
    addGroupMessage(state, action: PayloadAction<ChatMessage>) {
      if (!state.groupMessages.some((m) => m.id === action.payload.id)) {
        state.groupMessages.push(action.payload);
      }
    },
    removeGroupMessage(state, action: PayloadAction<number>) {
      state.groupMessages = state.groupMessages.filter((m) => m.id !== action.payload);
    },
    addPrivateMessage(state, action: PayloadAction<ChatMessage>) {
      if (!state.privateMessages.some((m) => m.id === action.payload.id)) {
        state.privateMessages.push(action.payload);
      }
    },
    removePrivateMessage(state, action: PayloadAction<number>) {
      state.privateMessages = state.privateMessages.filter((m) => m.id !== action.payload);
    },
    setOnlineUsers(state, action: PayloadAction<OnlineUser[]>) {
      state.onlineUsers = action.payload;
    },
    setActiveConversation(state, action: PayloadAction<ActiveConversation>) {
      state.activeConversation = action.payload;
    },
    clearActiveConversation(state) {
      state.activeConversation = null;
    },
    clearChatError(state) {
      state.error = null;
    },

    /**
     * Optimistically update `recentChats` whenever a private message is sent
     * or received, so the sidebar stays in sync without a page refresh.
     *
     * - For INCOMING messages: `senderDetails` IS the other person → full data
     * - For OUTGOING messages: we rely on `otherUserHint` from activeConversation
     *   (passed by the socket hook which has a ref to it)
     */
    upsertRecentChat(
      state,
      action: PayloadAction<{
        message: ChatMessage;
        currentUserId: number;
        currentUserType: string;
        otherUserHint?: {
          id: number;
          userType: string;
          displayName: string;
          avatarUrl?: string | null;
        };
      }>
    ) {
      const { message, currentUserId, currentUserType, otherUserHint } = action.payload;

      const isSender =
        message.senderId === currentUserId && message.senderType === currentUserType;

      const otherId   = isSender ? (message.receiverId   ?? 0)  : message.senderId;
      const otherType = isSender ? (message.receiverType ?? "") : message.senderType;

      if (!otherId || !otherType) return;

      // Build otherUserDetails from whatever data is available
      // Use Number() to guard against string/number mismatch from raw SQL responses
      const existingIdx = state.recentChats.findIndex(
        (rc) =>
          Number(rc.otherUserDetails?.id) === Number(otherId) &&
          rc.otherUserDetails?.userType === otherType
      );

      let otherUserDetails: (SenderDetails & { userType: string }) | null =
        existingIdx >= 0 ? state.recentChats[existingIdx].otherUserDetails : null;

      if (!isSender && message.senderDetails) {
        // Incoming: senderDetails is the other person — perfect, full data
        otherUserDetails = { ...message.senderDetails, userType: otherType };
      } else if (isSender && otherUserHint) {
        // Outgoing: use the hint from activeConversation
        const nameParts = otherUserHint.displayName.split(" ");
        otherUserDetails = {
          id: otherUserHint.id,
          userType: otherUserHint.userType,
          firstName: nameParts[0],
          lastName: nameParts.slice(1).join(" ") || undefined,
          profileImg: otherUserHint.avatarUrl ?? null,
        } as SenderDetails & { userType: string };
      }
      // If neither condition applies (outgoing, no hint, no existing) the
      // entry will be sparse but fetchRecentChatsThunk will fill it in shortly.

      const updatedEntry: RecentChat = {
        ...message,
        otherUserDetails,
      };

      if (existingIdx >= 0) {
        // Update last-message preview and move to top
        state.recentChats.splice(existingIdx, 1);
        state.recentChats.unshift(updatedEntry);
      } else {
        state.recentChats.unshift(updatedEntry);
      }
    },

    /**
     * Increment unread count for a conversation that's not currently open.
     * key = `${senderType}-${senderId}`
     */
    incrementUnread(state, action: PayloadAction<string>) {
      const key = action.payload;
      state.unreadCounts[key] = (state.unreadCounts[key] ?? 0) + 1;
    },

    /**
     * Clear unread count when the user opens a conversation.
     * key = `${userType}-${userId}` of the OTHER person
     */
    markConversationRead(state, action: PayloadAction<string>) {
      delete state.unreadCounts[action.payload];
    },

    // ── Group chat reducers ─────────────────────────────────
    setActiveGroupId(state, action: PayloadAction<number | null>) {
      state.activeGroupId = action.payload;
      if (action.payload === null) {
        state.currentGroupMessages = [];
        state.currentGroupMessagesStatus = "idle";
      }
    },
    addCurrentGroupMessage(state, action: PayloadAction<ChatMessage>) {
      if (!state.currentGroupMessages.some((m) => m.id === action.payload.id)) {
        state.currentGroupMessages.push(action.payload);
      }
    },
    removeCurrentGroupMessage(state, action: PayloadAction<number>) {
      state.currentGroupMessages = state.currentGroupMessages.filter((m) => m.id !== action.payload);
    },
    addChatGroup(state, action: PayloadAction<ChatGroup>) {
      if (!state.chatGroups.some((g) => g.id === action.payload.id)) {
        state.chatGroups.unshift(action.payload);
      }
    },
    removeChatGroup(state, action: PayloadAction<number>) {
      state.chatGroups = state.chatGroups.filter((g) => g.id !== action.payload);
      if (state.activeGroupId === action.payload) {
        state.activeGroupId = null;
        state.currentGroupMessages = [];
      }
    },
    updateGroupMemberCount(state, action: PayloadAction<{ groupId: number; delta: number }>) {
      const group = state.chatGroups.find((g) => g.id === action.payload.groupId);
      if (group) {
        group.memberCount = Math.max(0, (group.memberCount ?? 0) + action.payload.delta);
      }
    },
  },

  extraReducers: (builder) => {
    builder
      // fetchGroupMessages
      .addCase(fetchGroupMessagesThunk.pending, (state) => {
        state.groupStatus = "loading";
        state.error = null;
      })
      .addCase(fetchGroupMessagesThunk.fulfilled, (state, action) => {
        state.groupMessages = action.payload;
        state.groupStatus = "succeeded";
      })
      .addCase(fetchGroupMessagesThunk.rejected, (state, action) => {
        state.groupStatus = "failed";
        state.error = action.payload ?? "Unable to load group messages.";
      })

      // fetchPrivateMessages
      .addCase(fetchPrivateMessagesThunk.pending, (state) => {
        state.privateStatus = "loading";
        state.error = null;
      })
      .addCase(fetchPrivateMessagesThunk.fulfilled, (state, action) => {
        state.privateMessages = action.payload;
        state.privateStatus = "succeeded";
      })
      .addCase(fetchPrivateMessagesThunk.rejected, (state, action) => {
        state.privateStatus = "failed";
        state.error = action.payload ?? "Unable to load private messages.";
      })

      // fetchRecentChats — replace full list (authoritative server data)
      .addCase(fetchRecentChatsThunk.pending, (state) => {
        state.recentStatus = "loading";
      })
      .addCase(fetchRecentChatsThunk.fulfilled, (state, action) => {
        // Deduplicate by other-user identity (guards against SQL timestamp collisions)
        const seen = new Set<string>();
        state.recentChats = action.payload.filter((rc) => {
          const key = `${rc.otherUserDetails?.userType}-${Number(rc.otherUserDetails?.id)}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        state.recentStatus = "succeeded";
      })
      .addCase(fetchRecentChatsThunk.rejected, (state, action) => {
        state.recentStatus = "failed";
        state.error = action.payload ?? "Unable to load recent chats.";
      })

      // fetchAllUsers
      .addCase(fetchAllUsersThunk.pending, (state) => {
        state.usersStatus = "loading";
      })
      .addCase(fetchAllUsersThunk.fulfilled, (state, action) => {
        state.allUsers = action.payload;
        state.usersStatus = "succeeded";
      })
      .addCase(fetchAllUsersThunk.rejected, (state, action) => {
        state.usersStatus = "failed";
        state.error = action.payload ?? "Unable to load users.";
      })

      // fetchChatGroups
      .addCase(fetchChatGroupsThunk.pending, (state) => {
        state.chatGroupsStatus = "loading";
      })
      .addCase(fetchChatGroupsThunk.fulfilled, (state, action) => {
        state.chatGroups = action.payload;
        state.chatGroupsStatus = "succeeded";
      })
      .addCase(fetchChatGroupsThunk.rejected, (state, action) => {
        state.chatGroupsStatus = "failed";
        state.error = action.payload ?? "Unable to load groups.";
      })

      // fetchCurrentGroupMessages
      .addCase(fetchCurrentGroupMessagesThunk.pending, (state) => {
        state.currentGroupMessagesStatus = "loading";
        state.currentGroupMessages = [];
      })
      .addCase(fetchCurrentGroupMessagesThunk.fulfilled, (state, action) => {
        state.currentGroupMessages = action.payload;
        state.currentGroupMessagesStatus = "succeeded";
      })
      .addCase(fetchCurrentGroupMessagesThunk.rejected, (state, action) => {
        state.currentGroupMessagesStatus = "failed";
        state.error = action.payload ?? "Unable to load group messages.";
      })

      // fetchUnreadCounts — seed unreadCounts from backend on page load
      .addCase(fetchUnreadCountsThunk.fulfilled, (state, action) => {
        state.unreadCounts = { ...state.unreadCounts, ...action.payload };
      });
  },
});

export const {
  addGroupMessage,
  removeGroupMessage,
  addPrivateMessage,
  removePrivateMessage,
  setOnlineUsers,
  setActiveConversation,
  clearActiveConversation,
  clearChatError,
  upsertRecentChat,
  incrementUnread,
  markConversationRead,
  setActiveGroupId,
  addCurrentGroupMessage,
  removeCurrentGroupMessage,
  addChatGroup,
  removeChatGroup,
  updateGroupMemberCount,
} = chatSlice.actions;

export default chatSlice.reducer;
