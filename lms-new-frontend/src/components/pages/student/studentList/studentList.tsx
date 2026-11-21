"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Checkbox, Input, Popover, Select, Table, Tooltip } from "antd";
import type { ColumnsType, TablePaginationConfig, TableRowSelection } from "antd/es/table/interface";
import { DownOutlined, UpOutlined } from "@ant-design/icons";
import { useNotification } from "@/hooks/useNotification";

import { all_routes } from "@/routes/all_routes";
import { resolveImageUrl } from "@/environment";
import { useStudents, ChannelFilter, LabelFilter } from "@/hooks/useStudents";
import { useAppDispatch, useAppSelector } from "@/core/redux/hooks";
import { deleteStudentThunk, toggleStudentStatusThunk, bulkDeleteStudentsThunk } from "@/core/redux/studentSlice";
import { changeStudentPassword } from "@/services/studentService";
import { Student } from "@/types/student";
import { usePermissionGuard } from "@/lib/usePermissionGuard";
import { canAccess, PERMISSIONS } from "@/lib/permissions";
import ConfirmationModal from "@/core/common/modals/confirmationModal";
import ChangePasswordModal from "@/core/common/modals/changePasswordModal";
import StatsCards, { StatCardItem } from "@/core/common/statsCards/StatsCards";
import EditStudentModal from "./editStudentModal";
import ChangePlanModal from "./changePlanModal";
import BulkImportModal from "./BulkImportModal";

interface StudentRow {
  key: string;
  serial: number;
  studentId: string;
  name: string;
  username: string;
  email: string;
  status: string;
  raw: Student;
}

type PendingAction =
  | { type: "delete"; id: string; name: string }
  | { type: "password"; username: string; name: string }
  | { type: "toggle"; id: string; name: string; currentStatus: string }
  | { type: "bulkDelete"; ids: string[] };

