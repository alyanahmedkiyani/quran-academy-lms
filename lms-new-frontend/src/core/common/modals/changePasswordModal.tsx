"use client";

import { useEffect, useState } from "react";
import { useFormik } from "formik";
import * as Yup from "yup";

interface ChangePasswordModalProps {
  open: boolean;
  title?: string;
  loading?: boolean;
  error?: string | null;
  onConfirm: (password: string) => void;
  onCancel: () => void;
}

const validationSchema = Yup.object({
  password: Yup.string()
    .trim()
    .min(6, "Password must be at least 6 characters")
    .required("Password is required"),
  confirmPassword: Yup.string()
    .required("Please confirm the password")
    .oneOf([Yup.ref("password")], "Passwords must match"),
});

const ChangePasswordModal = ({
  open,
  title = "Change Password",
  loading,
  error,
  onConfirm,
  onCancel,
}: ChangePasswordModalProps) => {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const formik = useFormik({
    initialValues: { password: "", confirmPassword: "" },
    validationSchema,
    enableReinitialize: true,
    onSubmit: (values, { resetForm }) => {
      onConfirm(values.password.trim());
      resetForm();
    },
  });

  const handleCancel = () => {
    formik.resetForm();
    onCancel();
  };

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
      formik.resetForm();
      setShowPassword(false);
      setShowConfirm(false);
    }
    return () => {
      document.body.style.overflow = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  return (
    <>
      <div
        className="modal-backdrop fade show"
        style={{ zIndex: 1040 }}
        onClick={!loading ? handleCancel : undefined}
      />
      <div
        className="modal fade show"
        style={{ display: "block", zIndex: 1055 }}
        tabIndex={-1}
      >
        <div className="modal-dialog modal-dialog-centered modal-lg">
          <div className="modal-content">
            <div className="modal-header">
              <h4 className="modal-title text-dark fw-bold">{title}</h4>
              <button
                type="button"
                className="btn-close custom-btn-close opacity-100"
                onClick={handleCancel}
                disabled={loading}
              >
                <i className="ti ti-x fs-16 text-dark" />
              </button>
            </div>
            <form onSubmit={formik.handleSubmit} noValidate>
              <div className="modal-body">
                {error && (
                  <div className="alert alert-danger py-2 mb-3" role="alert">
                    {error}
                  </div>
                )}

                <div className="mb-3">
                  <label className="form-label">
                    New Password <span className="text-danger">*</span>
                  </label>
                  <div className="input-group">
                    <input
                      type={showPassword ? "text" : "password"}
                      className="form-control"
                      name="password"
                      value={formik.values.password}
                      onChange={formik.handleChange}
                      onBlur={formik.handleBlur}
                      autoComplete="new-password"
                      disabled={loading}
                    />
                    <button
                      type="button"
                      className="input-group-text bg-white border-start-0"
                      onClick={() => setShowPassword((v) => !v)}
                      tabIndex={-1}
                    >
                      <i className={`ti ${showPassword ? "ti-eye-off" : "ti-eye"} text-muted`} />
                    </button>
                  </div>
                  {formik.touched.password && formik.errors.password && (
                    <div className="text-danger small mt-1">{formik.errors.password}</div>
                  )}
                </div>

                <div className="mb-3">
                  <label className="form-label">
                    Confirm Password <span className="text-danger">*</span>
                  </label>
                  <div className="input-group">
                    <input
                      type={showConfirm ? "text" : "password"}
                      className="form-control"
                      name="confirmPassword"
                      value={formik.values.confirmPassword}
                      onChange={formik.handleChange}
                      onBlur={formik.handleBlur}
                      autoComplete="new-password"
                      disabled={loading}
                    />
                    <button
                      type="button"
                      className="input-group-text bg-white border-start-0"
                      onClick={() => setShowConfirm((v) => !v)}
                      tabIndex={-1}
                    >
                      <i className={`ti ${showConfirm ? "ti-eye-off" : "ti-eye"} text-muted`} />
                    </button>
                  </div>
                  {formik.touched.confirmPassword && formik.errors.confirmPassword && (
                    <div className="text-danger small mt-1">{formik.errors.confirmPassword}</div>
                  )}
                </div>
              </div>

              <div className="modal-footer d-flex align-items-center gap-1">
                <button
                  type="button"
                  className="btn btn-light border"
                  onClick={handleCancel}
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={loading || !formik.isValid || !formik.dirty}
                >
                  {loading ? "Saving..." : "Change Password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
};

export default ChangePasswordModal;
