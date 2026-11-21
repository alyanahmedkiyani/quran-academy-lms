import { api_base_url, withAuthorization, handleResponse } from "./apiClient";
import { FAQ, CreateFAQPayload, UpdateFAQPayload } from "@/types/faq";

/** Returns all published FAQs (no auth required) */
export const getPublishedFAQs = async (): Promise<FAQ[]> => {
  const res = await fetch(`${api_base_url}/faq`);
  return handleResponse<FAQ[]>(res);
};

/** Returns all FAQs including unpublished (admin) */
export const getAllFAQs = async (): Promise<FAQ[]> => {
  const res = await fetch(`${api_base_url}/faq/all`, { headers: withAuthorization() });
  return handleResponse<FAQ[]>(res);
};

export const createFAQ = async (payload: CreateFAQPayload): Promise<FAQ> => {
  const res = await fetch(`${api_base_url}/faq`, {
    method: "POST",
    headers: withAuthorization(),
    body: JSON.stringify(payload),
  });
  return handleResponse<FAQ>(res);
};

export const updateFAQ = async (id: number, payload: UpdateFAQPayload): Promise<FAQ> => {
  const res = await fetch(`${api_base_url}/faq/${id}`, {
    method: "PUT",
    headers: withAuthorization(),
    body: JSON.stringify(payload),
  });
  return handleResponse<FAQ>(res);
};

export const deleteFAQ = async (id: number): Promise<void> => {
  const res = await fetch(`${api_base_url}/faq/${id}`, {
    method: "DELETE",
    headers: withAuthorization(),
  });
  await handleResponse<unknown>(res);
};
