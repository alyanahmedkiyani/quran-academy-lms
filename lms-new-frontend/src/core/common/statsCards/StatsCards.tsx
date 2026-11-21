"use client";

import dynamic from "next/dynamic";
const StatSparkline = dynamic(() => import("@/components/pages/dashboard/chats/StatSparkline"), { ssr: false });

export interface StatCardItem {
  label: string;
  value: number;
  icon: string;
  hex: string;
  spark: number[];
  /** Overrides the auto-computed "% of total" (total = first card's value). */
  pct?: number;
}

interface StatsCardsProps {
  cards: StatCardItem[];
  loading?: boolean;
}

const STAT_CARD_CSS = `
  .stat-card-v2 {
    display: flex;
    flex-direction: column;
    background: #fff;
    border: 1px solid #f0f1f6;
    border-radius: 18px;
    padding: 20px;
    height: 100%;
    transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
    box-shadow: 0 2px 10px rgba(16, 24, 40, 0.05);
  }
  .stat-card-v2:hover {
    transform: translateY(-3px);
    box-shadow: 0 14px 26px -10px rgba(16, 24, 40, 0.14);
    border-color: #e6e8f5;
  }
  .stat-card-v2__top {
    display: flex;
    align-items: flex-start;
    gap: 14px;
    margin-bottom: 18px;
  }
  .stat-card-v2__icon {
    width: 56px;
    height: 56px;
    border-radius: 16px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 24px;
    flex-shrink: 0;
  }
  .stat-card-v2__text {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .stat-card-v2__label {
    font-size: 14px;
    font-weight: 600;
    color: #667085;
    margin-bottom: 4px;
  }
  .stat-card-v2__value {
    font-size: 28px;
    font-weight: 800;
    color: #101828;
    margin: 0;
    line-height: 1.2;
  }
  .stat-card-v2__pct {
    font-size: 12px;
    color: #98a2b3;
    margin: 2px 0 0;
  }
  .stat-card-v2__chart {
    margin-top: auto;
    line-height: 0;
  }
  .stat-card-v2__chart .apexcharts-canvas { margin: 0 !important; }
`;

/**
 * App-wide standard KPI stat card row: icon (hex-tinted) on the left,
 * label/value/% stacked beside it, sparkline trend along the bottom.
 * Percentage defaults to value / cards[0].value unless `pct` is passed.
 */
const StatsCards = ({ cards, loading = false }: StatsCardsProps) => {
  const total = cards[0]?.value ?? 0;
  const cols = Math.min(Math.max(cards.length, 1), 6);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: STAT_CARD_CSS }} />
      <div className={`row g-3 mb-4 row-cols-1 row-cols-sm-2 row-cols-xl-${cols}`}>
        {cards.map(({ label, value, icon, hex, spark, pct }) => {
          const pctValue = pct ?? (total > 0 ? Math.round((value / total) * 100) : 0);
          const sparkData = value === 0 ? spark.map(() => 0) : spark;
          return (
            <div key={label} className="col">
              <div className="stat-card-v2">
                <div className="stat-card-v2__top">
                  <span className="stat-card-v2__icon" style={{ background: `${hex}26`, color: hex }}>
                    <i className={`ti ${icon}`} />
                  </span>
                  <div className="stat-card-v2__text">
                    <span className="stat-card-v2__label">{label}</span>
                    <h3 className="stat-card-v2__value">{loading ? "—" : value.toLocaleString()}</h3>
                    <p className="stat-card-v2__pct">{loading ? "—" : `${pctValue}% of total`}</p>
                  </div>
                </div>
                <div className="stat-card-v2__chart">
                  <StatSparkline color={hex} data={sparkData} width="100%" height={50} markers />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
};

export default StatsCards;
