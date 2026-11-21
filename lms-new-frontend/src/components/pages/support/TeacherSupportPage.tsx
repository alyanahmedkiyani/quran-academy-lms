"use client";

import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import {
  getSupportRequestsByUser,
  createSupportRequest,
  deleteSupportRequest,
} from "@/services/supportService";
import { SupportRequest, SupportPriority, SupportStatus } from "@/types/support";

const PRIORITY_COLORS: Record<SupportPriority, string> = {
  high: "danger",
  medium: "warning",
  normal: "success",
};
const STATUS_COLORS: Record<SupportStatus, string> = {
  pending: "warning",
  resolved: "success",
  rejected: "danger",
};

const fmtDate = (d: string) => new Date(d).toLocaleDateString();

const TeacherSupportPage = () => {
  const user = useSelector((state: any) => state.auth?.user);

  const [requests, setRequests] = useState<SupportRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [viewTarget, setViewTarget] = useState<SupportRequest | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SupportRequest | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const [form, setForm] = useState({ title: "", problem: "", priority: "normal" as SupportPriority });

  const load = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const data = await getSupportRequestsByUser(user.id, "teacher");
      setRequests(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [user?.id]);

  const handleSubmit = async () => {
    if (!form.title.trim()) { setFormError("Title is required."); return; }
    if (!form.problem.trim()) { setFormError("Problem description is required."); return; }
    setSubmitting(true);
    try {
      const created = await createSupportRequest({
        title: form.title,
        problem: form.problem,
        priority: form.priority,
        userId: user.id,
        userType: "teacher",
      });
      setRequests((prev) => [created, ...prev]);
      setForm({ title: "", problem: "", priority: "normal" });
      setShowForm(false);
      setFormError("");
    } catch (e: any) {
      setFormError(e.message ?? "Failed to submit.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteSupportRequest(deleteTarget.id);
      setRequests((prev) => prev.filter((r) => r.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="page-wrapper">
      <div className="content">
        {/* Header */}
        <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 pb-3 mb-4 border-bottom">
          <div>
            <h4 className="fw-bold mb-1">Help & Support</h4>
            <p className="text-muted mb-0 small">Submit a support request and track its status</p>
          </div>
          <button className="btn btn-primary" onClick={() => { setShowForm(true); setFormError(""); }}>
            <i className="ti ti-plus me-1" />
            New Request
          </button>
        </div>

        {/* New Request Form (inline) */}
        {showForm && (
          <div className="card mb-4 border-0 shadow-sm">
            <div className="card-header bg-white fw-semibold">New Support Request</div>
            <div className="card-body">
              <div className="mb-3">
                <label className="form-label">Title <span className="text-danger">*</span></label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Brief title of your issue"
                  value={form.title}
                  onChange={(e) => { setForm({ ...form, title: e.target.value }); setFormError(""); }}
                />
              </div>
              <div className="mb-3">
                <label className="form-label">Problem Description <span className="text-danger">*</span></label>
                <textarea
                  className="form-control"
                  rows={4}
                  placeholder="Describe your issue in detail..."
                  value={form.problem}
                  onChange={(e) => { setForm({ ...form, problem: e.target.value }); setFormError(""); }}
                />
              </div>
              <div className="mb-3">
                <label className="form-label">Priority</label>
                <select
                  className="form-select"
                  style={{ maxWidth: 200 }}
                  value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: e.target.value as SupportPriority })}
                >
                  <option value="normal">Normal</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
              {formError && <div className="text-danger small mb-2">{formError}</div>}
              <div className="d-flex gap-2">
                <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting}>
                  {submitting ? "Submitting..." : "Submit Request"}
                </button>
                <button className="btn btn-secondary" onClick={() => { setShowForm(false); setFormError(""); }}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Requests List */}
        {loading ? (
          <div className="text-center py-5 text-muted">Loading...</div>
        ) : error ? (
          <div className="alert alert-danger">{error}</div>
        ) : requests.length === 0 ? (
          <div className="text-center py-5">
            <i className="ti ti-help-circle fs-1 text-muted d-block mb-2" />
            <p className="text-muted">No support requests yet. Click &quot;New Request&quot; to get help.</p>
          </div>
        ) : (
          <div className="row g-3">
            {requests.map((r) => (
              <div key={r.id} className="col-12">
                <div className="card border-0 shadow-sm">
                  <div className="card-body">
                    <div className="d-flex align-items-start justify-content-between gap-2">
                      <div className="flex-grow-1">
                        <div className="d-flex align-items-center gap-2 mb-1 flex-wrap">
                          <h6 className="mb-0 fw-semibold">{r.title}</h6>
                          <span className={`badge bg-soft-${PRIORITY_COLORS[r.priority]} text-${PRIORITY_COLORS[r.priority]} border border-${PRIORITY_COLORS[r.priority]}`}>
                            {r.priority}
                          </span>
                          <span className={`badge bg-soft-${STATUS_COLORS[r.status]} text-${STATUS_COLORS[r.status]} border border-${STATUS_COLORS[r.status]}`}>
                            {r.status}
                          </span>
                        </div>
                        <p className="text-muted small mb-2" style={{ maxWidth: 600 }}>
                          {r.problem.length > 120 ? r.problem.slice(0, 120) + "..." : r.problem}
                        </p>
                        <div className="text-muted" style={{ fontSize: 12 }}>Submitted {fmtDate(r.createdAt)}</div>
                        {r.responseFromAdmin && (
                          <div className="alert alert-info mt-2 mb-0 py-2 px-3 small">
                            <strong>Admin Response:</strong> {r.responseFromAdmin}
                          </div>
                        )}
                      </div>
                      <div className="d-flex gap-1 flex-shrink-0">
                        <button className="btn btn-sm btn-outline-primary" onClick={() => setViewTarget(r)} title="View">
                          <i className="ti ti-eye" />
                        </button>
                        {r.status === "pending" && (
                          <button className="btn btn-sm btn-outline-danger" onClick={() => setDeleteTarget(r)} title="Delete">
                            <i className="ti ti-trash" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* View Modal */}
        {viewTarget && (
          <div
            className="modal fade show d-block"
            style={{ background: "rgba(0,0,0,0.5)" }}
            onClick={(e) => { if (e.target === e.currentTarget) setViewTarget(null); }}
          >
            <div className="modal-dialog modal-lg modal-dialog-centered">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title fw-bold">{viewTarget.title}</h5>
                  <button className="btn-close" onClick={() => setViewTarget(null)} />
                </div>
                <div className="modal-body">
                  <div className="d-flex gap-2 mb-3 flex-wrap">
                    <span className={`badge bg-soft-${PRIORITY_COLORS[viewTarget.priority]} text-${PRIORITY_COLORS[viewTarget.priority]} border border-${PRIORITY_COLORS[viewTarget.priority]}`}>
                      Priority: {viewTarget.priority}
                    </span>
                    <span className={`badge bg-soft-${STATUS_COLORS[viewTarget.status]} text-${STATUS_COLORS[viewTarget.status]} border border-${STATUS_COLORS[viewTarget.status]}`}>
                      Status: {viewTarget.status}
                    </span>
                    <span className="text-muted small">Submitted: {fmtDate(viewTarget.createdAt)}</span>
                  </div>
                  <div className="mb-3">
                    <div className="fw-semibold text-muted small mb-1">Your Problem</div>
                    <p style={{ whiteSpace: "pre-wrap" }}>{viewTarget.problem}</p>
                  </div>
                  {viewTarget.responseFromAdmin ? (
                    <div className="alert alert-success">
                      <div className="fw-semibold mb-1">Admin Response</div>
                      <p className="mb-0" style={{ whiteSpace: "pre-wrap" }}>{viewTarget.responseFromAdmin}</p>
                    </div>
                  ) : (
                    <div className="alert alert-warning">
                      <i className="ti ti-clock me-2" />
                      Awaiting admin response...
                    </div>
                  )}
                </div>
                <div className="modal-footer">
                  <button className="btn btn-secondary" onClick={() => setViewTarget(null)}>Close</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirm */}
        {deleteTarget && (
          <div className="modal fade show d-block" style={{ background: "rgba(0,0,0,0.5)" }}>
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title fw-bold">Delete Request</h5>
                  <button className="btn-close" onClick={() => setDeleteTarget(null)} />
                </div>
                <div className="modal-body">
                  Delete <strong>&quot;{deleteTarget.title}&quot;</strong>? This cannot be undone.
                </div>
                <div className="modal-footer">
                  <button className="btn btn-secondary" onClick={() => setDeleteTarget(null)}>Cancel</button>
                  <button className="btn btn-danger" onClick={handleDelete} disabled={deleting}>
                    {deleting ? "Deleting..." : "Delete"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TeacherSupportPage;
