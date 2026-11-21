import { api_base_url, withAuthorization, withAuthorizationMultipart, handleResponse } from "./apiClient";

// ─── Teacher ──────────────────────────────────────────────────────────────────

export interface TeacherProfile {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  username: string;
  contact: string;
  cnic: string;
  imageUrl?: string | null;
}

export const getTeacherById = async (id: string): Promise<TeacherProfile> => {
  const res = await fetch(`${api_base_url}/teacher/getById/${id}`, {
    headers: withAuthorization(),
  });
  const data = await handleResponse<{ teacher: TeacherProfile }>(res);
  return data.teacher;
};

export const updateTeacher = async (
  id: string,
  data: Partial<Omit<TeacherProfile, "id" | "username" | "imageUrl">>,
): Promise<{ message: string; teacher: TeacherProfile }> => {
  const res = await fetch(`${api_base_url}/teacher/update/${id}`, {
    method: "PUT",
    headers: withAuthorization(),
    body: JSON.stringify(data),
  });
  return handleResponse(res);
};

export const uploadTeacherImage = async (id: string, file: File): Promise<{ imageUrl: string }> => {
  const form = new FormData();
  form.append("teacherId", id);
  form.append("file", file);
  const res = await fetch(`${api_base_url}/teacher/upload-image`, {
    method: "POST",
    headers: withAuthorizationMultipart(),
    body: form,
  });
  return handleResponse(res);
};

export const getTeacherImageUrl = (id: string) => `${api_base_url}/teacher/profileImage/${id}`;

// ─── Student ──────────────────────────────────────────────────────────────────

export interface StudentProfile {
  id: number;
  firstName: string;
  lastName?: string | null;
  email?: string | null;
  username: string;
  contact?: string | null;
  address?: string | null;
  dateOfBirth?: string | null;
  guardian?: string | null;
  emergencyContact?: string | null;
  countryName?: string | null;
  state?: string | null;
  city?: string | null;
  timeZone?: string | null;
  classTime?: string | null;
  newClassTime?: string | null;
  nameForTeacher?: string | null;
  profileImg?: string | null;
}

export const getStudentById = async (id: string): Promise<StudentProfile> => {
  const res = await fetch(`${api_base_url}/student/getById/${id}`, {
    headers: withAuthorization(),
  });
  const data = await handleResponse<{ student: StudentProfile }>(res);
  return data.student;
};

export const updateStudent = async (
  id: string,
  data: Partial<Omit<StudentProfile, "id" | "username" | "profileImg">>,
): Promise<{ message: string; student: StudentProfile }> => {
  const res = await fetch(`${api_base_url}/student/update/${id}`, {
    method: "PUT",
    headers: withAuthorization(),
    body: JSON.stringify(data),
  });
  return handleResponse(res);
};

export const uploadStudentImage = async (id: string, file: File): Promise<{ imageUrl: string }> => {
  const form = new FormData();
  form.append("studentId", id);
  form.append("file", file);
  const res = await fetch(`${api_base_url}/student/upload-image`, {
    method: "POST",
    headers: withAuthorizationMultipart(),
    body: form,
  });
  return handleResponse(res);
};

export const getStudentImageUrl = (id: string) => `${api_base_url}/student/profileImage/${id}`;

// ─── Parent ───────────────────────────────────────────────────────────────────

export interface ParentProfile {
  id: number;
  firstName: string;
  lastName?: string | null;
  email?: string | null;
  username: string;
  contact?: string | null;
  address?: string | null;
  dateOfBirth?: string | null;
  guardian?: string | null;
  emergencyContact?: string | null;
  profileImg?: string | null;
}

export const getParentById = async (id: string): Promise<ParentProfile> => {
  const res = await fetch(`${api_base_url}/parent/getById/${id}`, {
    headers: withAuthorization(),
  });
  const data = await handleResponse<{ parent: ParentProfile }>(res);
  return data.parent;
};

export const updateParent = async (
  id: string,
  data: Partial<Omit<ParentProfile, "id" | "username" | "profileImg">>,
): Promise<{ message: string }> => {
  const res = await fetch(`${api_base_url}/parent/update/${id}`, {
    method: "PUT",
    headers: withAuthorization(),
    body: JSON.stringify(data),
  });
  return handleResponse(res);
};

export const uploadParentImage = async (id: string, file: File): Promise<{ imageUrl: string }> => {
  const form = new FormData();
  form.append("parentId", id);
  form.append("file", file);
  const res = await fetch(`${api_base_url}/parent/upload-image`, {
    method: "POST",
    headers: withAuthorizationMultipart(),
    body: form,
  });
  return handleResponse(res);
};

export const getParentImageUrl = (id: string) => `${api_base_url}/parent/profileImage/${id}`;

// ─── Admin ────────────────────────────────────────────────────────────────────

export const updateAdmin = async (
  id: string,
  data: { name?: string },
): Promise<{ message: string }> => {
  const res = await fetch(`${api_base_url}/admin/update/${id}`, {
    method: "PUT",
    headers: withAuthorization(),
    body: JSON.stringify(data),
  });
  return handleResponse(res);
};

export const uploadAdminImage = async (id: string, file: File): Promise<{ imageUrl: string }> => {
  const form = new FormData();
  form.append("adminId", id);
  form.append("file", file);
  const res = await fetch(`${api_base_url}/admin/upload-image`, {
    method: "POST",
    headers: withAuthorizationMultipart(),
    body: form,
  });
  return handleResponse(res);
};

export const getAdminImageUrl = (id: string) => `${api_base_url}/admin/profileImage/${id}`;
