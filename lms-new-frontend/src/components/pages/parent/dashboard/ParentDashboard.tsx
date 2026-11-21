"use client";

import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { useAppSelector } from "@/core/redux/hooks";
import { all_routes } from "@/routes/all_routes";
import { getStudentFees, uploadProof } from "@/services/feesService";
import { Fee } from "@/types/fees";
import { api_base_url, resolveImageUrl } from "@/environment";
import { getAccessToken } from "@/lib/auth-storage";

interface ChildWithFees {
  id: number;
  firstName: string;
  lastName: string;
  fees: Fee[];
}

const FEE_STATUS_COLOR: Record<string, string> = {
  pending: "warning",
  overdue: "danger",
  paid: "success",
  cancelled: "secondary",
};

const ParentDashboard = () => {
  const { user } = useAppSelector((state) => state.auth);
  const [children, setChildren] = useState<ChildWithFees[]>([]);
  const [feesLoading, setFeesLoading] = useState(true);
  const [uploadingFeeId, setUploadingFeeId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingFeeId = useRef<number | null>(null);

  const handleUploadProofClick = (feeId: number) => {
    pendingFeeId.current = feeId;
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const feeId = pendingFeeId.current;
    if (!file || !feeId) return;
    e.target.value = "";
    setUploadingFeeId(feeId);
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
      setUploadingFeeId(null);
      pendingFeeId.current = null;
    }
  };

  useEffect(() => {
    if (!user?.id) return;
    const token = getAccessToken();
    // Fetch parent's children, then their fees
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
      })
      .catch(() => {})
      .finally(() => setFeesLoading(false));
  }, [user?.id]);

  // Aggregate fee totals across all children
  const totalPendingOverdue = children.reduce(
    (sum, c) =>
      sum + c.fees.filter((f) => f.status === "pending" || f.status === "overdue").reduce((s, f) => s + Number(f.amount), 0),
    0
  );

  return (
    <div className="page-wrapper">
      <div className="content">
        {/* Page Header */}
        <div className="d-flex align-items-sm-center justify-content-between flex-wrap gap-2 mb-4">
          <div>
            <h4 className="fw-bold mb-0">Parent Dashboard</h4>
            <p className="text-muted mb-0 fs-13">
              Welcome back, <strong>{user?.username ?? user?.email}</strong>
            </p>
          </div>
          <div className="d-flex align-items-center flex-wrap gap-2">
            <Link href={all_routes.parentSchedule} className="btn btn-primary d-inline-flex align-items-center">
              <i className="ti ti-calendar me-1" />
              Class Schedule
            </Link>
            <Link href={all_routes.parentChildProgress} className="btn btn-outline-white bg-white d-inline-flex align-items-center">
              <i className="ti ti-trending-up me-1" />
              Child Progress
            </Link>
          </div>
        </div>

        {/* Stats Row */}
        <div className="row">
          <div className="col-xl-3 col-sm-6">
            <div className="position-relative border card rounded-2 shadow-sm">
              <div className="card-body">
                <div className="d-flex align-items-center mb-2 justify-content-between">
                  <span className="avatar bg-primary rounded-circle">
                    <i className="ti ti-users fs-24" />
                  </span>
                  <div className="text-end">
                    <span className="badge px-2 py-1 fs-12 fw-medium d-inline-flex mb-1 bg-success">Enrolled</span>
                    <p className="fs-13 mb-0">This Semester</p>
                  </div>
                </div>
                <div>
                  <p className="mb-1">My Children</p>
                  <h3 className="fw-bold mb-0">2</h3>
                </div>
              </div>
            </div>
          </div>

          <div className="col-xl-3 col-sm-6">
            <div className="position-relative border card rounded-2 shadow-sm">
              <div className="card-body">
                <div className="d-flex align-items-center mb-2 justify-content-between">
                  <span className="avatar bg-success rounded-circle">
                    <i className="ti ti-trending-up fs-24" />
                  </span>
                  <div className="text-end">
                    <span className="badge px-2 py-1 fs-12 fw-medium d-inline-flex mb-1 bg-success">Good</span>
                    <p className="fs-13 mb-0">Average GPA</p>
                  </div>
                </div>
                <div>
                  <p className="mb-1">Child Progress</p>
                  <h3 className="fw-bold mb-0">3.7</h3>
                </div>
              </div>
            </div>
          </div>

          <div className="col-xl-3 col-sm-6">
            <div className="position-relative border card rounded-2 shadow-sm">
              <div className="card-body">
                <div className="d-flex align-items-center mb-2 justify-content-between">
                  <span className="avatar bg-info rounded-circle">
                    <i className="ti ti-checkbox fs-24" />
                  </span>
                  <div className="text-end">
                    <span className="badge px-2 py-1 fs-12 fw-medium d-inline-flex mb-1 bg-success">+2%</span>
                    <p className="fs-13 mb-0">This Month</p>
                  </div>
                </div>
                <div>
                  <p className="mb-1">Avg. Attendance</p>
                  <h3 className="fw-bold mb-0">87%</h3>
                </div>
              </div>
            </div>
          </div>

          <div className="col-xl-3 col-sm-6">
            <div className="position-relative border card rounded-2 shadow-sm">
              <div className="card-body">
                <div className="d-flex align-items-center mb-2 justify-content-between">
                  <span className="avatar bg-danger rounded-circle">
                    <i className="ti ti-cash fs-24" />
                  </span>
                  <div className="text-end">
                    <span className={`badge px-2 py-1 fs-12 fw-medium d-inline-flex mb-1 ${totalPendingOverdue > 0 ? "bg-danger" : "bg-success"}`}>
                      {totalPendingOverdue > 0 ? "Outstanding" : "All Paid"}
                    </span>
                    <p className="fs-13 mb-0">All Children</p>
                  </div>
                </div>
                <div>
                  <p className="mb-1">Fees Due</p>
                  <h3 className="fw-bold mb-0">
                    {feesLoading ? "…" : `$${totalPendingOverdue.toFixed(2)}`}
                  </h3>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Second Row */}
        <div className="row">
          {/* Children Overview */}
          <div className="col-xl-8">
            <div className="card shadow-sm flex-fill w-100">
              <div className="card-header d-flex align-items-center justify-content-between">
                <h5 className="fw-bold mb-0">Children Overview</h5>
                <Link href={all_routes.parentChildProgress} className="btn fw-normal btn-outline-white">
                  Detailed View
                </Link>
              </div>
              <div className="card-body">
                {/* Child 1 */}
                <div className="border rounded-2 p-3 mb-3">
                  <div className="d-flex align-items-center justify-content-between mb-3">
                    <div className="d-flex align-items-center">
                      <span className="avatar bg-primary-subtle text-primary rounded-circle fw-bold me-3 fs-18">E</span>
                      <div>
                        <h6 className="fs-15 fw-semibold mb-0">Emma Adams</h6>
                        <p className="mb-0 fs-13 text-muted">Grade 10 — Section A</p>
                      </div>
                    </div>
                    <span className="badge badge-soft-success border border-success fw-medium">GPA 3.8</span>
                  </div>
                  <div className="row g-2">
                    <div className="col-3 text-center">
                      <p className="mb-1 fs-12 text-muted">Courses</p>
                      <h6 className="fw-bold mb-0">5</h6>
                    </div>
                    <div className="col-3 text-center border-start">
                      <p className="mb-1 fs-12 text-muted">Attendance</p>
                      <h6 className="fw-bold mb-0 text-success">92%</h6>
                    </div>
                    <div className="col-3 text-center border-start">
                      <p className="mb-1 fs-12 text-muted">Assignments</p>
                      <h6 className="fw-bold mb-0 text-warning">2 Due</h6>
                    </div>
                    <div className="col-3 text-center border-start">
                      <p className="mb-1 fs-12 text-muted">Quizzes</p>
                      <h6 className="fw-bold mb-0 text-info">1 Soon</h6>
                    </div>
                  </div>
                  <div className="mt-3">
                    <p className="fs-13 mb-1 fw-medium">Overall Progress</p>
                    <div className="progress" style={{ height: 8 }}>
                      <div className="progress-bar bg-success" style={{ width: "88%" }} />
                    </div>
                  </div>
                </div>

                {/* Child 2 */}
                <div className="border rounded-2 p-3 mb-0">
                  <div className="d-flex align-items-center justify-content-between mb-3">
                    <div className="d-flex align-items-center">
                      <span className="avatar bg-info-subtle text-info rounded-circle fw-bold me-3 fs-18">B</span>
                      <div>
                        <h6 className="fs-15 fw-semibold mb-0">Brian Adams</h6>
                        <p className="mb-0 fs-13 text-muted">Grade 8 — Section B</p>
                      </div>
                    </div>
                    <span className="badge badge-soft-primary border border-primary fw-medium">GPA 3.5</span>
                  </div>
                  <div className="row g-2">
                    <div className="col-3 text-center">
                      <p className="mb-1 fs-12 text-muted">Courses</p>
                      <h6 className="fw-bold mb-0">4</h6>
                    </div>
                    <div className="col-3 text-center border-start">
                      <p className="mb-1 fs-12 text-muted">Attendance</p>
                      <h6 className="fw-bold mb-0 text-warning">81%</h6>
                    </div>
                    <div className="col-3 text-center border-start">
                      <p className="mb-1 fs-12 text-muted">Assignments</p>
                      <h6 className="fw-bold mb-0 text-danger">3 Due</h6>
                    </div>
                    <div className="col-3 text-center border-start">
                      <p className="mb-1 fs-12 text-muted">Quizzes</p>
                      <h6 className="fw-bold mb-0 text-info">1 Soon</h6>
                    </div>
                  </div>
                  <div className="mt-3">
                    <p className="fs-13 mb-1 fw-medium">Overall Progress</p>
                    <div className="progress" style={{ height: 8 }}>
                      <div className="progress-bar bg-primary" style={{ width: "78%" }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Upcoming Classes */}
          <div className="col-xl-4">
            <div className="card shadow-sm">
              <div className="card-header d-flex align-items-center justify-content-between">
                <h5 className="fw-bold mb-0">Today&apos;s Classes</h5>
                <Link href={all_routes.parentSchedule} className="btn fw-normal btn-outline-white">
                  Full View
                </Link>
              </div>
              <div className="card-body">
                {[
                  { subject: "Mathematics", child: "Emma", time: "09:00 AM", color: "primary" },
                  { subject: "Science Lab", child: "Emma", time: "11:00 AM", color: "info" },
                  { subject: "English", child: "Brian", time: "02:00 PM", color: "warning" },
                  { subject: "History", child: "Brian", time: "03:30 PM", color: "danger" },
                ].map((c, i) => (
                  <div key={i} className={`d-flex align-items-center justify-content-between ${i < 3 ? "mb-3" : "mb-0"}`}>
                    <div className="d-flex align-items-center">
                      <div className={`avatar bg-${c.color}-subtle rounded-circle me-2 d-flex align-items-center justify-content-center flex-shrink-0`}>
                        <i className={`ti ti-book text-${c.color}`} />
                      </div>
                      <div>
                        <h6 className="fs-14 fw-medium mb-0">{c.subject}</h6>
                        <p className="mb-0 fs-12 text-muted">{c.child} · {c.time}</p>
                      </div>
                    </div>
                    <span className={`badge badge-soft-${c.color} border border-${c.color} fw-medium flex-shrink-0`}>
                      Today
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Fee Status Row */}
        <div className="row">
          {/* Per-child fee breakdown */}
          <div className="col-xl-8 d-flex">
            <div className="card shadow-sm flex-fill w-100">
              <div className="card-header d-flex align-items-center justify-content-between">
                <h5 className="fw-bold mb-0">Fee Status</h5>
                <div className="d-flex gap-2">
                  <span className="badge badge-soft-success border border-success fw-medium fs-12"><i className="ti ti-circle-filled me-1 fs-10" />Paid</span>
                  <span className="badge badge-soft-danger border border-danger fw-medium fs-12"><i className="ti ti-circle-filled me-1 fs-10" />Overdue</span>
                  <span className="badge badge-soft-warning border border-warning fw-medium fs-12"><i className="ti ti-circle-filled me-1 fs-10" />Pending</span>
                </div>
              </div>
              <div className="card-body">
                {feesLoading ? (
                  <div className="text-center py-4">
                    <div className="spinner-border text-primary" />
                  </div>
                ) : children.length === 0 ? (
                  <p className="text-muted fs-13 text-center py-3">No children linked to this account.</p>
                ) : (
                  children.map((child, ci) => {
                    const paidAmt = child.fees.filter((f) => f.status === "paid").reduce((s, f) => s + Number(f.amount), 0);
                    const dueAmt = child.fees.filter((f) => f.status === "pending" || f.status === "overdue").reduce((s, f) => s + Number(f.amount), 0);
                    const totalAmt = child.fees.reduce((s, f) => s + Number(f.amount), 0);
                    const paidPct = totalAmt > 0 ? Math.round((paidAmt / totalAmt) * 100) : 0;
                    const avatarColors = ["primary", "info", "success", "warning", "danger"];
                    const aColor = avatarColors[ci % avatarColors.length];
                    return (
                      <div key={child.id} className={ci < children.length - 1 ? "mb-4" : "mb-0"}>
                        <div className="d-flex align-items-center justify-content-between mb-3">
                          <div className="d-flex align-items-center">
                            <span className={`avatar bg-${aColor}-subtle text-${aColor} rounded-circle fw-bold me-2 flex-shrink-0`}>
                              {child.firstName[0]}
                            </span>
                            <div>
                              <h6 className="fs-14 fw-semibold mb-0">{child.firstName} {child.lastName}</h6>
                              <p className="mb-0 fs-12 text-muted">{child.fees.length} fee record(s)</p>
                            </div>
                          </div>
                          <div className="text-end">
                            <p className="mb-0 fs-13 text-muted">
                              Paid: <span className="text-success fw-semibold">${paidAmt.toFixed(2)}</span>
                              &nbsp;|&nbsp;
                              Due: <span className="text-danger fw-semibold">${dueAmt.toFixed(2)}</span>
                            </p>
                            <div className="progress mt-1" style={{ height: 6, width: 160 }}>
                              <div className="progress-bar bg-success" style={{ width: `${paidPct}%` }} />
                            </div>
                          </div>
                        </div>
                        {child.fees.length === 0 ? (
                          <p className="text-muted fs-13 mb-0">No fees recorded.</p>
                        ) : (
                          <div className="table-responsive">
                            <table className="table table-sm border mb-0">
                              <thead className="table-light">
                                <tr>
                                  <th className="fs-13">Title</th>
                                  <th className="fs-13">Amount</th>
                                  <th className="fs-13">Due Date</th>
                                  <th className="fs-13">Status</th>
                                  <th className="fs-13">Invoice</th>
                                  <th className="fs-13">Payment Proof</th>
                                </tr>
                              </thead>
                              <tbody>
                                {child.fees.slice(0, 5).map((fee) => (
                                  <tr key={fee.id}>
                                    <td className="fs-13 fw-medium">{fee.title}</td>
                                    <td className="fs-13">${Number(fee.amount).toFixed(2)}</td>
                                    <td className="fs-13 text-muted">
                                      {fee.dueDate ? new Date(fee.dueDate).toLocaleDateString() : "—"}
                                    </td>
                                    <td>
                                      <span className={`badge badge-soft-${FEE_STATUS_COLOR[fee.status]} border border-${FEE_STATUS_COLOR[fee.status]} fw-medium fs-12`}>
                                        {fee.status.charAt(0).toUpperCase() + fee.status.slice(1)}
                                      </span>
                                    </td>
                                    <td>
                                      {fee.invoicePath ? (
                                        <a href={`${resolveImageUrl(fee.invoicePath)}`} target="_blank" rel="noreferrer" className="btn btn-sm btn-outline-success py-1 px-2 fs-12">
                                          <i className="ti ti-download me-1" />View
                                        </a>
                                      ) : (
                                        <span className="text-muted fs-12">—</span>
                                      )}
                                    </td>
                                    <td>
                                      {fee.proofPath ? (
                                        <a href={`${resolveImageUrl(fee.proofPath)}`} target="_blank" rel="noreferrer" className="btn btn-sm btn-outline-primary py-1 px-2 fs-12">
                                          <i className="ti ti-eye me-1" />View
                                        </a>
                                      ) : (fee.status === "pending" || fee.status === "overdue") ? (
                                        <button
                                          className="btn btn-sm btn-outline-warning py-1 px-2 fs-12"
                                          onClick={() => handleUploadProofClick(fee.id)}
                                          disabled={uploadingFeeId === fee.id}
                                        >
                                          {uploadingFeeId === fee.id ? (
                                            <span className="spinner-border spinner-border-sm" />
                                          ) : (
                                            <><i className="ti ti-upload me-1" />Upload</>
                                          )}
                                        </button>
                                      ) : (
                                        <span className="text-muted fs-12">—</span>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Fee Summary Card */}
          <div className="col-xl-4 d-flex">
            <div className="card shadow-sm flex-fill w-100">
              <div className="card-header">
                <h5 className="fw-bold mb-0">Payment Summary</h5>
              </div>
              <div className="card-body">
                {feesLoading ? (
                  <div className="text-center py-4"><div className="spinner-border text-primary" /></div>
                ) : (
                  <>
                    {/* Total overview */}
                    {(() => {
                      const totalAll = children.reduce((s, c) => s + c.fees.reduce((ss, f) => ss + Number(f.amount), 0), 0);
                      const totalPaid = children.reduce((s, c) => s + c.fees.filter((f) => f.status === "paid").reduce((ss, f) => ss + Number(f.amount), 0), 0);
                      const totalDue = totalAll - totalPaid;
                      const pct = totalAll > 0 ? Math.round((totalPaid / totalAll) * 100) : 0;
                      return (
                        <div className="bg-light border rounded-2 p-3 mb-3">
                          <div className="d-flex align-items-center justify-content-between mb-2">
                            <p className="mb-0 fs-13 text-muted">Total Fees</p>
                            <h6 className="fw-bold mb-0">${totalAll.toFixed(2)}</h6>
                          </div>
                          <div className="d-flex align-items-center justify-content-between mb-2">
                            <p className="mb-0 fs-13 text-muted">Total Paid</p>
                            <h6 className="fw-bold mb-0 text-success">${totalPaid.toFixed(2)}</h6>
                          </div>
                          <div className="d-flex align-items-center justify-content-between mb-3">
                            <p className="mb-0 fs-13 text-muted">Balance Due</p>
                            <h6 className={`fw-bold mb-0 ${totalDue > 0 ? "text-danger" : "text-success"}`}>${totalDue.toFixed(2)}</h6>
                          </div>
                          <div className="progress" style={{ height: 10 }}>
                            <div className="progress-bar bg-success" style={{ width: `${pct}%` }} />
                          </div>
                          <p className="mb-0 fs-12 text-muted mt-1 text-end">{pct}% paid</p>
                        </div>
                      );
                    })()}

                    {/* Per-child quick view */}
                    {children.map((child, ci) => {
                      const due = child.fees.filter((f) => f.status === "pending" || f.status === "overdue").reduce((s, f) => s + Number(f.amount), 0);
                      const hasOverdue = child.fees.some((f) => f.status === "overdue");
                      const avatarColors = ["primary", "info", "success", "warning"];
                      const aColor = avatarColors[ci % avatarColors.length];
                      return (
                        <div key={child.id} className="d-flex align-items-center justify-content-between mb-3">
                          <div className="d-flex align-items-center">
                            <span className={`avatar bg-${aColor}-subtle text-${aColor} rounded-circle fw-bold me-2 flex-shrink-0`} style={{ width: 32, height: 32, fontSize: 13 }}>
                              {child.firstName[0]}
                            </span>
                            <p className="mb-0 fs-13 fw-medium">{child.firstName}</p>
                          </div>
                          <div className="text-end">
                            {due > 0 ? (
                              <span className={`badge badge-soft-${hasOverdue ? "danger" : "warning"} border border-${hasOverdue ? "danger" : "warning"} fw-medium`}>
                                ${due.toFixed(2)} {hasOverdue ? "Overdue" : "Pending"}
                              </span>
                            ) : (
                              <span className="badge badge-soft-success border border-success fw-medium">All Paid</span>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {totalPendingOverdue > 0 && (
                      <div className="alert alert-danger py-2 mt-2 mb-0 fs-13">
                        <i className="ti ti-alert-triangle me-1" />
                        <strong>${totalPendingOverdue.toFixed(2)}</strong> outstanding across all children
                      </div>
                    )}
                    {totalPendingOverdue === 0 && children.length > 0 && (
                      <div className="text-center mt-2">
                        <span className="badge badge-soft-success border border-success px-3 py-2 fs-13">
                          <i className="ti ti-circle-check me-1" /> No Outstanding Fees
                        </span>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Third Row */}
        <div className="row">
          {/* Grade Summary */}
          <div className="col-xl-4 d-flex">
            <div className="card shadow-sm flex-fill w-100">
              <div className="card-header">
                <h5 className="fw-bold mb-0">Grade Summary</h5>
              </div>
              <div className="card-body">
                <p className="fs-13 fw-semibold text-muted mb-2">Emma Adams — Grade 10</p>
                {[
                  { subject: "Mathematics", grade: "A", color: "success" },
                  { subject: "Science", grade: "B+", color: "primary" },
                  { subject: "English", grade: "A-", color: "info" },
                ].map((g, i) => (
                  <div key={i} className="d-flex align-items-center justify-content-between mb-2">
                    <p className="fs-13 mb-0">{g.subject}</p>
                    <span className={`badge fw-bold badge-soft-${g.color} border border-${g.color}`}>{g.grade}</span>
                  </div>
                ))}
                <hr className="my-2" />
                <p className="fs-13 fw-semibold text-muted mb-2">Brian Adams — Grade 8</p>
                {[
                  { subject: "Mathematics", grade: "B", color: "warning" },
                  { subject: "Science", grade: "B+", color: "primary" },
                  { subject: "English", grade: "A", color: "success" },
                ].map((g, i) => (
                  <div key={i} className="d-flex align-items-center justify-content-between mb-2">
                    <p className="fs-13 mb-0">{g.subject}</p>
                    <span className={`badge fw-bold badge-soft-${g.color} border border-${g.color}`}>{g.grade}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Attendance per Child */}
          <div className="col-xl-4 col-lg-6 d-flex">
            <div className="card shadow-sm flex-fill w-100">
              <div className="card-header d-flex align-items-center justify-content-between">
                <h5 className="fw-bold mb-0">Attendance</h5>
                <Link href={all_routes.parentAttendance} className="btn fw-normal btn-outline-white">
                  View All
                </Link>
              </div>
              <div className="card-body">
                <p className="fs-13 fw-semibold text-muted mb-3">Emma Adams — 92%</p>
                {[
                  { course: "Mathematics", pct: 95 },
                  { course: "Science", pct: 90 },
                  { course: "English", pct: 88 },
                ].map((c, i) => (
                  <div key={i} className="mb-3">
                    <div className="d-flex justify-content-between mb-1">
                      <p className="fs-13 mb-0">{c.course}</p>
                      <p className="fs-13 mb-0 text-muted">{c.pct}%</p>
                    </div>
                    <div className="progress" style={{ height: 6 }}>
                      <div className="progress-bar bg-success" style={{ width: `${c.pct}%` }} />
                    </div>
                  </div>
                ))}
                <hr className="my-2" />
                <p className="fs-13 fw-semibold text-muted mb-3">Brian Adams — 81%</p>
                {[
                  { course: "Mathematics", pct: 80 },
                  { course: "Science", pct: 83 },
                  { course: "English", pct: 79 },
                ].map((c, i) => (
                  <div key={i} className="mb-2">
                    <div className="d-flex justify-content-between mb-1">
                      <p className="fs-13 mb-0">{c.course}</p>
                      <p className="fs-13 mb-0 text-muted">{c.pct}%</p>
                    </div>
                    <div className="progress" style={{ height: 6 }}>
                      <div className="progress-bar bg-warning" style={{ width: `${c.pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="col-xl-4 col-lg-6 d-flex">
            <div className="card shadow-sm flex-fill w-100">
              <div className="card-header">
                <h5 className="fw-bold mb-0">Quick Actions</h5>
              </div>
              <div className="card-body">
                <div className="row g-3">
                  {[
                    { icon: "ti-trending-up", label: "Child Progress", href: all_routes.parentChildProgress, color: "primary" },
                    { icon: "ti-calendar", label: "Schedule", href: all_routes.parentSchedule, color: "success" },
                    { icon: "ti-checkbox", label: "Attendance", href: all_routes.parentAttendance, color: "info" },
                    { icon: "ti-speakerphone", label: "Announcements", href: all_routes.parentAnnouncements, color: "warning" },
                    { icon: "ti-message-circle", label: "Chat", href: "/application/chat", color: "danger" },
                    { icon: "ti-user", label: "My Profile", href: all_routes.parentProfile, color: "secondary" },
                  ].map((item, i) => (
                    <div key={i} className="col-6">
                      <Link
                        href={item.href}
                        className={`d-flex flex-column align-items-center justify-content-center p-3 rounded-2 border bg-${item.color}-subtle text-${item.color} text-decoration-none`}
                      >
                        <i className={`${item.icon} fs-24 mb-2`} />
                        <span className="fs-13 fw-medium">{item.label}</span>
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Hidden file input for proof upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,application/pdf"
        className="d-none"
        onChange={handleFileChange}
      />
    </div>
  );
};

export default ParentDashboard;
