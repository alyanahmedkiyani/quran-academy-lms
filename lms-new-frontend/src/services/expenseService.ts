import { api_base_url, withAuthorization, handleResponse } from "./apiClient";
import { Expense, ExpenseCategory, CreateExpensePayload, UpdateExpensePayload, Loss, CreateLossPayload, UpdateLossPayload } from "@/types/expenses";

// ── Expense Categories ────────────────────────────────────────────────────────

export const fetchExpenseCategories = async (): Promise<ExpenseCategory[]> => {
  const res = await fetch(`${api_base_url}/expenses/categories`, { headers: withAuthorization() });
  const data = await handleResponse<{ categories: ExpenseCategory[] }>(res);
  return data.categories ?? [];
};

export const createExpenseCategory = async (payload: { name: string; status?: string }): Promise<ExpenseCategory> => {
  const res = await fetch(`${api_base_url}/expenses/categories`, {
    method: "POST",
    headers: withAuthorization(),
    body: JSON.stringify(payload),
  });
  const data = await handleResponse<{ category: ExpenseCategory }>(res);
  return data.category;
};

export const updateExpenseCategory = async (id: number, payload: { name?: string; status?: string }): Promise<ExpenseCategory> => {
  const res = await fetch(`${api_base_url}/expenses/categories/${id}`, {
    method: "PUT",
    headers: withAuthorization(),
    body: JSON.stringify(payload),
  });
  const data = await handleResponse<{ category: ExpenseCategory }>(res);
  return data.category;
};

export const deleteExpenseCategory = async (id: number): Promise<void> => {
  const res = await fetch(`${api_base_url}/expenses/categories/${id}`, {
    method: "DELETE",
    headers: withAuthorization(),
  });
  await handleResponse<unknown>(res);
};

// ── Expenses ──────────────────────────────────────────────────────────────────

export const fetchExpenses = async (filters?: {
  status?: string;
  categoryId?: number | string;
  startDate?: string;
  endDate?: string;
}): Promise<Expense[]> => {
  const params = new URLSearchParams();
  if (filters?.status) params.set("status", filters.status);
  if (filters?.categoryId) params.set("categoryId", String(filters.categoryId));
  if (filters?.startDate) params.set("startDate", filters.startDate);
  if (filters?.endDate) params.set("endDate", filters.endDate);
  const res = await fetch(`${api_base_url}/expenses?${params}`, { headers: withAuthorization() });
  const data = await handleResponse<{ expenses: Expense[] }>(res);
  return data.expenses ?? [];
};

export const createExpense = async (payload: CreateExpensePayload): Promise<Expense> => {
  const res = await fetch(`${api_base_url}/expenses`, {
    method: "POST",
    headers: withAuthorization(),
    body: JSON.stringify(payload),
  });
  const data = await handleResponse<{ expense: Expense }>(res);
  return data.expense;
};

export const updateExpense = async (id: number, payload: UpdateExpensePayload): Promise<Expense> => {
  const res = await fetch(`${api_base_url}/expenses/${id}`, {
    method: "PUT",
    headers: withAuthorization(),
    body: JSON.stringify(payload),
  });
  const data = await handleResponse<{ expense: Expense }>(res);
  return data.expense;
};

export const deleteExpense = async (id: number): Promise<void> => {
  const res = await fetch(`${api_base_url}/expenses/${id}`, {
    method: "DELETE",
    headers: withAuthorization(),
  });
  await handleResponse<unknown>(res);
};

// ── Losses ────────────────────────────────────────────────────────────────────

export const fetchLosses = async (filters?: { startDate?: string; endDate?: string }): Promise<Loss[]> => {
  const params = new URLSearchParams();
  if (filters?.startDate) params.set("startDate", filters.startDate);
  if (filters?.endDate) params.set("endDate", filters.endDate);
  const res = await fetch(`${api_base_url}/expenses/losses?${params}`, { headers: withAuthorization() });
  const data = await handleResponse<{ losses: Loss[] }>(res);
  return data.losses ?? [];
};

export const createLoss = async (payload: CreateLossPayload): Promise<Loss> => {
  const res = await fetch(`${api_base_url}/expenses/losses`, {
    method: "POST",
    headers: withAuthorization(),
    body: JSON.stringify(payload),
  });
  const data = await handleResponse<{ loss: Loss }>(res);
  return data.loss;
};

export const updateLoss = async (id: number, payload: UpdateLossPayload): Promise<Loss> => {
  const res = await fetch(`${api_base_url}/expenses/losses/${id}`, {
    method: "PUT",
    headers: withAuthorization(),
    body: JSON.stringify(payload),
  });
  const data = await handleResponse<{ loss: Loss }>(res);
  return data.loss;
};

export const deleteLoss = async (id: number): Promise<void> => {
  const res = await fetch(`${api_base_url}/expenses/losses/${id}`, {
    method: "DELETE",
    headers: withAuthorization(),
  });
  await handleResponse<unknown>(res);
};

export const fetchTotalExpenses = async (year?: number, month?: number): Promise<number> => {
  const params = new URLSearchParams();
  if (year) params.set("year", String(year));
  if (month) params.set("month", String(month));
  const res = await fetch(`${api_base_url}/expenses/summary/total?${params}`, { headers: withAuthorization() });
  const data = await handleResponse<{ totalExpenses: number }>(res);
  return data.totalExpenses ?? 0;
};
