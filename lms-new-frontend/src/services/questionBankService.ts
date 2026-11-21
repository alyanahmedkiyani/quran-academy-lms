import { api_base_url, withAuthorization, handleResponse } from "./apiClient";
import { QuestionBankEntry, QuestionType } from "@/types/quiz";

export const fetchQuestionBank = async (): Promise<{ questions: QuestionBankEntry[] }> => {
  const response = await fetch(`${api_base_url}/questionBank`, {
    method: "GET",
    headers: withAuthorization(),
  });
  return handleResponse(response);
};

export const createBankQuestion = async (payload: {
  type: QuestionType;
  question: string;
  options?: string[] | null;
  correctAnswer: string;
  subject?: string;
  createdBy?: number;
}): Promise<{ question: QuestionBankEntry }> => {
  const response = await fetch(`${api_base_url}/questionBank`, {
    method: "POST",
    headers: withAuthorization(),
    body: JSON.stringify(payload),
  });
  return handleResponse(response);
};

export const deleteBankQuestion = async (id: number): Promise<void> => {
  const response = await fetch(`${api_base_url}/questionBank/${id}`, {
    method: "DELETE",
    headers: withAuthorization(),
  });
  return handleResponse(response);
};
