"use client";

import { useCallback } from "react";
import { useAppDispatch, useAppSelector } from "@/core/redux/hooks";
import {
  fetchSchedulesThunk,
  createScheduleThunk,
  updateScheduleThunk,
  deleteScheduleThunk,
  fetchCourseEnrollmentsThunk,
  resetCreateStatus,
  resetUpdateStatus,
  resetDeleteStatus,
} from "@/core/redux/upcomingCourseSlice";
import { CreateUpcomingCoursePayload, UpdateUpcomingCoursePayload } from "@/types/course";

export const useUpcomingCourses = () => {
  const dispatch = useAppDispatch();
  const {
    schedules,
    schedulesStatus,
    schedulesError,
    createStatus,
    createError,
    updateStatus,
    updateError,
    deleteStatus,
    deleteError,
    deletingId,
    courseEnrollments,
    courseEnrollmentsStatus,
  } = useAppSelector((state) => state.upcomingCourses);

  const loadSchedules = useCallback(() => {
    dispatch(fetchSchedulesThunk());
  }, [dispatch]);

  const createSchedule = useCallback(
    (payload: CreateUpcomingCoursePayload) => dispatch(createScheduleThunk(payload)),
    [dispatch]
  );

  const updateSchedule = useCallback(
    (id: string, payload: UpdateUpcomingCoursePayload) =>
      dispatch(updateScheduleThunk({ id, payload })),
    [dispatch]
  );

  const deleteSchedule = useCallback(
    (id: string) => dispatch(deleteScheduleThunk(id)),
    [dispatch]
  );

  const loadCourseEnrollments = useCallback(
    (courseId: string) => dispatch(fetchCourseEnrollmentsThunk(courseId)),
    [dispatch]
  );

  const clearCreateStatus = useCallback(() => dispatch(resetCreateStatus()), [dispatch]);
  const clearUpdateStatus = useCallback(() => dispatch(resetUpdateStatus()), [dispatch]);
  const clearDeleteStatus = useCallback(() => dispatch(resetDeleteStatus()), [dispatch]);

  return {
    schedules,
    loading: schedulesStatus === "loading",
    error: schedulesError,
    createStatus,
    createError,
    updateStatus,
    updateError,
    deleteStatus,
    deleteError,
    deletingId,
    courseEnrollments,
    courseEnrollmentsLoading: courseEnrollmentsStatus === "loading",
    loadSchedules,
    createSchedule,
    updateSchedule,
    deleteSchedule,
    loadCourseEnrollments,
    clearCreateStatus,
    clearUpdateStatus,
    clearDeleteStatus,
  };
};
