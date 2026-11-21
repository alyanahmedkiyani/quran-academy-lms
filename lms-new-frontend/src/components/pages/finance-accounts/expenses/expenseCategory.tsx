"use client";

import { useState, useEffect, useCallback } from "react";
import { Table, Tooltip } from "antd";
import type { ColumnsType } from "antd/es/table/interface";
import { ExpenseCategory, CategoryStatus } from "@/types/expenses";
import {
  fetchExpenseCategories,
  createExpenseCategory,
  updateExpenseCategory,
  deleteExpenseCategory,
} from "@/services/expenseService";
import { useNotification } from "@/hooks/useNotification";

// ── Add / Edit Modal ───────────────────────────────────────────────────────────
interface CategoryModalProps {
  open: boolean;
  editing: ExpenseCategory | null;
  onClose: () => void;
  onSaved: () => void;
}

const CategoryModal = ({ open, editing, onClose, onSaved }: CategoryModalProps) => {
  const notify = useNotification();
  const [name, setName] = useState("");
  const [status, setStatus] = useState<CategoryStatus>("Active");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      setName(editing?.name ?? "");
      setStatus(editing?.status ?? "Active");
      setError("");
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open, editing]);

  const handleSubmit = async () => {
    if (!name.trim()) { setError("Category name is required."); return; }
    setSaving(true); setError("");
    try {
      if (editing) {
        await updateExpenseCategory(editing.id, { name: name.trim(), status });
        notify.success("Category updated.");
      } else {
        await createExpenseCategory({ name: name.trim(), status });
        notify.success("Category created.");
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
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title text-dark fw-bold">
                {editing ? "Edit Category" : "New Category"}
              </h5>
              <button type="button" className="btn-close custom-btn-close opacity-100" onClick={onClose} disabled={saving}>
                <i className="ti ti-x fs-16 text-dark" />
              </button>
            </div>
            <div className="modal-body">
              {error && <div className="alert alert-danger py-2 mb-3">{error}</div>}
              <div className="mb-3">
                <label className="form-label fw-medium">
                  Category Name <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  className="form-control"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={saving}
                  placeholder="e.g. Office Supplies"
                />
              </div>
              <div className="mb-3">
                <label className="form-label fw-medium">Status</label>
                <select
                  className="form-select"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as CategoryStatus)}
                  disabled={saving}
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
            </div>
            <div className="modal-footer d-flex gap-1">
              <button className="btn btn-light border" onClick={onClose} disabled={saving}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
                {saving ? "Saving…" : editing ? "Save Changes" : "Add Category"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

// ── Delete Confirmation Modal ──────────────────────────────────────────────────
interface DeleteModalProps {
  open: boolean;
  category: ExpenseCategory | null;
  onClose: () => void;
  onConfirm: () => void;
  deleting: boolean;
}

const DeleteModal = ({ open, category, onClose, onConfirm, deleting }: DeleteModalProps) => {
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (!open || !category) return null;

  return (
    <>
      <div className="modal-backdrop fade show" style={{ zIndex: 1040 }} onClick={() => { if (!deleting) onClose(); }} />
      <div className="modal fade show" style={{ display: "block", zIndex: 1055 }} tabIndex={-1}>
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title text-dark fw-bold">Delete Category</h5>
              <button type="button" className="btn-close custom-btn-close opacity-100" onClick={onClose} disabled={deleting}>
                <i className="ti ti-x fs-16 text-dark" />
              </button>
            </div>
            <div className="modal-body text-center py-4">
              <i className="ti ti-trash text-danger d-block mb-2" style={{ fontSize: 48 }} />
              <p className="mb-0">
                Delete category <strong>{category.name}</strong>?
                <br />
                <span className="text-muted small">Expenses in this category will become uncategorised.</span>
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
const ExpenseCategoryPage = () => {
  const notify = useNotification();
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ExpenseCategory | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ExpenseCategory | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setCategories(await fetchExpenseCategories());
    } catch {
      //
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSaved = () => {
    setModalOpen(false);
    setEditing(null);
    load();
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteExpenseCategory(deleteTarget.id);
      notify.success("Category deleted.");
      setDeleteTarget(null);
      load();
    } catch {
      notify.error("Failed to delete category.");
    } finally {
      setDeleting(false);
    }
  };

  const columns: ColumnsType<ExpenseCategory> = [
    {
      title: "#",
      key: "serial",
      width: 60,
      render: (_: unknown, __: ExpenseCategory, idx: number) => (
        <span className="text-muted fs-12">{idx + 1}</span>
      ),
    },
    {
      title: "Category Name",
      dataIndex: "name",
      key: "name",
      sorter: (a, b) => a.name.localeCompare(b.name),
      render: (v: string) => <span className="fw-semibold text-dark">{v}</span>,
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 120,
      render: (v: CategoryStatus) => (
        <span className={`badge fw-medium border ${v === "Active" ? "badge-soft-success border-success" : "badge-soft-danger border-danger"}`}>
          {v}
        </span>
      ),
    },
    {
      title: "Actions",
      key: "actions",
      width: 100,
      render: (_: unknown, record: ExpenseCategory) => (
        <div className="d-flex gap-1">
          <Tooltip title="Edit">
            <button
              className="btn btn-outline-primary btn-icon btn-sm"
              onClick={() => { setEditing(record); setModalOpen(true); }}
            >
              <i className="ti ti-edit" />
            </button>
          </Tooltip>
          <Tooltip title="Delete">
            <button
              className="btn btn-outline-danger btn-icon btn-sm"
              onClick={() => setDeleteTarget(record)}
            >
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
          <div className="d-flex align-items-sm-center flex-sm-row flex-column gap-2 pb-3 mb-3">
            <div className="flex-grow-1">
              <h4 className="fw-bold mb-0">
                Expense Categories
                <span className="badge badge-soft-primary fw-medium border border-primary py-1 px-2 fs-13 ms-2">
                  {categories.length}
                </span>
              </h4>
            </div>
            <div>
              <button
                className="btn btn-primary fs-13 btn-md d-inline-flex align-items-center gap-1"
                onClick={() => { setEditing(null); setModalOpen(true); }}
              >
                <i className="ti ti-plus" />Add Category
              </button>
            </div>
          </div>

          <div className="card">
            <div className="card-body">
              <Table<ExpenseCategory>
                className="table table-nowrap datatable"
                columns={columns}
                dataSource={categories}
                rowKey="id"
                loading={loading}
                pagination={{ pageSize: 10, showSizeChanger: false }}
                locale={{ emptyText: "No categories found." }}
              />
            </div>
          </div>
        </div>
      </div>

      <CategoryModal
        open={modalOpen}
        editing={editing}
        onClose={() => { setModalOpen(false); setEditing(null); }}
        onSaved={handleSaved}
      />

      <DeleteModal
        open={!!deleteTarget}
        category={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        deleting={deleting}
      />
    </>
  );
};

export default ExpenseCategoryPage;
