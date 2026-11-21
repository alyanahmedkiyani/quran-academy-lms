"use client";

import { useAppDispatch, useAppSelector } from "@/core/redux/hooks";
import { fetchStudentCoursesThunk } from "@/core/redux/courseDetailsSlice";

export const useStudentCourses = () => {
  const dispatch = useAppDispatch();
  const { studentAssignments, studentListStatus, studentListError } = useAppSelector(
    (state) => state.courseDetails
  );

  const loadCourses = (studentId: string) => {
    dispatch(fetchStudentCoursesThunk(studentId));
  };

  return {
    studentAssignments,
    loading: studentListStatus === "idle" || studentListStatus === "loading",
    error: studentListError,
    loadCourses,
  };
};
