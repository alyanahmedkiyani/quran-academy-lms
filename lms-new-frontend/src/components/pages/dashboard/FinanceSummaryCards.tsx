"use client";

import { useState, useEffect } from "react";
import { fetchMonthlyRevenue } from "@/services/paymentService";
import { fetchExpenses, fetchTotalExpenses } from "@/services/expenseService";
import { getAllFees } from "@/services/feesService";
import ImageWithBasePath from "@/core/imageWithBasePath";
import SCol2Chart from "./chats/scol2";
import SCol3Chart from "./chats/scol3";
import SCol4Chart from "./chats/scol4";
import SCol5Chart from "./chats/scol5";

interface CardData {
  label:     string;
  value:     string;
  pct:       string;
  pctGood:   boolean;   // true = green badge, false = red badge
  bg:        string;
  avatarBg:  string;
  icon:      string;
  subLabel:  string;
  Chart:     React.ComponentType;
}

const pad = (n: number) => String(n).padStart(2, "0");

const fmtAmount = (n: number) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency", currency: "GBP", maximumFractionDigits: 0,
  }).format(n);

const FinanceSummaryCards = () => {
  const now      = new Date();
  const year     = now.getFullYear();
  const curMonth = now.getMonth() + 1;
  const prevMonth     = curMonth === 1 ? 12 : curMonth - 1;
  const prevMonthYear = curMonth === 1 ? year - 1 : year;

  const [cards,   setCards]   = useState<CardData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const daysInCur  = new Date(year, curMonth, 0).getDate();
        const daysInPrev = new Date(prevMonthYear, prevMonth, 0).getDate();

        const curStart  = `${year}-${pad(curMonth)}-01`;
        const curEnd    = `${year}-${pad(curMonth)}-${pad(daysInCur)}`;
        const prevStart = `${prevMonthYear}-${pad(prevMonth)}-01`;
        const prevEnd   = `${prevMonthYear}-${pad(prevMonth)}-${pad(daysInPrev)}`;

        const [monthlyRev, curExpenses, prevExpenses, ytdExpenses, allFees] = await Promise.all([
          fetchMonthlyRevenue(year),
          fetchExpenses({ startDate: curStart,  endDate: curEnd  }),
          fetchExpenses({ startDate: prevStart, endDate: prevEnd }),
          fetchTotalExpenses(year),
          getAllFees(),
        ]);

        // ── Revenue ──────────────────────────────────────────────────────
        const ytdRevenue   = monthlyRev.filter(p => p.month <= curMonth).reduce((s, p) => s + p.revenue, 0);
        const curMonthRev  = monthlyRev.find(p => p.month === curMonth)?.revenue ?? 0;
        let   prevMonthRev = monthlyRev.find(p => p.month === prevMonth)?.revenue ?? 0;
        if (curMonth === 1) {
          const lastYearData = await fetchMonthlyRevenue(year - 1);
          prevMonthRev       = lastYearData.find(p => p.month === 12)?.revenue ?? 0;
        }
        const revPctVal = prevMonthRev > 0
          ? ((curMonthRev - prevMonthRev) / prevMonthRev) * 100 : 0;

        // ── Expenses ─────────────────────────────────────────────────────
        const curExp  = curExpenses.reduce((s, e)  => s + parseFloat(String(e.amount)), 0);
        const prevExp = prevExpenses.reduce((s, e) => s + parseFloat(String(e.amount)), 0);
        const expPctVal = prevExp > 0 ? ((curExp - prevExp) / prevExp) * 100 : 0;

        // ── Net Income ───────────────────────────────────────────────────
        const netIncome = ytdRevenue - ytdExpenses;
        const prevNet   = prevMonthRev - prevExp;
        const curNet    = curMonthRev  - curExp;
        const netPctVal = prevNet !== 0 ? ((curNet - prevNet) / Math.abs(prevNet)) * 100 : 0;

        // ── Outstanding Fees ─────────────────────────────────────────────
        const outstanding = allFees
          .filter(f => f.status === "pending" || f.status === "overdue")
          .reduce((s, f) => s + parseFloat(String(f.amount)), 0);
        const curOut = allFees
          .filter(f =>
            (f.status === "pending" || f.status === "overdue") &&
            f.dueDate?.startsWith(`${year}-${pad(curMonth)}`)
          )
          .reduce((s, f) => s + parseFloat(String(f.amount)), 0);
        const prevOut = allFees
          .filter(f =>
            (f.status === "pending" || f.status === "overdue") &&
            f.dueDate?.startsWith(`${prevMonthYear}-${pad(prevMonth)}`)
          )
          .reduce((s, f) => s + parseFloat(String(f.amount)), 0);
        const outPctVal = prevOut > 0 ? ((curOut - prevOut) / prevOut) * 100 : 0;

        const fmtPct = (v: number) =>
          `${v >= 0 ? "+" : ""}${Math.abs(v).toFixed(1)}%`;

        setCards([
          {
            label:    "Total Revenue",
            value:    fmtAmount(ytdRevenue),
            pct:      fmtPct(revPctVal),
            pctGood:  revPctVal >= 0,
            bg:       "./assets/img/bg/bg-01.svg",
            avatarBg: "bg-primary",
            icon:     "ti ti-shield-dollar fs-24",
            subLabel: "vs last month",
            Chart:    SCol2Chart,
          },
          {
            label:    "Total Expenses",
            value:    fmtAmount(ytdExpenses),
            pct:      fmtPct(expPctVal),
            pctGood:  expPctVal <= 0,   // down = good for expenses
            bg:       "./assets/img/bg/bg-02.svg",
            avatarBg: "bg-danger",
            icon:     "ti ti-cash fs-24",
            subLabel: "vs last month",
            Chart:    SCol3Chart,
          },
          {
            label:    "Net Income",
            value:    fmtAmount(netIncome),
            pct:      fmtPct(netPctVal),
            pctGood:  netPctVal >= 0,
            bg:       "./assets/img/bg/bg-03.svg",
            avatarBg: "bg-info",
            icon:     "ti ti-currency-dollar fs-24",
            subLabel: "vs last month",
            Chart:    SCol4Chart,
          },
          {
            label:    "Outstanding Fees",
            value:    fmtAmount(outstanding),
            pct:      fmtPct(outPctVal),
            pctGood:  outPctVal <= 0,   // down = good for outstanding
            bg:       "./assets/img/bg/bg-04.svg",
            avatarBg: "bg-warning",
            icon:     "ti ti-tag fs-24",
            subLabel: "vs last month",
            Chart:    SCol5Chart,
          },
        ]);
      } catch {
        //
      } finally {
        setLoading(false);
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div className="row g-3 mb-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="col-xl-3 col-md-6">
            <div className="position-relative border card rounded-2 shadow-sm mb-0" style={{ minHeight: 110 }}>
              <div className="card-body d-flex align-items-center justify-content-center">
                <div className="spinner-border spinner-border-sm text-primary" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      <h5 className="fw-bold mb-3">Finance Summary</h5>
      <div className="row g-3 mb-4">
        {cards.map((card) => {
          const SparkChart = card.Chart;
          return (
            <div key={card.label} className="col-xl-3 col-md-6">
              <div className="position-relative border card rounded-2 shadow-sm mb-0">
                <ImageWithBasePath
                  src={card.bg}
                  alt=""
                  className="position-absolute start-0 top-0"
                />
                <div className="card-body">
                  <div className="d-flex align-items-center mb-2 justify-content-between">
                    <span className={`avatar ${card.avatarBg} rounded-circle`}>
                      <i className={card.icon} />
                    </span>
                    <div className="text-end">
                      <span
                        className={`badge px-2 py-1 fs-12 fw-medium d-inline-flex mb-1 ${
                          card.pctGood ? "bg-success" : "bg-danger"
                        }`}
                      >
                        {card.pct}
                      </span>
                      <p className="fs-13 mb-0">{card.subLabel}</p>
                    </div>
                  </div>
                  <div className="d-flex align-items-center justify-content-between">
                    <div>
                      <p className="mb-1">{card.label}</p>
                      <h3 className="fw-bold mb-0">{card.value}</h3>
                    </div>
                    <div>
                      <SparkChart />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
};

export default FinanceSummaryCards;
