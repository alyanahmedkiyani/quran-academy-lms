import { createAsyncThunk, createSlice, PayloadAction } from "@reduxjs/toolkit";

import {
  createTeacher,
  deleteTeacher,
  bulkDeleteTeachers,
  fetchAllTeachers,
  updateTeacher,
} from "@/services/teacherService";
import {
  CreateTeacherPayload,
  Teacher,
  TeachersResponse,
  UpdateTeacherPayload,
} from "@/types/teacher";

type AsyncStatus = "idle" | "loading" | "succeeded" | "failed";

interface TeachersState {
  allItems: Teacher[];
  listStatus: AsyncStatus;
  listError: string | null;
  selectedTeacher: Teacher | null;
  selectedTeacherStatus: AsyncStatus;
  selectedTeacherError: string | null;
  saveStatus: AsyncStatus;
  saveError: string | null;
  deleteStatus: AsyncStatus;
  deleteError: string | null;
  deletingTeacherId: string | null;
}

const initialState: TeachersState = {
  allItems: [],
  listStatus: "idle",
  listError: null,
  selectedTeacher: null,
  selectedTeacherStatus: "idle",
  selectedTeacherError: null,
  saveStatus: "idle",
  saveError: null,
  deleteStatus: "idle",
  deleteError: null,
  deletingTeacherId: null,
};

const getErrorMessage = (error: unknown, fallback: string) => {
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error) {
    return String((error as any).message || fallback);
  }
  return fallback;
};

export const fetchTeachersThunk = createAsyncThunk<
  TeachersResponse,
  void,
  { rejectValue: string }
>("teachers/fetchAll", async (_, { rejectWithValue }) => {
  try {
    return await fetchAllTeachers();
  } catch (error) {
    return rejectWithValue(getErrorMessage(error, "Unable to load teachers right now."));
  }
});

export const createTeacherThunk = createAsyncThunk<
  Teacher,
  CreateTeacherPayload,
  { rejectValue: string }
>("teachers/create", async (payload, { rejectWithValue }) => {
  try {
    return await createTeacher(payload);
  } catch (error) {
    return rejectWithValue(getErrorMessage(error, "Unable to create teacher right now."));
  }
});

export const updateTeacherThunk = createAsyncThunk<
  Teacher,
  { id: string; payload: UpdateTeacherPayload },
  { rejectValue: string }
>("teachers/update", async ({ id, payload }, { rejectWithValue }) => {
  try {
    return await updateTeacher(id, payload);
  } catch (error) {
    return rejectWithValue(getErrorMessage(error, "Unable to update teacher right now."));
  }
});

export const deleteTeacherThunk = createAsyncThunk<string, string, { rejectValue: string }>(
  "teachers/delete",
  async (id, { rejectWithValue }) => {
    try {
      await deleteTeacher(id);
      return id;
    } catch (error) {
      return rejectWithValue(getErrorMessage(error, "Unable to delete teacher right now."));
    }
  }
);

export const bulkDeleteTeachersThunk = createAsyncThunk<string[], string[], { rejectValue: string }>(
  "teachers/bulkDelete",
  async (ids, { rejectWithValue }) => {
    try {
      await bulkDeleteTeachers(ids);
      return ids;
    } catch (error) {
      return rejectWithValue(getErrorMessage(error, "Unable to delete selected teachers."));
    }
  }
);

const teacherSlice = createSlice({
  name: "teachers",
  initialState,
  reducers: {
    resetTeacherSelection: (state) => {
      state.selectedTeacher = null;
      state.selectedTeacherStatus = "idle";
      state.selectedTeacherError = null;
    },
    resetTeacherSaveStatus: (state) => {
      state.saveStatus = "idle";
      state.saveError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchTeachersThunk.pending, (state) => {
        state.listStatus = "loading";
        state.listError = null;
      })
      .addCase(fetchTeachersThunk.fulfilled, (state, action: PayloadAction<TeachersResponse>) => {
        state.allItems = action.payload.teachers;
        state.listStatus = "succeeded";
      })
      .addCase(fetchTeachersThunk.rejected, (state, action) => {
        state.listStatus = "failed";
        state.listError =
          action.payload ?? action.error.message ?? "Unable to load teachers right now.";
      })
      .addCase(createTeacherThunk.pending, (state) => {
        state.saveStatus = "loading";
        state.saveError = null;
      })
      .addCase(createTeacherThunk.fulfilled, (state) => {
        state.saveStatus = "succeeded";
      })
      .addCase(createTeacherThunk.rejected, (state, action) => {
        state.saveStatus = "failed";
        state.saveError =
          action.payload ?? action.error.message ?? "Unable to create teacher.";
      })
      .addCase(updateTeacherThunk.pending, (state) => {
        state.saveStatus = "loading";
        state.saveError = null;
      })
      .addCase(updateTeacherThunk.fulfilled, (state, action: PayloadAction<Teacher>) => {
        state.saveStatus = "succeeded";
        const updated = action.payload;
        // Update in-place if backend returns full teacher; otherwise re-fetch
        if (updated && updated.id) {
          state.allItems = state.allItems.map((t) =>
            String(t.id) === String(updated.id) ? { ...t, ...updated } : t
          );
        }
      })
      .addCase(updateTeacherThunk.rejected, (state, action) => {
        state.saveStatus = "failed";
        state.saveError =
          action.payload ?? action.error.message ?? "Unable to update teacher.";
      })
      .addCase(deleteTeacherThunk.pending, (state, action) => {
        state.deleteStatus = "loading";
        state.deleteError = null;
        state.deletingTeacherId = action.meta.arg;
      })
      .addCase(deleteTeacherThunk.fulfilled, (state, action: PayloadAction<string>) => {
        state.deleteStatus = "succeeded";
        state.deletingTeacherId = null;
        state.allItems = state.allItems.filter((t) => String(t.id) !== action.payload);
      })
      .addCase(deleteTeacherThunk.rejected, (state, action) => {
        state.deleteStatus = "failed";
        state.deletingTeacherId = null;
        state.deleteError =
          action.payload ?? action.error.message ?? "Unable to delete teacher right now.";
      })
      .addCase(bulkDeleteTeachersThunk.fulfilled, (state, action: PayloadAction<string[]>) => {
        state.allItems = state.allItems.filter((t) => !action.payload.includes(String(t.id)));
      });
  },
});

export const { resetTeacherSelection, resetTeacherSaveStatus } = teacherSlice.actions;

export default teacherSlice.reducer;
