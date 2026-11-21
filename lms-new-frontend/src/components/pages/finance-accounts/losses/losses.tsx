"use client";

import { useState, useEffect, useCallback } from "react";
import { DatePicker, Table, Tooltip } from "antd";
import dayjs from "dayjs";
import type { ColumnsType } from "antd/es/table/interface";
import { Loss, CreateLossPayload } from "@/types/expenses";
import { fetchLosses, createLoss, updateLoss, deleteLoss } from "@/services/expenseService";
import { useNotification } from "@/hooks/useNotification";

// ── Loss Modal (Add / Edit) ────────────────────────────────────────────────────
interface LossModalProps {
  open: boolean;
  editing: Loss | null;
  onClose: () => void;
  onSaved: () => void;
}

const LossModal = ({ open, editing, onClose, onSaved }: LossModalProps) => {
  const notify = useNotification();
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      if (editing) {
        setTitle(editing.title);
        setAmount(String(editing.amount));
        setDate(editing.date);
        setReason(editing.reason ?? "");
        setNotes(editing.notes ?? "");
      } else {
        setTitle(""); setAmount(""); setDate(new Date().toISOString().slice(0, 10));
        setReason(""); setNotes("");
      }
      setError("");
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open, editing]);

  const handleSubmit = async () => {
    if (!title.trim()) { setError("Title is required."); return; }
    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) { setError("Enter a valid amount."); return; }
    if (!date) { setError("Date is required."); return; }
    setSaving(true); setError("");
    try {
      if (editing) {
        await updateLoss(editing.id, { title: title.trim(), amount: parseFloat(amount), date, reason: reason || undefined, notes: notes || undefined });
        notify.success("Loss updated.");
      } else {
        await createLoss({ title: title.trim(), amount: parseFloat(amount), date, reason: reason || undefined, notes: notes || undefined });
        notify.success("Loss recorded.");
      }
      onSaved();
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
        <div className="modal-dialog modal-dialog-centered modal-lg">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title text-dark fw-bold">
                {editing ? "Edit Loss Record" : "Record a Loss"}
              </h5>
              <button type="button" className="btn-close custom-btn-close opacity-100" onClick={onClose} disabled={saving}>
                <i className="ti ti-x fs-16 text-dark" />
              </button>
            </div>
            <div className="modal-body">
              {error && <div className="alert alert-danger py-2 mb-3">{error}</div>}
              <div className="row">
                <div className="col-lg-12 mb-3">
                  <label className="form-label fw-medium">Title <span className="text-danger">*</span></label>
                  <input className="form-control" value={title} onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Equipment damage, theft…" disabled={saving} />
                </div>
                <div className="col-lg-6 mb-3">
                  <label className="form-label fw-medium">Amount ($) <span className="text-danger">*</span></label>
                  <input type="number" min="0" step="0.01" className="form-control" value={amount}
                    onChange={(e) => setAmount(e.target.value)} placeholder="0.00" disabled={saving} />
                </div>
                <div className="col-lg-6 mb-3">
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
                <div className="col-lg-12 mb-3">
                  <label className="form-label fw-medium">Reason</label>
                  <input className="form-control" value={reason} onChange={(e) => setReason(e.target.value)}
                    placeholder="Short reason for the loss" disabled={saving} />
                </div>
                <div className="col-lg-12 mb-3">
                  <label className="form-label fw-medium">Notes</label>
                  <textarea className="form-control" rows={3} value={notes}
                    onChange={(e) => setNotes(e.target.value)} disabled={saving} />
                </div>
              </div>
            </div>
            <div className="modal-footer d-flex gap-1">
              <button className="btn btn-light border" onClick={onClose} disabled={saving}>Cancel</button>
              <button className="btn btn-danger" onClick={handleSubmit} disabled={saving}>
                {saving ? "Saving…" : editing ? "Save Changes" : "Record Loss"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

// ── Delete Modal ───────────────────────────────────────────────────────────────
interface DeleteModalProps {
  open: boolean;
  loss: Loss | null;
  onClose: () => void;
  onConfirm: () => void;
  deleting: boolean;
}

const DeleteModal = ({ open, loss, onClose, onConfirm, deleting }: DeleteModalProps) => {
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (!open || !loss) return null;

  return (
    <>
      <div className="modal-backdrop fade show" style={{ zIndex: 1040 }} onClick={() => { if (!deleting) onClose(); }} />
      <div className="modal fade show" style={{ display: "block", zIndex: 1055 }} tabIndex={-1}>
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title text-dark fw-bold">Delete Loss Record</h5>
              <button type="button" className="btn-close custom-btn-close opacity-100" onClick={onClose} disabled={deleting}>
                <i className="ti ti-x fs-16 text-dark" />
              </button>
            </div>
            <div className="modal-body text-center py-4">
              <i className="ti ti-trash text-danger d-block mb-2" style={{ fontSize: 48 }} />
              <p className="mb-0">
                Delete <strong>{loss.title}</strong>?<br />
                <span className="text-muted small">This will also affect the Profit &amp; Loss report.</span>
              </p>
            </div>
            <div className="modal-footer d-flex gap-1">
              <button className="btn btn-light border" onClick={onClose} disabled={deleting}>Cancel</button>
              <button className="btn btn-danger" onClick={onConfirm} disabled={deleting}>
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

// ── Main Page ──────────────────────────────────────────────────────────────────
const LossesList = () => {
  const notify = useNotification();
  const [losses, setLosses] = useState<Loss[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Loss | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Loss | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setLosses(await fetchLosses()); }
    catch { /* */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSaved = () => { setModalOpen(false); setEditing(null); load(); };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteLoss(deleteTarget.id);
      notify.success("Loss deleted.");
      setDeleteTarget(null);
      load();
    } catch {
      notify.error("Failed to delete.");
    } finally {
      setDeleting(false);
    }
  };

  const totalLosses = losses.reduce((s, l) => s + parseFloat(String(l.amount)), 0);

  const columns: ColumnsType<Loss> = [
    {
      title: "#",
      key: "serial",
      width: 60,
      render: (_: unknown, __: Loss, idx: number) => <span className="text-muted fs-12">{idx + 1}</span>,
    },
    {
      title: "Title",
      dataIndex: "title",
      key: "title",
      width: 200,
      sorter: (a, b) => a.title.localeCompare(b.title),
      render: (v: string) => <span className="fw-semibold text-dark">{v}</span>,
    },
    {
      title: "Amount",
      dataIndex: "amount",
      key: "amount",
      width: 130,
      sorter: (a, b) => parseFloat(String(a.amount)) - parseFloat(String(b.amount)),
      render: (v: string) => <span className="fw-semibold text-danger">${parseFloat(v).toFixed(2)}</span>,
    },
    {
      title: "Date",
      dataIndex: "date",
      key: "date",
      width: 130,
      sorter: (a, b) => a.date.localeCompare(b.date),
      render: (v: string) => new Date(v).toLocaleDateString(),
    },
    {
      title: "Reason",
      dataIndex: "reason",
      key: "reason",
      width: 200,
      render: (v: string) => v ? <span className="text-dark">{v}</span> : <span className="text-muted">—</span>,
    },
    {
      title: "Notes",
      dataIndex: "notes",
      key: "notes",
      width: 220,
      ellipsis: true,
      render: (v: string) => v ? <span className="text-muted small">{v}</span> : <span className="text-muted">—</span>,
    },
    {
      title: "Recorded By",
      key: "createdBy",
      width: 140,
      render: (_: unknown, r: Loss) => r.CreatedBy
        ? <span className="fw-medium">{r.CreatedBy.name}</span>
        : <span className="text-muted">—</span>,
    },
    {
      title: "Actions",
      key: "actions",
      width: 100,
      render: (_: unknown, record: Loss) => (
        <div className="d-flex gap-1">
          <Tooltip title="Edit">
            <button className="btn btn-outline-primary btn-icon btn-sm"
              onClick={() => { setEditing(record); setModalOpen(true); }}>
              <i className="ti ti-edit" />
            </button>
          </Tooltip>
          <Tooltip title="Delete">
            <button className="btn btn-outline-danger btn-icon btn-sm"
              onClick={() => setDeleteTarget(record)}>
              <i className="ti ti-trash" />
            </button>
          </Tooltip>
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="page-wrapper">
        <div className="content">
          {/* Header */}
          <div className="d-flex align-items-sm-center flex-sm-row flex-column gap-2 pb-3 mb-3">
            <div className="flex-grow-1">
              <h4 className="fw-bold mb-0">
                Losses
                <span className="badge badge-soft-danger fw-medium border border-danger py-1 px-2 fs-13 ms-2">
                  {losses.length} records
                </span>
              </h4>
            </div>
            <div className="d-flex gap-2 align-items-center flex-wrap">
              {losses.length > 0 && (
                <span className="badge badge-soft-danger border border-danger fw-medium fs-13 py-2 px-3">
                  Total: ${totalLosses.toFixed(2)}
                </span>
              )}
              <button
                className="btn btn-danger fs-13 btn-md d-inline-flex align-items-center gap-1"
                onClick={() => { setEditing(null); setModalOpen(true); }}
              >
                <i className="ti ti-plus" />Record Loss
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="card">
            <div className="card-body" style={{ overflowX: "auto" }}>
              <Table<Loss>
                className="table table-nowrap datatable"
                columns={columns}
                dataSource={losses}
                rowKey="id"
                loading={loading}
                scroll={{ x: "max-content" }}
                pagination={{ pageSize: 10, showSizeChanger: false }}
                locale={{ emptyText: (
                  <div className="text-center py-4">
                    <i className="ti ti-alert-triangle fs-1 text-danger opacity-50 d-block mb-2" />
                    <p className="text-muted mb-2">No losses recorded yet.</p>
                    <button className="btn btn-danger btn-sm" onClick={() => setModalOpen(true)}>
                      <i className="ti ti-plus me-1" />Record First Loss
                    </button>
                  </div>
                )}}
              />
            </div>
          </div>
        </div>
      </div>

      <LossModal
        open={modalOpen}
        editing={editing}
        onClose={() => { setModalOpen(false); setEditing(null); }}
        onSaved={handleSaved}
      />

      <DeleteModal
        open={!!deleteTarget}
        loss={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        deleting={deleting}
      />
    </>
  );
};

export default LossesList;
