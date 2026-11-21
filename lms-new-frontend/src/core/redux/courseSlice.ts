import { createAsyncThunk, createSlice, PayloadAction } from "@reduxjs/toolkit";
import { createCourse, deleteCourse, fetchAllCourses, updateCourse } from "@/services/courseService";
import { Course, CoursesResponse } from "@/types/course";

type AsyncStatus = "idle" | "loading" | "succeeded" | "failed";

interface CoursesState {
  allItems: Course[];
  listStatus: AsyncStatus;
  listError: string | null;
  saveStatus: AsyncStatus;
  saveError: string | null;
  deleteStatus: AsyncStatus;
  deleteError: string | null;
  deletingCourseId: string | null;
}

const initialState: CoursesState = {
  allItems: [],
  listStatus: "idle",
  listError: null,
  saveStatus: "idle",
  saveError: null,
  deleteStatus: "idle",
  deleteError: null,
  deletingCourseId: null,
};

const getErrorMessage = (error: unknown, fallback: string) => {
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message || fallback);
  }
  return fallback;
};

export const fetchCoursesThunk = createAsyncThunk<CoursesResponse, void, { rejectValue: string }>(
  "courses/fetchAll",
  async (_, { rejectWithValue }) => {
    try {
      return await fetchAllCourses();
    } catch (error) {
      return rejectWithValue(getErrorMessage(error, "Unable to load courses right now."));
    }
  }
);

export const createCourseThunk = createAsyncThunk<
  { message: string; newCourse: Course },
  FormData,
  { rejectValue: string }
>("courses/create", async (formData, { rejectWithValue }) => {
  try {
    return await createCourse(formData);
  } catch (error) {
    return rejectWithValue(getErrorMessage(error, "Unable to create course right now."));
  }
});

export const updateCourseThunk = createAsyncThunk<
  { message: string; course: Course },
  { id: string; formData: FormData },
  { rejectValue: string }
>("courses/update", async ({ id, formData }, { rejectWithValue }) => {
  try {
    return await updateCourse(id, formData);
  } catch (error) {
    return rejectWithValue(getErrorMessage(error, "Unable to update course right now."));
  }
});

export const deleteCourseThunk = createAsyncThunk<string, string, { rejectValue: string }>(
  "courses/delete",
  async (id, { rejectWithValue }) => {
    try {
      await deleteCourse(id);
      return id;
    } catch (error) {
      return rejectWithValue(getErrorMessage(error, "Unable to delete course right now."));
    }
  }
);

const courseSlice = createSlice({
  name: "courses",
  initialState,
  reducers: {
    resetCourseSaveStatus: (state) => {
      state.saveStatus = "idle";
      state.saveError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch
      .addCase(fetchCoursesThunk.pending, (state) => {
        state.listStatus = "loading";
        state.listError = null;
      })
      .addCase(fetchCoursesThunk.fulfilled, (state, action: PayloadAction<CoursesResponse>) => {
        state.allItems = action.payload.courses;
        state.listStatus = "succeeded";
      })
      .addCase(fetchCoursesThunk.rejected, (state, action) => {
        state.listStatus = "failed";
        state.listError = action.payload ?? action.error.message ?? "Unable to load courses right now.";
      })
      // Create
      .addCase(createCourseThunk.pending, (state) => {
        state.saveStatus = "loading";
        state.saveError = null;
      })
      .addCase(createCourseThunk.fulfilled, (state, action) => {
        state.saveStatus = "succeeded";
        if (action.payload.newCourse) {
          state.allItems.push(action.payload.newCourse);
        }
      })
      .addCase(createCourseThunk.rejected, (state, action) => {
        state.saveStatus = "failed";
        state.saveError = action.payload ?? action.error.message ?? "Unable to create course.";
      })
      // Update
      .addCase(updateCourseThunk.pending, (state) => {
        state.saveStatus = "loading";
        state.saveError = null;
      })
      .addCase(updateCourseThunk.fulfilled, (state, action) => {
        state.saveStatus = "succeeded";
        const updated = action.payload.course;
        if (updated && updated.id) {
          state.allItems = state.allItems.map((c) =>
            String(c.id) === String(updated.id) ? { ...c, ...updated } : c
          );
        }
      })
      .addCase(updateCourseThunk.rejected, (state, action) => {
        state.saveStatus = "failed";
        state.saveError = action.payload ?? action.error.message ?? "Unable to update course.";
      })
      // Delete
      .addCase(deleteCourseThunk.pending, (state, action) => {
        state.deleteStatus = "loading";
        state.deleteError = null;
        state.deletingCourseId = action.meta.arg;
      })
      .addCase(deleteCourseThunk.fulfilled, (state, action: PayloadAction<string>) => {
        state.deleteStatus = "succeeded";
        state.deletingCourseId = null;
        state.allItems = state.allItems.filter((c) => String(c.id) !== action.payload);
      })
      .addCase(deleteCourseThunk.rejected, (state, action) => {
        state.deleteStatus = "failed";
        state.deletingCourseId = null;
        state.deleteError = action.payload ?? action.error.message ?? "Unable to delete course.";
      });
  },
});

export const { resetCourseSaveStatus } = courseSlice.actions;
export default courseSlice.reducer;
