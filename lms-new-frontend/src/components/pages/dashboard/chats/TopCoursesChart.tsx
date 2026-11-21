"use client";

import dynamic from "next/dynamic";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

interface Props {
  courses: { name: string; count: number }[];
}

const COLORS = ["#4F46E5", "#22C55E", "#F59E0B", "#0891B2", "#EF4444"];

const TopCoursesChart = ({ courses }: Props) => {
  if (courses.length === 0) {
    return (
      <div className="d-flex flex-column align-items-center justify-content-center text-muted" style={{ height: 220 }}>
        <i className="ti ti-books d-block fs-32 mb-2" />
        <p className="fs-13 mb-0">No course data yet</p>
      </div>
    );
  }

  const labels  = courses.map(c => c.name);
  const values  = courses.map(c => c.count);
  const colors  = COLORS.slice(0, courses.length);

  const options: any = {
    chart: {
      type: "bar",
      height: 220,
      toolbar: { show: false },
    },
    plotOptions: {
      bar: {
        horizontal: true,
        barHeight: "55%",
        borderRadius: 4,
        distributed: true,
      },
    },
    colors,
    dataLabels: {
      enabled: true,
      formatter: (v: number) => `${v}`,
      style: { fontSize: "11px", fontWeight: 600, colors: ["#fff"] },
      offsetX: -6,
    },
    xaxis: {
      categories: labels,
      labels: { style: { fontSize: "11px", colors: "#94a3b8" } },
      axisBorder: { show: false },
      axisTicks:  { show: false },
    },
    yaxis: {
      labels: {
        style: { fontSize: "11px", colors: "#1e293b", fontWeight: 600 },
        maxWidth: 140,
      },
    },
    legend: { show: false },
    grid: {
      strokeDashArray: 4,
      borderColor: "#f1f5f9",
      xaxis: { lines: { show: true } },
      yaxis: { lines: { show: false } },
    },
    tooltip: {
      y: { formatter: (v: number) => `${v} student${v !== 1 ? "s" : ""}` },
      theme: "light",
    },
  };

  return (
    <Chart
      options={options}
      series={[{ name: "Students", data: values }]}
      type="bar"
      height={220}
    />
  );
};

export default TopCoursesChart;
