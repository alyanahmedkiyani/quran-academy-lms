"use client";

import { useEffect, useState, useCallback } from "react";
import { useFormik } from "formik";
import * as Yup from "yup";
import { usePermissionGuard } from "@/lib/usePermissionGuard";
import { PERMISSIONS } from "@/lib/permissions";
import {
  Plan,
  BillingCycle,
  BILLING_CYCLE_LABELS,
  BILLING_CYCLE_DEFAULTS,
  fetchAllPlans,
  createPlan,
  updatePlan,
  deletePlan,
  CreatePlanPayload,
} from "@/services/planService";
import { fetchAllStudents } from "@/services/studentService";
import { getAllPlanChangeRequests } from "@/services/feesService";

// ─── Helpers ───────────────────────────────────────────────────────────────────
const BILLING_OPTIONS: { value: BillingCycle; label: string }[] = (
  Object.entries(BILLING_CYCLE_LABELS) as [BillingCycle, string][]
).map(([value, label]) => ({ value, label }));

const cycleBadgeClass: Record<BillingCycle, string> = {
  monthly:    "bg-primary-transparent text-primary",
  quarterly:  "bg-info-transparent text-info",
  yearly:     "bg-success-transparent text-success",
  "one-time": "bg-warning-transparent text-warning",
};

// ─── Validation ────────────────────────────────────────────────────────────────
const planSchema = Yup.object({
  name: Yup.string().trim().required("Plan name is required"),
  price: Yup.number()
    .typeError("Price must be a number")
    .min(0, "Price cannot be negative")
    .required("Price is required"),
  billingCycle: Yup.string()
    .oneOf(["monthly", "quarterly", "yearly", "one-time"])
    .required("Billing cycle is required"),
  durationDays: Yup.number()
    .typeError("Must be a number")
    .integer("Must be a whole number")
    .min(1, "Must be at least 1 day")
    .required("Duration is required"),
  description: Yup.string().trim(),
  featuresRaw: Yup.string().trim(),
});

type PlanFormValues = {
  name: string;
  price: string;
  billingCycle: BillingCycle;
  durationDays: string;
  description: string;
  featuresRaw: string;
};

const toPayload = (v: PlanFormValues): CreatePlanPayload => ({
  name: v.name.trim(),
  price: parseFloat(v.price),
  billingCycle: v.billingCycle,
  durationDays: parseInt(v.durationDays, 10),
  description: v.description.trim() || undefined,
  features: v.featuresRaw
    ? v.featuresRaw.split(",").map((f) => f.trim()).filter(Boolean)
    : undefined,
});

const emptyValues: PlanFormValues = {
  name: "",
  price: "",
  billingCycle: "monthly",
  durationDays: "30",
  description: "",
  featuresRaw: "",
};

const planToFormValues = (p: Plan): PlanFormValues => ({
  name: p.name,
  price: String(p.price),
  billingCycle: p.billingCycle ?? "monthly",
  durationDays: String(p.durationDays ?? 30),
  description: p.description ?? "",
  featuresRaw: Array.isArray(p.features) ? p.features.join(", ") : "",
});

// ─── View Modal ────────────────────────────────────────────────────────────────
interface PlanViewModalProps {
  plan: Plan | null;
  onClose: () => void;
}

