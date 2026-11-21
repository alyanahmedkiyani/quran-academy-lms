"use client";

import { useState, useEffect, useCallback } from "react";
import { DatePicker } from "antd";
import dayjs from "dayjs";
import Link from "next/link";
import { Expense, ExpenseCategory, ExpenseStatus } from "@/types/expenses";
import { fetchExpenses, fetchExpenseCategories } from "@/services/expenseService";
import Datatable from "@/core/common/dataTable";

const STATUSES: { value: string; label: string }[] = [
  { value: "", label: "All Statuses" },
  { value: "New", label: "New" },
  { value: "Pending", label: "Pending" },
  { value: "Approved", label: "Approved" },
  { value: "Rejected", label: "Rejected" },
];

const statusClass: Record<ExpenseStatus, string> = {
  Approved: "badge-soft-success border-success",
  Pending: "badge-soft-warning border-warning",
  New: "badge-soft-primary border-primary",
  Rejected: "badge-soft-danger border-danger",
};

const ExpenseReportComponent = () => {
  const currentYear = new Date().getFullYear();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [loading, setLoading] = useState(false);

  const [startDate, setStartDate] = useState(`${currentYear}-01-01`);
  const [endDate, setEndDate] = useState(`${currentYear}-12-31`);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");

  const runReport = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchExpenses({
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        categoryId: selectedCategory || undefined,
        status: selectedStatus || undefined,
      });
      setExpenses(data);
    } catch {
      //
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, selectedCategory, selectedStatus]);

  useEffect(() => {
    fetchExpenseCategories().then(setCategories).catch(() => {});
    runReport();
  }, []);

  const totalAmount = expenses.reduce((s, e) => s + parseFloat(String(e.amount)), 0);
  const approvedAmount = expenses.filter((e) => e.status === "Approved").reduce((s, e) => s + parseFloat(String(e.amount)), 0);
  const pendingAmount = expenses.filter((e) => e.status === "Pending").reduce((s, e) => s + parseFloat(String(e.amount)), 0);
  const rejectedCount = expenses.filter((e) => e.status === "Rejected").length;

  const columns = [
    {
      title: "Expense",
      dataIndex: "title",
      sorter: (a: Expense, b: Expense) => a.title.localeCompare(b.title),
    },
    {
      title: "Category",
      dataIndex: "Category",
      render: (_: any, record: Expense) => (
        <span className="text-dark">{record.Category?.name ?? "—"}</span>
      ),
    },
    {
      title: "Amount",
      dataIndex: "amount",
      render: (v: any) => <span className="text-dark fw-medium">${parseFloat(v).toFixed(2)}</span>,
      sorter: (a: Expense, b: Expense) => parseFloat(String(a.amount)) - parseFloat(String(b.amount)),
    },
    {
      title: "Date",
      dataIndex: "date",
      render: (v: string) => <span className="text-dark">{v}</span>,
      sorter: (a: Expense, b: Expense) => a.date.localeCompare(b.date),
    },
    {
      title: "Purchased By",
      dataIndex: "purchasedBy",
      render: (v: string) => <span className="text-dark fw-medium">{v || "—"}</span>,
    },
    {
      title: "Status",
      dataIndex: "status",
      render: (text: ExpenseStatus) => (
        <span className={`badge border ${statusClass[text]} px-2 py-1 fs-13 fw-medium`}>{text}</span>
      ),
      sorter: (a: Expense, b: Expense) => a.status.localeCompare(b.status),
    },
    {
      title: "Payment Method",
      dataIndex: "paymentMethod",
      render: (v: string) => <span className="text-dark">{v || "—"}</span>,
    },
  ];

  return (
    <div className="page-wrapper">
      <div className="content">
        {/* Header */}
        <div className="d-flex align-items-sm-center flex-sm-row flex-column gap-2 mb-3 pb-3 border-bottom">
          <div className="flex-grow-1">
            <h4 className="fw-bold mb-0">Expenses Report</h4>
          </div>
          <div className="text-end d-flex">
            <div className="dropdown me-1">
              <Link
                href="#"
                className="btn btn-md fs-14 fw-normal border bg-white rounded text-dark d-inline-flex align-items-center"
                data-bs-toggle="dropdown"
              >
                Export
                <i className="ti ti-chevron-down ms-2" />
              </Link>
              <ul className="dropdown-menu p-2">
                <li><Link className="dropdown-item" href="#">Download as PDF</Link></li>
                <li><Link className="dropdown-item" href="#">Download as Excel</Link></li>
              </ul>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="row mb-3">
          <div className="col-xl-3 col-md-6 d-flex mb-3">
            <div className="card shadow-sm flex-fill w-100">
              <div className="card-body">
                <div className="d-flex justify-content-between align-items-end">
                  <div>
                    <p className="mb-1 text-truncate">Total Expenses</p>
                    <h6 className="mb-2 fw-bold">${totalAmount.toFixed(2)}</h6>
                    <p className="mb-0 fs-13 text-muted">{expenses.length} records</p>
                  </div>
                  <span className="avatar avatar-md widget-icon bg-soft-primary border border-primary text-primary rounded-2 flex-shrink-0">
                    <i className="ti ti-currency-dollar fs-14" />
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div className="col-xl-3 col-md-6 d-flex mb-3">
            <div className="card shadow-sm flex-fill w-100">
              <div className="card-body">
                <div className="d-flex justify-content-between align-items-end">
                  <div>
                    <p className="mb-1 text-truncate">Approved</p>
                    <h6 className="mb-2 fw-bold">${approvedAmount.toFixed(2)}</h6>
                    <p className="mb-0 fs-13 text-muted">{expenses.filter((e) => e.status === "Approved").length} expenses</p>
                  </div>
                  <span className="avatar avatar-md widget-icon bg-soft-success border border-success text-success rounded-2 flex-shrink-0">
                    <i className="ti ti-check fs-14" />
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div className="col-xl-3 col-md-6 d-flex mb-3">
            <div className="card shadow-sm flex-fill w-100">
              <div className="card-body">
                <div className="d-flex justify-content-between align-items-end">
                  <div>
                    <p className="mb-1 text-truncate">Pending Approval</p>
                    <h6 className="mb-2 fw-bold">${pendingAmount.toFixed(2)}</h6>
                    <p className="mb-0 fs-13 text-muted">{expenses.filter((e) => e.status === "Pending").length} expenses</p>
                  </div>
                  <span className="avatar avatar-md widget-icon bg-soft-warning border border-warning text-warning rounded-2 flex-shrink-0">
                    <i className="ti ti-clock fs-14" />
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div className="col-xl-3 col-md-6 d-flex mb-3">
            <div className="card shadow-sm flex-fill w-100">
              <div className="card-body">
                <div className="d-flex justify-content-between align-items-end">
                  <div>
                    <p className="mb-1 text-truncate">Rejected</p>
                    <h6 className="mb-2 fw-bold">{rejectedCount}</h6>
                    <p className="mb-0 fs-13 text-muted">expense{rejectedCount !== 1 ? "s" : ""}</p>
                  </div>
                  <span className="avatar avatar-md widget-icon bg-soft-danger border border-danger text-danger rounded-2 flex-shrink-0">
                    <i className="ti ti-x fs-14" />
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="card">
          <div className="card-body">
            <div className="row row-gap-2">
              <div className="col-md-3">
                <label className="form-label">Start Date</label>
                <DatePicker
                  style={{ width: "100%" }}
                  value={startDate ? dayjs(startDate) : null}
                  onChange={(_, ds) => setStartDate(ds as string)}
                  format="YYYY-MM-DD"
                  placeholder="Start date"
                />
              </div>
              <div className="col-md-3">
                <label className="form-label">End Date</label>
                <DatePicker
                  style={{ width: "100%" }}
                  value={endDate ? dayjs(endDate) : null}
                  onChange={(_, ds) => setEndDate(ds as string)}
                  format="YYYY-MM-DD"
                  placeholder="End date"
                />
              </div>
              <div className="col-md-3">
                <label className="form-label">Category</label>
                <select
                  className="form-select"
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                >
                  <option value="">All Categories</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="col-md-3">
                <label className="form-label">Status</label>
                <select
                  className="form-select"
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                >
                  {STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
              <div className="col-md-12">
                <div className="d-flex align-items-center justify-content-end">
                  <button className="btn btn-dark" onClick={runReport} disabled={loading}>
                    <i className="ti ti-player-play me-1" />
                    {loading ? "Loading..." : "Run Report"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="text-center py-5"><div className="spinner-border text-primary" /></div>
        ) : (
          <div className="table-responsive">
            <Datatable columns={columns} dataSource={expenses} Selection={false} searchText={""} />
          </div>
        )}
      </div>
    </div>
  );
};

export default ExpenseReportComponent;
