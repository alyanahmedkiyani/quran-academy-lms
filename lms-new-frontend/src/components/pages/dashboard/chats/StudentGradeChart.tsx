"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { fetchStudentGradeDistribution } from "@/services/studentService";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

const StudentGradeChart = () => {
  const [categories, setCategories] = useState<string[]>([]);
  const [series,     setSeries]     = useState<number[]>([]);
  const [loading,    setLoading]    = useState(true);

  useEffect(() => {
    fetchStudentGradeDistribution()
      .then(({ grades }) => {
        setCategories(grades.map(g => g.grade));
        setSeries(grades.map(g => g.count));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const options: any = {
    chart: {
      type: "bar",
      height: 250,
      stacked: false,
      toolbar: { show: false },
      sparkline: { enabled: false },
    },
    plotOptions: {
      bar: {
        horizontal: false,
        columnWidth: "25%",
        borderRadius: 3,
        distributed: true,
      },
    },
    dataLabels: { enabled: false },
    stroke: { show: true, width: 0, colors: ["#fff"] },
    colors: ["#2E37A4", "#00D1D1", "#1E90FF", "#3B28CC", "#F59E0B", "#22C55E", "#EF4444", "#8B5CF6"],
    xaxis: {
      categories,
      labels: { style: { fontSize: "13px" } },
      axisBorder: { show: false },
      axisTicks:  { show: false },
    },
    yaxis: {
      labels: {
        style: { fontSize: "13px" },
        formatter: (val: number) => (val >= 1000 ? `${val / 1000}K` : String(val)),
        offsetX: -10,
      },
    },
    legend: { show: false },
    grid: {
      show: true,
      strokeDashArray: 4,
      padding: { left: 0, right: -10 },
    },
    tooltip: {
      y: { formatter: (v: number) => `${v} student${v !== 1 ? "s" : ""}` },
      theme: "light",
    },
  };

  if (loading) {
    return (
      <div className="d-flex align-items-center justify-content-center" style={{ height: 250 }}>
        <div className="spinner-border spinner-border-sm text-primary" />
      </div>
    );
  }

  if (series.length === 0) {
    return (
      <div className="d-flex flex-column align-items-center justify-content-center text-muted" style={{ height: 250 }}>
        <i className="ti ti-chart-bar d-block fs-32 mb-2" />
        <p className="fs-13 mb-0">No grade data yet</p>
      </div>
    );
  }

  return (
    <Chart
      options={options}
      series={[{ name: "Students", data: series }]}
      type="bar"
      height={250}
    />
  );
};

export default StudentGradeChart;
