import { createAsyncThunk, createSlice, PayloadAction } from "@reduxjs/toolkit";

import {
  createStudent,
  deleteStudent,
  fetchAllStudents,
  updateStudent,
  toggleStudentStatus,
  bulkDeleteStudents,
  bulkImportStudents,
  BulkImportResult,
} from "@/services/studentService";
import {
  CreateStudentPayload,
  Student,
  StudentsResponse,
  UpdateStudentPayload,
} from "@/types/student";

type AsyncStatus = "idle" | "loading" | "succeeded" | "failed";

interface StudentsState {
  allItems: Student[];
  listStatus: AsyncStatus;
  listError: string | null;
  selectedStudent: Student | null;
  selectedStudentStatus: AsyncStatus;
  selectedStudentError: string | null;
  saveStatus: AsyncStatus;
  saveError: string | null;
  deleteStatus: AsyncStatus;
  deleteError: string | null;
  deletingStudentId: string | null;
  bulkImportStatus: AsyncStatus;
  bulkImportError: string | null;
}

const initialState: StudentsState = {
  allItems: [],
  listStatus: "idle",
  listError: null,
  selectedStudent: null,
  selectedStudentStatus: "idle",
  selectedStudentError: null,
  saveStatus: "idle",
  saveError: null,
  deleteStatus: "idle",
  deleteError: null,
  deletingStudentId: null,
  bulkImportStatus: "idle",
  bulkImportError: null,
};

const getErrorMessage = (error: unknown, fallback: string) => {
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error) {
    return String((error as any).message || fallback);
  }
  return fallback;
};

export const fetchStudentsThunk = createAsyncThunk<
  StudentsResponse,
  void,
  { rejectValue: string }
>("students/fetchAll", async (_, { rejectWithValue }) => {
  try {
    return await fetchAllStudents();
  } catch (error) {
    return rejectWithValue(getErrorMessage(error, "Unable to load students right now."));
  }
});

export const createStudentThunk = createAsyncThunk<
  Student,
  CreateStudentPayload,
  { rejectValue: string }
>("students/create", async (payload, { rejectWithValue }) => {
  try {
    return await createStudent(payload);
  } catch (error) {
    return rejectWithValue(getErrorMessage(error, "Unable to create student right now."));
  }
});

export const updateStudentThunk = createAsyncThunk<
  Student,
  { id: string; payload: UpdateStudentPayload },
  { rejectValue: string }
>("students/update", async ({ id, payload }, { rejectWithValue }) => {
  try {
    return await updateStudent(id, payload);
  } catch (error) {
    return rejectWithValue(getErrorMessage(error, "Unable to update student right now."));
  }
});

export const deleteStudentThunk = createAsyncThunk<string, string, { rejectValue: string }>(
  "students/delete",
  async (id, { rejectWithValue }) => {
    try {
      await deleteStudent(id);
      return id;
    } catch (error) {
      return rejectWithValue(getErrorMessage(error, "Unable to delete student right now."));
    }
  }
);

export const toggleStudentStatusThunk = createAsyncThunk<
  { id: string; status: string },
  string,
  { rejectValue: string }
>("students/toggleStatus", async (id, { rejectWithValue }) => {
  try {
    const result = await toggleStudentStatus(id);
    return { id: String(result.id), status: result.status };
  } catch (error) {
    return rejectWithValue(getErrorMessage(error, "Unable to toggle student status."));
  }
});

export const bulkDeleteStudentsThunk = createAsyncThunk<
  string[],
  string[],
  { rejectValue: string }
>("students/bulkDelete", async (ids, { rejectWithValue }) => {
  try {
    await bulkDeleteStudents(ids);
    return ids;
  } catch (error) {
    return rejectWithValue(getErrorMessage(error, "Unable to delete selected students."));
  }
});

export const bulkImportStudentsThunk = createAsyncThunk<
  BulkImportResult,
  File,
  { rejectValue: string }
>("students/bulkImport", async (file, { dispatch, rejectWithValue }) => {
  try {
    const result = await bulkImportStudents(file);
    // Refresh the student list after a successful (even partial) import
    if (result.imported > 0) {
      dispatch(fetchStudentsThunk());
    }
    return result;
  } catch (error) {
    return rejectWithValue(getErrorMessage(error, "Unable to import students."));
  }
});

