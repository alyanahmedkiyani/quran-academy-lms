import { api_base_url, withAuthorization, handleResponse } from "./apiClient";

export interface MonthlyDataPoint {
  month: number;
  revenue: number;
}

export interface PaymentRecord {
  amount: number | string;
  paymentDate: string;
}

export const fetchPaymentRecords = async (
  startDate: string,
  endDate: string
): Promise<PaymentRecord[]> => {
  const params = new URLSearchParams({ startDate, endDate });
  const res = await fetch(`${api_base_url}/payment/records?${params}`, {
    headers: withAuthorization(),
  });
  const data = await handleResponse<{ payments: PaymentRecord[] }>(res);
  return data.payments ?? [];
};

export interface FullPayment {
  id: number;
  studentId: number;
  amount: number;
  purpose: string;
  paymentDate: string;
  createdAt?: string;
  Student?: { id: number; username: string; firstName: string; lastName: string } | null;
}

export const fetchAllPayments = async (): Promise<FullPayment[]> => {
  const res = await fetch(`${api_base_url}/payment/payments`, { headers: withAuthorization() });
  const data = await handleResponse<{ payments: FullPayment[] }>(res);
  return data.payments ?? [];
};

export const fetchMonthlyRevenue = async (
  year: number,
  month?: number
): Promise<MonthlyDataPoint[]> => {
  const params = new URLSearchParams({ year: String(year) });
  if (month) params.set("month", String(month));
  const res = await fetch(`${api_base_url}/payment/monthly-breakdown?${params}`, {
    headers: withAuthorization(),
  });
  const data = await handleResponse<{ monthly: MonthlyDataPoint[] }>(res);
  return data.monthly ?? [];
};
