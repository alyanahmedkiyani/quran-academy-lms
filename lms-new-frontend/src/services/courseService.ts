import { api_base_url, withAuthorization, withAuthorizationMultipart, handleResponse } from "./apiClient";
import { Course, CoursesResponse } from "@/types/course";

export const fetchAllCourses = async (): Promise<CoursesResponse> => {
  const response = await fetch(`${api_base_url}/admin/getAllCourses`, {
    method: "GET",
    headers: withAuthorization(),
  });
  return handleResponse<CoursesResponse>(response);
};

export const createCourse = async (formData: FormData): Promise<{ message: string; newCourse: Course }> => {
  const response = await fetch(`${api_base_url}/admin/addCourse`, {
    method: "POST",
    headers: withAuthorizationMultipart(),
    body: formData,
  });
  return handleResponse<{ message: string; newCourse: Course }>(response);
};

export const updateCourse = async (
  courseId: string,
  formData: FormData
): Promise<{ message: string; course: Course }> => {
  const response = await fetch(`${api_base_url}/admin/updateCourse/${courseId}`, {
    method: "PUT",
    headers: withAuthorizationMultipart(),
    body: formData,
  });
  return handleResponse<{ message: string; course: Course }>(response);
};

export const deleteCourse = async (courseId: string): Promise<{ message: string }> => {
  const response = await fetch(`${api_base_url}/admin/deleteCourse/${courseId}`, {
    method: "DELETE",
    headers: withAuthorization(),
  });
  return handleResponse<{ message: string }>(response);
};
