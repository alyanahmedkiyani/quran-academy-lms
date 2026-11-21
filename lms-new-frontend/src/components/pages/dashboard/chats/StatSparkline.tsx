"use client";

import dynamic from "next/dynamic";
const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

interface StatSparklineProps {
  color: string;
  data: number[];
  width?: number | string;
  height?: number | string;
  markers?: boolean;
}

const StatSparkline = ({ color, data, width = 100, height = 50, markers = false }: StatSparklineProps) => (
  <Chart
    options={{
      chart: { type: "area", toolbar: { show: false }, sparkline: { enabled: true }, animations: { enabled: false } },
      stroke: { curve: "smooth", width: 2, colors: [color] },
      fill: {
        type: "gradient",
        gradient: {
          shadeIntensity: 1,
          opacityFrom: 0.35,
          opacityTo: 0,
          stops: [0, 100],
          colorStops: [{ offset: 0, color, opacity: 0.35 }, { offset: 100, color: "#ffffff", opacity: 0 }],
        },
      },
      markers: markers
        ? { size: 3, colors: [color], strokeColors: "#fff", strokeWidth: 2, hover: { size: 4 } }
        : { size: 0 },
      dataLabels: { enabled: false },
      xaxis: { labels: { show: false }, axisTicks: { show: false }, axisBorder: { show: false } },
      yaxis: { show: false },
      grid: { show: false },
      tooltip: { enabled: false },
    } as any}
    series={[{ name: "", data }]}
    type="area"
    width={width}
    height={height}
  />
);

export default StatSparkline;
