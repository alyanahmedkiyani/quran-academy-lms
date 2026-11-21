import { api_base_url, withAuthorization, handleResponse } from "./apiClient";
import {
  ChangeParentPasswordPayload,
  CreateParentPayload,
  Parent,
  ParentsResponse,
  UpdateParentPayload,
} from "@/types/parent";

export const fetchAllParents = async (): Promise<ParentsResponse> => {
  const response = await fetch(`${api_base_url}/parent/getAll`, {
    method: "GET",
    headers: withAuthorization(),
  });
  const raw = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      (raw && (raw.message || raw.error)) ||
      "Something went wrong. Please try again.";
    throw new Error(message as string);
  }
  // Normalize: backend may return flat array or { parents: [] }
  const parents: Parent[] = Array.isArray(raw)
    ? raw
    : (raw.parents ?? raw.data ?? []);
  return { parents };
};

export const createParent = async (payload: CreateParentPayload): Promise<Parent> => {
  const response = await fetch(`${api_base_url}/parent/signup`, {
    method: "PUT",
    headers: withAuthorization(),
    body: JSON.stringify(payload),
  });
  return handleResponse<Parent>(response);
};

export const updateParent = async (
  parentId: string,
  payload: UpdateParentPayload
): Promise<Parent> => {
  const response = await fetch(`${api_base_url}/parent/update/${parentId}`, {
    method: "PUT",
    headers: withAuthorization(),
    body: JSON.stringify(payload),
  });
  return handleResponse<Parent>(response);
};

export const deleteParent = async (parentId: string): Promise<{ message: string }> => {
  const response = await fetch(`${api_base_url}/parent/${parentId}`, {
    method: "DELETE",
    headers: withAuthorization(),
  });
  return handleResponse<{ message: string }>(response);
};

export const fetchParentById = async (parentId: string): Promise<Parent> => {
  const response = await fetch(`${api_base_url}/parent/getById/${parentId}`, {
    method: "GET",
    headers: withAuthorization(),
  });
  return handleResponse<Parent>(response);
};

export const toggleParentStatus = async (parentId: string): Promise<{ isActive: boolean }> => {
  const response = await fetch(`${api_base_url}/parent/${parentId}/toggle-status`, {
    method: "PATCH",
    headers: withAuthorization(),
  });
  return handleResponse<{ isActive: boolean }>(response);
};

export const changeParentPassword = async (
  payload: ChangeParentPasswordPayload
): Promise<{ message: string }> => {
  const response = await fetch(`${api_base_url}/admin/changeParentPassword`, {
    method: "POST",
    headers: withAuthorization(),
    body: JSON.stringify(payload),
  });
  return handleResponse<{ message: string }>(response);
};
