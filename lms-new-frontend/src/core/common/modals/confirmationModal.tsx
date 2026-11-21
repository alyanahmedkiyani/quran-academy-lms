"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";

interface ConfirmationModalProps {
  open: boolean;
  title: string;
  description?: ReactNode;
  confirmText?: string;
  cancelText?: string;
  confirmVariant?: "danger" | "warning" | "primary";
  confirmLoading?: boolean;
  icon?: ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
}

const variantClassMap: Record<NonNullable<ConfirmationModalProps["confirmVariant"]>, string> = {
  danger: "btn btn-danger",
  warning: "btn btn-warning",
  primary: "btn btn-primary",
};

const ConfirmationModal = ({
  open,
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  confirmVariant = "primary",
  confirmLoading,
  icon,
  onConfirm,
  onCancel,
}: ConfirmationModalProps) => {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;

  return (
    <>
      <div
        className="modal-backdrop fade show"
        style={{ zIndex: 1040 }}
        onClick={!confirmLoading ? onCancel : undefined}
      />
      <div
        className="modal fade show"
        style={{ display: "block", zIndex: 1055 }}
        tabIndex={-1}
      >
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h4 className="modal-title text-dark fw-bold">{title}</h4>
              <button
                type="button"
                className="btn-close custom-btn-close opacity-100"
                onClick={onCancel}
                disabled={confirmLoading}
              >
                <i className="ti ti-x fs-16 text-dark" />
              </button>
            </div>
            <div className="modal-body text-center">
              {icon && <div className="mb-3 fs-32 text-warning">{icon}</div>}
              {description && <p className="text-muted mb-0">{description}</p>}
            </div>
            <div className="modal-footer d-flex align-items-center justify-content-center gap-1">
              <button
                type="button"
                className="btn btn-light border"
                onClick={onCancel}
                disabled={confirmLoading}
              >
                {cancelText}
              </button>
              <button
                type="button"
                className={`${variantClassMap[confirmVariant]} d-inline-flex align-items-center justify-content-center`}
                onClick={onConfirm}
                disabled={confirmLoading}
              >
                {confirmLoading ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
                    Processing...
                  </>
                ) : (
                  confirmText
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default ConfirmationModal;
