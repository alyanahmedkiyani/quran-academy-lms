"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { api_base_url, withAuthorization } from "@/services/apiClient";
import {
  fetchRoles,
  createRole,
  updateRole,
  deleteRole,
  fetchRolePermissions,
  saveRolePermissions,
  fetchAdminUsers,
  createAdminUser,
  updateAdminUser,
  deleteAdminUser,
  RoleItem,
  AdminUserItem,
} from "@/services/roleService";
import { usePermissionGuard } from "@/lib/usePermissionGuard";
import { PERMISSIONS } from "@/lib/permissions";
import ConfirmationModal from "@/core/common/modals/confirmationModal";
import { useAppSelector } from "@/core/redux/hooks";

// ─── Permission matrix definition ────────────────────────────────────────────

interface PermissionGroup {
  label: string;
  icon: string;
  permissions: { key: string; label: string }[];
}

const PERMISSION_MATRIX: PermissionGroup[] = [
  { label: "Students",       icon: "ti-users",          permissions: [{ key: PERMISSIONS.STUDENTS_VIEW, label: "View" }, { key: PERMISSIONS.STUDENTS_CREATE, label: "Create" }, { key: PERMISSIONS.STUDENTS_EDIT, label: "Edit" }, { key: PERMISSIONS.STUDENTS_DELETE, label: "Delete" }] },
  { label: "Teachers",       icon: "ti-chalkboard",     permissions: [{ key: PERMISSIONS.TEACHERS_VIEW, label: "View" }, { key: PERMISSIONS.TEACHERS_CREATE, label: "Create" }, { key: PERMISSIONS.TEACHERS_EDIT, label: "Edit" }, { key: PERMISSIONS.TEACHERS_DELETE, label: "Delete" }] },
  { label: "Parents",        icon: "ti-heart",          permissions: [{ key: PERMISSIONS.PARENTS_VIEW, label: "View" }, { key: PERMISSIONS.PARENTS_CREATE, label: "Create" }, { key: PERMISSIONS.PARENTS_EDIT, label: "Edit" }, { key: PERMISSIONS.PARENTS_DELETE, label: "Delete" }] },
  { label: "Courses",        icon: "ti-books",          permissions: [{ key: PERMISSIONS.COURSES_VIEW, label: "View" }, { key: PERMISSIONS.COURSES_CREATE, label: "Create" }, { key: PERMISSIONS.COURSES_EDIT, label: "Edit" }, { key: PERMISSIONS.COURSES_DELETE, label: "Delete" }] },
  { label: "Classes",        icon: "ti-calendar",       permissions: [{ key: PERMISSIONS.CLASSES_VIEW, label: "View" }, { key: PERMISSIONS.CLASSES_MANAGE, label: "Manage" }] },
  { label: "Class Schedule", icon: "ti-calendar-event", permissions: [{ key: PERMISSIONS.SCHEDULE_VIEW, label: "View" }, { key: PERMISSIONS.SCHEDULE_MANAGE, label: "Manage" }] },
  { label: "Attendance",     icon: "ti-clipboard-check",permissions: [{ key: PERMISSIONS.ATTENDANCE_VIEW, label: "View" }, { key: PERMISSIONS.ATTENDANCE_MARK, label: "Mark" }] },
  { label: "Assignments",    icon: "ti-notes",          permissions: [{ key: PERMISSIONS.ASSIGNMENTS_VIEW, label: "View" }, { key: PERMISSIONS.ASSIGNMENTS_APPROVE, label: "Approve" }] },
  { label: "Quizzes",        icon: "ti-puzzle",         permissions: [{ key: PERMISSIONS.QUIZZES_VIEW, label: "View" }, { key: PERMISSIONS.QUIZZES_APPROVE, label: "Approve" }] },
  { label: "Finance",        icon: "ti-wallet",         permissions: [{ key: PERMISSIONS.FINANCE_VIEW, label: "View" }, { key: PERMISSIONS.FINANCE_MANAGE, label: "Manage" }] },
  { label: "Chat",           icon: "ti-messages",       permissions: [{ key: PERMISSIONS.CHAT_VIEW, label: "View" }] },
  { label: "Announcements",  icon: "ti-bell-ringing",   permissions: [{ key: PERMISSIONS.ANNOUNCEMENTS_VIEW, label: "View" }, { key: PERMISSIONS.ANNOUNCEMENTS_CREATE, label: "Create" }, { key: PERMISSIONS.ANNOUNCEMENTS_DELETE, label: "Delete" }] },
  { label: "Reports",        icon: "ti-chart-bar",      permissions: [{ key: PERMISSIONS.REPORTS_VIEW, label: "View" }] },
  { label: "Roles & Admin",  icon: "ti-shield-lock",    permissions: [{ key: PERMISSIONS.ROLES_VIEW, label: "View" }, { key: PERMISSIONS.ROLES_MANAGE, label: "Manage" }] },
];

