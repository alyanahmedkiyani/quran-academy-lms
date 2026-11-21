import { api_base_url, withAuthorization, handleResponse } from "./apiClient";
import { AppNotification, NotificationsResponse } from "@/types/notification";

export const fetchNotifications = async (
  userId: string,
  userType: string
): Promise<NotificationsResponse> => {
  const response = await fetch(
    `${api_base_url}/notifications?userId=${userId}&userType=${userType}`,
    { method: "GET", headers: withAuthorization() }
  );
  return handleResponse<NotificationsResponse>(response);
};

export const markNotificationRead = async (id: number): Promise<void> => {
  const response = await fetch(`${api_base_url}/notifications/${id}/read`, {
    method: "PATCH",
    headers: withAuthorization(),
  });
  return handleResponse<void>(response);
};

export const markAllNotificationsRead = async (
  userId: string,
  userType: string
): Promise<void> => {
  const response = await fetch(
    `${api_base_url}/notifications/read-all?userId=${userId}&userType=${userType}`,
    { method: "PATCH", headers: withAuthorization() }
  );
  return handleResponse<void>(response);
};

export const deleteNotification = async (id: number): Promise<void> => {
  const response = await fetch(`${api_base_url}/notifications/${id}`, {
    method: "DELETE",
    headers: withAuthorization(),
  });
  return handleResponse<void>(response);
};
