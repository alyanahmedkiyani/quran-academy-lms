"use client";

import { useState, useEffect } from "react";
import { DatePicker } from "antd";
import dayjs from "dayjs";
import { fetchExpenses, fetchLosses, createLoss, deleteLoss } from "@/services/expenseService";
import { fetchMonthlyRevenue } from "@/services/paymentService";
import { api_base_url, withAuthorization, handleResponse } from "@/services/apiClient";
import { Loss } from "@/types/expenses";
import RevenueExpensesChart from "@/components/pages/finance-accounts/RevenueExpensesChart";

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

const fmt = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtDec = (n: number) => `$${n.toFixed(2)}`;

// ── Add Loss Modal ─────────────────────────────────────────────────────────────
interface AddLossModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: (loss: Loss) => void;
}

const AddLossModal = ({ open, onClose, onSaved }: AddLossModalProps) => {
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      setTitle(""); setAmount(""); setDate(new Date().toISOString().slice(0, 10));
      setReason(""); setNotes(""); setError(null);
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const handleSubmit = async () => {
    if (!title.trim()) { setError("Title is required."); return; }
    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) { setError("Enter a valid amount."); return; }
    if (!date) { setError("Date is required."); return; }
    setSaving(true); setError(null);
    try {
      const loss = await createLoss({ title: title.trim(), amount: parseFloat(amount), date, reason: reason || undefined, notes: notes || undefined });
      onSaved(loss);
    } catch (e: unknown) {
      setError((e as { message?: string })?.message ?? "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <>
      <div className="modal-backdrop fade show" style={{ zIndex: 1040 }} onClick={() => { if (!saving) onClose(); }} />
      <div className="modal fade show" style={{ display: "block", zIndex: 1055 }} tabIndex={-1}>
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title text-dark fw-bold">Record a Loss</h5>
              <button type="button" className="btn-close custom-btn-close opacity-100" onClick={onClose} disabled={saving}>
                <i className="ti ti-x fs-16 text-dark" />
              </button>
            </div>
            <div className="modal-body">
              {error && <div className="alert alert-danger py-2 mb-3">{error}</div>}
              <div className="mb-3">
                <label className="form-label fw-medium">Title <span className="text-danger">*</span></label>
                <input className="form-control" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Equipment damage" disabled={saving} />
              </div>
              <div className="row">
                <div className="col-6 mb-3">
                  <label className="form-label fw-medium">Amount ($) <span className="text-danger">*</span></label>
                  <input type="number" min="0" step="0.01" className="form-control" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" disabled={saving} />
                </div>
                <div className="col-6 mb-3">
                  <label className="form-label fw-medium">Date <span className="text-danger">*</span></label>
                  <DatePicker
                    style={{ width: "100%" }}
                    value={date ? dayjs(date) : null}
                    onChange={(_, ds) => setDate(ds as string)}
                    format="YYYY-MM-DD"
                    placeholder="Select date"
                    disabled={saving}
                  />
                </div>
              </div>
              <div className="mb-3">
                <label className="form-label fw-medium">Reason</label>
                <input className="form-control" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Natural disaster, theft…" disabled={saving} />
              </div>
              <div className="mb-3">
                <label className="form-label fw-medium">Notes</label>
                <textarea className="form-control" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} disabled={saving} />
              </div>
            </div>
            <div className="modal-footer d-flex gap-1">
              <button className="btn btn-light border" onClick={onClose} disabled={saving}>Cancel</button>
              <button className="btn btn-danger" onClick={handleSubmit} disabled={saving}>
                {saving ? "Saving…" : "Record Loss"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

// ── Main Component ─────────────────────────────────────────────────────────────
const ProfitAndLossComponent = () => {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [loading, setLoading] = useState(false);
  const [addLossOpen, setAddLossOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"summary" | "losses">("summary");

  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [totalLosses, setTotalLosses] = useState(0);
  const [losses, setLosses] = useState<Loss[]>([]);
  const [monthlyData, setMonthlyData] = useState<{ revenue: number; expenses: number; losses: number }[]>(
    Array(12).fill({ revenue: 0, expenses: 0, losses: 0 })
  );
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [monthlyRevPoints, allExpenses, allLosses] = await Promise.all([
        fetchMonthlyRevenue(year),
        fetchExpenses({ startDate: `${year}-01-01`, endDate: `${year}-12-31` }),
        fetchLosses({ startDate: `${year}-01-01`, endDate: `${year}-12-31` }),
      ]);

      const revTotal = monthlyRevPoints.reduce((s, p) => s + p.revenue, 0);
      setTotalRevenue(revTotal);

      const expTotal = allExpenses.reduce((s, e) => s + parseFloat(String(e.amount)), 0);
      setTotalExpenses(expTotal);

      const lossTotal = allLosses.reduce((s, l) => s + parseFloat(String(l.amount)), 0);
      setTotalLosses(lossTotal);
      setLosses(allLosses);

      const monthly = Array.from({ length: 12 }, (_, i) => {
        const revPoint = monthlyRevPoints.find((p) => p.month === i + 1);
        return {
          revenue: revPoint?.revenue ?? 0,
          expenses: allExpenses
            .filter((e) => new Date(e.date).getMonth() === i && new Date(e.date).getFullYear() === year)
            .reduce((s, e) => s + parseFloat(String(e.amount)), 0),
          losses: allLosses
            .filter((l) => new Date(l.date).getMonth() === i && new Date(l.date).getFullYear() === year)
            .reduce((s, l) => s + parseFloat(String(l.amount)), 0),
        };
      });
      setMonthlyData(monthly);
    } catch {
      //
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [year]);

  const netProfit = totalRevenue - totalExpenses - totalLosses;
  const profitMargin = totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) : "0.0";

  const handleLossSaved = (loss: Loss) => {
    const lossYear = new Date(loss.date).getFullYear();
    if (lossYear === year) load();
    setAddLossOpen(false);
  };

  const handleDeleteLoss = async (id: number) => {
    if (!confirm("Delete this loss record?")) return;
    setDeletingId(id);
    try {
      await deleteLoss(id);
      load();
    } catch {
      //
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <>
      <div className="page-wrapper">
        <div className="content">
          {/* Header */}
          <div className="d-flex align-items-sm-center flex-sm-row flex-column gap-2 mb-3 pb-3 border-bottom">
            <div className="flex-grow-1">
              <h4 className="fw-bold mb-0">Profit &amp; Loss Report</h4>
            </div>
            <div className="d-flex align-items-center gap-2 flex-wrap">
              <select
                className="form-select form-select-sm"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                style={{ width: 110 }}
              >
                {[currentYear - 2, currentYear - 1, currentYear, currentYear + 1].map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              <button className="btn btn-danger btn-sm d-inline-flex align-items-center gap-1" onClick={() => setAddLossOpen(true)}>
                <i className="ti ti-plus" />Add Loss
              </button>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-5"><div className="spinner-border text-primary" /></div>
          ) : (
            <>
              {/* Summary Cards */}
              <div className="row mb-4">
                {[
                  { label: "Total Revenue", value: fmt(totalRevenue), icon: "ti-arrow-up-right-circle", color: "primary", note: `Year ${year}` },
                  { label: "Total Expenses", value: fmt(totalExpenses), icon: "ti-arrow-down-right-circle", color: "success", note: `Year ${year}` },
                  { label: "Total Losses", value: fmt(totalLosses), icon: "ti-alert-triangle", color: "danger", note: `Year ${year}` },
                  { label: "Net Profit", value: fmt(netProfit), icon: "ti-currency-dollar", color: netProfit >= 0 ? "warning" : "danger", note: "Revenue − Expenses − Losses", highlight: netProfit < 0 ? "text-danger" : "text-success" },
                  { label: "Profit Margin", value: `${profitMargin}%`, icon: "ti-cash", color: "secondary", note: "Net / Revenue × 100", highlight: netProfit < 0 ? "text-danger" : "text-success" },
                ].map(({ label, value, icon, color, note, highlight }) => (
                  <div key={label} className="col-xl col-md-4 col-6 d-flex mb-3">
                    <div className="card shadow-sm flex-fill w-100">
                      <div className="card-body">
                        <div className="d-flex align-items-center justify-content-between mb-2">
                          <div>
                            <p className="mb-1 text-truncate small text-muted">{label}</p>
                            <h6 className={`mb-2 fw-bold ${highlight ?? ""}`}>{value}</h6>
                          </div>
                          <span className={`avatar avatar-lg bg-${color} text-white rounded-circle border border-${color} flex-shrink-0`}>
                            <i className={`ti ${icon} fs-24`} />
                          </span>
                        </div>
                        <div className="p-2 rounded bg-light text-center">
                          <p className="mb-0 fs-12 text-muted">{note}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Chart */}
              <div className="mb-4">
                <RevenueExpensesChart />
              </div>

              {/* Tabs */}
              <ul className="nav nav-pills mb-3">
                <li className="nav-item">
                  <button className={`nav-link ${activeTab === "summary" ? "active" : ""}`} onClick={() => setActiveTab("summary")}>
                    Monthly Summary
                  </button>
                </li>
                <li className="nav-item">
                  <button className={`nav-link ${activeTab === "losses" ? "active" : ""}`} onClick={() => setActiveTab("losses")}>
                    Loss Records
                    {losses.length > 0 && (
                      <span className="badge badge-soft-danger border border-danger ms-2 fw-medium">{losses.length}</span>
                    )}
                  </button>
                </li>
              </ul>

              {activeTab === "summary" && (
                <div className="table-responsive">
                  <table className="table table-nowrap table-bordered">
                    <thead className="thead-light">
                      <tr>
                        <th style={{ minWidth: 140 }}>Month</th>
                        <th>Revenue ($)</th>
                        <th>Expenses ($)</th>
                        <th>Losses ($)</th>
                        <th>Total Deductions</th>
                        <th>Net Profit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {MONTHS.map((month, i) => {
                        const rev = monthlyData[i]?.revenue ?? 0;
                        const exp = monthlyData[i]?.expenses ?? 0;
                        const loss = monthlyData[i]?.losses ?? 0;
                        const deductions = exp + loss;
                        const net = rev - deductions;
                        const hasData = rev > 0 || exp > 0 || loss > 0;
                        return (
                          <tr key={month}>
                            <td className="fw-medium text-dark">{month} {year}</td>
                            <td className={rev > 0 ? "text-success fw-medium" : "text-muted"}>
                              {rev > 0 ? fmtDec(rev) : "—"}
                            </td>
                            <td className={exp > 0 ? "text-danger fw-medium" : "text-muted"}>
                              {exp > 0 ? fmtDec(exp) : "—"}
                            </td>
                            <td className={loss > 0 ? "text-danger fw-medium" : "text-muted"}>
                              {loss > 0 ? fmtDec(loss) : "—"}
                            </td>
                            <td className={deductions > 0 ? "text-danger" : "text-muted"}>
                              {deductions > 0 ? fmtDec(deductions) : "—"}
                            </td>
                            <td className={!hasData ? "text-muted" : net >= 0 ? "text-success fw-medium" : "text-danger fw-medium"}>
                              {hasData ? fmtDec(net) : "—"}
                            </td>
                          </tr>
                        );
                      })}
                      <tr className="table-light fw-bold">
                        <td>Total ({year})</td>
                        <td className="text-success">{fmtDec(totalRevenue)}</td>
                        <td className="text-danger">{fmtDec(totalExpenses)}</td>
                        <td className="text-danger">{fmtDec(totalLosses)}</td>
                        <td className="text-danger">{fmtDec(totalExpenses + totalLosses)}</td>
                        <td className={netProfit >= 0 ? "text-success" : "text-danger"}>{fmtDec(netProfit)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}

              {activeTab === "losses" && (
                <div className="table-responsive">
                  {losses.length === 0 ? (
                    <div className="text-center py-5 text-muted">
                      <i className="ti ti-alert-triangle fs-1 d-block mb-2 text-danger opacity-50" />
                      No losses recorded for {year}.
                      <div className="mt-2">
                        <button className="btn btn-danger btn-sm" onClick={() => setAddLossOpen(true)}>
                          <i className="ti ti-plus me-1" />Record First Loss
                        </button>
                      </div>
                    </div>
                  ) : (
                    <table className="table table-nowrap table-bordered">
                      <thead className="thead-light">
                        <tr>
                          <th>#</th>
                          <th>Title</th>
                          <th>Date</th>
                          <th>Amount ($)</th>
                          <th>Reason</th>
                          <th>Notes</th>
                          <th>Recorded By</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {losses.map((l, idx) => (
                          <tr key={l.id}>
                            <td className="text-muted fs-12">{idx + 1}</td>
                            <td className="fw-semibold text-dark">{l.title}</td>
                            <td>{new Date(l.date).toLocaleDateString()}</td>
                            <td className="text-danger fw-medium">{fmtDec(parseFloat(String(l.amount)))}</td>
                            <td className="text-muted">{l.reason || "—"}</td>
                            <td className="text-muted small" style={{ maxWidth: 180 }}>{l.notes || "—"}</td>
                            <td className="text-muted small">{l.CreatedBy?.name || "—"}</td>
                            <td>
                              <button
                                className="btn btn-outline-danger btn-icon btn-sm"
                                onClick={() => handleDeleteLoss(l.id)}
                                disabled={deletingId === l.id}
                                title="Delete"
                              >
                                <i className="ti ti-trash" />
                              </button>
                            </td>
                          </tr>
                        ))}
                        <tr className="table-light fw-bold">
                          <td colSpan={3}>Total</td>
                          <td className="text-danger">{fmtDec(totalLosses)}</td>
                          <td colSpan={4} />
                        </tr>
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <AddLossModal
        open={addLossOpen}
        onClose={() => setAddLossOpen(false)}
        onSaved={handleLossSaved}
      />
    </>
  );
};

export default ProfitAndLossComponent;
