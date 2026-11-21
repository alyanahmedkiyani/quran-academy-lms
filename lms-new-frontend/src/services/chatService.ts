import { api_base_url, withAuthorization, withAuthorizationMultipart, handleResponse } from "./apiClient";
import { ChatGroup, ChatGroupMember, ChatMessage, ChatUser, RecentChat } from "@/types/chat";

const BASE = `${api_base_url}/chat`;

// ---------------------------------------------------------------------------
// Fetch all public group messages
// ---------------------------------------------------------------------------
export const getGroupMessages = async (): Promise<ChatMessage[]> => {
  const response = await fetch(`${BASE}/messages`, {
    method: "GET",
    headers: withAuthorization(),
  });
  const data = await handleResponse<{ messages: ChatMessage[] }>(response);
  return data.messages;
};

// ---------------------------------------------------------------------------
// Fetch all private messages for a user (across all conversations)
// ---------------------------------------------------------------------------
export const getPrivateMessages = async (
  userId: string,
  userType: string
): Promise<ChatMessage[]> => {
  const response = await fetch(
    `${BASE}/private-messages/${userId}/${userType}`,
    {
      method: "GET",
      headers: withAuthorization(),
    }
  );
  return handleResponse<ChatMessage[]>(response);
};

// ---------------------------------------------------------------------------
// Fetch recent private chat partners (sidebar list)
// ---------------------------------------------------------------------------
export const getRecentChats = async (
  userId: string,
  userType: string
): Promise<RecentChat[]> => {
  const response = await fetch(
    `${BASE}/recent-chats/${userId}/${userType}`,
    {
      method: "GET",
      headers: withAuthorization(),
    }
  );
  return handleResponse<RecentChat[]>(response);
};

// ---------------------------------------------------------------------------
// Fetch allowed chat targets for the "New Conversation" picker (role-filtered)
// ---------------------------------------------------------------------------
export const getAllChatUsers = async (userId: string | number, userType: string): Promise<ChatUser[]> => {
  const response = await fetch(`${BASE}/users?userId=${userId}&userType=${userType}`, {
    method: "GET",
    headers: withAuthorization(),
  });
  const data = await handleResponse<{ users: ChatUser[] }>(response);
  return data.users;
};

// ---------------------------------------------------------------------------
// Group chat API calls
// ---------------------------------------------------------------------------
const GROUP_BASE = `${api_base_url}/chat/groups`;

export const fetchGroups = async (userId: number, userType: string): Promise<ChatGroup[]> => {
  const response = await fetch(`${GROUP_BASE}?userId=${userId}&userType=${userType}`, {
    method: "GET",
    headers: withAuthorization(),
  });
  const data = await handleResponse<{ groups: ChatGroup[] }>(response);
  return data.groups;
};

export const createGroup = async (name: string, createdBy: number, createdByType: string): Promise<ChatGroup> => {
  const response = await fetch(GROUP_BASE, {
    method: "POST",
    headers: withAuthorization(),
    body: JSON.stringify({ name, createdBy, createdByType }),
  });
  const data = await handleResponse<{ group: ChatGroup }>(response);
  return data.group;
};

export const deleteGroup = async (groupId: number): Promise<void> => {
  const response = await fetch(`${GROUP_BASE}/${groupId}`, {
    method: "DELETE",
    headers: withAuthorization(),
  });
  await handleResponse<unknown>(response);
};

export const fetchGroupMembers = async (groupId: number): Promise<ChatGroupMember[]> => {
  const response = await fetch(`${GROUP_BASE}/${groupId}/members`, {
    method: "GET",
    headers: withAuthorization(),
  });
  const data = await handleResponse<{ members: ChatGroupMember[] }>(response);
  return data.members;
};

export const addGroupMember = async (groupId: number, userId: number, userType: string): Promise<ChatGroupMember> => {
  const response = await fetch(`${GROUP_BASE}/${groupId}/members`, {
    method: "POST",
    headers: withAuthorization(),
    body: JSON.stringify({ userId, userType }),
  });
  const data = await handleResponse<{ member: ChatGroupMember }>(response);
  return data.member;
};

export const removeGroupMember = async (groupId: number, memberId: number): Promise<void> => {
  const response = await fetch(`${GROUP_BASE}/${groupId}/members/${memberId}`, {
    method: "DELETE",
    headers: withAuthorization(),
  });
  await handleResponse<unknown>(response);
};

export const toggleMemberCanSend = async (groupId: number, memberId: number, canSend: boolean): Promise<ChatGroupMember> => {
  const response = await fetch(`${GROUP_BASE}/${groupId}/members/${memberId}`, {
    method: "PATCH",
    headers: withAuthorization(),
    body: JSON.stringify({ canSend }),
  });
  const data = await handleResponse<{ member: ChatGroupMember }>(response);
  return data.member;
};

export const fetchGroupMessages = async (groupId: number): Promise<ChatMessage[]> => {
  const response = await fetch(`${GROUP_BASE}/${groupId}/messages`, {
    method: "GET",
    headers: withAuthorization(),
  });
  const data = await handleResponse<{ messages: ChatMessage[] }>(response);
  return data.messages;
};

// ---------------------------------------------------------------------------
// Upload a voice message blob to the server
// NOTE: No Content-Type header — browser sets the multipart boundary automatically
// ---------------------------------------------------------------------------
export const uploadVoiceMessage = async (
  blob: Blob
): Promise<{ mediaUrl: string }> => {
  const formData = new FormData();
  formData.append("voice", blob, "voice.webm");
  const response = await fetch(`${BASE}/upload-voice`, {
    method: "POST",
    headers: withAuthorizationMultipart(),
    body: formData,
  });
  return handleResponse<{ mediaUrl: string }>(response);
};


export const fetchUnreadCounts = async (
  userId: string,
  userType: string
): Promise<Record<string, number>> => {
  const response = await fetch(
    `${BASE}/unread-counts?userId=${userId}&userType=${userType}`,
    { headers: withAuthorization() }
  );
  const data = await handleResponse<{ counts: Record<string, number> }>(response);
  return data.counts;
};

export const markConversationReadApi = async (
  userId: string,
  userType: string,
  senderId: number,
  senderType: string
): Promise<void> => {
  await fetch(`${BASE}/mark-read`, {
    method: "POST",
    headers: withAuthorization(),
    body: JSON.stringify({ userId, userType, senderId, senderType }),
  });
};
