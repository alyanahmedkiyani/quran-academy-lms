"use client";

import { useEffect, useState } from "react";
import { useAppSelector } from "@/core/redux/hooks";
import { fetchAllPlans, Plan, BILLING_CYCLE_LABELS } from "@/services/planService";
import { requestPlanChange } from "@/services/feesService";
import { api_base_url } from "@/environment";
import { getAccessToken } from "@/lib/auth-storage";

const StudentPlans = () => {
  const { user } = useAppSelector((state) => state.auth);

  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [studentPlanId, setStudentPlanId] = useState<number | string | null>(null);
  const [requesting, setRequesting] = useState<number | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "danger" } | null>(null);
  const [submittedRequests, setSubmittedRequests] = useState<Set<number>>(new Set());

  useEffect(() => {
    fetchAllPlans()
      .then(setPlans)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Fetch student's current planId from their profile
  useEffect(() => {
    if (!user?.id) return;
    const token = getAccessToken();
    fetch(`${api_base_url}/student/getById/${user.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        const student = data.student ?? data;
        if (student?.planId) setStudentPlanId(student.planId);
      })
      .catch(() => {});
  }, [user?.id]);

  const showToast = (message: string, type: "success" | "danger") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleRequestUpgrade = async (plan: Plan) => {
    if (!user?.id) return;
    setRequesting(plan.id);
    try {
      await requestPlanChange(user.id, plan.id);
      setSubmittedRequests((prev) => new Set([...prev, plan.id]));
      showToast(`Plan upgrade request for "${plan.name}" submitted successfully!`, "success");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to submit request";
      showToast(msg, "danger");
    } finally {
      setRequesting(null);
    }
  };

  return (
    <div className="page-wrapper">
      <div className="content">
        {/* Toast */}
        {toast && (
          <div
            className={`alert alert-${toast.type} d-flex align-items-center gap-2 mb-3`}
            role="alert"
            style={{ position: "sticky", top: 16, zIndex: 1050 }}
          >
            <i className={`ti ti-${toast.type === "success" ? "circle-check" : "alert-circle"} fs-18`} />
            {toast.message}
          </div>
        )}

        {/* Header */}
        <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-4">
          <div>
            <h4 className="fw-bold mb-0">Subscription Plans</h4>
            <p className="text-muted mb-0 fs-13">Browse available plans and request an upgrade</p>
          </div>
        </div>

        {loading ? (
          <div className="d-flex justify-content-center py-5">
            <div className="spinner-border text-primary" role="status" />
          </div>
        ) : plans.length === 0 ? (
          <div className="text-center py-5 text-muted">
            <i className="ti ti-package-off fs-40 mb-2 d-block" />
            No plans available at the moment.
          </div>
        ) : (
          <div className="row g-4">
            {plans.map((plan) => {
              const isCurrent = studentPlanId !== null && String(plan.id) === String(studentPlanId);
              const isPendingRequest = submittedRequests.has(plan.id);
              const price = Number(plan.price).toFixed(2);
              const cycleLabel = BILLING_CYCLE_LABELS[plan.billingCycle] ?? plan.billingCycle;

              return (
                <div key={plan.id} className="col-xl-4 col-lg-6">
                  <div
                    className="card h-100 shadow-sm position-relative"
                    style={{
                      border: isCurrent ? "2px solid #0d6efd" : "1px solid #dee2e6",
                    }}
                  >
                    {isCurrent && (
                      <div
                        className="position-absolute top-0 start-50 translate-middle"
                        style={{ zIndex: 5 }}
                      >
                        <span className="badge bg-primary px-3 py-1 fs-12 fw-semibold shadow-sm">
                          Your Current Plan
                        </span>
                      </div>
                    )}
                    <div className="card-body d-flex flex-column pt-4">
                      {/* Plan name + price */}
                      <div className="text-center mb-3">
                        <div
                          className="mx-auto mb-2 rounded-circle d-flex align-items-center justify-content-center"
                          style={{
                            width: 56,
                            height: 56,
                            background: isCurrent ? "#e7f1ff" : "#f1f1f1",
                          }}
                        >
                          <i className={`ti ti-package fs-24 text-${isCurrent ? "primary" : "secondary"}`} />
                        </div>
                        <h5 className="fw-bold mb-1">{plan.name}</h5>
                        <div className="mb-1">
                          <span className="fs-28 fw-bold text-primary">${price}</span>
                          <span className="fs-13 text-muted ms-1">/ {cycleLabel}</span>
                        </div>
                        <span className="badge badge-soft-secondary border border-secondary fs-12">
                          <i className="ti ti-clock me-1" />
                          {plan.durationDays} days
                        </span>
                      </div>

                      {/* Description */}
                      {plan.description && (
                        <p className="fs-13 text-muted text-center mb-3">{plan.description}</p>
                      )}

                      {/* Features */}
                      {plan.features && plan.features.length > 0 && (
                        <ul className="list-unstyled mb-3 flex-fill">
                          {plan.features.map((f, i) => (
                            <li key={i} className="d-flex align-items-start mb-2">
                              <i className="ti ti-circle-check text-success me-2 mt-1 flex-shrink-0" />
                              <span className="fs-13">{f}</span>
                            </li>
                          ))}
                        </ul>
                      )}

                      {/* Action */}
                      <div className="mt-auto pt-3 border-top text-center">
                        {isCurrent ? (
                          <span className="badge badge-soft-primary border border-primary px-3 py-2 fs-13 fw-medium">
                            <i className="ti ti-check me-1" /> Active Plan
                          </span>
                        ) : isPendingRequest ? (
                          <span className="badge badge-soft-warning border border-warning px-3 py-2 fs-13 fw-medium">
                            <i className="ti ti-clock me-1" /> Request Pending
                          </span>
                        ) : (
                          <button
                            className="btn btn-outline-primary w-100"
                            disabled={requesting === plan.id}
                            onClick={() => handleRequestUpgrade(plan)}
                          >
                            {requesting === plan.id ? (
                              <span className="spinner-border spinner-border-sm me-1" />
                            ) : (
                              <i className="ti ti-arrow-up-circle me-1" />
                            )}
                            Request Upgrade
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentPlans;
