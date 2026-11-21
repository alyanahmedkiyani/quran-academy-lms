"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { io, Socket } from "socket.io-client";
import Header from "@/core/common/header/header";
import Sidebar from "@/core/common/sidebar/sidebar";
import Footer from "@/core/common/footer/footer";
import FullScreenLoader from "@/components/common/FullScreenLoader";
import { useAppDispatch, useAppSelector } from "@/core/redux/hooks";
import { setPendingFeedback } from "@/core/redux/calendarSlice";
import CallModal from "@/components/pages/schedule/CallModal";
import FeedbackModal from "@/components/pages/schedule/FeedbackModal";
import LiveSessionNotification from "@/components/pages/schedule/LiveSessionNotification";
import { getLoginRouteForPath } from "@/lib/routing";
import { socket_url } from "@/environment";
import { LiveSessionNotificationPayload } from "@/types/classSchedule";
import { useTimezoneSync } from "@/hooks/useTimezoneSync";

/** localStorage key for persisting pending feedback across page refreshes */
const FEEDBACK_LS_KEY = "lms:pendingFeedback";

export default function PagesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, hydrated } = useAppSelector((state) => state.auth);
  const pendingFeedback = useAppSelector((s) => s.calendar.pendingFeedback);
  // All calendar events — used to subscribe to session rooms
  const events = useAppSelector((s) => s.calendar.events);
  const dispatch = useAppDispatch();
  const router = useRouter();
  const pathname = usePathname();

  // Live session toast shown at layout level for students so it appears on every page
  const [liveNotification, setLiveNotification] = useState<LiveSessionNotificationPayload | null>(null);
  const handleDismissLiveNotification = useCallback(() => setLiveNotification(null), []);

  // Always-on socket for students
  const socketRef = useRef<Socket | null>(null);
  // Ref so socket handlers always see the latest events without stale closures
  const eventsRef = useRef(events);
  useEffect(() => { eventsRef.current = events; }, [events]);

  // Sync browser timezone to user profile (DB + Redux + localStorage) once per session
  useTimezoneSync();

  // Derive lowercase role and userId for call components
  const callRole = (user?.userType ?? "").toLowerCase();
  const callUserId = user ? String(user.id) : "";

  useEffect(() => {
    if (!hydrated) return;
    if (!user) {
      router.replace(getLoginRouteForPath(pathname));
    }
  }, [hydrated, user, router, pathname]);

  // On mount: restore pendingFeedback from localStorage so it survives page refresh
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = window.localStorage.getItem(FEEDBACK_LS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.sessionId && parsed?.sessionTitle) {
          dispatch(setPendingFeedback(parsed));
        }
      }
    } catch { /* ignore */ }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep pendingFeedback in sync with localStorage so a page refresh doesn't lose it
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (pendingFeedback) {
        window.localStorage.setItem(FEEDBACK_LS_KEY, JSON.stringify(pendingFeedback));
      } else {
        window.localStorage.removeItem(FEEDBACK_LS_KEY);
      }
    } catch { /* ignore */ }
  }, [pendingFeedback]);

  // Always-on socket for students.
  // This replaces the old activeCall-gated socket so students receive session:ended
  // even when they:
  //   (a) never joined the call (just dismissed the live notification toast)
  //   (b) navigated away from the schedule page (LMSCalendar unmounted)
  //   (c) closed the CallModal before the teacher ended the session
  useEffect(() => {
    if (callRole !== "student" || !callUserId) {
      // Not a student — tear down any existing socket and bail
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      return;
    }

    const sock = io(socket_url, {
      path: "/chat/socket.io/",
      transports: ["websocket"],
    });
    socketRef.current = sock;

    sock.on("connect", () => {
      // Subscribe to all session rooms visible in the calendar
      const sessionIds = eventsRef.current
        .filter((e) => e.extendedProps.type === "class" && e.extendedProps.sessionId)
        .map((e) => e.extendedProps.sessionId);
      if (sessionIds.length > 0) {
        sock.emit("subscribe:sessions", sessionIds);
      }
    });

    // Show live toast from layout so it appears on every page (not just schedule page)
    sock.on("session:started", (payload: LiveSessionNotificationPayload) => {
      setLiveNotification(payload);
    });

    sock.on("session:ended", (payload: {
      sessionId: number;
      title?: string;
      cancelled?: boolean;
      lessonTitle?: string | null;
      lessonDescription?: string | null;
      lessonDueDate?: string | null;
    }) => {
      // No feedback popup for cancelled sessions
      if (payload.cancelled) return;
      const matchedEvent = eventsRef.current.find(
        (e) => e.extendedProps.type === "class" && e.extendedProps.sessionId === payload.sessionId
      );
      const sessionTitle = payload.title || matchedEvent?.title || "Class Session";
      dispatch(setPendingFeedback({
        sessionId: payload.sessionId,
        sessionTitle,
        lessonTitle: payload.lessonTitle ?? null,
        lessonDescription: payload.lessonDescription ?? null,
        lessonDueDate: payload.lessonDueDate ?? null,
      }));
    });

    return () => {
      sock.disconnect();
      socketRef.current = null;
    };
  }, [callRole, callUserId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-subscribe when calendar events change (student navigates to a new month
  // and new sessions are loaded into the store)
  useEffect(() => {
    const sock = socketRef.current;
    if (!sock || !sock.connected || callRole !== "student") return;
    const sessionIds = events
      .filter((e) => e.extendedProps.type === "class" && e.extendedProps.sessionId)
      .map((e) => e.extendedProps.sessionId);
    if (sessionIds.length > 0) {
      sock.emit("subscribe:sessions", sessionIds);
    }
  }, [events, callRole]);

  if (!hydrated || !user) {
    return <FullScreenLoader />;
  }

  return (
    <div className="main-wrapper d-flex flex-column min-vh-100">
      <Header />
      <Sidebar />
      {/* <ThemeSettings /> */}
      <div className="main-content flex-fill d-flex flex-column">
        <div className="flex-fill d-flex flex-column">{children}</div>
        <Footer />
      </div>

      {/* Global call overlay — persists across page navigation so PiP mode
          keeps the call alive when the user browses the dashboard            */}
      <CallModal role={callRole} userId={callUserId} />

      {/* Live session notification toast for students — shown on every page   */}
      {liveNotification && callRole === "student" && (
        <LiveSessionNotification
          notification={liveNotification}
          userId={callUserId}
          role={callRole}
          onDismiss={handleDismissLiveNotification}
        />
      )}

      {/* Feedback modal — shown to students after a session ends             */}
      {pendingFeedback && callRole === "student" && (
        <FeedbackModal
          session={pendingFeedback}
          studentId={Number(callUserId)}
          onClose={() => dispatch(setPendingFeedback(null))}
        />
      )}
    </div>
  );
}
