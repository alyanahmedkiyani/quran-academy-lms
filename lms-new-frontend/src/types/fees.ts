export type FeeStatus = 'pending' | 'paid' | 'overdue' | 'cancelled';

export interface Fee {
  id: number;
  studentId: number;
  planId?: number | null;
  planChangeRequestId?: number | null;
  title: string;
  amount: number | string;
  status: FeeStatus;
  dueDate: string;
  paidDate?: string | null;
  invoicePath?: string | null;
  proofPath?: string | null;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
  Student?: {
    id: number;
    firstName: string;
    lastName: string;
    username: string;
    profileImg?: string | null;
  };
  Plan?: {
    id: number;
    name: string;
    price: number | string;
    billingCycle: string;
  } | null;
  planChangeRequest?: {
    id: number;
    status: PlanChangeStatus;
    requestedPlanId: number;
    studentId: number;
  } | null;
  CreatedBy?: {
    id: number;
    name: string;
    username: string;
  } | null;
}

export interface CreateFeePayload {
  studentId: number | string;
  planId?: number | string | null;
  title: string;
  amount: number | string;
  dueDate: string;
  notes?: string;
}

export interface UpdateFeePayload {
  status?: FeeStatus;
  notes?: string;
  dueDate?: string;
  paidDate?: string | null;
  title?: string;
  amount?: number | string;
  planId?: number | string | null;
}

export type PlanChangeStatus = 'pending' | 'approved' | 'rejected' | 'completed';

export interface PlanChangeRequest {
  id: number;
  studentId: number;
  currentPlanId?: number | null;
  requestedPlanId: number;
  status: PlanChangeStatus;
  paymentStatus?: 'pending' | 'paid';
  createdAt?: string;
  updatedAt?: string;
  Student?: {
    id: number;
    firstName: string;
    lastName: string;
    username?: string;
    profileImg?: string | null;
  };
  CurrentPlan?: {
    id: number;
    name: string;
    price: number | string;
  } | null;
  RequestedPlan?: {
    id: number;
    name: string;
    price: number | string;
  };
  paymentFee?: {
    id: number;
    status: FeeStatus;
    amount: number | string;
    dueDate: string;
    paidDate?: string | null;
  } | null;
}
