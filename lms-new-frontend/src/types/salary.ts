export interface Salary {
  id: number;
  teacherId: number;
  amount: string;
  month: string;
  dueDate: string | null;
  status: "paid" | "unpaid" | "partial" | "overdue";
  paidDate: string | null;
  proofPath: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  Teacher?: {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
    imageUrl?: string | null;
  };
  CreatedBy?: {
    id: number;
    name: string;
    username: string;
  };
}

export interface CreateSalaryPayload {
  teacherId: number;
  amount: number;
  month: string;
  dueDate?: string | null;
  status?: "paid" | "unpaid" | "partial" | "overdue";
  paidDate?: string | null;
  notes?: string | null;
}

export interface UpdateSalaryPayload {
  amount?: number;
  month?: string;
  dueDate?: string | null;
  status?: "paid" | "unpaid" | "partial" | "overdue";
  paidDate?: string | null;
  notes?: string | null;
}