const actionColor: Record<string, string> = {
  View: "primary", Create: "success", Edit: "warning", Delete: "danger",
  Manage: "info", Mark: "secondary", Approve: "warning",
};

// ─── Component ────────────────────────────────────────────────────────────────

const RolesAndPermissionsComponent = () => {
  usePermissionGuard(PERMISSIONS.ROLES_VIEW);

  const currentUser = useAppSelector((state) => state.auth.user);

  const [activeTab, setActiveTab] = useState<"roles" | "users">("roles");
  const [showAddRole, setShowAddRole] = useState(false);
  const [showAddUser, setShowAddUser] = useState(false);

  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newRoleName, setNewRoleName] = useState("");
  const [creating, setCreating] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleItem | null>(null);
  const [editRoleName, setEditRoleName] = useState("");
  const [editing, setEditing] = useState(false);
  const [deletingRole, setDeletingRole] = useState<RoleItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [selectedRole, setSelectedRole] = useState<RoleItem | null>(null);
  const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(new Set());
  const [loadingPerms, setLoadingPerms] = useState(false);
  const [savingPerms, setSavingPerms] = useState(false);
  const [permSaveSuccess, setPermSaveSuccess] = useState(false);

  const [users, setUsers] = useState<AdminUserItem[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [newUser, setNewUser] = useState({ name: "", username: "", password: "", roleId: "" });
  const [creatingUser, setCreatingUser] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUserItem | null>(null);
  const [editUser, setEditUser] = useState({ name: "", username: "", password: "", roleId: "" });
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [showEditPwd, setShowEditPwd] = useState(false);
  const [editingUserSaving, setEditingUserSaving] = useState(false);
  const [deletingUser, setDeletingUser] = useState<AdminUserItem | null>(null);
  const [deletingUserInProgress, setDeletingUserInProgress] = useState(false);

  const [newUsernameStatus, setNewUsernameStatus] = useState<"idle" | "checking" | "available" | "taken">("idle");
  const [editUsernameStatus, setEditUsernameStatus] = useState<"idle" | "checking" | "available" | "taken">("idle");
  const newUsernameDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editUsernameDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const checkNewUsername = (value: string) => {
    if (newUsernameDebounceRef.current) clearTimeout(newUsernameDebounceRef.current);
    const trimmed = value.trim();
    if (trimmed.length < 3) { setNewUsernameStatus("idle"); return; }
    setNewUsernameStatus("checking");
    newUsernameDebounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`${api_base_url}/teacher/check-username?username=${encodeURIComponent(trimmed)}`, { headers: withAuthorization() });
        const data = await res.json();
        setNewUsernameStatus(data.available ? "available" : "taken");
      } catch { setNewUsernameStatus("idle"); }
    }, 500);
  };

  const checkEditUsername = (value: string, originalUsername: string) => {
    if (editUsernameDebounceRef.current) clearTimeout(editUsernameDebounceRef.current);
    const trimmed = value.trim();
    if (trimmed === originalUsername || trimmed.length < 3) { setEditUsernameStatus("idle"); return; }
    setEditUsernameStatus("checking");
    editUsernameDebounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`${api_base_url}/teacher/check-username?username=${encodeURIComponent(trimmed)}`, { headers: withAuthorization() });
        const data = await res.json();
        setEditUsernameStatus(data.available ? "available" : "taken");
      } catch { setEditUsernameStatus("idle"); }
    }, 500);
  };

  const SYSTEM_ROLES = ["ADMIN", "SUPER_ADMIN"];
  const visibleRoles = roles.filter((r) => !SYSTEM_ROLES.includes(r.role));

  const loadRoles = useCallback(async () => {
    try {
      setLoading(true); setError(null);
      const data = await fetchRoles();
      setRoles(data);
    } catch (err: any) {
      setError(err.message || "Failed to load roles");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadRoles(); }, [loadRoles]);

  const loadUsers = useCallback(async () => {
    try {
      setLoadingUsers(true); setUsersError(null);
      const data = await fetchAdminUsers();
      setUsers(data);
    } catch (err: any) {
      setUsersError(err.message || "Failed to load users");
    } finally { setLoadingUsers(false); }
  }, []);

  useEffect(() => { if (activeTab === "users") loadUsers(); }, [activeTab, loadUsers]);

  useEffect(() => {
    if (!selectedRole) return;
    const load = async () => {
      try {
        setLoadingPerms(true); setPermSaveSuccess(false);
        const perms = await fetchRolePermissions(selectedRole.id);
        setSelectedPermissions(new Set(perms));
      } catch { setSelectedPermissions(new Set()); }
      finally { setLoadingPerms(false); }
    };
    load();
  }, [selectedRole]);

  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoleName.trim()) return;
    try {
      setCreating(true);
      await createRole(newRoleName.trim());
      setNewRoleName(""); setShowAddRole(false);
      await loadRoles();
    } catch (err: any) { alert(err.message || "Failed to create role"); }
    finally { setCreating(false); }
  };

  const handleEditRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRole || !editRoleName.trim()) return;
    try {
      setEditing(true);
      await updateRole(editingRole.id, editRoleName.trim());
      if (selectedRole?.id === editingRole.id) setSelectedRole({ ...selectedRole, role: editRoleName.trim() });
      setEditingRole(null);
      await loadRoles();
    } catch (err: any) { alert(err.message || "Failed to update role"); }
    finally { setEditing(false); }
  };

  const handleDeleteRole = async () => {
    if (!deletingRole) return;
    try {
      setDeleting(true);
      await deleteRole(deletingRole.id);
      if (selectedRole?.id === deletingRole.id) setSelectedRole(null);
      setDeletingRole(null);
      await loadRoles();
    } catch (err: any) { alert(err.message || "Failed to delete role"); }
    finally { setDeleting(false); }
  };

  const togglePermission = (key: string) => {
    setSelectedPermissions((prev) => { const next = new Set(prev); if (next.has(key)) next.delete(key); else next.add(key); return next; });
    setPermSaveSuccess(false);
  };

  const toggleGroupAll = (group: PermissionGroup) => {
    const allSelected = group.permissions.every((p) => selectedPermissions.has(p.key));
    setSelectedPermissions((prev) => {
      const next = new Set(prev);
      if (allSelected) group.permissions.forEach((p) => next.delete(p.key));
      else group.permissions.forEach((p) => next.add(p.key));
      return next;
    });
    setPermSaveSuccess(false);
  };

  const handleSavePermissions = async () => {
    if (!selectedRole) return;
    try {
      setSavingPerms(true);
      await saveRolePermissions(selectedRole.id, Array.from(selectedPermissions));
      setPermSaveSuccess(true);
    } catch (err: any) { alert(err.message || "Failed to save permissions"); }
    finally { setSavingPerms(false); }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.name.trim() || !newUser.username.trim() || !newUser.password.trim() || !newUser.roleId) return;
    try {
      setCreatingUser(true);
      await createAdminUser({ name: newUser.name.trim(), username: newUser.username.trim(), password: newUser.password.trim(), roleId: Number(newUser.roleId) });
      setNewUser({ name: "", username: "", password: "", roleId: "" }); setNewUsernameStatus("idle"); setShowNewPwd(false); setShowAddUser(false);
      await loadUsers();
    } catch (err: any) { alert(err.message || "Failed to create user"); }
    finally { setCreatingUser(false); }
  };

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    try {
      setEditingUserSaving(true);
      await updateAdminUser(editingUser.id, { name: editUser.name.trim() || undefined, username: editUser.username.trim() || undefined, password: editUser.password.trim() || undefined, roleId: editUser.roleId ? Number(editUser.roleId) : undefined });
      setEditingUser(null); setEditUsernameStatus("idle");
      await loadUsers();
    } catch (err: any) { alert(err.message || "Failed to update user"); }
    finally { setEditingUserSaving(false); }
  };

  const handleDeleteUser = async () => {
    if (!deletingUser) return;
    try {
      setDeletingUserInProgress(true);
      await deleteAdminUser(deletingUser.id);
      setDeletingUser(null); await loadUsers();
    } catch (err: any) { alert(err.message || "Failed to delete user"); }
    finally { setDeletingUserInProgress(false); }
  };

  const openEditRoleModal = (role: RoleItem) => { setEditingRole(role); setEditRoleName(role.role); };
  const openEditUserModal = (user: AdminUserItem) => {
    setEditingUser(user);
    setEditUser({ name: user.name, username: user.username, password: "", roleId: user.roleId ? String(user.roleId) : "" });
    setEditUsernameStatus("idle"); setShowEditPwd(false);
  };

  const totalSelected = selectedPermissions.size;
  const totalPermissions = PERMISSION_MATRIX.reduce((a, g) => a + g.permissions.length, 0);

  // ── Permission assignment full-page view ──────────────────────────────────
  if (selectedRole) {
    return (
      <div className="page-wrapper">
        <div className="content">

          {/* Header */}
          <div className="card mb-4 border-0 shadow-sm">
            <div className="card-body py-3">
              <div className="d-flex align-items-center flex-wrap gap-3">
                <button className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1" onClick={() => setSelectedRole(null)}>
                  <i className="ti ti-arrow-left" /> Back to Roles
                </button>
                <div className="flex-grow-1">
                  <div className="d-flex align-items-center gap-2 flex-wrap">
                    <span className="avatar rounded-circle bg-primary text-white d-flex align-items-center justify-content-center" style={{ width: 36, height: 36 }}>
                      <i className="ti ti-shield-lock fs-16" />
                    </span>
                    <div>
                      <h5 className="fw-bold mb-0">{selectedRole.role}</h5>
                      <p className="text-muted mb-0 fs-12">Configure permissions for this role</p>
                    </div>
                    <span className="badge badge-soft-primary border border-primary fs-12 ms-1">
                      {totalSelected} / {totalPermissions} permissions
                    </span>
                  </div>
                </div>
                <div className="d-flex align-items-center gap-2">
                  {permSaveSuccess && (
                    <span className="badge badge-soft-success border border-success fs-13 px-3 py-2">
                      <i className="ti ti-circle-check me-1" /> Saved
                    </span>
                  )}
                  <button className="btn btn-primary d-inline-flex align-items-center gap-1" onClick={handleSavePermissions} disabled={savingPerms}>
                    {savingPerms ? <><span className="spinner-border spinner-border-sm" /> Saving...</> : <><i className="ti ti-device-floppy" /> Save Permissions</>}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {loadingPerms ? (
            <div className="text-center py-5">
              <span className="spinner-border text-primary" />
              <p className="text-muted mt-2 mb-0">Loading permissions...</p>
            </div>
          ) : (
            <div className="row g-3">
              {PERMISSION_MATRIX.map((group) => {
                const allSelected = group.permissions.every((p) => selectedPermissions.has(p.key));
                const someSelected = group.permissions.some((p) => selectedPermissions.has(p.key));
                const selectedCount = group.permissions.filter((p) => selectedPermissions.has(p.key)).length;
                return (
                  <div key={group.label} className="col-xl-3 col-md-4 col-sm-6">
                    <div className={`card h-100 mb-0 border ${allSelected ? "border-primary" : someSelected ? "border-warning" : ""}`} style={{ transition: "border-color 0.2s" }}>
                      <div className={`card-header d-flex align-items-center justify-content-between py-2 px-3 ${allSelected ? "bg-primary bg-opacity-10" : someSelected ? "bg-warning bg-opacity-10" : "bg-light"}`}>
                        <div className="d-flex align-items-center gap-2">
                          <i className={`ti ${group.icon} fs-15 ${allSelected ? "text-primary" : someSelected ? "text-warning" : "text-muted"}`} />
                          <span className="fw-semibold fs-13">{group.label}</span>
                          {selectedCount > 0 && (
                            <span className={`badge rounded-pill fs-11 ${allSelected ? "bg-primary" : "bg-warning text-dark"}`}>
                              {selectedCount}/{group.permissions.length}
                            </span>
                          )}
                        </div>
                        <div className="form-check mb-0">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            id={`group-all-${group.label}`}
                            checked={allSelected}
                            ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected; }}
                            onChange={() => toggleGroupAll(group)}
                          />
                        </div>
                      </div>
                      <div className="card-body py-3 px-3">
                        <div className="d-flex flex-wrap gap-2">
                          {group.permissions.map((perm) => {
                            const checked = selectedPermissions.has(perm.key);
                            const color = actionColor[perm.label] ?? "secondary";
                            return (
                              <label
                                key={perm.key}
                                className={`d-inline-flex align-items-center gap-1 px-2 py-1 rounded-pill border fs-12 fw-medium cursor-pointer`}
                                style={{
                                  cursor: "pointer",
                                  background: checked ? `var(--bs-${color}, #0d6efd)` : "transparent",
                                  borderColor: `var(--bs-${color}, #0d6efd)`,
                                  color: checked ? "#fff" : `var(--bs-${color}, #0d6efd)`,
                                  transition: "all 0.15s",
                                  userSelect: "none",
                                }}
                              >
                                <input
                                  type="checkbox"
                                  className="d-none"
                                  id={perm.key}
                                  checked={checked}
                                  onChange={() => togglePermission(perm.key)}
                                />
                                <i className={`ti ${checked ? "ti-check" : "ti-plus"} fs-11`} />
                                {perm.label}
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Roles + Users tabbed view ──────────────────────────────────────────────
  return (
    <>
      <div className="page-wrapper">
        <div className="content">

          {/* Page Header */}
          <div className="d-flex align-items-sm-center flex-sm-row flex-column gap-2 mb-4">
            <div className="flex-grow-1">
              <h4 className="fw-bold mb-0">Roles &amp; Permissions</h4>
              <p className="text-muted mb-0 fs-13">Manage roles, permissions, and admin sub-users.</p>
            </div>
            <div>
              {activeTab === "roles" ? (
                <button className="btn btn-primary d-inline-flex align-items-center gap-1" onClick={() => setShowAddRole(true)}>
                  <i className="ti ti-plus" /> New Role
                </button>
              ) : (
                <button className="btn btn-primary d-inline-flex align-items-center gap-1" onClick={() => setShowAddUser(true)}>
                  <i className="ti ti-plus" /> New Admin User
                </button>
              )}
            </div>
          </div>

          {/* Stats row */}
          <div className="row g-3 mb-4">
            <div className="col-sm-4 col-6">
              <div className="card border-0 shadow-sm text-center py-3">
                <div className="card-body py-2">
                  <div className="avatar rounded-circle bg-primary bg-opacity-10 text-primary d-inline-flex align-items-center justify-content-center mb-2" style={{ width: 44, height: 44 }}>
                    <i className="ti ti-shield fs-20" />
                  </div>
                  <h4 className="fw-bold mb-0">{visibleRoles.length}</h4>
                  <p className="text-muted fs-12 mb-0">Custom Roles</p>
                </div>
              </div>
            </div>
            <div className="col-sm-4 col-6">
              <div className="card border-0 shadow-sm text-center py-3">
                <div className="card-body py-2">
                  <div className="avatar rounded-circle bg-success bg-opacity-10 text-success d-inline-flex align-items-center justify-content-center mb-2" style={{ width: 44, height: 44 }}>
                    <i className="ti ti-users fs-20" />
                  </div>
                  <h4 className="fw-bold mb-0">{users.length}</h4>
                  <p className="text-muted fs-12 mb-0">Admin Users</p>
                </div>
              </div>
            </div>
            <div className="col-sm-4 col-6">
              <div className="card border-0 shadow-sm text-center py-3">
                <div className="card-body py-2">
                  <div className="avatar rounded-circle bg-info bg-opacity-10 text-info d-inline-flex align-items-center justify-content-center mb-2" style={{ width: 44, height: 44 }}>
                    <i className="ti ti-lock fs-20" />
                  </div>
                  <h4 className="fw-bold mb-0">{totalPermissions}</h4>
                  <p className="text-muted fs-12 mb-0">Permissions Available</p>
                </div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="card border-0 shadow-sm">
            <div className="card-header border-bottom bg-white px-3 pt-3 pb-0">
              <ul className="nav nav-tabs card-header-tabs">
                <li className="nav-item">
                  <button className={`nav-link fw-medium ${activeTab === "roles" ? "active" : ""}`} onClick={() => setActiveTab("roles")}>
                    <i className="ti ti-shield me-1" /> Roles
                    <span className={`badge ms-2 fs-11 ${activeTab === "roles" ? "bg-primary" : "bg-secondary"}`}>{visibleRoles.length}</span>
                  </button>
                </li>
                <li className="nav-item">
                  <button className={`nav-link fw-medium ${activeTab === "users" ? "active" : ""}`} onClick={() => setActiveTab("users")}>
                    <i className="ti ti-users me-1" /> Admin Users
                    <span className={`badge ms-2 fs-11 ${activeTab === "users" ? "bg-primary" : "bg-secondary"}`}>{users.length}</span>
                  </button>
                </li>
              </ul>
            </div>

            <div className="card-body p-0">

              {/* ── Roles Tab ── */}
              {activeTab === "roles" && (
                <>
                  {error && <div className="alert alert-danger m-3">{error}</div>}
                  {loading ? (
                    <div className="text-center py-5">
                      <span className="spinner-border text-primary" />
                      <p className="text-muted mt-2 mb-0">Loading roles...</p>
                    </div>
                  ) : visibleRoles.length === 0 ? (
                    <div className="text-center py-5">
                      <i className="ti ti-shield-off fs-40 text-muted d-block mb-2" />
                      <p className="text-muted mb-0">No roles found. Create one to get started.</p>
                    </div>
                  ) : (
                    <div className="table-responsive">
                      <table className="table table-hover align-middle mb-0">
                        <thead className="table-light">
                          <tr>
                            <th className="ps-4" style={{ width: 50 }}>#</th>
                            <th>Role Name</th>
                            <th>Assigned Users</th>
                            <th>Permissions</th>
                            <th className="text-end pe-4">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {visibleRoles.map((role, index) => {
                            const assignedCount = users.filter((u) => u.roleId === role.id).length;
                            return (
                              <tr key={role.id}>
                                <td className="ps-4 text-muted fs-13">#{index + 1}</td>
                                <td>
                                  <div className="d-flex align-items-center gap-2">
                                    <span className="avatar rounded-circle bg-primary bg-opacity-10 text-primary d-inline-flex align-items-center justify-content-center fw-bold fs-14" style={{ width: 36, height: 36 }}>
                                      {role.role[0]?.toUpperCase()}
                                    </span>
                                    <div>
                                      <p className="fw-semibold mb-0 fs-14">{role.role}</p>
                                      <p className="text-muted mb-0 fs-11">Custom role</p>
                                    </div>
                                  </div>
                                </td>
                                <td>
                                  {assignedCount > 0 ? (
                                    <span className="badge badge-soft-info border border-info fs-12">
                                      <i className="ti ti-users me-1" />{assignedCount} user{assignedCount !== 1 ? "s" : ""}
                                    </span>
                                  ) : (
                                    <span className="text-muted fs-12">No users</span>
                                  )}
                                </td>
                                <td>
                                  <button className="btn btn-sm btn-outline-primary d-inline-flex align-items-center gap-1" onClick={() => setSelectedRole(role)}>
                                    <i className="ti ti-shield-half" /> Manage Permissions
                                  </button>
                                </td>
                                <td className="text-end pe-4">
                                  <div className="d-flex gap-2 justify-content-end">
                                    <button type="button" className="btn btn-outline-primary btn-icon btn-sm" title="Edit" onClick={() => openEditRoleModal(role)}>
                                      <i className="ti ti-edit" />
                                    </button>
                                    <button type="button" className="btn btn-outline-danger btn-icon btn-sm" title="Delete" onClick={() => setDeletingRole(role)}>
                                      <i className="ti ti-trash" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}

              {/* ── Users Tab ── */}
              {activeTab === "users" && (
                <>
                  {usersError && <div className="alert alert-danger m-3">{usersError}</div>}
                  {loadingUsers ? (
                    <div className="text-center py-5">
                      <span className="spinner-border text-primary" />
                      <p className="text-muted mt-2 mb-0">Loading users...</p>
                    </div>
                  ) : users.length === 0 ? (
                    <div className="text-center py-5">
                      <i className="ti ti-user-off fs-40 text-muted d-block mb-2" />
                      <p className="text-muted mb-0">No admin users found. Create one to get started.</p>
                    </div>
                  ) : (
                    <div className="table-responsive">
                      <table className="table table-hover align-middle mb-0">
                        <thead className="table-light">
                          <tr>
                            <th className="ps-4" style={{ width: 50 }}>#</th>
                            <th>User</th>
                            <th>Username</th>
                            <th>Role</th>
                            <th className="text-end pe-4">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {users.map((user, index) => {
                            const isSelf = String(user.id) === String(currentUser?.id);
                            const initials = user.name?.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) || "?";
                            return (
                              <tr key={user.id}>
                                <td className="ps-4 text-muted fs-13">#{index + 1}</td>
                                <td>
                                  <div className="d-flex align-items-center gap-2">
                                    <span className="avatar rounded-circle bg-success bg-opacity-10 text-success d-inline-flex align-items-center justify-content-center fw-bold fs-13" style={{ width: 36, height: 36 }}>
                                      {initials}
                                    </span>
                                    <div>
                                      <p className="fw-semibold mb-0 fs-14">
                                        {user.name}
                                        {isSelf && <span className="badge bg-primary ms-2 fs-10">You</span>}
                                      </p>
                                      <p className="text-muted mb-0 fs-11">Admin user</p>
                                    </div>
                                  </div>
                                </td>
                                <td>
                                  <span className="text-muted fs-13">@{user.username}</span>
                                </td>
                                <td>
                                  {user.Role ? (
                                    <span className="badge badge-soft-primary border border-primary fs-12">
                                      <i className="ti ti-shield me-1" />{user.Role.role}
                                    </span>
                                  ) : (
                                    <span className="badge badge-soft-secondary border fs-12 text-muted">No role</span>
                                  )}
                                </td>
                                <td className="text-end pe-4">
                                  {isSelf ? (
                                    <span className="text-muted fs-12">—</span>
                                  ) : (
                                    <div className="d-flex gap-2 justify-content-end">
                                      <button type="button" className="btn btn-outline-primary btn-icon btn-sm" title="Edit" onClick={() => openEditUserModal(user)}>
                                        <i className="ti ti-edit" />
                                      </button>
                                      <button type="button" className="btn btn-outline-danger btn-icon btn-sm" title="Delete" onClick={() => setDeletingUser(user)}>
                                        <i className="ti ti-trash" />
                                      </button>
                                    </div>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}

            </div>
          </div>
        </div>
      </div>

      {/* ── Add Role Modal ── */}
      {showAddRole && (
        <>
          <div className="modal-backdrop fade show" style={{ zIndex: 1040 }} onClick={!creating ? () => { setShowAddRole(false); setNewRoleName(""); } : undefined} />
          <div className="modal fade show" style={{ display: "block", zIndex: 1055 }} tabIndex={-1}>
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title fw-bold">
                    <i className="ti ti-shield-plus me-2 text-primary" />New Role
                  </h5>
                  <button type="button" className="btn-close custom-btn-close opacity-100" onClick={() => { setShowAddRole(false); setNewRoleName(""); }} disabled={creating}>
                    <i className="ti ti-x fs-16 text-dark" />
                  </button>
                </div>
                <form onSubmit={handleCreateRole}>
                  <div className="modal-body">
                    <label className="form-label">Role Name <span className="text-danger">*</span></label>
                    <input type="text" className="form-control" placeholder="e.g. Content Manager, Finance Officer" value={newRoleName} onChange={(e) => setNewRoleName(e.target.value)} disabled={creating} required />
                    <p className="text-muted fs-12 mt-2 mb-0">You can assign permissions after creating the role.</p>
                  </div>
                  <div className="modal-footer gap-2">
                    <button type="button" className="btn btn-light border" onClick={() => { setShowAddRole(false); setNewRoleName(""); }} disabled={creating}>Cancel</button>
                    <button type="submit" className="btn btn-primary" disabled={creating}>{creating ? "Creating..." : "Create Role"}</button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Edit Role Modal ── */}
      {!!editingRole && (
        <>
          <div className="modal-backdrop fade show" style={{ zIndex: 1040 }} onClick={!editing ? () => setEditingRole(null) : undefined} />
          <div className="modal fade show" style={{ display: "block", zIndex: 1055 }} tabIndex={-1}>
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title fw-bold">
                    <i className="ti ti-edit me-2 text-primary" />Edit Role
                  </h5>
                  <button type="button" className="btn-close custom-btn-close opacity-100" onClick={() => setEditingRole(null)} disabled={editing}>
                    <i className="ti ti-x fs-16 text-dark" />
                  </button>
                </div>
                <form onSubmit={handleEditRole}>
                  <div className="modal-body">
                    <label className="form-label">Role Name <span className="text-danger">*</span></label>
                    <input type="text" className="form-control" value={editRoleName} onChange={(e) => setEditRoleName(e.target.value)} disabled={editing} required />
                  </div>
                  <div className="modal-footer gap-2">
                    <button type="button" className="btn btn-light border" onClick={() => setEditingRole(null)} disabled={editing}>Cancel</button>
                    <button type="submit" className="btn btn-primary" disabled={editing}>{editing ? "Saving..." : "Save Changes"}</button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Delete Role ── */}
      <ConfirmationModal
        open={!!deletingRole}
        title="Delete Role?"
        description={deletingRole ? (<>Are you sure you want to delete <strong>{deletingRole.role}</strong>? This will remove all permissions assigned to this role.</>) : undefined}
        confirmText="Delete"
        confirmVariant="danger"
        confirmLoading={deleting}
        icon={<i className="ti ti-trash" />}
        onConfirm={handleDeleteRole}
        onCancel={() => { if (!deleting) setDeletingRole(null); }}
      />

      {/* ── Add User Modal ── */}
      {showAddUser && (
        <>
          <div className="modal-backdrop fade show" style={{ zIndex: 1040 }} onClick={!creatingUser ? () => { setShowAddUser(false); setNewUser({ name: "", username: "", password: "", roleId: "" }); } : undefined} />
          <div className="modal fade show" style={{ display: "block", zIndex: 1055 }} tabIndex={-1}>
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title fw-bold">
                    <i className="ti ti-user-plus me-2 text-primary" />New Admin User
                  </h5>
                  <button type="button" className="btn-close custom-btn-close opacity-100" onClick={() => { setShowAddUser(false); setNewUser({ name: "", username: "", password: "", roleId: "" }); setNewUsernameStatus("idle"); }} disabled={creatingUser}>
                    <i className="ti ti-x fs-16 text-dark" />
                  </button>
                </div>
                <form onSubmit={handleCreateUser}>
                  <div className="modal-body">
                    <div className="mb-3">
                      <label className="form-label">Full Name <span className="text-danger">*</span></label>
                      <input type="text" className="form-control" placeholder="e.g. John Doe" value={newUser.name} onChange={(e) => setNewUser((p) => ({ ...p, name: e.target.value }))} disabled={creatingUser} required />
                    </div>
                    <div className="mb-3">
                      <label className="form-label">Username <span className="text-danger">*</span></label>
                      <div className="input-group">
                        <input type="text" className={`form-control${newUsernameStatus === "taken" ? " is-invalid" : newUsernameStatus === "available" ? " is-valid" : ""}`} placeholder="e.g. john.doe" value={newUser.username} onChange={(e) => { setNewUser((p) => ({ ...p, username: e.target.value })); checkNewUsername(e.target.value); }} disabled={creatingUser} required />
                        <span className="input-group-text">
                          {newUsernameStatus === "checking" && <span className="spinner-border spinner-border-sm text-secondary" />}
                          {newUsernameStatus === "available" && <i className="ti ti-circle-check text-success" />}
                          {newUsernameStatus === "taken" && <i className="ti ti-circle-x text-danger" />}
                          {newUsernameStatus === "idle" && <i className="ti ti-at text-muted" />}
                        </span>
                        {newUsernameStatus === "taken" && <div className="invalid-feedback">Username is already taken.</div>}
                      </div>
                      {newUsernameStatus === "available" && <div className="text-success small mt-1"><i className="ti ti-check me-1" />Username is available</div>}
                    </div>
                    <div className="mb-3">
                      <label className="form-label">Password <span className="text-danger">*</span></label>
                      <div className="input-group">
                        <input type={showNewPwd ? "text" : "password"} className="form-control" placeholder="Set a password" value={newUser.password} onChange={(e) => setNewUser((p) => ({ ...p, password: e.target.value }))} disabled={creatingUser} required />
                        <button type="button" className="btn btn-outline-secondary" onClick={() => setShowNewPwd((v) => !v)} tabIndex={-1}>
                          <i className={`ti ${showNewPwd ? "ti-eye-off" : "ti-eye"}`} />
                        </button>
                      </div>
                    </div>
                    <div className="mb-0">
                      <label className="form-label">Role <span className="text-danger">*</span></label>
                      <select className="form-select" value={newUser.roleId} onChange={(e) => setNewUser((p) => ({ ...p, roleId: e.target.value }))} disabled={creatingUser} required>
                        <option value="">Select a role</option>
                        {visibleRoles.map((r) => <option key={r.id} value={r.id}>{r.role}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="modal-footer gap-2">
                    <button type="button" className="btn btn-light border" onClick={() => { setShowAddUser(false); setNewUser({ name: "", username: "", password: "", roleId: "" }); setNewUsernameStatus("idle"); }} disabled={creatingUser}>Cancel</button>
                    <button type="submit" className="btn btn-primary" disabled={creatingUser || newUsernameStatus === "taken" || newUsernameStatus === "checking"}>{creatingUser ? "Creating..." : "Add User"}</button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Edit User Modal ── */}
      {!!editingUser && (
        <>
          <div className="modal-backdrop fade show" style={{ zIndex: 1040 }} onClick={!editingUserSaving ? () => setEditingUser(null) : undefined} />
          <div className="modal fade show" style={{ display: "block", zIndex: 1055 }} tabIndex={-1}>
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title fw-bold">
                    <i className="ti ti-edit me-2 text-primary" />Edit Admin User
                  </h5>
                  <button type="button" className="btn-close custom-btn-close opacity-100" onClick={() => setEditingUser(null)} disabled={editingUserSaving}>
                    <i className="ti ti-x fs-16 text-dark" />
                  </button>
                </div>
                <form onSubmit={handleEditUser}>
                  <div className="modal-body">
                    <div className="mb-3">
                      <label className="form-label">Full Name</label>
                      <input type="text" className="form-control" value={editUser.name} onChange={(e) => setEditUser((p) => ({ ...p, name: e.target.value }))} disabled={editingUserSaving} />
                    </div>
                    <div className="mb-3">
                      <label className="form-label">Username</label>
                      <div className="input-group">
                        <input type="text" className={`form-control${editUsernameStatus === "taken" ? " is-invalid" : editUsernameStatus === "available" ? " is-valid" : ""}`} value={editUser.username} onChange={(e) => { setEditUser((p) => ({ ...p, username: e.target.value })); checkEditUsername(e.target.value, editingUser?.username ?? ""); }} disabled={editingUserSaving} />
                        <span className="input-group-text">
                          {editUsernameStatus === "checking" && <span className="spinner-border spinner-border-sm text-secondary" />}
                          {editUsernameStatus === "available" && <i className="ti ti-circle-check text-success" />}
                          {editUsernameStatus === "taken" && <i className="ti ti-circle-x text-danger" />}
                          {editUsernameStatus === "idle" && <i className="ti ti-at text-muted" />}
                        </span>
                        {editUsernameStatus === "taken" && <div className="invalid-feedback">Username is already taken.</div>}
                      </div>
                      {editUsernameStatus === "available" && <div className="text-success small mt-1"><i className="ti ti-check me-1" />Username is available</div>}
                    </div>
                    <div className="mb-3">
                      <label className="form-label">New Password <span className="text-muted fs-12">(leave blank to keep current)</span></label>
                      <div className="input-group">
                        <input type={showEditPwd ? "text" : "password"} className="form-control" placeholder="Enter new password" value={editUser.password} onChange={(e) => setEditUser((p) => ({ ...p, password: e.target.value }))} disabled={editingUserSaving} />
                        <button type="button" className="btn btn-outline-secondary" onClick={() => setShowEditPwd((v) => !v)} tabIndex={-1}>
                          <i className={`ti ${showEditPwd ? "ti-eye-off" : "ti-eye"}`} />
                        </button>
                      </div>
                    </div>
                    <div className="mb-0">
                      <label className="form-label">Role</label>
                      <select className="form-select" value={editUser.roleId} onChange={(e) => setEditUser((p) => ({ ...p, roleId: e.target.value }))} disabled={editingUserSaving}>
                        <option value="">No role</option>
                        {visibleRoles.map((r) => <option key={r.id} value={r.id}>{r.role}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="modal-footer gap-2">
                    <button type="button" className="btn btn-light border" onClick={() => setEditingUser(null)} disabled={editingUserSaving}>Cancel</button>
                    <button type="submit" className="btn btn-primary" disabled={editingUserSaving || editUsernameStatus === "taken" || editUsernameStatus === "checking"}>{editingUserSaving ? "Saving..." : "Save Changes"}</button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Delete User ── */}
      <ConfirmationModal
        open={!!deletingUser}
        title="Delete User?"
        description={deletingUser ? (<>Are you sure you want to delete <strong>{deletingUser.name}</strong>? This action cannot be undone.</>) : undefined}
        confirmText="Delete"
        confirmVariant="danger"
        confirmLoading={deletingUserInProgress}
        icon={<i className="ti ti-trash" />}
        onConfirm={handleDeleteUser}
        onCancel={() => { if (!deletingUserInProgress) setDeletingUser(null); }}
      />
    </>
  );
};

export default RolesAndPermissionsComponent;
