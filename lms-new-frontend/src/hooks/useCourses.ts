"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAppDispatch, useAppSelector } from "@/core/redux/hooks";
import { fetchCoursesThunk } from "@/core/redux/courseSlice";
import { Course } from "@/types/course";

const DEFAULT_PAGE_SIZE = 10;

const useDebouncedValue = <T,>(value: T, delay = 400): T => {
  const [debounced, setDebounced] = useState<T>(value);
  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timeout);
  }, [value, delay]);
  return debounced;
};

export const useCourses = () => {
  const dispatch = useAppDispatch();
  const { allItems, listStatus, listError, deleteStatus, deletingCourseId } = useAppSelector(
    (state) => state.courses
  );

  const [searchTerm, setSearchTerm]     = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "upcoming">("all");
  const [dateFrom, setDateFrom]         = useState("");
  const [dateTo, setDateTo]             = useState("");
  const [currentPage, setCurrentPage]   = useState(1);
  const [pageSize, setPageSize]         = useState(DEFAULT_PAGE_SIZE);
  const debouncedSearch = useDebouncedValue(searchTerm);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, statusFilter, dateFrom, dateTo, pageSize]);

  const filteredItems = useMemo<Course[]>(() => {
    let items = allItems;

    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase();
      items = items.filter(
        (c) =>
          c.courseName.toLowerCase().includes(q) ||
          (c.duration ?? "").toLowerCase().includes(q) ||
          (c.description ?? "").toLowerCase().includes(q)
      );
    }

    if (statusFilter === "active") {
      items = items.filter((c) => !c.isComing);
    } else if (statusFilter === "upcoming") {
      items = items.filter((c) => !!c.isComing);
    }

    if (dateFrom) {
      items = items.filter((c) => c.createdAt && c.createdAt >= dateFrom);
    }
    if (dateTo) {
      items = items.filter((c) => c.createdAt && c.createdAt <= dateTo + "T23:59:59");
    }

    return items;
  }, [allItems, debouncedSearch, statusFilter, dateFrom, dateTo]);

  const totalCount = filteredItems.length;

  const paginatedItems = useMemo<Course[]>(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, currentPage, pageSize]);

  const loadCourses = useCallback(async () => {
    await dispatch(fetchCoursesThunk());
  }, [dispatch]);

  useEffect(() => {
    loadCourses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hasActiveFilters = statusFilter !== "all" || !!dateFrom || !!dateTo;

  const clearFilters = () => {
    setStatusFilter("all");
    setDateFrom("");
    setDateTo("");
    setSearchTerm("");
  };

  // counts for pills
  const activeCount   = useMemo(() => allItems.filter((c) => !c.isComing).length,  [allItems]);
  const upcomingCount = useMemo(() => allItems.filter((c) => !!c.isComing).length, [allItems]);

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
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    hasActiveFilters,
    clearFilters,
    activeCount,
    upcomingCount,
    loading: listStatus === "loading",
    error: listError,
    loadCourses,
    deletingCourseId,
    deleting: deleteStatus === "loading",
  };
};
