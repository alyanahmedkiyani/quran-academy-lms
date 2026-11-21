import { createAsyncThunk, createSlice, PayloadAction } from "@reduxjs/toolkit";
import {
  AdminStudentAttendanceFilter,
  AdminStudentAttendanceResponse,
  AdminTeacherAttendanceFilter,
  AdminTeacherAttendanceResponse,
  AttendanceSummary,
  BulkMarkPayload,
  SessionAttendanceSheet,
  StudentAttendance,
  TeacherAttendanceRecord,
  TeacherSessionItem,
} from "@/types/attendance";
import {
  bulkMarkAttendance,
  getAdminStudentAttendance,
  getAdminTeacherAttendance,
  getSessionAttendanceSheet,
  getStudentHistory,
  getStudentSummary,
  getTeacherHistory,
  getTeacherSessions,
  getTeacherToday,
  teacherCheckIn,
  teacherCheckOut,
} from "@/services/attendanceService";

type AsyncStatus = "idle" | "loading" | "succeeded" | "failed";

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message || fallback);
  }
  return fallback;
};

interface AttendanceState {
  // Teacher's own attendance
  todayRecord: TeacherAttendanceRecord | null;
  todayStatus: AsyncStatus;
  todayError: string | null;
  checkInStatus: AsyncStatus;
  checkInError: string | null;
  checkOutStatus: AsyncStatus;
  checkOutError: string | null;
  teacherHistory: TeacherAttendanceRecord[];
  teacherHistoryTotal: number;
  historyStatus: AsyncStatus;
  historyError: string | null;

  // Teacher marking students
  teacherSessions: TeacherSessionItem[];
  sessionsStatus: AsyncStatus;
  sessionsError: string | null;
  attendanceSheet: SessionAttendanceSheet | null;
  sheetStatus: AsyncStatus;
  sheetError: string | null;
  bulkMarkStatus: AsyncStatus;
  bulkMarkError: string | null;

  // Student / Parent view
  summaries: AttendanceSummary[];
  summaryStatus: AsyncStatus;
  summaryError: string | null;
  studentHistory: StudentAttendance[];
  studentHistoryStatus: AsyncStatus;
  studentHistoryError: string | null;

  // Admin view
  adminStudentRecords: StudentAttendance[];
  adminStudentTotal: number;
  adminStudentStats: AdminStudentAttendanceResponse["stats"] | null;
  adminStudentStatus: AsyncStatus;
  adminStudentError: string | null;
  adminTeacherRecords: TeacherAttendanceRecord[];
  adminTeacherTotal: number;
  adminTeacherStats: AdminTeacherAttendanceResponse["stats"] | null;
  adminTeacherStatus: AsyncStatus;
  adminTeacherError: string | null;
}

const initialState: AttendanceState = {
  todayRecord: null,
  todayStatus: "idle",
  todayError: null,
  checkInStatus: "idle",
  checkInError: null,
  checkOutStatus: "idle",
  checkOutError: null,
  teacherHistory: [],
  teacherHistoryTotal: 0,
  historyStatus: "idle",
  historyError: null,

  teacherSessions: [],
  sessionsStatus: "idle",
  sessionsError: null,
  attendanceSheet: null,
  sheetStatus: "idle",
  sheetError: null,
  bulkMarkStatus: "idle",
  bulkMarkError: null,

  summaries: [],
  summaryStatus: "idle",
  summaryError: null,
  studentHistory: [],
  studentHistoryStatus: "idle",
  studentHistoryError: null,

  adminStudentRecords: [],
  adminStudentTotal: 0,
  adminStudentStats: null,
  adminStudentStatus: "idle",
  adminStudentError: null,
  adminTeacherRecords: [],
  adminTeacherTotal: 0,
  adminTeacherStats: null,
  adminTeacherStatus: "idle",
  adminTeacherError: null,
};

// ─── Thunks ───────────────────────────────────────────────────────────────────

export const fetchTodayThunk = createAsyncThunk(
  "attendance/fetchToday",
  async (teacherId: number, { rejectWithValue }) => {
    try {
      const data = await getTeacherToday(teacherId);
      return data.record;
    } catch (err) {
      return rejectWithValue(getErrorMessage(err, "Failed to fetch today's attendance"));
    }
  }
);

export const checkInThunk = createAsyncThunk(
  "attendance/checkIn",
  async ({ teacherId, notes }: { teacherId: number; notes?: string }, { rejectWithValue }) => {
    try {
      const data = await teacherCheckIn(teacherId, notes);
      return data.record;
    } catch (err) {
      return rejectWithValue(getErrorMessage(err, "Check-in failed"));
    }
  }
);

export const checkOutThunk = createAsyncThunk(
  "attendance/checkOut",
  async (teacherId: number, { rejectWithValue }) => {
    try {
      const data = await teacherCheckOut(teacherId);
      return data.record;
    } catch (err) {
      return rejectWithValue(getErrorMessage(err, "Check-out failed"));
    }
  }
);

