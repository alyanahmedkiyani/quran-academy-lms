"use client";

import { useEffect, useState, useMemo } from "react";
import { DatePicker } from "antd";
import dayjs from "dayjs";
import {
  fetchSessionsWithTranscripts,
  SessionWithTranscript,
} from "@/services/classScheduleService";
import { usePermissionGuard } from "@/lib/usePermissionGuard";
import { PERMISSIONS } from "@/lib/permissions";

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function downloadTranscript(session: SessionWithTranscript) {
  const teacherName = session.Teacher
    ? `${session.Teacher.firstName} ${session.Teacher.lastName}`
    : "Unknown";
  const header = [
    `Session: ${session.title}`,
    `Date: ${session.date}  ${session.startTime} – ${session.endTime}`,
    `Teacher: ${teacherName}`,
    `Course: ${session.Course?.courseName ?? "—"}`,
    `Status: ${session.status}`,
    "",
    "--- TRANSCRIPT ---",
    "",
  ].join("\n");
  const blob = new Blob([header + session.transcriptText], {
    type: "text/plain",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `transcript-session-${session.id}-${session.date}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AdminTranscriptsPage() {
  usePermissionGuard(PERMISSIONS.TRANSCRIPTS_VIEW);

  const [sessions, setSessions] = useState<SessionWithTranscript[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Expanded transcript row ids
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  useEffect(() => {
    const params: Record<string, string> = {};
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;

    setLoading(true);
    fetchSessionsWithTranscripts(params)
      .then(setSessions)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [startDate, endDate]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return sessions;
    return sessions.filter((s) => {
      const teacher = s.Teacher
        ? `${s.Teacher.firstName} ${s.Teacher.lastName}`.toLowerCase()
        : "";
      return (
        s.title.toLowerCase().includes(q) ||
        teacher.includes(q) ||
        (s.Course?.courseName ?? "").toLowerCase().includes(q)
      );
    });
  }, [sessions, search]);

  function toggleExpand(id: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  return (
    <div className="page-wrapper">
      <div className="content">
        {/* Header */}
        <div className="d-md-flex d-block align-items-center justify-content-between mb-3">
          <div className="my-auto mb-2">
            <h3 className="page-title mb-1">Session Transcripts</h3>
            <nav aria-label="breadcrumb">
              <ol className="breadcrumb mb-0">
                <li className="breadcrumb-item">
                  <a href="/admin/dashboard">Dashboard</a>
                </li>
                <li className="breadcrumb-item active">Transcripts</li>
              </ol>
            </nav>
          </div>
          <div className="d-flex align-items-center gap-2 flex-wrap">
            <span className="badge bg-primary-subtle text-primary fs-13 px-3 py-2">
              {filtered.length} transcript{filtered.length !== 1 ? "s" : ""}
            </span>
          </div>
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
                  placeholder="Session, teacher, course…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
            <div className="col-md-auto">
              <div className="sf-filter-item">
                <label>From date</label>
                <DatePicker
                  size="large"
                  style={{ width: 150 }}
                  value={startDate ? dayjs(startDate) : null}
                  onChange={(_, ds) => setStartDate(ds as string)}
                  format="YYYY-MM-DD"
                  placeholder="Start date"
                />
              </div>
            </div>
            <div className="col-md-auto">
              <div className="sf-filter-item">
                <label>To date</label>
                <DatePicker
                  size="large"
                  style={{ width: 150 }}
                  value={endDate ? dayjs(endDate) : null}
                  onChange={(_, ds) => setEndDate(ds as string)}
                  format="YYYY-MM-DD"
                  placeholder="End date"
                />
              </div>
            </div>
            {(search || startDate || endDate) && (
              <div className="col-md-auto">
                <div className="sf-filter-item">
                  <label>&nbsp;</label>
                  <button
                    type="button"
                    className="btn filter-panel-clear-btn"
                    onClick={() => {
                      setSearch("");
                      setStartDate("");
                      setEndDate("");
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
        <div className="card">
          <div className="card-body p-0">
            {loading ? (
              <div className="text-center py-5">
                <div className="spinner-border text-primary" />
                <p className="mt-2 text-muted">Loading transcripts…</p>
              </div>
            ) : error ? (
              <div className="text-center py-5 text-danger">
                <i className="ti ti-alert-circle fs-2 mb-2 d-block" />
                {error}
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-5 text-muted">
                <i className="ti ti-file-off fs-2 mb-2 d-block" />
                No transcripts found.
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table table-hover mb-0">
                  <thead className="table-light">
                    <tr>
                      <th style={{ width: 36 }}>#</th>
                      <th>Session</th>
                      <th>Date</th>
                      <th>Time</th>
                      <th>Teacher</th>
                      <th>Course</th>
                      <th>Words</th>
                      <th className="text-end">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((s, idx) => {
                      const isOpen = expanded.has(s.id);
                      const words = wordCount(s.transcriptText);
                      const teacherName = s.Teacher
                        ? `${s.Teacher.firstName} ${s.Teacher.lastName}`
                        : "—";
                      return (
                        <>
                          <tr key={s.id}>
                            <td className="text-muted" style={{ fontSize: 12 }}>
                              {idx + 1}
                            </td>
                            <td>
                              <span className="fw-semibold" style={{ fontSize: 13 }}>
                                {s.title}
                              </span>
                              {s.shift && (
                                <span
                                  className="badge ms-2"
                                  style={{
                                    fontSize: 10,
                                    background:
                                      s.shift === "Morning"
                                        ? "#FEF3C7"
                                        : s.shift === "Afternoon"
                                        ? "#DBEAFE"
                                        : "#EDE9FE",
                                    color:
                                      s.shift === "Morning"
                                        ? "#92400E"
                                        : s.shift === "Afternoon"
                                        ? "#1E40AF"
                                        : "#5B21B6",
                                  }}
                                >
                                  {s.shift}
                                </span>
                              )}
                            </td>
                            <td style={{ fontSize: 13 }}>{s.date}</td>
                            <td style={{ fontSize: 13, whiteSpace: "nowrap" }}>
                              {s.startTime?.slice(0, 5)} – {s.endTime?.slice(0, 5)}
                            </td>
                            <td style={{ fontSize: 13 }}>{teacherName}</td>
                            <td style={{ fontSize: 13 }}>
                              {s.Course?.courseName ?? "—"}
                            </td>
                            <td>
                              <span
                                className="badge bg-secondary-subtle text-secondary"
                                style={{ fontSize: 11 }}
                              >
                                {words.toLocaleString()} w
                              </span>
                            </td>
                            <td className="text-end">
                              <div className="d-flex justify-content-end gap-1">
                                <button
                                  className={`btn btn-sm ${isOpen ? "btn-primary" : "btn-outline-primary"}`}
                                  title={isOpen ? "Collapse" : "View transcript"}
                                  onClick={() => toggleExpand(s.id)}
                                >
                                  <i
                                    className={`ti ${isOpen ? "ti-chevron-up" : "ti-eye"}`}
                                  />
                                </button>
                                <button
                                  className="btn btn-sm btn-outline-secondary"
                                  title="Download .txt"
                                  onClick={() => downloadTranscript(s)}
                                >
                                  <i className="ti ti-download" />
                                </button>
                              </div>
                            </td>
                          </tr>

                          {/* Expanded transcript row */}
                          {isOpen && (
                            <tr key={`${s.id}-transcript`} className="bg-light">
                              <td colSpan={8} className="p-3">
                                <div
                                  style={{
                                    background: "#fff",
                                    border: "1px solid #e5e7eb",
                                    borderRadius: 8,
                                    padding: "16px 20px",
                                    maxHeight: 340,
                                    overflowY: "auto",
                                    fontFamily: "monospace",
                                    fontSize: 13,
                                    lineHeight: 1.7,
                                    whiteSpace: "pre-wrap",
                                    color: "#374151",
                                  }}
                                >
                                  {s.transcriptText}
                                </div>
                                <div className="mt-2 d-flex justify-content-between align-items-center">
                                  <span className="text-muted" style={{ fontSize: 12 }}>
                                    {words.toLocaleString()} words &middot; ~
                                    {Math.ceil(words / 130)} min read
                                  </span>
                                  <button
                                    className="btn btn-sm btn-outline-secondary"
                                    onClick={() => downloadTranscript(s)}
                                  >
                                    <i className="ti ti-download me-1" />
                                    Download .txt
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
