export interface Teacher {
  id: number | string;
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  contact: string;
  cnic: string;
  imageUrl?: string | null;
  canDirectlyPublish?: boolean;
  shift?: ('Morning' | 'Afternoon' | 'Evening')[] | null;
  timeZone?: string | null;
  courseCount?: number;
  studentCount?: number;
  todayBookedMinutes?: number;
  currentMonthSalaryStatus?: 'paid' | 'unpaid' | 'partial' | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface TeachersResponse {
  teachers: Teacher[];
}

export interface CreateTeacherPayload {
  email: string;
  username: string;
  password: string;
  firstName: string;
  lastName: string;
  contact: string;
  cnic: string;
  shift?: ('Morning' | 'Afternoon' | 'Evening')[] | null;
  timeZone?: string | null;
}

export interface UpdateTeacherPayload {
  firstName: string;
  lastName: string;
  contact: string;
  cnic: string;
  shift?: ('Morning' | 'Afternoon' | 'Evening')[] | null;
  timeZone?: string | null;
}

export interface ChangeTeacherPasswordPayload {
  username: string;
  password: string;
}
