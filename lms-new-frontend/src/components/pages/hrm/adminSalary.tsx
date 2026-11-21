"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Badge, Button, Checkbox, DatePicker, Input, Popover, Select, Table, Tooltip } from "antd";
import dayjs from "dayjs";
import type { ColumnsType, TablePaginationConfig } from "antd/es/table/interface";
import { DownOutlined, UpOutlined } from "@ant-design/icons";
import CommonSelect, { Option as SelectOption } from "@/core/common/common-select/commonSelect";
import ConfirmationModal from "@/core/common/modals/confirmationModal";
import { useNotification } from "@/hooks/useNotification";
import { useAppSelector } from "@/core/redux/hooks";
import { canAccess, PERMISSIONS } from "@/lib/permissions";
import { usePermissionGuard } from "@/lib/usePermissionGuard";
import { getAllSalaries, createSalary, updateSalary, deleteSalary, uploadSalaryProof } from "@/services/salaryService";
import { fetchAllTeachers } from "@/services/teacherService";
import type { Salary } from "@/types/salary";
import type { Teacher } from "@/types/teacher";
import { resolveImageUrl } from "@/environment";

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

// ── Proof Upload Modal ────────────────────────────────────────────────────────

interface ProofModalProps {
  open: boolean;
  salary: Salary | null;
  onClose: () => void;
  onUploaded: (salary: Salary) => void;
}

