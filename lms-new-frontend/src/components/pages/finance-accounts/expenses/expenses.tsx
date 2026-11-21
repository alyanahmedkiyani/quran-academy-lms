"use client";

import { useState, useEffect, useCallback } from "react";
import { DatePicker } from "antd";
import dayjs from "dayjs";
import Link from "next/link";
import { Expense, ExpenseCategory, ExpenseStatus, PaymentMethod } from "@/types/expenses";
import {
  fetchExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
  fetchExpenseCategories,
} from "@/services/expenseService";
import Datatable from "@/core/common/dataTable";
import SearchInput from "@/core/common/dataTable/dataTableSearch";

const STATUSES: ExpenseStatus[] = ["New", "Pending", "Approved", "Rejected"];
const PAYMENT_METHODS: PaymentMethod[] = ["Cash", "Bank Transfer", "Credit Card", "Debit Card", "Cheque", "Other"];

const statusClass: Record<ExpenseStatus, string> = {
  Approved: "badge-soft-success border-success text-success",
  Pending: "badge-soft-warning border-warning text-warning",
  New: "badge-soft-primary border-primary text-primary",
  Rejected: "badge-soft-danger border-danger text-danger",
};

const emptyForm = {
  title: "",
  categoryId: "" as string | number,
  amount: "",
  date: "",
  purchasedBy: "",
  paymentMethod: "Cash" as PaymentMethod,
  status: "New" as ExpenseStatus,
  notes: "",
};

// Defined outside the parent component so React sees a stable component type
// and does NOT remount inputs on every keystroke (fixes the "can't type" bug).
interface FormFieldsProps {
  form: typeof emptyForm;
  setForm: (f: typeof emptyForm) => void;
  categories: ExpenseCategory[];
}

