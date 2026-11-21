export interface FAQ {
  id: number;
  question: string;
  answer: string;
  category: string;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateFAQPayload {
  question: string;
  answer: string;
  category?: string;
  isPublished?: boolean;
}

export interface UpdateFAQPayload {
  question?: string;
  answer?: string;
  category?: string;
  isPublished?: boolean;
}
