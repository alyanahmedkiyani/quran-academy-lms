"use client";

import { useState, useEffect, useCallback } from "react";
import { DatePicker } from "antd";
import dayjs from "dayjs";
import Link from "next/link";
import Datatable from "@/core/common/dataTable";
import { fetchAllPayments, FullPayment } from "@/services/paymentService";

const IncomeReportComponent = () => {
  const currentYear = new Date().getFullYear();
  const [payments, setPayments] = useState<FullPayment[]>([]);
  const [loading, setLoading] = useState(false);

  const [startDate, setStartDate] = useState(`${currentYear}-01-01`);
  const [endDate, setEndDate] = useState(`${currentYear}-12-31`);
  const [searchText] = useState("");

  const runReport = useCallback(async () => {
    setLoading(true);
    try {
      const all = await fetchAllPayments();
      const start = startDate ? new Date(startDate) : null;
      const end = endDate ? new Date(endDate + "T23:59:59") : null;
      const filtered = all.filter((p) => {
        const d = new Date(p.paymentDate || p.createdAt || "");
        if (start && d < start) return false;
        if (end && d > end) return false;
        return true;
      });
      setPayments(filtered);
    } catch {
      //
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => { runReport(); }, []);

  const totalRevenue = payments.reduce((s, p) => s + parseFloat(String(p.amount)), 0);
  const thisMonth = new Date().getMonth();
  const thisYear = new Date().getFullYear();
  const monthRevenue = payments
    .filter((p) => {
      const d = new Date(p.paymentDate || p.createdAt || "");
      return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
    })
    .reduce((s, p) => s + parseFloat(String(p.amount)), 0);

  const uniqueStudents = new Set(payments.map((p) => p.studentId)).size;

  const columns = [
    {
      title: "#",
      dataIndex: "id",
      render: (_: any, __: any, idx: number) => <span className="text-muted fs-12">{idx + 1}</span>,
    },
    {
      title: "Student",
      dataIndex: "Student",
      render: (_: any, record: FullPayment) =>
        record.Student
          ? <span className="text-dark fw-medium">{record.Student.firstName} {record.Student.lastName}</span>
          : <span className="text-muted">—</span>,
      sorter: (a: FullPayment, b: FullPayment) => {
        const nameA = a.Student ? `${a.Student.firstName} ${a.Student.lastName}` : "";
        const nameB = b.Student ? `${b.Student.firstName} ${b.Student.lastName}` : "";
        return nameA.localeCompare(nameB);
      },
    },
    {
      title: "Amount",
      dataIndex: "amount",
      render: (v: any) => <span className="text-dark fw-medium">${parseFloat(v).toFixed(2)}</span>,
      sorter: (a: FullPayment, b: FullPayment) => parseFloat(String(a.amount)) - parseFloat(String(b.amount)),
    },
    {
      title: "Purpose",
      dataIndex: "purpose",
      render: (v: string) => <span className="text-dark">{v || "—"}</span>,
    },
    {
      title: "Date",
      dataIndex: "paymentDate",
      render: (v: string) => (
        <span className="text-dark">{v ? new Date(v).toLocaleDateString() : "—"}</span>
      ),
      sorter: (a: FullPayment, b: FullPayment) =>
        new Date(a.paymentDate || "").getTime() - new Date(b.paymentDate || "").getTime(),
    },
  ];

  return (
    <div className="page-wrapper">
      <div className="content">
        {/* Header */}
        <div className="d-flex align-items-sm-center flex-sm-row flex-column gap-2 mb-3 pb-3 border-bottom">
          <div className="flex-grow-1">
            <h4 className="fw-bold mb-0">Income Report</h4>
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
                <div className="d-flex justify-content-between mb-2">
                  <div>
                    <p className="mb-1 text-truncate">Total Revenue</p>
                    <h6 className="mb-0 fw-bold">${totalRevenue.toFixed(2)}</h6>
                  </div>
                  <span className="avatar avatar-lg bg-soft-primary text-primary rounded-circle flex-shrink-0">
                    <i className="ti ti-currency-dollar fs-24" />
                  </span>
                </div>
                <div className="progress mb-2 progress-sm">
                  <div className="progress-bar bg-primary" role="progressbar" style={{ width: "75%" }} />
                </div>
                <p className="mb-0 fs-13 text-muted">{payments.length} payment{payments.length !== 1 ? "s" : ""} in period</p>
              </div>
            </div>
          </div>
          <div className="col-xl-3 col-md-6 d-flex mb-3">
            <div className="card shadow-sm flex-fill w-100">
              <div className="card-body">
                <div className="d-flex justify-content-between mb-2">
                  <div>
                    <p className="mb-1 text-truncate">This Month</p>
                    <h6 className="mb-0 fw-bold">${monthRevenue.toFixed(2)}</h6>
                  </div>
                  <span className="avatar avatar-lg bg-soft-success text-success rounded-circle flex-shrink-0">
                    <i className="ti ti-calendar-stats fs-24" />
                  </span>
                </div>
                <div className="progress mb-2 progress-sm">
                  <div className="progress-bar bg-success" role="progressbar"
                    style={{ width: totalRevenue > 0 ? `${Math.min((monthRevenue / totalRevenue) * 100, 100)}%` : "0%" }}
                  />
                </div>
                <p className="mb-0 fs-13 text-muted">Current month revenue</p>
              </div>
            </div>
          </div>
          <div className="col-xl-3 col-md-6 d-flex mb-3">
            <div className="card shadow-sm flex-fill w-100">
              <div className="card-body">
                <div className="d-flex justify-content-between mb-2">
                  <div>
                    <p className="mb-1 text-truncate">Avg per Payment</p>
                    <h6 className="mb-0 fw-bold">
                      ${payments.length > 0 ? (totalRevenue / payments.length).toFixed(2) : "0.00"}
                    </h6>
                  </div>
                  <span className="avatar avatar-lg bg-soft-warning text-warning rounded-circle flex-shrink-0">
                    <i className="ti ti-chart-bar fs-24" />
                  </span>
                </div>
                <div className="progress mb-2 progress-sm">
                  <div className="progress-bar bg-warning" role="progressbar" style={{ width: "60%" }} />
                </div>
                <p className="mb-0 fs-13 text-muted">Average payment amount</p>
              </div>
            </div>
          </div>
          <div className="col-xl-3 col-md-6 d-flex mb-3">
            <div className="card shadow-sm flex-fill w-100">
              <div className="card-body">
                <div className="d-flex justify-content-between mb-2">
                  <div>
                    <p className="mb-1 text-truncate">Paying Students</p>
                    <h6 className="mb-0 fw-bold">{uniqueStudents}</h6>
                  </div>
                  <span className="avatar avatar-lg bg-soft-danger text-danger rounded-circle flex-shrink-0">
                    <i className="ti ti-users fs-24" />
                  </span>
                </div>
                <div className="progress mb-2 progress-sm">
                  <div className="progress-bar bg-danger" role="progressbar" style={{ width: "45%" }} />
                </div>
                <p className="mb-0 fs-13 text-muted">Unique students in period</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="card">
          <div className="card-body">
            <div className="row row-gap-2">
              <div className="col-md-5">
                <label className="form-label">Start Date</label>
                <DatePicker
                  style={{ width: "100%" }}
                  value={startDate ? dayjs(startDate) : null}
                  onChange={(_, ds) => setStartDate(ds as string)}
                  format="YYYY-MM-DD"
                  placeholder="Start date"
                />
              </div>
              <div className="col-md-5">
                <label className="form-label">End Date</label>
                <DatePicker
                  style={{ width: "100%" }}
                  value={endDate ? dayjs(endDate) : null}
                  onChange={(_, ds) => setEndDate(ds as string)}
                  format="YYYY-MM-DD"
                  placeholder="End date"
                />
              </div>
              <div className="col-md-2">
                <label className="form-label">&nbsp;</label>
                <div>
                  <button className="btn btn-dark w-100" onClick={runReport} disabled={loading}>
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
            <Datatable columns={columns} dataSource={payments} Selection={false} searchText={searchText} />
          </div>
        )}
      </div>
    </div>
  );
};

export default IncomeReportComponent;
