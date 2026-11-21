/**
 * Frontend permission utilities.
 * Mirrors the backend permission constants in backend/config/permissions.js.
 */

export const PERMISSIONS = {
  // Students
  STUDENTS_VIEW:   'students:view',
  STUDENTS_CREATE: 'students:create',
  STUDENTS_EDIT:   'students:edit',
  STUDENTS_DELETE: 'students:delete',

  // Teachers
  TEACHERS_VIEW:   'teachers:view',
  TEACHERS_CREATE: 'teachers:create',
  TEACHERS_EDIT:   'teachers:edit',
  TEACHERS_DELETE: 'teachers:delete',

  // Parents
  PARENTS_VIEW:    'parents:view',
  PARENTS_CREATE:  'parents:create',
  PARENTS_EDIT:    'parents:edit',
  PARENTS_DELETE:  'parents:delete',

  // Courses
  COURSES_VIEW:    'courses:view',
  COURSES_CREATE:  'courses:create',
  COURSES_EDIT:    'courses:edit',
  COURSES_DELETE:  'courses:delete',

  // Classes
  CLASSES_VIEW:    'classes:view',
  CLASSES_MANAGE:  'classes:manage',

  // Schedule
  SCHEDULE_VIEW:   'schedule:view',
  SCHEDULE_MANAGE: 'schedule:manage',

  // Attendance
  ATTENDANCE_VIEW: 'attendance:view',
  ATTENDANCE_MARK: 'attendance:mark',

  // Assignments
  ASSIGNMENTS_VIEW:    'assignments:view',
  ASSIGNMENTS_APPROVE: 'assignments:approve',

  // Quizzes
  QUIZZES_VIEW:    'quizzes:view',
  QUIZZES_APPROVE: 'quizzes:approve',

  // Finance
  FINANCE_VIEW:    'finance:view',
  FINANCE_MANAGE:  'finance:manage',

  // Chat
  CHAT_VIEW:       'chat:view',

  // Announcements
  ANNOUNCEMENTS_VIEW:   'announcements:view',
  ANNOUNCEMENTS_CREATE: 'announcements:create',
  ANNOUNCEMENTS_DELETE: 'announcements:delete',

  // Reports
  REPORTS_VIEW:    'reports:view',

  // Roles
  ROLES_VIEW:      'roles:view',
  ROLES_MANAGE:    'roles:manage',

  // Session Feedback
  FEEDBACK_VIEW:   'feedback:view',

  // Subscription Plans
  PLANS_VIEW:   'plans:view',
  PLANS_MANAGE: 'plans:manage',

  // Support / Help Center
  SUPPORT_VIEW:   'support:view',
  SUPPORT_MANAGE: 'support:manage',

  // FAQ Management
  FAQ_MANAGE: 'faq:manage',

  // Certificates
  CERTIFICATES_VIEW:   'certificates:view',
  CERTIFICATES_MANAGE: 'certificates:manage',

  // Session Transcripts
  TRANSCRIPTS_VIEW: 'transcripts:view',

  // Salary Management
  SALARY_VIEW:   'salary:view',
  SALARY_MANAGE: 'salary:manage',
} as const;

export type PermissionKey = typeof PERMISSIONS[keyof typeof PERMISSIONS];

/** Returns true if the role is a full admin (bypasses all permission checks) */
export const isFullAdmin = (roleName: string | null | undefined): boolean =>
  roleName === 'ADMIN' || roleName === 'SUPER_ADMIN';

/** Returns true if the permissions array includes the required permission */
export const hasPermission = (permissions: string[], permission: string): boolean =>
  permissions.includes(permission);

/**
 * Returns true if the user can access a resource.
 * Full admins always return true. Otherwise checks the permissions array.
 */
export const canAccess = (
  roleName: string | null | undefined,
  permissions: string[],
  requiredPermission: string,
): boolean => isFullAdmin(roleName) || hasPermission(permissions, requiredPermission);
