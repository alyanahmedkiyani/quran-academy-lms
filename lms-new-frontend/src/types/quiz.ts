export interface QuizCourse {
  id: number;
  courseName: string;
}

export interface QuizCourseDetails {
  id: number;
  teacherId?: number | null;
  Courses?: QuizCourse;
}

export interface QuizTeacher {
  id: number;
  firstName: string;
  lastName: string;
  imageUrl?: string | null;
}

export type ContentStatus = "pending" | "active" | "rejected";

/** Quiz record */
export interface Quiz {
  id: number;
  title: string;
  instructions?: string | null;
  duration?: number | null;
  passingScore?: number | null;
  teacherId?: number | null;
  courseDetailsId?: number | null;
  studentId?: number | null;
  status?: ContentStatus;
  createdAt?: string;
  CourseDetails?: QuizCourseDetails | null;
  Teacher?: QuizTeacher | null;
  QuizAttempts?: QuizAttempt[] | null;
}

export interface QuizAttempt {
  id: number;
  quizId: number;
  studentId: number;
  startTime?: string | null;
  endTime?: string | null;
  score?: number | null;
}

export type QuestionType = "multiple_choice" | "true_false" | "short_answer";

export interface QuizQuestion {
  id: number;
  quizId: number;
  type: QuestionType;
  question: string;
  options?: string[] | null;
  correctAnswer: string;
}

export interface QuizWithQuestions extends Quiz {
  Questions?: QuizQuestion[];
}

/** Deduplicated group for teacher UI (one card per unique quiz content) */
export interface QuizGroup {
  representativeId: number;
  title: string;
  instructions?: string | null;
  duration?: number | null;
  passingScore?: number | null;
  teacherId?: number | null;
  teacherName?: string | null;
  courseId?: string | null;
  courseName?: string;
  status?: ContentStatus;
  studentCount: number;
  createdAt?: string;
}

/** Question Bank entry — reusable question template */
export interface QuestionBankEntry {
  id: number;
  type: QuestionType;
  question: string;
  options?: string[] | null;
  correctAnswer: string;
  subject?: string | null;
  createdBy?: number | null;
  createdAt?: string;
}

export interface EnrolledStudent {
  id: number;
  firstName: string;
  lastName: string;
  profileImg?: string | null;
  courseDetailsId: number;
}

export interface QuizResult {
  id: number;
  quizId: number;
  studentId: number;
  startTime?: string | null;
  endTime?: string | null;
  score?: number | null;
  Quiz?: {
    id: number;
    title: string;
    passingScore?: number | null;
    duration?: number | null;
    teacherId?: number | null;
    Teacher?: { id: number; firstName: string; lastName: string } | null;
  } | null;
  Student?: {
    id: number;
    firstName: string;
    lastName: string;
    profileImg?: string | null;
  } | null;
}
