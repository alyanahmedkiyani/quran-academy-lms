"use client";

import { useEffect, useRef, useState } from "react";
import { DatePicker } from "antd";
import dayjs from "dayjs";
import { useAppDispatch, useAppSelector } from "@/core/redux/hooks";
import { closeCall, markActiveCallEnded } from "@/core/redux/calendarSlice";
import { endSession, LessonPayload } from "@/services/classScheduleService";
import { CoursePDF, getCoursePDFs, pdfViewUrl } from "@/services/coursePDFService";
import {
  fetchSessionSheetThunk,
  bulkMarkThunk,
  resetBulkMarkStatus,
} from "@/core/redux/attendanceSlice";
import { AttendanceStatus, AttendanceStudent } from "@/types/attendance";

interface CallModalProps {
  role?: string;
  userId?: string;
}

/**
 * CallModal — full-screen overlay (or PiP mini-box when minimized) that embeds
 * the calling-app room in an iframe.
 *
 * MINIMIZE = Google Meet style Picture-in-Picture: the iframe resizes to a
 * small floating box in the bottom-right corner so the user can browse the
 * dashboard while the class continues.  The iframe is NEVER hidden so the
 * browser never throttles the WebRTC connection.
 *
 * "End Session" (teacher/admin only) terminates the session entirely.
 */
