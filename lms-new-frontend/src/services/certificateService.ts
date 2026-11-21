import { api_base_url, withAuthorization, withAuthorizationMultipart, handleResponse } from "./apiClient";
import type { Certificate, CreateCertificatePayload } from "@/types/certificate";

// ── List all certificates (admin) ─────────────────────────────────────────────
export const getAllCertificates = async (filters?: {
  courseId?: string;
  studentId?: string;
  status?: string;
}): Promise<Certificate[]> => {
  const params = new URLSearchParams();
  if (filters?.courseId) params.set("courseId", filters.courseId);
  if (filters?.studentId) params.set("studentId", filters.studentId);
  if (filters?.status) params.set("status", filters.status);
  const res = await fetch(`${api_base_url}/certificates?${params}`, {
    headers: withAuthorization(),
  });
  const data = await handleResponse<{ certificates: Certificate[] }>(res);
  return data.certificates ?? [];
};

// ── List student's certificates (issued + upcoming) ───────────────────────────
export const getStudentCertificates = async (studentId: number | string): Promise<Certificate[]> => {
  const res = await fetch(`${api_base_url}/certificates/student/${studentId}`, {
    headers: withAuthorization(),
  });
  const data = await handleResponse<{ certificates: Certificate[] }>(res);
  return data.certificates ?? [];
};

// ── Bulk create certificates for multiple students ────────────────────────────
export const bulkCreateCertificates = async (payload: {
  courseId: number | string;
  studentIds: (number | string)[];
  status: "upcoming" | "issued";
  notes?: string;
}): Promise<{ created: Certificate[]; skipped: { studentId: number; reason: string }[] }> => {
  const res = await fetch(`${api_base_url}/certificates/bulk-create`, {
    method: "POST",
    headers: { ...withAuthorization(), "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
};

// ── Create a certificate (upcoming or issued) ─────────────────────────────────
export const createCertificate = async (payload: CreateCertificatePayload): Promise<Certificate> => {
  const form = new FormData();
  form.append("courseId", String(payload.courseId));
  form.append("studentId", String(payload.studentId));
  form.append("status", payload.status);
  if (payload.notes) form.append("notes", payload.notes);
  if (payload.file) form.append("file", payload.file);

  const res = await fetch(`${api_base_url}/certificates/create`, {
    method: "POST",
    headers: withAuthorizationMultipart(),
    body: form,
  });
  const data = await handleResponse<{ certificate: Certificate }>(res);
  return data.certificate;
};

// ── Promote upcoming → issued ─────────────────────────────────────────────────
export const issueCertificateNow = async (id: number): Promise<Certificate> => {
  const res = await fetch(`${api_base_url}/certificates/${id}/issue`, {
    method: "PUT",
    headers: withAuthorization(),
  });
  const data = await handleResponse<{ certificate: Certificate }>(res);
  return data.certificate;
};

// ── Replace certificate image ─────────────────────────────────────────────────
export const uploadCertificateImage = async (id: number, file: File): Promise<{ templateImageUrl: string }> => {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${api_base_url}/certificates/${id}/upload-image`, {
    method: "PUT",
    headers: withAuthorizationMultipart(),
    body: form,
  });
  return handleResponse<{ templateImageUrl: string }>(res);
};

// ── Revoke ────────────────────────────────────────────────────────────────────
export const revokeCertificate = async (id: number): Promise<void> => {
  const res = await fetch(`${api_base_url}/certificates/${id}/revoke`, {
    method: "PUT",
    headers: withAuthorization(),
  });
  await handleResponse(res);
};

// ── Restore revoked → issued ──────────────────────────────────────────────────
export const restoreCertificate = async (id: number): Promise<void> => {
  const res = await fetch(`${api_base_url}/certificates/${id}/restore`, {
    method: "PUT",
    headers: withAuthorization(),
  });
  await handleResponse(res);
};

// ── Delete ────────────────────────────────────────────────────────────────────
export const deleteCertificate = async (id: number): Promise<void> => {
  const res = await fetch(`${api_base_url}/certificates/${id}`, {
    method: "DELETE",
    headers: withAuthorization(),
  });
  await handleResponse(res);
};
