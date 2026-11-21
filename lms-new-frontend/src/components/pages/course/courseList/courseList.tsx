"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Badge, Button, DatePicker, Input, Popover, Select, Table, Tooltip } from "antd";
import dayjs from "dayjs";
import { DownOutlined, UpOutlined } from "@ant-design/icons";
import type { ColumnsType, TablePaginationConfig } from "antd/es/table";

import { all_routes } from "@/routes/all_routes";
import { useCourses } from "@/hooks/useCourses";
import { useAppDispatch, useAppSelector } from "@/core/redux/hooks";
import { deleteCourseThunk } from "@/core/redux/courseSlice";
import { Course } from "@/types/course";
import { usePermissionGuard } from "@/lib/usePermissionGuard";
import { canAccess, PERMISSIONS } from "@/lib/permissions";
import ConfirmationModal from "@/core/common/modals/confirmationModal";
import StatsCards, { StatCardItem } from "@/core/common/statsCards/StatsCards";
import EditCourseModal from "./editCourseModal";
import { media_base_url } from "@/environment";
import { useNotification } from "@/hooks/useNotification";

// ── Column visibility ────────────────────────────────────────────────────────
const COLUMN_LABELS: Record<string, string> = {
  image:    "Image",
  name:     "Name",
  duration: "Duration",
  price:    "Price",
  teachers: "Teachers",
  students: "Students",
  status:   "Status",
  created:  "Created Date",
};

// ── Course image cell ─────────────────────────────────────────────────────────
const CourseImage = ({ src }: { src: string }) => {
  const [failed, setFailed] = useState(false);
  const placeholder = (
    <div className="d-flex align-items-center justify-content-center bg-light rounded" style={{ width: 48, height: 48 }}>
      <i className="ti ti-book text-muted fs-20" />
    </div>
  );
  if (failed) return placeholder;
  return (
    <Popover content={<img src={src} alt="Course" style={{ maxWidth: 200, maxHeight: 200, objectFit: "cover" }} onError={() => setFailed(true)} />}>
      <img src={src} alt="Course" style={{ width: 48, height: 48, objectFit: "cover", borderRadius: 6, cursor: "pointer" }} onError={() => setFailed(true)} />
    </Popover>
  );
};

interface CourseRow {
  key: string;
  serial: number;
  courseName: string;
  duration: string;
  price: string;
  isComing: boolean;
  imageUrl: string | null;
  teacherCount: number;
  studentCount: number;
  createdAt: string;
  raw: Course;
}

type PendingAction = { type: "delete"; id: string; name: string };

