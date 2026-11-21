import { api_base_url, withAuthorization, handleResponse } from "./apiClient";
import {
  ChangeTeacherPasswordPayload,
  CreateTeacherPayload,
  Teacher,
  TeachersResponse,
  UpdateTeacherPayload,
} from "@/types/teacher";

export const fetchAllTeachers = async (): Promise<TeachersResponse> => {
  const response = await fetch(`${api_base_url}/teacher/teachers`, {
    method: "GET",
    headers: withAuthorization(),
  });
  return handleResponse<TeachersResponse>(response);
};

export const createTeacher = async (payload: CreateTeacherPayload): Promise<Teacher> => {
  const response = await fetch(`${api_base_url}/teacher/signup`, {
    method: "PUT",
    headers: withAuthorization(),
    body: JSON.stringify(payload),
  });
  return handleResponse<Teacher>(response);
};

export const updateTeacher = async (
  teacherId: string,
  payload: UpdateTeacherPayload
): Promise<Teacher> => {
  const response = await fetch(`${api_base_url}/teacher/update/${teacherId}`, {
    method: "PUT",
    headers: withAuthorization(),
    body: JSON.stringify(payload),
  });
  return handleResponse<Teacher>(response);
};

export const deleteTeacher = async (teacherId: string): Promise<{ message: string }> => {
  const response = await fetch(`${api_base_url}/teacher/${teacherId}`, {
    method: "DELETE",
    headers: withAuthorization(),
  });
  return handleResponse<{ message: string }>(response);
};

export const changeTeacherPassword = async (
  payload: ChangeTeacherPasswordPayload
): Promise<{ message: string }> => {
  const response = await fetch(`${api_base_url}/admin/changeTeacherPassword`, {
    method: "POST",
    headers: withAuthorization(),
    body: JSON.stringify(payload),
  });
  return handleResponse<{ message: string }>(response);
};

export const fetchTeacherById = async (teacherId: string): Promise<Teacher> => {
  const response = await fetch(`${api_base_url}/teacher/getById/${teacherId}`, {
    method: "GET",
    headers: withAuthorization(),
  });
  return handleResponse<Teacher>(response);
};

export const toggleTeacherPublishPermission = async (
  teacherId: string,
  canDirectlyPublish: boolean
): Promise<{ message: string; teacher: Teacher }> => {
  const response = await fetch(`${api_base_url}/teacher/update/${teacherId}`, {
    method: "PUT",
    headers: withAuthorization(),
    body: JSON.stringify({ canDirectlyPublish }),
  });
  return handleResponse<{ message: string; teacher: Teacher }>(response);
};

export const bulkDeleteTeachers = async (ids: string[]): Promise<void> => {
  const response = await fetch(`${api_base_url}/teacher/bulk`, {
    method: "DELETE",
    headers: withAuthorization(),
    body: JSON.stringify({ ids }),
  });
  await handleResponse<{ message: string; ids: string[] }>(response);
};
