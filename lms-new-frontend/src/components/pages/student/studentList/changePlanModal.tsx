"use client";

import { useEffect, useState } from "react";
import { useAppDispatch, useAppSelector } from "@/core/redux/hooks";
import { updateStudentThunk, resetStudentSaveStatus } from "@/core/redux/studentSlice";
import { fetchAllPlans, Plan, BILLING_CYCLE_LABELS } from "@/services/planService";
import { Student } from "@/types/student";

interface ChangePlanModalProps {
  open: boolean;
  student: Student | null;
  onCancel: () => void;
  onSuccess: () => void;
}

const ChangePlanModal = ({ open, student, onCancel, onSuccess }: ChangePlanModalProps) => {
  const dispatch = useAppDispatch();
  const { saveStatus, saveError } = useAppSelector((state) => state.students);
  const saving = saveStatus === "loading";

  const [plans, setPlans]               = useState<Plan[]>([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string>("");

  useEffect(() => {
    if (open) {
      setSelectedPlanId(student?.planId ? String(student.planId) : "");
      setPlansLoading(true);
      fetchAllPlans()
        .then(setPlans)
        .catch(() => {})
        .finally(() => setPlansLoading(false));
    } else {
      dispatch(resetStudentSaveStatus());
    }
  }, [open, student, dispatch]);

  const handleConfirm = async () => {
    if (!student || !selectedPlanId) return;
    try {
      await dispatch(
        updateStudentThunk({
          id: String(student.id),
          payload: {
            firstName: student.firstName,
            lastName:  student.lastName,
            planId:    selectedPlanId,
          },
        })
      ).unwrap();
      onSuccess();
    } catch {
      // error shown via saveError
    }
  };

  const handleCancel = () => {
    if (saving) return;
    dispatch(resetStudentSaveStatus());
    onCancel();
  };

  const currentPlanId = student?.planId ? String(student.planId) : "";
  const selectedPlan  = plans.find((p) => String(p.id) === selectedPlanId);
  const hasChanged    = selectedPlanId !== currentPlanId && !!selectedPlanId;

  if (!open) return null;

  return (
    <>
      <div className="modal-backdrop fade show" style={{ zIndex: 1040 }} onClick={!saving ? handleCancel : undefined} />
      <div className="modal fade show" style={{ display: "block", zIndex: 1055 }} tabIndex={-1}>
        <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: 520 }}>
          <div className="modal-content">

            <div className="modal-header">
              <h4 className="modal-title fw-bold text-dark d-flex align-items-center gap-2">
                <i className="ti ti-credit-card fs-18 text-primary" />
                Change Subscription Plan
              </h4>
              <button
                type="button"
                className="btn-close custom-btn-close opacity-100"
                onClick={handleCancel}
                disabled={saving}
              >
                <i className="ti ti-x fs-16 text-dark" />
              </button>
            </div>

            <div className="modal-body">
              {/* Student info */}
              <div className="d-flex align-items-center gap-3 p-3 bg-light rounded mb-4">
                <div
                  className="rounded-circle bg-primary bg-opacity-10 d-flex align-items-center justify-content-center flex-shrink-0"
                  style={{ width: 40, height: 40 }}
                >
                  <i className="ti ti-user text-primary fs-16" />
                </div>
                <div>
                  <div className="fw-semibold text-dark">
                    {student?.firstName} {student?.lastName}
                  </div>
                  <div className="text-muted fs-12">
                    Current plan:{" "}
                    {student?.plan
                      ? <span className="badge badge-soft-primary text-primary border border-primary rounded fs-12 fw-medium ms-1">{student.plan.name}</span>
                      : <span className="text-muted">None</span>}
                  </div>
                </div>
              </div>

              {saveError && (
                <div className="alert alert-danger py-2 mb-3" role="alert">
                  {saveError}
                </div>
              )}

              {/* Plan cards */}
              {plansLoading ? (
                <div className="text-center py-4 text-muted">
                  <span className="spinner-border spinner-border-sm me-2" />
                  Loading plans...
                </div>
              ) : plans.length === 0 ? (
                <div className="text-center py-4 text-muted fs-13">No plans available.</div>
              ) : (
                <div className="d-flex flex-column gap-2">
                  {plans.map((plan) => {
                    const isCurrent  = String(plan.id) === currentPlanId;
                    const isSelected = String(plan.id) === selectedPlanId;
                    return (
                      <div
                        key={plan.id}
                        onClick={() => !saving && setSelectedPlanId(String(plan.id))}
                        className="border rounded p-3 d-flex align-items-center gap-3"
                        style={{
                          cursor:          saving ? "default" : "pointer",
                          borderColor:     isSelected ? "#1890ff" : "#dee2e6",
                          backgroundColor: isSelected ? "#e6f4ff" : "#fff",
                          transition:      "all 0.15s",
                        }}
                      >
                        {/* Radio indicator */}
                        <div
                          className="rounded-circle border d-flex align-items-center justify-content-center flex-shrink-0"
                          style={{
                            width:           20,
                            height:          20,
                            borderColor:     isSelected ? "#1890ff" : "#adb5bd",
                            borderWidth:     2,
                            backgroundColor: isSelected ? "#1890ff" : "#fff",
                          }}
                        >
                          {isSelected && (
                            <div
                              className="rounded-circle bg-white"
                              style={{ width: 8, height: 8 }}
                            />
                          )}
                        </div>

                        {/* Plan details */}
                        <div className="flex-grow-1 min-width-0">
                          <div className="d-flex align-items-center gap-2 flex-wrap">
                            <span className="fw-semibold text-dark fs-14">{plan.name}</span>
                            {isCurrent && (
                              <span className="badge badge-soft-success text-success border border-success rounded fs-11 fw-medium">
                                Current
                              </span>
                            )}
                          </div>
                          <div className="fs-12 text-muted mt-1">
                            {BILLING_CYCLE_LABELS[plan.billingCycle]}
                            {plan.description && (
                              <span className="ms-2 text-secondary">{plan.description}</span>
                            )}
                          </div>
                        </div>

                        {/* Price */}
                        <div className="text-end flex-shrink-0">
                          <span className="fw-bold text-primary fs-15">
                            ${Number(plan.price).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Change preview */}
              {hasChanged && selectedPlan && (
                <div className="alert alert-info py-2 mt-3 fs-13 d-flex align-items-center gap-2" role="alert">
                  <i className="ti ti-info-circle" />
                  Plan will be changed to <strong className="ms-1">{selectedPlan.name}</strong> immediately.
                </div>
              )}
            </div>

            <div className="modal-footer d-flex align-items-center gap-2">
              <button type="button" className="btn btn-light border" onClick={handleCancel} disabled={saving}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary d-inline-flex align-items-center gap-2"
                onClick={handleConfirm}
                disabled={saving || !hasChanged || plansLoading}
              >
                {saving && <span className="spinner-border spinner-border-sm" role="status" />}
                {saving ? "Saving..." : "Assign Plan"}
              </button>
            </div>

          </div>
        </div>
      </div>
    </>
  );
};

export default ChangePlanModal;
