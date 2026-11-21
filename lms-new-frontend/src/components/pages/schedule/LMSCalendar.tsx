"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import listPlugin from "@fullcalendar/list";
import multiMonthPlugin from "@fullcalendar/multimonth";
import interactionPlugin from "@fullcalendar/interaction";
import type { DateClickArg } from "@fullcalendar/interaction";
import type { EventClickArg, DatesSetArg } from "@fullcalendar/core";

import { useAppDispatch, useAppSelector } from "@/core/redux/hooks";
import {
  fetchCalendarEventsThunk,
  fetchPendingApprovalsThunk,
  approveScheduleThunk,
  resetApproveStatus,
  markSessionLiveOptimistic,
  markActiveCallEnded,
  closeCall,
  setSelectedShift,
} from "@/core/redux/calendarSlice";

import { CalendarEvent, UserRole, LiveSessionNotificationPayload, Shift } from "@/types/classSchedule";
import { socket_url } from "@/environment";
import EventDetailModal from "./EventDetailModal";
import CreateScheduleModal from "./CreateScheduleModal";
import ProposeSessionModal from "./ProposeSessionModal";
import LiveSessionNotification from "./LiveSessionNotification";

interface LMSCalendarProps {
  role: UserRole;
  userId: string;
  userTimezone?: string;
  /** Student's own assigned shift — used to show mismatch warning on event tiles */
  userShift?: Shift | null;
  /** If false, hides admin create/approve actions even when role==="admin" */
  canManage?: boolean;
}

// Legend entries
const LEGEND = [
  { color: "#3B82F6", label: "Class" },
  { color: "#22C55E", label: "Live" },
  { color: "#EF4444", label: "Cancelled" },
  { color: "#8B5CF6", label: "Makeup" },
  { color: "#F59E0B", label: "Pending" },
  { color: "#10B981", label: "Quiz" },
  { color: "#F97316", label: "Assignment" },
];

