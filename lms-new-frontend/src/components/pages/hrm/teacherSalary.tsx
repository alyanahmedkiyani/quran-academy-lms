"use client";

import { useEffect, useState } from "react";
import { Badge, Select, Table } from "antd";
import type { ColumnsType, TablePaginationConfig } from "antd/es/table/interface";
import { getTeacherSalaries } from "@/services/salaryService";
import type { Salary } from "@/types/salary";
import { resolveImageUrl } from "@/environment";

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (v: number | string) => `PKR ${Number(v).toLocaleString()}`;

const formatMonth = (month: string) =>
  new Date(month + "T00:00:00").toLocaleDateString("en-US", { year: "numeric", month: "long" });

// ── Status Badge ──────────────────────────────────────────────────────────────

const StatusBadge = ({ status }: { status: string }) => {
  if (status === "paid")
    return <span className="badge badge-soft-success border border-success fw-medium"><i className="ti ti-circle-check me-1" />Paid</span>;
  if (status === "partial")
    return <span className="badge badge-soft-warning border border-warning fw-medium"><i className="ti ti-alert-circle me-1" />Partial</span>;
  if (status === "overdue")
    return <span className="badge badge-soft-danger border border-danger fw-medium"><i className="ti ti-alert-triangle me-1" />Overdue</span>;
  return <span className="badge badge-soft-secondary border border-secondary fw-medium"><i className="ti ti-clock me-1" />Unpaid</span>;
};

// ── Detail Modal ──────────────────────────────────────────────────────────────

