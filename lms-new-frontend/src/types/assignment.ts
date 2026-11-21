export type AssignmentStatus = "Not Started" | "Submitted" | "Graded";

export interface AssignmentCourse {
  id: number;
  courseName: string;
}

export interface AssignmentCourseDetails {
  id: number;
  Courses?: AssignmentCourse;
}

export interface AssignmentTeacher {
  id: number;
  firstName: string;
  lastName: string;
  imageUrl?: string | null;
}

export interface AssignmentStudent {
  id: number;
  firstName: string;
  lastName: string;
  profileImg?: string | null;
}

export type ContentStatus = "pending" | "active" | "rejected";

/** Assignment record created by teacher */
export interface Assignment {
  id: number;
  title: string;
  description?: string | null;
  dueDate?: string | null;
  fileUrl?: string | null;
  maxScore?: number | null;
  courseDetailsId?: number | null;
  teacherId?: number | null;
  status?: ContentStatus;
  createdAt?: string;
  CourseDetails?: AssignmentCourseDetails | null;
  Teacher?: AssignmentTeacher | null;
}

/** SubmittedAssignment — one per (assignment, student) */
export interface SubmittedAssignment {
  id: number;
  assignmentId: number;
  studentId: number;
  teacherId?: number | null;
  fileUrl?: string | null;
  submissionDate?: string | null;
  status: AssignmentStatus;
  score?: number | null;
  feedback?: string | null;
  Assignment?: Assignment | null;
  Student?: AssignmentStudent | null;
}

export interface StudentAssignmentsResponse {
  assignments: SubmittedAssignment[];
}

export interface TeacherAssignmentsResponse {
  assignments: Assignment[];
}
