import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit";
import {
  AdminFeedbackSummaryResponse,
  SessionFeedbackResponse,
  SubmitFeedbackPayload,
  TeacherFeedbackResponse,
} from "@/types/feedback";
import {
  submitFeedback,
  getSessionFeedback,
  getTeacherFeedback,
  getAdminFeedbackSummary,
} from "@/services/feedbackService";

// ---------------------------------------------------------------------------
// Thunks
// ---------------------------------------------------------------------------

export const submitFeedbackThunk = createAsyncThunk(
  "feedback/submit",
  async (
    { sessionId, payload }: { sessionId: number; payload: SubmitFeedbackPayload },
    { rejectWithValue }
  ) => {
    try {
      return await submitFeedback(sessionId, payload);
    } catch (err: unknown) {
      return rejectWithValue((err as Error).message);
    }
  }
);

export const fetchSessionFeedbackThunk = createAsyncThunk(
  "feedback/fetchSession",
  async (sessionId: number, { rejectWithValue }) => {
    try {
      return await getSessionFeedback(sessionId);
    } catch (err: unknown) {
      return rejectWithValue((err as Error).message);
    }
  }
);

export const fetchTeacherFeedbackThunk = createAsyncThunk(
  "feedback/fetchTeacher",
  async (teacherId: number, { rejectWithValue }) => {
    try {
      return await getTeacherFeedback(teacherId);
    } catch (err: unknown) {
      return rejectWithValue((err as Error).message);
    }
  }
);

export const fetchAdminFeedbackSummaryThunk = createAsyncThunk(
  "feedback/fetchAdminSummary",
  async (_, { rejectWithValue }) => {
    try {
      return await getAdminFeedbackSummary();
    } catch (err: unknown) {
      return rejectWithValue((err as Error).message);
    }
  }
);

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

interface FeedbackState {
  // Submit
  submitStatus: "idle" | "loading" | "succeeded" | "failed";
  submitError: string | null;

  // Per-session feedback (teacher / admin modal)
  sessionFeedback: SessionFeedbackResponse | null;
  sessionFeedbackStatus: "idle" | "loading" | "succeeded" | "failed";
  sessionFeedbackError: string | null;

  // Teacher's own feedback
  teacherFeedback: TeacherFeedbackResponse | null;
  teacherFeedbackStatus: "idle" | "loading" | "succeeded" | "failed";
  teacherFeedbackError: string | null;

  // Admin summary
  adminSummary: AdminFeedbackSummaryResponse | null;
  adminSummaryStatus: "idle" | "loading" | "succeeded" | "failed";
  adminSummaryError: string | null;
}

const initialState: FeedbackState = {
  submitStatus: "idle",
  submitError: null,

  sessionFeedback: null,
  sessionFeedbackStatus: "idle",
  sessionFeedbackError: null,

  teacherFeedback: null,
  teacherFeedbackStatus: "idle",
  teacherFeedbackError: null,

  adminSummary: null,
  adminSummaryStatus: "idle",
  adminSummaryError: null,
};

// ---------------------------------------------------------------------------
// Slice
// ---------------------------------------------------------------------------

const feedbackSlice = createSlice({
  name: "feedback",
  initialState,
  reducers: {
    resetSubmitStatus(state) {
      state.submitStatus = "idle";
      state.submitError = null;
    },
    resetSessionFeedback(state) {
      state.sessionFeedback = null;
      state.sessionFeedbackStatus = "idle";
      state.sessionFeedbackError = null;
    },
  },
  extraReducers: (builder) => {
    // Submit feedback
    builder
      .addCase(submitFeedbackThunk.pending, (state) => {
        state.submitStatus = "loading";
        state.submitError = null;
      })
      .addCase(submitFeedbackThunk.fulfilled, (state) => {
        state.submitStatus = "succeeded";
      })
      .addCase(submitFeedbackThunk.rejected, (state, action) => {
        state.submitStatus = "failed";
        state.submitError = action.payload as string;
      });

    // Fetch session feedback
    builder
      .addCase(fetchSessionFeedbackThunk.pending, (state) => {
        state.sessionFeedbackStatus = "loading";
        state.sessionFeedbackError = null;
      })
      .addCase(fetchSessionFeedbackThunk.fulfilled, (state, action) => {
        state.sessionFeedbackStatus = "succeeded";
        state.sessionFeedback = action.payload;
      })
      .addCase(fetchSessionFeedbackThunk.rejected, (state, action) => {
        state.sessionFeedbackStatus = "failed";
        state.sessionFeedbackError = action.payload as string;
      });

    // Fetch teacher feedback
    builder
      .addCase(fetchTeacherFeedbackThunk.pending, (state) => {
        state.teacherFeedbackStatus = "loading";
        state.teacherFeedbackError = null;
      })
      .addCase(fetchTeacherFeedbackThunk.fulfilled, (state, action) => {
        state.teacherFeedbackStatus = "succeeded";
        state.teacherFeedback = action.payload;
      })
      .addCase(fetchTeacherFeedbackThunk.rejected, (state, action) => {
        state.teacherFeedbackStatus = "failed";
        state.teacherFeedbackError = action.payload as string;
      });

    // Fetch admin summary
    builder
      .addCase(fetchAdminFeedbackSummaryThunk.pending, (state) => {
        state.adminSummaryStatus = "loading";
        state.adminSummaryError = null;
      })
      .addCase(fetchAdminFeedbackSummaryThunk.fulfilled, (state, action) => {
        state.adminSummaryStatus = "succeeded";
        state.adminSummary = action.payload;
      })
      .addCase(fetchAdminFeedbackSummaryThunk.rejected, (state, action) => {
        state.adminSummaryStatus = "failed";
        state.adminSummaryError = action.payload as string;
      });
  },
});

export const { resetSubmitStatus, resetSessionFeedback } = feedbackSlice.actions;
export default feedbackSlice.reducer;
