import { createAsyncThunk, createSlice, PayloadAction } from "@reduxjs/toolkit";
import {
  getCalendarEvents,
  createSchedule,
  proposeSession,
  approveSchedule,
  cancelSession,
  cancelSchedule,
  getPendingApprovals,
  updateSession,
  UpdateSessionPayload,
} from "@/services/classScheduleService";
import {
  CalendarEvent,
  ClassSchedule,
  CreateSchedulePayload,
  ProposeSessionPayload,
  GetCalendarEventsParams,
  Shift,
} from "@/types/classSchedule";

type AsyncStatus = "idle" | "loading" | "succeeded" | "failed";

interface ActiveCall {
  sessionId: number;
  joinUrl: string;
  sessionTitle: string;
  courseId?: number | null;
  /** Set to true when the session ends while user is still in CallModal */
  sessionEnded?: boolean;
}

interface CalendarState {
  events: CalendarEvent[];
  eventsStatus: AsyncStatus;
  eventsError: string | null;

  pendingApprovals: ClassSchedule[];
  pendingStatus: AsyncStatus;
  pendingError: string | null;

  createStatus: AsyncStatus;
  createError: string | null;

  proposeStatus: AsyncStatus;
  proposeError: string | null;

  approveStatus: AsyncStatus;
  approveError: string | null;

  cancelStatus: AsyncStatus;
  cancelError: string | null;

  /** Active calling session displayed in the CallModal */
  activeCall: ActiveCall | null;
  /** Currently selected shift filter — 'All' means no filter */
  selectedShift: Shift | 'All';
  /** Session for which feedback should be shown (student only) */
  pendingFeedback: { sessionId: number; sessionTitle: string; lessonTitle?: string | null; lessonDescription?: string | null; lessonDueDate?: string | null } | null;
}

const initialState: CalendarState = {
  events: [],
  eventsStatus: "idle",
  eventsError: null,

  pendingApprovals: [],
  pendingStatus: "idle",
  pendingError: null,

  createStatus: "idle",
  createError: null,

  proposeStatus: "idle",
  proposeError: null,

  approveStatus: "idle",
  approveError: null,

  cancelStatus: "idle",
  cancelError: null,

  activeCall: null,
  selectedShift: 'All',
  pendingFeedback: null,
};

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message || fallback);
  }
  return fallback;
};

// ---------------------------------------------------------------------------
// Thunks
// ---------------------------------------------------------------------------

export const fetchCalendarEventsThunk = createAsyncThunk<
  CalendarEvent[],
  GetCalendarEventsParams,
  { rejectValue: string }
>("calendar/fetchEvents", async (params, { rejectWithValue }) => {
  try {
    return await getCalendarEvents(params);
  } catch (error) {
    return rejectWithValue(getErrorMessage(error, "Unable to load calendar events."));
  }
});

export const createScheduleThunk = createAsyncThunk<
  { sessionCount: number; message: string },
  CreateSchedulePayload,
  { rejectValue: string }
>("calendar/createSchedule", async (payload, { rejectWithValue }) => {
  try {
    const result = await createSchedule(payload);
    return { sessionCount: result.sessionCount, message: result.message };
  } catch (error) {
    return rejectWithValue(getErrorMessage(error, "Unable to create schedule."));
  }
});

export const proposeSessionThunk = createAsyncThunk<
  { message: string },
  ProposeSessionPayload,
  { rejectValue: string }
>("calendar/proposeSession", async (payload, { rejectWithValue }) => {
  try {
    const result = await proposeSession(payload);
    return { message: result.message };
  } catch (error) {
    return rejectWithValue(getErrorMessage(error, "Unable to propose session."));
  }
});

export const approveScheduleThunk = createAsyncThunk<
  { message: string },
  string,
  { rejectValue: string }
>("calendar/approveSchedule", async (id, { rejectWithValue }) => {
  try {
    const result = await approveSchedule(id);
    return { message: result.message };
  } catch (error) {
    return rejectWithValue(getErrorMessage(error, "Unable to approve schedule."));
  }
});

export const cancelSessionThunk = createAsyncThunk<
  { sessionId: string; message: string },
  { sessionId: string; reason?: string; cancelledByRole?: string },
  { rejectValue: string }
>("calendar/cancelSession", async ({ sessionId, reason, cancelledByRole }, { rejectWithValue }) => {
  try {
    const result = await cancelSession(sessionId, reason, cancelledByRole);
    return { sessionId, message: result.message };
  } catch (error) {
    return rejectWithValue(getErrorMessage(error, "Unable to cancel session."));
  }
});

