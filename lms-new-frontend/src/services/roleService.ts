import { api_base_url, withAuthorization, handleResponse } from "./apiClient";

export interface RoleItem {
  id: number;
  role: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AdminUserItem {
  id: number;
  name: string;
  username: string;
  roleId: number | null;
  Role?: { id: number; role: string } | null;
  profileImg?: string | null;
}

// ─── Roles ───────────────────────────────────────────────────────────────────

export const fetchRoles = async (): Promise<RoleItem[]> => {
  const response = await fetch(`${api_base_url}/admin/getAllRoles`, {
    headers: withAuthorization(),
  });
  // Backend returns { role: [...] }
  const data = await handleResponse<{ role: RoleItem[] } | RoleItem[]>(response);
  return Array.isArray(data) ? data : (data as any).role ?? [];
};

export const createRole = async (roleName: string): Promise<RoleItem> => {
  const response = await fetch(`${api_base_url}/admin/createRole`, {
    method: "POST",
    headers: withAuthorization(),
    body: JSON.stringify({ role: roleName }),
  });
  const data = await handleResponse<{ roles: RoleItem }>(response);
  return data.roles;
};

export const updateRole = async (roleId: number, roleName: string): Promise<void> => {
  const response = await fetch(`${api_base_url}/admin/updateRole/${roleId}`, {
    method: "PUT",
    headers: withAuthorization(),
    body: JSON.stringify({ role: roleName }),
  });
  return handleResponse<void>(response);
};

export const deleteRole = async (roleId: number): Promise<void> => {
  const response = await fetch(`${api_base_url}/admin/role/${roleId}`, {
    method: "DELETE",
    headers: withAuthorization(),
  });
  return handleResponse<void>(response);
};

// ─── Permissions ─────────────────────────────────────────────────────────────

export const fetchRolePermissions = async (roleId: number): Promise<string[]> => {
  const response = await fetch(`${api_base_url}/admin/rights/${roleId}`, {
    headers: withAuthorization(),
  });
  // Backend returns a plain array: [{ id, rights, roleId, ... }, ...]
  const data = await handleResponse<Array<{ rights: string }>>(response);
  return Array.isArray(data) ? data.map((r) => r.rights) : [];
};

export const saveRolePermissions = async (roleId: number, permissions: string[]): Promise<void> => {
  const response = await fetch(`${api_base_url}/admin/assign-rights`, {
    method: "POST",
    headers: withAuthorization(),
    body: JSON.stringify({ roleId, rights: permissions }),
  });
  return handleResponse<void>(response);
};

// ─── Admin Users ──────────────────────────────────────────────────────────────

export const fetchAdminUsers = async (): Promise<AdminUserItem[]> => {
  const response = await fetch(`${api_base_url}/admin/getAllAdminUsers`, {
    headers: withAuthorization(),
  });
  return handleResponse<AdminUserItem[]>(response);
};

export const createAdminUser = async (data: {
  name: string;
  username: string;
  password: string;
  roleId: number;
}): Promise<AdminUserItem> => {
  const { roleId, ...rest } = data;
  const response = await fetch(`${api_base_url}/admin/createAdmin`, {
    method: "POST",
    headers: withAuthorization(),
    body: JSON.stringify({ ...rest, role: roleId }),
  });
  return handleResponse<AdminUserItem>(response);
};

export const updateAdminUser = async (
  adminId: number,
  data: { name?: string; username?: string; password?: string; roleId?: number },
): Promise<void> => {
  const { roleId, ...rest } = data;
  const response = await fetch(`${api_base_url}/admin/updateAdmin/${adminId}`, {
    method: "PUT",
    headers: withAuthorization(),
    body: JSON.stringify({ ...rest, ...(roleId !== undefined ? { role: roleId } : {}) }),
  });
  return handleResponse<void>(response);
};

export const deleteAdminUser = async (adminId: number): Promise<void> => {
  const response = await fetch(`${api_base_url}/admin/deleteAdmin/${adminId}`, {
    method: "DELETE",
    headers: withAuthorization(),
  });
  return handleResponse<void>(response);
};