const ProofModal = ({ open, salary, onClose, onUploaded }: ProofModalProps) => {
  const notify = useNotification();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      setFile(null);
      setPreview(null);
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    if (f && f.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (ev) => setPreview(ev.target?.result as string);
      reader.readAsDataURL(f);
    } else {
      setPreview(null);
    }
  };

  const handleUpload = async () => {
    if (!salary || !file) return;
    setLoading(true);
    try {
      const result = await uploadSalaryProof(salary.id, file);
      notify.success("Proof uploaded successfully.");
      onUploaded(result);
    } catch (err: unknown) {
      notify.error((err as { message?: string })?.message ?? "Upload failed.");
    } finally {
      setLoading(false);
    }
  };

  if (!open || !salary) return null;

  const teacherName = salary.Teacher
    ? `${salary.Teacher.firstName} ${salary.Teacher.lastName}`
    : `Teacher #${salary.teacherId}`;

  return (
    <>
      <div className="modal-backdrop fade show" style={{ zIndex: 1040 }} onClick={() => { if (!loading) onClose(); }} />
      <div className="modal fade show" style={{ display: "block", zIndex: 1055 }} tabIndex={-1}>
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h4 className="modal-title text-dark fw-bold">Upload Salary Proof</h4>
              <button type="button" className="btn-close custom-btn-close opacity-100" onClick={onClose} disabled={loading}>
                <i className="ti ti-x fs-16 text-dark" />
              </button>
            </div>
            <div className="modal-body">
              <p className="text-muted mb-3">
                <strong>{teacherName}</strong> — {formatMonthStatic(salary.month)}
              </p>

              {/* Current proof */}
              {salary.proofPath && (
                <div className="mb-3">
                  <label className="form-label fw-semibold">Current Proof</label>
                  <div>
                    {salary.proofPath.match(/\.(jpg|jpeg|png)$/i) ? (
                      <img
                        src={`${resolveImageUrl(salary.proofPath)}`}
                        alt="proof"
                        className="img-thumbnail"
                        style={{ maxHeight: 160, objectFit: "contain" }}
                      />
                    ) : (
                      <a
                        href={`${resolveImageUrl(salary.proofPath)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-sm btn-outline-primary"
                      >
                        <i className="ti ti-file-type-pdf me-1" />View PDF
                      </a>
                    )}
                  </div>
                </div>
              )}

              <div className="mb-3">
                <label className="form-label fw-semibold">
                  {salary.proofPath ? "Replace Proof" : "Upload Proof"}
                  <span className="text-muted fw-normal ms-1 fs-12">(PDF or image)</span>
                </label>
                <input
                  ref={fileRef}
                  type="file"
                  className="form-control"
                  accept=".pdf,.png,.jpg,.jpeg"
                  onChange={handleFileChange}
                  disabled={loading}
                />
              </div>

              {preview && (
                <img src={preview} alt="preview" className="img-thumbnail mt-1" style={{ maxHeight: 140, objectFit: "contain" }} />
              )}
              {file && !preview && (
                <p className="text-muted small mt-1"><i className="ti ti-file-type-pdf me-1" />{file.name}</p>
              )}
            </div>
            <div className="modal-footer d-flex align-items-center gap-1">
              <button type="button" className="btn btn-light border" onClick={onClose} disabled={loading}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={handleUpload} disabled={loading || !file}>
                {loading ? "Uploading..." : "Upload"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

// ── View Modal ────────────────────────────────────────────────────────────────

interface ViewSalaryModalProps {
  open: boolean;
  salary: Salary | null;
  onClose: () => void;
  onEdit?: () => void;
}

const ViewSalaryModal = ({ open, salary, onClose, onEdit }: ViewSalaryModalProps) => {
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (!open || !salary) return null;

  const teacherName = salary.Teacher
    ? `${salary.Teacher.firstName} ${salary.Teacher.lastName}`
    : `Teacher #${salary.teacherId}`;

  const isOverdue = salary.status !== "paid" && !!salary.dueDate && new Date(salary.dueDate) < new Date();

  const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div className="d-flex py-2 border-bottom">
      <span className="text-muted fw-medium" style={{ minWidth: 140 }}>{label}</span>
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
              <h4 className="modal-title text-dark fw-bold">Salary Details</h4>
              <button type="button" className="btn-close custom-btn-close opacity-100" onClick={onClose}>
                <i className="ti ti-x fs-16 text-dark" />
              </button>
            </div>

            <div className="modal-body">
              {/* Teacher avatar header */}
              <div className="d-flex align-items-center gap-3 mb-4 pb-3 border-bottom">
                {(() => {
                  const imgSrc = salary.Teacher?.imageUrl ? `${resolveImageUrl(salary.Teacher.imageUrl)}` : null;
                  return imgSrc ? (
                    <img
                      src={imgSrc}
                      alt={teacherName}
                      className="rounded-circle"
                      style={{ width: 56, height: 56, objectFit: "cover", flexShrink: 0 }}
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = "none";
                        (e.currentTarget.nextElementSibling as HTMLElement | null)?.style.setProperty("display", "flex");
                      }}
                    />
                  ) : null;
                })()}
                <div
                  className="rounded-circle bg-primary bg-opacity-10 d-flex align-items-center justify-content-center flex-shrink-0"
                  style={{
                    width: 56, height: 56, fontSize: 20, fontWeight: 700, color: "#2E37A4",
                    display: salary.Teacher?.imageUrl ? "none" : "flex",
                  }}
                >
                  {salary.Teacher ? salary.Teacher.firstName.charAt(0).toUpperCase() : "T"}
                </div>
                <div>
                  <h5 className="mb-0 fw-bold">{teacherName}</h5>
                  {salary.Teacher?.email && <span className="text-muted small">{salary.Teacher.email}</span>}
                </div>
              </div>

              <Row label="Teacher"    value={teacherName} />
              {salary.Teacher?.email && <Row label="Email" value={<span className="text-muted">{salary.Teacher.email}</span>} />}
              {salary.CreatedBy && <Row label="Created By" value={salary.CreatedBy.name} />}
              <Row label="Month"     value={formatMonthStatic(salary.month)} />
              <Row label="Amount"    value={fmt(salary.amount)} />
              <Row label="Due Date"  value={
                salary.dueDate
                  ? <span className={isOverdue ? "text-danger fw-bold" : ""}>
                      {new Date(salary.dueDate).toLocaleDateString()}
                      {isOverdue && <span className="badge badge-soft-danger border border-danger ms-2 fw-medium"><i className="ti ti-alert-triangle me-1" />Overdue</span>}
                    </span>
                  : <span className="text-muted">—</span>
              } />
              <Row label="Status"    value={<StatusBadge status={salary.status} />} />
              <Row label="Paid Date" value={salary.paidDate ? new Date(salary.paidDate).toLocaleDateString() : <span className="text-muted">—</span>} />
              <Row label="Proof"     value={
                salary.proofPath
                  ? salary.proofPath.match(/\.(jpg|jpeg|png)$/i)
                    ? <a href={`${resolveImageUrl(salary.proofPath)}`} target="_blank" rel="noreferrer" className="btn btn-sm btn-outline-primary"><i className="ti ti-photo me-1" />View Image</a>
                    : <a href={`${resolveImageUrl(salary.proofPath)}`} target="_blank" rel="noreferrer" className="btn btn-sm btn-outline-primary"><i className="ti ti-file-type-pdf me-1" />View PDF</a>
                  : <span className="text-muted">Not uploaded</span>
              } />
              {salary.notes && <Row label="Notes" value={<span className="text-muted">{salary.notes}</span>} />}
            </div>

            <div className="modal-footer d-flex align-items-center gap-1">
              <button type="button" className="btn btn-light border" onClick={onClose}>Close</button>
              {onEdit && (
                <button type="button" className="btn btn-primary" onClick={() => { onClose(); onEdit(); }}>
                  <i className="ti ti-edit me-1" />Edit
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

// ── Create / Edit Modal ───────────────────────────────────────────────────────

interface SalaryModalProps {
  open: boolean;
  teachers: Teacher[];
  editing: Salary | null;
  onClose: () => void;
  onSaved: (salary: Salary) => void;
}

const SalaryModal = ({ open, teachers, editing, onClose, onSaved }: SalaryModalProps) => {
  const notify = useNotification();
  const [teacherId, setTeacherId] = useState<number | null>(null);
  const [amount, setAmount] = useState("");
  const [month, setMonth] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [status, setStatus] = useState<"paid" | "unpaid" | "partial" | "overdue">("unpaid");
  const [paidDate, setPaidDate] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      if (editing) {
        setTeacherId(editing.teacherId);
        setAmount(String(editing.amount));
        setMonth(editing.month);
        setDueDate(editing.dueDate ?? "");
        setStatus(editing.status);
        setPaidDate(editing.paidDate ?? "");
        setNotes(editing.notes ?? "");
      } else {
        setTeacherId(null);
        setAmount("");
        setMonth("");
        setDueDate("");
        setStatus("unpaid");
        setPaidDate("");
        setNotes("");
      }
      setError(null);
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open, editing]);

  const handleClose = () => { if (loading) return; onClose(); };

  const handleSubmit = async () => {
    if (!teacherId && !editing) { setError("Please select a teacher."); return; }
    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) { setError("Please enter a valid amount."); return; }
    if (!month) { setError("Please select a month."); return; }
    setLoading(true);
    setError(null);
    try {
      let result: Salary;
      if (editing) {
        result = await updateSalary(editing.id, {
          amount: parseFloat(amount), month, dueDate: dueDate || null,
          status, paidDate: paidDate || null, notes: notes || null,
        });
        notify.success("Salary record updated.");
      } else {
        result = await createSalary({
          teacherId: teacherId!, amount: parseFloat(amount), month,
          dueDate: dueDate || null, status, paidDate: paidDate || null, notes: notes || null,
        });
        notify.success("Salary record created.");
      }
      onSaved(result);
    } catch (err: unknown) {
      setError((err as { message?: string })?.message ?? "Failed to save salary.");
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  const statusOptions: SelectOption[] = [
    { value: "unpaid",  label: "Unpaid"  },
    { value: "paid",    label: "Paid"    },
    { value: "partial", label: "Partial" },
    { value: "overdue", label: "Overdue" },
  ];

  return (
    <>
      <div className="modal-backdrop fade show" style={{ zIndex: 1040 }} onClick={handleClose} />
      <div className="modal fade show" style={{ display: "block", zIndex: 1055 }} tabIndex={-1}>
        <div className="modal-dialog modal-dialog-centered modal-lg">
          <div className="modal-content">
            <div className="modal-header">
              <h4 className="modal-title text-dark fw-bold">
                {editing ? "Edit Salary Record" : "Add Salary Record"}
              </h4>
              <button type="button" className="btn-close custom-btn-close opacity-100" onClick={handleClose} disabled={loading}>
                <i className="ti ti-x fs-16 text-dark" />
              </button>
            </div>

            <div className="modal-body">
              {error && <div className="alert alert-danger py-2 mb-3" role="alert">{error}</div>}

              <div className="row">
                {!editing && (
                  <div className="col-lg-12">
                    <div className="mb-3">
                      <label className="form-label">Teacher <span className="text-danger">*</span></label>
                      <CommonSelect
                        options={teachers.map((t): SelectOption => ({ value: String(t.id), label: `${t.firstName} ${t.lastName}` }))}
                        value={teacherId ? (() => { const t = teachers.find((tc) => tc.id === teacherId); return t ? { value: String(t.id), label: `${t.firstName} ${t.lastName}` } : null; })() : null}
                        onChange={(opt: SelectOption | null) => setTeacherId(opt ? Number(opt.value) : null)}
                        placeholder="Select a teacher"
                        isDisabled={loading}
                      />
                    </div>
                  </div>
                )}

                <div className="col-lg-6">
                  <div className="mb-3">
                    <label className="form-label">Amount ($) <span className="text-danger">*</span></label>
                    <input type="number" min="0" step="0.01" className="form-control" placeholder="e.g. 50000"
                      value={amount} onChange={(e) => setAmount(e.target.value)} disabled={loading} />
                  </div>
                </div>

                <div className="col-lg-6">
                  <div className="mb-3">
                    <label className="form-label">Month <span className="text-danger">*</span></label>
                    <input type="month" className="form-control"
                      value={month ? month.slice(0, 7) : ""}
                      onChange={(e) => setMonth(e.target.value + "-01")} disabled={loading} />
                  </div>
                </div>

                <div className="col-lg-6">
                  <div className="mb-3">
                    <label className="form-label">Due Date</label>
                    <DatePicker
                      style={{ width: "100%" }}
                      value={dueDate ? dayjs(dueDate) : null}
                      onChange={(_, ds) => setDueDate(ds as string)}
                      format="YYYY-MM-DD"
                      placeholder="Select date"
                      disabled={loading}
                    />
                    <small className="text-muted">Salary will auto-mark overdue if unpaid past this date.</small>
                  </div>
                </div>

                <div className="col-lg-6">
                  <div className="mb-3">
                    <label className="form-label">Status</label>
                    <CommonSelect
                      options={statusOptions}
                      value={statusOptions.find((o) => o.value === status) ?? null}
                      onChange={(opt: SelectOption | null) => setStatus((opt?.value ?? "unpaid") as typeof status)}
                      isDisabled={loading}
                    />
                  </div>
                </div>

                <div className="col-lg-6">
                  <div className="mb-3">
                    <label className="form-label">Paid Date</label>
                    <DatePicker
                      style={{ width: "100%" }}
                      value={paidDate ? dayjs(paidDate) : null}
                      onChange={(_, ds) => setPaidDate(ds as string)}
                      format="YYYY-MM-DD"
                      placeholder="Select date"
                      disabled={loading}
                    />
                  </div>
                </div>

                <div className="col-lg-12">
                  <div className="mb-3">
                    <label className="form-label">Notes</label>
                    <textarea className="form-control" rows={3} placeholder="Optional notes..."
                      value={notes} onChange={(e) => setNotes(e.target.value)} disabled={loading} />
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-footer d-flex align-items-center gap-1">
              <button type="button" className="btn btn-light border" onClick={handleClose} disabled={loading}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
                {loading ? "Saving..." : editing ? "Save Changes" : "Add Record"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatMonthStatic(month: string) {
  return new Date(month + "T00:00:00").toLocaleDateString("en-US", { year: "numeric", month: "long" });
}

const fmt = (amount: number | string) => `$${Number(amount).toFixed(2)}`;

// ── Main Component ────────────────────────────────────────────────────────────

const AdminSalary = () => {
  usePermissionGuard(PERMISSIONS.SALARY_VIEW);
  const notify = useNotification();
  const user = useAppSelector((s) => s.auth.user);
  const roleName = user?.role?.name ?? null;
  const permissions = user?.permissions ?? [];
  const canManage = canAccess(roleName, permissions, PERMISSIONS.SALARY_MANAGE);

  const [salaries, setSalaries] = useState<Salary[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [teacherFilter, setTeacherFilter] = useState<string>("all");
  const [filtersExpanded, setFiltersExpanded] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Salary | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Salary | null>(null);
  const [proofTarget, setProofTarget] = useState<Salary | null>(null);
  const [viewTarget, setViewTarget] = useState<Salary | null>(null);
  const [colSettingsOpen, setColSettingsOpen] = useState(false);
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());

  const COLUMN_LABELS: Record<string, string> = {
    teacher:   "Teacher",
    month:     "Month",
    amount:    "Amount",
    dueDate:   "Due Date",
    status:    "Status",
    paidDate:  "Paid Date",
    proof:     "Proof",
    createdBy: "Created By",
    notes:     "Notes",
  };

  const toggleColumn = (key: string) => {
    setHiddenColumns((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const loadSalaries = () => {
    setLoading(true);
    getAllSalaries().then(setSalaries).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => {
    Promise.all([
      getAllSalaries().then(setSalaries).catch(() => {}),
      fetchAllTeachers().then((r) => setTeachers(r.teachers ?? [])).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  useEffect(() => { setCurrentPage(1); }, [search, statusFilter, teacherFilter]);

  // Status counts
  const paidCount    = salaries.filter((s) => s.status === "paid").length;
  const unpaidCount  = salaries.filter((s) => s.status === "unpaid").length;
  const partialCount = salaries.filter((s) => s.status === "partial").length;
  const overdueCount = salaries.filter((s) => s.status === "overdue").length;

  // Teacher filter options
  const teacherOptions = useMemo(() => {
    const seen = new Map<string, string>();
    salaries.forEach((s) => {
      if (s.Teacher) seen.set(String(s.teacherId), `${s.Teacher.firstName} ${s.Teacher.lastName}`);
    });
    return Array.from(seen.entries()).map(([id, name]) => ({ value: id, label: name })).sort((a, b) => a.label.localeCompare(b.label));
  }, [salaries]);

  const hasActiveFilters = teacherFilter !== "all";

  const filtered = salaries.filter((s) => {
    const name = `${s.Teacher?.firstName ?? ""} ${s.Teacher?.lastName ?? ""}`.toLowerCase();
    return (
      (!search || name.includes(search.toLowerCase())) &&
      (statusFilter === "all" || s.status === statusFilter) &&
      (teacherFilter === "all" || String(s.teacherId) === teacherFilter)
    );
  });

  const handleSaved = (salary: Salary) => {
    setSalaries((prev) => {
      const idx = prev.findIndex((s) => s.id === salary.id);
      if (idx >= 0) { const u = [...prev]; u[idx] = salary; return u; }
      return [salary, ...prev];
    });
    setModalOpen(false);
    setEditing(null);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      await deleteSalary(deleteTarget.id);
      setSalaries((prev) => prev.filter((s) => s.id !== deleteTarget.id));
      notify.success("Salary record deleted.");
    } catch (err: unknown) {
      notify.error((err as { message?: string })?.message ?? "Failed to delete.");
    } finally {
      setDeleteTarget(null);
    }
  };

  const allColumns: ColumnsType<Salary> = [
    {
      title: "Teacher",
      key: "teacher",
      width: 220,
      render: (_, r) => {
        const name = r.Teacher ? `${r.Teacher.firstName} ${r.Teacher.lastName}` : `ID: ${r.teacherId}`;
        const imgSrc = r.Teacher?.imageUrl ? `${resolveImageUrl(r.Teacher.imageUrl)}` : null;
        return (
          <div className="d-flex align-items-center gap-2">
            {imgSrc ? (
              <img
                src={imgSrc}
                alt={name}
                className="rounded-circle"
                style={{ width: 36, height: 36, objectFit: "cover", flexShrink: 0 }}
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                  (e.currentTarget.nextElementSibling as HTMLElement | null)?.style.setProperty("display", "flex");
                }}
              />
            ) : null}
            <div
              className="rounded-circle bg-primary bg-opacity-10 d-flex align-items-center justify-content-center flex-shrink-0"
              style={{ width: 36, height: 36, fontSize: 14, fontWeight: 600, color: "#2E37A4", display: imgSrc ? "none" : "flex" }}
            >
              {r.Teacher ? r.Teacher.firstName.charAt(0).toUpperCase() : "T"}
            </div>
            <div>
              <p className="mb-0 fw-semibold">{name}</p>
              {r.Teacher?.email && <small className="text-muted">{r.Teacher.email}</small>}
            </div>
          </div>
        );
      },
    },
    {
      title: "Month",
      dataIndex: "month",
      key: "month",
      width: 150,
      render: (v) => formatMonthStatic(v),
      sorter: (a, b) => a.month.localeCompare(b.month),
    },
    {
      title: "Amount",
      dataIndex: "amount",
      key: "amount",
      width: 120,
      render: (v) => fmt(v),
      sorter: (a, b) => Number(a.amount) - Number(b.amount),
    },
    {
      title: "Due Date",
      dataIndex: "dueDate",
      key: "dueDate",
      width: 140,
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
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 120,
      render: (v) => <StatusBadge status={v} />,
    },
    {
      title: "Paid Date",
      dataIndex: "paidDate",
      key: "paidDate",
      width: 130,
      render: (v) => v ? new Date(v).toLocaleDateString() : <span className="text-muted">—</span>,
    },
    {
      title: "Proof",
      key: "proof",
      width: 140,
      render: (_, r) => {
        if (!r.proofPath) return (
          canManage
            ? <button className="btn btn-outline-secondary btn-sm" onClick={() => setProofTarget(r)}>
                <i className="ti ti-upload me-1" />Upload
              </button>
            : <span className="text-muted">—</span>
        );
        const isImage = r.proofPath.match(/\.(jpg|jpeg|png)$/i);
        return (
          <div className="d-flex align-items-center gap-1">
            <a href={`${resolveImageUrl(r.proofPath)}`} target="_blank" rel="noreferrer"
              className="btn btn-outline-primary btn-sm">
              <i className={`ti ${isImage ? "ti-photo" : "ti-file-type-pdf"} me-1`} />View
            </a>
            {canManage && (
              <Tooltip title="Replace">
                <button className="btn btn-outline-secondary btn-sm" onClick={() => setProofTarget(r)}>
                  <i className="ti ti-refresh" />
                </button>
              </Tooltip>
            )}
          </div>
        );
      },
    },
    {
      title: "Created By",
      key: "createdBy",
      width: 140,
      render: (_: unknown, r: Salary) =>
        r.CreatedBy
          ? <span className="fw-medium">{r.CreatedBy.name}</span>
          : <span className="text-muted">—</span>,
    },
    {
      title: "Notes",
      dataIndex: "notes",
      key: "notes",
      width: 200,
      ellipsis: true,
      render: (v) => v ? <span className="text-muted small">{v}</span> : <span className="text-muted">—</span>,
    },
    {
      title: "Actions",
      key: "actions",
      width: canManage ? 120 : 60,
      render: (_: unknown, r: Salary) => (
        <div className="d-flex gap-1 flex-nowrap">
          <Tooltip title="View">
            <button className="btn btn-outline-info btn-icon btn-sm" onClick={() => setViewTarget(r)}>
              <i className="ti ti-eye" />
            </button>
          </Tooltip>
          {canManage && (
            <Tooltip title="Edit">
              <button className="btn btn-outline-primary btn-icon btn-sm" onClick={() => { setEditing(r); setModalOpen(true); }}>
                <i className="ti ti-edit" />
              </button>
            </Tooltip>
          )}
          {canManage && (
            <Tooltip title="Delete">
              <button className="btn btn-outline-danger btn-icon btn-sm" onClick={() => setDeleteTarget(r)}>
                <i className="ti ti-trash" />
              </button>
            </Tooltip>
          )}
        </div>
      ),
    },
  ];

  // Filter hidden columns (Actions always shown)
  const columns = allColumns.filter(
    (col) => col.key === "actions" || !hiddenColumns.has(col.key as string)
  );

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
          {[10, 20, 30, 50].map((s) => <Select.Option key={s} value={s}>{s}</Select.Option>)}
        </Select>
        of {filtered.length} Entries
      </div>
    ),
    itemRender: (_p, type, orig) => {
      if (type === "prev") return <span className="ant-pagination-item-link"><i className="ti ti-chevron-left" /></span>;
      if (type === "next") return <span className="ant-pagination-item-link"><i className="ti ti-chevron-right" /></span>;
      return orig;
    },
  };

  // Summary amounts
  const totalPaid    = salaries.filter((s) => s.status === "paid").reduce((sum, s) => sum + Number(s.amount), 0);
  const totalUnpaid  = salaries.filter((s) => s.status === "unpaid").reduce((sum, s) => sum + Number(s.amount), 0);
  const totalPartial = salaries.filter((s) => s.status === "partial").reduce((sum, s) => sum + Number(s.amount), 0);
  const totalOverdue = salaries.filter((s) => s.status === "overdue").reduce((sum, s) => sum + Number(s.amount), 0);

  return (
    <div className="page-wrapper">
      <div className="content">

        {/* Page Header */}
        <div className="d-flex align-items-sm-center flex-sm-row flex-column gap-2 pb-3 mb-3">
          <div className="flex-grow-1">
            <h4 className="fw-bold mb-0">
              Salary Management
              <span className="badge badge-soft-primary fw-medium border py-1 px-2 border-primary fs-13 ms-2">
                Total: {salaries.length}
              </span>
            </h4>
          </div>
          <div className="text-end d-flex gap-2 flex-wrap align-items-center">
            <button type="button" className="btn btn-outline-light border d-inline-flex align-items-center gap-1"
              onClick={loadSalaries} disabled={loading}>
              <i className="ti ti-refresh" />Refresh
            </button>
            {canManage && (
              <button type="button" className="btn btn-primary fs-13 btn-md d-inline-flex align-items-center gap-1"
                onClick={() => { setEditing(null); setModalOpen(true); }}>
                <i className="ti ti-plus" />Add Salary Record
              </button>
            )}
          </div>
        </div>

        {/* Summary Cards */}
        <div className="row g-2 mb-2">
          {[
            { label: "Total Paid",    amount: totalPaid,    icon: "ti-circle-check",    color: "success" },
            { label: "Total Unpaid",  amount: totalUnpaid,  icon: "ti-clock",           color: "secondary" },
            { label: "Total Partial", amount: totalPartial, icon: "ti-alert-circle",    color: "warning" },
            { label: "Total Overdue", amount: totalOverdue, icon: "ti-alert-triangle",  color: "danger" },
          ].map(({ label, amount, icon, color }) => (
            <div key={label} className="col-md-3">
              <div className="card border-0 shadow-sm">
                <div className="card-body d-flex align-items-center gap-3 py-3">
                  <div className={`rounded-circle bg-${color} bg-opacity-10 p-3`}>
                    <i className={`ti ${icon} text-${color} fs-4`} />
                  </div>
                  <div>
                    <p className="text-muted mb-0 small">{label}</p>
                    <h5 className="mb-0 fw-semibold">PKR {amount.toLocaleString()}</h5>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Filter Card */}
        <div className="card mb-0 sf-filter-card" style={{ borderRadius: "8px 8px 0 0" }}>
          <div className="card-body pb-2">

            <div className="row g-3 align-items-center">
              {/* Status tabs */}
              <div className="col-md-auto" style={{ flex: "0 0 auto" }}>
                <ul className="nav nav-pills bg-nav-pills nav-justified mb-0">
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
                          backgroundColor: statusFilter === key ? "#fff" : (key === "overdue" ? "#ff4d4f" : "#2E37A4"),
                          color:           statusFilter === key ? (key === "overdue" ? "#ff4d4f" : "#2E37A4") : "#fff",
                        }} />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Filters toggle + Search */}
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
                <div style={{ minWidth: 300, flex: "1 1 auto" }}>
                  <Input
                    placeholder="Search by teacher name..."
                    prefix={<i className="ti ti-search text-muted" />}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    allowClear
                    size="large"
                    style={{ borderWidth: "2px", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }}
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
                    <div style={{ minWidth: 160 }}>
                      {Object.entries(COLUMN_LABELS).map(([key, label]) => (
                        <div key={key} className="d-flex align-items-center gap-2 py-1">
                          <Checkbox
                            checked={!hiddenColumns.has(key)}
                            onChange={() => toggleColumn(key)}
                          />
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
                        <i className={`ti ti-settings ${colSettingsOpen || hiddenColumns.size > 0 ? "text-white" : "text-gray-5"}`} />
                      }
                      style={{
                        flexShrink: 0,
                        borderColor: colSettingsOpen || hiddenColumns.size > 0 ? "#2E37A4" : undefined,
                      }}
                    />
                  </Tooltip>
                </Popover>
              </div>
            </div>

            {/* Collapsible filter row */}
            <div className={`filter-panel-row ${filtersExpanded ? "expanded" : "collapsed"}`}
              style={{ paddingTop: filtersExpanded ? 12 : 0, marginTop: filtersExpanded ? 12 : 0 }}>
              <div className="filter-panel-box">
                <div className="filter-panel-heading">
                  <i className="ti ti-filter" />
                  <span className="filter-panel-title">Filter by</span>
                  {hasActiveFilters && <span className="filter-panel-count">filters active</span>}
                </div>
                <div className="row g-3 align-items-end">
                  <div className="col-md-auto">
                    <div className="sf-filter-item">
                      <label>Teacher</label>
                      <Select allowClear showSearch size="large" placeholder="Filter by Teacher" style={{ minWidth: 220 }}
                        value={teacherFilter === "all" ? undefined : teacherFilter}
                        onChange={(v) => setTeacherFilter(v ?? "all")}
                        options={teacherOptions}
                        filterOption={(input, option) => (option?.label as string)?.toLowerCase().includes(input.toLowerCase())}
                        notFoundContent="No teachers found"
                      />
                    </div>
                  </div>
                  {hasActiveFilters && (
                    <div className="col-md-auto">
                      <div className="sf-filter-item">
                        <label>&nbsp;</label>
                        <button type="button" className="btn filter-panel-clear-btn" onClick={() => setTeacherFilter("all")}>
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
            <Table<Salary>
              className="table table-nowrap datatable"
              columns={columns}
              dataSource={filtered}
              rowKey="id"
              loading={loading}
              pagination={paginationConfig}
              scroll={{ x: 1480 }}
              locale={{ emptyText: "No salary records found." }}
            />
          </div>
        </div>
      </div>

      {/* Modals */}
      <ViewSalaryModal
        open={!!viewTarget}
        salary={viewTarget}
        onClose={() => setViewTarget(null)}
        onEdit={canManage && viewTarget ? () => { setEditing(viewTarget); setModalOpen(true); } : undefined}
      />

      <SalaryModal
        open={modalOpen}
        teachers={teachers}
        editing={editing}
        onClose={() => { setModalOpen(false); setEditing(null); }}
        onSaved={handleSaved}
      />

      <ProofModal
        open={!!proofTarget}
        salary={proofTarget}
        onClose={() => setProofTarget(null)}
        onUploaded={(updated) => {
          setSalaries((prev) => prev.map((s) => s.id === updated.id ? updated : s));
          setProofTarget(null);
        }}
      />

      <ConfirmationModal
        open={!!deleteTarget}
        title="Delete Salary Record"
        description={
          deleteTarget
            ? `Delete salary record for ${deleteTarget.Teacher ? `${deleteTarget.Teacher.firstName} ${deleteTarget.Teacher.lastName}` : "this teacher"} (${formatMonthStatic(deleteTarget.month)})?`
            : ""
        }
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};

export default AdminSalary;
