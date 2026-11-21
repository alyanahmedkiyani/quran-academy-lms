"use client";

import { useEffect, useState, useRef } from "react";
import { DatePicker, Select as AntSelect } from "antd";
import dayjs from "dayjs";
import { useFormik } from "formik";
import * as Yup from "yup";
import {
  getAllFees,
  createFee,
  updateFee,
  deleteFee,
  uploadInvoice,
  uploadProof,
  getAllPlanChangeRequests,
  approvePlanChangeRequest,
  rejectPlanChangeRequest,
} from "@/services/feesService";
import { fetchAllStudents } from "@/services/studentService";
import { fetchAllPlans } from "@/services/planService";
import { Fee, FeeStatus, PlanChangeRequest } from "@/types/fees";
import { Student } from "@/types/student";
import { Plan } from "@/services/planService";
import CommonSelect, { Option as SelectOption } from "@/core/common/common-select/commonSelect";
import { media_base_url, resolveImageUrl } from "@/environment";
import PredefinedDatePicker from "@/core/common/datePicker";

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<FeeStatus, string> = {
  pending: "warning",
  overdue: "danger",
  paid: "success",
  cancelled: "secondary",
};

const fmt = (amount: number | string) => `$${Number(amount).toFixed(2)}`;
const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString() : "—");

// ── Fee Create/Edit Modal ─────────────────────────────────────────────────────

interface FeeModalProps {
  open: boolean;
  fee: Fee | null;
  students: Student[];
  plans: Plan[];
  onClose: () => void;
  onSaved: (f: Fee | Fee[]) => void;
}

