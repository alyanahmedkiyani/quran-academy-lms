import { createAsyncThunk, createSlice, PayloadAction } from "@reduxjs/toolkit";
import {
  fetchAllUpcomingCourses,
  createUpcomingCourse,
  updateUpcomingCourse,
  deleteUpcomingCourse,
  enrollStudent,
  fetchEnrolledCoursesByStudent,
  fetchEnrolledStudentsByCourse,
} from "@/services/upcomingCourseService";
import {
  UpcomingCourse,
  CreateUpcomingCoursePayload,
  UpdateUpcomingCoursePayload,
  EnrolledCourse,
  EnrollPayload,
} from "@/types/course";

type AsyncStatus = "idle" | "loading" | "succeeded" | "failed";

interface UpcomingCourseState {
  schedules: UpcomingCourse[];
  schedulesStatus: AsyncStatus;
  schedulesError: string | null;
  createStatus: AsyncStatus;
  createError: string | null;
  updateStatus: AsyncStatus;
  updateError: string | null;
  deleteStatus: AsyncStatus;
  deleteError: string | null;
  deletingId: string | null;
  studentEnrollments: EnrolledCourse[];
  enrollmentsStatus: AsyncStatus;
  enrollmentsError: string | null;
  enrollStatus: AsyncStatus;
  enrollError: string | null;
  enrollingCourseId: string | null;
  courseEnrollments: EnrolledCourse[];
  courseEnrollmentsStatus: AsyncStatus;
  courseEnrollmentsError: string | null;
}

const initialState: UpcomingCourseState = {
  schedules: [],
  schedulesStatus: "idle",
  schedulesError: null,
  createStatus: "idle",
  createError: null,
  updateStatus: "idle",
  updateError: null,
  deleteStatus: "idle",
  deleteError: null,
  deletingId: null,
  studentEnrollments: [],
  enrollmentsStatus: "idle",
  enrollmentsError: null,
  enrollStatus: "idle",
  enrollError: null,
  enrollingCourseId: null,
  courseEnrollments: [],
  courseEnrollmentsStatus: "idle",
  courseEnrollmentsError: null,
};

const getErrorMessage = (error: unknown, fallback: string) => {
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message || fallback);
  }
  return fallback;
};

export const fetchSchedulesThunk = createAsyncThunk<
  UpcomingCourse[],
  void,
  { rejectValue: string }
>("upcomingCourses/fetchAll", async (_, { rejectWithValue }) => {
  try {
    return await fetchAllUpcomingCourses();
  } catch (error) {
    return rejectWithValue(getErrorMessage(error, "Unable to load schedules."));
  }
});

export const createScheduleThunk = createAsyncThunk<
  UpcomingCourse,
  CreateUpcomingCoursePayload,
  { rejectValue: string }
>("upcomingCourses/create", async (payload, { rejectWithValue }) => {
  try {
    return await createUpcomingCourse(payload);
  } catch (error) {
    return rejectWithValue(getErrorMessage(error, "Unable to create schedule."));
  }
});

export const updateScheduleThunk = createAsyncThunk<
  UpcomingCourse,
  { id: string; payload: UpdateUpcomingCoursePayload },
  { rejectValue: string }
>("upcomingCourses/update", async ({ id, payload }, { rejectWithValue }) => {
  try {
    return await updateUpcomingCourse(id, payload);
  } catch (error) {
    return rejectWithValue(getErrorMessage(error, "Unable to update schedule."));
  }
});

export const deleteScheduleThunk = createAsyncThunk<string, string, { rejectValue: string }>(
  "upcomingCourses/delete",
  async (id, { rejectWithValue }) => {
    try {
      await deleteUpcomingCourse(id);
      return id;
    } catch (error) {
      return rejectWithValue(getErrorMessage(error, "Unable to delete schedule."));
    }
  }
);

export const enrollStudentThunk = createAsyncThunk<
  EnrollPayload,
  EnrollPayload,
  { rejectValue: string }
>("upcomingCourses/enroll", async (payload, { rejectWithValue }) => {
  try {
    await enrollStudent(payload);
    return payload;
  } catch (error) {
    return rejectWithValue(getErrorMessage(error, "Unable to enroll in course."));
  }
});

export const fetchStudentEnrollmentsThunk = createAsyncThunk<
  EnrolledCourse[],
  string,
  { rejectValue: string }
>("upcomingCourses/fetchStudentEnrollments", async (studentId, { rejectWithValue }) => {
  try {
    return await fetchEnrolledCoursesByStudent(studentId);
  } catch (error) {
    return rejectWithValue(getErrorMessage(error, "Unable to load enrollments."));
  }
});

export const fetchCourseEnrollmentsThunk = createAsyncThunk<
  EnrolledCourse[],
  string,
  { rejectValue: string }
>("upcomingCourses/fetchCourseEnrollments", async (courseId, { rejectWithValue }) => {
  try {
    return await fetchEnrolledStudentsByCourse(courseId);
  } catch (error) {
    return rejectWithValue(getErrorMessage(error, "Unable to load course enrollments."));
  }
});

