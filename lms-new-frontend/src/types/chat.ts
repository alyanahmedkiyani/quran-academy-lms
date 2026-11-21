export type ChatUserType = "admin" | "teacher" | "student" | "parent";

export interface SenderDetails {
  id: number;
  firstName?: string;
  lastName?: string;
  username?: string;
  /** Admin uses `name` instead of firstName/lastName */
  name?: string;
  profileImg?: string | null;
  imageUrl?: string | null;
  userType?: string;
}

export interface ChatMessage {
  id: number;
  message: string;
  senderId: number;
  senderType: ChatUserType;
  receiverId?: number | null;
  receiverType?: string | null;
  isPrivate: boolean;
  createdAt: string;
  updatedAt: string;
  senderDetails?: SenderDetails | null;
  /** 'voice' when this is a voice recording; omitted/undefined means plain text */
  messageType?: 'text' | 'voice';
  /** Relative path to the stored audio file, e.g. "resources/2026-…-voice.webm" */
  mediaUrl?: string | null;
  /** Duration of the voice clip in seconds */
  mediaDuration?: number | null;
  /** Set when this message belongs to a group chat */
  groupId?: number | null;
}

export interface RecentChat extends ChatMessage {
  otherUserDetails: (SenderDetails & { userType: string }) | null;
}

export interface ChatUser {
  id: number;
  displayName: string;
  username: string;
  userType: ChatUserType;
  avatarUrl?: string | null;
}

export interface OnlineUser {
  socketId: string;
  userType: string;
  details: SenderDetails;
}

export interface ChatGroup {
  id: number;
  name: string;
  createdBy: number;
  createdByType: string;
  createdAt: string;
  updatedAt: string;
  memberCount?: number;
}

export interface ChatGroupMember {
  id: number;
  groupId: number;
  userId: number;
  userType: ChatUserType;
  canSend: boolean;
  userInfo?: ChatUser | null;
}