export const cancelScheduleThunk = createAsyncThunk<
  { message: string },
  { id: string; reason?: string; cancelledByRole?: string },
  { rejectValue: string }
>("calendar/cancelSchedule", async ({ id, reason, cancelledByRole }, { rejectWithValue }) => {
  try {
    const result = await cancelSchedule(id, reason, cancelledByRole);
    return { message: result.message };
  } catch (error) {
    return rejectWithValue(getErrorMessage(error, "Unable to cancel schedule."));
  }
});

export const fetchPendingApprovalsThunk = createAsyncThunk<
  ClassSchedule[],
  void,
  { rejectValue: string }
>("calendar/fetchPendingApprovals", async (_, { rejectWithValue }) => {
  try {
    return await getPendingApprovals();
  } catch (error) {
    return rejectWithValue(getErrorMessage(error, "Unable to load pending approvals."));
  }
});

export const updateSessionThunk = createAsyncThunk<
  { message: string; sessionId: number },
  { sessionId: number; payload: UpdateSessionPayload },
  { rejectValue: string }
>("calendar/updateSession", async ({ sessionId, payload }, { rejectWithValue }) => {
  try {
    const result = await updateSession(sessionId, payload);
    return { message: (result as { message: string }).message, sessionId };
  } catch (error) {
    return rejectWithValue(getErrorMessage(error, "Unable to update session."));
  }
});