const FormFields = ({ form, setForm, categories }: FormFieldsProps) => (
  <div className="row">
    <div className="col-lg-12 mb-3">
      <label className="form-label mb-1 text-dark fs-14 fw-medium">
        Expense Title <span className="text-danger">*</span>
      </label>
      <input
        type="text"
        className="form-control"
        value={form.title}
        onChange={(e) => setForm({ ...form, title: e.target.value })}
      />
    </div>
    <div className="col-lg-6 mb-3">
      <label className="form-label mb-1 text-dark fs-14 fw-medium">Category</label>
      <select
        className="form-select"
        value={form.categoryId}
        onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
      >
        <option value="">Select category</option>
        {categories.filter((c) => c.status === "Active").map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>
    </div>
    <div className="col-lg-6 mb-3">
      <label className="form-label mb-1 text-dark fs-14 fw-medium">
        Amount <span className="text-danger">*</span>
      </label>
      <input
        type="number"
        className="form-control"
        min="0"
        step="0.01"
        value={form.amount}
        onChange={(e) => setForm({ ...form, amount: e.target.value })}
      />
    </div>
    <div className="col-lg-6 mb-3">
      <label className="form-label mb-1 text-dark fs-14 fw-medium">
        Date <span className="text-danger">*</span>
      </label>
      <DatePicker
        style={{ width: "100%" }}
        value={form.date ? dayjs(form.date) : null}
        onChange={(_, ds) => setForm({ ...form, date: ds as string })}
        format="YYYY-MM-DD"
        placeholder="Select date"
      />
    </div>
    <div className="col-lg-6 mb-3">
      <label className="form-label mb-1 text-dark fs-14 fw-medium">Purchased By</label>
      <input
        type="text"
        className="form-control"
        value={form.purchasedBy}
        onChange={(e) => setForm({ ...form, purchasedBy: e.target.value })}
      />
    </div>
    <div className="col-lg-6 mb-3">
      <label className="form-label mb-1 text-dark fs-14 fw-medium">Payment Method</label>
      <select
        className="form-select"
        value={form.paymentMethod}
        onChange={(e) => setForm({ ...form, paymentMethod: e.target.value as PaymentMethod })}
      >
        {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
      </select>
    </div>
    <div className="col-lg-6 mb-3">
      <label className="form-label mb-1 text-dark fs-14 fw-medium">Status</label>
      <select
        className="form-select"
        value={form.status}
        onChange={(e) => setForm({ ...form, status: e.target.value as ExpenseStatus })}
      >
        {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
    </div>
    <div className="col-lg-12 mb-3">
      <label className="form-label mb-1 text-dark fs-14 fw-medium">Notes</label>
      <textarea
        className="form-control"
        rows={3}
        value={form.notes}
        onChange={(e) => setForm({ ...form, notes: e.target.value })}
      />
    </div>
  </div>
);

const ExpensesList = () => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");

  const [addForm, setAddForm] = useState({ ...emptyForm });
  const [editTarget, setEditTarget] = useState<Expense | null>(null);
  const [editForm, setEditForm] = useState({ ...emptyForm });
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [exp, cats] = await Promise.all([fetchExpenses(), fetchExpenseCategories()]);
      setExpenses(exp);
      setCategories(cats);
    } catch {
      //
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const dismissModal = (id: string) => {
    if (typeof window !== "undefined") {
      const el = document.getElementById(id);
      if (!el) return;
      const BootstrapModal = (window as any).bootstrap?.Modal;
      if (!BootstrapModal) return;
      const instance = BootstrapModal.getInstance(el) ?? new BootstrapModal(el);
      instance.hide();
    }
  };

  const handleAdd = async () => {
    if (!addForm.title || !addForm.amount || !addForm.date) {
      setError("Title, amount, and date are required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await createExpense({
        ...addForm,
        categoryId: addForm.categoryId !== "" ? Number(addForm.categoryId) : null,
        amount: parseFloat(addForm.amount as string),
      });
      setAddForm({ ...emptyForm });
      dismissModal("add_new_expense");
      load();
    } catch (e: any) {
      setError(e.message || "Failed to create expense");
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (expense: Expense) => {
    setEditTarget(expense);
    setEditForm({
      title: expense.title,
      categoryId: expense.categoryId ?? "",
      amount: String(expense.amount),
      date: expense.date,
      purchasedBy: expense.purchasedBy ?? "",
      paymentMethod: (expense.paymentMethod as PaymentMethod) ?? "Cash",
      status: expense.status,
      notes: expense.notes ?? "",
    });
    setError("");
  };

  const handleEdit = async () => {
    if (!editTarget || !editForm.title || !editForm.amount || !editForm.date) {
      setError("Title, amount, and date are required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await updateExpense(editTarget.id, {
        ...editForm,
        categoryId: editForm.categoryId !== "" ? Number(editForm.categoryId) : null,
        amount: parseFloat(editForm.amount as string),
      });
      dismissModal("edit_new_expense");
      load();
    } catch (e: any) {
      setError(e.message || "Failed to update expense");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      await deleteExpense(deleteTarget.id);
      dismissModal("delete_expense_modal");
      load();
    } catch {
      //
    } finally {
      setSaving(false);
      setDeleteTarget(null);
    }
  };

  const columns = [
    {
      title: "Expense",
      dataIndex: "title",
      sorter: (a: Expense, b: Expense) => a.title.localeCompare(b.title),
    },
    {
      title: "Category",
      dataIndex: "Category",
      render: (_: any, record: Expense) => (
        <span className="text-dark">{record.Category?.name ?? "—"}</span>
      ),
    },
    {
      title: "Amount",
      dataIndex: "amount",
      render: (v: any) => <span className="fw-semibold text-dark">${parseFloat(v).toFixed(2)}</span>,
      sorter: (a: Expense, b: Expense) => parseFloat(String(a.amount)) - parseFloat(String(b.amount)),
    },
    {
      title: "Date",
      dataIndex: "date",
      render: (v: string) => <span className="text-dark">{v}</span>,
      sorter: (a: Expense, b: Expense) => a.date.localeCompare(b.date),
    },
    {
      title: "Purchased By",
      dataIndex: "purchasedBy",
      render: (v: string) => <span className="text-dark">{v || "—"}</span>,
    },
    {
      title: "Payment Method",
      dataIndex: "paymentMethod",
      render: (v: string) => <span className="text-dark">{v || "—"}</span>,
    },
    {
      title: "Status",
      dataIndex: "status",
      render: (v: ExpenseStatus) => (
        <span className={`badge border ${statusClass[v]} rounded fw-medium`}>{v}</span>
      ),
    },
    {
      title: "",
      render: (_: any, record: Expense) => (
        <div className="action-item p-2">
          <Link href="#" data-bs-toggle="dropdown">
            <i className="ti ti-dots-vertical" />
          </Link>
          <ul className="dropdown-menu p-2">
            <li>
              <button
                className="dropdown-item d-flex align-items-center"
                data-bs-toggle="modal"
                data-bs-target="#edit_new_expense"
                onClick={() => openEdit(record)}
              >
                Edit
              </button>
            </li>
            <li>
              <button
                className="dropdown-item d-flex align-items-center text-danger"
                data-bs-toggle="modal"
                data-bs-target="#delete_expense_modal"
                onClick={() => setDeleteTarget(record)}
              >
                Delete
              </button>
            </li>
          </ul>
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
                Expenses{" "}
                <span className="badge badge-soft-primary fw-medium border py-1 px-2 border-primary fs-13 ms-1">
                  Total: {expenses.length}
                </span>
              </h4>
            </div>
            <div className="text-end d-flex">
              <button
                className="btn btn-primary ms-2 fs-13 btn-md"
                data-bs-toggle="modal"
                data-bs-target="#add_new_expense"
                onClick={() => { setAddForm({ ...emptyForm }); setError(""); }}
              >
                <i className="ti ti-plus me-1" />
                New Expense
              </button>
            </div>
          </div>

          <div className="d-flex align-items-center justify-content-between flex-wrap row-gap-3 mb-3">
            <div className="search-input">
              <SearchInput value={searchText} onChange={setSearchText} />
            </div>
          </div>

          {loading ? (
            <div className="text-center py-5"><div className="spinner-border text-primary" /></div>
          ) : (
            <div className="table-responsive">
              <Datatable columns={columns} dataSource={expenses} Selection={false} searchText={searchText} />
            </div>
          )}
        </div>
      </div>

      {/* Add Modal */}
      <div className="modal fade" id="add_new_expense">
        <div className="modal-dialog modal-dialog-centered modal-lg">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title text-dark fw-bold">New Expense</h5>
              <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close" />
            </div>
            <div className="modal-body">
              {error && <div className="alert alert-danger py-2">{error}</div>}
              <FormFields form={addForm} setForm={setAddForm} categories={categories} />
            </div>
            <div className="modal-footer">
              <button className="btn btn-light btn-sm me-2 fs-13 fw-medium" data-bs-dismiss="modal">Cancel</button>
              <button className="btn btn-primary btn-sm fs-13 fw-medium" onClick={handleAdd} disabled={saving}>
                {saving ? "Saving..." : "Add Expense"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      <div className="modal fade" id="edit_new_expense">
        <div className="modal-dialog modal-dialog-centered modal-lg">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title text-dark fw-bold">Edit Expense</h5>
              <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close" />
            </div>
            <div className="modal-body">
              {error && <div className="alert alert-danger py-2">{error}</div>}
              <FormFields form={editForm} setForm={setEditForm} categories={categories} />
            </div>
            <div className="modal-footer">
              <button className="btn btn-light btn-sm me-2 fs-13 fw-medium" data-bs-dismiss="modal">Cancel</button>
              <button className="btn btn-primary btn-sm fs-13 fw-medium" onClick={handleEdit} disabled={saving}>
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Modal */}
      <div className="modal fade" id="delete_expense_modal">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title text-dark fw-bold">Delete Expense</h5>
              <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close" />
            </div>
            <div className="modal-body text-center py-3">
              <i className="ti ti-trash text-danger fs-1 mb-2 d-block" />
              <p>Are you sure you want to delete <strong>{deleteTarget?.title}</strong>?</p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-light btn-sm me-2 fs-13 fw-medium" data-bs-dismiss="modal">Cancel</button>
              <button className="btn btn-danger btn-sm fs-13 fw-medium" onClick={handleDelete} disabled={saving}>
                {saving ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default ExpensesList;
