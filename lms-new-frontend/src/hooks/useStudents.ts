"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAppDispatch, useAppSelector } from "@/core/redux/hooks";
import { fetchStudentsThunk } from "@/core/redux/studentSlice";
import { Student } from "@/types/student";

const DEFAULT_PAGE_SIZE = 10;

const useDebouncedValue = <T,>(value: T, delay = 400): T => {
  const [debounced, setDebounced] = useState<T>(value);
  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timeout);
  }, [value, delay]);
  return debounced;
};

export type AssignFilter   = "all" | "assigned" | "unassigned";
export type FeeFilter      = "all" | "paid" | "unpaid" | "none";
export type TeacherFilter  = "all" | string; // teacher id as string
export type ChannelFilter  = "all" | "Meta" | "Google" | "TikTok" | "SEO" | "Email" | "Reference";
export type LabelFilter    = "all" | "Unassigned" | "Trial" | "New Enrollment" | "Lost" | "Struck off";

export const useStudents = () => {
  const dispatch = useAppDispatch();

  const { allItems, listStatus, listError, deletingStudentId, deleteStatus } =
    useAppSelector((state) => state.students);

  const [searchTerm, setSearchTerm]         = useState("");
  const [statusFilter, setStatusFilter]     = useState<"all" | "active" | "inactive">("all");
  const [assignFilter, setAssignFilter]     = useState<AssignFilter>("all");
  const [planFilter, setPlanFilter]         = useState<string>("all");
  const [feeFilter, setFeeFilter]           = useState<FeeFilter>("all");
  const [teacherFilter, setTeacherFilter]   = useState<TeacherFilter>("all");
  const [channelFilter, setChannelFilter]   = useState<ChannelFilter>("all");
  const [labelFilter, setLabelFilter]       = useState<LabelFilter>("all");
  const [timezoneFilter, setTimezoneFilter] = useState<string>("all");
  const [currentPage, setCurrentPage]       = useState(1);
  const [pageSize, setPageSize]             = useState(DEFAULT_PAGE_SIZE);
  const debouncedSearch = useDebouncedValue(searchTerm);

  // Reset to page 1 whenever any filter/search/pageSize changes
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, statusFilter, assignFilter, planFilter, feeFilter, teacherFilter, channelFilter, labelFilter, timezoneFilter, pageSize]);

  const filteredItems = useMemo<Student[]>(() => {
    let items = allItems;

    if (statusFilter !== "all") {
      items = items.filter((s) => (s.status ?? "active").toLowerCase() === statusFilter);
    }

    if (assignFilter === "assigned") {
      items = items.filter((s) => s.isAssigned === true);
    } else if (assignFilter === "unassigned") {
      items = items.filter((s) => !s.isAssigned);
    }

    if (planFilter !== "all") {
      items = items.filter((s) => String(s.plan?.id ?? s.planId ?? "") === planFilter);
    }

    if (feeFilter !== "all") {
      items = items.filter((s) => (s.feeStatus ?? "none") === feeFilter);
    }

    if (teacherFilter !== "all") {
      items = items.filter((s) => String(s.assignedTeacher?.id ?? "") === teacherFilter);
    }

    if (channelFilter !== "all") {
      items = items.filter((s) => (s.enrollmentChannel ?? null) === channelFilter);
    }

    if (labelFilter !== "all") {
      items = items.filter((s) => (s.studentLabel ?? null) === labelFilter);
    }

    if (timezoneFilter !== "all") {
      items = items.filter((s) => (s.timeZone ?? null) === timezoneFilter);
    }

    if (!debouncedSearch.trim()) return items;
    const q = debouncedSearch.toLowerCase();
    return items.filter(
      (s) =>
        s.firstName?.toLowerCase().includes(q) ||
        s.lastName?.toLowerCase().includes(q) ||
        s.email?.toLowerCase().includes(q) ||
        s.username?.toLowerCase().includes(q) ||
        s.contact?.toLowerCase().includes(q) ||
        s.address?.toLowerCase().includes(q)
    );
  }, [allItems, debouncedSearch, statusFilter, assignFilter, planFilter, feeFilter, teacherFilter, channelFilter, labelFilter, timezoneFilter]);

  const totalCount = filteredItems.length;

  const paginatedItems = useMemo<Student[]>(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, currentPage, pageSize]);

  const loadStudents = useCallback(async () => {
    await dispatch(fetchStudentsThunk());
  }, [dispatch]);

  useEffect(() => {
    loadStudents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hasActiveFilters =
    searchTerm !== "" ||
    statusFilter !== "all" ||
    assignFilter !== "all" ||
    planFilter !== "all" ||
    feeFilter !== "all" ||
    teacherFilter !== "all" ||
    channelFilter !== "all" ||
    labelFilter !== "all" ||
    timezoneFilter !== "all";

  const clearFilters = () => {
    setSearchTerm("");
    setStatusFilter("all");
    setAssignFilter("all");
    setPlanFilter("all");
    setFeeFilter("all");
    setTeacherFilter("all");
    setChannelFilter("all");
    setLabelFilter("all");
    setTimezoneFilter("all");
    setCurrentPage(1);
  };

  return {
    allItems,
    paginatedItems,
    filteredItems,
    totalCount,
    currentPage,
    setCurrentPage,
    pageSize,
    setPageSize,
    searchTerm,
    setSearchTerm,
    statusFilter,
    setStatusFilter,
    assignFilter,
    setAssignFilter,
    planFilter,
    setPlanFilter,
    feeFilter,
    setFeeFilter,
    teacherFilter,
    setTeacherFilter,
    channelFilter,
    setChannelFilter,
    labelFilter,
    setLabelFilter,
    timezoneFilter,
    setTimezoneFilter,
    hasActiveFilters,
    clearFilters,
    loading: listStatus === "loading",
    error: listError,
    loadStudents,
    deletingStudentId,
    deleting: deleteStatus === "loading",
  };
};
