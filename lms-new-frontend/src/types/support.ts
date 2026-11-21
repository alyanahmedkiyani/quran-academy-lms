export type SupportPriority = "high" | "medium" | "normal";
export type SupportStatus = "pending" | "resolved" | "rejected";
export type SupportUserType = "student" | "teacher";

export interface SupportRequest {
  id: number;
  title: string;
  problem: string;
  userId: number;
  userType: SupportUserType;
  priority: SupportPriority;
  responseFromAdmin: string | null;
  status: SupportStatus;
  createdAt: string;
  updatedAt: string;
  student?: { firstName: string; lastName: string; profileImg: string | null };
  teacher?: { firstName: string; lastName: string; imageUrl: string | null };
}

export interface CreateSupportPayload {
  title: string;
  problem: string;
  userId: number | string;
  userType: SupportUserType;
  priority: SupportPriority;
}

export interface UpdateSupportPayload {
  title?: string;
  problem?: string;
  priority?: SupportPriority;
  responseFromAdmin?: string;
  status?: SupportStatus;
}
