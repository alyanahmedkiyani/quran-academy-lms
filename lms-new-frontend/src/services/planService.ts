import { api_base_url, withAuthorization, handleResponse } from "./apiClient";

export type BillingCycle = 'monthly' | 'quarterly' | 'yearly' | 'one-time';

export const BILLING_CYCLE_LABELS: Record<BillingCycle, string> = {
  monthly:   'Monthly (30 days)',
  quarterly: 'Quarterly (90 days)',
  yearly:    'Yearly (365 days)',
  'one-time': 'One-time (custom days)',
};

export const BILLING_CYCLE_DEFAULTS: Record<BillingCycle, number> = {
  monthly:   30,
  quarterly: 90,
  yearly:    365,
  'one-time': 30,
};

export interface Plan {
  id: number;
  name: string;
  price: number | string;
  description?: string;
  features?: string[];
  billingCycle: BillingCycle;
  durationDays: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreatePlanPayload {
  name: string;
  price: number | string;
  description?: string;
  features?: string[];
  billingCycle: BillingCycle;
  durationDays: number;
}

export interface UpdatePlanPayload extends CreatePlanPayload {
  id?: never;
}

export const fetchAllPlans = async (): Promise<Plan[]> => {
  const res = await fetch(`${api_base_url}/plans/all`, {
    headers: withAuthorization(),
  });
  const data = await handleResponse<{ plans: Plan[] }>(res);
  return data.plans ?? [];
};

export const createPlan = async (payload: CreatePlanPayload): Promise<Plan> => {
  const res = await fetch(`${api_base_url}/plans/add`, {
    method: "POST",
    headers: withAuthorization(),
    body: JSON.stringify(payload),
  });
  const data = await handleResponse<{ plan: Plan }>(res);
  return data.plan;
};

export const updatePlan = async (id: number, payload: UpdatePlanPayload): Promise<Plan> => {
  const res = await fetch(`${api_base_url}/plans/update/${id}`, {
    method: "PUT",
    headers: withAuthorization(),
    body: JSON.stringify(payload),
  });
  const data = await handleResponse<{ plan: Plan }>(res);
  return data.plan;
};

export const deletePlan = async (id: number): Promise<void> => {
  const res = await fetch(`${api_base_url}/plans/delete/${id}`, {
    method: "DELETE",
    headers: withAuthorization(),
  });
  await handleResponse<unknown>(res);
};
