import { api_base_url, withAuthorization, withAuthorizationMultipart, handleResponse } from "./apiClient";
import { Fee, CreateFeePayload, UpdateFeePayload, PlanChangeRequest } from "@/types/fees";

// ── Fee CRUD ─────────────────────────────────────────────────────────────────

export const getAllFees = async (filters?: { status?: string; studentId?: string }): Promise<Fee[]> => {
  const params = new URLSearchParams();
  if (filters?.status) params.set("status", filters.status);
  if (filters?.studentId) params.set("studentId", filters.studentId);
  const res = await fetch(`${api_base_url}/fees?${params}`, { headers: withAuthorization() });
  const data = await handleResponse<{ fees: Fee[] }>(res);
  return data.fees ?? [];
};

export const fetchRecentFeePayments = async (limit = 5, month?: number, year?: number): Promise<Fee[]> => {
  const params = new URLSearchParams({ status: "paid", limit: String(limit) });
  if (month) params.set("month", String(month));
  if (year)  params.set("year",  String(year));
  const res = await fetch(`${api_base_url}/fees?${params}`, { headers: withAuthorization() });
  const data = await handleResponse<{ fees: Fee[] }>(res);
  return data.fees ?? [];
};

export const getStudentFees = async (studentId: number | string): Promise<Fee[]> => {
  const res = await fetch(`${api_base_url}/fees/student/${studentId}`, { headers: withAuthorization() });
  const data = await handleResponse<{ fees: Fee[] }>(res);
  return data.fees ?? [];
};

export const createFee = async (payload: CreateFeePayload): Promise<Fee> => {
  const res = await fetch(`${api_base_url}/fees`, {
    method: "POST",
    headers: withAuthorization(),
    body: JSON.stringify(payload),
  });
  const data = await handleResponse<{ fee: Fee }>(res);
  return data.fee;
};

export const updateFee = async (id: number, payload: UpdateFeePayload): Promise<Fee> => {
  const res = await fetch(`${api_base_url}/fees/${id}`, {
    method: "PUT",
    headers: withAuthorization(),
    body: JSON.stringify(payload),
  });
  const data = await handleResponse<{ fee: Fee }>(res);
  return data.fee;
};

export const deleteFee = async (id: number): Promise<void> => {
  const res = await fetch(`${api_base_url}/fees/${id}`, {
    method: "DELETE",
    headers: withAuthorization(),
  });
  await handleResponse<unknown>(res);
};

export const uploadInvoice = async (feeId: number, file: File): Promise<Fee> => {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${api_base_url}/fees/${feeId}/upload-invoice`, {
    method: "POST",
    headers: withAuthorizationMultipart(),
    body: formData,
  });
  const data = await handleResponse<{ fee: Fee }>(res);
  return data.fee;
};

export const uploadProof = async (feeId: number, file: File): Promise<Fee> => {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${api_base_url}/fees/${feeId}/upload-proof`, {
    method: "POST",
    headers: withAuthorizationMultipart(),
    body: formData,
  });
  const data = await handleResponse<{ fee: Fee }>(res);
  return data.fee;
};

// ── Plan Change Requests ─────────────────────────────────────────────────────

export const getAllPlanChangeRequests = async (): Promise<PlanChangeRequest[]> => {
  const res = await fetch(`${api_base_url}/planchange/requests`, { headers: withAuthorization() });
  const data = await handleResponse<{ requests: PlanChangeRequest[] }>(res);
  return data.requests ?? [];
};

export const requestPlanChange = async (studentId: number | string, requestedPlanId: number | string): Promise<PlanChangeRequest> => {
  const res = await fetch(`${api_base_url}/planchange/request-change`, {
    method: "POST",
    headers: withAuthorization(),
    body: JSON.stringify({ studentId, requestedPlanId }),
  });
  const data = await handleResponse<{ request: PlanChangeRequest }>(res);
  return data.request;
};

export const approvePlanChangeRequest = async (requestId: number | string): Promise<void> => {
  const res = await fetch(`${api_base_url}/planchange/plan-change-requests/${requestId}/approve`, {
    method: "POST",
    headers: withAuthorization(),
  });
  await handleResponse<unknown>(res);
};

export const rejectPlanChangeRequest = async (requestId: number | string): Promise<void> => {
  const res = await fetch(`${api_base_url}/planchange/plan-change-requests/${requestId}/reject`, {
    method: "POST",
    headers: withAuthorization(),
  });
  await handleResponse<unknown>(res);
};
