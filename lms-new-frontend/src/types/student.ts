export interface Student {
  id: number | string;
  firstName: string;
  lastName: string;
  username: string;
  email?: string;
  contact?: string;
  address?: string;
  countryName?: string;
  state?: string;
  city?: string;
  timeZone?: string;
  classTime?: string;
  newClassTime?: string;
  nameForTeacher?: string;
  status?: string;
  planId?: number | string | null;
  profileImg?: string | null;
  shift?: 'Morning' | 'Afternoon' | 'Evening' | null;
  enrollmentChannel?: 'Meta' | 'Google' | 'TikTok' | 'SEO' | 'Email' | 'Reference' | null;
  referenceDetails?: string | null;
  studentLabel?: 'Unassigned' | 'Trial' | 'New Enrollment' | 'Lost' | 'Struck off' | null;
  struckOffReason?: string | null;
  note?: string | null;
  parentId?: number | string | null;
  createdAt?: string;
  updatedAt?: string;
  // Enriched fields returned by getAllStudents
  plan?: { id: number | string; name: string } | null;
  assignedTeacher?: { id: number | string; firstName: string; lastName: string; imageUrl?: string | null } | null;
  parent?: { id: number | string; firstName: string; lastName: string; profileImg?: string | null } | null;
  courseName?: string | null;
  courseId?: number | string | null;
  courseDetailsId?: number | string | null;
  feeStatus?: 'paid' | 'unpaid' | 'none';
  isAssigned?: boolean;
}

export interface StudentsResponse {
  students: Student[];
}

export interface Plan {
  id: number | string;
  name: string;
  price: number | string;
  description?: string;
}

export interface PlansResponse {
  plans: Plan[];
}

export interface CreateStudentPayload {
  username: string;
  firstName: string;
  lastName: string;
  password: string;
  contact?: string;
  email?: string;
  address?: string;
  planId: number | string;
  amount?: number | string;
  countryName?: string;
  state?: string;
  city?: string;
  timeZone?: string;
  classTime?: string;
  newClassTime?: string;
  nameForTeacher?: string;
  teacherId?: number | string | null;
  courseId?: number | string | null;
  shift?: 'Morning' | 'Afternoon' | 'Evening' | null;
  enrollmentChannel?: 'Meta' | 'Google' | 'TikTok' | 'SEO' | 'Email' | 'Reference' | null;
  referenceDetails?: string | null;
  studentLabel?: 'Unassigned' | 'Trial' | 'New Enrollment' | 'Lost' | 'Struck off' | null;
  struckOffReason?: string | null;
  note?: string | null;
}

export interface UpdateStudentPayload {
  username?: string;
  firstName: string;
  lastName: string;
  contact?: string;
  address?: string;
  countryName?: string;
  state?: string;
  city?: string;
  timeZone?: string;
  classTime?: string;
  newClassTime?: string;
  nameForTeacher?: string;
  teacherId?: number | string | null;
  courseId?: number | string | null;
  planId?: number | string;
  shift?: 'Morning' | 'Afternoon' | 'Evening' | null;
  enrollmentChannel?: 'Meta' | 'Google' | 'TikTok' | 'SEO' | 'Email' | 'Reference' | null;
  referenceDetails?: string | null;
  studentLabel?: 'Unassigned' | 'Trial' | 'New Enrollment' | 'Lost' | 'Struck off' | null;
  struckOffReason?: string | null;
  note?: string | null;
}

export interface ChangeStudentPasswordPayload {
  username: string;
  password: string;
}
