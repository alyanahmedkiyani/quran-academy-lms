"use client";

import dynamic from "next/dynamic";
import { useState } from "react";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

const SCol5Chart = () => {
  const [chartOptions] = useState<any>({
    chart: {
      width: 100,
      height: 54,
      type: "area",
      toolbar: { show: false },
      sparkline: { enabled: true },
    },
    stroke: {
      curve: "smooth",
      width: 2,
      colors: ["#F59E0B"],
    },
    fill: {
      type: "gradient",
      gradient: {
        shadeIntensity: 1,
        opacityFrom: 0.4,
        opacityTo: 0,
        stops: [0, 90, 100],
        colorStops: [
          { offset: 0,   color: "#F59E0B", opacity: 0.4 },
          { offset: 100, color: "#ffffff", opacity: 0.1 },
        ],
      },
    },
    dataLabels: { enabled: false },
    xaxis: {
      labels:     { show: false },
      axisTicks:  { show: false },
      axisBorder: { show: false },
    },
    yaxis:   { show: false },
    grid:    { show: false },
    tooltip: { enabled: false },
  });

  const [series] = useState([
    { name: "Data", data: [45, 38, 50, 42, 55, 48, 35, 40, 30, 25] },
  ]);

  return (
    <div id="s-col-5">
      <Chart options={chartOptions} series={series} type="area" width={100} height={54} />
    </div>
  );
};

export default SCol5Chart;