const PlanViewModal = ({ plan, onClose }: PlanViewModalProps) => {
  useEffect(() => {
    if (plan) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [plan]);

  if (!plan) return null;

  return (
    <>
      <div className="modal-backdrop fade show" style={{ zIndex: 1040 }} onClick={onClose} />
      <div className="modal fade show" style={{ display: "block", zIndex: 1055 }} tabIndex={-1}>
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title fw-bold d-flex align-items-center gap-2">
                <i className="ti ti-package text-primary fs-18" />
                {plan.name}
              </h5>
              <button type="button" className="btn-close" onClick={onClose} />
            </div>
            <div className="modal-body">
              {/* Price + Cycle + Duration */}
              <div className="row g-3 mb-4">
                <div className="col-4 text-center">
                  <div className="text-muted fs-12 mb-1">Price</div>
                  <span className="badge bg-success-transparent text-success fs-14 fw-semibold">
                    ${Number(plan.price).toFixed(2)}
                  </span>
                </div>
                <div className="col-4 text-center">
                  <div className="text-muted fs-12 mb-1">Billing Cycle</div>
                  <span className={`badge ${cycleBadgeClass[plan.billingCycle ?? "monthly"]} text-capitalize fs-12`}>
                    {plan.billingCycle ?? "monthly"}
                  </span>
                </div>
                <div className="col-4 text-center">
                  <div className="text-muted fs-12 mb-1">Duration</div>
                  <span className="fw-semibold">{plan.durationDays ?? 30} days</span>
                </div>
              </div>

              {/* Description */}
              {plan.description && (
                <div className="mb-4">
                  <div className="text-muted fs-12 fw-medium mb-1">Description</div>
                  <p className="mb-0">{plan.description}</p>
                </div>
              )}

              {/* Features */}
              <div>
                <div className="text-muted fs-12 fw-medium mb-2">
                  Features ({Array.isArray(plan.features) ? plan.features.length : 0})
                </div>
                {Array.isArray(plan.features) && plan.features.length > 0 ? (
                  <div className="d-flex flex-wrap gap-2">
                    {plan.features.map((f, i) => (
                      <span key={i} className="badge bg-light text-dark border fs-12 py-2 px-3">
                        <i className="ti ti-check me-1 text-success" />
                        {f}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-muted fst-italic">No features listed</span>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-light border" onClick={onClose}>Close</button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

// ─── Modal ─────────────────────────────────────────────────────────────────────
interface PlanModalProps {
  open: boolean;
  plan: Plan | null;
  onClose: () => void;
  onSaved: (plan: Plan) => void;
}

const PlanModal = ({ open, plan, onClose, onSaved }: PlanModalProps) => {
  const [serverError, setServerError] = useState<string | null>(null);

  const formik = useFormik<PlanFormValues>({
    initialValues: plan ? planToFormValues(plan) : emptyValues,
    validationSchema: planSchema,
    enableReinitialize: true,
    onSubmit: async (values, helpers) => {
      setServerError(null);
      try {
        const payload = toPayload(values);
        const saved = plan
          ? await updatePlan(plan.id, payload)
          : await createPlan(payload);
        onSaved(saved);
        helpers.resetForm();
      } catch (err: unknown) {
        setServerError(err instanceof Error ? err.message : "Failed to save plan");
      }
    },
  });

  // Auto-fill durationDays when billingCycle changes (except one-time)
  const handleCycleChange = (cycle: BillingCycle) => {
    formik.setFieldValue("billingCycle", cycle);
    if (cycle !== "one-time") {
      formik.setFieldValue("durationDays", String(BILLING_CYCLE_DEFAULTS[cycle]));
    }
  };

  const handleClose = () => {
    if (formik.isSubmitting) return;
    formik.resetForm();
    setServerError(null);
    onClose();
  };

  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (!open) return null;

  const tf = (name: keyof PlanFormValues, label: string, type = "text", required = false) => (
    <div className="mb-3">
      <label className="form-label fw-medium">
        {label} {required && <span className="text-danger">*</span>}
      </label>
      <input
        type={type}
        className={`form-control${formik.touched[name] && formik.errors[name] ? " is-invalid" : ""}`}
        name={name}
        value={formik.values[name]}
        onChange={formik.handleChange}
        onBlur={formik.handleBlur}
        disabled={formik.isSubmitting}
      />
      {formik.touched[name] && formik.errors[name] && (
        <div className="invalid-feedback">{String(formik.errors[name])}</div>
      )}
    </div>
  );

  return (
    <>
      <div className="modal-backdrop fade show" style={{ zIndex: 1040 }} onClick={handleClose} />
      <div className="modal fade show" style={{ display: "block", zIndex: 1055 }} tabIndex={-1}>
        <div className="modal-dialog modal-dialog-centered modal-lg">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title fw-bold">
                {plan ? "Edit Plan" : "Add Subscription Plan"}
              </h5>
              <button type="button" className="btn-close" onClick={handleClose} disabled={formik.isSubmitting} />
            </div>
            <form onSubmit={formik.handleSubmit} noValidate>
              <div className="modal-body">
                {serverError && (
                  <div className="alert alert-danger py-2 mb-3">{serverError}</div>
                )}

                <div className="row">
                  {/* Name + Price */}
                  <div className="col-md-8">{tf("name", "Plan Name", "text", true)}</div>
                  <div className="col-md-4">{tf("price", "Price ($)", "number", true)}</div>

                  {/* Billing Cycle */}
                  <div className="col-md-6">
                    <div className="mb-3">
                      <label className="form-label fw-medium">
                        Billing Cycle <span className="text-danger">*</span>
                      </label>
                      <select
                        className={`form-select${formik.touched.billingCycle && formik.errors.billingCycle ? " is-invalid" : ""}`}
                        name="billingCycle"
                        value={formik.values.billingCycle}
                        onChange={(e) => handleCycleChange(e.target.value as BillingCycle)}
                        onBlur={formik.handleBlur}
                        disabled={formik.isSubmitting}
                      >
                        {BILLING_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                      {formik.touched.billingCycle && formik.errors.billingCycle && (
                        <div className="invalid-feedback">{formik.errors.billingCycle}</div>
                      )}
                    </div>
                  </div>

                  {/* Duration Days */}
                  <div className="col-md-6">
                    <div className="mb-3">
                      <label className="form-label fw-medium">
                        Duration (days) <span className="text-danger">*</span>
                      </label>
                      <input
                        type="number"
                        className={`form-control${formik.touched.durationDays && formik.errors.durationDays ? " is-invalid" : ""}`}
                        name="durationDays"
                        value={formik.values.durationDays}
                        onChange={formik.handleChange}
                        onBlur={formik.handleBlur}
                        disabled={formik.isSubmitting}
                        min={1}
                      />
                      <div className="form-text">Auto-filled from billing cycle — you can override it</div>
                      {formik.touched.durationDays && formik.errors.durationDays && (
                        <div className="invalid-feedback">{formik.errors.durationDays}</div>
                      )}
                    </div>
                  </div>

                  {/* Description */}
                  <div className="col-12">{tf("description", "Description")}</div>

                  {/* Features */}
                  <div className="col-12">
                    <div className="mb-3">
                      <label className="form-label fw-medium">Features</label>
                      <textarea
                        className="form-control"
                        name="featuresRaw"
                        rows={3}
                        value={formik.values.featuresRaw}
                        onChange={formik.handleChange}
                        onBlur={formik.handleBlur}
                        disabled={formik.isSubmitting}
                        placeholder="e.g. 10 courses, Live sessions, Priority support"
                      />
                      <div className="form-text">Comma-separated list of features</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="modal-footer gap-2">
                <button type="button" className="btn btn-light border" onClick={handleClose} disabled={formik.isSubmitting}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={formik.isSubmitting}>
                  {formik.isSubmitting
                    ? (plan ? "Saving..." : "Creating...")
                    : (plan ? "Save Changes" : "Create Plan")}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
};

// ─── Delete Confirm ─────────────────────────────────────────────────────────────
interface DeleteConfirmProps {
  plan: Plan;
  onCancel: () => void;
  onDeleted: (id: number) => void;
}

const DeleteConfirm = ({ plan, onCancel, onDeleted }: DeleteConfirmProps) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    setLoading(true);
    setError(null);
    try {
      await deletePlan(plan.id);
      onDeleted(plan.id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete plan");
      setLoading(false);
    }
  };

  return (
    <>
      <div className="modal-backdrop fade show" style={{ zIndex: 1040 }} onClick={!loading ? onCancel : undefined} />
      <div className="modal fade show" style={{ display: "block", zIndex: 1055 }} tabIndex={-1}>
        <div className="modal-dialog modal-dialog-centered modal-sm">
          <div className="modal-content">
            <div className="modal-header border-0 pb-0">
              <h5 className="modal-title fw-bold text-danger">Delete Plan</h5>
            </div>
            <div className="modal-body">
              {error && <div className="alert alert-danger py-2 mb-3">{error}</div>}
              <p className="mb-0">
                Are you sure you want to delete <strong>{plan.name}</strong>? Students assigned to this plan may be affected.
              </p>
            </div>
            <div className="modal-footer gap-2">
              <button className="btn btn-light border" onClick={onCancel} disabled={loading}>Cancel</button>
              <button className="btn btn-danger" onClick={handleDelete} disabled={loading}>
                {loading ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

// ─── Main Page ─────────────────────────────────────────────────────────────────
const SubscriptionManagement = () => {
  usePermissionGuard(PERMISSIONS.PLANS_VIEW);

  const [plans, setPlans] = useState<Plan[]>([]);
  const [planStudentCounts, setPlanStudentCounts] = useState<Record<number, number>>({});
  const [enrolledCount, setEnrolledCount] = useState(0);
  const [noPlanCount, setNoPlanCount] = useState(0);
  const [pendingRequests, setPendingRequests] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [deletingPlan, setDeletingPlan] = useState<Plan | null>(null);
  const [viewingPlan, setViewingPlan] = useState<Plan | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [plansData, studentsData, requestsData] = await Promise.all([
        fetchAllPlans(),
        fetchAllStudents().catch(() => ({ students: [] })),
        getAllPlanChangeRequests().catch(() => []),
      ]);
      setPlans(plansData);
      const students = studentsData.students ?? [];
      setEnrolledCount(students.filter((s) => s.planId).length);
      setNoPlanCount(students.filter((s) => !s.planId).length);
      const counts: Record<number, number> = {};
      students.forEach((s) => { if (s.planId) { const pid = Number(s.planId); counts[pid] = (counts[pid] ?? 0) + 1; } });
      setPlanStudentCounts(counts);
      setPendingRequests(requestsData.filter((r) => r.status === "pending").length);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load plans");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSaved = (saved: Plan) => {
    setPlans((prev) => {
      const idx = prev.findIndex((p) => p.id === saved.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = saved;
        return next;
      }
      return [...prev, saved];
    });
    setModalOpen(false);
    setEditingPlan(null);
  };

  const handleDeleted = (id: number) => {
    setPlans((prev) => prev.filter((p) => p.id !== id));
    setDeletingPlan(null);
  };

  const openAdd = () => { setEditingPlan(null); setModalOpen(true); };
  const openEdit = (p: Plan) => { setEditingPlan(p); setModalOpen(true); };

  return (
    <div className="page-wrapper">
      <div className="content">
        {/* Header */}
        <div className="d-flex align-items-center justify-content-between mb-4">
          <div>
            <h4 className="fw-bold mb-1">Subscription Plans</h4>
            <p className="text-muted mb-0 fs-14">Manage plans with billing cycles and durations</p>
          </div>
          <button className="btn btn-primary d-inline-flex align-items-center gap-2" onClick={openAdd}>
            <i className="ti ti-plus fs-16" />
            Add Plan
          </button>
        </div>

        {error && (
          <div className="alert alert-danger d-flex align-items-center gap-2">
            <i className="ti ti-alert-circle" />
            {error}
            <button className="btn btn-sm btn-outline-danger ms-auto" onClick={load}>Retry</button>
          </div>
        )}

        {/* Summary Cards */}
        <div className="row g-3 mb-3">
          {[
            { label: "Total Plans",              value: plans.length,                   icon: "ti-package",           color: "primary"                                    },
            { label: "Students With a Plan",     value: enrolledCount,                  icon: "ti-users",             color: "success"                                    },
            { label: "Students Without a Plan",  value: noPlanCount,                    icon: "ti-user-off",          color: "secondary"                                  },
            { label: "Pending Plan Requests",    value: pendingRequests,                icon: "ti-clock-exclamation", color: pendingRequests > 0 ? "warning" : "secondary" },
          ].map(({ label, value, icon, color }) => (
            <div key={label} className="col-md-3">
              <div className="card border-0 shadow-sm mb-0">
                <div className="card-body d-flex align-items-center gap-3 py-3">
                  <div className={`rounded-circle bg-${color} bg-opacity-10 p-3`}>
                    <i className={`ti ${icon} text-${color} fs-4`} />
                  </div>
                  <div>
                    <p className="text-muted mb-0 small">{label}</p>
                    <h5 className="mb-0 fw-semibold">{loading ? "—" : value}</h5>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="card">
          <div className="card-body p-0">
            {loading ? (
              <div className="text-center py-5">
                <div className="spinner-border text-primary" role="status" />
                <div className="mt-2 text-muted">Loading plans...</div>
              </div>
            ) : plans.length === 0 ? (
              <div className="text-center py-5">
                <i className="ti ti-package-off fs-48 text-muted" />
                <div className="mt-2 text-muted">No subscription plans yet.</div>
                <button className="btn btn-primary btn-sm mt-3" onClick={openAdd}>Create First Plan</button>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table table-hover table-stack align-middle mb-0" style={{ minWidth: 700 }}>
                  <thead className="table-light">
                    <tr>
                      <th style={{ width: 40 }}>#</th>
                      <th>Plan Name</th>
                      <th>Price</th>
                      <th>Billing Cycle</th>
                      <th>Duration</th>
                      <th>Students</th>
                      <th>Features</th>
                      <th className="text-end">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plans.map((plan, idx) => (
                      <tr key={plan.id}>
                        <td data-label="#" className="text-muted">{idx + 1}</td>
                        <td data-label="Plan Name">
                          <div className="fw-semibold">{plan.name}</div>
                          {plan.description && (
                            <div className="text-muted fs-12">{plan.description}</div>
                          )}
                        </td>
                        <td data-label="Price">
                          <span className="badge bg-success-transparent text-success fs-13 fw-semibold">
                            ${Number(plan.price).toFixed(2)}
                          </span>
                        </td>
                        <td data-label="Billing Cycle">
                          <span className={`badge ${cycleBadgeClass[plan.billingCycle ?? "monthly"]} text-capitalize`}>
                            {plan.billingCycle ?? "monthly"}
                          </span>
                        </td>
                        <td data-label="Duration">
                          <span className="fw-medium">{plan.durationDays ?? 30}</span>
                          <span className="text-muted fs-12 ms-1">days</span>
                        </td>
                        <td data-label="Students">
                          {(() => {
                            const count = planStudentCounts[plan.id] ?? 0;
                            return (
                              <div className="d-flex align-items-center gap-2">
                                <span className={`badge fs-12 fw-semibold ${count > 0 ? "bg-primary-transparent text-primary" : "bg-light text-muted border"}`}>
                                  <i className="ti ti-users me-1" />
                                  {count}
                                </span>
                                {count > 0 && (
                                  <span className="text-muted fs-11">{count === 1 ? "student" : "students"}</span>
                                )}
                              </div>
                            );
                          })()}
                        </td>
                        <td data-label="Features">
                          {Array.isArray(plan.features) && plan.features.length > 0 ? (
                            <div className="d-flex flex-wrap gap-1">
                              {plan.features.slice(0, 3).map((f, i) => (
                                <span key={i} className="badge bg-light text-dark border">{f}</span>
                              ))}
                              {plan.features.length > 3 && (
                                <span
                                  className="badge bg-secondary-transparent text-secondary border"
                                  title={plan.features.slice(3).join(", ")}
                                  style={{ cursor: "default" }}
                                >
                                  +{plan.features.length - 3} more
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted fst-italic">—</span>
                          )}
                        </td>
                        <td data-label="Actions" className="text-end">
                          <div className="d-inline-flex gap-2">
                            <button
                              className="btn btn-sm btn-outline-secondary"
                              title="View details"
                              onClick={() => setViewingPlan(plan)}
                            >
                              <i className="ti ti-eye fs-15" />
                            </button>
                            <button
                              className="btn btn-sm btn-outline-primary"
                              title="Edit"
                              onClick={() => openEdit(plan)}
                            >
                              <i className="ti ti-edit fs-15" />
                            </button>
                            <button
                              className="btn btn-sm btn-outline-danger"
                              title="Delete"
                              onClick={() => setDeletingPlan(plan)}
                            >
                              <i className="ti ti-trash fs-15" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      <PlanViewModal
        plan={viewingPlan}
        onClose={() => setViewingPlan(null)}
      />

      <PlanModal
        open={modalOpen}
        plan={editingPlan}
        onClose={() => { setModalOpen(false); setEditingPlan(null); }}
        onSaved={handleSaved}
      />

      {deletingPlan && (
        <DeleteConfirm
          plan={deletingPlan}
          onCancel={() => setDeletingPlan(null)}
          onDeleted={handleDeleted}
        />
      )}
    </div>
  );
};

export default SubscriptionManagement;