// ---------------------------------------------------------------------------
// Slice
// ---------------------------------------------------------------------------
const calendarSlice = createSlice({
  name: "calendar",
  initialState,
  reducers: {
    resetCreateStatus: (state) => {
      state.createStatus = "idle";
      state.createError = null;
    },
    resetProposeStatus: (state) => {
      state.proposeStatus = "idle";
      state.proposeError = null;
    },
    resetApproveStatus: (state) => {
      state.approveStatus = "idle";
      state.approveError = null;
    },
    resetCancelStatus: (state) => {
      state.cancelStatus = "idle";
      state.cancelError = null;
    },
    // Optimistically mark a session as cancelled in the events list
    markSessionCancelledOptimistic: (state, action: PayloadAction<{ sessionId: number; reason: string }>) => {
      const event = state.events.find(
        (e) => e.id === `session-${action.payload.sessionId}`
      );
      if (event) {
        event.extendedProps.status = "cancelled";
        event.extendedProps.cancellationReason = action.payload.reason;
        // Reset sessionStatus so the LIVE badge never appears on a cancelled session
        event.extendedProps.sessionStatus = "ended";
        event.backgroundColor = "#EF4444";
        event.borderColor = "#EF4444";
      }
    },
    // Calling: open the CallModal with a join URL
    openCall: (state, action: PayloadAction<ActiveCall>) => {
      state.activeCall = action.payload;
    },
    // Calling: close the CallModal
    closeCall: (state) => {
      state.activeCall = null;
    },
    // Mark the active call as ended (session over) without forcing close — lets teacher save attendance
    markActiveCallEnded: (state) => {
      if (state.activeCall) {
        state.activeCall.sessionEnded = true;
      }
    },
    // Set the active shift filter
    setSelectedShift: (state, action: PayloadAction<Shift | 'All'>) => {
      state.selectedShift = action.payload;
    },
    // Set a pending feedback session (shown as popup to students after session ends)
    setPendingFeedback: (state, action: PayloadAction<{ sessionId: number; sessionTitle: string; lessonTitle?: string | null; lessonDescription?: string | null; lessonDueDate?: string | null } | null>) => {
      state.pendingFeedback = action.payload;
    },
    // Optimistically update session fields (title, date, time, shift) in events list after edit
    markSessionUpdatedOptimistic: (state, action: PayloadAction<{ sessionId: number } & UpdateSessionPayload>) => {
      const { sessionId, title, date, startTime, endTime, shift } = action.payload;
      const event = state.events.find((e) => e.id === `session-${sessionId}`);
      if (!event) return;
      if (title) event.title = title;
      if (shift !== undefined) event.extendedProps.shift = shift as Shift | null;
      // Rebuild start/end ISO strings if date or time changed
      const baseDate = date ?? event.start.slice(0, 10);
      const baseStart = startTime ?? event.start.slice(11, 16);
      const baseEnd = endTime ?? (event.end?.slice(11, 16) ?? baseStart);
      event.start = `${baseDate}T${baseStart}:00`;
      if (event.end) event.end = `${baseDate}T${baseEnd}:00`;
    },
    // Optimistically update a session's live status in the events list
    markSessionLiveOptimistic: (state, action: PayloadAction<{ sessionId: number; sessionStatus: "idle" | "live" | "ended" }>) => {
      const event = state.events.find(
        (e) => e.id === `session-${action.payload.sessionId}`
      );
      if (event) {
        event.extendedProps.sessionStatus = action.payload.sessionStatus;
        if (action.payload.sessionStatus === "live") {
          event.backgroundColor = "#22C55E";
          event.borderColor = "#22C55E";
          event.classNames = ["event-live"];
        } else if (action.payload.sessionStatus === "ended") {
          event.backgroundColor = "#6B7280";
          event.borderColor = "#6B7280";
          event.classNames = [];
        }
      }
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch events
      .addCase(fetchCalendarEventsThunk.pending, (state) => {
        state.eventsStatus = "loading";
        state.eventsError = null;
      })
      .addCase(fetchCalendarEventsThunk.fulfilled, (state, action: PayloadAction<CalendarEvent[]>) => {
        state.events = action.payload;
        state.eventsStatus = "succeeded";
      })
      .addCase(fetchCalendarEventsThunk.rejected, (state, action) => {
        state.eventsStatus = "failed";
        state.eventsError = action.payload ?? "Unable to load events.";
      })

      // Fetch pending approvals
      .addCase(fetchPendingApprovalsThunk.pending, (state) => {
        state.pendingStatus = "loading";
        state.pendingError = null;
      })
      .addCase(fetchPendingApprovalsThunk.fulfilled, (state, action: PayloadAction<ClassSchedule[]>) => {
        state.pendingApprovals = action.payload;
        state.pendingStatus = "succeeded";
      })
      .addCase(fetchPendingApprovalsThunk.rejected, (state, action) => {
        state.pendingStatus = "failed";
        state.pendingError = action.payload ?? "Unable to load pending approvals.";
      })

      // Create schedule
      .addCase(createScheduleThunk.pending, (state) => {
        state.createStatus = "loading";
        state.createError = null;
      })
      .addCase(createScheduleThunk.fulfilled, (state) => {
        state.createStatus = "succeeded";
      })
      .addCase(createScheduleThunk.rejected, (state, action) => {
        state.createStatus = "failed";
        state.createError = action.payload ?? "Unable to create schedule.";
      })

      // Propose session
      .addCase(proposeSessionThunk.pending, (state) => {
        state.proposeStatus = "loading";
        state.proposeError = null;
      })
      .addCase(proposeSessionThunk.fulfilled, (state) => {
        state.proposeStatus = "succeeded";
      })
      .addCase(proposeSessionThunk.rejected, (state, action) => {
        state.proposeStatus = "failed";
        state.proposeError = action.payload ?? "Unable to propose session.";
      })

      // Approve schedule
      .addCase(approveScheduleThunk.pending, (state) => {
        state.approveStatus = "loading";
        state.approveError = null;
      })
      .addCase(approveScheduleThunk.fulfilled, (state) => {
        state.approveStatus = "succeeded";
      })
      .addCase(approveScheduleThunk.rejected, (state, action) => {
        state.approveStatus = "failed";
        state.approveError = action.payload ?? "Unable to approve schedule.";
      })

      // Cancel session
      .addCase(cancelSessionThunk.pending, (state) => {
        state.cancelStatus = "loading";
        state.cancelError = null;
      })
      .addCase(cancelSessionThunk.fulfilled, (state) => {
        state.cancelStatus = "succeeded";
      })
      .addCase(cancelSessionThunk.rejected, (state, action) => {
        state.cancelStatus = "failed";
        state.cancelError = action.payload ?? "Unable to cancel session.";
      })

      // Cancel schedule
      .addCase(cancelScheduleThunk.pending, (state) => {
        state.cancelStatus = "loading";
        state.cancelError = null;
      })
      .addCase(cancelScheduleThunk.fulfilled, (state) => {
        state.cancelStatus = "succeeded";
      })
      .addCase(cancelScheduleThunk.rejected, (state, action) => {
        state.cancelStatus = "failed";
        state.cancelError = action.payload ?? "Unable to cancel schedule.";
      });
  },
});

export const {
  resetCreateStatus,
  resetProposeStatus,
  resetApproveStatus,
  resetCancelStatus,
  markSessionCancelledOptimistic,
  markSessionUpdatedOptimistic,
  openCall,
  closeCall,
  markSessionLiveOptimistic,
  markActiveCallEnded,
  setSelectedShift,
  setPendingFeedback,
} = calendarSlice.actions;

export default calendarSlice.reducer;
