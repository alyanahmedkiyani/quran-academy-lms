"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { fetchMonthlyRevenue } from "@/services/paymentService";
import { fetchExpenses } from "@/services/expenseService";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const MONTH_OPTIONS = [
  { value: 0, label: "All Months" },
  ...MONTH_LABELS.map((label, i) => ({ value: i + 1, label })),
];

const fmt = (n: number) =>
  n.toLocaleString("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 });

const RevenueExpensesChart = () => {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [month, setMonth] = useState(0); // 0 = all
  const [loading, setLoading] = useState(false);

  const [revenueData, setRevenueData] = useState<number[]>(Array(12).fill(0));
  const [expenseData, setExpenseData] = useState<number[]>(Array(12).fill(0));

  const years = [currentYear - 2, currentYear - 1, currentYear, currentYear + 1];

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [revPoints, expenses] = await Promise.all([
          fetchMonthlyRevenue(year, month || undefined),
          fetchExpenses({
            startDate: month
              ? `${year}-${String(month).padStart(2, "0")}-01`
              : `${year}-01-01`,
            endDate: month
              ? `${year}-${String(month).padStart(2, "0")}-${new Date(year, month, 0).getDate()}`
              : `${year}-12-31`,
          }),
        ]);

        // Build 12-slot arrays (or single-month arrays)
        if (month === 0) {
          const rev = Array(12).fill(0);
          revPoints.forEach((p) => { rev[p.month - 1] = p.revenue; });

          const exp = Array(12).fill(0);
          expenses.forEach((e) => {
            const m = new Date(e.date).getMonth();
            exp[m] += parseFloat(String(e.amount));
          });

          setRevenueData(rev);
          setExpenseData(exp);
        } else {
          // Single month — still show as 12-slot so the chart structure is consistent
          const rev = Array(12).fill(0);
          revPoints.forEach((p) => { rev[p.month - 1] = p.revenue; });

          const exp = Array(12).fill(0);
          expenses.forEach((e) => {
            const m = new Date(e.date).getMonth();
            exp[m] += parseFloat(String(e.amount));
          });

          setRevenueData(rev);
          setExpenseData(exp);
        }
      } catch {
        //
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [year, month]);

  // Which months to show on x-axis
  const visibleMonths = month === 0 ? MONTH_LABELS : [MONTH_LABELS[month - 1]];
  const visibleRevenue = month === 0 ? revenueData : [revenueData[month - 1]];
  const visibleExpenses = month === 0 ? expenseData : [expenseData[month - 1]];

  const totalRevenue = visibleRevenue.reduce((a, b) => a + b, 0);
  const totalExpenses = visibleExpenses.reduce((a, b) => a + b, 0);
  const netProfit = totalRevenue - totalExpenses;

  const chartOptions: any = {
    chart: {
      type: "bar",
      height: 320,
      toolbar: { show: false },
      fontFamily: "inherit",
    },
    plotOptions: {
      bar: {
        horizontal: false,
        columnWidth: month === 0 ? "50%" : "30%",
        borderRadius: 4,
        borderRadiusApplication: "end",
        grouped: true,
      },
    },
    dataLabels: { enabled: false },
    colors: ["#3B82F6", "#EF4444"],
    legend: {
      show: true,
      position: "top",
      horizontalAlign: "right",
      markers: { radius: 4 },
      labels: { colors: "#374151" },
    },
    xaxis: {
      categories: visibleMonths,
      axisBorder: { show: false },
      axisTicks: { show: false },
      labels: { style: { fontSize: "13px", colors: "#6B7280" } },
    },
    yaxis: {
      labels: {
        formatter: (v: number) => `$${v >= 1000 ? (v / 1000).toFixed(1) + "k" : v.toFixed(0)}`,
        style: { fontSize: "12px", colors: "#6B7280" },
      },
    },
    grid: {
      borderColor: "#F3F4F6",
      strokeDashArray: 4,
      yaxis: { lines: { show: true } },
      xaxis: { lines: { show: false } },
    },
    tooltip: {
      y: { formatter: (v: number) => `$${v.toFixed(2)}` },
      theme: "light",
    },
    stroke: { show: true, width: 2, colors: ["transparent"] },
    fill: { opacity: 1 },
  };

  const series = [
    { name: "Revenue", data: visibleRevenue },
    { name: "Expenses", data: visibleExpenses },
  ];

  return (
    <div className="card shadow-sm">
      <div className="card-body">
        {/* Header row */}
        <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-4">
          <div>
            <h5 className="fw-bold mb-0">Revenue vs Expenses</h5>
            <p className="text-muted fs-13 mb-0">
              {month === 0 ? `Full year ${year}` : `${MONTH_LABELS[month - 1]} ${year}`}
            </p>
          </div>
          <div className="d-flex align-items-center gap-2">
            <select
              className="form-select form-select-sm"
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              style={{ minWidth: 130 }}
            >
              {MONTH_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <select
              className="form-select form-select-sm"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              style={{ minWidth: 90 }}
            >
              {years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>

        {/* KPI pills */}
        <div className="d-flex flex-wrap gap-3 mb-3">
          <div className="d-flex align-items-center gap-2 px-3 py-2 rounded" style={{ background: "#EFF6FF" }}>
            <span className="rounded" style={{ width: 10, height: 10, background: "#3B82F6", display: "inline-block" }} />
            <span className="fs-13 text-muted me-1">Revenue</span>
            <span className="fw-bold text-dark fs-14">{fmt(totalRevenue)}</span>
          </div>
          <div className="d-flex align-items-center gap-2 px-3 py-2 rounded" style={{ background: "#FEF2F2" }}>
            <span className="rounded" style={{ width: 10, height: 10, background: "#EF4444", display: "inline-block" }} />
            <span className="fs-13 text-muted me-1">Expenses</span>
            <span className="fw-bold text-dark fs-14">{fmt(totalExpenses)}</span>
          </div>
          <div
            className="d-flex align-items-center gap-2 px-3 py-2 rounded"
            style={{ background: netProfit >= 0 ? "#F0FDF4" : "#FEF2F2" }}
          >
            <i className={`ti ${netProfit >= 0 ? "ti-trending-up text-success" : "ti-trending-down text-danger"} fs-16`} />
            <span className="fs-13 text-muted me-1">Net Profit</span>
            <span className={`fw-bold fs-14 ${netProfit >= 0 ? "text-success" : "text-danger"}`}>
              {fmt(netProfit)}
            </span>
          </div>
        </div>

        {/* Chart */}
        {loading ? (
          <div className="d-flex align-items-center justify-content-center" style={{ height: 320 }}>
            <div className="spinner-border text-primary" />
          </div>
        ) : (
          <Chart options={chartOptions} series={series} type="bar" height={320} />
        )}
      </div>
    </div>
  );
};

export default RevenueExpensesChart;