const upcomingCourseSlice = createSlice({
  name: "upcomingCourses",
  initialState,
  reducers: {
    resetCreateStatus: (state) => {
      state.createStatus = "idle";
      state.createError = null;
    },
    resetUpdateStatus: (state) => {
      state.updateStatus = "idle";
      state.updateError = null;
    },
    resetDeleteStatus: (state) => {
      state.deleteStatus = "idle";
      state.deleteError = null;
    },
    resetEnrollStatus: (state) => {
      state.enrollStatus = "idle";
      state.enrollError = null;
      state.enrollingCourseId = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch all schedules
      .addCase(fetchSchedulesThunk.pending, (state) => {
        state.schedulesStatus = "loading";
        state.schedulesError = null;
      })
      .addCase(fetchSchedulesThunk.fulfilled, (state, action: PayloadAction<UpcomingCourse[]>) => {
        state.schedules = action.payload;
        state.schedulesStatus = "succeeded";
      })
      .addCase(fetchSchedulesThunk.rejected, (state, action) => {
        state.schedulesStatus = "failed";
        state.schedulesError = action.payload ?? "Unable to load schedules.";
      })
      // Create schedule
      .addCase(createScheduleThunk.pending, (state) => {
        state.createStatus = "loading";
        state.createError = null;
      })
      .addCase(createScheduleThunk.fulfilled, (state) => {
        state.createStatus = "succeeded";
        // Full list will be refreshed by component
      })
      .addCase(createScheduleThunk.rejected, (state, action) => {
        state.createStatus = "failed";
        state.createError = action.payload ?? "Unable to create schedule.";
      })
      // Update schedule
      .addCase(updateScheduleThunk.pending, (state) => {
        state.updateStatus = "loading";
        state.updateError = null;
      })
      .addCase(updateScheduleThunk.fulfilled, (state) => {
        state.updateStatus = "succeeded";
        // Full list will be refreshed by component
      })
      .addCase(updateScheduleThunk.rejected, (state, action) => {
        state.updateStatus = "failed";
        state.updateError = action.payload ?? "Unable to update schedule.";
      })
      // Delete schedule
      .addCase(deleteScheduleThunk.pending, (state, action) => {
        state.deleteStatus = "loading";
        state.deleteError = null;
        state.deletingId = action.meta.arg;
      })
      .addCase(deleteScheduleThunk.fulfilled, (state, action: PayloadAction<string>) => {
        state.deleteStatus = "succeeded";
        state.deletingId = null;
        state.schedules = state.schedules.filter((s) => String(s.id) !== action.payload);
      })
      .addCase(deleteScheduleThunk.rejected, (state, action) => {
        state.deleteStatus = "failed";
        state.deletingId = null;
        state.deleteError = action.payload ?? "Unable to delete schedule.";
      })
      // Enroll student
      .addCase(enrollStudentThunk.pending, (state, action) => {
        state.enrollStatus = "loading";
        state.enrollError = null;
        state.enrollingCourseId = String(action.meta.arg.courseId);
      })
      .addCase(enrollStudentThunk.fulfilled, (state, action: PayloadAction<EnrollPayload>) => {
        state.enrollStatus = "succeeded";
        state.enrollingCourseId = null;
        state.studentEnrollments.push({
          id: Date.now(),
          studentId: action.payload.studentId,
          courseId: action.payload.courseId,
        });
      })
      .addCase(enrollStudentThunk.rejected, (state, action) => {
        state.enrollStatus = "failed";
        state.enrollError = action.payload ?? "Unable to enroll in course.";
        state.enrollingCourseId = null;
      })
      // Fetch student enrollments
      .addCase(fetchStudentEnrollmentsThunk.pending, (state) => {
        state.enrollmentsStatus = "loading";
        state.enrollmentsError = null;
      })
      .addCase(
        fetchStudentEnrollmentsThunk.fulfilled,
        (state, action: PayloadAction<EnrolledCourse[]>) => {
          state.studentEnrollments = action.payload;
          state.enrollmentsStatus = "succeeded";
        }
      )
      .addCase(fetchStudentEnrollmentsThunk.rejected, (state, action) => {
        state.enrollmentsStatus = "failed";
        state.enrollmentsError = action.payload ?? "Unable to load enrollments.";
      })
      // Fetch course enrollments
      .addCase(fetchCourseEnrollmentsThunk.pending, (state) => {
        state.courseEnrollmentsStatus = "loading";
        state.courseEnrollmentsError = null;
      })
      .addCase(
        fetchCourseEnrollmentsThunk.fulfilled,
        (state, action: PayloadAction<EnrolledCourse[]>) => {
          state.courseEnrollments = action.payload;
          state.courseEnrollmentsStatus = "succeeded";
        }
      )
      .addCase(fetchCourseEnrollmentsThunk.rejected, (state, action) => {
        state.courseEnrollmentsStatus = "failed";
        state.courseEnrollmentsError = action.payload ?? "Unable to load course enrollments.";
      });
  },
});

export const { resetCreateStatus, resetUpdateStatus, resetDeleteStatus, resetEnrollStatus } =
  upcomingCourseSlice.actions;
export default upcomingCourseSlice.reducer;
