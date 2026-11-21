import { api_base_url, withAuthorization, withAuthorizationMultipart, handleResponse } from "./apiClient";
import { StudentAssignmentsResponse, TeacherAssignmentsResponse } from "@/types/assignment";

export const fetchStudentAssignments = async (
  studentId: string
): Promise<StudentAssignmentsResponse> => {
  const response = await fetch(`${api_base_url}/assignment/student/${studentId}`, {
    method: "GET",
    headers: withAuthorization(),
  });
  return handleResponse<StudentAssignmentsResponse>(response);
};

export const fetchTeacherAssignments = async (
  teacherId: string
): Promise<TeacherAssignmentsResponse> => {
  const response = await fetch(`${api_base_url}/assignment/allAssignments/${teacherId}`, {
    method: "GET",
    headers: withAuthorization(),
  });
  return handleResponse<TeacherAssignmentsResponse>(response);
};

export const fetchTeacherSubmissions = async (
  teacherId: string
): Promise<{ assignments: import("@/types/assignment").SubmittedAssignment[] }> => {
  const response = await fetch(`${api_base_url}/assignment/teacher/${teacherId}`, {
    method: "GET",
    headers: withAuthorization(),
  });
  return handleResponse(response);
};

export const deleteAssignment = async (assignmentId: number): Promise<void> => {
  const response = await fetch(`${api_base_url}/assignment/${assignmentId}`, {
    method: "DELETE",
    headers: withAuthorization(),
  });
  return handleResponse(response);
};


export const createAssignment = async (
  formData: FormData
): Promise<{ message: string; assignment: import("@/types/assignment").Assignment }> => {
  const response = await fetch(`${api_base_url}/assignment/create`, {
    method: "POST",
    headers: withAuthorizationMultipart(),
    body: formData,
  });
  return handleResponse(response);
};

export const gradeAssignment = async (payload: {
  submittedAssignmentId: number;
  score: number;
  feedback?: string;
}): Promise<void> => {
  const response = await fetch(`${api_base_url}/assignment/grade`, {
    method: "POST",
    headers: withAuthorization(),
    body: JSON.stringify(payload),
  });
  return handleResponse(response);
};

export const updateAssignment = async (
  assignmentId: number,
  formData: FormData
): Promise<{ message: string; assignment: import("@/types/assignment").Assignment }> => {
  const response = await fetch(`${api_base_url}/assignment/update/${assignmentId}`, {
    method: "PUT",
    headers: withAuthorizationMultipart(),
    body: formData,
  });
  return handleResponse(response);
};

export const approveAssignment = async (id: number): Promise<void> => {
  const response = await fetch(`${api_base_url}/assignment/approve/${id}`, {
    method: "POST",
    headers: withAuthorization(),
  });
  return handleResponse(response);
};

export const rejectAssignment = async (id: number): Promise<void> => {
  const response = await fetch(`${api_base_url}/assignment/reject/${id}`, {
    method: "POST",
    headers: withAuthorization(),
  });
  return handleResponse(response);
};

export const submitAssignment = async (
  submittedAssignmentId: number,
  file: File
): Promise<{ message: string; submittedAssignment: import("@/types/assignment").SubmittedAssignment }> => {
  const formData = new FormData();
  formData.append("submittedAssignmentId", String(submittedAssignmentId));
  formData.append("file", file);
  const response = await fetch(`${api_base_url}/assignment/submit`, {
    method: "POST",
    headers: withAuthorizationMultipart(),
    body: formData,
  });
  return handleResponse(response);
};

export const fetchAllAssignmentsAdmin = async (): Promise<{ assignments: import("@/types/assignment").Assignment[] }> => {
  const response = await fetch(`${api_base_url}/assignment/admin/all`, {
    method: "GET",
    headers: withAuthorization(),
  });
  return handleResponse(response);
};
