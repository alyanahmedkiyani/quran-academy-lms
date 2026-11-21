export type NotificationPriority = "critical" | "warning" | "info";

export interface AppNotification {
  id: number;
  userId: number;
  userType: "admin" | "teacher" | "student" | "parent";
  title: string;
  message: string;
  isRead: boolean;
  priority: NotificationPriority;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationsResponse {
  notifications: AppNotification[];
  unreadCount: number;
}
