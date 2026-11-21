"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge, Button, Checkbox, DatePicker, Input, Popover, Select, Table, Tooltip } from "antd";
const { RangePicker } = DatePicker;
import dayjs from "dayjs";
import type { ColumnsType, TablePaginationConfig, TableRowSelection } from "antd/es/table/interface";
import { DownOutlined, UpOutlined } from "@ant-design/icons";

import { all_routes } from "@/routes/all_routes";
import { resolveImageUrl } from "@/environment";
import { useParents } from "@/hooks/useParents";
import { useAppDispatch, useAppSelector } from "@/core/redux/hooks";
import { deleteParentThunk } from "@/core/redux/parentSlice";
import { changeParentPassword, toggleParentStatus } from "@/services/parentService";
import { Parent } from "@/types/parent";
import { usePermissionGuard } from "@/lib/usePermissionGuard";
import { canAccess, PERMISSIONS } from "@/lib/permissions";
import { useNotification } from "@/hooks/useNotification";
import ConfirmationModal from "@/core/common/modals/confirmationModal";
import ChangePasswordModal from "@/core/common/modals/changePasswordModal";
import StatsCards, { StatCardItem } from "@/core/common/statsCards/StatsCards";
import EditParentModal from "./editParentModal";

interface ParentRow {
  key: string;
  serial: number;
  name: string;
  username: string;
  email: string;
  contact: string;
  raw: Parent;
}

type PendingAction =
  | { type: "delete"; id: string; name: string }
  | { type: "password"; username: string; name: string }
  | { type: "bulkDelete"; ids: string[] };

const COLUMN_LABELS: Record<string, string> = {
  name:     "Name",
  email:    "Email",
  contact:  "Contact",
  children: "Children",
  fees:     "Fee Status",
  status:   "Status",
};

