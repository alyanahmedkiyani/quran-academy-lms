"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { fetchMonthlyRevenue } from "@/services/paymentService";
import { fetchExpenses } from "@/services/expenseService";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

type Period = "this_month" | "last_3" | "last_6";

const PERIODS: { value: Period; label: string }[] = [
  { value: "this_month", label: "This Month" },
  { value: "last_3",     label: "Last 3 Months" },
  { value: "last_6",     label: "Last 6 Months" },
];

const CashFlowChart = () => {
  const now   = new Date();
  const [period, setPeriod] = useState<Period>("this_month");
  const [loading, setLoading] = useState(false);
  const [categories, setCategories]   = useState<string[]>([]);
  const [inflowData,  setInflowData]  = useState<number[]>([]);
  const [outflowData, setOutflowData] = useState<number[]>([]);
  const [netData,     setNetData]     = useState<number[]>([]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const year      = now.getFullYear();
        const curMonth  = now.getMonth() + 1; // 1-based
        const count     = period === "last_3" ? 3 : 6;
        const labels: string[]                          = [];
        const revenueMap: Record<string, number>        = {};
        const expenseMap: Record<string, number>        = {};

        for (let i = count - 1; i >= 0; i--) {
          const d   = new Date(year, curMonth - 1 - i, 1);
          const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
          labels.push(MONTH_NAMES[d.getMonth()]);
          revenueMap[key] = 0;
          expenseMap[key] = 0;
        }

        const oldestD   = new Date(year, curMonth - count, 1);
        const startDate = `${oldestD.getFullYear()}-${String(oldestD.getMonth()+1).padStart(2,"0")}-01`;
        const endD      = new Date(year, curMonth, 0);
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

        const inflow  = Object.values(revenueMap);
        const outflow = Object.values(expenseMap).map(v => -v);   // negative for below-axis bars
        const net     = inflow.map((r, i) => r + outflow[i]);     // inflow + (negative outflow)

        setCategories(labels);
        setInflowData(inflow);
        setOutflowData(outflow);
        setNetData(net);
      } catch {
        //
      } finally {
        setLoading(false);
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  const totalInflow  = inflowData.reduce((a, b) => a + b, 0);
  const totalOutflow = outflowData.reduce((a, b) => a + Math.abs(b), 0);
  const totalNet     = totalInflow - totalOutflow;
  const fmt = (n: number) => n >= 1000 ? `$${(n/1000).toFixed(1)}k` : `$${Math.abs(n).toFixed(0)}`;

  const options: any = {
    chart: {
      type: "bar",
      height: 195,
      toolbar: { show: false },
      stacked: false,
    },
    plotOptions: {
      bar: {
        columnWidth: "55%",
        borderRadius: 3,
        borderRadiusApplication: "end",
      },
    },
    colors:     ["#22C55E", "#F87171", "#3B82F6"],
    dataLabels: { enabled: false },
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
      labels:     { style: { fontSize: "10px", colors: "#94a3b8" } },
    },
    yaxis: {
      labels: {
        formatter: (v: number) => `$${Math.abs(v) >= 1000 ? (Math.abs(v)/1000).toFixed(1)+"k" : Math.abs(v).toFixed(0)}`,
        style: { fontSize: "10px", colors: "#94a3b8" },
      },
    },
    grid: {
      strokeDashArray: 4,
      borderColor: "#f1f5f9",
      padding: { left: 2, right: 6, top: 0 },
    },
    // Zero line
    annotations: {
      yaxis: [{ y: 0, borderColor: "#cbd5e1", borderWidth: 1, strokeDashArray: 0 }],
    },
    tooltip: {
      shared: true,
      intersect: false,
      y: { formatter: (v: number) => `$${Math.abs(v).toFixed(2)}` },
      theme: "light",
    },
    stroke: {
      width: [0, 0, 2.5],
      curve: "smooth",
    },
    fill: { opacity: [1, 1, 1] },
  };

  const series = [
    { name: "Inflow",  type: "bar",  data: inflowData  },
    { name: "Outflow", type: "bar",  data: outflowData },
    { name: "Net",     type: "line", data: netData     },
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
        <Chart options={options} series={series} type="bar" height={195} />
      )}

      {/* KPI row */}
      <div className="d-flex justify-content-between border-top pt-2 mt-1">
        <div className="text-center">
          <div className="fs-11 text-muted">Inflow</div>
          <div className="fw-bold text-success" style={{ fontSize: 12 }}>{fmt(totalInflow)}</div>
        </div>
        <div className="text-center">
          <div className="fs-11 text-muted">Outflow</div>
          <div className="fw-bold text-danger" style={{ fontSize: 12 }}>{fmt(totalOutflow)}</div>
        </div>
        <div className="text-center">
          <div className="fs-11 text-muted">Net</div>
          <div className={`fw-bold ${totalNet >= 0 ? "text-success" : "text-danger"}`} style={{ fontSize: 12 }}>
            {totalNet < 0 ? "-" : ""}{fmt(totalNet)}
          </div>
        </div>
      </div>
    </>
  );
};

export default CashFlowChart;
