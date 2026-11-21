import { api_base_url, withAuthorization, withAuthorizationMultipart, handleResponse } from "./apiClient";

const BASE = `${api_base_url}/course-pdfs`;

export interface CoursePDF {
  id: number;
  courseId: number;
  originalName: string;
  filePath: string;
  createdAt: string;
}

export const getCoursePDFs = async (courseId: number): Promise<CoursePDF[]> => {
  const res = await fetch(`${BASE}/${courseId}`, {
    headers: withAuthorizationMultipart(),
  });
  const data = await handleResponse<{ pdfs: CoursePDF[] }>(res);
  return data.pdfs;
};

export const uploadCoursePDFs = async (
  courseId: number,
  files: File[]
): Promise<CoursePDF[]> => {
  const fd = new FormData();
  files.forEach((f) => fd.append("pdfs", f));
  const res = await fetch(`${BASE}/${courseId}`, {
    method: "POST",
    headers: withAuthorizationMultipart(), // no Content-Type — browser sets multipart boundary
    body: fd,
  });
  const data = await handleResponse<{ pdfs: CoursePDF[] }>(res);
  return data.pdfs;
};

export const deleteCoursePDF = async (
  courseId: number,
  pdfId: number
): Promise<void> => {
  const res = await fetch(`${BASE}/${courseId}/${pdfId}`, {
    method: "DELETE",
    headers: withAuthorizationMultipart(),
  });
  await handleResponse<{ message: string }>(res);
};

/** Build a public URL for viewing a stored PDF */
export const pdfViewUrl = (filePath: string): string =>
  `${api_base_url}/resources/${filePath.replace(/^resources\//, "")}`;