const studentSlice = createSlice({
  name: "students",
  initialState,
  reducers: {
    resetStudentSelection: (state) => {
      state.selectedStudent = null;
      state.selectedStudentStatus = "idle";
      state.selectedStudentError = null;
    },
    resetStudentSaveStatus: (state) => {
      state.saveStatus = "idle";
      state.saveError = null;
    },
    resetBulkImportStatus: (state) => {
      state.bulkImportStatus = "idle";
      state.bulkImportError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchStudentsThunk.pending, (state) => {
        state.listStatus = "loading";
        state.listError = null;
      })
      .addCase(fetchStudentsThunk.fulfilled, (state, action: PayloadAction<StudentsResponse>) => {
        state.allItems = action.payload.students;
        state.listStatus = "succeeded";
      })
      .addCase(fetchStudentsThunk.rejected, (state, action) => {
        state.listStatus = "failed";
        state.listError =
          action.payload ?? action.error.message ?? "Unable to load students right now.";
      })
      .addCase(createStudentThunk.pending, (state) => {
        state.saveStatus = "loading";
        state.saveError = null;
      })
      .addCase(createStudentThunk.fulfilled, (state) => {
        state.saveStatus = "succeeded";
      })
      .addCase(createStudentThunk.rejected, (state, action) => {
        state.saveStatus = "failed";
        state.saveError =
          action.payload ?? action.error.message ?? "Unable to create student.";
      })
      .addCase(updateStudentThunk.pending, (state) => {
        state.saveStatus = "loading";
        state.saveError = null;
      })
      .addCase(updateStudentThunk.fulfilled, (state, action: PayloadAction<Student>) => {
        state.saveStatus = "succeeded";
        const updated = action.payload;
        if (updated && updated.id) {
          state.allItems = state.allItems.map((s) =>
            String(s.id) === String(updated.id) ? { ...s, ...updated } : s
          );
        }
      })
      .addCase(updateStudentThunk.rejected, (state, action) => {
        state.saveStatus = "failed";
        state.saveError =
          action.payload ?? action.error.message ?? "Unable to update student.";
      })
      .addCase(deleteStudentThunk.pending, (state, action) => {
        state.deleteStatus = "loading";
        state.deleteError = null;
        state.deletingStudentId = action.meta.arg;
      })
      .addCase(deleteStudentThunk.fulfilled, (state, action: PayloadAction<string>) => {
        state.deleteStatus = "succeeded";
        state.deletingStudentId = null;
        state.allItems = state.allItems.filter((s) => String(s.id) !== action.payload);
      })
      .addCase(deleteStudentThunk.rejected, (state, action) => {
        state.deleteStatus = "failed";
        state.deletingStudentId = null;
        state.deleteError =
          action.payload ?? action.error.message ?? "Unable to delete student right now.";
      })
      .addCase(toggleStudentStatusThunk.fulfilled, (state, action) => {
        const { id, status } = action.payload;
        state.allItems = state.allItems.map((s) =>
          String(s.id) === id ? { ...s, status } : s
        );
      })
      .addCase(bulkDeleteStudentsThunk.fulfilled, (state, action) => {
        const ids = new Set(action.payload);
        state.allItems = state.allItems.filter((s) => !ids.has(String(s.id)));
      })
      .addCase(bulkImportStudentsThunk.pending, (state) => {
        state.bulkImportStatus = "loading";
        state.bulkImportError = null;
      })
      .addCase(bulkImportStudentsThunk.fulfilled, (state) => {
        state.bulkImportStatus = "succeeded";
      })
      .addCase(bulkImportStudentsThunk.rejected, (state, action) => {
        state.bulkImportStatus = "failed";
        state.bulkImportError = action.payload ?? action.error.message ?? "Unable to import students.";
      });
  },
});

export const { resetStudentSelection, resetStudentSaveStatus, resetBulkImportStatus } = studentSlice.actions;

export default studentSlice.reducer;
