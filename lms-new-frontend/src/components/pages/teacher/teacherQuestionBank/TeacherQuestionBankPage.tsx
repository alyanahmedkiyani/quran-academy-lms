"use client";

import { useEffect, useState } from "react";
import { useAppSelector } from "@/core/redux/hooks";
import { fetchQuestionBank, createBankQuestion, deleteBankQuestion } from "@/services/questionBankService";
import { QuestionBankEntry, QuestionType } from "@/types/quiz";
import { useNotification } from "@/hooks/useNotification";
import { normalizeOptions } from "@/lib/questionBank";

const QUESTION_TYPES: { value: QuestionType; label: string }[] = [
  { value: "multiple_choice", label: "Multiple Choice" },
  { value: "true_false", label: "True / False" },
  { value: "short_answer", label: "Short Answer" },
];

const TYPE_BADGE: Record<QuestionType, string> = {
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
    } catch (e: unknown) {
      notify.error((e as { message?: string })?.message ?? "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="modal-backdrop fade show" style={{ zIndex: 1040 }} onClick={() => { if (!saving) onClose(); }} />
      <div className="modal fade show" style={{ display: "block", zIndex: 1055 }} tabIndex={-1}>
        <div className="modal-dialog modal-lg modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title fw-bold text-dark">Add Question to Bank</h5>
              <button type="button" className="btn-close custom-btn-close opacity-100" onClick={onClose} disabled={saving}>
                <i className="ti ti-x fs-16 text-dark" />
              </button>
            </div>
            <div className="modal-body">
              <div className="row g-3">
                <div className="col-md-5">
                  <label className="form-label fw-medium">Question Type</label>
                  <select
                    className="form-select"
                    value={qType}
                    onChange={(e) => { setQType(e.target.value as QuestionType); setQCorrect(""); }}
                    disabled={saving}
                  >
                    {QUESTION_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div className="col-md-7">
                  <label className="form-label fw-medium">Subject / Topic <span className="text-muted fw-normal">(optional)</span></label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Mathematics, Physics"
                    value={qSubject}
                    onChange={(e) => setQSubject(e.target.value)}
                    disabled={saving}
                  />
                </div>
                <div className="col-12">
                  <label className="form-label fw-medium">Question <span className="text-danger">*</span></label>
                  <textarea
                    className="form-control"
                    rows={2}
                    placeholder="Enter question text..."
                    value={qText}
                    onChange={(e) => setQText(e.target.value)}
                    disabled={saving}
                  />
                </div>

                {qType === "multiple_choice" && (
                  <>
                    <div className="col-12">
                      <label className="form-label fw-medium">Options</label>
                      <div className="d-flex flex-column gap-2">
                        {qOptions.map((opt, i) => (
                          <div key={i} className="input-group">
                            <span className="input-group-text">{String.fromCharCode(65 + i)}</span>
                            <input
                              type="text"
                              className="form-control"
                              placeholder={`Option ${String.fromCharCode(65 + i)}`}
                              value={opt}
                              onChange={(e) => { const next = [...qOptions]; next[i] = e.target.value; setQOptions(next); }}
                              disabled={saving}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="col-12">
                      <label className="form-label fw-medium">Correct Answer <span className="text-danger">*</span></label>
                      <select
                        className="form-select"
                        value={qCorrect}
                        onChange={(e) => setQCorrect(e.target.value)}
                        disabled={saving}
                      >
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
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. photosynthesis, chlorophyll (comma-separated)"
                      value={qCorrect}
                      onChange={(e) => setQCorrect(e.target.value)}
                      disabled={saving}
                    />
                    <div className="form-text">Comma-separated keywords for answer matching.</div>
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-light border" onClick={onClose} disabled={saving}>Cancel</button>
              <button type="button" className="btn btn-primary d-inline-flex align-items-center gap-2" onClick={handleSave} disabled={saving}>
                {saving && <span className="spinner-border spinner-border-sm" role="status" />}
                <i className="ti ti-device-floppy" />
                Save to Bank
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

const TeacherQuestionBankPage = () => {
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
    } catch (e: unknown) {
      notify.error((e as { message?: string })?.message ?? "Failed to load question bank.");
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
      notify.success("Question removed from bank");
    } catch (e: unknown) {
      notify.error((e as { message?: string })?.message ?? "Failed to delete.");
    } finally {
      setDeleting(false);
    }
  };

  const subjects = ["all", ...Array.from(new Set(questions.map((q) => q.subject ?? "—").filter(Boolean)))];

  const filtered = questions.filter((q) => {
    if (filterType !== "all" && q.type !== filterType) return false;
    if (filterSubject !== "all" && (q.subject ?? "—") !== filterSubject) return false;
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
            <p className="text-muted mb-0 small">
              Browse and manage reusable questions. Add questions here or save directly while creating quiz questions.
            </p>
          </div>
          <button className="btn btn-primary d-inline-flex align-items-center gap-1" onClick={() => setShowAdd(true)}>
            <i className="ti ti-plus" />
            Add Question
          </button>
        </div>

        {/* Stats */}
        <div className="row g-3 mb-4">
          {[
            { label: "Total Questions", value: questions.length, color: "primary" },
            { label: "Multiple Choice", value: questions.filter((q) => q.type === "multiple_choice").length, color: "info" },
            { label: "True / False", value: questions.filter((q) => q.type === "true_false").length, color: "success" },
            { label: "Short Answer", value: questions.filter((q) => q.type === "short_answer").length, color: "warning" },
          ].map((c) => (
            <div key={c.label} className="col-6 col-md-3">
              <div className="card border-0 text-center p-3">
                <div className={`fw-bold fs-4 text-${c.color}`}>{c.value}</div>
                <div className="text-muted small">{c.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Info banner */}
        <div className="alert alert-info d-flex align-items-start gap-2 mb-3 py-2">
          <i className="ti ti-info-circle fs-16 mt-1 flex-shrink-0" />
          <div className="small">
            Questions in the bank are shared. When creating quiz questions, check
            <strong> &ldquo;Also save to Question Bank&rdquo;</strong> to add them here, or use
            <strong> &ldquo;From Question Bank&rdquo;</strong> tab in the quiz questions modal to reuse existing ones.
          </div>
        </div>

        {/* Filters */}
        <div className="d-flex gap-2 flex-wrap mb-3">
          <input
            type="text"
            className="form-control form-control-sm"
            style={{ maxWidth: 260 }}
            placeholder="Search questions or subjects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="form-select form-select-sm"
            style={{ maxWidth: 180 }}
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as "all" | QuestionType)}
          >
            <option value="all">All Types</option>
            {QUESTION_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <select
            className="form-select form-select-sm"
            style={{ maxWidth: 180 }}
            value={filterSubject}
            onChange={(e) => setFilterSubject(e.target.value)}
          >
            {subjects.map((s) => <option key={s} value={s}>{s === "all" ? "All Subjects" : s}</option>)}
          </select>
          <button
            type="button"
            className="btn btn-outline-light border btn-sm d-inline-flex align-items-center gap-1"
            onClick={load}
            disabled={loading}
          >
            <i className="ti ti-refresh" />
            Refresh
          </button>
        </div>

        {/* Table */}
        {loading ? (
          <div className="text-center py-5"><div className="spinner-border text-primary" role="status" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-5">
            <i className="ti ti-database-off fs-1 text-muted d-block mb-2" />
            <p className="text-muted">
              {questions.length === 0
                ? 'No questions in the bank yet. Click "Add Question" to create the first one, or save questions while creating quizzes.'
                : "No questions match your filters."}
            </p>
          </div>
        ) : (
          <div className="card">
            <div className="card-body p-0">
              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0">
                  <thead className="table-light">
                    <tr>
                      <th style={{ fontSize: 13 }}>#</th>
                      <th style={{ fontSize: 13, minWidth: 280 }}>Question</th>
                      <th style={{ fontSize: 13 }}>Type</th>
                      <th style={{ fontSize: 13 }}>Subject</th>
                      <th style={{ fontSize: 13 }}>Options / Answer</th>
                      <th style={{ fontSize: 13, width: 80 }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((q, idx) => {
                      const options = normalizeOptions(q.options);
                      return (
                      <tr key={q.id}>
                        <td className="text-muted" style={{ fontSize: 13 }}>{idx + 1}</td>
                        <td style={{ maxWidth: 280 }}>
                          <div className="fw-medium" style={{ fontSize: 13 }}>{q.question}</div>
                        </td>
                        <td>
                          <span className={`badge badge-soft-${TYPE_BADGE[q.type]} border border-${TYPE_BADGE[q.type]}`} style={{ fontSize: 11 }}>
                            {q.type.replace("_", " ")}
                          </span>
                        </td>
                        <td className="text-muted" style={{ fontSize: 13 }}>{q.subject ?? "—"}</td>
                        <td style={{ fontSize: 12 }}>
                          {options.length > 0 && (
                            <div className="text-muted mb-1">{options.join(" / ")}</div>
                          )}
                          <div className="text-success fw-medium">
                            <i className="ti ti-check me-1" />{q.correctAnswer}
                          </div>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger btn-icon"
                            title="Remove from bank"
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
            </div>
          </div>
        )}
      </div>

      {/* Add Question Modal */}
      {showAdd && (
        <AddModal
          userId={user?.id ? Number(user.id) : undefined}
          onClose={() => setShowAdd(false)}
          onSaved={handleSaved}
        />
      )}

      {/* Delete Confirm */}
      {deleteTarget && (
        <>
          <div className="modal-backdrop fade show" style={{ zIndex: 1040 }} onClick={() => { if (!deleting) setDeleteTarget(null); }} />
          <div className="modal fade show" style={{ display: "block", zIndex: 1055 }} tabIndex={-1}>
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title fw-bold text-dark">Remove Question</h5>
                  <button type="button" className="btn-close custom-btn-close opacity-100" onClick={() => setDeleteTarget(null)} disabled={deleting}>
                    <i className="ti ti-x fs-16 text-dark" />
                  </button>
                </div>
                <div className="modal-body">
                  <p className="mb-0">
                    Remove <strong>&ldquo;{deleteTarget.question}&rdquo;</strong> from the bank?
                  </p>
                  <p className="text-muted small mt-1 mb-0">
                    This will not affect quiz questions that were already copied from this entry.
                  </p>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-light border" onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancel</button>
                  <button type="button" className="btn btn-danger d-inline-flex align-items-center gap-2" onClick={handleDelete} disabled={deleting}>
                    {deleting && <span className="spinner-border spinner-border-sm" role="status" />}
                    <i className="ti ti-trash" />
                    Remove
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default TeacherQuestionBankPage;
