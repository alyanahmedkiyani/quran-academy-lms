import { api_base_url, jsonHeaders, withAuthorization, handleResponse } from "./apiClient";
import { AuthResponse, LoginPayload } from "@/types/auth";

export const loginRequest = async (credentials: LoginPayload): Promise<AuthResponse> => {
  const response = await fetch(`${api_base_url}/auth/login`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify(credentials),
  });
  return handleResponse<AuthResponse>(response);
};

export const loginStudentRequest = async (credentials: LoginPayload): Promise<AuthResponse> => {
  const response = await fetch(`${api_base_url}/student/login`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify(credentials),
  });
  return handleResponse<AuthResponse>(response);
};

export const loginTeacherRequest = async (credentials: LoginPayload): Promise<AuthResponse> => {
  const response = await fetch(`${api_base_url}/teacher/login`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify(credentials),
  });
  return handleResponse<AuthResponse>(response);
};

export const loginParentRequest = async (credentials: LoginPayload): Promise<AuthResponse> => {
  const response = await fetch(`${api_base_url}/parent/login`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify(credentials),
  });
  return handleResponse<AuthResponse>(response);
};

export const signupParentRequest = async (data: Record<string, unknown>): Promise<{ message: string; userId: number }> => {
  const response = await fetch(`${api_base_url}/parent/signup`, {
    method: "PUT",
    headers: jsonHeaders,
    body: JSON.stringify(data),
  });
  return handleResponse(response);
};

export const fetchProfile = async (): Promise<AuthResponse["user"]> => {
  const response = await fetch(`${api_base_url}/auth/refresh-token`, {
    method: "GET",
    headers: withAuthorization(),
  });
  const payload = await handleResponse<AuthResponse>(response);
  return payload.user;
};
