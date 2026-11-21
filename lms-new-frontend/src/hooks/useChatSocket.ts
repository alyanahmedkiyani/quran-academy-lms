"use client";

import React, { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { useAppDispatch, useAppSelector } from "@/core/redux/hooks";
import {
  addGroupMessage,
  removeGroupMessage,
  addPrivateMessage,
  removePrivateMessage,
  addCurrentGroupMessage,
  removeCurrentGroupMessage,
  setOnlineUsers,
  upsertRecentChat,
  incrementUnread,
  fetchRecentChatsThunk,
} from "@/core/redux/chatSlice";
import { socket_url } from "@/environment";
import { getAccessToken } from "@/lib/auth-storage";
import { ChatMessage, OnlineUser } from "@/types/chat";
import type { ActiveConversation } from "@/core/redux/chatSlice";

interface UseChatSocketReturn {
  isConnected: boolean;
  sendGroupMessage: (message: string, senderId: number, senderType: string) => void;
  sendPrivateMessage: (
    message: string,
    senderId: number,
    senderType: string,
    receiverId: number,
    receiverType: string
  ) => void;
  sendVoiceGroupMessage: (
    senderId: number,
    senderType: string,
    mediaUrl: string,
    mediaDuration: number
  ) => void;
  sendVoicePrivateMessage: (
    senderId: number,
    senderType: string,
    receiverId: number,
    receiverType: string,
    mediaUrl: string,
    mediaDuration: number
  ) => void;
  sendChatGroupMessage: (
    groupId: number,
    senderId: number,
    senderType: string,
    message: string,
    messageType?: string,
    mediaUrl?: string,
    mediaDuration?: number
  ) => void;
  deleteMessage: (
    messageId: number,
    requesterId: number,
    requesterType: string
  ) => void;
  chatError: string | null;
  clearChatSocketError: () => void;
  socketRef: React.MutableRefObject<Socket | null>;
}

export function useChatSocket(
  userId: string,
  userType: string
): UseChatSocketReturn {
  const dispatch = useAppDispatch();
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  // Refs so socket callbacks always see the latest values without reconnecting
  const activeConvRef     = useRef<ActiveConversation | null>(null);
  const activeGroupIdRef  = useRef<number | null>(null);
  const userIdRef         = useRef(userId);
  const userTypeRef       = useRef(userType);

  const activeConversation = useAppSelector((s) => s.chat.activeConversation);
  const activeGroupId      = useAppSelector((s) => s.chat.activeGroupId);

  // Sync refs on each render
  useEffect(() => { activeConvRef.current  = activeConversation; }, [activeConversation]);
  useEffect(() => { activeGroupIdRef.current = activeGroupId; },   [activeGroupId]);
  useEffect(() => { userIdRef.current  = userId; },   [userId]);
  useEffect(() => { userTypeRef.current = userType; }, [userType]);

  useEffect(() => {
    if (!userId || !userType) return;

    const token = getAccessToken();

    const socket = io(socket_url, {
      path: "/chat/socket.io/",
      transports: ["websocket", "polling"],
      withCredentials: true,
      auth: { token },
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      setIsConnected(true);
      socket.emit("userConnected", { userId, userType });
    });

    socket.on("disconnect", () => {
      setIsConnected(false);
    });

    // Group messages
    socket.on("newMessage", (message: ChatMessage) => {
      dispatch(addGroupMessage(message));
    });

    // Private messages — only received by sender/receiver after backend fix
    socket.on("privateMessageSent", (message: ChatMessage) => {
      const myId   = parseInt(userIdRef.current);
      const myType = userTypeRef.current;
      const isSender =
        message.senderId === myId && message.senderType === myType;
      const activeConv = activeConvRef.current;

      // 1. Add to private messages list
      dispatch(addPrivateMessage(message));

      // 2. Optimistically update recentChats sidebar — no page refresh needed
      const otherUserHint =
        isSender && activeConv
          ? {
              id: activeConv.userId,
              userType: activeConv.userType,
              displayName: activeConv.displayName,
              avatarUrl: activeConv.avatarUrl,
            }
          : undefined;

      dispatch(
        upsertRecentChat({
          message,
          currentUserId: myId,
          currentUserType: myType,
          otherUserHint,
        })
      );

      // 3. Unread badge — only for incoming messages not in the open conversation
      if (!isSender) {
        const isActiveConvo =
          activeConv !== null &&
          message.senderId === activeConv.userId &&
          message.senderType === activeConv.userType;

        if (!isActiveConvo) {
          dispatch(incrementUnread(`${message.senderType}-${message.senderId}`));
        }
      }

      // 4. Background re-fetch for authoritative server data
      dispatch(
        fetchRecentChatsThunk({
          userId: userIdRef.current,
          userType: userTypeRef.current,
        })
      );
    });

    // Private group messages
    socket.on("newGroupMessage", (message: ChatMessage) => {
      if (message.groupId === activeGroupIdRef.current) {
        dispatch(addCurrentGroupMessage(message));
      }
    });

    // Message deleted — remove from all stores
    socket.on("messageDeleted", ({ id }: { id: number }) => {
      dispatch(removeGroupMessage(id));
      dispatch(removePrivateMessage(id));
      dispatch(removeCurrentGroupMessage(id));
    });

    // Online users list
    socket.on("onlineUsers", (users: OnlineUser[]) => {
      dispatch(setOnlineUsers(users));
    });

    // Server-side permission/chat errors
    socket.on("chatError", ({ message }: { message: string }) => {
      setChatError(message);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [userId, userType, dispatch]);

  const sendGroupMessage = (
    message: string,
    senderId: number,
    senderType: string
  ) => {
    socketRef.current?.emit("chatMessage", { message, senderId, senderType });
  };

  const sendPrivateMessage = (
    message: string,
    senderId: number,
    senderType: string,
    receiverId: number,
    receiverType: string
  ) => {
    socketRef.current?.emit("privateMessage", {
      message,
      senderId,
      senderType,
      receiverId,
      receiverType,
    });
  };

  const sendVoiceGroupMessage = (
    senderId: number,
    senderType: string,
    mediaUrl: string,
    mediaDuration: number
  ) => {
    socketRef.current?.emit("chatMessage", {
      message: "",
      senderId,
      senderType,
      messageType: "voice",
      mediaUrl,
      mediaDuration,
    });
  };

  const sendVoicePrivateMessage = (
    senderId: number,
    senderType: string,
    receiverId: number,
    receiverType: string,
    mediaUrl: string,
    mediaDuration: number
  ) => {
    socketRef.current?.emit("privateMessage", {
      message: "",
      senderId,
      senderType,
      receiverId,
      receiverType,
      messageType: "voice",
      mediaUrl,
      mediaDuration,
    });
  };

  const sendChatGroupMessage = (
    groupId: number,
    senderId: number,
    senderType: string,
    message: string,
    messageType = "text",
    mediaUrl?: string,
    mediaDuration?: number
  ) => {
    socketRef.current?.emit("groupMessage", {
      groupId,
      senderId,
      senderType,
      message,
      messageType,
      mediaUrl: mediaUrl ?? null,
      mediaDuration: mediaDuration ?? null,
    });
  };

  const deleteMessage = (
    messageId: number,
    requesterId: number,
    requesterType: string
  ) => {
    socketRef.current?.emit("deleteMessage", {
      messageId,
      requesterId,
      requesterType,
    });
  };

  const clearChatSocketError = () => setChatError(null);

  return {
    isConnected,
    sendGroupMessage,
    sendPrivateMessage,
    sendVoiceGroupMessage,
    sendVoicePrivateMessage,
    sendChatGroupMessage,
    deleteMessage,
    chatError,
    clearChatSocketError,
    socketRef,
  };
}
