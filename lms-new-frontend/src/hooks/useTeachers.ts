"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAppDispatch, useAppSelector } from "@/core/redux/hooks";
import { fetchTeachersThunk } from "@/core/redux/teacherSlice";
import { Teacher } from "@/types/teacher";

const DEFAULT_PAGE_SIZE = 10;

const useDebouncedValue = <T,>(value: T, delay = 400): T => {
  const [debounced, setDebounced] = useState<T>(value);
  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timeout);
  }, [value, delay]);
  return debounced;
};

export const useTeachers = () => {
  const dispatch = useAppDispatch();

  const { allItems, listStatus, listError, deletingTeacherId, deleteStatus } =
    useAppSelector((state) => state.teachers);

  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [shiftFilter, setShiftFilter] = useState<"all" | "Morning" | "Afternoon" | "Evening">("all");
  const [publishFilter, setPublishFilter] = useState<"all" | "direct" | "approval">("all");
  const [courseFilter, setCourseFilter] = useState<"all" | "has-courses" | "no-courses">("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [availabilityFilter, setAvailabilityFilter] = useState<"all" | "free" | "booked">("all");
  const [timezoneFilter, setTimezoneFilter] = useState<string>("all");
  const debouncedSearch = useDebouncedValue(searchTerm);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, pageSize, shiftFilter, publishFilter, courseFilter, dateFrom, dateTo, availabilityFilter, timezoneFilter]);

  const filteredItems = useMemo<Teacher[]>(() => {
    let items = allItems;

    if (shiftFilter !== "all") {
      items = items.filter((t) =>
        Array.isArray(t.shift) ? t.shift.includes(shiftFilter as "Morning" | "Afternoon" | "Evening") : false
      );
    }

    if (publishFilter !== "all") {
      items = items.filter((t) =>
        publishFilter === "direct" ? (t.canDirectlyPublish ?? true) : !(t.canDirectlyPublish ?? true)
      );
    }

    if (courseFilter !== "all") {
      items = items.filter((t) => {
        const count = Number(t.courseCount ?? 0);
        return courseFilter === "has-courses" ? count > 0 : count === 0;
      });
    }

    if (dateFrom) {
      const from = new Date(dateFrom).getTime();
      items = items.filter((t) => t.createdAt && new Date(t.createdAt).getTime() >= from);
    }

    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      items = items.filter((t) => t.createdAt && new Date(t.createdAt).getTime() <= to.getTime());
    }

    if (availabilityFilter !== "all") {
      items = items.filter((t) => {
        const booked = Number(t.todayBookedMinutes ?? 0);
        return availabilityFilter === "free" ? booked === 0 : booked > 0;
      });
    }

    if (timezoneFilter !== "all") {
      items = items.filter((t) => (t.timeZone ?? null) === timezoneFilter);
    }

    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase();
      items = items.filter(
        (t) =>
          t.firstName?.toLowerCase().includes(q) ||
          t.lastName?.toLowerCase().includes(q) ||
          t.email?.toLowerCase().includes(q) ||
          t.contact?.toLowerCase().includes(q) ||
          t.username?.toLowerCase().includes(q)
      );
    }

    return items;
  }, [allItems, debouncedSearch, shiftFilter, publishFilter, courseFilter, dateFrom, dateTo, availabilityFilter, timezoneFilter]);

  const totalCount = filteredItems.length;

  const paginatedItems = useMemo<Teacher[]>(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, currentPage, pageSize]);

  const loadTeachers = useCallback(async () => {
    await dispatch(fetchTeachersThunk());
  }, [dispatch]);

  useEffect(() => {
    loadTeachers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hasActiveFilters =
    shiftFilter !== "all" ||
    publishFilter !== "all" ||
    courseFilter !== "all" ||
    availabilityFilter !== "all" ||
    timezoneFilter !== "all" ||
    dateFrom !== "" ||
    dateTo !== "" ||
    debouncedSearch.trim() !== "";

  const clearFilters = () => {
    setShiftFilter("all");
    setPublishFilter("all");
    setCourseFilter("all");
    setAvailabilityFilter("all");
    setTimezoneFilter("all");
    setDateFrom("");
    setDateTo("");
    setSearchTerm("");
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
    shiftFilter,
    setShiftFilter,
    publishFilter,
    setPublishFilter,
    courseFilter,
    setCourseFilter,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    availabilityFilter,
    setAvailabilityFilter,
    timezoneFilter,
    setTimezoneFilter,
    hasActiveFilters,
    clearFilters,
    loading: listStatus === "loading",
    error: listError,
    loadTeachers,
    deletingTeacherId,
    deleting: deleteStatus === "loading",
  };
};