export default function LMSCalendar({ role, userId, userTimezone, userShift, canManage = true }: LMSCalendarProps) {
  // Fall back to the browser's own IANA timezone when the DB field is not set.
  // This ensures every user always sees times in their local timezone automatically.
  const effectiveTz = userTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone;

  const adminCanManage = role === "admin" && canManage;
  const dispatch = useAppDispatch();
  const { events, eventsStatus, eventsError, pendingApprovals, pendingStatus, approveStatus, selectedShift } =
    useAppSelector((s) => s.calendar);
  const activeCall = useAppSelector((s) => s.calendar.activeCall);

  const calendarRef = useRef<FullCalendar>(null);
  // Ref so the socket event handler always sees the current activeCall without
  // being recreated every time activeCall changes.
  const activeCallRef = useRef(activeCall);
  useEffect(() => { activeCallRef.current = activeCall; }, [activeCall]);

  // Ref so the socket's on("connect") handler always sees the current events
  // (including on reconnect). The socket useEffect only re-runs on userId/role
  // change, so without a ref the closure captures the stale empty initial events.
  const eventsRef = useRef(events);
  useEffect(() => { eventsRef.current = events; }, [events]);

  // Date range currently visible in the calendar
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
    start: "",
    end: "",
  });

  // Selected event for EventDetailModal
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  // Date clicked for CreateSchedule / ProposeSession modals
  const [clickedDate, setClickedDate] = useState<string>("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showProposeModal, setShowProposeModal] = useState(false);

  // Live session notifications (students/teachers only)
  const [liveNotification, setLiveNotification] = useState<LiveSessionNotificationPayload | null>(null);
  // Stable reference — inline arrow would recreate on every render, restarting the
  // 30-second auto-dismiss interval inside LiveSessionNotification's useEffect([onDismiss]).
  const handleDismissLiveNotification = useCallback(() => setLiveNotification(null), []);

  // Shown when admin/teacher remotely cancels a session the user is currently in
  const [sessionCancelledInfo, setSessionCancelledInfo] = useState<{
    cancelledBy: string;
    reason: string;
  } | null>(null);

  // Responsive breakpoint
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Socket.IO ref
  const socketRef = useRef<Socket | null>(null);

  // Fetch events when dateRange changes.
  // effectiveTz must be in deps — if the timezone prop changes (e.g. after
  // useTimezoneSync updates Redux), the callback must be recreated so events
  // are re-fetched with the correct timezone instead of a stale one.
  const fetchEvents = useCallback(
    (start: string, end: string) => {
      if (!userId || !start || !end) return;
      dispatch(
        fetchCalendarEventsThunk({
          userId,
          role,
          start,
          end,
          timezone: effectiveTz,
        })
      );
    },
    [dispatch, userId, role, effectiveTz]
  );

  // Fetch pending approvals for admin
  useEffect(() => {
    if (role === "admin") {
      dispatch(fetchPendingApprovalsThunk());
    }
  }, [dispatch, role]);

  // Re-fetch when dateRange changes
  useEffect(() => {
    if (dateRange.start && dateRange.end) {
      fetchEvents(dateRange.start, dateRange.end);
    }
  }, [dateRange, fetchEvents]);

  // Socket.IO: connect and subscribe to session rooms for live notifications
  useEffect(() => {
    const sock = io(socket_url, {
      path: "/chat/socket.io/",
      transports: ["websocket"],
    });
    socketRef.current = sock;

    sock.on("connect", () => {
      // Subscribe to all current session rooms.
      // Use eventsRef.current so this works correctly on reconnect too
      // (the closure would otherwise capture the stale empty events from mount).
      const sessionIds = eventsRef.current
        .filter((e) => e.extendedProps.type === "class" && e.extendedProps.sessionId)
        .map((e) => e.extendedProps.sessionId);
      if (sessionIds.length > 0) {
        sock.emit("subscribe:sessions", sessionIds);
      }
    });

    sock.on("session:started", (payload: LiveSessionNotificationPayload) => {
      // Optimistically mark the event as live in Redux
      dispatch(markSessionLiveOptimistic({ sessionId: payload.sessionId, sessionStatus: "live" }));
      // Students receive the live notification via layout.tsx (always-on socket).
      // Show toast here only for teachers who didn't start the session themselves.
      const alreadyInCall = activeCallRef.current?.sessionId === payload.sessionId;
      if (role === "teacher" && !alreadyInCall) {
        setLiveNotification(payload);
      }
    });

    sock.on("session:ended", (payload: {
      sessionId: number;
      title?: string;
      cancelled?: boolean;
      cancelledBy?: string;
      reason?: string;
      autoEnded?: boolean;
    }) => {
      // 1. Update calendar event color → gray
      dispatch(markSessionLiveOptimistic({ sessionId: payload.sessionId, sessionStatus: "ended" }));
      // 2. Clear live notification toast if it was showing for this session
      setLiveNotification((prev) =>
        prev?.sessionId === payload.sessionId ? null : prev
      );

      const inThisCall = activeCallRef.current?.sessionId === payload.sessionId;

      if (payload.cancelled) {
        // Cancellation: close CallModal (any role) + show "Session Cancelled" dialog
        if (inThisCall) {
          dispatch(closeCall());
          setSessionCancelledInfo({
            cancelledBy: payload.cancelledBy || "Admin",
            reason: payload.reason || "",
          });
        }
      } else {
        // Normal session end
        if (inThisCall) {
          if (role === "student") {
            // Students: force-close the CallModal immediately
            dispatch(closeCall());
          } else {
            // Teachers/admins: don't force-close — let them save attendance first.
            // Mark the call as ended so CallModal shows an "ended" banner.
            dispatch(markActiveCallEnded());
          }
        }
        // Note: setPendingFeedback for students is handled by the always-on socket
        // in layout.tsx to ensure it fires even when the student is on another page.
      }
    });

    return () => {
      sock.disconnect();
      socketRef.current = null;
    };
    // Re-run if userId or role changes (login/logout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, role]);

  // Re-subscribe when events change (new sessions loaded)
  useEffect(() => {
    const sock = socketRef.current;
    if (!sock || !sock.connected) return;
    const sessionIds = events
      .filter((e) => e.extendedProps.type === "class" && e.extendedProps.sessionId)
      .map((e) => e.extendedProps.sessionId);
    if (sessionIds.length > 0) {
      sock.emit("subscribe:sessions", sessionIds);
    }
  }, [events, role]);

  const handleDatesSet = (arg: DatesSetArg) => {
    // Use startStr/endStr — these are ISO strings in the calendar's display timezone,
    // so slicing gives the correct local date instead of a UTC-shifted date.
    const start = arg.startStr.slice(0, 10);
    const end = arg.endStr.slice(0, 10);
    setDateRange({ start, end });
  };

  const handleEventClick = (clickInfo: EventClickArg) => {
    const raw = clickInfo.event;
    const event: CalendarEvent = {
      id: raw.id,
      title: raw.title,
      start: raw.startStr,
      end: raw.endStr,
      backgroundColor: raw.backgroundColor,
      borderColor: raw.borderColor,
      allDay: raw.allDay,
      extendedProps: raw.extendedProps as CalendarEvent["extendedProps"],
    };
    setSelectedEvent(event);
  };

  const handleDateClick = (arg: DateClickArg) => {
    if (adminCanManage) {
      setClickedDate(arg.dateStr);
      setShowCreateModal(true);
    } else if (role === "teacher") {
      setClickedDate(arg.dateStr);
      setShowProposeModal(true);
    }
    // student / parent: no action on date click
  };

  const handleRefresh = () => {
    if (dateRange.start && dateRange.end) {
      fetchEvents(dateRange.start, dateRange.end);
    }
    if (role === "admin") {
      dispatch(fetchPendingApprovalsThunk());
    }
  };

  const handleApprove = async (scheduleId: number) => {
    await dispatch(approveScheduleThunk(String(scheduleId))).unwrap();
    dispatch(resetApproveStatus());
    dispatch(fetchPendingApprovalsThunk());
    handleRefresh();
  };

  const isLoading = eventsStatus === "loading";

  // Shift colors for badges
  const SHIFT_COLORS: Record<Shift, string> = {
    Morning: "#F59E0B",
    Afternoon: "#3B82F6",
    Evening: "#8B5CF6",
  };

  // Filter events by selected shift (client-side for admin/teacher; students are already filtered server-side)
  const filteredEvents = selectedShift === "All"
    ? events
    : events.filter((e) => !e.extendedProps.shift || e.extendedProps.shift === selectedShift);

  return (
    <div className="page-wrapper">
      <div className="content">
        {/* ---------------------------------------------------------------- */}
        {/* Page header                                                       */}
        {/* ---------------------------------------------------------------- */}
        <div className="d-flex align-items-sm-center flex-sm-row flex-column gap-2 pb-3 mb-3 border-bottom">
          <div className="flex-grow-1">
            <h4 className="fw-bold mb-0">
              {role === "admin" && "Class Schedule"}
              {role === "teacher" && "My Schedule"}
              {role === "student" && "My Calendar"}
              {role === "parent" && "My Child's Schedule"}
              {isLoading && (
                <span className="spinner-border spinner-border-sm ms-2 text-primary" />
              )}
            </h4>
            <p className="text-muted mb-0 mt-1" style={{ fontSize: 13 }}>
              {role === "admin" && "Manage all class sessions, quizzes, and assignments"}
              {role === "teacher" && "Your upcoming and active class sessions"}
              {role === "student" && "Classes, quizzes, and assignment due dates"}
              {role === "parent" && "Your child's class schedule and assessments"}
            </p>
            {/* Timezone indicator — lets every user know which timezone they're viewing */}
            <div className="mt-1 d-flex align-items-center gap-1" style={{ fontSize: 11, color: "#6B7280" }}>
              <i className="ti ti-clock-pin" style={{ fontSize: 12 }} />
              <span>
                Times in&nbsp;
                <strong style={{ color: "#374151" }}>{effectiveTz}</strong>
                &nbsp;(
                {new Intl.DateTimeFormat("en-US", { timeZone: effectiveTz, timeZoneName: "shortOffset" })
                  .formatToParts(new Date())
                  .find((p) => p.type === "timeZoneName")?.value ?? ""}
                )
              </span>
            </div>
          </div>

          <div className="d-flex gap-2">
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm d-inline-flex align-items-center gap-1"
              onClick={handleRefresh}
              disabled={isLoading}
            >
              <i className="ti ti-refresh" />
              Refresh
            </button>

            {adminCanManage && (
              <button
                type="button"
                className="btn btn-primary btn-sm d-inline-flex align-items-center gap-1"
                onClick={() => {
                  setClickedDate("");
                  setShowCreateModal(true);
                }}
              >
                <i className="ti ti-plus" />
                New Schedule
              </button>
            )}

            {role === "teacher" && (
              <button
                type="button"
                className="btn btn-warning btn-sm text-white d-inline-flex align-items-center gap-1"
                onClick={() => {
                  setClickedDate("");
                  setShowProposeModal(true);
                }}
              >
                <i className="ti ti-send" />
                Propose Session
              </button>
            )}
          </div>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Admin: pending approvals banner                                   */}
        {/* ---------------------------------------------------------------- */}
        {adminCanManage && pendingApprovals.length > 0 && (
          <div className="alert alert-warning mb-3">
            <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
              <div>
                <i className="ti ti-clock me-2" />
                <strong>{pendingApprovals.length}</strong> teacher session proposal
                {pendingApprovals.length !== 1 ? "s" : ""} awaiting your approval
              </div>
            </div>
            <div className="mt-2">
              {pendingApprovals.map((schedule) => (
                <div
                  key={schedule.id}
                  className="d-flex align-items-center justify-content-between gap-2 py-1 border-top border-warning-subtle"
                  style={{ flexWrap: "wrap" }}
                >
                  <div style={{ fontSize: 13, flex: 1, minWidth: 0 }}>
                    <strong>{schedule.title}</strong>
                    {schedule.Teacher && (
                      <span className="text-muted ms-2">
                        by {schedule.Teacher.firstName} {schedule.Teacher.lastName}
                      </span>
                    )}
                    <span className="text-muted ms-2">on {schedule.startDate}</span>
                    {schedule.Course && (
                      <span className="badge badge-soft-secondary border ms-2">
                        {schedule.Course.courseName}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    className="btn btn-sm btn-success"
                    onClick={() => handleApprove(schedule.id)}
                    disabled={approveStatus === "loading"}
                    style={{ flexShrink: 0 }}
                  >
                    <i className="ti ti-check me-1" />
                    Approve
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* Event error                                                       */}
        {/* ---------------------------------------------------------------- */}
        {eventsError && (
          <div className="alert alert-danger mb-3">
            <i className="ti ti-alert-circle me-2" />
            {eventsError}
          </div>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* Color legend                                                      */}
        {/* ---------------------------------------------------------------- */}
        <div className="d-flex gap-3 flex-wrap mb-3">
          {LEGEND.map((l) => (
            <div key={l.label} className="d-flex align-items-center gap-1">
              <span
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 3,
                  background: l.color,
                  display: "inline-block",
                }}
              />
              <span style={{ fontSize: 12, color: "#6B7280" }}>{l.label}</span>
            </div>
          ))}
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Date quick-filter bar                                             */}
        {/* ---------------------------------------------------------------- */}
        <div className="d-flex align-items-center gap-2 mb-3 flex-wrap">
          <span className="small fw-medium text-muted">Jump to:</span>
          {([
            { label: "Today",      view: "timeGridDay",   offset: 0  },
            { label: "This Week",  view: "timeGridWeek",  offset: 0  },
            { label: "This Month", view: "dayGridMonth",  offset: 0  },
            { label: "Next Week",  view: "timeGridWeek",  offset: 7  },
            { label: "Next Month", view: "dayGridMonth",  offset: 30 },
          ] as const).map(({ label, view, offset }) => (
            <button
              key={label}
              type="button"
              className="btn btn-sm btn-outline-secondary"
              style={{ borderRadius: 20, minHeight: 36 }}
              onClick={() => {
                const api = calendarRef.current?.getApi();
                if (!api) return;
                const d = new Date();
                d.setDate(d.getDate() + offset);
                api.changeView(view, d);
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Shift filter bar                                                  */}
        {/* ---------------------------------------------------------------- */}
        <div className="d-flex align-items-center gap-2 mb-3 flex-wrap">
          <span className="small fw-medium text-muted">Shift:</span>
          {(["All", "Morning", "Afternoon", "Evening"] as const).map((s) => {
            const isActive = selectedShift === s;
            const shiftColor = s !== "All" ? SHIFT_COLORS[s] : "#6B7280";
            return (
              <button
                key={s}
                type="button"
                onClick={() => dispatch(setSelectedShift(s))}
                style={{
                  borderRadius: 20,
                  border: `2px solid ${isActive ? shiftColor : "#D1D5DB"}`,
                  background: isActive ? shiftColor : "transparent",
                  color: isActive ? "#fff" : "#374151",
                  fontWeight: isActive ? 600 : 400,
                  cursor: "pointer",
                  transition: "all 0.15s",
                  minHeight: 36,
                  padding: "4px 14px",
                  fontSize: 13,
                }}
              >
                {s === "Morning" && "☀️ "}
                {s === "Afternoon" && "🌤️ "}
                {s === "Evening" && "🌙 "}
                {s}
              </button>
            );
          })}
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* FullCalendar                                                      */}
        {/* ---------------------------------------------------------------- */}
        <div
          className="card shadow-sm"
          style={{ position: "relative", overflowX: "hidden" }}
        >
          {/* Loading overlay */}
          {isLoading && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: "rgba(255,255,255,0.6)",
                zIndex: 10,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 8,
              }}
            >
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Loading…</span>
              </div>
            </div>
          )}

          <div className="card-body p-1 p-md-3">
            <FullCalendar
              ref={calendarRef}
              plugins={[dayGridPlugin, timeGridPlugin, listPlugin, multiMonthPlugin, interactionPlugin]}
              initialView={isMobile ? "listWeek" : "dayGridMonth"}
              headerToolbar={isMobile ? {
                start: "today,prev,next",
                center: "title",
                end: "dayGridMonth,timeGridDay,listWeek",
              } : {
                start: "today,prev,next",
                center: "title",
                end: "multiMonthYear,dayGridMonth,timeGridWeek,timeGridDay,listWeek",
              }}
              buttonText={{
                today: "Today",
                month: "Month",
                week: "Week",
                day: "Day",
                list: "Agenda",
                year: "Year",
              }}
              multiMonthMaxColumns={isMobile ? 1 : 3}
              events={filteredEvents}
              datesSet={handleDatesSet}
              eventClick={handleEventClick}
              dateClick={role === "admin" || role === "teacher" ? handleDateClick : undefined}
              // Timezone: DB field → browser timezone → PKT fallback
              timeZone={effectiveTz}
              height="auto"
              // Make events look nicer
              eventDisplay="block"
              dayMaxEvents={isMobile ? 2 : 4}
              moreLinkClick="popover"
              nowIndicator
              // Hint for clickable dates on admin/teacher
              selectable={role === "admin" || role === "teacher"}
              selectMirror
              // Style
              eventBorderColor="transparent"
              eventTextColor="#fff"
              eventContent={(arg) => {
                const shift = arg.event.extendedProps.shift as Shift | null | undefined;
                const shiftMismatch =
                  role === "student" &&
                  userShift &&
                  shift &&
                  shift !== userShift;
                return (
                  <div style={{ display: "flex", flexDirection: "column", padding: "1px 3px", minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 3, minWidth: 0 }}>
                      <span style={{ fontWeight: 600, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                        {arg.event.title}
                      </span>
                      {shiftMismatch && (
                        <span
                          title={`This session is in the ${shift} shift, but you are assigned to the ${userShift} shift`}
                          style={{ fontSize: 12, lineHeight: 1, flexShrink: 0 }}
                        >
                          ⚠️
                        </span>
                      )}
                    </div>
                    {shift && (
                      <span style={{
                        display: "inline-block",
                        background: "rgba(255,255,255,0.25)",
                        borderRadius: 8,
                        padding: "0px 5px",
                        fontSize: 10,
                        fontWeight: 600,
                        marginTop: 1,
                        width: "fit-content",
                        letterSpacing: 0.3,
                      }}>
                        {shift}
                      </span>
                    )}
                  </div>
                );
              }}
            />
          </div>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Modals                                                            */}
        {/* ---------------------------------------------------------------- */}
        <EventDetailModal
          event={selectedEvent}
          role={role}
          onClose={() => setSelectedEvent(null)}
          calendarParams={{ userId, role, start: dateRange.start, end: dateRange.end, timezone: effectiveTz }}
        />

        {adminCanManage && (
          <CreateScheduleModal
            open={showCreateModal}
            defaultDate={clickedDate}
            onClose={() => setShowCreateModal(false)}
            onSuccess={handleRefresh}
          />
        )}

        {role === "teacher" && (
          <ProposeSessionModal
            open={showProposeModal}
            defaultDate={clickedDate}
            teacherId={Number(userId)}
            onClose={() => setShowProposeModal(false)}
            onSuccess={handleRefresh}
          />
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Live session notification toast (students only)                    */}
      {/* ------------------------------------------------------------------ */}
      {/* Students get live notifications from layout.tsx (always-on socket).
          Here we only show the toast for teachers who didn't start the session. */}
      {liveNotification && role === "teacher" && (
        <LiveSessionNotification
          notification={liveNotification}
          userId={userId}
          role={role}
          onDismiss={handleDismissLiveNotification}
        />
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Session cancelled while user was in a call — message box           */}
      {/* ------------------------------------------------------------------ */}
      {sessionCancelledInfo && (
        <>
          {/* Backdrop */}
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.65)",
              zIndex: 9300,
            }}
          />
          {/* Dialog */}
          <div
            style={{
              position: "fixed",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              background: "#1e293b",
              border: "1px solid #334155",
              borderRadius: 14,
              padding: "24px 20px",
              zIndex: 9400,
              width: "min(420px, calc(100vw - 32px))",
              textAlign: "center",
            }}
          >
            <i
              className="ti ti-alert-triangle"
              style={{
                fontSize: 40,
                color: "#f59e0b",
                display: "block",
                marginBottom: 14,
              }}
            />
            <div
              style={{
                color: "#f8fafc",
                fontWeight: 700,
                fontSize: 18,
                marginBottom: 10,
              }}
            >
              Session Cancelled
            </div>
            <div style={{ color: "#94a3b8", fontSize: 14, marginBottom: 8 }}>
              This session was cancelled by the{" "}
              <span style={{ color: "#f8fafc", fontWeight: 600 }}>
                {sessionCancelledInfo.cancelledBy}
              </span>
              .
            </div>
            {sessionCancelledInfo.reason && (
              <div
                style={{
                  color: "#64748b",
                  fontSize: 13,
                  marginBottom: 8,
                  fontStyle: "italic",
                }}
              >
                &ldquo;{sessionCancelledInfo.reason}&rdquo;
              </div>
            )}
            <div style={{ color: "#64748b", fontSize: 12, marginBottom: 24 }}>
              You have been disconnected from the class room.
            </div>
            <button
              onClick={() => setSessionCancelledInfo(null)}
              style={{
                background: "#3b82f6",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                padding: "9px 28px",
                fontWeight: 600,
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              OK
            </button>
          </div>
        </>
      )}

    </div>
  );
}
