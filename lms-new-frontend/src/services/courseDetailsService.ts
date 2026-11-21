import { api_base_url, withAuthorization, handleResponse } from "./apiClient";
import { AssignCoursePayload, CourseDetail, CourseDetailsResponse } from "@/types/course";

export const fetchAllCourseDetails = async (): Promise<CourseDetailsResponse> => {
  const response = await fetch(`${api_base_url}/course/getCourses`, {
    method: "GET",
    headers: withAuthorization(),
  });
  return handleResponse<CourseDetailsResponse>(response);
};

export const fetchCoursesByTeacherId = async (teacherId: string): Promise<CourseDetailsResponse> => {
  const response = await fetch(`${api_base_url}/course/getCourseByTeacherId/${teacherId}`, {
    method: "GET",
    headers: withAuthorization(),
  });
  return handleResponse<CourseDetailsResponse>(response);
};

export const fetchCoursesByStudentId = async (studentId: string): Promise<CourseDetailsResponse> => {
  const response = await fetch(`${api_base_url}/course/getCourseByStdId/${studentId}`, {
    method: "GET",
    headers: withAuthorization(),
  });
  return handleResponse<CourseDetailsResponse>(response);
};

export const assignCourse = async (payload: AssignCoursePayload): Promise<{ message: string; course: CourseDetail }> => {
  const response = await fetch(`${api_base_url}/course/assignCourse`, {
    method: "PUT",
    headers: withAuthorization(),
    body: JSON.stringify(payload),
  });
  return handleResponse<{ message: string; course: CourseDetail }>(response);
};

export const unassignCourse = async (courseDetailId: string): Promise<{ message: string }> => {
  const response = await fetch(`${api_base_url}/course/${courseDetailId}`, {
    method: "DELETE",
    headers: withAuthorization(),
  });
  return handleResponse<{ message: string }>(response);
};

export const fetchTopCoursesByEnrollment = async (limit = 5): Promise<{ courses: { name: string; count: number }[] }> => {
  const response = await fetch(`${api_base_url}/course/top-by-enrollment?limit=${limit}`, {
    method: "GET",
    headers: withAuthorization(),
  });
  return handleResponse(response);
};
