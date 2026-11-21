"use client";

import { useEffect, useState } from "react";
import { Select } from "antd";
import { useSelector } from "react-redux";
import {
  getAllSupportRequests,
  updateSupportRequest,
  deleteSupportRequest,
} from "@/services/supportService";
import { SupportRequest, SupportStatus, SupportPriority } from "@/types/support";
import { media_base_url } from "@/environment";
import { usePermissionGuard } from "@/lib/usePermissionGuard";
import { PERMISSIONS } from "@/lib/permissions";

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

interface RespondModalProps {
  request: SupportRequest;
  onClose: () => void;
  onSaved: (r: SupportRequest) => void;
}

const RespondModal = ({ request, onClose, onSaved }: RespondModalProps) => {
  const [response, setResponse] = useState(request.responseFromAdmin ?? "");
  const [status, setStatus] = useState<SupportStatus>(request.status);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    if (!response.trim()) { setError("Response cannot be empty."); return; }
    setSaving(true);
    try {
      const updated = await updateSupportRequest(request.id, { responseFromAdmin: response, status });
      onSaved(updated);
    } catch (e: any) {
      setError(e.message ?? "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="modal fade show d-block"
      style={{ background: "rgba(0,0,0,0.5)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="modal-dialog modal-lg modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title fw-bold">Respond to Request</h5>
            <button className="btn-close" onClick={onClose} />
          </div>
          <div className="modal-body">
            <div className="mb-3">
              <label className="form-label fw-semibold">Title</label>
              <p className="mb-0 text-muted">{request.title}</p>
            </div>
            <div className="mb-3">
              <label className="form-label fw-semibold">Problem</label>
              <p className="mb-0 text-muted" style={{ whiteSpace: "pre-wrap" }}>{request.problem}</p>
            </div>
            <div className="mb-3">
              <label className="form-label fw-semibold">Admin Response</label>
              <textarea
                className="form-control"
                rows={4}
                value={response}
                onChange={(e) => { setResponse(e.target.value); setError(""); }}
                placeholder="Write your response..."
              />
              {error && <div className="text-danger small mt-1">{error}</div>}
            </div>
            <div className="mb-3">
              <label className="form-label fw-semibold">Update Status</label>
              <select
                className="form-select"
                value={status}
                onChange={(e) => setStatus(e.target.value as SupportStatus)}
              >
                <option value="pending">Pending</option>
                <option value="resolved">Resolved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save Response"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const AdminSupportPage = () => {
  usePermissionGuard(PERMISSIONS.SUPPORT_VIEW);

  const [requests, setRequests] = useState<SupportRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | SupportStatus>("all");
  const [filterPriority, setFilterPriority] = useState<"all" | SupportRequest["priority"]>("all");
  const [search, setSearch] = useState("");
  const [respondTarget, setRespondTarget] = useState<SupportRequest | null>(null);
  const [viewTarget, setViewTarget] = useState<SupportRequest | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SupportRequest | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await getAllSupportRequests();
      setRequests(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleDeleted = async () => {
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

  const handleSaved = (updated: SupportRequest) => {
    setRequests((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    setRespondTarget(null);
  };

  const getDisplayName = (r: SupportRequest) => {
    if (r.userType === "student" && r.student) return `${r.student.firstName} ${r.student.lastName}`;
    if (r.userType === "teacher" && r.teacher) return `${r.teacher.firstName} ${r.teacher.lastName}`;
    return `User #${r.userId}`;
  };

  const getAvatar = (r: SupportRequest) => {
    const img = r.userType === "student" ? r.student?.profileImg : r.teacher?.imageUrl;
    if (img) return `${media_base_url}/${img}`;
    return null;
  };

  const filtered = requests.filter((r) => {
    if (filterStatus !== "all" && r.status !== filterStatus) return false;
    if (filterPriority !== "all" && r.priority !== filterPriority) return false;
    if (search && !r.title.toLowerCase().includes(search.toLowerCase()) &&
        !getDisplayName(r).toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const counts = {
    total: requests.length,
    pending: requests.filter((r) => r.status === "pending").length,
    resolved: requests.filter((r) => r.status === "resolved").length,
    rejected: requests.filter((r) => r.status === "rejected").length,
  };

  return (
    <div className="page-wrapper">
      <div className="content">
        {/* Header */}
        <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 pb-3 mb-3 border-bottom">
          <div>
            <h4 className="fw-bold mb-1">Support Requests</h4>
            <p className="text-muted mb-0 small">Manage help requests from teachers and students</p>
          </div>
        </div>

        {/* Summary cards */}
        <div className="row g-3 mb-4">
          {[
            { label: "Total", value: counts.total, color: "primary" },
            { label: "Pending", value: counts.pending, color: "warning" },
            { label: "Resolved", value: counts.resolved, color: "success" },
            { label: "Rejected", value: counts.rejected, color: "danger" },
          ].map((c) => (
            <div key={c.label} className="col-6 col-md-3">
              <div className={`card border-0 bg-soft-${c.color} text-center p-3`}>
                <div className={`fw-bold fs-4 text-${c.color}`}>{c.value}</div>
                <div className="text-muted small">{c.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="filter-panel-box mb-3">
          <div className="filter-panel-heading">
            <i className="ti ti-filter" />
            <span className="filter-panel-title">Filter by</span>
          </div>
          <div className="row g-3 align-items-end">
            <div className="col-md-auto">
              <div className="sf-filter-item">
                <label>Search</label>
                <input
                  type="text"
                  className="form-control"
                  style={{ width: 220 }}
                  placeholder="Search by title or user..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
            <div className="col-md-auto">
              <div className="sf-filter-item">
                <label>Status</label>
                <Select
                  size="large"
                  style={{ minWidth: 160 }}
                  value={filterStatus}
                  onChange={(v) => setFilterStatus(v)}
                  options={[
                    { value: "all", label: "All Status" },
                    { value: "pending", label: "Pending" },
                    { value: "resolved", label: "Resolved" },
                    { value: "rejected", label: "Rejected" },
                  ]}
                  suffixIcon={<i className="ti ti-progress-check" />}
                />
              </div>
            </div>
            <div className="col-md-auto">
              <div className="sf-filter-item">
                <label>Priority</label>
                <Select
                  size="large"
                  style={{ minWidth: 160 }}
                  value={filterPriority}
                  onChange={(v) => setFilterPriority(v)}
                  options={[
                    { value: "all", label: "All Priority" },
                    { value: "high", label: "High" },
                    { value: "medium", label: "Medium" },
                    { value: "normal", label: "Normal" },
                  ]}
                  suffixIcon={<i className="ti ti-flag" />}
                />
              </div>
            </div>
            {(search || filterStatus !== "all" || filterPriority !== "all") && (
              <div className="col-md-auto">
                <div className="sf-filter-item">
                  <label>&nbsp;</label>
                  <button
                    type="button"
                    className="btn filter-panel-clear-btn"
                    onClick={() => {
                      setSearch("");
                      setFilterStatus("all");
                      setFilterPriority("all");
                    }}
                  >
                    <i className="ti ti-x fs-12" />
                    Clear all
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="text-center py-5 text-muted">Loading...</div>
        ) : error ? (
          <div className="alert alert-danger">{error}</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-5 text-muted">No support requests found.</div>
        ) : (
          <div className="table-responsive">
            <table className="table table-hover align-middle">
              <thead className="table-light">
                <tr>
                  <th>User</th>
                  <th>Title</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const avatar = getAvatar(r);
                  return (
                    <tr key={r.id}>
                      <td>
                        <div className="d-flex align-items-center gap-2">
                          {avatar ? (
                            <img src={avatar} alt="" className="rounded-circle" width={34} height={34} style={{ objectFit: "cover" }} />
                          ) : (
                            <div className="rounded-circle bg-secondary d-flex align-items-center justify-content-center text-white" style={{ width: 34, height: 34, fontSize: 13 }}>
                              {getDisplayName(r).charAt(0)}
                            </div>
                          )}
                          <div>
                            <div className="fw-medium small">{getDisplayName(r)}</div>
                            <div className="text-muted" style={{ fontSize: 11 }}>{r.userType}</div>
                          </div>
                        </div>
                      </td>
                      <td className="fw-medium">{r.title}</td>
                      <td>
                        <span className={`badge bg-soft-${PRIORITY_COLORS[r.priority]} text-${PRIORITY_COLORS[r.priority]} border border-${PRIORITY_COLORS[r.priority]} fw-medium`}>
                          {r.priority.charAt(0).toUpperCase() + r.priority.slice(1)}
                        </span>
                      </td>
                      <td>
                        <span className={`badge bg-soft-${STATUS_COLORS[r.status]} text-${STATUS_COLORS[r.status]} border border-${STATUS_COLORS[r.status]} fw-medium`}>
                          {r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                        </span>
                      </td>
                      <td className="text-muted small">{fmtDate(r.createdAt)}</td>
                      <td>
                        <div className="d-flex gap-1">
                          <button
                            className="btn btn-sm btn-outline-primary"
                            title="View"
                            onClick={() => setViewTarget(r)}
                          >
                            <i className="ti ti-eye" />
                          </button>
                          <button
                            className="btn btn-sm btn-outline-success"
                            title="Respond"
                            onClick={() => setRespondTarget(r)}
                          >
                            <i className="ti ti-message-reply" />
                          </button>
                          <button
                            className="btn btn-sm btn-outline-danger"
                            title="Delete"
                            onClick={() => setDeleteTarget(r)}
                          >
                            <i className="ti ti-trash" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
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
                  <div className="row mb-3">
                    <div className="col-sm-4 text-muted">Submitted by</div>
                    <div className="col-sm-8 fw-medium">{getDisplayName(viewTarget)} ({viewTarget.userType})</div>
                  </div>
                  <div className="row mb-3">
                    <div className="col-sm-4 text-muted">Priority</div>
                    <div className="col-sm-8">
                      <span className={`badge bg-soft-${PRIORITY_COLORS[viewTarget.priority]} text-${PRIORITY_COLORS[viewTarget.priority]} border border-${PRIORITY_COLORS[viewTarget.priority]}`}>
                        {viewTarget.priority}
                      </span>
                    </div>
                  </div>
                  <div className="row mb-3">
                    <div className="col-sm-4 text-muted">Status</div>
                    <div className="col-sm-8">
                      <span className={`badge bg-soft-${STATUS_COLORS[viewTarget.status]} text-${STATUS_COLORS[viewTarget.status]} border border-${STATUS_COLORS[viewTarget.status]}`}>
                        {viewTarget.status}
                      </span>
                    </div>
                  </div>
                  <div className="row mb-3">
                    <div className="col-sm-4 text-muted">Date</div>
                    <div className="col-sm-8">{fmtDate(viewTarget.createdAt)}</div>
                  </div>
                  <hr />
                  <div className="mb-3">
                    <div className="text-muted small fw-semibold mb-1">Problem Description</div>
                    <p style={{ whiteSpace: "pre-wrap" }}>{viewTarget.problem}</p>
                  </div>
                  {viewTarget.responseFromAdmin && (
                    <div className="alert alert-info mb-0">
                      <div className="fw-semibold mb-1">Admin Response</div>
                      <p className="mb-0" style={{ whiteSpace: "pre-wrap" }}>{viewTarget.responseFromAdmin}</p>
                    </div>
                  )}
                </div>
                <div className="modal-footer">
                  <button className="btn btn-secondary" onClick={() => setViewTarget(null)}>Close</button>
                  <button className="btn btn-primary" onClick={() => { setRespondTarget(viewTarget); setViewTarget(null); }}>
                    Respond
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Respond Modal */}
        {respondTarget && (
          <RespondModal
            request={respondTarget}
            onClose={() => setRespondTarget(null)}
            onSaved={handleSaved}
          />
        )}

        {/* Delete Confirm Modal */}
        {deleteTarget && (
          <div className="modal fade show d-block" style={{ background: "rgba(0,0,0,0.5)" }}>
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title fw-bold">Delete Request</h5>
                  <button className="btn-close" onClick={() => setDeleteTarget(null)} />
                </div>
                <div className="modal-body">
                  Are you sure you want to delete the request <strong>&quot;{deleteTarget.title}&quot;</strong>?
                </div>
                <div className="modal-footer">
                  <button className="btn btn-secondary" onClick={() => setDeleteTarget(null)}>Cancel</button>
                  <button className="btn btn-danger" onClick={handleDeleted} disabled={deleting}>
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

export default AdminSupportPage;
