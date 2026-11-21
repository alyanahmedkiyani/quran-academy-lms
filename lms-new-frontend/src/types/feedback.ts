export interface FeedbackRatings {
  teachingQuality: number; // 1-5
  contentClarity: number;  // 1-5
  sessionPace: number;     // 1-5
  engagement: number;      // 1-5
  overallRating: number;   // 1-5
}

export interface SessionFeedbackItem extends FeedbackRatings {
  id: number;
  sessionId: number;
  studentId?: number; // omitted in teacher (anonymous) view
  comment?: string | null;
  createdAt: string;
  Student?: { id: number; firstName: string; lastName: string; profileImg?: string };
  ClassSession?: { id: number; title: string; date: string; teacherId?: number; courseId?: number };
}

export interface FeedbackSummary {
  count: number;
  teachingQuality: number;
  contentClarity: number;
  sessionPace: number;
  engagement: number;
  overallRating: number;
}

export interface PerSessionSummary {
  sessionId: number;
  sessionTitle: string;
  date: string;
  count: number;
  feedback: FeedbackSummary | null;
}

export interface TeacherFeedbackSummary {
  teacherId: number;
  teacherName: string;
  imageUrl?: string | null;
  count: number;
  teachingQuality: number;
  contentClarity: number;
  sessionPace: number;
  engagement: number;
  overallRating: number;
}

export interface AdminFeedbackSummaryResponse {
  total: number;
  overallSummary: FeedbackSummary | null;
  teacherSummaries: TeacherFeedbackSummary[];
  recentFeedbacks: SessionFeedbackItem[];
}

export interface SubmitFeedbackPayload extends FeedbackRatings {
  studentId: number;
  comment?: string;
}

export interface SessionFeedbackResponse {
  feedbacks: SessionFeedbackItem[];
  summary: FeedbackSummary | null;
}

export interface TeacherFeedbackResponse extends SessionFeedbackResponse {
  perSession: PerSessionSummary[];
}

// The info stored when a session ends to prompt feedback from students
export interface PendingFeedbackSession {
  sessionId: number;
  sessionTitle: string;
  // Today's Lesson — from teacher at session end
  lessonTitle?: string | null;
  lessonDescription?: string | null;
  lessonDueDate?: string | null;
}
