"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAppDispatch, useAppSelector } from "@/core/redux/hooks";
import { fetchParentsThunk } from "@/core/redux/parentSlice";
import { Parent } from "@/types/parent";

const DEFAULT_PAGE_SIZE = 10;

const useDebouncedValue = <T,>(value: T, delay = 400): T => {
  const [debounced, setDebounced] = useState<T>(value);
  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timeout);
  }, [value, delay]);
  return debounced;
};

export const useParents = () => {
  const dispatch = useAppDispatch();

  const { allItems, listStatus, listError, deletingParentId, deleteStatus } =
    useAppSelector((state) => state.parents);

  const [searchTerm, setSearchTerm]             = useState("");
  const [currentPage, setCurrentPage]           = useState(1);
  const [pageSize, setPageSize]                 = useState(DEFAULT_PAGE_SIZE);
  const [childrenFilter, setChildrenFilter]     = useState<"all" | "has-children" | "no-children">("all");
  const [feeFilter, setFeeFilter]               = useState<"all" | "all-paid" | "has-unpaid">("all");
  const [statusFilter, setStatusFilter]         = useState<"all" | "active" | "inactive">("all");
  const [dateFrom, setDateFrom]                 = useState<string>("");
  const [dateTo, setDateTo]                     = useState<string>("");
  const [timezoneFilter, setTimezoneFilter]     = useState<string>("all");
  const debouncedSearch = useDebouncedValue(searchTerm);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, pageSize, childrenFilter, feeFilter, statusFilter, dateFrom, dateTo, timezoneFilter]);

  const filteredItems = useMemo<Parent[]>(() => {
    let items = allItems;

    if (childrenFilter !== "all") {
      items = items.filter((p) => {
        const count = Number(p.childCount ?? 0);
        return childrenFilter === "has-children" ? count > 0 : count === 0;
      });
    }

    if (feeFilter !== "all") {
      items = items.filter((p) => {
        const unpaid = Number(p.unpaidFeesCount ?? 0);
        return feeFilter === "all-paid" ? unpaid === 0 : unpaid > 0;
      });
    }

    if (statusFilter !== "all") {
      items = items.filter((p) =>
        statusFilter === "active" ? (p.isActive !== false) : (p.isActive === false)
      );
    }

    if (dateFrom) {
      const from = new Date(dateFrom).getTime();
      items = items.filter((p) => p.createdAt && new Date(p.createdAt).getTime() >= from);
    }

    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      items = items.filter((p) => p.createdAt && new Date(p.createdAt).getTime() <= to.getTime());
    }

    if (timezoneFilter !== "all") {
      items = items.filter((p) => (p.timeZone ?? null) === timezoneFilter);
    }

    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase();
      items = items.filter(
        (p) =>
          p.firstName?.toLowerCase().includes(q) ||
          p.lastName?.toLowerCase().includes(q) ||
          p.email?.toLowerCase().includes(q) ||
          p.username?.toLowerCase().includes(q) ||
          p.contact?.toLowerCase().includes(q) ||
          p.address?.toLowerCase().includes(q)
      );
    }

    return items;
  }, [allItems, debouncedSearch, childrenFilter, feeFilter, statusFilter, dateFrom, dateTo, timezoneFilter]);

  const totalCount = filteredItems.length;

  const paginatedItems = useMemo<Parent[]>(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, currentPage, pageSize]);

  const loadParents = useCallback(async () => {
    await dispatch(fetchParentsThunk());
  }, [dispatch]);

  useEffect(() => {
    loadParents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hasActiveFilters =
    childrenFilter !== "all" ||
    feeFilter !== "all" ||
    statusFilter !== "all" ||
    timezoneFilter !== "all" ||
    dateFrom !== "" ||
    dateTo !== "" ||
    debouncedSearch.trim() !== "";

  const clearFilters = () => {
    setChildrenFilter("all");
    setFeeFilter("all");
    setStatusFilter("all");
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
    childrenFilter,
    setChildrenFilter,
    feeFilter,
    setFeeFilter,
    statusFilter,
    setStatusFilter,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    timezoneFilter,
    setTimezoneFilter,
    hasActiveFilters,
    clearFilters,
    loading: listStatus === "loading",
    error: listError,
    loadParents,
    deletingParentId,
    deleting: deleteStatus === "loading",
  };
};
