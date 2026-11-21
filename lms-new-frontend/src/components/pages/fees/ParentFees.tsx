"use client";

import { useState, useEffect, useRef } from "react";
import { useAppSelector } from "@/core/redux/hooks";
import { getStudentFees, uploadProof } from "@/services/feesService";
import { Fee, FeeStatus } from "@/types/fees";
import { api_base_url, resolveImageUrl } from "@/environment";
import { getAccessToken } from "@/lib/auth-storage";

const STATUS_COLOR: Record<FeeStatus, string> = {
  pending: "warning",
  overdue: "danger",
  paid: "success",
  cancelled: "secondary",
};

const fmt = (amount: number | string) => `$${Number(amount).toFixed(2)}`;
const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString() : "—");

const FILTERS: Array<FeeStatus | "all"> = ["all", "pending", "overdue", "paid", "cancelled"];

interface ChildWithFees {
  id: number;
  firstName: string;
  lastName: string;
  fees: Fee[];
}

export default function ParentFees() {
  const { user } = useAppSelector((s) => s.auth);
  const [children, setChildren] = useState<ChildWithFees[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeChildId, setActiveChildId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<FeeStatus | "all">("all");
  const [uploadingId, setUploadingId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingFeeId = useRef<number | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    const token = getAccessToken();
    setLoading(true);
    fetch(`${api_base_url}/parent/getById/${user.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then(async (data) => {
        const studentList: Array<{ id: number; firstName: string; lastName: string }> =
          data?.parent?.students ?? data?.students ?? [];
        const withFees = await Promise.all(
          studentList.map(async (s) => {
            const fees = await getStudentFees(s.id).catch(() => [] as Fee[]);
            return { ...s, fees };
          })
        );
        setChildren(withFees);
        if (withFees.length > 0) setActiveChildId(withFees[0].id);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user?.id]);

  const handleUploadClick = (feeId: number) => {
    pendingFeeId.current = feeId;
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const feeId = pendingFeeId.current;
    if (!file || !feeId) return;
    e.target.value = "";
    setUploadingId(feeId);
    try {
      const updated = await uploadProof(feeId, file);
      setChildren((prev) =>
        prev.map((child) => ({
          ...child,
          fees: child.fees.map((f) => (f.id === feeId ? { ...f, proofPath: updated.proofPath } : f)),
        }))
      );
    } catch {
      alert("Failed to upload proof. Please try again.");
    } finally {
      setUploadingId(null);
      pendingFeeId.current = null;
    }
  };

  const activeChild = children.find((c) => c.id === activeChildId) ?? null;
  const fees = activeChild?.fees ?? [];
  const filtered = statusFilter === "all" ? fees : fees.filter((f) => f.status === statusFilter);

  // Aggregate across all children
  const totalAll = children.reduce((s, c) => s + c.fees.reduce((ss, f) => ss + Number(f.amount), 0), 0);
  const totalPaid = children.reduce((s, c) => s + c.fees.filter((f) => f.status === "paid").reduce((ss, f) => ss + Number(f.amount), 0), 0);
  const totalDue = children.reduce((s, c) => s + c.fees.filter((f) => f.status === "pending" || f.status === "overdue").reduce((ss, f) => ss + Number(f.amount), 0), 0);
  const paidPct = totalAll > 0 ? Math.round((totalPaid / totalAll) * 100) : 0;

  const hasOverdue = fees.some((f) => f.status === "overdue");
  const hasPending = fees.some((f) => f.status === "pending");

  return (
    <div className="page-wrapper">
      <div className="content">

        {/* Page Header */}
        <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-4">
          <div>
            <h4 className="fw-bold mb-0">Children&apos;s Fees</h4>
            <p className="text-muted mb-0 fs-13">View fee records and upload payment proof for your children</p>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-5"><div className="spinner-border text-primary" /></div>
        ) : children.length === 0 ? (
          <div className="text-center py-5 text-muted">
            <i className="ti ti-users-off fs-40 mb-2 d-block" />
            <p className="fs-13">No children linked to this account.</p>
          </div>
        ) : (
          <>
            {/* Summary Cards — aggregate */}
            <div className="row mb-4">
              <div className="col-sm-3">
                <div className="card border shadow-sm text-center p-3">
                  <p className="text-muted fs-13 mb-1">Total Fees</p>
                  <h4 className="fw-bold mb-0">{fmt(totalAll)}</h4>
                </div>
              </div>
              <div className="col-sm-3">
                <div className="card border shadow-sm text-center p-3">
                  <p className="text-muted fs-13 mb-1">Total Paid</p>
                  <h4 className="fw-bold mb-0 text-success">{fmt(totalPaid)}</h4>
                </div>
              </div>
              <div className="col-sm-3">
                <div className="card border shadow-sm text-center p-3">
                  <p className="text-muted fs-13 mb-1">Outstanding</p>
                  <h4 className={`fw-bold mb-0 ${totalDue > 0 ? "text-danger" : "text-success"}`}>{fmt(totalDue)}</h4>
                </div>
              </div>
              <div className="col-sm-3">
                <div className="card border shadow-sm text-center p-3">
                  <p className="text-muted fs-13 mb-1">Overall Progress</p>
                  <h4 className="fw-bold mb-0">{paidPct}%</h4>
                  <div className="progress mt-2" style={{ height: 6 }}>
                    <div className="progress-bar bg-success" style={{ width: `${paidPct}%` }} />
                  </div>
                </div>
              </div>
            </div>

            {/* Child Tabs */}
            <div className="d-flex gap-2 flex-wrap mb-3">
              {children.map((child, ci) => {
                const colors = ["primary", "info", "success", "warning", "danger"];
                const color = colors[ci % colors.length];
                const childDue = child.fees.filter((f) => f.status === "pending" || f.status === "overdue").reduce((s, f) => s + Number(f.amount), 0);
                const childOverdue = child.fees.some((f) => f.status === "overdue");
                return (
                  <button
                    key={child.id}
                    className={`btn d-flex align-items-center gap-2 ${activeChildId === child.id ? `btn-${color}` : `btn-outline-${color}`}`}
                    onClick={() => { setActiveChildId(child.id); setStatusFilter("all"); }}
                  >
                    <span className="fw-semibold">{child.firstName} {child.lastName}</span>
                    {childDue > 0 && (
                      <span className={`badge bg-${childOverdue ? "danger" : "warning"} text-white fs-11`}>
                        {fmt(childDue)}
                      </span>
                    )}
                    {childDue === 0 && child.fees.length > 0 && (
                      <span className="badge bg-success text-white fs-11">Paid</span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Alert Banners for active child */}
            {hasOverdue && (
              <div className="alert alert-danger d-flex align-items-center gap-2 mb-2">
                <i className="ti ti-alert-triangle fs-18 flex-shrink-0" />
                <span><strong>{activeChild?.firstName}</strong> has <strong>{fees.filter((f) => f.status === "overdue").length} overdue</strong> fee(s). Please upload payment proof.</span>
              </div>
            )}
            {hasPending && (
              <div className="alert alert-warning d-flex align-items-center gap-2 mb-3">
                <i className="ti ti-clock fs-18 flex-shrink-0" />
                <span><strong>{activeChild?.firstName}</strong> has <strong>{fees.filter((f) => f.status === "pending").length} pending</strong> fee(s) due soon.</span>
              </div>
            )}

            {/* Fees Table */}
            <div className="card shadow-sm">
              <div className="card-header d-flex align-items-center justify-content-between flex-wrap gap-2">
                <h5 className="fw-bold mb-0">
                  {activeChild?.firstName} {activeChild?.lastName} — Fee Records
                </h5>
                <div className="d-flex gap-2 flex-wrap">
                  {FILTERS.map((f) => (
                    <button
                      key={f}
                      className={`btn btn-sm ${statusFilter === f ? "btn-primary" : "btn-outline-secondary"}`}
                      onClick={() => setStatusFilter(f)}
                    >
                      {f.charAt(0).toUpperCase() + f.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="card-body p-0">
                {filtered.length === 0 ? (
                  <div className="text-center py-5 text-muted">
                    <i className="ti ti-receipt-off fs-40 mb-2 d-block" />
                    <p className="fs-13 mb-0">No fee records found</p>
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="table table-hover mb-0">
                      <thead className="table-light">
                        <tr>
                          <th className="fs-13">#</th>
                          <th className="fs-13">Title</th>
                          <th className="fs-13">Amount</th>
                          <th className="fs-13">Due Date</th>
                          <th className="fs-13">Paid Date</th>
                          <th className="fs-13">Status</th>
                          <th className="fs-13">Invoice</th>
                          <th className="fs-13">Payment Proof</th>
                          <th className="fs-13">Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.map((fee, idx) => (
                          <tr key={fee.id}>
                            <td className="fs-13 text-muted">{idx + 1}</td>
                            <td className="fs-13 fw-medium">{fee.title}</td>
                            <td className="fs-13 fw-semibold">{fmt(fee.amount)}</td>
                            <td className="fs-13 text-muted">{fmtDate(fee.dueDate)}</td>
                            <td className="fs-13 text-muted">{fmtDate(fee.paidDate)}</td>
                            <td>
                              <span className={`badge badge-soft-${STATUS_COLOR[fee.status]} border border-${STATUS_COLOR[fee.status]} fw-medium fs-12`}>
                                {fee.status.charAt(0).toUpperCase() + fee.status.slice(1)}
                              </span>
                            </td>
                            <td>
                              {fee.invoicePath ? (
                                <a
                                  href={`${resolveImageUrl(fee.invoicePath)}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="btn btn-sm btn-outline-success py-1 px-2 fs-12"
                                >
                                  <i className="ti ti-download me-1" />View
                                </a>
                              ) : (
                                <span className="text-muted fs-12">—</span>
                              )}
                            </td>
                            <td>
                              {fee.proofPath ? (
                                <a
                                  href={`${resolveImageUrl(fee.proofPath)}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="btn btn-sm btn-outline-primary py-1 px-2 fs-12"
                                >
                                  <i className="ti ti-eye me-1" />View
                                </a>
                              ) : (fee.status === "pending" || fee.status === "overdue") ? (
                                <button
                                  className="btn btn-sm btn-outline-warning py-1 px-2 fs-12"
                                  onClick={() => handleUploadClick(fee.id)}
                                  disabled={uploadingId === fee.id}
                                >
                                  {uploadingId === fee.id ? (
                                    <span className="spinner-border spinner-border-sm" />
                                  ) : (
                                    <><i className="ti ti-upload me-1" />Upload</>
                                  )}
                                </button>
                              ) : (
                                <span className="text-muted fs-12">—</span>
                              )}
                            </td>
                            <td className="fs-12 text-muted">{fee.notes ?? "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,application/pdf"
          className="d-none"
          onChange={handleFileChange}
        />
      </div>
    </div>
  );
}