const CourseListComponent = () => {
  const dispatch = useAppDispatch();
  const notify   = useNotification();
  const user     = useAppSelector((state) => state.auth.user);

  usePermissionGuard(PERMISSIONS.COURSES_VIEW);
  const roleName   = user?.role?.name ?? null;
  const permissions = user?.permissions ?? [];
  const canCreate  = canAccess(roleName, permissions, PERMISSIONS.COURSES_CREATE);
  const canEdit    = canAccess(roleName, permissions, PERMISSIONS.COURSES_EDIT);
  const canDelete  = canAccess(roleName, permissions, PERMISSIONS.COURSES_DELETE);

  const {
    paginatedItems, totalCount, currentPage, setCurrentPage,
    pageSize, setPageSize, searchTerm, setSearchTerm,
    statusFilter, setStatusFilter,
    dateFrom, setDateFrom, dateTo, setDateTo,
    hasActiveFilters, clearFilters,
    activeCount, upcomingCount,
    loading, error, loadCourses,
    deletingCourseId, deleting,
    allItems,
  } = useCourses();

  const [pendingAction, setPendingAction]   = useState<PendingAction | null>(null);
  const [editCourse, setEditCourse]         = useState<Course | null>(null);
  const [filtersExpanded, setFiltersExpanded] = useState(true);
  const [visibleCols, setVisibleCols]       = useState<Record<string, boolean>>({
    image: true, name: true, duration: true, price: true,
    teachers: true, students: true, status: true, created: true,
  });

  useEffect(() => {
    if (error) notify.error(error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error]);

  const tableData: CourseRow[] = paginatedItems.map((course, index) => ({
    key:          String(course.id),
    serial:       (currentPage - 1) * pageSize + index + 1,
    courseName:   course.courseName,
    duration:     course.duration ?? "—",
    price:        course.price != null ? `$${Number(course.price).toFixed(2)}` : "—",
    isComing:     course.isComing ?? false,
    imageUrl:     course.imageUrl ?? null,
    teacherCount: Number(course.teacherCount ?? 0),
    studentCount: Number(course.studentCount ?? 0),
    createdAt:    course.createdAt ?? "",
    raw:          course,
  }));

  const confirmDelete = async () => {
    if (!pendingAction || pendingAction.type !== "delete") return;
    try {
      await dispatch(deleteCourseThunk(pendingAction.id)).unwrap();
      setPendingAction(null);
      notify.success("Course deleted successfully");
    } catch (err: unknown) {
      notify.error((err as { message?: string })?.message ?? "Failed to delete course.");
    }
  };

  const handleEditSuccess = () => {
    setEditCourse(null);
    loadCourses();
    notify.success("Course updated successfully");
  };

  const toggleCol = (key: string) => setVisibleCols((prev) => ({ ...prev, [key]: !prev[key] }));

  // Column visibility popover
  const colVisPopover = (
    <div style={{ minWidth: 160 }}>
      {Object.entries(COLUMN_LABELS).map(([key, label]) => (
        <div key={key} className="form-check mb-1">
          <input
            className="form-check-input"
            type="checkbox"
            id={`col-${key}`}
            checked={!!visibleCols[key]}
            onChange={() => toggleCol(key)}
          />
          <label className="form-check-label fs-13" htmlFor={`col-${key}`}>{label}</label>
        </div>
      ))}
    </div>
  );

  // Count badges for status pills
  const totalAll = allItems.length;

  const columns: ColumnsType<CourseRow> = [
    {
      title: "#", dataIndex: "serial", key: "serial", width: 55,
      render: (v: number) => <span className="text-muted">{v}</span>,
    },
    visibleCols.image && {
      title: "Image", dataIndex: "imageUrl", key: "imageUrl", width: 70,
      render: (url: string | null) => {
        const src = url?.trim() ? `${media_base_url}/${url.trim()}` : null;
        if (!src) return (
          <div className="d-flex align-items-center justify-content-center bg-light rounded" style={{ width: 48, height: 48 }}>
            <i className="ti ti-book text-muted fs-20" />
          </div>
        );
        return <CourseImage src={src} />;
      },
    },
    visibleCols.name && {
      title: "Course Name", dataIndex: "courseName", key: "courseName", width: 200,
      render: (v: string, record: CourseRow) => (
        <Link href={`${all_routes.manageCourseDetail}/${record.raw.id}`} className="fw-semibold text-dark text-decoration-none hover-primary">
          {v}
        </Link>
      ),
    },
    visibleCols.duration && {
      title: "Duration", dataIndex: "duration", key: "duration", width: 110,
      render: (v: string) => <span className="text-muted">{v}</span>,
    },
    visibleCols.price && {
      title: "Price", dataIndex: "price", key: "price", width: 90,
      render: (v: string) => <span className="fw-medium">{v}</span>,
    },
    visibleCols.teachers && {
      title: "Teachers", dataIndex: "teacherCount", key: "teacherCount", width: 100,
      render: (count: number) => (
        <span
          className="badge rounded-pill fw-medium"
          style={{ background: "#3b82f615", color: "#3b82f6", border: "1px solid #3b82f640" }}
        >
          <i className="ti ti-chalkboard me-1" />{count}
        </span>
      ),
    },
    visibleCols.students && {
      title: "Students", dataIndex: "studentCount", key: "studentCount", width: 100,
      render: (count: number) => (
        <span
          className="badge rounded-pill fw-medium"
          style={{ background: "#22c55e15", color: "#22c55e", border: "1px solid #22c55e40" }}
        >
          <i className="ti ti-users me-1" />{count}
        </span>
      ),
    },
    visibleCols.status && {
      title: "Status", dataIndex: "isComing", key: "isComing", width: 120,
      render: (isComing: boolean) =>
        isComing ? (
          <span className="badge badge-soft-warning border border-warning fw-medium">
            <i className="ti ti-clock me-1" />Upcoming
          </span>
        ) : (
          <span className="badge badge-soft-success border border-success fw-medium">
            <i className="ti ti-circle-check me-1" />Active
          </span>
        ),
    },
    visibleCols.created && {
      title: "Created", dataIndex: "createdAt", key: "createdAt", width: 110,
      render: (v: string) => v ? (
        <span className="text-muted fs-12">{new Date(v).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</span>
      ) : <span className="text-muted">—</span>,
    },
    {
      title: "Actions", key: "actions", width: 120,
      render: (_: unknown, record: CourseRow) => {
        const isDeleting = deletingCourseId === record.key && deleting;
        return (
          <div className="d-flex gap-2 flex-nowrap">
            <Link href={`${all_routes.manageCourseDetail}/${record.raw.id}`} className="btn btn-outline-info btn-icon btn-sm" title="View">
              <i className="ti ti-eye" />
            </Link>
            {canEdit && (
              <button type="button" className="btn btn-outline-primary btn-icon btn-sm" title="Edit" onClick={() => setEditCourse(record.raw)}>
                <i className="ti ti-edit" />
              </button>
            )}
            {canDelete && (
              <button type="button" className="btn btn-outline-danger btn-icon btn-sm" title="Delete" disabled={isDeleting}
                onClick={() => setPendingAction({ type: "delete", id: record.key, name: record.courseName })}>
                <i className={isDeleting ? "ti ti-loader" : "ti ti-trash"} />
              </button>
            )}
          </div>
        );
      },
    },
  ].filter(Boolean) as ColumnsType<CourseRow>;

  const paginationConfig: TablePaginationConfig = {
    current: currentPage,
    pageSize,
    total: totalCount,
    showSizeChanger: false,
    onChange: (page) => setCurrentPage(page),
    showTotal: () => (
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        Rows per page:
        <Select value={pageSize} onChange={(v) => setPageSize(Number(v))} style={{ width: 80 }} popupMatchSelectWidth={false}>
          {[10, 20, 30, 50].map((s) => <Select.Option key={s} value={s}>{s}</Select.Option>)}
        </Select>
        of {totalCount} Entries
      </div>
    ),
    itemRender: (_page, type, orig) => {
      if (type === "prev") return <span className="ant-pagination-item-link"><i className="ti ti-chevron-left" /></span>;
      if (type === "next") return <span className="ant-pagination-item-link"><i className="ti ti-chevron-right" /></span>;
      return orig;
    },
  };

  return (
    <div className="page-wrapper">
      <div className="content">

        {/* Page Header */}
        <div className="d-flex align-items-sm-center flex-sm-row flex-column gap-2 pb-3 mb-3">
          <div className="flex-grow-1">
            <h4 className="fw-bold mb-0">
              Courses
              <span className="badge badge-soft-primary fw-medium border py-1 px-2 border-primary fs-13 ms-2">
                Total: {allItems.length}
              </span>
            </h4>
          </div>
          <div className="text-end d-flex gap-2 flex-wrap">
            <button type="button" className="btn btn-outline-light border d-inline-flex align-items-center gap-1" onClick={() => loadCourses()} disabled={loading}>
              <i className="ti ti-refresh" /> Refresh
            </button>
            {canCreate && (
              <Link href={all_routes.manageCourseCreate} className="btn btn-primary fs-13 btn-md">
                <i className="ti ti-plus me-1" /> Add Course
              </Link>
            )}
          </div>
        </div>

        {/* Overview Cards */}
        {(() => {
          const totalTeachers  = allItems.reduce((s, c) => s + (c.teacherCount ?? 0), 0);
          const totalStudents  = allItems.reduce((s, c) => s + (c.studentCount ?? 0), 0);
          const cards: StatCardItem[] = [
            {
              label: "Total Courses",
              value: totalAll,
              icon: "ti-books",
              hex: "#2E37A4",
              spark: [18, 28, 22, 35, 25, 42, 38, 50, 44, 58],
            },
            {
              label: "Active",
              value: activeCount,
              icon: "ti-circle-check",
              hex: "#27AE60",
              spark: [30, 42, 35, 50, 40, 60, 52, 68, 58, 75],
            },
            {
              label: "Upcoming",
              value: upcomingCount,
              icon: "ti-clock",
              hex: "#F2994A",
              spark: [45, 32, 40, 28, 38, 22, 30, 18, 25, 15],
            },
            {
              label: "Total Teachers",
              value: totalTeachers,
              icon: "ti-school",
              hex: "#2F80ED",
              spark: [20, 35, 28, 45, 32, 50, 40, 58, 48, 65],
            },
            {
              label: "Total Students",
              value: totalStudents,
              icon: "ti-users",
              hex: "#8B5CF6",
              spark: [25, 40, 30, 48, 35, 55, 44, 60, 50, 68],
            },
          ];
          return <StatsCards cards={cards} loading={loading} />;
        })()}

        {/* Filter card */}
        <div className="card mb-0 sf-filter-card" style={{ borderRadius: "8px 8px 0 0" }}>
          <div className="card-body pb-2">

            {/* Row 1: status pills | Filters toggle + Search + Column settings */}
            <div className="row g-3 align-items-center">
              {/* Status pills */}
              <div className="col-md-auto" style={{ flex: "0 0 auto" }}>
                <ul className="nav nav-pills d-flex flex-nowrap gap-1 mb-0">
                  {([
                    { key: "all",      label: "All",      count: totalAll     },
                    { key: "active",   label: "Active",   count: activeCount  },
                    { key: "upcoming", label: "Upcoming", count: upcomingCount },
                  ] as const).map(({ key, label, count }) => (
                    <li key={key} className="nav-item">
                      <button
                        type="button"
                        className={`nav-link py-1 px-3 d-flex align-items-center gap-1 ${statusFilter === key ? "active" : ""}`}
                        onClick={() => setStatusFilter(key)}
                      >
                        {label}
                        <Badge
                          count={count}
                          showZero
                          style={{
                            backgroundColor: statusFilter === key ? "#fff" : "#e9ecef",
                            color: statusFilter === key ? "#0d6efd" : "#6c757d",
                            boxShadow: "none",
                            fontSize: 11,
                            marginLeft: 6,
                          }}
                        />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Filters toggle + Search + Column settings */}
              <div className="col-md-auto ms-auto d-flex align-items-center gap-2">
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
                <div style={{ minWidth: 280, flex: "1 1 auto" }}>
                  <Input
                    placeholder="Search courses..."
                    prefix={<i className="ti ti-search text-muted" />}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    allowClear
                    size="large"
                    style={{ borderWidth: "1px", boxShadow: "none" }}
                  />
                </div>
                <Tooltip title="Column visibility">
                  <Popover content={colVisPopover} title="Show / Hide Columns" trigger="click" placement="bottomRight">
                    <button type="button" className="btn btn-outline-secondary btn-icon" style={{ height: 40, width: 40 }}>
                      <i className="ti ti-settings fs-16" />
                    </button>
                  </Popover>
                </Tooltip>
              </div>
            </div>

            {/* Row 2: Collapsible filters */}
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
                  {/* Date From */}
                  <div className="col-md-auto">
                    <div className="sf-filter-item">
                      <label>From</label>
                      <DatePicker
                        size="large"
                        style={{ width: 160 }}
                        value={dateFrom ? dayjs(dateFrom) : null}
                        onChange={(_, ds) => setDateFrom(ds as string)}
                        format="YYYY-MM-DD"
                        placeholder="From"
                      />
                    </div>
                  </div>
                  {/* Date To */}
                  <div className="col-md-auto">
                    <div className="sf-filter-item">
                      <label>To</label>
                      <DatePicker
                        size="large"
                        style={{ width: 160 }}
                        value={dateTo ? dayjs(dateTo) : null}
                        onChange={(_, ds) => setDateTo(ds as string)}
                        format="YYYY-MM-DD"
                        placeholder="To"
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

        {/* Table */}
        <div className="card" style={{ borderTop: "none", marginTop: 0, borderRadius: "0 0 8px 8px" }}>
          <div className="card-body" style={{ paddingTop: 16 }}>
            <Table<CourseRow>
              className="table table-nowrap datatable"
              columns={columns}
              dataSource={tableData}
              pagination={paginationConfig}
              loading={loading}
              rowKey="key"
              scroll={{ x: 1000 }}
              locale={{ emptyText: "No courses found." }}
            />
          </div>
        </div>
      </div>

      {/* Delete Confirmation */}
      <ConfirmationModal
        open={pendingAction?.type === "delete"}
        title="Delete Course?"
        description={
          pendingAction?.type === "delete" ? (
            <>You are about to permanently delete <strong>{pendingAction.name}</strong>. All assignments linked to this course will also be removed. This action cannot be undone.</>
          ) : undefined
        }
        confirmText="Delete"
        confirmVariant="danger"
        confirmLoading={pendingAction?.type === "delete" ? deletingCourseId === pendingAction.id && deleting : false}
        icon={<i className="ti ti-trash" />}
        onConfirm={confirmDelete}
        onCancel={() => { if (!deleting) setPendingAction(null); }}
      />

      {/* Edit Modal */}
      <EditCourseModal
        open={!!editCourse}
        course={editCourse}
        onCancel={() => setEditCourse(null)}
        onSuccess={handleEditSuccess}
      />
    </div>
  );
};

export default CourseListComponent;