const StudentListComponent = () => {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const notify = useNotification();
  const user = useAppSelector((state) => state.auth.user);
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  usePermissionGuard(PERMISSIONS.STUDENTS_VIEW);
  const roleName = user?.role?.name ?? null;
  const permissions = user?.permissions ?? [];
  const canCreate = canAccess(roleName, permissions, PERMISSIONS.STUDENTS_CREATE);
  const canEdit = canAccess(roleName, permissions, PERMISSIONS.STUDENTS_EDIT);
  const canDelete = canAccess(roleName, permissions, PERMISSIONS.STUDENTS_DELETE);

  const {
    paginatedItems,
    allItems,
    filteredItems,
    totalCount,
    currentPage,
    setCurrentPage,
    pageSize,
    setPageSize,
    searchTerm,
    setSearchTerm,
    statusFilter,
    setStatusFilter,
    assignFilter,
    setAssignFilter,
    planFilter,
    setPlanFilter,
    feeFilter,
    setFeeFilter,
    teacherFilter,
    setTeacherFilter,
    channelFilter,
    setChannelFilter,
    labelFilter,
    setLabelFilter,
    timezoneFilter,
    setTimezoneFilter,
    hasActiveFilters,
    clearFilters,
    loading,
    error,
    loadStudents,
    deletingStudentId,
    deleting,
  } = useStudents();

  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [editStudent, setEditStudent] = useState<Student | null>(null);
  const [planStudent, setPlanStudent] = useState<Student | null>(null);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [filtersExpanded, setFiltersExpanded] = useState(true);
  const activeFilterCount = [
    teacherFilter !== "all",
    assignFilter !== "all",
    planFilter !== "all",
    feeFilter !== "all",
    channelFilter !== "all",
    labelFilter !== "all",
    timezoneFilter !== "all",
  ].filter(Boolean).length;
  const [colSettingsOpen, setColSettingsOpen] = useState(false);
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());

  const COLUMN_LABELS: Record<string, string> = {
    studentId: "ID",
    name: "Name",
    assignedTeacher: "Assigned Teacher",
    parent: "Parent",
    isAssigned: "Assign Status",
    plan: "Plan",
    feeStatus: "Fee Status",
    courseName: "Course",
    enrollmentChannel: "Enroll Channel",
    studentLabel: "Label",
    status: "Status",
  };

  const toggleColumn = (key: string) => {
    setHiddenColumns((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  useEffect(() => {
    if (error) notify.error(error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error]);

  useEffect(() => {
    setSelectedRowKeys([]);
  }, [
    currentPage,
    statusFilter,
    assignFilter,
    planFilter,
    feeFilter,
    teacherFilter,
    channelFilter,
    labelFilter,
    searchTerm,
  ]);

  // Derive unique plan options from loaded students
  const planOptions = useMemo(() => {
    const seen = new Map<string, string>();
    allItems.forEach((s) => {
      if (s.plan) seen.set(String(s.plan.id), s.plan.name);
    });
    return Array.from(seen.entries()).map(([id, name]) => ({ value: id, label: name }));
  }, [allItems]);

  // Derive unique teacher options from loaded students
  const teacherOptions = useMemo(() => {
    const seen = new Map<string, string>();
    allItems.forEach((s) => {
      if (s.assignedTeacher) {
        const t = s.assignedTeacher;
        seen.set(String(t.id), `${t.firstName} ${t.lastName ?? ""}`.trim());
      }
    });
    return Array.from(seen.entries())
      .map(([id, name]) => ({ value: id, label: name }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [allItems]);

  // Status counts from ALL items (not filtered)
  const activeCount = allItems.filter((s) => (s.status ?? "active").toLowerCase() === "active").length;
  const inactiveCount = allItems.filter((s) => (s.status ?? "active").toLowerCase() !== "active").length;

  const tableData: StudentRow[] = paginatedItems.map((student, index) => ({
    key: String(student.id),
    serial: (currentPage - 1) * pageSize + index + 1,
    studentId: String(student.id),
    name: `${student.firstName} ${student.lastName ?? ""}`.trim(),
    username: student.username,
    email: student.email ?? "—",
    status: student.status ?? "active",
    raw: student,
  }));

  /* ── Action handlers ─────────────────────────────────────── */
  const confirmDelete = async () => {
    if (!pendingAction || pendingAction.type !== "delete") return;
    try {
      await dispatch(deleteStudentThunk(pendingAction.id)).unwrap();
      setSelectedRowKeys((prev) => prev.filter((k) => k !== (pendingAction as { id: string }).id));
      setPendingAction(null);
      notify.success("Student deleted successfully");
    } catch (err: unknown) {
      notify.error(
        typeof err === "string" ? err : ((err as { message?: string })?.message ?? "Failed to delete student."),
      );
    }
  };

  const confirmToggle = async () => {
    if (!pendingAction || pendingAction.type !== "toggle") return;
    setActionLoading(pendingAction.id);
    try {
      await dispatch(toggleStudentStatusThunk(pendingAction.id)).unwrap();
      setPendingAction(null);
      notify.success("Student status updated");
    } catch (err: unknown) {
      notify.error(
        typeof err === "string" ? err : ((err as { message?: string })?.message ?? "Failed to update status."),
      );
    } finally {
      setActionLoading(null);
    }
  };

  const confirmBulkDelete = async () => {
    if (!pendingAction || pendingAction.type !== "bulkDelete") return;
    setBulkDeleting(true);
    try {
      await dispatch(bulkDeleteStudentsThunk(pendingAction.ids)).unwrap();
      setSelectedRowKeys([]);
      setPendingAction(null);
      notify.success(`${(pendingAction as { ids: string[] }).ids.length} student(s) deleted`);
    } catch (err: unknown) {
      notify.error(
        typeof err === "string" ? err : ((err as { message?: string })?.message ?? "Failed to delete students."),
      );
    } finally {
      setBulkDeleting(false);
    }
  };

  const confirmPasswordChange = async (password: string) => {
    if (!pendingAction || pendingAction.type !== "password") return;
    setPasswordLoading(true);
    try {
      await changeStudentPassword({ username: (pendingAction as { username: string }).username, password });
      setPendingAction(null);
      notify.success("Password changed successfully");
    } catch (err: unknown) {
      notify.error(
        typeof err === "string" ? err : ((err as { message?: string })?.message ?? "Failed to change password."),
      );
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleEditSuccess = () => {
    setEditStudent(null);
    loadStudents();
    notify.success("Student updated successfully");
  };

  const handlePlanSuccess = () => {
    setPlanStudent(null);
    loadStudents();
    notify.success("Plan assigned successfully");
  };

  const handleChatClick = (student: Student) => {
    const name = `${student.firstName} ${student.lastName ?? ""}`.trim();
    router.push(`${all_routes.chat}?targetId=${student.id}&targetType=STUDENT&targetName=${encodeURIComponent(name)}`);
  };

  /* ── Row selection ───────────────────────────────────────── */
  const rowSelection: TableRowSelection<StudentRow> = {
    selectedRowKeys,
    onChange: (keys) => setSelectedRowKeys(keys as string[]),
    columnWidth: 48,
  };

  /* ── Columns ─────────────────────────────────────────────── */
  const allColumns: ColumnsType<StudentRow> = [
    {
      title: "ID",
      dataIndex: "studentId",
      key: "studentId",
      width: 70,
      render: (v) => <span className="text-muted fs-12">#{v}</span>,
    },
    {
      title: "Name",
      dataIndex: "name",
      key: "name",
      fixed: undefined,
      width: 180,
      render: (v, record) => (
        <Link
          href={`/admin/students/${record.raw.id}`}
          className="d-flex align-items-center gap-2 text-decoration-none"
        >
          {record.raw.profileImg ? (
            <img
              src={`${resolveImageUrl(record.raw.profileImg)}`}
              alt={v}
              width={32}
              height={32}
              style={{ borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
              onError={(e) => {
                (e.target as HTMLImageElement).src = "/assets/img/users/user-01.jpg";
              }}
            />
          ) : (
            <span
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                flexShrink: 0,
                background: "#e9ecef",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 14,
                color: "#6c757d",
              }}
            >
              <i className="ti ti-user" />
            </span>
          )}
          <span className="fw-semibold text-dark">{v}</span>
        </Link>
      ),
    },
    {
      title: "Assigned Teacher",
      key: "assignedTeacher",
      width: 160,
      render: (_, record) => {
        const t = record.raw.assignedTeacher;
        if (!t) return <span className="text-muted fs-12">—</span>;
        return (
          <Link
            href={`/admin/teachers/${t.id}`}
            className="d-inline-flex align-items-center gap-2 text-decoration-none fs-13"
          >
            {t.imageUrl ? (
              <img
                src={`${resolveImageUrl(t.imageUrl)}`}
                alt=""
                width={26}
                height={26}
                style={{ borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
                onError={(e) => {
                  (e.target as HTMLImageElement).src = "/assets/img/users/user-01.jpg";
                }}
              />
            ) : (
              <span
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: "50%",
                  background: "#dbeafe",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 13,
                  color: "#3b82f6",
                  flexShrink: 0,
                }}
              >
                <i className="ti ti-user" />
              </span>
            )}
            <span className="text-primary">{`${t.firstName} ${t.lastName ?? ""}`.trim()}</span>
          </Link>
        );
      },
    },
    {
      title: "Parent",
      key: "parent",
      width: 140,
      render: (_, record) => {
        const p = record.raw.parent;
        if (!p) return <span className="text-muted fs-12">—</span>;
        return (
          <Link
            href={`/admin/parents/${p.id}`}
            className="d-inline-flex align-items-center gap-2 text-decoration-none fs-13"
          >
            {p.profileImg ? (
              <img
                src={`${resolveImageUrl(p.profileImg)}`}
                alt=""
                width={26}
                height={26}
                style={{ borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
                onError={(e) => {
                  (e.target as HTMLImageElement).src = "/assets/img/users/user-01.jpg";
                }}
              />
            ) : (
              <span
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: "50%",
                  background: "#d1fae5",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 13,
                  color: "#10b981",
                  flexShrink: 0,
                }}
              >
                <i className="ti ti-users" />
              </span>
            )}
            <span className="text-info">{`${p.firstName} ${p.lastName ?? ""}`.trim()}</span>
          </Link>
        );
      },
    },
    {
      title: "Assign Status",
      key: "isAssigned",
      width: 130,
      render: (_, record) => (
        <span
          className={`badge rounded fs-12 fw-medium ${
            record.raw.isAssigned
              ? "badge-soft-success text-success border border-success"
              : "badge-soft-secondary text-secondary border border-secondary"
          }`}
        >
          {record.raw.isAssigned ? "Assigned" : "Not Assigned"}
        </span>
      ),
    },
    {
      title: "Plan",
      key: "plan",
      width: 120,
      render: (_, record) => {
        const plan = record.raw.plan;
        if (!plan) return <span className="text-muted fs-12">—</span>;
        return (
          <span className="badge badge-soft-primary text-primary border border-primary rounded fs-12 fw-medium">
            {plan.name}
          </span>
        );
      },
    },
    {
      title: "Fee Status",
      key: "feeStatus",
      width: 110,
      render: (_, record) => {
        const fs = record.raw.feeStatus ?? "none";
        if (fs === "none") return <span className="text-muted fs-12">—</span>;
        return (
          <span
            className={`badge rounded fs-12 fw-medium ${
              fs === "paid"
                ? "badge-soft-success text-success border border-success"
                : "badge-soft-danger text-danger border border-danger"
            }`}
          >
            {fs === "paid" ? "Paid" : "Unpaid"}
          </span>
        );
      },
    },
    {
      title: "Course",
      key: "courseName",
      width: 140,
      ellipsis: true,
      render: (_, record) =>
        record.raw.courseName ? (
          <span className="fs-13">{record.raw.courseName}</span>
        ) : (
          <span className="text-muted fs-12">—</span>
        ),
    },
    {
      title: "Enroll Channel",
      key: "enrollmentChannel",
      width: 130,
      render: (_, record) => {
        const ch = record.raw.enrollmentChannel;
        if (!ch) return <span className="text-muted fs-12">—</span>;
        const colorMap: Record<string, string> = {
          Meta: "badge-soft-primary text-primary border-primary",
          Google: "badge-soft-success text-success border-success",
          TikTok: "badge-soft-danger text-danger border-danger",
          SEO: "badge-soft-warning text-warning border-warning",
          Email: "badge-soft-info text-info border-info",
          Reference: "badge-soft-secondary text-secondary border-secondary",
        };
        return (
          <span
            className={`badge rounded fs-12 fw-medium border ${colorMap[ch] ?? "badge-soft-secondary text-secondary border-secondary"}`}
          >
            {ch}
          </span>
        );
      },
    },
    {
      title: "Label",
      key: "studentLabel",
      width: 130,
      render: (_, record) => {
        const label = record.raw.studentLabel;
        if (!label) return <span className="text-muted fs-12">—</span>;
        const colorMap: Record<string, string> = {
          Unassigned: "badge-soft-secondary text-secondary border-secondary",
          Trial: "badge-soft-info text-info border-info",
          "New Enrollment": "badge-soft-success text-success border-success",
          Lost: "badge-soft-warning text-warning border-warning",
          "Struck off": "badge-soft-danger text-danger border-danger",
        };
        return (
          <span
            className={`badge rounded fs-12 fw-medium border ${colorMap[label] ?? "badge-soft-secondary text-secondary border-secondary"}`}
            title={label === "Struck off" && record.raw.struckOffReason ? record.raw.struckOffReason : undefined}
          >
            {label}
            {label === "Struck off" && record.raw.struckOffReason && (
              <i className="ti ti-info-circle ms-1" style={{ fontSize: 11 }} />
            )}
          </span>
        );
      },
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 100,
      render: (v: string) => {
        const isActive = v?.toLowerCase() === "active";
        return (
          <span
            className={`badge rounded fs-12 fw-medium ${
              isActive
                ? "badge-soft-success text-success border-success border"
                : "badge-soft-danger text-danger border-danger border"
            }`}
          >
            {isActive ? "Active" : "Inactive"}
          </span>
        );
      },
    },
    {
      title: "Actions",
      key: "actions",
      width: 200,
      render: (_, record) => {
        const isDeleting = deletingStudentId === record.key && deleting;
        const isToggling = actionLoading === record.key;
        const isActive = record.status?.toLowerCase() === "active";
        return (
          <div className="d-flex gap-1 flex-nowrap align-items-center">
            <Tooltip title="View Student">
              <Link href={`/admin/students/${record.raw.id}`} className="btn btn-outline-info btn-icon btn-sm">
                <i className="ti ti-eye" />
              </Link>
            </Tooltip>
            {canEdit && (
              <Tooltip title="Change Password">
                <button
                  type="button"
                  className="btn btn-outline-warning btn-icon btn-sm"
                  onClick={() => setPendingAction({ type: "password", username: record.username, name: record.name })}
                >
                  <i className="ti ti-lock" />
                </button>
              </Tooltip>
            )}
            {canEdit && (
              <Tooltip title="Edit Student">
                <button
                  type="button"
                  className="btn btn-outline-primary btn-icon btn-sm"
                  onClick={() => setEditStudent(record.raw)}
                >
                  <i className="ti ti-edit" />
                </button>
              </Tooltip>
            )}
            {canEdit && (
              <Tooltip title="Change Plan">
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-icon btn-sm"
                  onClick={() => setPlanStudent(record.raw)}
                >
                  <i className="ti ti-credit-card" />
                </button>
              </Tooltip>
            )}
            {canEdit && (
              <Tooltip title={isActive ? "Deactivate" : "Activate"}>
                <button
                  type="button"
                  className={`btn btn-icon btn-sm ${isActive ? "btn-outline-secondary" : "btn-outline-success"}`}
                  disabled={isToggling}
                  onClick={() =>
                    setPendingAction({
                      type: "toggle",
                      id: record.key,
                      name: record.name,
                      currentStatus: record.status,
                    })
                  }
                >
                  <i className={isToggling ? "ti ti-loader" : isActive ? "ti ti-toggle-right" : "ti ti-toggle-left"} />
                </button>
              </Tooltip>
            )}
            <Tooltip title="Open Chat">
              <button
                type="button"
                className="btn btn-outline-info btn-icon btn-sm"
                onClick={() => handleChatClick(record.raw)}
              >
                <i className="ti ti-message" />
              </button>
            </Tooltip>
            {canDelete && (
              <Tooltip title="Delete Student">
                <button
                  type="button"
                  className="btn btn-outline-danger btn-icon btn-sm"
                  disabled={isDeleting}
                  onClick={() => setPendingAction({ type: "delete", id: record.key, name: record.name })}
                >
                  <i className={isDeleting ? "ti ti-loader" : "ti ti-trash"} />
                </button>
              </Tooltip>
            )}
          </div>
        );
      },
    },
  ];

  // Filter out hidden columns (Actions column is always shown)
  const columns = allColumns.filter((col) => col.key === "actions" || !hiddenColumns.has(col.key as string));

  /* ── Pagination ──────────────────────────────────────────── */
  const paginationConfig: TablePaginationConfig = {
    current: currentPage,
    pageSize,
    total: totalCount,
    showSizeChanger: false,
    onChange: (page) => setCurrentPage(page),
    showTotal: () => (
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        Rows per page:
        <Select
          value={pageSize}
          onChange={(v) => setPageSize(Number(v))}
          style={{ width: 80 }}
          popupMatchSelectWidth={false}
        >
          {[10, 20, 30, 50].map((s) => (
            <Select.Option key={s} value={s}>
              {s}
            </Select.Option>
          ))}
        </Select>
        of {totalCount} Entries
      </div>
    ),
    itemRender: (_p, type, orig) => {
      if (type === "prev")
        return (
          <span className="ant-pagination-item-link">
            <i className="ti ti-chevron-left" />
          </span>
        );
      if (type === "next")
        return (
          <span className="ant-pagination-item-link">
            <i className="ti ti-chevron-right" />
          </span>
        );
      return orig;
    },
  };

  /* ── JSX ─────────────────────────────────────────────────── */
  return (
    <div className="page-wrapper">
      <style
        dangerouslySetInnerHTML={{
          __html: `
        .student-list-filters .ant-select { width: 100% !important; }
        .student-list-filters .nav-pills button.nav-link {
          border: none; cursor: pointer; display: inline-flex;
          align-items: center; gap: 6px; white-space: nowrap;
        }
        .student-list-filters .nav-pills { width: 100%; }
      `,
        }}
      />

      <div className="content">
        {/* Page Header */}
        <div className="d-flex align-items-sm-center flex-sm-row flex-column gap-2 pb-3 mb-3">
          <div className="flex-grow-1">
            <h4 className="fw-bold mb-0">
              Student List
              <span className="badge badge-soft-primary fw-medium border py-1 px-2 border-primary fs-13 ms-2">
                Total: {allItems.length}
                {selectedRowKeys.length > 0 && ` | Selected: ${selectedRowKeys.length}`}
              </span>
            </h4>
          </div>
          <div className="text-end d-flex gap-2 flex-wrap align-items-center">
            {canDelete && selectedRowKeys.length > 0 && (
              <Button
                danger
                size="middle"
                icon={<i className="ti ti-trash me-1" />}
                loading={bulkDeleting}
                className="d-inline-flex align-items-center"
                onClick={() => setPendingAction({ type: "bulkDelete", ids: selectedRowKeys })}
              >
                Delete Selected ({selectedRowKeys.length})
              </Button>
            )}
            <button
              type="button"
              className="btn btn-outline-light border d-inline-flex align-items-center gap-1"
              onClick={() => loadStudents()}
              disabled={loading}
            >
              <i className="ti ti-refresh" />
              Refresh
            </button>
            {canCreate && (
              <Button
                icon={<i className="ti ti-file-import me-1" />}
                onClick={() => setBulkImportOpen(true)}
                className="d-inline-flex align-items-center"
                style={{ marginRight: 8 }}
              >
                Bulk Import
              </Button>
            )}
            {canCreate && (
              <Link href={all_routes.manageStudentCreate} className="btn btn-primary fs-13 btn-md">
                <i className="ti ti-plus me-1" />
                New Student
              </Link>
            )}
          </div>
        </div>

        {/* Overview Cards */}
        {(() => {
          const total = allItems.length;
          const trial = allItems.filter((s) => s.studentLabel === "Trial").length;
          const cards: StatCardItem[] = [
            {
              label: "Total Students",
              value: total,
              icon: "ti-users",
              hex: "#2E37A4",
              spark: [18, 28, 22, 35, 25, 42, 38, 50, 44, 58],
            },
            {
              label: "Active Students",
              value: activeCount,
              icon: "ti-circle-check",
              hex: "#27AE60",
              spark: [30, 42, 35, 50, 40, 60, 52, 68, 58, 75],
            },
            {
              label: "Inactive Students",
              value: inactiveCount,
              icon: "ti-user-minus",
              hex: "#F2994A",
              spark: [45, 32, 40, 28, 38, 22, 30, 18, 25, 15],
            },
            {
              label: "Trial Students",
              value: trial,
              icon: "ti-star",
              hex: "#2F80ED",
              spark: [20, 35, 28, 45, 32, 50, 40, 58, 48, 65],
            },
          ];
          return <StatsCards cards={cards} loading={loading} />;
        })()}

        {/* Filter Card */}
        <div className="card mb-0 sf-filter-card" style={{ borderRadius: "16px 16px 0 0" }}>
          <div className="card-body pb-2">
            {/* Row 1: Status tabs | Filters toggle + Search */}
            <div className="row g-3 align-items-center student-list-filters">
              {/* Status tabs */}
              <div className="col-12 col-md-auto">
                <div style={{ display: "flex", background: "#f0f1f7", borderRadius: 10, padding: 4, gap: 2 }}>
                  {(
                    [
                      { key: "all", label: "All", icon: "ti-users", color: "#2E37A4", count: allItems.length },
                      { key: "active", label: "Active", icon: "ti-circle-check", color: "#27AE60", count: activeCount },
                      {
                        key: "inactive",
                        label: "Inactive",
                        icon: "ti-circle-minus",
                        color: "#EF1E1E",
                        count: inactiveCount,
                      },
                    ] as { key: typeof statusFilter; label: string; icon: string; color: string; count: number }[]
                  ).map(({ key, label, icon, color, count }) => {
                    const isActive = statusFilter === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setStatusFilter(key)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          padding: "7px 16px",
                          borderRadius: 7,
                          border: "none",
                          cursor: "pointer",
                          background: isActive ? color : "transparent",
                          boxShadow: isActive ? `0 2px 8px ${color}55` : "none",
                          color: isActive ? "#fff" : "#858D9C",
                          fontWeight: isActive ? 600 : 500,
                          fontSize: 13,
                          transition: "all 0.18s ease",
                          whiteSpace: "nowrap",
                        }}
                      >
                        <i className={`ti ${icon}`} style={{ fontSize: 15 }} />
                        {label}
                        <span
                          style={{
                            background: isActive ? "rgba(255,255,255,0.25)" : "#e7e8eb",
                            color: isActive ? "#fff" : "#858D9C",
                            borderRadius: 20,
                            fontSize: 11,
                            fontWeight: 700,
                            minWidth: 20,
                            height: 20,
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            padding: "0 5px",
                            lineHeight: 1,
                            transition: "all 0.18s ease",
                          }}
                        >
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Search + Filters toggle + Column settings */}
              <div className="col-12 col-md-auto ms-md-auto d-flex align-items-center gap-2">
                <div style={{ flex: "1 1 200px", minWidth: 0 }}>
                  <Input
                    placeholder="Search by name, email, contact..."
                    prefix={<i className="ti ti-search text-muted" />}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    allowClear
                    size="large"
                    style={{ borderWidth: "1px", boxShadow: "none" }}
                  />
                </div>
                <Button
                  type={activeFilterCount > 0 || filtersExpanded ? "primary" : "default"}
                  size="large"
                  className="d-flex align-items-center gap-1"
                  style={{ borderColor: activeFilterCount > 0 || filtersExpanded ? "#2E37A4" : undefined }}
                  onClick={() => setFiltersExpanded((v) => !v)}
                >
                  <i
                    className={`ti ti-filter ${activeFilterCount > 0 || filtersExpanded ? "text-white" : "text-gray-5"}`}
                  />
                  Filters
                  {activeFilterCount > 0 && (
                    <span
                      style={{
                        background: "#EF1E1E",
                        color: "#fff",
                        borderRadius: "50%",
                        fontSize: 11,
                        fontWeight: 700,
                        width: 18,
                        height: 18,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        lineHeight: 1,
                      }}
                    >
                      {activeFilterCount}
                    </span>
                  )}
                  {filtersExpanded ? (
                    <UpOutlined style={{ fontSize: 11 }} />
                  ) : (
                    <DownOutlined style={{ fontSize: 11 }} />
                  )}
                </Button>

                {/* Column visibility settings */}
                <Popover
                  open={colSettingsOpen}
                  onOpenChange={setColSettingsOpen}
                  trigger="click"
                  placement="bottomRight"
                  title={
                    <div className="d-flex align-items-center justify-content-between">
                      <span className="fw-semibold fs-13">Toggle Columns</span>
                      {hiddenColumns.size > 0 && (
                        <button
                          type="button"
                          className="btn btn-link btn-sm text-primary p-0 fs-12"
                          onClick={() => setHiddenColumns(new Set())}
                        >
                          Show All
                        </button>
                      )}
                    </div>
                  }
                  content={
                    <div style={{ minWidth: 180 }}>
                      {Object.entries(COLUMN_LABELS).map(([key, label]) => (
                        <div key={key} className="d-flex align-items-center gap-2 py-1 px-1 rounded">
                          <Checkbox checked={!hiddenColumns.has(key)} onChange={() => toggleColumn(key)} />
                          <span
                            className="fs-13"
                            style={{ cursor: "pointer", userSelect: "none" }}
                            onClick={() => toggleColumn(key)}
                          >
                            {label}
                          </span>
                        </div>
                      ))}
                    </div>
                  }
                >
                  <Tooltip title="Column Settings">
                    <Button
                      type={colSettingsOpen || hiddenColumns.size > 0 ? "primary" : "default"}
                      size="large"
                      className="d-flex align-items-center justify-content-center"
                      icon={
                        <i
                          className={`ti ti-settings ${colSettingsOpen || hiddenColumns.size > 0 ? "text-white" : "text-gray-5"}`}
                        />
                      }
                      style={{
                        flexShrink: 0,
                        borderColor: colSettingsOpen || hiddenColumns.size > 0 ? "#1890ff" : undefined,
                      }}
                    />
                  </Tooltip>
                </Popover>
              </div>
            </div>

            {/* Row 2: Collapsible filter dropdowns */}
            <div
              className={`filter-panel-row ${filtersExpanded ? "expanded" : "collapsed"}`}
              style={{ paddingTop: filtersExpanded ? 12 : 0, marginTop: filtersExpanded ? 12 : 0 }}
            >
              <div className="filter-panel-box">
                <div className="filter-panel-heading">
                  <i className="ti ti-filter" />
                  <span className="filter-panel-title">Filter by</span>
                  {activeFilterCount > 0 && (
                    <span className="filter-panel-count">
                      {activeFilterCount} filter{activeFilterCount > 1 ? "s" : ""} active
                    </span>
                  )}
                </div>
                <div className="row g-3 align-items-end">
                  {/* Teacher */}
                  <div className="col-md-auto">
                    <div className="sf-filter-item">
                      <label>Teacher</label>
                      <Select
                        allowClear
                        showSearch
                        size="large"
                        placeholder="All teachers"
                        style={{ minWidth: 200 }}
                        value={teacherFilter === "all" ? undefined : teacherFilter}
                        onChange={(v) => setTeacherFilter(v ?? "all")}
                        options={teacherOptions}
                        suffixIcon={<i className="ti ti-chalkboard" />}
                        filterOption={(input, option) =>
                          (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
                        }
                        notFoundContent="No assigned teachers"
                      />
                    </div>
                  </div>

                  {/* Assign Status */}
                  <div className="col-md-auto">
                    <div className="sf-filter-item">
                      <label>Assign Status</label>
                      <Select
                        allowClear
                        size="large"
                        placeholder="All statuses"
                        style={{ minWidth: 180 }}
                        value={assignFilter === "all" ? undefined : assignFilter}
                        onChange={(v) => setAssignFilter((v as typeof assignFilter) ?? "all")}
                        suffixIcon={<i className="ti ti-user-check" />}
                        options={[
                          { value: "assigned", label: "Assigned" },
                          { value: "unassigned", label: "Not Assigned" },
                        ]}
                      />
                    </div>
                  </div>

                  {/* Plan */}
                  <div className="col-md-auto">
                    <div className="sf-filter-item">
                      <label>Plan</label>
                      <Select
                        allowClear
                        size="large"
                        placeholder="All plans"
                        style={{ minWidth: 180 }}
                        value={planFilter === "all" ? undefined : planFilter}
                        onChange={(v) => setPlanFilter(v ?? "all")}
                        suffixIcon={<i className="ti ti-credit-card" />}
                        options={planOptions}
                        notFoundContent="No plans found"
                      />
                    </div>
                  </div>

                  {/* Fee Status */}
                  <div className="col-md-auto">
                    <div className="sf-filter-item">
                      <label>Fee Status</label>
                      <Select
                        allowClear
                        size="large"
                        placeholder="All fees"
                        style={{ minWidth: 160 }}
                        value={feeFilter === "all" ? undefined : feeFilter}
                        onChange={(v) => setFeeFilter((v as typeof feeFilter) ?? "all")}
                        suffixIcon={<i className="ti ti-receipt" />}
                        options={[
                          { value: "paid", label: "Paid" },
                          { value: "unpaid", label: "Unpaid" },
                          { value: "none", label: "No Fees" },
                        ]}
                      />
                    </div>
                  </div>

                  {/* Enrollment Channel */}
                  <div className="col-md-auto">
                    <div className="sf-filter-item">
                      <label>Channel</label>
                      <Select
                        allowClear
                        size="large"
                        placeholder="All channels"
                        style={{ minWidth: 175 }}
                        value={channelFilter === "all" ? undefined : channelFilter}
                        onChange={(v) => setChannelFilter((v as ChannelFilter) ?? "all")}
                        suffixIcon={<i className="ti ti-antenna" />}
                        options={[
                          { value: "Meta", label: "Meta" },
                          { value: "Google", label: "Google" },
                          { value: "TikTok", label: "TikTok" },
                          { value: "SEO", label: "SEO" },
                          { value: "Email", label: "Email" },
                          { value: "Reference", label: "Reference" },
                        ]}
                      />
                    </div>
                  </div>

                  {/* Student Label */}
                  <div className="col-md-auto">
                    <div className="sf-filter-item">
                      <label>Label</label>
                      <Select
                        allowClear
                        size="large"
                        placeholder="All labels"
                        style={{ minWidth: 175 }}
                        value={labelFilter === "all" ? undefined : labelFilter}
                        onChange={(v) => setLabelFilter((v as LabelFilter) ?? "all")}
                        suffixIcon={<i className="ti ti-tag" />}
                        options={[
                          { value: "Unassigned", label: "Unassigned" },
                          { value: "Trial", label: "Trial" },
                          { value: "New Enrollment", label: "New Enrollment" },
                          { value: "Lost", label: "Lost" },
                          { value: "Struck off", label: "Struck off" },
                        ]}
                      />
                    </div>
                  </div>

                  {/* Timezone */}
                  <div className="col-md-auto">
                    <div className="sf-filter-item">
                      <label>Timezone</label>
                      <Select
                        allowClear
                        showSearch
                        size="large"
                        placeholder="All timezones"
                        style={{ minWidth: 215 }}
                        value={timezoneFilter === "all" ? undefined : timezoneFilter}
                        onChange={(v) => setTimezoneFilter(v ?? "all")}
                        suffixIcon={<i className="ti ti-world" />}
                        filterOption={(input, option) =>
                          (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
                        }
                        options={[
                          { value: "Asia/Karachi", label: "🇵🇰 Pakistan (PKT)" },
                          { value: "Asia/Dubai", label: "🇦🇪 Dubai (GST)" },
                          { value: "Asia/Kolkata", label: "🇮🇳 India (IST)" },
                          { value: "Asia/Dhaka", label: "🇧🇩 Bangladesh (BST)" },
                          { value: "Asia/Singapore", label: "🇸🇬 Singapore (SGT)" },
                          { value: "Asia/Shanghai", label: "🇨🇳 China (CST)" },
                          { value: "Asia/Tokyo", label: "🇯🇵 Japan (JST)" },
                          { value: "Asia/Seoul", label: "🇰🇷 South Korea (KST)" },
                          { value: "Pacific/Auckland", label: "🇳🇿 New Zealand (NZST)" },
                          { value: "Australia/Sydney", label: "🇦🇺 Australia Sydney (AEST)" },
                          { value: "Europe/London", label: "🇬🇧 UK (GMT/BST)" },
                          { value: "Europe/Paris", label: "🇫🇷 France (CET)" },
                          { value: "Europe/Berlin", label: "🇩🇪 Germany (CET)" },
                          { value: "Europe/Moscow", label: "🇷🇺 Russia Moscow (MSK)" },
                          { value: "Africa/Cairo", label: "🇪🇬 Egypt (EET)" },
                          { value: "America/New_York", label: "🇺🇸 USA New York (EST/EDT)" },
                          { value: "America/Chicago", label: "🇺🇸 USA Chicago (CST/CDT)" },
                          { value: "America/Denver", label: "🇺🇸 USA Denver (MST/MDT)" },
                          { value: "America/Los_Angeles", label: "🇺🇸 USA Los Angeles (PST/PDT)" },
                          { value: "America/Toronto", label: "🇨🇦 Canada Toronto (EST/EDT)" },
                          { value: "America/Sao_Paulo", label: "🇧🇷 Brazil (BRT)" },
                          { value: "UTC", label: "🌐 UTC" },
                        ]}
                      />
                    </div>
                  </div>

                  {/* Clear button — only shown when filters are active */}
                  {hasActiveFilters && (
                    <div className="col-md-auto">
                      <div className="sf-filter-item">
                        <label>&nbsp;</label>
                        <button type="button" className="btn filter-panel-clear-btn" onClick={clearFilters}>
                          <i className="ti ti-x fs-12" />
                          Clear all
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Table Card */}
        <div
          className="card"
          style={{ marginTop: 0, borderRadius: "0 0 8px 8px" /* borderTop: "3px solid rgba(46,55,164,0.2)" */ }}
        >
          <div className="card-body" style={{ paddingTop: 16 }}>
            <Table<StudentRow>
              className="table table-nowrap datatable"
              columns={columns}
              dataSource={tableData}
              pagination={paginationConfig}
              loading={loading}
              rowKey="key"
              rowSelection={canDelete ? rowSelection : undefined}
              scroll={{ x: 1700 }}
              locale={{ emptyText: "No students found." }}
            />
          </div>
        </div>
      </div>

      {/* Delete Confirmation */}
      <ConfirmationModal
        open={pendingAction?.type === "delete"}
        title="Delete Student?"
        description={
          pendingAction?.type === "delete" ? (
            <>
              You are about to permanently remove <strong>{pendingAction.name}</strong>. This cannot be undone.
            </>
          ) : undefined
        }
        confirmText="Delete"
        confirmVariant="danger"
        confirmLoading={pendingAction?.type === "delete" ? deletingStudentId === pendingAction.id && deleting : false}
        icon={<i className="ti ti-trash" />}
        onConfirm={confirmDelete}
        onCancel={() => {
          if (!deleting) setPendingAction(null);
        }}
      />

      {/* Bulk Delete Confirmation */}
      <ConfirmationModal
        open={pendingAction?.type === "bulkDelete"}
        title="Delete Selected Students?"
        description={
          pendingAction?.type === "bulkDelete" ? (
            <>
              Permanently delete <strong>{pendingAction.ids.length} student(s)</strong>? This cannot be undone.
            </>
          ) : undefined
        }
        confirmText="Delete All"
        confirmVariant="danger"
        confirmLoading={bulkDeleting}
        icon={<i className="ti ti-trash" />}
        onConfirm={confirmBulkDelete}
        onCancel={() => {
          if (!bulkDeleting) setPendingAction(null);
        }}
      />

      {/* Toggle Status Confirmation */}
      <ConfirmationModal
        open={pendingAction?.type === "toggle"}
        title={
          pendingAction?.type === "toggle"
            ? pendingAction.currentStatus === "active"
              ? "Deactivate Student?"
              : "Activate Student?"
            : ""
        }
        description={
          pendingAction?.type === "toggle" ? (
            <>
              {pendingAction.currentStatus === "active" ? "Deactivate" : "Activate"}{" "}
              <strong>{pendingAction.name}</strong>?
            </>
          ) : undefined
        }
        confirmText={
          pendingAction?.type === "toggle"
            ? pendingAction.currentStatus === "active"
              ? "Deactivate"
              : "Activate"
            : "Confirm"
        }
        confirmVariant={
          pendingAction?.type === "toggle" && pendingAction.currentStatus === "active" ? "danger" : "primary"
        }
        confirmLoading={actionLoading !== null}
        icon={<i className="ti ti-toggle-right" />}
        onConfirm={confirmToggle}
        onCancel={() => {
          if (!actionLoading) setPendingAction(null);
        }}
      />

      {/* Change Password Modal */}
      <ChangePasswordModal
        open={pendingAction?.type === "password"}
        title={pendingAction?.type === "password" ? `Change Password — ${pendingAction.name}` : "Change Password"}
        loading={passwordLoading}
        onConfirm={confirmPasswordChange}
        onCancel={() => {
          if (!passwordLoading) setPendingAction(null);
        }}
      />

      {/* Edit Modal */}
      <EditStudentModal
        open={!!editStudent}
        student={editStudent}
        onCancel={() => setEditStudent(null)}
        onSuccess={handleEditSuccess}
      />

      {/* Change Plan Modal */}
      <ChangePlanModal
        open={!!planStudent}
        student={planStudent}
        onCancel={() => setPlanStudent(null)}
        onSuccess={handlePlanSuccess}
      />

      <BulkImportModal open={bulkImportOpen} onClose={() => setBulkImportOpen(false)} />
    </div>
  );
};

export default StudentListComponent;
