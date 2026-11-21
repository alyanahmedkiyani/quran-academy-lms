import { api_base_url, withAuthorization, withAuthorizationMultipart, handleResponse } from "./apiClient";
import {
  ChangeStudentPasswordPayload,
  CreateStudentPayload,
  PlansResponse,
  Student,
  StudentsResponse,
  UpdateStudentPayload,
} from "@/types/student";

export const fetchAllStudents = async (): Promise<StudentsResponse> => {
  const response = await fetch(`${api_base_url}/student/getAll`, {
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
  // Normalize: backend may return flat array or { students: [] }
  const students: Student[] = Array.isArray(raw)
    ? raw
    : (raw.students ?? raw.data ?? []);
  return { students };
};

export const fetchStudentById = async (studentId: string): Promise<Student> => {
  const response = await fetch(`${api_base_url}/student/getById/${studentId}`, {
    method: "GET",
    headers: withAuthorization(),
  });
  return handleResponse<Student>(response);
};

export const createStudent = async (payload: CreateStudentPayload): Promise<Student> => {
  const response = await fetch(`${api_base_url}/student/signup`, {
    method: "PUT",
    headers: withAuthorization(),
    body: JSON.stringify(payload),
  });
  return handleResponse<Student>(response);
};

export const updateStudent = async (
  studentId: string,
  payload: UpdateStudentPayload
): Promise<Student> => {
  const response = await fetch(`${api_base_url}/student/update/${studentId}`, {
    method: "PUT",
    headers: withAuthorization(),
    body: JSON.stringify(payload),
  });
  return handleResponse<Student>(response);
};

export const deleteStudent = async (studentId: string): Promise<{ message: string }> => {
  const response = await fetch(`${api_base_url}/student/${studentId}`, {
    method: "DELETE",
    headers: withAuthorization(),
  });
  return handleResponse<{ message: string }>(response);
};

export const changeStudentPassword = async (
  payload: ChangeStudentPasswordPayload
): Promise<{ message: string }> => {
  const response = await fetch(`${api_base_url}/admin/changeStudentPassword`, {
    method: "POST",
    headers: withAuthorization(),
    body: JSON.stringify(payload),
  });
  return handleResponse<{ message: string }>(response);
};

export const fetchPlans = async (): Promise<PlansResponse> => {
  const response = await fetch(`${api_base_url}/plans/all`, {
    method: "GET",
    headers: withAuthorization(),
  });
  return handleResponse<PlansResponse>(response);
};

export const toggleStudentStatus = async (studentId: string): Promise<{ status: string; id: number | string }> => {
  const response = await fetch(`${api_base_url}/student/${studentId}/status`, {
    method: "PATCH",
    headers: withAuthorization(),
  });
  return handleResponse<{ status: string; id: number | string }>(response);
};

export const bulkDeleteStudents = async (ids: string[]): Promise<void> => {
  await Promise.all(ids.map((id) => deleteStudent(id)));
};

export interface BulkImportResult {
  imported: number;
  failed: { row: number; reason: string }[];
}

export interface TopStudent {
  id: number;
  firstName: string;
  lastName: string;
  profileImg: string | null;
  totalPaid: number;
  courseCount: number;
}

export const fetchTopStudents = async (limit = 5): Promise<{ students: TopStudent[] }> => {
  const response = await fetch(`${api_base_url}/student/top-students?limit=${limit}`, {
    method: "GET",
    headers: withAuthorization(),
  });
  return handleResponse(response);
};

export const fetchStudentCountryStats = async (): Promise<{ countries: { country: string; count: number }[] }> => {
  const response = await fetch(`${api_base_url}/student/country-stats`, {
    method: "GET",
    headers: withAuthorization(),
  });
  return handleResponse(response);
};

export const fetchStudentGradeDistribution = async (): Promise<{ grades: { grade: string; count: number }[] }> => {
  const response = await fetch(`${api_base_url}/student/grade-distribution`, {
    method: "GET",
    headers: withAuthorization(),
  });
  return handleResponse(response);
};

export const bulkImportStudents = async (file: File): Promise<BulkImportResult> => {
  const formData = new FormData();
  formData.append("file", file);
  const response = await fetch(`${api_base_url}/student/bulk-import`, {
    method: "POST",
    headers: withAuthorizationMultipart(),
    body: formData,
  });
  return handleResponse<BulkImportResult>(response);
};
