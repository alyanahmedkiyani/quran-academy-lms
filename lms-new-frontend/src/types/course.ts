export interface Course {
  id: number | string;
  courseName: string;
  duration?: string;
  description?: string;
  price?: number;
  isComing?: boolean;
  imageUrl?: string | null;
  teacherCount?: number;
  studentCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface CoursesResponse {
  courses: Course[];
}

export interface CreateCoursePayload {
  courseName: string;
  duration?: string;
  description?: string;
  isComing?: boolean;
  price?: number;
  // image file is appended to FormData separately
}

export interface UpdateCoursePayload {
  courseName?: string;
  duration?: string;
  description?: string;
  isComing?: boolean;
  price?: number;
  // image file is appended to FormData separately
}

export interface CourseTeacher {
  id: number | string;
  firstName: string;
  lastName: string;
  email: string;
  username: string;
  imageUrl?: string | null;
}

export interface CourseStudent {
  id: number | string;
  firstName: string;
  lastName: string;
  email: string;
  username: string;
  profileImg?: string | null;
  nameForTeacher?: string | null;
}

export interface CourseDetail {
  id: number | string;
  courseId: number | string;
  teacherId?: number | string | null;
  studentId: number | string;
  Course?: Course;
  Teacher?: CourseTeacher;
  Student?: CourseStudent;
  createdAt?: string;
  updatedAt?: string;
}

export interface CourseDetailsResponse {
  course: CourseDetail[];
}

export interface AssignCoursePayload {
  courseId: number | string;
  teacherId: number | string;
  studentId: number | string;
}

export interface UpcomingCourse {
  id: number | string;
  courseId: number | string;
  teacherId?: number | string | null;
  studentId?: number | string | null;
  startingFrom?: string | null;
  isStarted?: boolean;
  Course?: Course;
  Teacher?: CourseTeacher;
  Student?: CourseStudent;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateUpcomingCoursePayload {
  courseId: number | string;
  teacherId?: number | string | null;
  studentId?: number | string | null;
  startingFrom?: string | null;
  isStarted?: boolean;
}

export interface UpdateUpcomingCoursePayload {
  courseId?: number | string;
  teacherId?: number | string | null;
  studentId?: number | string | null;
  startingFrom?: string | null;
  isStarted?: boolean;
}

export interface EnrolledCourse {
  id: number | string;
  studentId: number | string;
  courseId: number | string;
  Student?: CourseStudent;
  createdAt?: string;
  updatedAt?: string;
}

export interface EnrollPayload {
  courseId: number | string;
  studentId: number | string;
}