const DetailModal = ({ salary, onClose }: { salary: Salary; onClose: () => void }) => {
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const isOverdue = salary.status !== "paid" && !!salary.dueDate && new Date(salary.dueDate) < new Date();

  const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div className="d-flex py-2 border-bottom align-items-start">
      <span className="text-muted fw-medium" style={{ minWidth: 130 }}>{label}</span>
      <span className="fw-semibold">{value}</span>
    </div>
  );

  return (
    <>
      <div className="modal-backdrop fade show" style={{ zIndex: 1040 }} onClick={onClose} />
      <div className="modal fade show" style={{ display: "block", zIndex: 1055 }} tabIndex={-1}>
        <div className="modal-dialog modal-dialog-centered modal-lg">
          <div className="modal-content">
            <div className="modal-header">
              <h4 className="modal-title text-dark fw-bold">Salary Details — {formatMonth(salary.month)}</h4>
              <button type="button" className="btn-close custom-btn-close opacity-100" onClick={onClose}>
                <i className="ti ti-x fs-16 text-dark" />
              </button>
            </div>
            <div className="modal-body">
              <Row label="Month"     value={formatMonth(salary.month)} />
              <Row label="Amount"    value={fmt(salary.amount)} />
              <Row label="Status"    value={<StatusBadge status={salary.status} />} />
              <Row label="Due Date"  value={
                salary.dueDate
                  ? <span className={isOverdue ? "text-danger fw-bold" : ""}>
                      {new Date(salary.dueDate).toLocaleDateString()}
                      {isOverdue && <span className="badge badge-soft-danger border border-danger ms-2 fw-medium"><i className="ti ti-alert-triangle me-1" />Overdue</span>}
                    </span>
                  : <span className="text-muted">—</span>
              } />
              <Row label="Paid Date" value={salary.paidDate ? new Date(salary.paidDate).toLocaleDateString() : <span className="text-muted">—</span>} />
              <Row label="Proof"     value={
                salary.proofPath
                  ? salary.proofPath.match(/\.(jpg|jpeg|png)$/i)
                    ? <a href={`${resolveImageUrl(salary.proofPath)}`} target="_blank" rel="noreferrer" className="btn btn-sm btn-outline-primary"><i className="ti ti-photo me-1" />View Image</a>
                    : <a href={`${resolveImageUrl(salary.proofPath)}`} target="_blank" rel="noreferrer" className="btn btn-sm btn-outline-primary"><i className="ti ti-file-type-pdf me-1" />View PDF</a>
                  : <span className="text-muted">Not uploaded yet</span>
              } />
              {salary.CreatedBy && <Row label="Issued By" value={salary.CreatedBy.name} />}
              {salary.notes && <Row label="Notes" value={<span className="text-muted">{salary.notes}</span>} />}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-light border" onClick={onClose}>Close</button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────

interface TeacherSalaryProps {
  teacherId: number;
}

const TeacherSalary = ({ teacherId }: TeacherSalaryProps) => {
  const [salaries, setSalaries] = useState<Salary[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [viewTarget, setViewTarget] = useState<Salary | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    setLoading(true);
    getTeacherSalaries(teacherId)
      .then(setSalaries)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [teacherId]);

  useEffect(() => { setCurrentPage(1); }, [statusFilter]);

  // Summary amounts
  const totalPaid    = salaries.filter((s) => s.status === "paid").reduce((sum, s) => sum + Number(s.amount), 0);
  const totalUnpaid  = salaries.filter((s) => s.status === "unpaid").reduce((sum, s) => sum + Number(s.amount), 0);
  const totalPartial = salaries.filter((s) => s.status === "partial").reduce((sum, s) => sum + Number(s.amount), 0);
  const totalOverdue = salaries.filter((s) => s.status === "overdue").reduce((sum, s) => sum + Number(s.amount), 0);
  const totalEarned  = salaries.reduce((sum, s) => sum + Number(s.amount), 0);

  const paidCount    = salaries.filter((s) => s.status === "paid").length;
  const unpaidCount  = salaries.filter((s) => s.status === "unpaid").length;
  const partialCount = salaries.filter((s) => s.status === "partial").length;
  const overdueCount = salaries.filter((s) => s.status === "overdue").length;

  const filtered = statusFilter === "all" ? salaries : salaries.filter((s) => s.status === statusFilter);

  const columns: ColumnsType<Salary> = [
    {
      title: "Month",
      dataIndex: "month",
      key: "month",
      render: (v) => <span className="fw-semibold">{formatMonth(v)}</span>,
      sorter: (a, b) => a.month.localeCompare(b.month),
      defaultSortOrder: "descend",
    },
    {
      title: "Amount",
      dataIndex: "amount",
      key: "amount",
      render: (v) => <span className="fw-semibold text-primary">{fmt(v)}</span>,
      sorter: (a, b) => Number(a.amount) - Number(b.amount),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (v) => <StatusBadge status={v} />,
    },
    {
      title: "Due Date",
      dataIndex: "dueDate",
      key: "dueDate",
      render: (v, r) => {
        if (!v) return <span className="text-muted">—</span>;
        const isOverdue = r.status !== "paid" && new Date(v) < new Date();
        return (
          <span className={isOverdue ? "text-danger fw-semibold" : ""}>
            {isOverdue && <i className="ti ti-alert-triangle me-1" />}
            {new Date(v).toLocaleDateString()}
          </span>
        );
      },
      sorter: (a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""),
    },
    {
      title: "Paid Date",
      dataIndex: "paidDate",
      key: "paidDate",
      render: (v) => v ? new Date(v).toLocaleDateString() : <span className="text-muted">—</span>,
    },
    {
      title: "Proof",
      key: "proof",
      render: (_, r) => {
        if (!r.proofPath) return <span className="text-muted small">Not uploaded</span>;
        const isImage = r.proofPath.match(/\.(jpg|jpeg|png)$/i);
        return (
          <a href={`${resolveImageUrl(r.proofPath)}`} target="_blank" rel="noreferrer"
            className="btn btn-outline-primary btn-sm">
            <i className={`ti ${isImage ? "ti-photo" : "ti-file-type-pdf"} me-1`} />View
          </a>
        );
      },
    },
    {
      title: "Actions",
      key: "actions",
      width: 80,
      render: (_, r) => (
        <button className="btn btn-outline-info btn-icon btn-sm" onClick={() => setViewTarget(r)} title="View Details">
          <i className="ti ti-eye" />
        </button>
      ),
    },
  ];

  const paginationConfig: TablePaginationConfig = {
    current: currentPage,
    pageSize,
    total: filtered.length,
    showSizeChanger: false,
    onChange: (page) => setCurrentPage(page),
    showTotal: () => (
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        Rows per page:
        <Select value={pageSize} onChange={(v) => { setPageSize(Number(v)); setCurrentPage(1); }} style={{ width: 80 }} popupMatchSelectWidth={false}>
          {[10, 20, 30].map((s) => <Select.Option key={s} value={s}>{s}</Select.Option>)}
        </Select>
        of {filtered.length} records
      </div>
    ),
    itemRender: (_p, type, orig) => {
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
              My Salary
              <span className="badge badge-soft-primary fw-medium border py-1 px-2 border-primary fs-13 ms-2">
                {salaries.length} record{salaries.length !== 1 ? "s" : ""}
              </span>
            </h4>
            <p className="text-muted mb-0 mt-1 small">View your salary history and payment proofs</p>
          </div>
          <button
            type="button"
            className="btn btn-outline-light border d-inline-flex align-items-center gap-1"
            onClick={() => {
              setLoading(true);
              getTeacherSalaries(teacherId).then(setSalaries).catch(() => {}).finally(() => setLoading(false));
            }}
            disabled={loading}
          >
            <i className="ti ti-refresh" />Refresh
          </button>
        </div>

        {/* Summary Cards */}
        <div className="row g-3 mb-3">
          <div className="col-md-3 col-sm-6">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-body d-flex align-items-center gap-3 py-3">
                <div className="rounded-circle bg-primary bg-opacity-10 p-3">
                  <i className="ti ti-wallet text-primary fs-4" />
                </div>
                <div>
                  <p className="text-muted mb-0 small">Total Earned</p>
                  <h5 className="mb-0 fw-semibold">{fmt(totalEarned)}</h5>
                </div>
              </div>
            </div>
          </div>
          <div className="col-md-3 col-sm-6">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-body d-flex align-items-center gap-3 py-3">
                <div className="rounded-circle bg-success bg-opacity-10 p-3">
                  <i className="ti ti-circle-check text-success fs-4" />
                </div>
                <div>
                  <p className="text-muted mb-0 small">Total Received</p>
                  <h5 className="mb-0 fw-semibold text-success">{fmt(totalPaid)}</h5>
                </div>
              </div>
            </div>
          </div>
          <div className="col-md-3 col-sm-6">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-body d-flex align-items-center gap-3 py-3">
                <div className="rounded-circle bg-warning bg-opacity-10 p-3">
                  <i className="ti ti-clock text-warning fs-4" />
                </div>
                <div>
                  <p className="text-muted mb-0 small">Pending</p>
                  <h5 className="mb-0 fw-semibold text-warning">{fmt(totalUnpaid + totalPartial)}</h5>
                </div>
              </div>
            </div>
          </div>
          <div className="col-md-3 col-sm-6">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-body d-flex align-items-center gap-3 py-3">
                <div className="rounded-circle bg-danger bg-opacity-10 p-3">
                  <i className="ti ti-alert-triangle text-danger fs-4" />
                </div>
                <div>
                  <p className="text-muted mb-0 small">Overdue</p>
                  <h5 className="mb-0 fw-semibold text-danger">{fmt(totalOverdue)}</h5>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Overdue alert banner */}
        {overdueCount > 0 && (
          <div className="alert alert-danger d-flex align-items-center gap-2 mb-3" role="alert">
            <i className="ti ti-alert-triangle fs-5" />
            <span>
              You have <strong>{overdueCount} overdue</strong> salary payment{overdueCount > 1 ? "s" : ""} totalling <strong>{fmt(totalOverdue)}</strong>. Please contact admin.
            </span>
          </div>
        )}

        {/* Filter + Table Card */}
        <div className="card border-0 shadow-sm" style={{ borderRadius: "8px 8px 0 0", borderBottom: "1px solid #f0f0f0" }}>
          <div className="card-body pb-2">
            <ul className="nav nav-pills bg-nav-pills nav-justified mb-0" style={{ width: "fit-content" }}>
              {([
                { key: "all",     label: "All",     count: salaries.length },
                { key: "paid",    label: "Paid",    count: paidCount },
                { key: "unpaid",  label: "Unpaid",  count: unpaidCount },
                { key: "partial", label: "Partial", count: partialCount },
                { key: "overdue", label: "Overdue", count: overdueCount },
              ] as const).map(({ key, label, count }) => (
                <li key={key} className="nav-item">
                  <button
                    type="button"
                    className={`nav-link rounded-0 d-flex align-items-center justify-content-center gap-2 ${statusFilter === key ? "active" : ""}`}
                    onClick={() => setStatusFilter(key)}
                  >
                    {label}
                    <Badge count={count} showZero style={{
                      backgroundColor: statusFilter === key ? "#fff" : (key === "overdue" ? "#ff4d4f" : "#1890ff"),
                      color:           statusFilter === key ? (key === "overdue" ? "#ff4d4f" : "#1890ff") : "#fff",
                    }} />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="card border-0 shadow-sm" style={{ borderTop: "none", marginTop: 0, borderRadius: "0 0 8px 8px" }}>
          <div className="card-body" style={{ paddingTop: 16 }}>
            <Table<Salary>
              className="table table-nowrap datatable"
              columns={columns}
              dataSource={filtered}
              rowKey="id"
              loading={loading}
              pagination={paginationConfig}
              scroll={{ x: 900 }}
              locale={{ emptyText: loading ? "Loading..." : "No salary records found." }}
            />
          </div>
        </div>

      </div>

      {viewTarget && (
        <DetailModal salary={viewTarget} onClose={() => setViewTarget(null)} />
      )}
    </div>
  );
};

export default TeacherSalary;
