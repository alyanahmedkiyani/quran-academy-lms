// ─── Shared ───────────────────────────────────────────────────────────────────

export type AttendanceStatus = 'Present' | 'Absent';
export type AsyncStatus = 'idle' | 'loading' | 'succeeded' | 'failed';

// ─── Student Attendance ───────────────────────────────────────────────────────

export interface StudentAttendance {
  id: number;
  studentId: number;
  courseDetailsId: number | null;
  sessionId: number | null;
  date: string;
  status: AttendanceStatus;
  Student?: {
    id: number;
    firstName: string;
    lastName: string;
    profileImg?: string | null;
  };
  CourseDetail?: {
    id: number;
    courseId: number;
    teacherId: number;
    Course?: { id: number; courseName: string };
    Teacher?: { id: number; firstName: string; lastName: string; imageUrl?: string | null };
  };
  ClassSession?: {
    id: number;
    title: string;
    date: string;
    startTime: string;
    endTime: string;
  };
}

export interface AttendanceSummary {
  courseDetailsId: number;
  courseId: number | null;
  courseName: string;
  totalSessions: number;
  presentCount: number;
  absentCount: number;
  percentage: number;
}

export interface AttendanceStats {
  total: number;
  present: number;
  absent: number;
  percentage: number;
}

// ─── Session Attendance Sheet (bulk marking) ──────────────────────────────────

export interface AttendanceStudent {
  studentId: number;
  courseDetailsId: number | null;
  firstName: string;
  lastName: string;
  profileImg?: string | null;
  status: AttendanceStatus | null; // null = not yet marked
}

export interface SessionInfo {
  id: number;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  course?: { id: number; courseName: string } | null;
  teacher?: { id: number; firstName: string; lastName: string } | null;
}

export interface SessionAttendanceSheet {
  session: SessionInfo;
  students: AttendanceStudent[];
}

export interface BulkMarkRecord {
  studentId: number;
  courseDetailsId: number | null;
  status: AttendanceStatus;
}

export interface BulkMarkPayload {
  sessionId: number;
  records: BulkMarkRecord[];
}

// ─── Teacher Session Item (for dropdown) ──────────────────────────────────────

export interface TeacherSessionItem {
  id: number;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  Course?: { id: number; courseName: string } | null;
}

// ─── Teacher Attendance ───────────────────────────────────────────────────────

export interface TeacherAttendanceRecord {
  id: number;
  teacherId: number;
  date: string;
  checkInTime: string | null;
  checkOutTime: string | null;
  status: AttendanceStatus;
  notes?: string | null;
  Teacher?: {
    id: number;
    firstName: string;
    lastName: string;
    imageUrl?: string | null;
  };
}

// ─── Admin Filters ────────────────────────────────────────────────────────────

export interface AdminStudentAttendanceFilter {
  startDate?: string;
  endDate?: string;
  teacherId?: number;
  courseId?: number;
  studentId?: number;
  page?: number;
  limit?: number;
}

export interface AdminTeacherAttendanceFilter {
  startDate?: string;
  endDate?: string;
  teacherId?: number;
  page?: number;
  limit?: number;
}

export interface AdminStudentAttendanceResponse {
  attendance: StudentAttendance[];
  total: number;
  page: number;
  stats: AttendanceStats;
}

export interface AdminTeacherAttendanceResponse {
  records: TeacherAttendanceRecord[];
  total: number;
  page: number;
  stats: AttendanceStats;
}
