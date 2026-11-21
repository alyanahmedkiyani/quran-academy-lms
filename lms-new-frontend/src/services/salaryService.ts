import { api_base_url, withAuthorization, handleResponse } from "./apiClient";
import { Salary, CreateSalaryPayload, UpdateSalaryPayload } from "@/types/salary";

export const getAllSalaries = async (filters?: { teacherId?: string; status?: string; month?: string }): Promise<Salary[]> => {
  const params = new URLSearchParams();
  if (filters?.teacherId) params.set("teacherId", filters.teacherId);
  if (filters?.status)    params.set("status",    filters.status);
  if (filters?.month)     params.set("month",     filters.month);
  const res = await fetch(`${api_base_url}/salary?${params}`, { headers: withAuthorization() });
  const data = await handleResponse<{ salaries: Salary[] }>(res);
  return data.salaries ?? [];
};

export const getTeacherSalaries = async (teacherId: number | string): Promise<Salary[]> => {
  const res = await fetch(`${api_base_url}/salary/teacher/${teacherId}`, { headers: withAuthorization() });
  const data = await handleResponse<{ salaries: Salary[] }>(res);
  return data.salaries ?? [];
};

export const createSalary = async (payload: CreateSalaryPayload): Promise<Salary> => {
  const res = await fetch(`${api_base_url}/salary`, {
    method: "POST",
    headers: withAuthorization(),
    body: JSON.stringify(payload),
  });
  const data = await handleResponse<{ salary: Salary }>(res);
  return data.salary;
};

export const updateSalary = async (id: number, payload: UpdateSalaryPayload): Promise<Salary> => {
  const res = await fetch(`${api_base_url}/salary/${id}`, {
    method: "PUT",
    headers: withAuthorization(),
    body: JSON.stringify(payload),
  });
  const data = await handleResponse<{ salary: Salary }>(res);
  return data.salary;
};

export const deleteSalary = async (id: number): Promise<void> => {
  const res = await fetch(`${api_base_url}/salary/${id}`, {
    method: "DELETE",
    headers: withAuthorization(),
  });
  await handleResponse(res);
};

export const uploadSalaryProof = async (id: number, file: File): Promise<Salary> => {
  const form = new FormData();
  form.append("file", file);
  const headers = withAuthorization();
  // Remove Content-Type so browser sets multipart boundary
  delete (headers as Record<string, string>)["Content-Type"];
  const res = await fetch(`${api_base_url}/salary/${id}/upload-proof`, {
    method: "POST",
    headers,
    body: form,
  });
  const data = await handleResponse<{ salary: Salary }>(res);
  return data.salary;
};
