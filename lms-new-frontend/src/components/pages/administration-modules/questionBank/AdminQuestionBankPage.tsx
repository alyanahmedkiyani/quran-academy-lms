"use client";

import { useEffect, useState } from "react";
import { Select } from "antd";
import { useAppSelector } from "@/core/redux/hooks";
import { fetchQuestionBank, createBankQuestion, deleteBankQuestion } from "@/services/questionBankService";
import { QuestionBankEntry, QuestionType } from "@/types/quiz";
import { usePermissionGuard } from "@/lib/usePermissionGuard";
import { PERMISSIONS } from "@/lib/permissions";
import { useNotification } from "@/hooks/useNotification";
import { normalizeOptions } from "@/lib/questionBank";

const QUESTION_TYPES: { value: QuestionType; label: string }[] = [
  { value: "multiple_choice", label: "Multiple Choice" },
  { value: "true_false", label: "True / False" },
  { value: "short_answer", label: "Short Answer" },
];

const TYPE_COLORS: Record<QuestionType, string> = {
  multiple_choice: "primary",
  true_false: "info",
  short_answer: "secondary",
};

interface AddModalProps {
  userId?: number;
  onClose: () => void;
  onSaved: (q: QuestionBankEntry) => void;
}

const AddModal = ({ userId, onClose, onSaved }: AddModalProps) => {
  const notify = useNotification();
  const [qType, setQType] = useState<QuestionType>("multiple_choice");
  const [qText, setQText] = useState("");
  const [qOptions, setQOptions] = useState(["", "", "", ""]);
  const [qCorrect, setQCorrect] = useState("");
  const [qSubject, setQSubject] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!qText.trim()) { notify.error("Question text is required."); return; }
    if (qType === "multiple_choice") {
      if (qOptions.filter((o) => o.trim()).length < 2) { notify.error("Provide at least 2 options."); return; }
      if (!qCorrect.trim()) { notify.error("Select the correct answer."); return; }
    }
    if ((qType === "true_false" || qType === "short_answer") && !qCorrect.trim()) {
      notify.error("Correct answer is required."); return;
    }
    setSaving(true);
    try {
      const res = await createBankQuestion({
        type: qType,
        question: qText.trim(),
        options: qType === "multiple_choice" ? qOptions.filter((o) => o.trim()) : null,
        correctAnswer: qCorrect.trim(),
        subject: qSubject.trim() || undefined,
        createdBy: userId,
      });
      onSaved(res.question);
    } catch (e: any) {
      notify.error(e.message ?? "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal fade show d-block" style={{ background: "rgba(0,0,0,0.5)" }}
      onClick={(e) => { if (e.target === e.currentTarget && !saving) onClose(); }}>
      <div className="modal-dialog modal-lg modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title fw-bold">Add Question to Bank</h5>
            <button className="btn-close" onClick={onClose} disabled={saving} />
          </div>
          <div className="modal-body">
            <div className="row g-3">
              <div className="col-md-5">
                <label className="form-label fw-medium">Question Type</label>
                <select className="form-select" value={qType} onChange={(e) => { setQType(e.target.value as QuestionType); setQCorrect(""); }} disabled={saving}>
                  {QUESTION_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div className="col-md-7">
                <label className="form-label fw-medium">Subject / Topic</label>
                <input type="text" className="form-control" placeholder="e.g. Mathematics, English (optional)" value={qSubject} onChange={(e) => setQSubject(e.target.value)} disabled={saving} />
              </div>
              <div className="col-12">
                <label className="form-label fw-medium">Question <span className="text-danger">*</span></label>
                <textarea className="form-control" rows={2} placeholder="Enter question text..." value={qText} onChange={(e) => setQText(e.target.value)} disabled={saving} />
              </div>

              {qType === "multiple_choice" && (
                <>
                  <div className="col-12">
                    <label className="form-label fw-medium">Options</label>
                    <div className="d-flex flex-column gap-2">
                      {qOptions.map((opt, i) => (
                        <div key={i} className="input-group">
                          <span className="input-group-text">{String.fromCharCode(65 + i)}</span>
                          <input type="text" className="form-control" placeholder={`Option ${String.fromCharCode(65 + i)}`} value={opt}
                            onChange={(e) => { const next = [...qOptions]; next[i] = e.target.value; setQOptions(next); }} disabled={saving} />
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="col-12">
                    <label className="form-label fw-medium">Correct Answer <span className="text-danger">*</span></label>
                    <select className="form-select" value={qCorrect} onChange={(e) => setQCorrect(e.target.value)} disabled={saving}>
                      <option value="">Select correct option...</option>
                      {qOptions.filter((o) => o.trim()).map((opt, i) => <option key={i} value={opt}>{opt}</option>)}
                    </select>
                  </div>
                </>
              )}

              {qType === "true_false" && (
                <div className="col-md-6">
                  <label className="form-label fw-medium">Correct Answer <span className="text-danger">*</span></label>
                  <select className="form-select" value={qCorrect} onChange={(e) => setQCorrect(e.target.value)} disabled={saving}>
                    <option value="">Select...</option>
                    <option value="true">True</option>
                    <option value="false">False</option>
                  </select>
                </div>
              )}

              {qType === "short_answer" && (
                <div className="col-12">
                  <label className="form-label fw-medium">Correct Answer Keywords <span className="text-danger">*</span></label>
                  <input type="text" className="form-control" placeholder="e.g. photosynthesis, chlorophyll (comma-separated)" value={qCorrect} onChange={(e) => setQCorrect(e.target.value)} disabled={saving} />
                  <div className="form-text">Comma-separated keywords for grading.</div>
                </div>
              )}
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? <><span className="spinner-border spinner-border-sm me-2" />Saving...</> : "Save to Bank"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const AdminQuestionBankPage = () => {
  usePermissionGuard(PERMISSIONS.QUIZZES_VIEW);
  const user = useAppSelector((state) => state.auth.user);
  const notify = useNotification();

  const [questions, setQuestions] = useState<QuestionBankEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<"all" | QuestionType>("all");
  const [filterSubject, setFilterSubject] = useState("all");
  const [showAdd, setShowAdd] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<QuestionBankEntry | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetchQuestionBank();
      setQuestions(res.questions);
    } catch (e: any) {
      notify.error(e.message ?? "Failed to load question bank.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleSaved = (q: QuestionBankEntry) => {
    setQuestions((prev) => [q, ...prev]);
    setShowAdd(false);
    notify.success("Question added to bank");
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteBankQuestion(deleteTarget.id);
      setQuestions((prev) => prev.filter((q) => q.id !== deleteTarget.id));
      setDeleteTarget(null);
      notify.success("Question deleted from bank");
    } catch (e: any) {
      notify.error(e.message ?? "Failed to delete.");
    } finally {
      setDeleting(false);
    }
  };

  const subjects = ["all", ...Array.from(new Set(questions.map((q) => q.subject ?? "—").filter(Boolean)))];

  const filtered = questions.filter((q) => {
    if (filterType !== "all" && q.type !== filterType) return false;
    if (filterSubject !== "all") {
      const subj = q.subject ?? "—";
      if (subj !== filterSubject) return false;
    }
    if (search && !q.question.toLowerCase().includes(search.toLowerCase()) &&
        !(q.subject ?? "").toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="page-wrapper">
      <div className="content">
        {/* Header */}
        <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 pb-3 mb-3 border-bottom">
          <div>
            <h4 className="fw-bold mb-1">Question Bank</h4>
            <p className="text-muted mb-0 small">Manage reusable questions available to all quiz creators</p>
          </div>
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
            <i className="ti ti-plus me-1" />
            Add Question
          </button>
        </div>

        {/* Stats */}
        <div className="row g-3 mb-4">
          {[
            { label: "Total Questions", value: questions.length, color: "primary" },
            { label: "Multiple Choice", value: questions.filter((q) => q.type === "multiple_choice").length, color: "info" },
            { label: "True / False", value: questions.filter((q) => q.type === "true_false").length, color: "success" },
            { label: "Short Answer", value: questions.filter((q) => q.type === "short_answer").length, color: "secondary" },
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
                  placeholder="Search questions or subjects..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
            <div className="col-md-auto">
              <div className="sf-filter-item">
                <label>Type</label>
                <Select
                  size="large"
                  style={{ minWidth: 170 }}
                  value={filterType}
                  onChange={(v) => setFilterType(v)}
                  options={[{ value: "all", label: "All Types" }, ...QUESTION_TYPES]}
                  suffixIcon={<i className="ti ti-list-check" />}
                />
              </div>
            </div>
            <div className="col-md-auto">
              <div className="sf-filter-item">
                <label>Subject</label>
                <Select
                  size="large"
                  style={{ minWidth: 170 }}
                  value={filterSubject}
                  onChange={(v) => setFilterSubject(v)}
                  options={subjects.map((s) => ({ value: s, label: s === "all" ? "All Subjects" : s }))}
                  suffixIcon={<i className="ti ti-book-2" />}
                />
              </div>
            </div>
            {(search || filterType !== "all" || filterSubject !== "all") && (
              <div className="col-md-auto">
                <div className="sf-filter-item">
                  <label>&nbsp;</label>
                  <button
                    type="button"
                    className="btn filter-panel-clear-btn"
                    onClick={() => {
                      setSearch("");
                      setFilterType("all");
                      setFilterSubject("all");
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
          <div className="text-center py-5"><div className="spinner-border text-primary" role="status" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-5">
            <i className="ti ti-database-off fs-1 text-muted d-block mb-2" />
            <p className="text-muted">
              {questions.length === 0
                ? 'No questions yet. Click "Add Question" to create one.'
                : "No questions match your filters."}
            </p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table table-hover align-middle">
              <thead className="table-light">
                <tr>
                  <th>#</th>
                  <th style={{ minWidth: 280 }}>Question</th>
                  <th>Type</th>
                  <th>Subject</th>
                  <th>Options / Answer</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((q, idx) => {
                  const options = normalizeOptions(q.options);
                  return (
                  <tr key={q.id}>
                    <td className="text-muted small">{idx + 1}</td>
                    <td className="fw-medium" style={{ maxWidth: 280 }}>{q.question}</td>
                    <td>
                      <span className={`badge bg-soft-${TYPE_COLORS[q.type]} text-${TYPE_COLORS[q.type]} border border-${TYPE_COLORS[q.type]}`}>
                        {q.type.replace("_", " ")}
                      </span>
                    </td>
                    <td className="text-muted small">{q.subject ?? "—"}</td>
                    <td className="small">
                      {options.length > 0 && (
                        <div className="text-muted mb-1">{options.join(" / ")}</div>
                      )}
                      <div className="text-success fw-medium">
                        <i className="ti ti-check me-1" />{q.correctAnswer}
                      </div>
                    </td>
                    <td>
                      <button
                        className="btn btn-sm btn-outline-danger"
                        title="Delete"
                        onClick={() => setDeleteTarget(q)}
                      >
                        <i className="ti ti-trash" />
                      </button>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Add Modal */}
        {showAdd && (
          <AddModal userId={user?.id ? Number(user.id) : undefined} onClose={() => setShowAdd(false)} onSaved={handleSaved} />
        )}

        {/* Delete Confirm */}
        {deleteTarget && (
          <div className="modal fade show d-block" style={{ background: "rgba(0,0,0,0.5)" }}>
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title fw-bold">Delete Question</h5>
                  <button className="btn-close" onClick={() => setDeleteTarget(null)} disabled={deleting} />
                </div>
                <div className="modal-body">
                  Delete: <strong>&quot;{deleteTarget.question}&quot;</strong>? This will not affect existing quiz questions that were copied from this entry.
                </div>
                <div className="modal-footer">
                  <button className="btn btn-secondary" onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancel</button>
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

export default AdminQuestionBankPage;
