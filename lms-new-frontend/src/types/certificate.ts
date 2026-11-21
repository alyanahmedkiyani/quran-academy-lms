export type CertificateStatus = 'upcoming' | 'issued' | 'revoked';

export interface Certificate {
  id: number;
  courseId: number;
  studentId: number;
  templateImageUrl: string | null;
  issuedAt: string | null;
  status: CertificateStatus;
  notes: string | null;
  Student?: {
    id: number;
    firstName: string;
    lastName: string;
    email?: string;
    profileImg?: string | null;
  };
  Course?: {
    id: number;
    courseName: string;
    duration?: string;
  };
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateCertificatePayload {
  courseId: number | string;
  studentId: number | string;
  status: 'upcoming' | 'issued';
  notes?: string;
  file?: File | null;
}
