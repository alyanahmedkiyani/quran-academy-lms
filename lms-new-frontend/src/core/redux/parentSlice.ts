import { createAsyncThunk, createSlice, PayloadAction } from "@reduxjs/toolkit";

import {
  createParent,
  deleteParent,
  fetchAllParents,
  updateParent,
} from "@/services/parentService";
import {
  CreateParentPayload,
  Parent,
  ParentsResponse,
  UpdateParentPayload,
} from "@/types/parent";

type AsyncStatus = "idle" | "loading" | "succeeded" | "failed";

interface ParentsState {
  allItems: Parent[];
  listStatus: AsyncStatus;
  listError: string | null;
  selectedParent: Parent | null;
  selectedParentStatus: AsyncStatus;
  selectedParentError: string | null;
  saveStatus: AsyncStatus;
  saveError: string | null;
  deleteStatus: AsyncStatus;
  deleteError: string | null;
  deletingParentId: string | null;
}

const initialState: ParentsState = {
  allItems: [],
  listStatus: "idle",
  listError: null,
  selectedParent: null,
  selectedParentStatus: "idle",
  selectedParentError: null,
  saveStatus: "idle",
  saveError: null,
  deleteStatus: "idle",
  deleteError: null,
  deletingParentId: null,
};

const getErrorMessage = (error: unknown, fallback: string) => {
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error) {
    return String((error as any).message || fallback);
  }
  return fallback;
};

export const fetchParentsThunk = createAsyncThunk<
  ParentsResponse,
  void,
  { rejectValue: string }
>("parents/fetchAll", async (_, { rejectWithValue }) => {
  try {
    return await fetchAllParents();
  } catch (error) {
    return rejectWithValue(getErrorMessage(error, "Unable to load parents right now."));
  }
});

export const createParentThunk = createAsyncThunk<
  Parent,
  CreateParentPayload,
  { rejectValue: string }
>("parents/create", async (payload, { rejectWithValue }) => {
  try {
    return await createParent(payload);
  } catch (error) {
    return rejectWithValue(getErrorMessage(error, "Unable to create parent right now."));
  }
});

export const updateParentThunk = createAsyncThunk<
  Parent,
  { id: string; payload: UpdateParentPayload },
  { rejectValue: string }
>("parents/update", async ({ id, payload }, { rejectWithValue }) => {
  try {
    return await updateParent(id, payload);
  } catch (error) {
    return rejectWithValue(getErrorMessage(error, "Unable to update parent right now."));
  }
});

export const deleteParentThunk = createAsyncThunk<string, string, { rejectValue: string }>(
  "parents/delete",
  async (id, { rejectWithValue }) => {
    try {
      await deleteParent(id);
      return id;
    } catch (error) {
      return rejectWithValue(getErrorMessage(error, "Unable to delete parent right now."));
    }
  }
);

const parentSlice = createSlice({
  name: "parents",
  initialState,
  reducers: {
    resetParentSelection: (state) => {
      state.selectedParent = null;
      state.selectedParentStatus = "idle";
      state.selectedParentError = null;
    },
    resetParentSaveStatus: (state) => {
      state.saveStatus = "idle";
      state.saveError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchParentsThunk.pending, (state) => {
        state.listStatus = "loading";
        state.listError = null;
      })
      .addCase(fetchParentsThunk.fulfilled, (state, action: PayloadAction<ParentsResponse>) => {
        state.allItems = action.payload.parents;
        state.listStatus = "succeeded";
      })
      .addCase(fetchParentsThunk.rejected, (state, action) => {
        state.listStatus = "failed";
        state.listError =
          action.payload ?? action.error.message ?? "Unable to load parents right now.";
      })
      .addCase(createParentThunk.pending, (state) => {
        state.saveStatus = "loading";
        state.saveError = null;
      })
      .addCase(createParentThunk.fulfilled, (state) => {
        state.saveStatus = "succeeded";
      })
      .addCase(createParentThunk.rejected, (state, action) => {
        state.saveStatus = "failed";
        state.saveError =
          action.payload ?? action.error.message ?? "Unable to create parent.";
      })
      .addCase(updateParentThunk.pending, (state) => {
        state.saveStatus = "loading";
        state.saveError = null;
      })
      .addCase(updateParentThunk.fulfilled, (state, action: PayloadAction<Parent>) => {
        state.saveStatus = "succeeded";
        const updated = action.payload;
        if (updated && updated.id) {
          state.allItems = state.allItems.map((p) =>
            String(p.id) === String(updated.id) ? { ...p, ...updated } : p
          );
        }
      })
      .addCase(updateParentThunk.rejected, (state, action) => {
        state.saveStatus = "failed";
        state.saveError =
          action.payload ?? action.error.message ?? "Unable to update parent.";
      })
      .addCase(deleteParentThunk.pending, (state, action) => {
        state.deleteStatus = "loading";
        state.deleteError = null;
        state.deletingParentId = action.meta.arg;
      })
      .addCase(deleteParentThunk.fulfilled, (state, action: PayloadAction<string>) => {
        state.deleteStatus = "succeeded";
        state.deletingParentId = null;
        state.allItems = state.allItems.filter((p) => String(p.id) !== action.payload);
      })
      .addCase(deleteParentThunk.rejected, (state, action) => {
        state.deleteStatus = "failed";
        state.deletingParentId = null;
        state.deleteError =
          action.payload ?? action.error.message ?? "Unable to delete parent right now.";
      });
  },
});

export const { resetParentSelection, resetParentSaveStatus } = parentSlice.actions;

export default parentSlice.reducer;
