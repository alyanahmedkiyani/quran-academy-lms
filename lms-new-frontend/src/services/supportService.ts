import { api_base_url, withAuthorization, handleResponse } from "./apiClient";
import { SupportRequest, CreateSupportPayload, UpdateSupportPayload } from "@/types/support";

export const getAllSupportRequests = async (): Promise<SupportRequest[]> => {
  const res = await fetch(`${api_base_url}/support`, { headers: withAuthorization() });
  return handleResponse<SupportRequest[]>(res);
};

export const getSupportRequestsByUser = async (
  userId: number | string,
  userType: string
): Promise<SupportRequest[]> => {
  const res = await fetch(`${api_base_url}/support/user/${userId}/${userType}`, {
    headers: withAuthorization(),
  });
  return handleResponse<SupportRequest[]>(res);
};

export const createSupportRequest = async (payload: CreateSupportPayload): Promise<SupportRequest> => {
  const res = await fetch(`${api_base_url}/support`, {
    method: "POST",
    headers: withAuthorization(),
    body: JSON.stringify(payload),
  });
  return handleResponse<SupportRequest>(res);
};

export const updateSupportRequest = async (
  id: number,
  payload: UpdateSupportPayload
): Promise<SupportRequest> => {
  const res = await fetch(`${api_base_url}/support/${id}`, {
    method: "PUT",
    headers: withAuthorization(),
    body: JSON.stringify(payload),
  });
  return handleResponse<SupportRequest>(res);
};

export const deleteSupportRequest = async (id: number): Promise<void> => {
  const res = await fetch(`${api_base_url}/support/${id}`, {
    method: "DELETE",
    headers: withAuthorization(),
  });
  await handleResponse<unknown>(res);
};
