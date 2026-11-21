import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { UserWithPermissions } from '@/types/auth';

interface AuthState {
  user: UserWithPermissions | null;
  token: string | null;
  loading: boolean;
  error: string | null;
  hydrated: boolean;
}

const initialState: AuthState = {
  user: null,
  token: null,
  loading: false,
  error: null,
  hydrated: false,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setAuthLoading(state) {
      state.loading = true;
      state.error = null;
    },
    setCredentials(
      state,
      action: PayloadAction<{ user: UserWithPermissions; token: string }>,
    ) {
      state.user = action.payload.user;
      state.token = action.payload.token;
      state.loading = false;
      state.error = null;
      state.hydrated = true;
    },
    setAuthError(state, action: PayloadAction<string>) {
      state.error = action.payload;
      state.loading = false;
      state.hydrated = true;
    },
    clearAuthError(state) {
      state.error = null;
    },
    markHydrated(state) {
      state.hydrated = true;
    },
    clearAuth(state) {
      state.user = null;
      state.token = null;
      state.loading = false;
      state.error = null;
      state.hydrated = true;
    },
    updateUserProfile(state, action: PayloadAction<{ profileImg?: string | null }>) {
      if (state.user && action.payload.profileImg !== undefined) {
        state.user.profileImg = action.payload.profileImg;
      }
    },
    patchUserShift(state, action: PayloadAction<{ shift: 'Morning' | 'Afternoon' | 'Evening' | null }>) {
      if (state.user) {
        state.user.shift = action.payload.shift;
      }
    },
    patchUserTimezone(state, action: PayloadAction<{ timeZone: string }>) {
      if (state.user) {
        state.user.timeZone = action.payload.timeZone;
      }
    },
  },
});

export const {
  setAuthLoading,
  setCredentials,
  setAuthError,
  clearAuthError,
  markHydrated,
  clearAuth,
  updateUserProfile,
  patchUserShift,
  patchUserTimezone,
} = authSlice.actions;

export default authSlice.reducer;

