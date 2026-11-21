"use client";

import { useEffect, useState } from "react";
import { Select } from "antd";
import { getAllFAQs, createFAQ, updateFAQ, deleteFAQ } from "@/services/faqService";
import { FAQ } from "@/types/faq";
import { usePermissionGuard } from "@/lib/usePermissionGuard";
import { PERMISSIONS } from "@/lib/permissions";

const CATEGORIES = ["General", "Courses", "Assignments", "Schedule", "Attendance", "Fees", "Technical", "Other"];

interface FAQModalProps {
  faq: FAQ | null;
  onClose: () => void;
  onSaved: (f: FAQ) => void;
}

const FAQModal = ({ faq, onClose, onSaved }: FAQModalProps) => {
  const isEdit = !!faq;
  const [form, setForm] = useState({
    question: faq?.question ?? "",
    answer: faq?.answer ?? "",
    category: faq?.category ?? "General",
    isPublished: faq?.isPublished ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    if (!form.question.trim()) { setError("Question is required."); return; }
    if (!form.answer.trim()) { setError("Answer is required."); return; }
    setSaving(true);
    try {
      const saved = isEdit
        ? await updateFAQ(faq!.id, form)
        : await createFAQ(form);
      onSaved(saved);
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
            <h5 className="modal-title fw-bold">{isEdit ? "Edit FAQ" : "Add New FAQ"}</h5>
            <button className="btn-close" onClick={onClose} />
          </div>
          <div className="modal-body">
            <div className="mb-3">
              <label className="form-label">Question <span className="text-danger">*</span></label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. How do I join a live class?"
                value={form.question}
                onChange={(e) => { setForm({ ...form, question: e.target.value }); setError(""); }}
              />
            </div>
            <div className="mb-3">
              <label className="form-label">Answer <span className="text-danger">*</span></label>
              <textarea
                className="form-control"
                rows={4}
                placeholder="Provide a clear, helpful answer..."
                value={form.answer}
                onChange={(e) => { setForm({ ...form, answer: e.target.value }); setError(""); }}
              />
            </div>
            <div className="row g-3">
              <div className="col-sm-6">
                <label className="form-label">Category</label>
                <select
                  className="form-select"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                >
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="col-sm-6 d-flex align-items-end">
                <div className="form-check form-switch mb-1">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="publishSwitch"
                    checked={form.isPublished}
                    onChange={(e) => setForm({ ...form, isPublished: e.target.checked })}
                  />
                  <label className="form-check-label" htmlFor="publishSwitch">
                    Published (visible to users)
                  </label>
                </div>
              </div>
            </div>
            {error && <div className="text-danger small mt-2">{error}</div>}
          </div>
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : isEdit ? "Save Changes" : "Add FAQ"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const AdminFAQPage = () => {
  usePermissionGuard(PERMISSIONS.FAQ_MANAGE);

  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [modalTarget, setModalTarget] = useState<FAQ | "new" | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FAQ | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await getAllFAQs();
      setFaqs(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleSaved = (saved: FAQ) => {
    setFaqs((prev) => {
      const exists = prev.find((f) => f.id === saved.id);
      return exists ? prev.map((f) => f.id === saved.id ? saved : f) : [saved, ...prev];
    });
    setModalTarget(null);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteFAQ(deleteTarget.id);
      setFaqs((prev) => prev.filter((f) => f.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setDeleting(false);
    }
  };

  const togglePublish = async (faq: FAQ) => {
    try {
      const updated = await updateFAQ(faq.id, { isPublished: !faq.isPublished });
      setFaqs((prev) => prev.map((f) => f.id === updated.id ? updated : f));
    } catch (e: any) {
      alert(e.message);
    }
  };

  const categories = ["all", ...Array.from(new Set(faqs.map((f) => f.category)))];

  const filtered = faqs.filter((f) => {
    if (filterCategory !== "all" && f.category !== filterCategory) return false;
    if (filterStatus === "published" && !f.isPublished) return false;
    if (filterStatus === "draft" && f.isPublished) return false;
    if (search && !f.question.toLowerCase().includes(search.toLowerCase()) &&
        !f.answer.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="page-wrapper">
      <div className="content">
        {/* Header */}
        <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 pb-3 mb-3 border-bottom">
          <div>
            <h4 className="fw-bold mb-1">FAQ Management</h4>
            <p className="text-muted mb-0 small">Create and manage frequently asked questions visible to students and teachers</p>
          </div>
          <button className="btn btn-primary" onClick={() => setModalTarget("new")}>
            <i className="ti ti-plus me-1" />
            Add New FAQ
          </button>
        </div>

        {/* Stats */}
        <div className="row g-3 mb-4">
          {[
            { label: "Total", value: faqs.length, color: "primary" },
            { label: "Published", value: faqs.filter((f) => f.isPublished).length, color: "success" },
            { label: "Draft", value: faqs.filter((f) => !f.isPublished).length, color: "secondary" },
            { label: "Categories", value: new Set(faqs.map((f) => f.category)).size, color: "info" },
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
                  style={{ width: 240 }}
                  placeholder="Search questions or answers..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
            <div className="col-md-auto">
              <div className="sf-filter-item">
                <label>Category</label>
                <Select
                  size="large"
                  style={{ minWidth: 170 }}
                  value={filterCategory}
                  onChange={(v) => setFilterCategory(v)}
                  options={categories.map((c) => ({ value: c, label: c === "all" ? "All Categories" : c }))}
                  suffixIcon={<i className="ti ti-category" />}
                />
              </div>
            </div>
            <div className="col-md-auto">
              <div className="sf-filter-item">
                <label>Status</label>
                <Select
                  size="large"
                  style={{ minWidth: 150 }}
                  value={filterStatus}
                  onChange={(v) => setFilterStatus(v)}
                  options={[
                    { value: "all", label: "All Status" },
                    { value: "published", label: "Published" },
                    { value: "draft", label: "Draft" },
                  ]}
                  suffixIcon={<i className="ti ti-toggle-right" />}
                />
              </div>
            </div>
            {(search || filterCategory !== "all" || filterStatus !== "all") && (
              <div className="col-md-auto">
                <div className="sf-filter-item">
                  <label>&nbsp;</label>
                  <button
                    type="button"
                    className="btn filter-panel-clear-btn"
                    onClick={() => {
                      setSearch("");
                      setFilterCategory("all");
                      setFilterStatus("all");
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
          <div className="text-center py-5 text-muted">No FAQs found. Click &quot;Add New FAQ&quot; to create one.</div>
        ) : (
          <div className="table-responsive">
            <table className="table table-hover align-middle">
              <thead className="table-light">
                <tr>
                  <th style={{ width: "35%" }}>Question</th>
                  <th>Answer</th>
                  <th>Category</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((f) => (
                  <tr key={f.id}>
                    <td className="fw-medium">{f.question}</td>
                    <td className="text-muted small" style={{ maxWidth: 300 }}>
                      <span title={f.answer}>
                        {f.answer.length > 100 ? f.answer.slice(0, 100) + "..." : f.answer}
                      </span>
                    </td>
                    <td>
                      <span className="badge bg-soft-primary text-primary border border-primary fw-medium">
                        {f.category}
                      </span>
                    </td>
                    <td>
                      <div className="form-check form-switch mb-0" title={f.isPublished ? "Click to unpublish" : "Click to publish"}>
                        <input
                          className="form-check-input"
                          type="checkbox"
                          checked={f.isPublished}
                          onChange={() => togglePublish(f)}
                        />
                        <label className={`form-check-label small ${f.isPublished ? "text-success" : "text-muted"}`}>
                          {f.isPublished ? "Published" : "Draft"}
                        </label>
                      </div>
                    </td>
                    <td>
                      <div className="d-flex gap-1">
                        <button
                          className="btn btn-sm btn-outline-primary"
                          title="Edit"
                          onClick={() => setModalTarget(f)}
                        >
                          <i className="ti ti-edit" />
                        </button>
                        <button
                          className="btn btn-sm btn-outline-danger"
                          title="Delete"
                          onClick={() => setDeleteTarget(f)}
                        >
                          <i className="ti ti-trash" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Add/Edit Modal */}
        {modalTarget !== null && (
          <FAQModal
            faq={modalTarget === "new" ? null : modalTarget}
            onClose={() => setModalTarget(null)}
            onSaved={handleSaved}
          />
        )}

        {/* Delete Confirm */}
        {deleteTarget && (
          <div className="modal fade show d-block" style={{ background: "rgba(0,0,0,0.5)" }}>
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title fw-bold">Delete FAQ</h5>
                  <button className="btn-close" onClick={() => setDeleteTarget(null)} />
                </div>
                <div className="modal-body">
                  Delete FAQ: <strong>&quot;{deleteTarget.question}&quot;</strong>? This cannot be undone.
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

export default AdminFAQPage;
