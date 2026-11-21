import { Student } from "./student";

export interface Parent {
  id: number | string;
  firstName: string;
  lastName: string;
  username: string;
  email?: string;
  contact?: string;
  address?: string;
  emergencyContact?: string;
  profileImg?: string | null;
  /** One parent → many students (returned as array from API) */
  students?: Pick<Student, "id" | "firstName" | "lastName" | "username" | "email" | "status" | "profileImg">[];
  /** Subquery counts returned by getAllParents */
  childCount?: number;
  paidFeesCount?: number;
  unpaidFeesCount?: number;
  isActive?: boolean;
  timeZone?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface ParentsResponse {
  parents: Parent[];
}

export interface CreateParentPayload {
  email?: string;
  username: string;
  password: string;
  firstName: string;
  lastName: string;
  contact?: string;
  address?: string;
  timeZone?: string | null;
  /** IDs of students to link to this parent */
  studentIds: (number | string)[];
}

export interface UpdateParentPayload {
  firstName: string;
  lastName: string;
  contact?: string;
  address?: string;
  timeZone?: string | null;
  /** When provided, replaces the full set of linked students */
  studentIds?: (number | string)[];
}

export interface ChangeParentPasswordPayload {
  username: string;
  password: string;
}
