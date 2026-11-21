"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge, Button, Checkbox, DatePicker, Input, Popover, Select, Table, Tooltip } from "antd";
const { RangePicker } = DatePicker;
import dayjs from "dayjs";
import type { ColumnsType, TablePaginationConfig, TableRowSelection } from "antd/es/table/interface";
import { DownOutlined, UpOutlined } from "@ant-design/icons";
import { useNotification } from "@/hooks/useNotification";

import { all_routes } from "@/routes/all_routes";
import { resolveImageUrl } from "@/environment";
import { useTeachers } from "@/hooks/useTeachers";
import { useAppDispatch, useAppSelector } from "@/core/redux/hooks";
import { deleteTeacherThunk, bulkDeleteTeachersThunk } from "@/core/redux/teacherSlice";
import { changeTeacherPassword, toggleTeacherPublishPermission } from "@/services/teacherService";
import { Teacher } from "@/types/teacher";
import { usePermissionGuard } from "@/lib/usePermissionGuard";
import { canAccess, PERMISSIONS } from "@/lib/permissions";
import ConfirmationModal from "@/core/common/modals/confirmationModal";
import ChangePasswordModal from "@/core/common/modals/changePasswordModal";
import StatsCards, { StatCardItem } from "@/core/common/statsCards/StatsCards";
import EditTeacherModal from "./editTeacherModal";

interface TeacherRow {
  key: string;
  serial: number;
  teacherId: string;
  name: string;
  username: string;
  email: string;
  contact: string;
  cnic: string;
  raw: Teacher;
}

type PendingAction =
  | { type: "delete"; id: string; name: string }
  | { type: "password"; username: string; name: string }
  | { type: "bulkDelete"; ids: string[] };

const shiftColors: Record<string, string> = {
  Morning: "#f59e0b",
  Afternoon: "#3b82f6",
  Evening: "#8b5cf6",
};

const SHIFT_CAPACITY_HOURS: Record<string, number> = {
  Morning: 6,
  Afternoon: 6,
  Evening: 4,
};

function getTodayFreeHours(teacher: Teacher): number | null {
  const shifts = teacher.shift;
  if (!shifts || !Array.isArray(shifts) || shifts.length === 0) return null;
  const capacityMinutes = shifts.reduce((sum, s) => sum + (SHIFT_CAPACITY_HOURS[s] ?? 0) * 60, 0);
  const bookedMinutes = Number(teacher.todayBookedMinutes ?? 0);
  const freeMinutes = Math.max(0, capacityMinutes - bookedMinutes);
  return Math.round((freeMinutes / 60) * 10) / 10;
}

const COLUMN_LABELS: Record<string, string> = {
  teacherId:  "ID",
  name:       "Name",
  email:      "Email",
  contact:    "Contact",
  cnic:       "CNIC",
  shift:      "Shift",
  publish:    "Publish",
  courses:    "Courses",
  students:   "Students",
  salary:     "Salary",
  status:     "Status",
  freeHrs:    "Free Hrs",
  state:      "Availability",
};

