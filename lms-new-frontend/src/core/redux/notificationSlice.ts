import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { AppNotification } from "@/types/notification";

interface NotificationState {
  items: AppNotification[];
  unreadCount: number;
}

const initialState: NotificationState = {
  items: [],
  unreadCount: 0,
};

const notificationSlice = createSlice({
  name: "notifications",
  initialState,
  reducers: {
    setNotifications(
      state,
      action: PayloadAction<{ notifications: AppNotification[]; unreadCount: number }>
    ) {
      state.items = action.payload.notifications;
      state.unreadCount = action.payload.unreadCount;
    },
    addNotification(state, action: PayloadAction<AppNotification>) {
      state.items.unshift(action.payload);
      if (!action.payload.isRead) {
        state.unreadCount += 1;
      }
    },
    markRead(state, action: PayloadAction<number>) {
      const n = state.items.find((i) => i.id === action.payload);
      if (n && !n.isRead) {
        n.isRead = true;
        state.unreadCount = Math.max(0, state.unreadCount - 1);
      }
    },
    markAllRead(state) {
      state.items.forEach((n) => { n.isRead = true; });
      state.unreadCount = 0;
    },
    removeNotification(state, action: PayloadAction<number>) {
      const idx = state.items.findIndex((i) => i.id === action.payload);
      if (idx !== -1) {
        if (!state.items[idx].isRead) {
          state.unreadCount = Math.max(0, state.unreadCount - 1);
        }
        state.items.splice(idx, 1);
      }
    },
    clearNotifications(state) {
      state.items = [];
      state.unreadCount = 0;
    },
  },
});

export const {
  setNotifications,
  addNotification,
  markRead,
  markAllRead,
  removeNotification,
  clearNotifications,
} = notificationSlice.actions;

export default notificationSlice.reducer;