export const fetchTeacherHistoryThunk = createAsyncThunk(
  "attendance/fetchTeacherHistory",
  async (
    {
      teacherId,
      filters,
    }: { teacherId: number; filters?: { startDate?: string; endDate?: string; page?: number } },
    { rejectWithValue }
  ) => {
    try {
      return await getTeacherHistory(teacherId, filters);
    } catch (err) {
      return rejectWithValue(getErrorMessage(err, "Failed to fetch history"));
    }
  }
);

export const fetchTeacherSessionsThunk = createAsyncThunk(
  "attendance/fetchTeacherSessions",
  async (teacherId: number, { rejectWithValue }) => {
    try {
      const data = await getTeacherSessions(teacherId);
      return data.sessions;
    } catch (err) {
      return rejectWithValue(getErrorMessage(err, "Failed to fetch sessions"));
    }
  }
);

export const fetchSessionSheetThunk = createAsyncThunk(
  "attendance/fetchSessionSheet",
  async (sessionId: number, { rejectWithValue }) => {
    try {
      return await getSessionAttendanceSheet(sessionId);
    } catch (err) {
      return rejectWithValue(getErrorMessage(err, "Failed to fetch attendance sheet"));
    }
  }
);

export const bulkMarkThunk = createAsyncThunk(
  "attendance/bulkMark",
  async (payload: BulkMarkPayload, { rejectWithValue }) => {
    try {
      return await bulkMarkAttendance(payload);
    } catch (err) {
      return rejectWithValue(getErrorMessage(err, "Failed to mark attendance"));
    }
  }
);

export const fetchStudentSummaryThunk = createAsyncThunk(
  "attendance/fetchStudentSummary",
  async (studentId: number, { rejectWithValue }) => {
    try {
      const data = await getStudentSummary(studentId);
      return data.summaries;
    } catch (err) {
      return rejectWithValue(getErrorMessage(err, "Failed to fetch attendance summary"));
    }
  }
);

export const fetchStudentHistoryThunk = createAsyncThunk(
  "attendance/fetchStudentHistory",
  async (
    {
      studentId,
      filters,
    }: {
      studentId: number;
      filters?: { startDate?: string; endDate?: string; courseDetailsId?: number };
    },
    { rejectWithValue }
  ) => {
    try {
      const data = await getStudentHistory(studentId, filters);
      return data.attendance;
    } catch (err) {
      return rejectWithValue(getErrorMessage(err, "Failed to fetch attendance history"));
    }
  }
);

export const fetchAdminStudentAttendanceThunk = createAsyncThunk(
  "attendance/fetchAdminStudentAttendance",
  async (filters: AdminStudentAttendanceFilter, { rejectWithValue }) => {
    try {
      return await getAdminStudentAttendance(filters);
    } catch (err) {
      return rejectWithValue(getErrorMessage(err, "Failed to fetch student attendance"));
    }
  }
);

export const fetchAdminTeacherAttendanceThunk = createAsyncThunk(
  "attendance/fetchAdminTeacherAttendance",
  async (filters: AdminTeacherAttendanceFilter, { rejectWithValue }) => {
    try {
      return await getAdminTeacherAttendance(filters);
    } catch (err) {
      return rejectWithValue(getErrorMessage(err, "Failed to fetch teacher attendance"));
    }
  }
);

// ─── Slice ────────────────────────────────────────────────────────────────────