const ParentListComponent = () => {
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

  usePermissionGuard(PERMISSIONS.PARENTS_VIEW);
  const roleName    = user?.role?.name ?? null;
  const permissions = user?.permissions ?? [];
  const canCreate   = canAccess(roleName, permissions, PERMISSIONS.PARENTS_CREATE);
  const canEdit     = canAccess(roleName, permissions, PERMISSIONS.PARENTS_EDIT);
  const canDelete   = canAccess(roleName, permissions, PERMISSIONS.PARENTS_DELETE);

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
    childrenFilter,
    setChildrenFilter,
    feeFilter,
    setFeeFilter,
    statusFilter,
    setStatusFilter,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    timezoneFilter,
    setTimezoneFilter,
    hasActiveFilters,
    clearFilters,
    loading,
    error,
    loadParents,
    deletingParentId,
    deleting,
  } = useParents();

  const [pendingAction, setPendingAction]       = useState<PendingAction | null>(null);
  const [editParent, setEditParent]             = useState<Parent | null>(null);
  const [passwordLoading, setPasswordLoading]   = useState(false);
  const [selectedRowKeys, setSelectedRowKeys]   = useState<string[]>([]);
  const [bulkDeleting, setBulkDeleting]         = useState(false);
  const [filtersExpanded, setFiltersExpanded]   = useState(true);
  const [colSettingsOpen, setColSettingsOpen]   = useState(false);
  const [hiddenColumns, setHiddenColumns]       = useState<Set<string>>(new Set());
  const [statusOverrides, setStatusOverrides]   = useState<Record<string, boolean>>({});
  const [statusToggling, setStatusToggling]     = useState<string | null>(null);

  const hasChildrenCount = useMemo(() => allItems.filter((p) => Number(p.childCount ?? p.students?.length ?? 0) > 0).length, [allItems]);
  const noChildrenCount  = useMemo(() => allItems.filter((p) => Number(p.childCount ?? p.students?.length ?? 0) === 0).length, [allItems]);

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
  }, [currentPage, childrenFilter, feeFilter, statusFilter, dateFrom, dateTo, searchTerm]);

  /* ── Toggle active/inactive ──────────────────────────────── */
  const handleToggleStatus = async (parent: Parent) => {
    const id = String(parent.id);
    const current = id in statusOverrides ? statusOverrides[id] : (parent.isActive !== false);
    const next = !current;
    setStatusOverrides((prev) => ({ ...prev, [id]: next }));
    setStatusToggling(id);
    try {
      await toggleParentStatus(id);
      notify.success(next ? "Parent activated" : "Parent deactivated");
      await loadParents();
      setStatusOverrides((prev) => { const n = { ...prev }; delete n[id]; return n; });
    } catch (err: unknown) {
      setStatusOverrides((prev) => ({ ...prev, [id]: current }));
      notify.error((err as { message?: string })?.message ?? "Failed to update status.");
    } finally {
      setStatusToggling(null);
    }
  };

  /* ── Chat ────────────────────────────────────────────────── */
  const handleChatClick = (parent: Parent) => {
    const name = `${parent.firstName} ${parent.lastName ?? ""}`.trim();
    router.push(
      `${all_routes.chat}?targetId=${parent.id}&targetType=PARENT&targetName=${encodeURIComponent(name)}`
    );
  };

  /* ── Delete ──────────────────────────────────────────────── */
  const confirmDelete = async () => {
    if (!pendingAction || pendingAction.type !== "delete") return;
    try {
      await dispatch(deleteParentThunk(pendingAction.id)).unwrap();
      setSelectedRowKeys((prev) => prev.filter((k) => k !== (pendingAction as { id: string }).id));
      setPendingAction(null);
      notify.success("Parent deleted successfully");
    } catch (err: unknown) {
      notify.error(typeof err === "string" ? err : (err as { message?: string })?.message ?? "Failed to delete parent.");
    }
  };

  const confirmBulkDelete = async () => {
    if (!pendingAction || pendingAction.type !== "bulkDelete") return;
    setBulkDeleting(true);
    try {
      const ids = (pendingAction as { ids: string[] }).ids;
      await Promise.all(ids.map((id) => dispatch(deleteParentThunk(id)).unwrap()));
      setSelectedRowKeys([]);
      setPendingAction(null);
      notify.success(`${ids.length} parent(s) deleted`);
      loadParents();
    } catch (err: unknown) {
      notify.error(typeof err === "string" ? err : (err as { message?: string })?.message ?? "Failed to delete parents.");
    } finally {
      setBulkDeleting(false);
    }
  };

  const confirmPasswordChange = async (password: string) => {
    if (!pendingAction || pendingAction.type !== "password") return;
    setPasswordLoading(true);
    try {
      await changeParentPassword({ username: (pendingAction as { username: string }).username, password });
      setPendingAction(null);
      notify.success("Password changed successfully");
    } catch (err: unknown) {
      notify.error(typeof err === "string" ? err : (err as { message?: string })?.message ?? "Failed to change password.");
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleEditSuccess = () => {
    setEditParent(null);
    loadParents();
    notify.success("Parent updated successfully");
  };

  /* ── Table data ──────────────────────────────────────────── */
  const tableData: ParentRow[] = paginatedItems.map((parent, index) => ({
    key:      String(parent.id),
    serial:   (currentPage - 1) * pageSize + index + 1,
    name:     `${parent.firstName} ${parent.lastName ?? ""}`.trim(),
    username: parent.username,
    email:    parent.email ?? "—",
    contact:  parent.contact ?? "—",
    raw:      parent,
  }));

  const rowSelection: TableRowSelection<ParentRow> = {
    selectedRowKeys,
    onChange: (keys) => setSelectedRowKeys(keys as string[]),
    columnWidth: 48,
  };

  /* ── Columns ─────────────────────────────────────────────── */
  const allColumns: ColumnsType<ParentRow> = [
    {
      title: "ID",
      key: "id",
      width: 70,
      render: (_, record) => <span className="text-muted fs-12">#{record.raw.id}</span>,
    },
    {
      title: "Name",
      dataIndex: "name",
      key: "name",
      fixed: undefined,
      width: 180,
      render: (v, record) => (
        <Link href={`/admin/parents/${record.raw.id}`} className="d-flex align-items-center gap-2 text-decoration-none">
          {record.raw.profileImg ? (
            <img
              src={`${resolveImageUrl(record.raw.profileImg)}`}
              alt={v}
              width={32} height={32}
              style={{ borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
              onError={(e) => { (e.target as HTMLImageElement).src = "/assets/img/users/user-01.jpg"; }}
            />
          ) : (
            <span style={{ width: 32, height: 32, borderRadius: "50%", flexShrink: 0, background: "#e9ecef", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: "#6c757d" }}>
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
      width: 140,
    },
    {
      title: "Children",
      key: "children",
      width: 110,
      render: (_, record) => {
        const count   = Number(record.raw.childCount ?? record.raw.students?.length ?? 0);
        const names   = record.raw.students?.map((s) => `${s.firstName} ${s.lastName ?? ""}`.trim()) ?? [];
        const badge   = (
          <span className={`badge rounded fs-12 fw-medium ${count > 0 ? "badge-soft-primary text-primary border border-primary" : "badge-soft-secondary text-secondary border border-secondary"}`}>
            {count} {count === 1 ? "child" : "children"}
          </span>
        );
        if (names.length === 0) return badge;
        return (
          <Tooltip
            title={
              <div>
                {names.map((n, i) => (
                  <div key={i} className="fs-12">• {n}</div>
                ))}
              </div>
            }
          >
            {badge}
          </Tooltip>
        );
      },
    },
    {
      title: "Fee Status",
      key: "fees",
      width: 150,
      render: (_, record) => {
        const paid   = Number(record.raw.paidFeesCount ?? 0);
        const unpaid = Number(record.raw.unpaidFeesCount ?? 0);
        if (paid === 0 && unpaid === 0)
          return <span className="text-muted fs-12">No fees</span>;
        return (
          <div className="d-flex gap-1 flex-wrap">
            {paid > 0 && (
              <span className="badge rounded fs-11 fw-medium badge-soft-success text-success border border-success">
                {paid} paid
              </span>
            )}
            {unpaid > 0 && (
              <span className="badge rounded fs-11 fw-medium badge-soft-danger text-danger border border-danger">
                {unpaid} unpaid
              </span>
            )}
          </div>
        );
      },
    },
    {
      title: "Status",
      key: "status",
      width: 100,
      render: (_, record) => {
        const id = record.key;
        const isActive = id in statusOverrides ? statusOverrides[id] : (record.raw.isActive !== false);
        return isActive ? (
          <span className="badge rounded fs-12 fw-medium badge-soft-success text-success border border-success">
            Active
          </span>
        ) : (
          <span className="badge rounded fs-12 fw-medium badge-soft-danger text-danger border border-danger">
            Inactive
          </span>
        );
      },
    },
    {
      title: "Actions",
      key: "actions",
      width: 230,
      render: (_, record) => {
        const isDeleting  = deletingParentId === record.key && deleting;
        const id          = record.key;
        const isActive    = id in statusOverrides ? statusOverrides[id] : (record.raw.isActive !== false);
        const isToggling  = statusToggling === id;
        return (
          <div className="d-flex gap-1 flex-nowrap align-items-center">
            <Tooltip title="View Parent">
              <Link href={`/admin/parents/${record.raw.id}`} className="btn btn-outline-info btn-icon btn-sm">
                <i className="ti ti-eye" />
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
              <Tooltip title={isActive ? "Deactivate Parent" : "Activate Parent"}>
                <button
                  type="button"
                  className={`btn btn-icon btn-sm ${isActive ? "btn-success" : "btn-outline-secondary"}`}
                  disabled={isToggling}
                  onClick={() => handleToggleStatus(record.raw)}
                >
                  <i className={isToggling ? "ti ti-loader" : isActive ? "ti ti-user-check" : "ti ti-user-off"} />
                </button>
              </Tooltip>
            )}
            {canEdit && (
              <Tooltip title="Edit Parent">
                <button
                  type="button"
                  className="btn btn-outline-primary btn-icon btn-sm"
                  onClick={() => setEditParent(record.raw)}
                >
                  <i className="ti ti-edit" />
                </button>
              </Tooltip>
            )}
            {canDelete && (
              <Tooltip title="Delete Parent">
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

  const visibleColumns = allColumns.filter((col) => !hiddenColumns.has(col.key as string));

  const paginationConfig: TablePaginationConfig = {
    current:         currentPage,
    pageSize,
    total:           totalCount,
    showSizeChanger: false,
    onChange:        (page) => setCurrentPage(page),
    showTotal: () => (
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        Rows per page:
        <Select
          value={pageSize}
          onChange={(value) => setPageSize(Number(value))}
          style={{ width: 80 }}
          popupMatchSelectWidth={false}
        >
          {[10, 20, 30, 50].map((size) => (
            <Select.Option key={size} value={size}>{size}</Select.Option>
          ))}
        </Select>
        of {totalCount} Entries
      </div>
    ),
    itemRender: (_page, type, originalElement) => {
      if (type === "prev") return <span className="ant-pagination-item-link"><i className="ti ti-chevron-left" /></span>;
      if (type === "next") return <span className="ant-pagination-item-link"><i className="ti ti-chevron-right" /></span>;
      return originalElement;
    },
  };

  return (
    <div className="page-wrapper">
      <style>{`
        .parent-list-filters .ant-select { width: 100% !important; }
      `}</style>

      <div className="content">
        {/* Page Header */}
        <div className="d-flex align-items-sm-center flex-sm-row flex-column gap-2 pb-3 mb-3">
          <div className="flex-grow-1">
            <h4 className="fw-bold mb-0">
              Parent List
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
              onClick={() => loadParents()}
              disabled={loading}
            >
              <i className="ti ti-refresh" />
              Refresh
            </button>
            {canCreate && (
              <Link href={all_routes.manageParentCreate} className="btn btn-primary fs-13 btn-md">
                <i className="ti ti-plus me-1" />
                New Parent
              </Link>
            )}
          </div>
        </div>

        {/* Overview Cards */}
        {(() => {
          const total        = allItems.length;
          const withChildren = allItems.filter((p) => Number(p.childCount ?? p.students?.length ?? 0) > 0).length;
          const noChildren   = allItems.filter((p) => Number(p.childCount ?? p.students?.length ?? 0) === 0).length;
          const totalChildren = allItems.reduce((s, p) => s + Number(p.childCount ?? p.students?.length ?? 0), 0);
          const cards: StatCardItem[] = [
            {
              label: "Total Parents",
              value: total,
              icon: "ti-users",
              hex: "#2E37A4",
              spark: [18, 28, 22, 35, 25, 42, 38, 50, 44, 58],
            },
            {
              label: "With Children",
              value: withChildren,
              icon: "ti-user-check",
              hex: "#27AE60",
              spark: [30, 42, 35, 50, 40, 60, 52, 68, 58, 75],
            },
            {
              label: "No Children",
              value: noChildren,
              icon: "ti-user-question",
              hex: noChildren > 0 ? "#F2994A" : "#858D9C",
              spark: [45, 32, 40, 28, 38, 22, 30, 18, 25, 15],
            },
            {
              label: "Total Children",
              value: totalChildren,
              icon: "ti-baby-carriage",
              hex: "#2F80ED",
              spark: [20, 35, 28, 45, 32, 50, 40, 58, 48, 65],
            },
          ];
          return <StatsCards cards={cards} loading={loading} />;
        })()}

        {/* Filter Card */}
        <div className="card mb-0 sf-filter-card" style={{ borderRadius: "16px 16px 0 0" }}>
          <div className="card-body pb-2">

            {/* Row 1: Children tabs | Filters toggle + Search + Column settings */}
            <div className="row g-3 align-items-center parent-list-filters">
              {/* Children tabs */}
              <div className="col-12 col-md-auto">
                <ul className="nav nav-pills bg-nav-pills mb-0 flex-nowrap">
                  <li className="nav-item">
                    <button
                      type="button"
                      className={`nav-link rounded ${childrenFilter === "all" ? "active" : ""}`}
                      onClick={() => setChildrenFilter("all")}
                    >
                      All
                      <Badge count={allItems.length} showZero style={{ backgroundColor: childrenFilter === "all" ? "#fff" : "#2E37A4", color: childrenFilter === "all" ? "#2E37A4" : "#fff", marginLeft: 6 }} />
                    </button>
                  </li>
                  <li className="nav-item">
                    <button
                      type="button"
                      className={`nav-link rounded ${childrenFilter === "has-children" ? "active" : ""}`}
                      onClick={() => setChildrenFilter("has-children")}
                    >
                      👶 Has Children
                      <Badge count={hasChildrenCount} showZero style={{ backgroundColor: childrenFilter === "has-children" ? "#fff" : "#22c55e", color: childrenFilter === "has-children" ? "#22c55e" : "#fff", marginLeft: 6 }} />
                    </button>
                  </li>
                  <li className="nav-item">
                    <button
                      type="button"
                      className={`nav-link rounded ${childrenFilter === "no-children" ? "active" : ""}`}
                      onClick={() => setChildrenFilter("no-children")}
                    >
                      No Children
                      <Badge count={noChildrenCount} showZero style={{ backgroundColor: childrenFilter === "no-children" ? "#fff" : "#6c757d", color: childrenFilter === "no-children" ? "#6c757d" : "#fff", marginLeft: 6 }} />
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
                    placeholder="Search by name, email, contact, address..."
                    prefix={<i className="ti ti-search text-muted" />}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    allowClear
                    size="large"
                    style={{ borderWidth: "1px", boxShadow: "none" }}
                  />
                </div>

                {/* Column settings */}
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

            {/* Collapsible filter row */}
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
                {/* Fee Status */}
                <div className="col-md-auto">
                  <div className="sf-filter-item">
                  <label>Fee Status</label>
                  <Select
                    allowClear
                    size="large"
                    placeholder="All Fee Status"
                    style={{ minWidth: 170 }}
                    value={feeFilter === "all" ? undefined : feeFilter}
                    onChange={(v) => setFeeFilter((v as typeof feeFilter) ?? "all")}
                    options={[
                      { value: "all-paid",   label: "✅ All Fees Paid" },
                      { value: "has-unpaid", label: "⚠️ Has Unpaid Fees" },
                    ]}
                  />
                  </div>
                </div>

                {/* Status */}
                <div className="col-md-auto">
                  <div className="sf-filter-item">
                  <label>Status</label>
                  <Select
                    allowClear
                    size="large"
                    placeholder="All Status"
                    style={{ minWidth: 150 }}
                    value={statusFilter === "all" ? undefined : statusFilter}
                    onChange={(v) => setStatusFilter((v as typeof statusFilter) ?? "all")}
                    options={[
                      { value: "active",   label: "🟢 Active" },
                      { value: "inactive", label: "🔴 Inactive" },
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
            <Table<ParentRow>
              className="table table-nowrap datatable"
              columns={visibleColumns}
              dataSource={tableData}
              pagination={paginationConfig}
              loading={loading}
              rowKey="key"
              rowSelection={rowSelection}
              scroll={{ x: 1400 }}
              locale={{ emptyText: "No parents found." }}
            />
          </div>
        </div>
      </div>

      {/* Delete Confirmation */}
      <ConfirmationModal
        open={pendingAction?.type === "delete"}
        title="Delete Parent?"
        description={
          pendingAction?.type === "delete" ? (
            <>You are about to permanently remove <strong>{pendingAction.name}</strong>. This action cannot be undone.</>
          ) : undefined
        }
        confirmText="Delete"
        confirmVariant="danger"
        confirmLoading={pendingAction?.type === "delete" ? deletingParentId === pendingAction.id && deleting : false}
        icon={<i className="ti ti-trash" />}
        onConfirm={confirmDelete}
        onCancel={() => { if (!deleting) setPendingAction(null); }}
      />

      {/* Bulk Delete */}
      <ConfirmationModal
        open={pendingAction?.type === "bulkDelete"}
        title="Delete Selected Parents?"
        description={
          pendingAction?.type === "bulkDelete" ? (
            <>You are about to delete <strong>{(pendingAction as { ids: string[] }).ids.length}</strong> parent(s). This cannot be undone.</>
          ) : undefined
        }
        confirmText="Delete All"
        confirmVariant="danger"
        confirmLoading={bulkDeleting}
        icon={<i className="ti ti-trash" />}
        onConfirm={confirmBulkDelete}
        onCancel={() => { if (!bulkDeleting) setPendingAction(null); }}
      />

      {/* Change Password */}
      <ChangePasswordModal
        open={pendingAction?.type === "password"}
        title={pendingAction?.type === "password" ? `Change Password — ${pendingAction.name}` : "Change Password"}
        loading={passwordLoading}
        onConfirm={confirmPasswordChange}
        onCancel={() => { if (!passwordLoading) setPendingAction(null); }}
      />

      {/* Edit Modal */}
      <EditParentModal
        open={!!editParent}
        parent={editParent}
        onCancel={() => setEditParent(null)}
        onSuccess={handleEditSuccess}
      />
    </div>
  );
};

export default ParentListComponent;
