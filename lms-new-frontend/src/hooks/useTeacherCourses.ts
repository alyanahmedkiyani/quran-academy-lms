"use client";

import { useAppDispatch, useAppSelector } from "@/core/redux/hooks";
import { fetchTeacherCoursesThunk } from "@/core/redux/courseDetailsSlice";

export const useTeacherCourses = () => {
  const dispatch = useAppDispatch();
  const { teacherAssignments, teacherListStatus, teacherListError } = useAppSelector(
    (state) => state.courseDetails
  );

  const loadCourses = (teacherId: string) => {
    dispatch(fetchTeacherCoursesThunk(teacherId));
  };

  return {
    teacherAssignments,
    loading: teacherListStatus === "idle" || teacherListStatus === "loading",
    error: teacherListError,
    loadCourses,
  };
};