const attendanceSlice = createSlice({
  name: "attendance",
  initialState,
  reducers: {
    resetBulkMarkStatus(state) {
      state.bulkMarkStatus = "idle";
      state.bulkMarkError = null;
    },
    resetSheetStatus(state) {
      state.sheetStatus = "idle";
      state.attendanceSheet = null;
    },
    clearStudentHistory(state) {
      state.studentHistory = [];
      state.studentHistoryStatus = "idle";
    },
  },
  extraReducers: (builder) => {
    // fetchToday
    builder
      .addCase(fetchTodayThunk.pending, (state) => {
        state.todayStatus = "loading";
        state.todayError = null;
      })
      .addCase(fetchTodayThunk.fulfilled, (state, action) => {
        state.todayStatus = "succeeded";
        state.todayRecord = action.payload;
      })
      .addCase(fetchTodayThunk.rejected, (state, action) => {
        state.todayStatus = "failed";
        state.todayError = action.payload as string;
      });

    // checkIn
    builder
      .addCase(checkInThunk.pending, (state) => {
        state.checkInStatus = "loading";
        state.checkInError = null;
      })
      .addCase(checkInThunk.fulfilled, (state, action) => {
        state.checkInStatus = "succeeded";
        state.todayRecord = action.payload;
      })
      .addCase(checkInThunk.rejected, (state, action) => {
        state.checkInStatus = "failed";
        state.checkInError = action.payload as string;
      });

    // checkOut
    builder
      .addCase(checkOutThunk.pending, (state) => {
        state.checkOutStatus = "loading";
        state.checkOutError = null;
      })
      .addCase(checkOutThunk.fulfilled, (state, action) => {
        state.checkOutStatus = "succeeded";
        state.todayRecord = action.payload;
      })
      .addCase(checkOutThunk.rejected, (state, action) => {
        state.checkOutStatus = "failed";
        state.checkOutError = action.payload as string;
      });

    // fetchTeacherHistory
    builder
      .addCase(fetchTeacherHistoryThunk.pending, (state) => {
        state.historyStatus = "loading";
        state.historyError = null;
      })
      .addCase(fetchTeacherHistoryThunk.fulfilled, (state, action) => {
        state.historyStatus = "succeeded";
        state.teacherHistory = action.payload.records;
        state.teacherHistoryTotal = action.payload.total;
      })
      .addCase(fetchTeacherHistoryThunk.rejected, (state, action) => {
        state.historyStatus = "failed";
        state.historyError = action.payload as string;
      });

    // fetchTeacherSessions
    builder
      .addCase(fetchTeacherSessionsThunk.pending, (state) => {
        state.sessionsStatus = "loading";
        state.sessionsError = null;
      })
      .addCase(fetchTeacherSessionsThunk.fulfilled, (state, action) => {
        state.sessionsStatus = "succeeded";
        state.teacherSessions = action.payload;
      })
      .addCase(fetchTeacherSessionsThunk.rejected, (state, action) => {
        state.sessionsStatus = "failed";
        state.sessionsError = action.payload as string;
      });

    // fetchSessionSheet
    builder
      .addCase(fetchSessionSheetThunk.pending, (state) => {
        state.sheetStatus = "loading";
        state.sheetError = null;
        state.attendanceSheet = null;
      })
      .addCase(fetchSessionSheetThunk.fulfilled, (state, action) => {
        state.sheetStatus = "succeeded";
        state.attendanceSheet = action.payload;
      })
      .addCase(fetchSessionSheetThunk.rejected, (state, action) => {
        state.sheetStatus = "failed";
        state.sheetError = action.payload as string;
      });

    // bulkMark
    builder
      .addCase(bulkMarkThunk.pending, (state) => {
        state.bulkMarkStatus = "loading";
        state.bulkMarkError = null;
      })
      .addCase(bulkMarkThunk.fulfilled, (state) => {
        state.bulkMarkStatus = "succeeded";
      })
      .addCase(bulkMarkThunk.rejected, (state, action) => {
        state.bulkMarkStatus = "failed";
        state.bulkMarkError = action.payload as string;
      });

    // fetchStudentSummary
    builder
      .addCase(fetchStudentSummaryThunk.pending, (state) => {
        state.summaryStatus = "loading";
        state.summaryError = null;
      })
      .addCase(fetchStudentSummaryThunk.fulfilled, (state, action) => {
        state.summaryStatus = "succeeded";
        state.summaries = action.payload;
      })
      .addCase(fetchStudentSummaryThunk.rejected, (state, action) => {
        state.summaryStatus = "failed";
        state.summaryError = action.payload as string;
      });

    // fetchStudentHistory
    builder
      .addCase(fetchStudentHistoryThunk.pending, (state) => {
        state.studentHistoryStatus = "loading";
        state.studentHistoryError = null;
      })
      .addCase(fetchStudentHistoryThunk.fulfilled, (state, action) => {
        state.studentHistoryStatus = "succeeded";
        state.studentHistory = action.payload;
      })
      .addCase(fetchStudentHistoryThunk.rejected, (state, action) => {
        state.studentHistoryStatus = "failed";
        state.studentHistoryError = action.payload as string;
      });

    // fetchAdminStudentAttendance
    builder
      .addCase(fetchAdminStudentAttendanceThunk.pending, (state) => {
        state.adminStudentStatus = "loading";
        state.adminStudentError = null;
      })
      .addCase(fetchAdminStudentAttendanceThunk.fulfilled, (state, action) => {
        state.adminStudentStatus = "succeeded";
        state.adminStudentRecords = action.payload.attendance;
        state.adminStudentTotal = action.payload.total;
        state.adminStudentStats = action.payload.stats;
      })
      .addCase(fetchAdminStudentAttendanceThunk.rejected, (state, action) => {
        state.adminStudentStatus = "failed";
        state.adminStudentError = action.payload as string;
      });

    // fetchAdminTeacherAttendance
    builder
      .addCase(fetchAdminTeacherAttendanceThunk.pending, (state) => {
        state.adminTeacherStatus = "loading";
        state.adminTeacherError = null;
      })
      .addCase(fetchAdminTeacherAttendanceThunk.fulfilled, (state, action) => {
        state.adminTeacherStatus = "succeeded";
        state.adminTeacherRecords = action.payload.records;
        state.adminTeacherTotal = action.payload.total;
        state.adminTeacherStats = action.payload.stats;
      })
      .addCase(fetchAdminTeacherAttendanceThunk.rejected, (state, action) => {
        state.adminTeacherStatus = "failed";
        state.adminTeacherError = action.payload as string;
      });
  },
});

export const { resetBulkMarkStatus, resetSheetStatus, clearStudentHistory } =
  attendanceSlice.actions;

export default attendanceSlice.reducer;
