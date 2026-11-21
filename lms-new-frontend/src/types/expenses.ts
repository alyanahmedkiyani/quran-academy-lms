export type ExpenseStatus = 'New' | 'Pending' | 'Approved' | 'Rejected';
export type PaymentMethod = 'Cash' | 'Bank Transfer' | 'Credit Card' | 'Debit Card' | 'Cheque' | 'Other';
export type CategoryStatus = 'Active' | 'Inactive';

export interface ExpenseCategory {
  id: number;
  name: string;
  status: CategoryStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface Expense {
  id: number;
  title: string;
  categoryId?: number | null;
  amount: number | string;
  date: string;
  purchasedBy?: string | null;
  paymentMethod?: PaymentMethod | null;
  status: ExpenseStatus;
  notes?: string | null;
  createdById?: number | null;
  createdAt?: string;
  updatedAt?: string;
  Category?: ExpenseCategory | null;
  CreatedBy?: { id: number; name: string; username: string } | null;
}

export interface CreateExpensePayload {
  title: string;
  categoryId?: number | null;
  amount: number | string;
  date: string;
  purchasedBy?: string;
  paymentMethod?: PaymentMethod;
  status?: ExpenseStatus;
  notes?: string;
}

export interface UpdateExpensePayload {
  title?: string;
  categoryId?: number | null;
  amount?: number | string;
  date?: string;
  purchasedBy?: string;
  paymentMethod?: PaymentMethod;
  status?: ExpenseStatus;
  notes?: string;
}

export interface Loss {
  id: number;
  title: string;
  amount: number | string;
  date: string;
  reason?: string | null;
  notes?: string | null;
  createdById?: number | null;
  createdAt?: string;
  updatedAt?: string;
  CreatedBy?: { id: number; name: string; username: string } | null;
}

export interface CreateLossPayload {
  title: string;
  amount: number | string;
  date: string;
  reason?: string;
  notes?: string;
}

export interface UpdateLossPayload {
  title?: string;
  amount?: number | string;
  date?: string;
  reason?: string;
  notes?: string;
}
