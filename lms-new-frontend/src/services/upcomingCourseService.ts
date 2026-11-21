import { api_base_url, withAuthorization, handleResponse } from "./apiClient";
import {
  UpcomingCourse,
  CreateUpcomingCoursePayload,
  UpdateUpcomingCoursePayload,
  EnrolledCourse,
  EnrollPayload,
} from "@/types/course";

export const fetchAllUpcomingCourses = async (): Promise<UpcomingCourse[]> => {
  const response = await fetch(`${api_base_url}/upcomingCourses`, {
    method: "GET",
    headers: withAuthorization(),
  });
  return handleResponse<UpcomingCourse[]>(response);
};

export const createUpcomingCourse = async (
  payload: CreateUpcomingCoursePayload
): Promise<UpcomingCourse> => {
  const response = await fetch(`${api_base_url}/upcomingCourses`, {
    method: "POST",
    headers: withAuthorization(),
    body: JSON.stringify(payload),
  });
  return handleResponse<UpcomingCourse>(response);
};

export const updateUpcomingCourse = async (
  id: string,
  payload: UpdateUpcomingCoursePayload
): Promise<UpcomingCourse> => {
  const response = await fetch(`${api_base_url}/upcomingCourses/${id}`, {
    method: "PUT",
    headers: withAuthorization(),
    body: JSON.stringify(payload),
  });
  return handleResponse<UpcomingCourse>(response);
};

export const deleteUpcomingCourse = async (id: string): Promise<{ message: string }> => {
  const response = await fetch(`${api_base_url}/upcomingCourses/${id}`, {
    method: "DELETE",
    headers: withAuthorization(),
  });
  return handleResponse<{ message: string }>(response);
};

export const enrollStudent = async (payload: EnrollPayload): Promise<{ message: string }> => {
  const response = await fetch(`${api_base_url}/upcomingCourses/enroll`, {
    method: "POST",
    headers: withAuthorization(),
    body: JSON.stringify(payload),
  });
  return handleResponse<{ message: string }>(response);
};

export const fetchEnrolledCoursesByStudent = async (
  studentId: string
): Promise<EnrolledCourse[]> => {
  const response = await fetch(
    `${api_base_url}/upcomingCourses/enrolledCourses/${studentId}`,
    {
      method: "GET",
      headers: withAuthorization(),
    }
  );
  return handleResponse<EnrolledCourse[]>(response);
};

export const fetchEnrolledStudentsByCourse = async (
  courseId: string
): Promise<EnrolledCourse[]> => {
  const response = await fetch(
    `${api_base_url}/upcomingCourses/enrolledCoursesWithCourseId/${courseId}`,
    {
      method: "GET",
      headers: withAuthorization(),
    }
  );
  return handleResponse<EnrolledCourse[]>(response);
};
