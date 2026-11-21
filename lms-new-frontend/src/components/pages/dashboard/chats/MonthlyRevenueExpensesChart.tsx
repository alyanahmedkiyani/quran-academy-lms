"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { fetchPaymentRecords } from "@/services/paymentService";
import { fetchMonthlyRevenue } from "@/services/paymentService";
import { fetchExpenses } from "@/services/expenseService";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const MONTH_FULL  = ["January","February","March","April","May","June","July","August","September","October","November","December"];

type Period = "this_month" | "last_3" | "last_6";

const PERIODS: { value: Period; label: string }[] = [
  { value: "this_month", label: "This Month" },
  { value: "last_3",     label: "Last 3 Months" },
  { value: "last_6",     label: "Last 6 Months" },
];

// Build weekly buckets for a given year/month
function weeklyBuckets(year: number, month: number) {
  const daysInMonth = new Date(year, month, 0).getDate();
  const buckets: { label: string; start: number; end: number }[] = [];
  for (let day = 1; day <= daysInMonth; day += 7) {
    buckets.push({
      label: `${MONTH_NAMES[month - 1]} ${day}`,
      start: day,
      end:   Math.min(day + 6, daysInMonth),
    });
  }
  return buckets;
}

const MonthlyRevenueExpensesChart = () => {
  const now   = new Date();
  const [period, setPeriod] = useState<Period>("this_month");
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [revSeries,  setRevSeries]  = useState<number[]>([]);
  const [expSeries,  setExpSeries]  = useState<number[]>([]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const year  = now.getFullYear();
        const month = now.getMonth() + 1; // 1-based

        if (period === "this_month") {
          // Weekly grouping for current month
          const pad  = (n: number) => String(n).padStart(2, "0");
          const daysInMonth = new Date(year, month, 0).getDate();
          const startDate = `${year}-${pad(month)}-01`;
          const endDate   = `${year}-${pad(month)}-${pad(daysInMonth)}`;

          const [payments, expenses] = await Promise.all([
            fetchPaymentRecords(startDate, endDate),
            fetchExpenses({ startDate, endDate }),
          ]);

          const buckets = weeklyBuckets(year, month);
          const rev = buckets.map(b =>
            payments
              .filter(p => { const d = new Date(p.paymentDate).getDate(); return d >= b.start && d <= b.end; })
              .reduce((s, p) => s + parseFloat(String(p.amount)), 0)
          );
          const exp = buckets.map(b =>
            expenses
              .filter(e => { const d = new Date(e.date).getDate(); return d >= b.start && d <= b.end; })
              .reduce((s, e) => s + parseFloat(String(e.amount)), 0)
          );
          setCategories(buckets.map(b => b.label));
          setRevSeries(rev);
          setExpSeries(exp);

        } else {
          // Monthly grouping
          const count = period === "last_3" ? 3 : 6;
          const labels: string[] = [];
          const revenueMap: Record<string, number> = {};
          const expenseMap: Record<string, number> = {};

          for (let i = count - 1; i >= 0; i--) {
            const d = new Date(year, month - 1 - i, 1);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,"0")}`;
            labels.push(MONTH_NAMES[d.getMonth()]);
            revenueMap[key] = 0;
            expenseMap[key] = 0;
          }

          // Oldest month's start
          const oldestD = new Date(year, month - count, 1);
          const startDate = `${oldestD.getFullYear()}-${String(oldestD.getMonth()+1).padStart(2,"0")}-01`;
          const endD      = new Date(year, month, 0);
          const endDate   = `${endD.getFullYear()}-${String(endD.getMonth()+1).padStart(2,"0")}-${String(endD.getDate()).padStart(2,"0")}`;

          const [revPoints, expenses] = await Promise.all([
            fetchMonthlyRevenue(oldestD.getFullYear()),
            fetchExpenses({ startDate, endDate }),
          ]);

          revPoints.forEach(p => {
            const key = `${year}-${String(p.month).padStart(2,"0")}`;
            if (key in revenueMap) revenueMap[key] = p.revenue;
          });
          expenses.forEach(e => {
            const d   = new Date(e.date);
            const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
            if (key in expenseMap) expenseMap[key] += parseFloat(String(e.amount));
          });

          setCategories(labels);
          setRevSeries(Object.values(revenueMap));
          setExpSeries(Object.values(expenseMap));
        }
      } catch {
        //
      } finally {
        setLoading(false);
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  const totalRev = revSeries.reduce((a, b) => a + b, 0);
  const totalExp = expSeries.reduce((a, b) => a + b, 0);
  const net      = totalRev - totalExp;
  const fmt      = (n: number) => n >= 1000 ? `$${(n/1000).toFixed(1)}k` : `$${n.toFixed(0)}`;

  const options: any = {
    chart: {
      type: "area",
      height: 195,
      toolbar: { show: false },
      zoom:    { enabled: false },
    },
    stroke:      { curve: "smooth", width: 2.5 },
    markers:     { size: 4, strokeWidth: 0, hover: { sizeOffset: 2 } },
    colors:      ["#22C55E", "#F87171"],
    fill: {
      type: "gradient",
      gradient: { shadeIntensity: 1, opacityFrom: 0.15, opacityTo: 0.02, stops: [0, 100] },
    },
    dataLabels:  { enabled: false },
    legend: {
      show: true,
      position: "bottom",
      horizontalAlign: "center",
      fontSize: "11px",
      markers: { width: 8, height: 8, radius: 2 },
      offsetY: 4,
    },
    xaxis: {
      categories,
      axisBorder: { show: false },
      axisTicks:  { show: false },
      labels:     { style: { fontSize: "10px", colors: "#94a3b8" }, rotate: 0 },
    },
    yaxis: {
      labels: {
        formatter: (v: number) => fmt(v),
        style: { fontSize: "10px", colors: "#94a3b8" },
      },
    },
    grid: {
      strokeDashArray: 4,
      borderColor: "#f1f5f9",
      padding: { left: 2, right: 6, top: 0 },
    },
    tooltip: {
      y: { formatter: (v: number) => `$${v.toFixed(2)}` },
      theme: "light",
    },
  };

  const series = [
    { name: "Revenue", data: revSeries },
    { name: "Expenses", data: expSeries },
  ];

  return (
    <>
      {/* Period selector */}
      <div className="d-flex justify-content-end mb-1">
        <select
          className="form-select form-select-sm border-0 bg-light text-dark fw-medium"
          style={{ fontSize: 11, width: "auto", cursor: "pointer" }}
          value={period}
          onChange={(e) => setPeriod(e.target.value as Period)}
        >
          {PERIODS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="d-flex align-items-center justify-content-center" style={{ height: 195 }}>
          <div className="spinner-border spinner-border-sm text-primary" />
        </div>
      ) : (
        <Chart options={options} series={series} type="area" height={195} />
      )}

      {/* KPI row */}
      <div className="d-flex justify-content-between border-top pt-2 mt-1">
        <div className="text-center">
          <div className="fs-11 text-muted">Revenue</div>
          <div className="fw-bold text-success" style={{ fontSize: 12 }}>{fmt(totalRev)}</div>
        </div>
        <div className="text-center">
          <div className="fs-11 text-muted">Expenses</div>
          <div className="fw-bold text-danger" style={{ fontSize: 12 }}>{fmt(totalExp)}</div>
        </div>
        <div className="text-center">
          <div className="fs-11 text-muted">Net Profit</div>
          <div className={`fw-bold ${net >= 0 ? "text-success" : "text-danger"}`} style={{ fontSize: 12 }}>
            {fmt(net)}
          </div>
        </div>
      </div>
    </>
  );
};

export default MonthlyRevenueExpensesChart;