/* ── CSV export ────────────────────────────────────────────── */
const exportToCSV = (rows: TeacherRow[]) => {
  const headers = ["ID", "Name", "Username", "Email", "Contact", "CNIC", "Shift", "Can Publish"];
  const body = rows.map((r) => [
    r.teacherId,
    r.name,
    r.username,
    r.email,
    r.contact,
    r.cnic,
    Array.isArray(r.raw.shift) ? r.raw.shift.join("|") : "—",
    r.raw.canDirectlyPublish ? "Yes" : "No",
  ]);
  const csv = [headers, ...body].map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `teachers_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

const TeacherListComponent = () => {
  const dispatch = useAppDispatch();
  const router   = useRouter();
  const notify   = useNotification();
  const user     = useAppSelector((state) => state.auth.user);
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  usePermissionGuard(PERMISSIONS.TEACHERS_VIEW);
  const roleName   = user?.role?.name ?? null;
  const permissions = user?.permissions ?? [];
  const canCreate  = canAccess(roleName, permissions, PERMISSIONS.TEACHERS_CREATE);
  const canEdit    = canAccess(roleName, permissions, PERMISSIONS.TEACHERS_EDIT);
  const canDelete  = canAccess(roleName, permissions, PERMISSIONS.TEACHERS_DELETE);

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
    shiftFilter,
    setShiftFilter,
    publishFilter,
    setPublishFilter,
    courseFilter,
    setCourseFilter,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    availabilityFilter,
    setAvailabilityFilter,
    timezoneFilter,
    setTimezoneFilter,
    hasActiveFilters,
    clearFilters,
    loading,
    error,
    loadTeachers,
    deletingTeacherId,
    deleting,
  } = useTeachers();

  const [pendingAction, setPendingAction]     = useState<PendingAction | null>(null);
  const [editTeacher, setEditTeacher]         = useState<Teacher | null>(null);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
  const [bulkDeleting, setBulkDeleting]       = useState(false);
  const [filtersExpanded, setFiltersExpanded] = useState(true);
  const [colSettingsOpen, setColSettingsOpen] = useState(false);
  const [hiddenColumns, setHiddenColumns]     = useState<Set<string>>(new Set());
  const [publishOverrides, setPublishOverrides] = useState<Record<string, boolean>>({});
  const [publishToggling, setPublishToggling]   = useState<string | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

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
  }, [currentPage, shiftFilter, publishFilter, courseFilter, availabilityFilter, dateFrom, dateTo, searchTerm]);

  /* ── Publish toggle ──────────────────────────────────────── */
  const handleTogglePublish = async (teacher: Teacher) => {
    const id = String(teacher.id);
    const current = id in publishOverrides ? publishOverrides[id] : (teacher.canDirectlyPublish ?? true);
    const next = !current;
    setPublishOverrides((prev) => ({ ...prev, [id]: next }));
    setPublishToggling(id);
    try {
      await toggleTeacherPublishPermission(id, next);
      notify.success(next ? "Teacher can now publish directly" : "Teacher now requires admin approval");
      // Refresh Redux store so filters operate on fresh DB values, then clear the optimistic override
      await loadTeachers();
      setPublishOverrides((prev) => { const n = { ...prev }; delete n[id]; return n; });
    } catch (err: unknown) {
      setPublishOverrides((prev) => ({ ...prev, [id]: current }));
      notify.error((err as { message?: string })?.message ?? "Failed to update publish permission.");
    } finally {
      setPublishToggling(null);
    }
  };

  /* ── Action handlers ─────────────────────────────────────── */
  const confirmDelete = async () => {
    if (!pendingAction || pendingAction.type !== "delete") return;
    try {
      await dispatch(deleteTeacherThunk(pendingAction.id)).unwrap();
      setSelectedRowKeys((prev) => prev.filter((k) => k !== (pendingAction as { id: string }).id));
      setPendingAction(null);
      notify.success("Teacher deleted successfully");
    } catch (err: unknown) {
      notify.error(typeof err === "string" ? err : (err as { message?: string })?.message ?? "Failed to delete teacher.");
    }
  };

  const confirmBulkDelete = async () => {
    if (!pendingAction || pendingAction.type !== "bulkDelete") return;
    setBulkDeleting(true);
    try {
      await dispatch(bulkDeleteTeachersThunk(pendingAction.ids)).unwrap();
      setSelectedRowKeys([]);
      setPendingAction(null);
      notify.success(`${(pendingAction as { ids: string[] }).ids.length} teacher(s) deleted`);
    } catch (err: unknown) {
      notify.error(typeof err === "string" ? err : (err as { message?: string })?.message ?? "Failed to delete teachers.");
    } finally {
      setBulkDeleting(false);
    }
  };

  const confirmPasswordChange = async (password: string) => {
    if (!pendingAction || pendingAction.type !== "password") return;
    setPasswordLoading(true);
    try {
      await changeTeacherPassword({ username: (pendingAction as { username: string }).username, password });
      setPendingAction(null);
      notify.success("Password changed successfully");
    } catch (err: unknown) {
      notify.error(typeof err === "string" ? err : (err as { message?: string })?.message ?? "Failed to change password.");
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleEditSuccess = () => {
    setEditTeacher(null);
    loadTeachers();
    notify.success("Teacher updated successfully");
  };

  const handleChatClick = (teacher: Teacher) => {
    const name = `${teacher.firstName} ${teacher.lastName ?? ""}`.trim();
    router.push(
      `${all_routes.chat}?targetId=${teacher.id}&targetType=TEACHER&targetName=${encodeURIComponent(name)}`
    );
  };

  /* ── Table data ──────────────────────────────────────────── */
  const tableData: TeacherRow[] = paginatedItems.map((teacher, index) => ({
    key:       String(teacher.id),
    serial:    (currentPage - 1) * pageSize + index + 1,
    teacherId: String(teacher.id),
    name:      `${teacher.firstName} ${teacher.lastName}`.trim(),
    username:  teacher.username,
    email:     teacher.email,
    contact:   teacher.contact ?? "—",
    cnic:      teacher.cnic ?? "—",
    raw:       teacher,
  }));

  /* ── Row selection ───────────────────────────────────────── */
  const rowSelection: TableRowSelection<TeacherRow> = {
    selectedRowKeys,
    onChange: (keys) => setSelectedRowKeys(keys as string[]),
    columnWidth: 48,
  };

  /* ── Columns ─────────────────────────────────────────────── */
  const allColumns: ColumnsType<TeacherRow> = [
    {
      title: "ID",
      dataIndex: "teacherId",
      key: "teacherId",
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
          href={`/admin/teachers/${record.raw.id}`}
          className="d-flex align-items-center gap-2 text-decoration-none"
        >
          {record.raw.imageUrl ? (
            <img
              src={`${resolveImageUrl(record.raw.imageUrl)}`}
              alt={v}
              width={32}
              height={32}
              style={{ borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
              onError={(e) => { (e.target as HTMLImageElement).src = "/assets/img/users/user-01.jpg"; }}
            />
          ) : (
            <span
              style={{
                width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
                background: "#e9ecef", display: "inline-flex",
                alignItems: "center", justifyContent: "center", fontSize: 14, color: "#6c757d",
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
      title: "Email",
      dataIndex: "email",
      key: "email",
      width: 200,
      ellipsis: true,
    },
    {
      title: "Contact",
      dataIndex: "contact",
      key: "contact",
      width: 130,
    },
    {
      title: "CNIC",
      dataIndex: "cnic",
      key: "cnic",
      width: 140,
    },
    {
      title: "Shift",
      key: "shift",
      width: 160,
      render: (_, record) => {
        const shifts = record.raw.shift;
        if (!shifts || !Array.isArray(shifts) || shifts.length === 0)
          return <span className="text-muted fs-12">—</span>;
        return (
          <div className="d-flex flex-wrap gap-1">
            {shifts.map((s) => (
              <span
                key={s}
                className="badge rounded fs-11 fw-medium"
                style={{
                  background: `${shiftColors[s] ?? "#6c757d"}20`,
                  color: shiftColors[s] ?? "#6c757d",
                  border: `1px solid ${shiftColors[s] ?? "#6c757d"}40`,
                }}
              >
                {s === "Morning" ? "☀️" : s === "Afternoon" ? "🌤️" : "🌙"} {s}
              </span>
            ))}
          </div>
        );
      },
    },
    {
      title: "Status",
      key: "status",
      width: 100,
      render: () => (
        <span className="badge rounded fs-12 fw-medium badge-soft-success text-success border border-success">
          Active
        </span>
      ),
    },
    {
      title: "Publish",
      key: "publish",
      width: 100,
      render: (_, record) => {
        const id = record.key;
        const canPublish = id in publishOverrides ? publishOverrides[id] : (record.raw.canDirectlyPublish ?? true);
        return (
          <span className={`badge rounded fs-12 fw-medium ${canPublish ? "badge-soft-success text-success border border-success" : "badge-soft-warning text-warning border border-warning"}`}>
            {canPublish ? "Direct" : "Approval"}
          </span>
        );
      },
    },
    {
      title: "Courses",
      key: "courses",
      width: 80,
      render: (_, record) => {
        if (record.raw.courseCount == null) return <span className="text-muted fs-12">—</span>;
        const count = Number(record.raw.courseCount);
        return (
          <span className={`badge rounded fs-12 fw-medium ${count > 0 ? "badge-soft-primary text-primary border border-primary" : "badge-soft-secondary text-secondary border border-secondary"}`}>
            {count}
          </span>
        );
      },
    },
    {
      title: "Students",
      key: "students",
      width: 90,
      render: (_, record) => {
        if (record.raw.studentCount == null) return <span className="text-muted fs-12">—</span>;
        const count = Number(record.raw.studentCount);
        return (
          <span className={`badge rounded fs-12 fw-medium ${count > 0 ? "badge-soft-info text-info border border-info" : "badge-soft-secondary text-secondary border border-secondary"}`}>
            {count}
          </span>
        );
      },
    },
    {
      title: "Free Hrs",
      key: "freeHrs",
      width: 90,
      render: (_, record) => {
        const free = getTodayFreeHours(record.raw);
        if (free === null) return <span className="text-muted fs-12">—</span>;
        const color = free === 0 ? "#ef4444" : free <= 2 ? "#f59e0b" : "#22c55e";
        return (
          <span className="fw-semibold fs-13" style={{ color }}>
            {free}h
          </span>
        );
      },
    },
    {
      title: "Availability",
      key: "state",
      width: 110,
      render: (_, record) => {
        const booked = Number(record.raw.todayBookedMinutes ?? 0);
        if (record.raw.todayBookedMinutes == null || record.raw.shift == null || (record.raw.shift as string[]).length === 0)
          return <span className="text-muted fs-12">—</span>;
        const isBooked = booked > 0;
        return isBooked ? (
          <span className="badge rounded fs-12 fw-medium badge-soft-danger text-danger border border-danger">
            Booked
          </span>
        ) : (
          <span className="badge rounded fs-12 fw-medium badge-soft-success text-success border border-success">
            Free
          </span>
        );
      },
    },
    {
      title: "Salary",
      key: "salary",
      width: 110,
      render: (_, record) => {
        const status = record.raw.currentMonthSalaryStatus;
        if (!status) return <span className="badge rounded fs-12 fw-medium badge-soft-secondary text-secondary border border-secondary">No Record</span>;
        if (status === 'paid') return <span className="badge rounded fs-12 fw-medium badge-soft-success text-success border border-success">Paid</span>;
        if (status === 'partial') return <span className="badge rounded fs-12 fw-medium badge-soft-warning text-warning border border-warning">Partial</span>;
        return <span className="badge rounded fs-12 fw-medium badge-soft-danger text-danger border border-danger">Unpaid</span>;
      },
    },
    {
      title: "Actions",
      key: "actions",
      width: 220,
      render: (_, record) => {
        const isDeleting = deletingTeacherId === record.key && deleting;
        const id = record.key;
        const canPublish = id in publishOverrides ? publishOverrides[id] : (record.raw.canDirectlyPublish ?? true);
        const isToggling = publishToggling === id;
        return (
          <div className="d-flex gap-1 flex-nowrap align-items-center">
            <Tooltip title="View Teacher">
              <Link href={`/admin/teachers/${record.raw.id}`} className="btn btn-outline-info btn-icon btn-sm">
                <i className="ti ti-eye" />
              </Link>
            </Tooltip>
            <Tooltip title="View Schedule">
              <Link href={`/admin/teachers/${record.raw.id}/schedule`} className="btn btn-outline-secondary btn-icon btn-sm">
                <i className="ti ti-calendar" />
              </Link>
            </Tooltip>
            <Tooltip title="Open Chat">
              <button
                type="button"
                className="btn btn-outline-info btn-icon btn-sm"
                onClick={() => handleChatClick(record.raw)}
              >
                <i className="ti ti-message" />
              </button>
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
              <Tooltip title={canPublish ? "Can publish directly — click to require approval" : "Requires admin approval — click to allow direct publish"}>
                <button
                  type="button"
                  className={`btn btn-icon btn-sm ${canPublish ? "btn-success" : "btn-outline-secondary"}`}
                  disabled={isToggling}
                  onClick={() => handleTogglePublish(record.raw)}
                >
                  <i className={isToggling ? "ti ti-loader" : canPublish ? "ti ti-shield-check" : "ti ti-shield-x"} />
                </button>
              </Tooltip>
            )}
            {canEdit && (
              <Tooltip title="Edit Teacher">
                <button
                  type="button"
                  className="btn btn-outline-primary btn-icon btn-sm"
                  onClick={() => setEditTeacher(record.raw)}
                >
                  <i className="ti ti-edit" />
                </button>
              </Tooltip>
            )}
            {canDelete && (
              <Tooltip title="Delete Teacher">
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

  const columns = allColumns.filter(
    (col) => col.key === "actions" || !hiddenColumns.has(col.key as string)
  );

  /* ── Pagination ──────────────────────────────────────────── */
  const paginationConfig: TablePaginationConfig = {
    current:         currentPage,
    pageSize,
    total:           totalCount,
    showSizeChanger: false,
    onChange:        (page) => setCurrentPage(page),
    showTotal: () => (
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        Rows per page:
        <Select value={pageSize} onChange={(v) => setPageSize(Number(v))} style={{ width: 80 }} popupMatchSelectWidth={false}>
          {[10, 20, 30, 50].map((s) => (
            <Select.Option key={s} value={s}>{s}</Select.Option>
          ))}
        </Select>
        of {totalCount} Entries
      </div>
    ),
    itemRender: (_p, type, orig) => {
      if (type === "prev") return <span className="ant-pagination-item-link"><i className="ti ti-chevron-left" /></span>;
      if (type === "next") return <span className="ant-pagination-item-link"><i className="ti ti-chevron-right" /></span>;
      return orig;
    },
  };

  /* ── Shift counts ────────────────────────────────────────── */
  const morningCount   = useMemo(() => allItems.filter((t) => Array.isArray(t.shift) && t.shift.includes("Morning")).length, [allItems]);
  const afternoonCount = useMemo(() => allItems.filter((t) => Array.isArray(t.shift) && t.shift.includes("Afternoon")).length, [allItems]);
  const eveningCount   = useMemo(() => allItems.filter((t) => Array.isArray(t.shift) && t.shift.includes("Evening")).length, [allItems]);

  /* ── JSX ─────────────────────────────────────────────────── */
  return (
    <div className="page-wrapper">
      <style dangerouslySetInnerHTML={{ __html: `
        .teacher-list-filters .ant-select { width: 100% !important; }
        .teacher-list-filters .nav-pills button.nav-link {
          border: none; cursor: pointer; display: inline-flex;
          align-items: center; gap: 6px; white-space: nowrap;
        }
      `}} />

      {/* Hidden file input for import */}
      {/* <input
        ref={importRef}
        type="file"
        accept=".csv"
        style={{ display: "none" }}
        onChange={() => {
          notify.success("Import feature coming soon — backend endpoint required.");
          if (importRef.current) importRef.current.value = "";
        }}
      /> */}

      <div className="content">
        {/* Page Header */}
        <div className="d-flex align-items-sm-center flex-sm-row flex-column gap-2 pb-3 mb-3">
          <div className="flex-grow-1">
            <h4 className="fw-bold mb-0">
              Teacher List
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
            {/* <Tooltip title="Export to CSV">
              <Button
                size="middle"
                className="d-inline-flex align-items-center gap-1"
                onClick={() => exportToCSV(filteredItems.map((t, i) => ({
                  key: String(t.id),
                  serial: i + 1,
                  teacherId: String(t.id),
                  name: `${t.firstName} ${t.lastName}`.trim(),
                  username: t.username,
                  email: t.email,
                  contact: t.contact ?? "—",
                  cnic: t.cnic ?? "—",
                  raw: t,
                })))}
              >
                <i className="ti ti-download" />
                Export
              </Button>
            </Tooltip>
            <Tooltip title="Import teachers from CSV">
              <Button
                size="middle"
                className="d-inline-flex align-items-center gap-1"
                onClick={() => importRef.current?.click()}
              >
                <i className="ti ti-upload" />
                Import
              </Button>
            </Tooltip> */}
            <button
              type="button"
              className="btn btn-outline-light border d-inline-flex align-items-center gap-1"
              onClick={() => loadTeachers()}
              disabled={loading}
            >
              <i className="ti ti-refresh" />
              Refresh
            </button>
            {canCreate && (
              <Link href={all_routes.manageTeacherCreate} className="btn btn-primary fs-13 btn-md">
                <i className="ti ti-plus me-1" />
                New Teacher
              </Link>
            )}
          </div>
        </div>

        {/* Overview Cards */}
        {(() => {
          const total      = allItems.length;
          const canPublish = allItems.filter((t) => t.canDirectlyPublish).length;
          const morning    = allItems.filter((t) => Array.isArray(t.shift) && t.shift.includes("Morning")).length;
          const afternoon  = allItems.filter((t) => Array.isArray(t.shift) && t.shift.includes("Afternoon")).length;
          const evening    = allItems.filter((t) => Array.isArray(t.shift) && t.shift.includes("Evening")).length;
          const cards: StatCardItem[] = [
            {
              label: "Total Teachers",
              value: total,
              icon: "ti-school",
              hex: "#2E37A4",
              spark: [18, 28, 22, 35, 25, 42, 38, 50, 44, 58],
            },
            {
              label: "Can Publish",
              value: canPublish,
              icon: "ti-send",
              hex: "#27AE60",
              spark: [30, 42, 35, 50, 40, 60, 52, 68, 58, 75],
            },
            {
              label: "Morning Shift",
              value: morning,
              icon: "ti-sun",
              hex: "#F2994A",
              spark: [45, 32, 40, 28, 38, 22, 30, 18, 25, 15],
            },
            {
              label: "Afternoon Shift",
              value: afternoon,
              icon: "ti-sun-wind",
              hex: "#2F80ED",
              spark: [20, 35, 28, 45, 32, 50, 40, 58, 48, 65],
            },
            {
              label: "Evening Shift",
              value: evening,
              icon: "ti-moon",
              hex: "#8B5CF6",
              spark: [25, 40, 30, 48, 35, 55, 44, 60, 50, 68],
            },
          ];
          return <StatsCards cards={cards} loading={loading} />;
        })()}

        {/* Filter Card */}
        <div className="card mb-0 sf-filter-card" style={{ borderRadius: "16px 16px 0 0" }}>
          <div className="card-body pb-2">

            {/* Row 1: Shift tabs | Filters toggle + Search + Column settings */}
            <div className="row g-3 align-items-center teacher-list-filters">
              {/* Shift tabs */}
              <div className="col-12 col-md-auto">
                <ul className="nav nav-pills bg-nav-pills nav-justified mb-0">
                  <li className="nav-item">
                    <button
                      type="button"
                      className={`nav-link rounded ${shiftFilter === "all" ? "active" : ""}`}
                      onClick={() => setShiftFilter("all")}
                    >
                      All
                      <Badge count={allItems.length} showZero style={{ backgroundColor: shiftFilter === "all" ? "#fff" : "#2E37A4", color: shiftFilter === "all" ? "#2E37A4" : "#fff" }} />
                    </button>
                  </li>
                  <li className="nav-item">
                    <button
                      type="button"
                      className={`nav-link rounded ${shiftFilter === "Morning" ? "active" : ""}`}
                      onClick={() => setShiftFilter("Morning")}
                    >
                      ☀️ Morning
                      <Badge count={morningCount} showZero style={{ backgroundColor: shiftFilter === "Morning" ? "#fff" : "#f59e0b", color: shiftFilter === "Morning" ? "#f59e0b" : "#fff" }} />
                    </button>
                  </li>
                  <li className="nav-item">
                    <button
                      type="button"
                      className={`nav-link rounded ${shiftFilter === "Afternoon" ? "active" : ""}`}
                      onClick={() => setShiftFilter("Afternoon")}
                    >
                      🌤️ Afternoon
                      <Badge count={afternoonCount} showZero style={{ backgroundColor: shiftFilter === "Afternoon" ? "#fff" : "#3b82f6", color: shiftFilter === "Afternoon" ? "#3b82f6" : "#fff" }} />
                    </button>
                  </li>
                  <li className="nav-item">
                    <button
                      type="button"
                      className={`nav-link rounded ${shiftFilter === "Evening" ? "active" : ""}`}
                      onClick={() => setShiftFilter("Evening")}
                    >
                      🌙 Evening
                      <Badge count={eveningCount} showZero style={{ backgroundColor: shiftFilter === "Evening" ? "#fff" : "#8b5cf6", color: shiftFilter === "Evening" ? "#8b5cf6" : "#fff" }} />
                    </button>
                  </li>
                </ul>
              </div>

              {/* Filters toggle + Search + Column settings */}
              <div className="col-12 col-md-auto ms-md-auto d-flex align-items-center gap-2">
                <Button
                  type={filtersExpanded ? "primary" : "default"}
                  size="large"
                  className="d-flex align-items-center gap-1"
                  style={{ borderColor: filtersExpanded ? "#2E37A4" : undefined }}
                  onClick={() => setFiltersExpanded((v) => !v)}
                >
                  <i className={`ti ti-filter ${filtersExpanded ? "text-white" : "text-gray-5"}`} />
                  Filters
                  {filtersExpanded ? <UpOutlined style={{ fontSize: 11 }} /> : <DownOutlined style={{ fontSize: 11 }} />}
                </Button>
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
                        <button type="button" className="btn btn-link btn-sm text-primary p-0 fs-12" onClick={() => setHiddenColumns(new Set())}>
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
                          <span className="fs-13" style={{ cursor: "pointer", userSelect: "none" }} onClick={() => toggleColumn(key)}>{label}</span>
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
                      icon={<i className={`ti ti-settings ${colSettingsOpen || hiddenColumns.size > 0 ? "text-white" : "text-gray-5"}`} />}
                      style={{ flexShrink: 0, borderColor: colSettingsOpen || hiddenColumns.size > 0 ? "#2E37A4" : undefined }}
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
                  {hasActiveFilters && <span className="filter-panel-count">filters active</span>}
                </div>
                <div className="row g-3 align-items-end">
                {/* Shift */}
                <div className="col-md-auto">
                  <div className="sf-filter-item">
                  <label>Shift</label>
                  <Select
                    allowClear
                    size="large"
                    placeholder="All Shifts"
                    style={{ minWidth: 160 }}
                    value={shiftFilter === "all" ? undefined : shiftFilter}
                    onChange={(v) => setShiftFilter((v as typeof shiftFilter) ?? "all")}
                    options={[
                      { value: "Morning",   label: "☀️ Morning" },
                      { value: "Afternoon", label: "🌤️ Afternoon" },
                      { value: "Evening",   label: "🌙 Evening" },
                    ]}
                  />
                  </div>
                </div>

                {/* Publish Permission */}
                <div className="col-md-auto">
                  <div className="sf-filter-item">
                  <label>Publish Permission</label>
                  <Select
                    allowClear
                    size="large"
                    placeholder="All"
                    style={{ minWidth: 170 }}
                    value={publishFilter === "all" ? undefined : publishFilter}
                    onChange={(v) => setPublishFilter((v as typeof publishFilter) ?? "all")}
                    options={[
                      { value: "direct",   label: "✅ Direct Publish" },
                      { value: "approval", label: "⏳ Requires Approval" },
                    ]}
                  />
                  </div>
                </div>

                {/* Course Assignment */}
                <div className="col-md-auto">
                  <div className="sf-filter-item">
                  <label>Course Assignment</label>
                  <Select
                    allowClear
                    size="large"
                    placeholder="All"
                    style={{ minWidth: 170 }}
                    value={courseFilter === "all" ? undefined : courseFilter}
                    onChange={(v) => setCourseFilter((v as typeof courseFilter) ?? "all")}
                    options={[
                      { value: "has-courses", label: "📚 Has Courses" },
                      { value: "no-courses",  label: "— No Courses" },
                    ]}
                  />
                  </div>
                </div>

                {/* Availability */}
                <div className="col-md-auto">
                  <div className="sf-filter-item">
                  <label>Availability</label>
                  <Select
                    allowClear
                    size="large"
                    placeholder="All Availability"
                    style={{ minWidth: 170 }}
                    value={availabilityFilter === "all" ? undefined : availabilityFilter}
                    onChange={(v) => setAvailabilityFilter((v as typeof availabilityFilter) ?? "all")}
                    options={[
                      { value: "free",   label: "🟢 Free Today" },
                      { value: "booked", label: "🔴 Booked Today" },
                    ]}
                  />
                  </div>
                </div>

                {/* Joined Date Range */}
                <div className="col-md-auto">
                  <div className="sf-filter-item">
                  <label>Joined Date</label>
                  <RangePicker
                    size="large"
                    placeholder={["Joined from", "Joined to"]}
                    value={[dateFrom ? dayjs(dateFrom) : null, dateTo ? dayjs(dateTo) : null]}
                    onChange={(dates) => {
                      setDateFrom(dates?.[0] ? dates[0].format("YYYY-MM-DD") : "");
                      setDateTo(dates?.[1] ? dates[1].format("YYYY-MM-DD") : "");
                    }}
                    allowClear
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
                    placeholder="Filter by Timezone"
                    style={{ minWidth: 220 }}
                    value={timezoneFilter === "all" ? undefined : timezoneFilter}
                    onChange={(v) => setTimezoneFilter(v ?? "all")}
                    filterOption={(input, option) =>
                      (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
                    }
                    options={[
                      { value: "Asia/Karachi",        label: "🇵🇰 Pakistan (PKT)" },
                      { value: "Asia/Dubai",          label: "🇦🇪 Dubai (GST)" },
                      { value: "Asia/Kolkata",        label: "🇮🇳 India (IST)" },
                      { value: "Asia/Dhaka",          label: "🇧🇩 Bangladesh (BST)" },
                      { value: "Asia/Singapore",      label: "🇸🇬 Singapore (SGT)" },
                      { value: "Asia/Shanghai",       label: "🇨🇳 China (CST)" },
                      { value: "Asia/Tokyo",          label: "🇯🇵 Japan (JST)" },
                      { value: "Asia/Seoul",          label: "🇰🇷 South Korea (KST)" },
                      { value: "Pacific/Auckland",    label: "🇳🇿 New Zealand (NZST)" },
                      { value: "Australia/Sydney",    label: "🇦🇺 Australia Sydney (AEST)" },
                      { value: "Europe/London",       label: "🇬🇧 UK (GMT/BST)" },
                      { value: "Europe/Paris",        label: "🇫🇷 France (CET)" },
                      { value: "Europe/Berlin",       label: "🇩🇪 Germany (CET)" },
                      { value: "Europe/Moscow",       label: "🇷🇺 Russia Moscow (MSK)" },
                      { value: "Africa/Cairo",        label: "🇪🇬 Egypt (EET)" },
                      { value: "America/New_York",    label: "🇺🇸 USA New York (EST/EDT)" },
                      { value: "America/Chicago",     label: "🇺🇸 USA Chicago (CST/CDT)" },
                      { value: "America/Denver",      label: "🇺🇸 USA Denver (MST/MDT)" },
                      { value: "America/Los_Angeles", label: "🇺🇸 USA Los Angeles (PST/PDT)" },
                      { value: "America/Toronto",     label: "🇨🇦 Canada Toronto (EST/EDT)" },
                      { value: "America/Sao_Paulo",   label: "🇧🇷 Brazil (BRT)" },
                      { value: "UTC",                 label: "🌐 UTC" },
                    ]}
                  />
                  </div>
                </div>

                {/* Clear */}
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
        <div className="card" style={{ borderTop: "none", marginTop: 0, borderRadius: "0 0 8px 8px" }}>
          <div className="card-body" style={{ paddingTop: 16 }}>
            <Table<TeacherRow>
              className="table table-nowrap datatable"
              columns={columns}
              dataSource={tableData}
              pagination={paginationConfig}
              loading={loading}
              rowKey="key"
              rowSelection={canDelete ? rowSelection : undefined}
              scroll={{ x: 2000 }}
              locale={{ emptyText: "No teachers found." }}
            />
          </div>
        </div>
      </div>

      {/* Delete Confirmation */}
      <ConfirmationModal
        open={pendingAction?.type === "delete"}
        title="Delete Teacher?"
        description={
          pendingAction?.type === "delete" ? (
            <>You are about to permanently remove <strong>{pendingAction.name}</strong>. This cannot be undone.</>
          ) : undefined
        }
        confirmText="Delete"
        confirmVariant="danger"
        confirmLoading={pendingAction?.type === "delete" ? deletingTeacherId === pendingAction.id && deleting : false}
        icon={<i className="ti ti-trash" />}
        onConfirm={confirmDelete}
        onCancel={() => { if (!deleting) setPendingAction(null); }}
      />

      {/* Bulk Delete Confirmation */}
      <ConfirmationModal
        open={pendingAction?.type === "bulkDelete"}
        title="Delete Selected Teachers?"
        description={
          pendingAction?.type === "bulkDelete" ? (
            <>Permanently delete <strong>{pendingAction.ids.length} teacher(s)</strong>? This cannot be undone.</>
          ) : undefined
        }
        confirmText="Delete All"
        confirmVariant="danger"
        confirmLoading={bulkDeleting}
        icon={<i className="ti ti-trash" />}
        onConfirm={confirmBulkDelete}
        onCancel={() => { if (!bulkDeleting) setPendingAction(null); }}
      />

      {/* Change Password Modal */}
      <ChangePasswordModal
        open={pendingAction?.type === "password"}
        title={pendingAction?.type === "password" ? `Change Password — ${pendingAction.name}` : "Change Password"}
        loading={passwordLoading}
        onConfirm={confirmPasswordChange}
        onCancel={() => { if (!passwordLoading) setPendingAction(null); }}
      />

      {/* Edit Modal */}
      <EditTeacherModal
        open={!!editTeacher}
        teacher={editTeacher}
        onCancel={() => setEditTeacher(null)}
        onSuccess={handleEditSuccess}
      />
    </div>
  );
};

export default TeacherListComponent;