const FeeModal = ({ open, fee, students, plans, onClose, onSaved }: FeeModalProps) => {
  const isEdit = !!fee;
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [studentError, setStudentError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setSelectedStudentIds([]);
      setStudentError(null);
    }
  }, [open]);

  const formik = useFormik({
    initialValues: {
      planId: fee?.planId ? String(fee.planId) : "",
      title: fee?.title ?? "",
      amount: fee ? String(fee.amount) : "",
      dueDate: fee?.dueDate ?? "",
      notes: fee?.notes ?? "",
      status: fee?.status ?? "pending",
      paidDate: fee?.paidDate ?? "",
    },
    enableReinitialize: true,
    validationSchema: Yup.object({
      title: Yup.string().trim().required("Title is required"),
      amount: Yup.number().typeError("Must be a number").positive("Must be positive").required("Amount is required"),
      dueDate: Yup.string().required("Due date is required"),
    }),
    onSubmit: async (values, { setSubmitting, setFieldError }) => {
      if (!isEdit && selectedStudentIds.length === 0) {
        setStudentError("Select at least one student.");
        setSubmitting(false);
        return;
      }
      setStudentError(null);
      try {
        if (isEdit && fee) {
          const saved = await updateFee(fee.id, {
            title: values.title.trim(),
            amount: values.amount,
            dueDate: values.dueDate,
            notes: values.notes.trim() || undefined,
            status: values.status as FeeStatus,
            paidDate: values.paidDate || null,
            planId: values.planId || null,
          });
          onSaved(saved);
        } else {
          const created: Fee[] = [];
          for (const studentId of selectedStudentIds) {
            const saved = await createFee({
              studentId,
              planId: values.planId || null,
              title: values.title.trim(),
              amount: values.amount,
              dueDate: values.dueDate,
              notes: values.notes.trim() || undefined,
            });
            created.push(saved);
          }
          onSaved(created.length === 1 ? created[0] : created);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to save";
        setFieldError("title", msg);
      } finally {
        setSubmitting(false);
      }
    },
  });

  if (!open) return null;

  const planOptions: SelectOption[] = plans.map((p) => ({
    value: String(p.id),
    label: `${p.name} (${fmt(p.price)})`,
  }));
  const statusOptions: SelectOption[] = (["pending", "paid", "overdue", "cancelled"] as FeeStatus[]).map((s) => ({
    value: s,
    label: s.charAt(0).toUpperCase() + s.slice(1),
  }));

  return (
    <>
      <div className="modal-backdrop fade show" style={{ zIndex: 1040 }} onClick={formik.isSubmitting ? undefined : onClose} />
      <div className="modal fade show" style={{ display: "block", zIndex: 1055 }} tabIndex={-1}>
        <div className="modal-dialog modal-dialog-centered modal-lg">
          <div className="modal-content">
            <div className="modal-header">
              <h4 className="modal-title fw-bold">
                {isEdit ? "Edit Fee" : selectedStudentIds.length > 1 ? `Create Fee Records (${selectedStudentIds.length} students)` : "Create Fee Record"}
              </h4>
              <button type="button" className="btn-close" onClick={onClose} disabled={formik.isSubmitting} />
            </div>
            <form onSubmit={formik.handleSubmit} noValidate>
              <div className="modal-body">
                {!isEdit && (
                  <div className="mb-3">
                    <label className="form-label">
                      Students <span className="text-danger">*</span>
                      {selectedStudentIds.length > 0 && (
                        <span className="badge bg-primary ms-2">{selectedStudentIds.length} selected</span>
                      )}
                    </label>
                    <AntSelect
                      mode="multiple"
                      style={{ width: "100%" }}
                      placeholder="Select one or more students…"
                      value={selectedStudentIds}
                      onChange={(val) => { setSelectedStudentIds(val); setStudentError(null); }}
                      options={students.map((s) => ({
                        value: String(s.id),
                        label: `${s.firstName} ${s.lastName} (${s.username})`,
                      }))}
                      optionFilterProp="label"
                      maxTagCount="responsive"
                      size="large"
                      disabled={formik.isSubmitting}
                      dropdownStyle={{ zIndex: 1060 }}
                    />
                    {studentError && <div className="text-danger small mt-1">{studentError}</div>}
                  </div>
                )}
                <div className="row">
                  <div className="col-lg-8 mb-3">
                    <label className="form-label">Title <span className="text-danger">*</span></label>
                    <input className="form-control" name="title" value={formik.values.title} onChange={formik.handleChange} onBlur={formik.handleBlur} disabled={formik.isSubmitting} />
                    {formik.touched.title && formik.errors.title && (
                      <div className="text-danger small mt-1">{formik.errors.title}</div>
                    )}
                  </div>
                  <div className="col-lg-4 mb-3">
                    <label className="form-label">Amount ($) <span className="text-danger">*</span></label>
                    <input type="number" step="0.01" className="form-control" name="amount" value={formik.values.amount} onChange={formik.handleChange} onBlur={formik.handleBlur} disabled={formik.isSubmitting} />
                    {formik.touched.amount && formik.errors.amount && (
                      <div className="text-danger small mt-1">{formik.errors.amount}</div>
                    )}
                  </div>
                  <div className="col-lg-6 mb-3">
                    <label className="form-label">Due Date <span className="text-danger">*</span></label>
                    <DatePicker
                      style={{ width: "100%" }}
                      value={formik.values.dueDate ? dayjs(formik.values.dueDate) : null}
                      onChange={(_, ds) => { formik.setFieldValue("dueDate", ds); formik.setFieldTouched("dueDate", true); }}
                      format="YYYY-MM-DD"
                      placeholder="Select date"
                      disabled={formik.isSubmitting}
                    />
                    {formik.touched.dueDate && formik.errors.dueDate && (
                      <div className="text-danger small mt-1">{formik.errors.dueDate}</div>
                    )}
                  </div>
                  {isEdit && (
                    <div className="col-lg-6 mb-3">
                      <label className="form-label">Paid Date</label>
                      <DatePicker
                        style={{ width: "100%" }}
                        value={formik.values.paidDate ? dayjs(formik.values.paidDate) : null}
                        onChange={(_, ds) => formik.setFieldValue("paidDate", ds)}
                        format="YYYY-MM-DD"
                        placeholder="Select date"
                        disabled={formik.isSubmitting}
                      />
                    </div>
                  )}
                  <div className="col-lg-6 mb-3">
                    <label className="form-label">Plan (optional)</label>
                    <CommonSelect
                      options={planOptions}
                      value={formik.values.planId ? planOptions.find((o) => o.value === formik.values.planId) ?? null : null}
                      onChange={(opt) => formik.setFieldValue("planId", opt?.value ?? "")}
                      placeholder="Select plan"
                      isClearable
                      isDisabled={formik.isSubmitting}
                    />
                  </div>
                  {isEdit && (
                    <div className="col-lg-6 mb-3">
                      <label className="form-label">Status</label>
                      <CommonSelect
                        options={statusOptions}
                        value={statusOptions.find((o) => o.value === formik.values.status) ?? null}
                        onChange={(opt) => formik.setFieldValue("status", opt?.value ?? "pending")}
                        isDisabled={formik.isSubmitting}
                      />
                    </div>
                  )}
                  <div className="col-12 mb-3">
                    <label className="form-label">Notes</label>
                    <textarea rows={2} className="form-control" name="notes" value={formik.values.notes} onChange={formik.handleChange} disabled={formik.isSubmitting} />
                  </div>
                </div>
              </div>
              <div className="modal-footer gap-2">
                <button type="button" className="btn btn-light border" onClick={onClose} disabled={formik.isSubmitting}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={formik.isSubmitting}>
                  {formik.isSubmitting
                    ? "Saving..."
                    : isEdit
                    ? "Save Changes"
                    : selectedStudentIds.length > 1
                    ? `Create ${selectedStudentIds.length} Fees`
                    : "Create Fee"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
};

// ── Upload Modal ──────────────────────────────────────────────────────────────

interface UploadModalProps {
  open: boolean;
  feeId: number;
  type: "invoice" | "proof";
  onClose: () => void;
  onUploaded: (f: Fee) => void;
}

const UploadModal = ({ open, feeId, type, onClose, onUploaded }: UploadModalProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const saved = type === "invoice" ? await uploadInvoice(feeId, file) : await uploadProof(feeId, file);
      onUploaded(saved);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  if (!open) return null;
  return (
    <>
      <div className="modal-backdrop fade show" style={{ zIndex: 1040 }} onClick={onClose} />
      <div className="modal fade show" style={{ display: "block", zIndex: 1055 }} tabIndex={-1}>
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title fw-bold">Upload {type === "invoice" ? "Invoice" : "Payment Proof"}</h5>
              <button type="button" className="btn-close" onClick={onClose} />
            </div>
            <div className="modal-body">
              {error && <div className="alert alert-danger py-2 mb-3">{error}</div>}
              <div
                className="border border-dashed rounded-2 p-4 text-center"
                onClick={() => inputRef.current?.click()}
                style={{ cursor: "pointer" }}
              >
                <i className="ti ti-cloud-upload fs-32 text-muted mb-2 d-block" />
                <p className="mb-0 fs-13 text-muted">
                  {file ? file.name : "Click to select a PDF or image file"}
                </p>
              </div>
              <input ref={inputRef} type="file" className="d-none" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </div>
            <div className="modal-footer gap-2">
              <button className="btn btn-light border" onClick={onClose}>Cancel</button>
              <button className="btn btn-primary" onClick={handleUpload} disabled={!file || uploading}>
                {uploading ? "Uploading..." : "Upload"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

// ── Delete Confirm ────────────────────────────────────────────────────────────

interface DeleteConfirmProps {
  open: boolean;
  onConfirm: () => void;
  onClose: () => void;
  deleting: boolean;
}

const DeleteConfirm = ({ open, onConfirm, onClose, deleting }: DeleteConfirmProps) => {
  if (!open) return null;
  return (
    <>
      <div className="modal-backdrop fade show" style={{ zIndex: 1040 }} onClick={onClose} />
      <div className="modal fade show" style={{ display: "block", zIndex: 1055 }} tabIndex={-1}>
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-body text-center py-4">
              <i className="ti ti-trash-x fs-48 text-danger mb-2 d-block" />
              <h5 className="fw-bold">Delete Fee Record?</h5>
              <p className="text-muted fs-13 mb-0">This action cannot be undone.</p>
            </div>
            <div className="modal-footer justify-content-center gap-2">
              <button className="btn btn-light border" onClick={onClose} disabled={deleting}>Cancel</button>
              <button className="btn btn-danger" onClick={onConfirm} disabled={deleting}>{deleting ? "Deleting..." : "Delete"}</button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────

const FeesManagement = () => {
  const [activeTab, setActiveTab] = useState<"fees" | "requests">("fees");
  const [fees, setFees] = useState<Fee[]>([]);
  const [requests, setRequests] = useState<PlanChangeRequest[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [feeModal, setFeeModal] = useState<{ open: boolean; fee: Fee | null }>({ open: false, fee: null });
  const [uploadModal, setUploadModal] = useState<{ open: boolean; feeId: number; type: "invoice" | "proof" } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; feeId: number | null }>({ open: false, feeId: null });
  const [deleting, setDeleting] = useState(false);
  const [processingRequest, setProcessingRequest] = useState<number | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "danger" } | null>(null);

  const showToast = (message: string, type: "success" | "danger" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [feesData, studentsData, plansData, reqData] = await Promise.all([
        getAllFees(),
        fetchAllStudents().then((r) => r.students),
        fetchAllPlans(),
        getAllPlanChangeRequests(),
      ]);
      setFees(feesData);
      setStudents(studentsData);
      setPlans(plansData);
      setRequests(reqData);
    } catch {
      showToast("Failed to load data", "danger");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredFees = fees.filter((f) => {
    if (statusFilter !== "all" && f.status !== statusFilter) return false;
    if (dateFrom && f.dueDate && f.dueDate < dateFrom) return false;
    if (dateTo && f.dueDate && f.dueDate > dateTo) return false;
    return true;
  });


  const handleFeeSaved = (saved: Fee | Fee[]) => {
    if (Array.isArray(saved)) {
      setFees((prev) => [...saved, ...prev]);
      showToast(`${saved.length} fee record(s) created successfully`);
    } else {
      setFees((prev) => {
        const idx = prev.findIndex((f) => f.id === saved.id);
        return idx >= 0 ? prev.map((f) => (f.id === saved.id ? saved : f)) : [saved, ...prev];
      });
      showToast(feeModal.fee ? "Fee updated successfully" : "Fee created successfully");
    }
    setFeeModal({ open: false, fee: null });
  };

  const handleUploaded = (saved: Fee) => {
    setFees((prev) => prev.map((f) => (f.id === saved.id ? { ...f, ...saved } : f)));
    setUploadModal(null);
    showToast("File uploaded successfully");
  };

  const handleDelete = async () => {
    if (!deleteConfirm.feeId) return;
    setDeleting(true);
    try {
      await deleteFee(deleteConfirm.feeId);
      setFees((prev) => prev.filter((f) => f.id !== deleteConfirm.feeId));
      setDeleteConfirm({ open: false, feeId: null });
      showToast("Fee deleted");
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Failed to delete", "danger");
    } finally {
      setDeleting(false);
    }
  };

  const handleApprove = async (req: PlanChangeRequest) => {
    setProcessingRequest(req.id);
    try {
      await approvePlanChangeRequest(req.id);
      // Reload all data — approval creates a new Fee record on the backend
      await loadData();
      showToast("Approved. Fee created — plan will update once payment is confirmed.");
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Failed to approve", "danger");
    } finally {
      setProcessingRequest(null);
    }
  };

  const handleReject = async (req: PlanChangeRequest) => {
    setProcessingRequest(req.id);
    try {
      await rejectPlanChangeRequest(req.id);
      setRequests((prev) => prev.map((r) => (r.id === req.id ? { ...r, status: "rejected" } : r)));
      showToast("Plan change request rejected");
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Failed to reject", "danger");
    } finally {
      setProcessingRequest(null);
    }
  };

  const statusFilters = ["all", "pending", "overdue", "paid", "cancelled"];

  return (
    <div className="page-wrapper">
      <div className="content">
        {/* Toast */}
        {toast && (
          <div
            className={`alert alert-${toast.type} d-flex align-items-center gap-2 mb-3`}
            style={{ position: "sticky", top: 16, zIndex: 1050 }}
          >
            <i className={`ti ti-${toast.type === "success" ? "circle-check" : "alert-circle"} fs-18`} />
            {toast.message}
          </div>
        )}

        {/* Summary Cards */}
        {(() => {
          const totalCount     = fees.length;
          const totalAmount    = fees.reduce((s, f) => s + Number(f.amount), 0);
          const collected      = fees.filter((f) => f.status === "paid").reduce((s, f) => s + Number(f.amount), 0);
          const outstanding    = fees.filter((f) => f.status === "pending" || f.status === "overdue").reduce((s, f) => s + Number(f.amount), 0);
          const overdueCount   = fees.filter((f) => f.status === "overdue").length;
          const proofCount     = fees.filter((f) => f.proofPath).length;
          return (
            <div className="row g-3 mb-4">
              {[
                { label: "Total Fee Records",   value: totalCount,               icon: "ti-receipt",           color: "primary",   fmt: false },
                { label: "Total Amount",         value: totalAmount,              icon: "ti-cash",              color: "info",      fmt: true  },
                { label: "Amount Collected",     value: collected,                icon: "ti-circle-check",      color: "success",   fmt: true  },
                { label: "Outstanding Amount",   value: outstanding,              icon: "ti-alert-circle",      color: "warning",   fmt: true  },
                { label: "Overdue",              value: overdueCount,             icon: "ti-clock-exclamation", color: overdueCount > 0 ? "danger" : "secondary", fmt: false },
                { label: "Proof Submitted",      value: proofCount,               icon: "ti-file-check",        color: "secondary", fmt: false },
              ].map(({ label, value, icon, color, fmt: isMoney }) => (
                <div key={label} className="col-xl-2 col-md-4 col-sm-6">
                  <div className="card border-0 shadow-sm mb-0">
                    <div className="card-body d-flex align-items-center gap-3 py-3">
                      <div className={`rounded-circle bg-${color} bg-opacity-10 p-3`}>
                        <i className={`ti ${icon} text-${color} fs-4`} />
                      </div>
                      <div>
                        <p className="text-muted mb-0 small">{label}</p>
                        <h5 className="mb-0 fw-semibold">
                          {loading ? "—" : isMoney ? `$${Number(value).toFixed(2)}` : value}
                        </h5>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          );
        })()}

        {/* Header */}
        <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-4">
          <div>
            <h4 className="fw-bold mb-0">Fees Management</h4>
            <p className="text-muted mb-0 fs-13">Manage fee records and plan change requests</p>
          </div>
          {activeTab === "fees" && (
            <button className="btn btn-primary d-inline-flex align-items-center" onClick={() => setFeeModal({ open: true, fee: null })}>
              <i className="ti ti-plus me-1" /> Create Fee
            </button>
          )}
        </div>

        {/* Tabs */}
        <ul className="nav nav-tabs mb-4">
          <li className="nav-item">
            <button className={`nav-link fw-medium ${activeTab === "fees" ? "active" : ""}`} onClick={() => setActiveTab("fees")}>
              <i className="ti ti-coin me-1" /> Fee Records
              {fees.filter((f) => f.status === "pending" || f.status === "overdue").length > 0 && (
                <span className="badge bg-danger ms-2 fs-11">
                  {fees.filter((f) => f.status === "pending" || f.status === "overdue").length}
                </span>
              )}
            </button>
          </li>
          <li className="nav-item">
            <button className={`nav-link fw-medium ${activeTab === "requests" ? "active" : ""}`} onClick={() => setActiveTab("requests")}>
              <i className="ti ti-exchange me-1" /> Plan Change Requests
              {requests.filter((r) => r.status === "pending").length > 0 && (
                <span className="badge bg-warning text-dark ms-2 fs-11">
                  {requests.filter((r) => r.status === "pending").length}
                </span>
              )}
            </button>
          </li>
        </ul>

        {loading ? (
          <div className="d-flex justify-content-center py-5">
            <div className="spinner-border text-primary" />
          </div>
        ) : (
          <>
            {/* ── TAB 1: Fee Records ── */}
            {activeTab === "fees" && (
              <div className="card shadow-sm">
                <div className="card-body">
                  {/* Status filters + Date filter — single row */}
                  <div className="d-flex align-items-center flex-wrap gap-2 mb-4">
                    {statusFilters.map((s) => (
                      <button
                        key={s}
                        className={`btn btn-sm ${statusFilter === s ? "btn-primary" : "btn-outline-secondary"}`}
                        onClick={() => setStatusFilter(s)}
                      >
                        {s.charAt(0).toUpperCase() + s.slice(1)}
                        <span className="ms-1 badge bg-white text-dark">
                          {s === "all" ? fees.length : fees.filter((f) => f.status === s).length}
                        </span>
                      </button>
                    ))}
                    <div className="ms-auto d-flex align-items-center gap-2">
                      <span className="fs-13 text-muted fw-medium">Due Date:</span>
                      <div style={{ width: 260 }}>
                        <PredefinedDatePicker
                          onChange={(from, to) => { setDateFrom(from); setDateTo(to); }}
                        />
                      </div>
                      {(dateFrom || dateTo) && (
                        <button
                          className="btn btn-sm btn-outline-danger"
                          onClick={() => { setDateFrom(""); setDateTo(""); }}
                        >
                          <i className="ti ti-x" />
                        </button>
                      )}
                    </div>
                  </div>

                  {filteredFees.length === 0 ? (
                    <div className="text-center py-5 text-muted">
                      <i className="ti ti-receipt-off fs-40 mb-2 d-block" />
                      No fee records found.
                    </div>
                  ) : (
                    <div className="table-responsive">
                      <table className="table table-hover" style={{ minWidth: 1000 }}>
                        <thead className="table-light">
                          <tr>
                            <th style={{ width: 180 }}>Student</th>
                            <th style={{ width: 180 }}>Title</th>
                            <th style={{ width: 100 }}>Amount</th>
                            <th style={{ width: 140 }}>Plan</th>
                            <th style={{ width: 100 }}>Status</th>
                            <th style={{ width: 110 }}>Due Date</th>
                            <th style={{ width: 110 }}>Paid Date</th>
                            <th style={{ width: 130 }}>Created By</th>
                            <th style={{ width: 100 }}>Invoice</th>
                            <th style={{ width: 100 }}>Proof</th>
                            <th style={{ width: 140 }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredFees.map((fee) => (
                            <tr key={fee.id}>
                              <td>
                                {fee.Student ? (
                                  <div className="d-flex align-items-center gap-2">
                                    {fee.Student.profileImg ? (
                                      <img
                                        src={`${media_base_url}/${fee.Student.profileImg}`}
                                        alt=""
                                        width={32} height={32}
                                        style={{ borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
                                      />
                                    ) : (
                                      <span
                                        className="d-flex align-items-center justify-content-center bg-primary text-white fw-bold"
                                        style={{ width: 32, height: 32, borderRadius: "50%", fontSize: 11, flexShrink: 0 }}
                                      >
                                        {fee.Student.firstName[0]}{fee.Student.lastName[0]}
                                      </span>
                                    )}
                                    <div>
                                      <div className="fs-13 fw-medium">{fee.Student.firstName} {fee.Student.lastName}</div>
                                      <div className="fs-11 text-muted">@{fee.Student.username}</div>
                                    </div>
                                  </div>
                                ) : (
                                  <span className="fs-13 text-muted">Student #{fee.studentId}</span>
                                )}
                              </td>
                              <td className="fs-13">{fee.title}</td>
                              <td className="fs-13 fw-semibold">{fmt(fee.amount)}</td>
                              <td className="fs-13 text-muted">{fee.Plan?.name ?? "—"}</td>
                              <td>
                                <span className={`badge badge-soft-${STATUS_COLORS[fee.status]} border border-${STATUS_COLORS[fee.status]} fs-12`}>
                                  {fee.status.charAt(0).toUpperCase() + fee.status.slice(1)}
                                </span>
                              </td>
                              <td className="fs-13 text-muted">{fmtDate(fee.dueDate)}</td>
                              <td className="fs-13 text-muted">{fmtDate(fee.paidDate)}</td>
                              <td className="fs-13">
                                {fee.CreatedBy ? (
                                  <span title={`@${fee.CreatedBy.username}`}>
                                    {fee.CreatedBy.name || fee.CreatedBy.username}
                                  </span>
                                ) : (
                                  <span className="text-muted">System</span>
                                )}
                              </td>
                              <td>
                                {fee.invoicePath ? (
                                  <a href={`${resolveImageUrl(fee.invoicePath)}`} target="_blank" rel="noreferrer" className="btn btn-sm btn-outline-success py-1 px-2 fs-12">
                                    <i className="ti ti-download me-1" />View
                                  </a>
                                ) : (
                                  <button className="btn btn-sm btn-outline-secondary py-1 px-2 fs-12" onClick={() => setUploadModal({ open: true, feeId: fee.id, type: "invoice" })}>
                                    <i className="ti ti-upload me-1" />Upload
                                  </button>
                                )}
                              </td>
                              <td>
                                {fee.proofPath ? (
                                  <a href={`${resolveImageUrl(fee.proofPath)}`} target="_blank" rel="noreferrer" className="btn btn-sm btn-outline-info py-1 px-2 fs-12">
                                    <i className="ti ti-download me-1" />View
                                  </a>
                                ) : (
                                  <span className="text-muted fs-12">—</span>
                                )}
                              </td>
                              <td>
                                <div className="d-flex gap-1">
                                  <button className="btn btn-sm btn-outline-primary p-1" title="Edit" onClick={() => setFeeModal({ open: true, fee })}>
                                    <i className="ti ti-pencil fs-14" />
                                  </button>
                                  {!fee.invoicePath && (
                                    <button className="btn btn-sm btn-outline-success p-1" title="Upload Invoice" onClick={() => setUploadModal({ open: true, feeId: fee.id, type: "invoice" })}>
                                      <i className="ti ti-file-invoice fs-14" />
                                    </button>
                                  )}
                                  <button className="btn btn-sm btn-outline-danger p-1" title="Delete" onClick={() => setDeleteConfirm({ open: true, feeId: fee.id })}>
                                    <i className="ti ti-trash fs-14" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── TAB 2: Plan Change Requests ── */}
            {activeTab === "requests" && (
              <div className="card shadow-sm">
                {/* Flow legend */}
                <div className="card-header bg-light py-2 px-3">
                  <p className="fs-12 text-muted mb-0 d-flex align-items-center gap-2 flex-wrap">
                    <span className="badge badge-soft-warning border border-warning">Pending</span>
                    <i className="ti ti-arrow-right" />
                    <span className="badge badge-soft-info border border-info">Approved — Fee Created</span>
                    <i className="ti ti-arrow-right" />
                    <span className="badge badge-soft-primary border border-primary">Fee Paid → Plan Updated</span>
                    <i className="ti ti-arrow-right" />
                    <span className="badge badge-soft-success border border-success">Completed</span>
                    <span className="ms-2 text-danger fw-medium">| Reject at Pending stage only</span>
                  </p>
                </div>
                <div className="card-body">
                  {requests.length === 0 ? (
                    <div className="text-center py-5 text-muted">
                      <i className="ti ti-exchange-off fs-40 mb-2 d-block" />
                      No plan change requests found.
                    </div>
                  ) : (
                    <div className="table-responsive">
                      <table className="table table-hover" style={{ minWidth: 900 }}>
                        <thead className="table-light">
                          <tr>
                            <th style={{ width: 160 }}>Student</th>
                            <th style={{ width: 150 }}>Current Plan</th>
                            <th style={{ width: 150 }}>Requested Plan</th>
                            <th style={{ width: 120 }}>Status</th>
                            <th style={{ width: 180 }}>Fee Status</th>
                            <th style={{ width: 110 }}>Submitted</th>
                            <th style={{ width: 160 }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {requests.map((req) => {
                            const statusColor =
                              req.status === "pending" ? "warning"
                              : req.status === "approved" ? "info"
                              : req.status === "completed" ? "success"
                              : "danger";
                            const statusLabel =
                              req.status === "approved" ? "Fee Created"
                              : req.status === "completed" ? "Completed"
                              : req.status.charAt(0).toUpperCase() + req.status.slice(1);

                            return (
                              <tr key={req.id}>
                                <td>
                                  {req.Student ? (
                                    <div className="d-flex align-items-center gap-2">
                                      {req.Student.profileImg ? (
                                        <img
                                          src={`${media_base_url}/${req.Student.profileImg}`}
                                          alt=""
                                          width={32} height={32}
                                          style={{ borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
                                        />
                                      ) : (
                                        <span
                                          className="d-flex align-items-center justify-content-center bg-primary text-white fw-bold"
                                          style={{ width: 32, height: 32, borderRadius: "50%", fontSize: 11, flexShrink: 0 }}
                                        >
                                          {req.Student.firstName[0]}{req.Student.lastName[0]}
                                        </span>
                                      )}
                                      <div>
                                        <div className="fs-13 fw-medium">{req.Student.firstName} {req.Student.lastName}</div>
                                        {req.Student.username && <div className="fs-11 text-muted">@{req.Student.username}</div>}
                                      </div>
                                    </div>
                                  ) : (
                                    <span className="fs-13 text-muted">Student #{req.studentId}</span>
                                  )}
                                </td>
                                <td className="fs-13 text-muted">
                                  {req.CurrentPlan ? `${req.CurrentPlan.name} (${fmt(req.CurrentPlan.price)})` : "—"}
                                </td>
                                <td className="fs-13 fw-medium text-primary">
                                  {req.RequestedPlan
                                    ? `${req.RequestedPlan.name} (${fmt(req.RequestedPlan.price)})`
                                    : `Plan #${req.requestedPlanId}`}
                                </td>
                                <td>
                                  <span className={`badge badge-soft-${statusColor} border border-${statusColor} fs-12`}>
                                    {statusLabel}
                                  </span>
                                </td>
                                <td>
                                  {req.paymentFee ? (
                                    <div>
                                      <span className={`badge badge-soft-${STATUS_COLORS[req.paymentFee.status]} border border-${STATUS_COLORS[req.paymentFee.status]} fs-12`}>
                                        {req.paymentFee.status.charAt(0).toUpperCase() + req.paymentFee.status.slice(1)}
                                      </span>
                                      <p className="fs-11 text-muted mb-0 mt-1">
                                        {fmt(req.paymentFee.amount)} · Due {fmtDate(req.paymentFee.dueDate)}
                                      </p>
                                    </div>
                                  ) : req.status === "completed" ? (
                                    <span className="badge badge-soft-success border border-success fs-12">Paid</span>
                                  ) : (
                                    <span className="text-muted fs-12">—</span>
                                  )}
                                </td>
                                <td className="fs-13 text-muted">{fmtDate(req.createdAt)}</td>
                                <td>
                                  {req.status === "pending" ? (
                                    <div className="d-flex gap-2">
                                      <button
                                        className="btn btn-sm btn-success py-1 px-2 fs-12"
                                        disabled={processingRequest === req.id}
                                        onClick={() => handleApprove(req)}
                                      >
                                        {processingRequest === req.id
                                          ? <span className="spinner-border spinner-border-sm" />
                                          : <><i className="ti ti-check me-1" />Approve</>}
                                      </button>
                                      <button
                                        className="btn btn-sm btn-outline-danger py-1 px-2 fs-12"
                                        disabled={processingRequest === req.id}
                                        onClick={() => handleReject(req)}
                                      >
                                        <i className="ti ti-x me-1" />Reject
                                      </button>
                                    </div>
                                  ) : req.status === "approved" ? (
                                    <span className="fs-12 text-info fw-medium">
                                      <i className="ti ti-clock me-1" />Awaiting Payment
                                    </span>
                                  ) : req.status === "completed" ? (
                                    <span className="fs-12 text-success fw-medium">
                                      <i className="ti ti-circle-check me-1" />Plan Updated
                                    </span>
                                  ) : (
                                    <span className="text-muted fs-12">—</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {/* Modals */}
        <FeeModal
          open={feeModal.open}
          fee={feeModal.fee}
          students={students}
          plans={plans}
          onClose={() => setFeeModal({ open: false, fee: null })}
          onSaved={handleFeeSaved}
        />
        {uploadModal && (
          <UploadModal
            open={uploadModal.open}
            feeId={uploadModal.feeId}
            type={uploadModal.type}
            onClose={() => setUploadModal(null)}
            onUploaded={handleUploaded}
          />
        )}
        <DeleteConfirm
          open={deleteConfirm.open}
          onConfirm={handleDelete}
          onClose={() => setDeleteConfirm({ open: false, feeId: null })}
          deleting={deleting}
        />
      </div>
    </div>
  );
};

export default FeesManagement;
