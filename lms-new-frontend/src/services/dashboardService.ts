import { api_base_url, withAuthorization, handleResponse } from "./apiClient";

export interface DashboardStats {
  teachers:   { total: number; newInLast7Days: number; percentChange: number };
  students:   { total: number; newInLast7Days: number; percentChange: number };
  courses:    { total: number; newInLast7Days: number; percentChange: number };
  fees:       { totalCollected: number; last7Days: number; percentChange: number };
  enrollment: { total: number; active: number; dropped: number; pending: number };
}

export const fetchAdminDashboardStats = async (): Promise<DashboardStats> => {
  const response = await fetch(`${api_base_url}/admin/dashboard-stats`, {
    headers: withAuthorization(),
  });
  return handleResponse<DashboardStats>(response);
};

export interface TeacherDashboardStats {
  totalCourses: number;
  totalStudents: number;
  pendingReview: number;
  activeQuizzes: number;
}

export const fetchTeacherDashboardStats = async (teacherId: string | number): Promise<TeacherDashboardStats> => {
  const response = await fetch(`${api_base_url}/teacher/dashboard-stats/${teacherId}`, {
    headers: withAuthorization(),
  });
  return handleResponse<TeacherDashboardStats>(response);
};

export interface StudentDashboardStats {
  enrolledCourses: number;
  pendingAssignments: number;
  upcomingQuizzes: number;
  attendanceRate: number;
}

export const fetchStudentDashboardStats = async (studentId: string | number): Promise<StudentDashboardStats> => {
  const response = await fetch(`${api_base_url}/student/dashboard-stats/${studentId}`, {
    headers: withAuthorization(),
  });
  return handleResponse<StudentDashboardStats>(response);
};
