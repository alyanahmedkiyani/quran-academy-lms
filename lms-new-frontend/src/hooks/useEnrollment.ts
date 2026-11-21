"use client";

import { useCallback } from "react";
import { useAppDispatch, useAppSelector } from "@/core/redux/hooks";
import {
  fetchSchedulesThunk,
  enrollStudentThunk,
  fetchStudentEnrollmentsThunk,
  resetEnrollStatus,
} from "@/core/redux/upcomingCourseSlice";
import { EnrollPayload } from "@/types/course";

export const useEnrollment = () => {
  const dispatch = useAppDispatch();
  const {
    schedules,
    schedulesStatus,
    schedulesError,
    studentEnrollments,
    enrollmentsStatus,
    enrollmentsError,
    enrollStatus,
    enrollError,
    enrollingCourseId,
  } = useAppSelector((state) => state.upcomingCourses);

  const loadUpcomingCourses = useCallback(() => {
    dispatch(fetchSchedulesThunk());
  }, [dispatch]);

  const loadStudentEnrollments = useCallback(
    (studentId: string) => dispatch(fetchStudentEnrollmentsThunk(studentId)),
    [dispatch]
  );

  const enroll = useCallback(
    (payload: EnrollPayload) => dispatch(enrollStudentThunk(payload)),
    [dispatch]
  );

  const clearEnrollStatus = useCallback(() => {
    dispatch(resetEnrollStatus());
  }, [dispatch]);

  const isEnrolled = useCallback(
    (courseId: string | number) =>
      studentEnrollments.some((e) => String(e.courseId) === String(courseId)),
    [studentEnrollments]
  );

  return {
    upcomingCourses: schedules,
    upcomingLoading: schedulesStatus === "loading",
    upcomingError: schedulesError,
    studentEnrollments,
    enrollmentsLoading: enrollmentsStatus === "loading",
    enrollmentsError,
    enrollStatus,
    enrollError,
    enrollingCourseId,
    loadUpcomingCourses,
    loadStudentEnrollments,
    enroll,
    clearEnrollStatus,
    isEnrolled,
  };
};
