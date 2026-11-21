import { createAsyncThunk, createSlice, PayloadAction } from "@reduxjs/toolkit";
import {
  assignCourse,
  fetchAllCourseDetails,
  fetchCoursesByStudentId,
  fetchCoursesByTeacherId,
  unassignCourse,
} from "@/services/courseDetailsService";
import { AssignCoursePayload, CourseDetail, CourseDetailsResponse } from "@/types/course";

type AsyncStatus = "idle" | "loading" | "succeeded" | "failed";

interface CourseDetailsState {
  allAssignments: CourseDetail[];
  teacherAssignments: CourseDetail[];
  studentAssignments: CourseDetail[];
  listStatus: AsyncStatus;
  listError: string | null;
  teacherListStatus: AsyncStatus;
  teacherListError: string | null;
  studentListStatus: AsyncStatus;
  studentListError: string | null;
  assignStatus: AsyncStatus;
  assignError: string | null;
  unassignStatus: AsyncStatus;
  unassignError: string | null;
  unassigningId: string | null;
}

const initialState: CourseDetailsState = {
  allAssignments: [],
  teacherAssignments: [],
  studentAssignments: [],
  listStatus: "idle",
  listError: null,
  teacherListStatus: "idle",
  teacherListError: null,
  studentListStatus: "idle",
  studentListError: null,
  assignStatus: "idle",
  assignError: null,
  unassignStatus: "idle",
  unassignError: null,
  unassigningId: null,
};

const getErrorMessage = (error: unknown, fallback: string) => {
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message || fallback);
  }
  return fallback;
};

export const fetchAllCourseDetailsThunk = createAsyncThunk<
  CourseDetailsResponse,
  void,
  { rejectValue: string }
>("courseDetails/fetchAll", async (_, { rejectWithValue }) => {
  try {
    return await fetchAllCourseDetails();
  } catch (error) {
    return rejectWithValue(getErrorMessage(error, "Unable to load course assignments."));
  }
});

export const fetchTeacherCoursesThunk = createAsyncThunk<
  CourseDetailsResponse,
  string,
  { rejectValue: string }
>("courseDetails/fetchByTeacher", async (teacherId, { rejectWithValue }) => {
  try {
    return await fetchCoursesByTeacherId(teacherId);
  } catch (error) {
    return rejectWithValue(getErrorMessage(error, "Unable to load your courses."));
  }
});

export const fetchStudentCoursesThunk = createAsyncThunk<
  CourseDetailsResponse,
  string,
  { rejectValue: string }
>("courseDetails/fetchByStudent", async (studentId, { rejectWithValue }) => {
  try {
    return await fetchCoursesByStudentId(studentId);
  } catch (error) {
    return rejectWithValue(getErrorMessage(error, "Unable to load your courses."));
  }
});

export const assignCourseThunk = createAsyncThunk<
  { message: string; course: CourseDetail },
  AssignCoursePayload,
  { rejectValue: string }
>("courseDetails/assign", async (payload, { rejectWithValue }) => {
  try {
    return await assignCourse(payload);
  } catch (error) {
    return rejectWithValue(getErrorMessage(error, "Unable to assign course."));
  }
});

export const unassignCourseThunk = createAsyncThunk<string, string, { rejectValue: string }>(
  "courseDetails/unassign",
  async (id, { rejectWithValue }) => {
    try {
      await unassignCourse(id);
      return id;
    } catch (error) {
      return rejectWithValue(getErrorMessage(error, "Unable to remove assignment."));
    }
  }
);

const courseDetailsSlice = createSlice({
  name: "courseDetails",
  initialState,
  reducers: {
    resetAssignStatus: (state) => {
      state.assignStatus = "idle";
      state.assignError = null;
    },
    resetUnassignStatus: (state) => {
      state.unassignStatus = "idle";
      state.unassignError = null;
    },
    clearTeacherAssignments: (state) => {
      state.teacherAssignments = [];
      state.teacherListStatus = "idle";
    },
    clearStudentAssignments: (state) => {
      state.studentAssignments = [];
      state.studentListStatus = "idle";
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch all
      .addCase(fetchAllCourseDetailsThunk.pending, (state) => {
        state.listStatus = "loading";
        state.listError = null;
      })
      .addCase(fetchAllCourseDetailsThunk.fulfilled, (state, action: PayloadAction<CourseDetailsResponse>) => {
        state.allAssignments = action.payload.course;
        state.listStatus = "succeeded";
      })
      .addCase(fetchAllCourseDetailsThunk.rejected, (state, action) => {
        state.listStatus = "failed";
        state.listError = action.payload ?? "Unable to load assignments.";
      })
      // Fetch by teacher
      .addCase(fetchTeacherCoursesThunk.pending, (state) => {
        state.teacherListStatus = "loading";
        state.teacherListError = null;
      })
      .addCase(fetchTeacherCoursesThunk.fulfilled, (state, action: PayloadAction<CourseDetailsResponse>) => {
        state.teacherAssignments = action.payload.course;
        state.teacherListStatus = "succeeded";
      })
      .addCase(fetchTeacherCoursesThunk.rejected, (state, action) => {
        state.teacherListStatus = "failed";
        state.teacherListError = action.payload ?? "Unable to load your courses.";
      })
      // Fetch by student
      .addCase(fetchStudentCoursesThunk.pending, (state) => {
        state.studentListStatus = "loading";
        state.studentListError = null;
      })
      .addCase(fetchStudentCoursesThunk.fulfilled, (state, action: PayloadAction<CourseDetailsResponse>) => {
        state.studentAssignments = action.payload.course;
        state.studentListStatus = "succeeded";
      })
      .addCase(fetchStudentCoursesThunk.rejected, (state, action) => {
        state.studentListStatus = "failed";
        state.studentListError = action.payload ?? "Unable to load your courses.";
      })
      // Assign
      .addCase(assignCourseThunk.pending, (state) => {
        state.assignStatus = "loading";
        state.assignError = null;
      })
      .addCase(assignCourseThunk.fulfilled, (state, action) => {
        state.assignStatus = "succeeded";
        if (action.payload.course) {
          state.allAssignments.push(action.payload.course);
        }
      })
      .addCase(assignCourseThunk.rejected, (state, action) => {
        state.assignStatus = "failed";
        state.assignError = action.payload ?? "Unable to assign course.";
      })
      // Unassign
      .addCase(unassignCourseThunk.pending, (state, action) => {
        state.unassignStatus = "loading";
        state.unassignError = null;
        state.unassigningId = action.meta.arg;
      })
      .addCase(unassignCourseThunk.fulfilled, (state, action: PayloadAction<string>) => {
        state.unassignStatus = "succeeded";
        state.unassigningId = null;
        state.allAssignments = state.allAssignments.filter((a) => String(a.id) !== action.payload);
      })
      .addCase(unassignCourseThunk.rejected, (state, action) => {
        state.unassignStatus = "failed";
        state.unassigningId = null;
        state.unassignError = action.payload ?? "Unable to remove assignment.";
      });
  },
});

export const { resetAssignStatus, resetUnassignStatus, clearTeacherAssignments, clearStudentAssignments } =
  courseDetailsSlice.actions;
export default courseDetailsSlice.reducer;