export default function CallModal({ role = "", userId = "" }: CallModalProps) {
  const dispatch = useAppDispatch();
  const activeCall = useAppSelector((s) => s.calendar.activeCall);
  const { attendanceSheet, sheetStatus, bulkMarkStatus } = useAppSelector((s) => s.attendance);

  const [pip, setPip] = useState(false);           // PiP mini-mode
  const [loaded, setLoaded] = useState(false);
  const [iframeError, setIframeError] = useState(false);
  const [activePanel, setActivePanel] = useState<"materials" | "attendance" | null>(null);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [ending, setEnding] = useState(false);
  // Lesson form state — step 2 of end session flow
  const [showLessonForm, setShowLessonForm] = useState(false);
  const [lessonTitle, setLessonTitle] = useState("");
  const [lessonDescription, setLessonDescription] = useState("");
  const [lessonDueDate, setLessonDueDate] = useState("");
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // PDF state
  const [pdfs, setPdfs] = useState<CoursePDF[]>([]);
  const [loadingPdfs, setLoadingPdfs] = useState(false);
  const [selectedPdf, setSelectedPdf] = useState<CoursePDF | null>(null);

  // Attendance local state
  const [localStatuses, setLocalStatuses] = useState<Record<number, AttendanceStatus>>({});
  const [saveFeedback, setSaveFeedback] = useState<"saved" | null>(null);

  // Responsive breakpoint
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const isTeacherOrAdmin = role === "teacher" || role === "admin";

  // Reset on new call
  useEffect(() => {
    if (activeCall) {
      setLoaded(false);
      setIframeError(false);
      setPip(false);
      setActivePanel(null);
      setPdfs([]);
      setSelectedPdf(null);
      setLocalStatuses({});
      dispatch(resetBulkMarkStatus());
    }
  }, [activeCall?.joinUrl]);

  // 20s load timeout
  useEffect(() => {
    if (!activeCall || loaded || iframeError) return;
    const timer = setTimeout(() => { if (!loaded) setIframeError(true); }, 20_000);
    return () => clearTimeout(timer);
  }, [activeCall?.joinUrl, loaded, iframeError]);

  // Block back nav while call is open and NOT in PiP
  useEffect(() => {
    if (!activeCall || pip) return;
    const fn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", fn);
    return () => window.removeEventListener("beforeunload", fn);
  }, [activeCall, pip]);

  // Handle postMessages from the calling-app iframe
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === "lmsClosePanels") {
        setActivePanel(null);
        setSelectedPdf(null);
      } else if (e.data?.type === "lmsLeaveCall") {
        // User clicked Leave inside calling app — they've left the room, close call
        dispatch(closeCall());
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [dispatch]);

  // Fetch PDFs when materials panel opens
  useEffect(() => {
    if (activePanel !== "materials" || !activeCall?.courseId) return;
    setLoadingPdfs(true);
    getCoursePDFs(activeCall.courseId)
      .then(setPdfs)
      .catch(() => setPdfs([]))
      .finally(() => setLoadingPdfs(false));
  }, [activePanel, activeCall?.courseId]);

  // Fetch attendance when attendance panel opens
  useEffect(() => {
    if (activePanel !== "attendance" || !activeCall?.sessionId) return;
    dispatch(fetchSessionSheetThunk(activeCall.sessionId));
  }, [activePanel, activeCall?.sessionId, dispatch]);

  // Pre-populate statuses
  useEffect(() => {
    if (attendanceSheet?.students) {
      const init: Record<number, AttendanceStatus> = {};
      attendanceSheet.students.forEach((s) => { init[s.studentId] = s.status ?? "Present"; });
      setLocalStatuses(init);
    }
  }, [attendanceSheet]);

  if (!activeCall) return null;

  const togglePanel = (panel: "materials" | "attendance") => {
    setActivePanel((prev) => {
      const opening = prev !== panel;
      if (opening) {
        iframeRef.current?.contentWindow?.postMessage({ type: "lmsCloseChat" }, "*");
      }
      return prev === panel ? null : panel;
    });
    setSelectedPdf(null);
  };

  const handleEndSessionClick = () => setConfirmEnd(true);
  const handleCancelEnd = () => {
    setConfirmEnd(false);
    setShowLessonForm(false);
    setLessonTitle("");
    setLessonDescription("");
    setLessonDueDate("");
  };
  // Step 1 → Step 2: show lesson form
  const handleProceedToLesson = () => setShowLessonForm(true);
  // Step 2 → final end (with or without lesson data)
  const handleConfirmEnd = async (skipLesson = false) => {
    if (!activeCall) return;
    setEnding(true);
    // Notify calling-app iframe to stop + upload transcript via sendBeacon.
    // Wait 2.5s before destroying the iframe so the beacon has time to fire.
    iframeRef.current?.contentWindow?.postMessage({ type: "lmsSessionEnd" }, "*");
    await new Promise((r) => setTimeout(r, 2500));
    try {
      const lessonData: LessonPayload = skipLesson ? {} : {
        lessonTitle: lessonTitle.trim() || undefined,
        lessonDescription: lessonDescription.trim() || undefined,
        lessonDueDate: lessonDueDate || undefined,
      };
      await endSession(activeCall.sessionId, userId, role, lessonData);
    } catch {
      // socket event may still fire; ignore API error
    } finally {
      setEnding(false);
      setConfirmEnd(false);
      setShowLessonForm(false);
      setLessonTitle("");
      setLessonDescription("");
      setLessonDueDate("");
      dispatch(closeCall());
    }
  };

  const handleIframeLoad = () => {
    if (!loaded) { setLoaded(true); setIframeError(false); }
  };

  const toggleStudentStatus = (studentId: number) => {
    setLocalStatuses((prev) => ({
      ...prev,
      [studentId]: prev[studentId] === "Present" ? "Absent" : "Present",
    }));
  };
  const markAll = (status: AttendanceStatus) => {
    if (!attendanceSheet) return;
    const all: Record<number, AttendanceStatus> = {};
    attendanceSheet.students.forEach((s) => { all[s.studentId] = status; });
    setLocalStatuses(all);
  };
  const handleSaveAttendance = async () => {
    if (!attendanceSheet || !activeCall?.sessionId) return;
    const records = attendanceSheet.students.map((s) => ({
      studentId: s.studentId,
      courseDetailsId: s.courseDetailsId,
      status: localStatuses[s.studentId] ?? "Present",
    }));
    const result = await dispatch(bulkMarkThunk({ sessionId: activeCall.sessionId, records }));
    if (bulkMarkThunk.fulfilled.match(result)) {
      setSaveFeedback("saved");
      setTimeout(() => setSaveFeedback(null), 2500);
      dispatch(fetchSessionSheetThunk(activeCall.sessionId));
    }
  };

  const presentCount = attendanceSheet
    ? Object.values(localStatuses).filter((s) => s === "Present").length : 0;
  const absentCount = attendanceSheet
    ? attendanceSheet.students.length - presentCount : 0;

  // ── Responsive PiP dimensions ──
  const PIP_W = typeof window !== "undefined" ? Math.min(400, window.innerWidth - 32) : 400;
  const PIP_H = Math.round(PIP_W * (255 / 400));

  // ── Shared panel styles — overlay on mobile, side panel on desktop ──
  const panelStyle: React.CSSProperties = isMobile ? {
    position: "absolute",
    inset: 0,
    zIndex: 10,
    width: "100%",
    height: "100%",
    background: "#1e293b",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    animation: "panelSlideIn 0.25s cubic-bezier(0.4,0,0.2,1)",
  } : {
    width: 360,
    flexShrink: 0,
    height: "100%",
    background: "#1e293b",
    borderLeft: "1px solid #334155",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    animation: "panelSlideIn 0.25s cubic-bezier(0.4,0,0.2,1)",
  };

  const panelHeader: React.CSSProperties = {
    padding: "12px 16px",
    borderBottom: "1px solid #334155",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexShrink: 0,
    background: "#1e293b",
  };

  const closeBtn: React.CSSProperties = {
    background: "transparent", border: "none", color: "#64748b",
    cursor: "pointer", fontSize: 20, lineHeight: 1,
  };

  return (
    <>
      {/* ── Outer container — morphs between full-screen and PiP box ── */}
      <div
        style={pip ? {
          // PiP: small floating box in bottom-right, always on top
          position: "fixed",
          bottom: 16,
          right: 16,
          width: PIP_W,
          height: PIP_H,
          zIndex: 9000,
          borderRadius: 14,
          overflow: "hidden",
          background: "#0f172a",
          boxShadow: "0 12px 48px rgba(0,0,0,0.6)",
          border: "1px solid #334155",
          display: "flex",
          flexDirection: "column",
        } : {
          // Full: entire viewport
          position: "fixed",
          inset: 0,
          zIndex: 9000,
          display: "flex",
          flexDirection: "column",
          background: "#0f172a",
        }}
      >
        {/* ── Full-mode top bar (hidden in PiP) ── */}
        {!pip && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: isMobile ? "6px 10px" : "8px 16px", background: "#1e293b", borderBottom: "1px solid #334155", flexShrink: 0, flexWrap: "wrap", gap: 6 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
              <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: activeCall.sessionEnded ? "#f59e0b" : "#22c55e", animation: activeCall.sessionEnded ? "none" : "livePulse 1.5s infinite", flexShrink: 0 }} />
              <span style={{ color: "#f8fafc", fontWeight: 600, fontSize: isMobile ? 12 : 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: isMobile ? 140 : 300 }}>{activeCall.sessionTitle}</span>
              {activeCall.sessionEnded
                ? <span style={{ background: "#f59e0b", color: "#fff", fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 4, textTransform: "uppercase", letterSpacing: 1, flexShrink: 0 }}>ENDED</span>
                : <span style={{ background: "#22c55e", color: "#fff", fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 4, textTransform: "uppercase", letterSpacing: 1, flexShrink: 0 }}>LIVE</span>
              }
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              {activeCall.courseId && (
                <button onClick={() => togglePanel("materials")} style={{ background: activePanel === "materials" ? "#3b82f6" : "#334155", color: "#fff", border: "none", borderRadius: 6, padding: isMobile ? "6px 10px" : "6px 12px", cursor: "pointer", fontWeight: 600, fontSize: 13, display: "flex", alignItems: "center", gap: 5, transition: "background 0.2s" }}>
                  <i className="ti ti-file-type-pdf" style={{ fontSize: 15 }} />
                  {!isMobile && "Course Materials"}
                </button>
              )}
              <button onClick={() => togglePanel("attendance")} style={{ background: activePanel === "attendance" ? "#3b82f6" : "#334155", color: "#fff", border: "none", borderRadius: 6, padding: isMobile ? "6px 10px" : "6px 12px", cursor: "pointer", fontWeight: 600, fontSize: 13, display: "flex", alignItems: "center", gap: 5, transition: "background 0.2s" }}>
                <i className="ti ti-clipboard-check" style={{ fontSize: 15 }} />
                {!isMobile && "Attendance"}
              </button>
              {/* Minimize → PiP */}
              <button
                onClick={() => { setPip(true); setActivePanel(null); setSelectedPdf(null); }}
                title="Minimize to corner (keep call running)"
                style={{ background: "#334155", color: "#fff", border: "none", borderRadius: 6, padding: isMobile ? "6px 10px" : "6px 14px", cursor: "pointer", fontWeight: 600, fontSize: 13, display: "flex", alignItems: "center", gap: 5 }}
              >
                <i className="ti ti-picture-in-picture" style={{ fontSize: 15 }} />
                {!isMobile && "Minimize"}
              </button>
              {/* End Session — teacher / admin only */}
              {isTeacherOrAdmin && (
                <button onClick={handleEndSessionClick} style={{ background: "#ef4444", color: "#fff", border: "none", borderRadius: 6, padding: isMobile ? "6px 10px" : "6px 14px", cursor: "pointer", fontWeight: 600, fontSize: 13, display: "flex", alignItems: "center", gap: 5 }}>
                  <i className="ti ti-phone-off" style={{ fontSize: 15 }} />
                  {!isMobile && "End Session"}
                </button>
              )}
              {/* Students/parents: Leave Call */}
              {!isTeacherOrAdmin && (
                <button onClick={() => dispatch(closeCall())} style={{ background: "#ef4444", color: "#fff", border: "none", borderRadius: 6, padding: isMobile ? "6px 10px" : "6px 14px", cursor: "pointer", fontWeight: 600, fontSize: 13, display: "flex", alignItems: "center", gap: 5 }}>
                  <i className="ti ti-x" style={{ fontSize: 15 }} />
                  {!isMobile && "Leave"}
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── Body: iframe + panels ── */}
        <div style={{ flex: 1, display: "flex", overflow: "hidden", position: "relative" }}>
          {/* Iframe wrapper */}
          <div style={{ flex: 1, minWidth: 0, position: "relative", height: "100%" }}>
            {/* Loading spinner (full mode only) */}
            {!loaded && !iframeError && !pip && (
              <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, color: "#94a3b8", zIndex: 1 }}>
                <div className="spinner-border" style={{ width: 48, height: 48, color: "#22c55e", borderWidth: 4 }} role="status" />
                <span style={{ fontSize: 14 }}>Connecting to class room…</span>
              </div>
            )}
            {/* Error state (full mode only) */}
            {iframeError && !pip && (
              <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, background: "#0f172a", color: "#f8fafc", zIndex: 2, padding: 24, textAlign: "center" }}>
                <i className="ti ti-wifi-off" style={{ fontSize: 52, color: "#ef4444" }} />
                <div style={{ fontWeight: 700, fontSize: 18 }}>Could not connect to the class room</div>
                <div style={{ color: "#94a3b8", fontSize: 13, maxWidth: 380 }}>The video server did not respond in time. Please try again.</div>
                <div style={{ display: "flex", gap: 10, marginTop: 8, flexWrap: "wrap", justifyContent: "center" }}>
                  <button onClick={() => { setIframeError(false); setLoaded(false); }} style={{ background: "#3b82f6", color: "#fff", border: "none", borderRadius: 8, padding: "9px 22px", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
                    <i className="ti ti-refresh" style={{ fontSize: 15 }} /> Retry
                  </button>
                  <button onClick={() => dispatch(closeCall())} style={{ background: "#334155", color: "#f8fafc", border: "none", borderRadius: 8, padding: "9px 22px", fontWeight: 600, fontSize: 14, cursor: "pointer" }}>Close</button>
                </div>
              </div>
            )}

            {/* The iframe — always rendered, never hidden */}
            <iframe
              ref={iframeRef}
              src={activeCall.joinUrl}
              style={{
                width: "100%",
                height: "100%",
                border: "none",
                display: "block",
                opacity: (loaded || pip) ? 1 : 0,
                transition: "opacity 0.3s ease",
              }}
              allow="camera *; microphone *; fullscreen *; display-capture *; autoplay *; clipboard-write *; speaker-selection *"
              allowFullScreen
              onLoad={handleIframeLoad}
              title={`Class: ${activeCall.sessionTitle}`}
            />

            {/* PiP overlay — controls on top of the video */}
            {pip && (
              <div style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                pointerEvents: "none",  // allow iframe interaction by default
              }}>
                {/* Top gradient bar with title + restore/close */}
                <div style={{
                  background: "linear-gradient(to bottom, rgba(0,0,0,0.72) 0%, transparent 100%)",
                  padding: "8px 10px 18px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  pointerEvents: "auto",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#22c55e", display: "inline-block", animation: "livePulse 1.5s infinite", flexShrink: 0 }} />
                    <span style={{ color: "#f8fafc", fontSize: 12, fontWeight: 600, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {activeCall.sessionTitle}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 4 }}>
                    {/* Restore */}
                    <button
                      onClick={() => setPip(false)}
                      title="Restore full screen"
                      style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 6, width: 28, height: 28, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", backdropFilter: "blur(4px)" }}
                    >
                      <i className="ti ti-arrows-maximize" style={{ fontSize: 14 }} />
                    </button>
                    {/* End / Leave */}
                    {isTeacherOrAdmin ? (
                      <button
                        onClick={handleEndSessionClick}
                        title="End session"
                        style={{ background: "rgba(239,68,68,0.75)", border: "none", borderRadius: 6, width: 28, height: 28, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}
                      >
                        <i className="ti ti-phone-off" style={{ fontSize: 14 }} />
                      </button>
                    ) : (
                      <button
                        onClick={() => dispatch(closeCall())}
                        title="Leave call"
                        style={{ background: "rgba(239,68,68,0.75)", border: "none", borderRadius: 6, width: 28, height: 28, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}
                      >
                        <i className="ti ti-x" style={{ fontSize: 14 }} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── Course Materials panel (full mode only) ── */}
          {!pip && activePanel === "materials" && (
            <div style={panelStyle}>
              <div style={panelHeader}>
                <span style={{ color: "#f8fafc", fontWeight: 600, fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}>
                  <i className="ti ti-files" style={{ color: "#60a5fa" }} />
                  Course Materials
                </span>
                <button onClick={() => togglePanel("materials")} style={closeBtn}>×</button>
              </div>
              <div style={{ flexShrink: 0, maxHeight: selectedPdf ? 160 : "100%", overflowY: "auto", borderBottom: selectedPdf ? "1px solid #334155" : "none" }}>
                {loadingPdfs ? (
                  <div style={{ padding: 24, textAlign: "center", color: "#64748b", fontSize: 13 }}>
                    <span className="spinner-border spinner-border-sm me-2" /> Loading…
                  </div>
                ) : pdfs.length === 0 ? (
                  <div style={{ padding: 32, textAlign: "center", color: "#64748b", fontSize: 13 }}>
                    <i className="ti ti-file-off" style={{ fontSize: 32, display: "block", marginBottom: 8 }} />
                    No course materials uploaded yet.
                  </div>
                ) : pdfs.map((pdf) => {
                  const isSelected = selectedPdf?.id === pdf.id;
                  return (
                    <div key={pdf.id} onClick={() => setSelectedPdf(isSelected ? null : pdf)}
                      style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", background: isSelected ? "#1d4ed8" : "transparent", borderBottom: "1px solid #2d3f55", cursor: "pointer", transition: "background 0.15s" }}>
                      <i className="ti ti-file-type-pdf" style={{ fontSize: 22, color: "#f87171", flexShrink: 0 }} />
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ color: "#f8fafc", fontSize: 12, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{pdf.originalName}</div>
                        <div style={{ color: "#64748b", fontSize: 11, marginTop: 2 }}>Click to preview</div>
                      </div>
                      <a href={pdfViewUrl(pdf.filePath)} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} style={{ color: "#94a3b8", flexShrink: 0 }}>
                        <i className="ti ti-external-link" style={{ fontSize: 15 }} />
                      </a>
                    </div>
                  );
                })}
              </div>
              {selectedPdf && (
                <iframe key={selectedPdf.id} src={pdfViewUrl(selectedPdf.filePath)} style={{ flex: 1, border: "none", background: "#0f172a" }} title={selectedPdf.originalName} />
              )}
            </div>
          )}

          {/* ── Attendance panel (full mode only) ── */}
          {!pip && activePanel === "attendance" && (
            <div style={panelStyle}>
              <div style={panelHeader}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <i className="ti ti-clipboard-check" style={{ color: "#22c55e", fontSize: 16 }} />
                  <span style={{ color: "#f8fafc", fontWeight: 600, fontSize: 14 }}>Attendance</span>
                  {attendanceSheet && (
                    <span style={{ background: "#334155", color: "#94a3b8", fontSize: 11, padding: "1px 7px", borderRadius: 10 }}>
                      {attendanceSheet.students.length} students
                    </span>
                  )}
                </div>
                <button onClick={() => togglePanel("attendance")} style={closeBtn}>×</button>
              </div>
              {sheetStatus === "loading" ? (
                <div style={{ padding: 32, textAlign: "center", color: "#64748b", fontSize: 13 }}>
                  <span className="spinner-border spinner-border-sm me-2" style={{ color: "#22c55e" }} /> Loading students…
                </div>
              ) : sheetStatus === "failed" ? (
                <div style={{ padding: 24, textAlign: "center", color: "#f87171", fontSize: 13 }}>
                  <i className="ti ti-alert-circle" style={{ fontSize: 28, display: "block", marginBottom: 8 }} />
                  Failed to load attendance sheet.
                </div>
              ) : !attendanceSheet || attendanceSheet.students.length === 0 ? (
                <div style={{ padding: 24, textAlign: "center", color: "#64748b", fontSize: 13 }}>
                  <i className="ti ti-users-group" style={{ fontSize: 32, display: "block", marginBottom: 8 }} />
                  No enrolled students found.
                </div>
              ) : (
                <>
                  <div style={{ padding: "8px 14px", borderBottom: "1px solid #334155", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0, background: "#162032", flexWrap: "wrap", gap: 6 }}>
                    <div style={{ display: "flex", gap: 10 }}>
                      <span style={{ color: "#22c55e", fontSize: 12, fontWeight: 600 }}>✓ {presentCount} Present</span>
                      <span style={{ color: "#f87171", fontSize: 12, fontWeight: 600 }}>✗ {absentCount} Absent</span>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => markAll("Present")} style={{ background: "#166534", color: "#86efac", border: "none", borderRadius: 4, padding: "3px 9px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>All Present</button>
                      <button onClick={() => markAll("Absent")} style={{ background: "#7f1d1d", color: "#fca5a5", border: "none", borderRadius: 4, padding: "3px 9px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>All Absent</button>
                    </div>
                  </div>
                  <div style={{ flex: 1, overflowY: "auto" }}>
                    {attendanceSheet.students.map((student: AttendanceStudent) => {
                      const isPresent = (localStatuses[student.studentId] ?? "Present") === "Present";
                      return (
                        <div key={student.studentId} style={{ display: "flex", alignItems: "center", padding: "10px 14px", borderBottom: "1px solid #1e2d3f", gap: 10, background: isPresent ? "transparent" : "rgba(239,68,68,0.07)" }}>
                          <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#334155", display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                            {student.firstName[0]}{student.lastName?.[0] ?? ""}
                          </div>
                          <span style={{ flex: 1, color: "#e2e8f0", fontSize: 13, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {student.firstName} {student.lastName}
                          </span>
                          <button onClick={() => toggleStudentStatus(student.studentId)}
                            style={{ background: isPresent ? "#166534" : "#7f1d1d", color: isPresent ? "#86efac" : "#fca5a5", border: "none", borderRadius: 6, padding: "4px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer", minWidth: 64, flexShrink: 0, display: "flex", alignItems: "center", gap: 4, justifyContent: "center", transition: "background 0.15s" }}>
                            {isPresent ? <><i className="ti ti-check" style={{ fontSize: 13 }} />Present</> : <><i className="ti ti-x" style={{ fontSize: 13 }} />Absent</>}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ padding: "12px 14px", borderTop: "1px solid #334155", flexShrink: 0 }}>
                    {saveFeedback === "saved" ? (
                      <div style={{ background: "#166534", color: "#86efac", borderRadius: 8, padding: "8px 14px", textAlign: "center", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                        <i className="ti ti-circle-check" style={{ fontSize: 16 }} /> Attendance saved!
                      </div>
                    ) : (
                      <button onClick={handleSaveAttendance} disabled={bulkMarkStatus === "loading"}
                        style={{ width: "100%", background: "#3b82f6", color: "#fff", border: "none", borderRadius: 8, padding: "9px 14px", fontSize: 13, fontWeight: 600, cursor: bulkMarkStatus === "loading" ? "not-allowed" : "pointer", opacity: bulkMarkStatus === "loading" ? 0.7 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                        {bulkMarkStatus === "loading"
                          ? <><span className="spinner-border spinner-border-sm" /> Saving…</>
                          : <><i className="ti ti-device-floppy" style={{ fontSize: 15 }} /> Save Attendance</>}
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── End Session: Step 1 — Confirm ── */}
      {confirmEnd && !showLessonForm && (
        <>
          <div className="modal-backdrop fade show" style={{ zIndex: 9100 }} />
          <div className="modal fade show" style={{ display: "block", zIndex: 9200 }} tabIndex={-1}>
            <div className="modal-dialog modal-dialog-centered modal-sm">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title text-dark fw-bold d-flex align-items-center gap-2">
                    <i className="ti ti-phone-off text-danger fs-18" />
                    End Session?
                  </h5>
                  <button type="button" className="btn-close" onClick={handleCancelEnd} />
                </div>
                <div className="modal-body text-center py-3">
                  <p className="text-muted mb-0" style={{ fontSize: 14 }}>
                    This will end the session for all participants. You&apos;ll be able to share today&apos;s lesson and homework on the next step.
                  </p>
                </div>
                <div className="modal-footer d-flex align-items-center gap-1">
                  <button type="button" className="btn btn-light border" onClick={handleCancelEnd}>Cancel</button>
                  <button type="button" className="btn btn-danger d-flex align-items-center gap-1" onClick={handleProceedToLesson}>
                    <i className="ti ti-arrow-right" />
                    Next
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── End Session: Step 2 — Today's Lesson form ── */}
      {confirmEnd && showLessonForm && (
        <>
          <div className="modal-backdrop fade show" style={{ zIndex: 9100 }} />
          <div className="modal fade show" style={{ display: "block", zIndex: 9200 }} tabIndex={-1}>
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content">
                <div className="modal-header">
                  <h4 className="modal-title text-dark fw-bold d-flex align-items-center gap-2">
                    <i className="ti ti-book-2 fs-18" />
                    Today&apos;s Lesson
                  </h4>
                  <button
                    type="button"
                    className="btn-close custom-btn-close opacity-100"
                    onClick={handleCancelEnd}
                    disabled={ending}
                  >
                    <i className="ti ti-x fs-16 text-dark" />
                  </button>
                </div>
                <div className="modal-body">
                  <p className="text-muted small mb-3">
                    Share lesson notes or homework with your students (optional).
                  </p>
                  <div className="mb-3">
                    <label className="form-label">Lesson Title</label>
                    <input
                      type="text"
                      className="form-control"
                      value={lessonTitle}
                      onChange={(e) => setLessonTitle(e.target.value)}
                      placeholder="e.g. Chapter 4: Algebra Basics"
                      maxLength={200}
                      disabled={ending}
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Description / Homework</label>
                    <textarea
                      className="form-control"
                      value={lessonDescription}
                      onChange={(e) => setLessonDescription(e.target.value)}
                      placeholder="What was covered today? Any homework or reading for next class..."
                      rows={4}
                      disabled={ending}
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">
                      Due Date <span className="text-muted fw-normal">(optional)</span>
                    </label>
                    <DatePicker
                      style={{ width: "100%" }}
                      value={lessonDueDate ? dayjs(lessonDueDate) : null}
                      onChange={(_, ds) => setLessonDueDate(ds as string)}
                      format="YYYY-MM-DD"
                      placeholder="Select due date"
                      disabled={ending}
                    />
                  </div>
                </div>
                <div className="modal-footer d-flex align-items-center gap-1">
                  <button
                    type="button"
                    className="btn btn-light border"
                    onClick={handleCancelEnd}
                    disabled={ending}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={() => handleConfirmEnd(true)}
                    disabled={ending}
                  >
                    Skip &amp; End
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger d-flex align-items-center gap-1"
                    onClick={() => handleConfirmEnd(false)}
                    disabled={ending}
                  >
                    {ending
                      ? <><span className="spinner-border spinner-border-sm" /> Ending…</>
                      : <><i className="ti ti-phone-off" /> End Session</>}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      <style>{`
        @keyframes livePulse {
          0%   { box-shadow: 0 0 0 0 rgba(34,197,94,0.7); }
          70%  { box-shadow: 0 0 0 8px rgba(34,197,94,0); }
          100% { box-shadow: 0 0 0 0 rgba(34,197,94,0); }
        }
        @keyframes panelSlideIn {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </>
  );
}
