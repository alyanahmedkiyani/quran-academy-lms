export type RoleName =
  | 'SUPER_ADMIN'
  | 'ADMIN'
  | 'STUDENT'
  | 'TEACHER'
  | 'PARENT'
  | string;

export interface PermissionSummary {
  id: string;
  name: string;
  resource: string;
  action: string;
  description?: string | null;
}

export interface RoleSummary {
  id: string;
  name: RoleName;
  description?: string | null;
  isSystem: boolean;
  isActive: boolean;
}

export interface UserWithPermissions {
  id: string;
  email: string;
  username: string;
  /** 'ADMIN' | 'TEACHER' | 'STUDENT' | 'PARENT' — mirrors JWT userType */
  userType?: string;
  role: RoleSummary | null;
  /** Flat permission strings e.g. "students:view", "courses:create" */
  permissions: string[];
  isActive: boolean;
  lastLogin?: string;
  createdAt?: string;
  updatedAt?: string;
  profileImg?: string | null;
  /** Student: assigned shift (scalar). Teacher: array of shifts (stored as JSON, cast as needed). */
  shift?: 'Morning' | 'Afternoon' | 'Evening' | ('Morning' | 'Afternoon' | 'Evening')[] | null;
  /** Student-only: IANA timezone string */
  timeZone?: string | null;
}

export interface LoginPayload {
  username: string;
  password: string;
}

export interface AuthResponse {
  user: UserWithPermissions;
  token: string;
}

