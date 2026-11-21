import { configureStore } from '@reduxjs/toolkit';
import sidebarSlice from './sidebarSlice';
import themeReducer from './themeSlice';
import authReducer from './authSlice';
import teachersReducer from './teacherSlice';
import studentsReducer from './studentSlice';
import parentsReducer from './parentSlice';
import coursesReducer from './courseSlice';
import courseDetailsReducer from './courseDetailsSlice';
import upcomingCoursesReducer from './upcomingCourseSlice';
import calendarReducer from './calendarSlice';
import chatReducer from './chatSlice';
import notificationReducer from './notificationSlice';
import attendanceReducer from './attendanceSlice';
import feedbackReducer from './feedbackSlice';

const store = configureStore({
  reducer: {
    sidebarSlice,
    theme: themeReducer,
    auth: authReducer,
    teachers: teachersReducer,
    students: studentsReducer,
    parents: parentsReducer,
    courses: coursesReducer,
    courseDetails: courseDetailsReducer,
    upcomingCourses: upcomingCoursesReducer,
    calendar: calendarReducer,
    chat: chatReducer,
    notifications: notificationReducer,
    attendance: attendanceReducer,
    feedback: feedbackReducer,
  },
});

// Keep localStorage in sync with auth.user so profileImg (and other profile
// fields updated via updateUserProfile / patchUserShift) survive page refresh.
let prevUser = store.getState().auth.user;
store.subscribe(() => {
  const currentUser = store.getState().auth.user;
  if (currentUser !== prevUser) {
    prevUser = currentUser;
    if (typeof window !== 'undefined') {
      try {
        if (currentUser) {
          window.localStorage.setItem('hms:user', JSON.stringify(currentUser));
        }
      } catch {
        // ignore storage errors
      }
    }
  }
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export default store;
