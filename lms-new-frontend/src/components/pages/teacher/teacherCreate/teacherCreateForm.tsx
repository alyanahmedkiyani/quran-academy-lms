"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useFormik } from "formik";
import * as Yup from "yup";

import { all_routes } from "@/routes/all_routes";
import { useAppDispatch, useAppSelector } from "@/core/redux/hooks";
import { createTeacherThunk, resetTeacherSaveStatus } from "@/core/redux/teacherSlice";
import { isAdminAuthorityRole, getDashboardRouteForRole } from "@/lib/roles";
import { useNotification } from "@/hooks/useNotification";
import { api_base_url, withAuthorization } from "@/services/apiClient";
import PhoneCountryInput from "@/components/shared/PhoneCountryInput";
import { PHONE_COUNTRIES, phoneYupValidator } from "@/lib/phoneCountries";

const SHIFT_OPTIONS = ["Morning", "Afternoon", "Evening"] as const;
type ShiftOption = typeof SHIFT_OPTIONS[number];

const TIMEZONE_OPTIONS = [
  { value: "Asia/Karachi",      label: "Pakistan (PKT, UTC+5)" },
  { value: "Asia/Dubai",        label: "Dubai / UAE (GST, UTC+4)" },
  { value: "Asia/Kolkata",      label: "India (IST, UTC+5:30)" },
  { value: "Asia/Dhaka",        label: "Bangladesh (BST, UTC+6)" },
  { value: "Asia/Singapore",    label: "Singapore (SGT, UTC+8)" },
  { value: "Asia/Shanghai",     label: "China (CST, UTC+8)" },
  { value: "Asia/Tokyo",        label: "Japan (JST, UTC+9)" },
  { value: "Asia/Seoul",        label: "South Korea (KST, UTC+9)" },
  { value: "Pacific/Auckland",  label: "New Zealand (NZST, UTC+12/13)" },
  { value: "Australia/Sydney",  label: "Australia - Sydney (AEST, UTC+10/11)" },
  { value: "Europe/London",     label: "UK (GMT/BST, UTC+0/1)" },
  { value: "Europe/Paris",      label: "France / CET (UTC+1/2)" },
  { value: "Europe/Berlin",     label: "Germany / CET (UTC+1/2)" },
  { value: "Europe/Moscow",     label: "Russia - Moscow (MSK, UTC+3)" },
  { value: "Africa/Cairo",      label: "Egypt (EET, UTC+2)" },
  { value: "America/New_York",  label: "USA - New York (EST/EDT, UTC-5/-4)" },
  { value: "America/Chicago",   label: "USA - Chicago (CST/CDT, UTC-6/-5)" },
  { value: "America/Denver",    label: "USA - Denver (MST/MDT, UTC-7/-6)" },
  { value: "America/Los_Angeles", label: "USA - Los Angeles (PST/PDT, UTC-8/-7)" },
  { value: "America/Toronto",   label: "Canada - Toronto (EST/EDT, UTC-5/-4)" },
  { value: "America/Sao_Paulo", label: "Brazil (BRT, UTC-3)" },
  { value: "UTC",               label: "UTC (UTC+0)" },
];

const validationSchema = Yup.object({
  firstName: Yup.string().trim().required("First name is required"),
  lastName: Yup.string().trim().required("Last name is required"),
  username: Yup.string().trim().min(3, "Username must be at least 3 characters").required("Username is required"),
  email: Yup.string().trim().email("Enter a valid email address").required("Email is required"),
  contact: Yup.string().trim().required("Contact number is required").test("phone", "", phoneYupValidator),
  cnic: Yup.string()
    .trim()
    .required("CNIC is required")
    .matches(/^\d{5}-\d{7}-\d$/, "CNIC must be in format: 12345-6789012-3"),
  password: Yup.string().trim().min(6, "Password must be at least 6 characters").required("Password is required"),
  confirmPassword: Yup.string()
    .required("Please confirm the password")
    .oneOf([Yup.ref("password")], "Passwords must match"),
});

const TeacherCreateForm = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Username availability check
  const [usernameStatus, setUsernameStatus] = useState<"idle" | "checking" | "available" | "taken">("idle");
  const usernameDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dispatch = useAppDispatch();
  const router = useRouter();
  const notify = useNotification();
  const user = useAppSelector((state) => state.auth.user);
  const { saveStatus, saveError } = useAppSelector((state) => state.teachers);
  const saving = saveStatus === "loading";

  // Role guard
  useEffect(() => {
    if (user && !isAdminAuthorityRole(user.role?.name)) {
      router.replace(getDashboardRouteForRole(user.role?.name));
    }
  }, [user, router]);

  useEffect(() => {
    if (saveError) notify.error(saveError);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveError]);

  // Cleanup save status on unmount
  useEffect(() => {
    return () => {
      dispatch(resetTeacherSaveStatus());
    };
  }, [dispatch]);

  // Debounced username uniqueness check (fires 500ms after user stops typing)
  const checkUsername = (value: string) => {
    if (usernameDebounceRef.current) clearTimeout(usernameDebounceRef.current);
    const trimmed = value.trim();
    if (trimmed.length < 3) { setUsernameStatus("idle"); return; }
    setUsernameStatus("checking");
    usernameDebounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`${api_base_url}/teacher/check-username?username=${encodeURIComponent(trimmed)}`, {
          headers: withAuthorization(),
        });
        const data = await res.json();
        setUsernameStatus(data.available ? "available" : "taken");
      } catch {
        setUsernameStatus("idle");
      }
    }, 500);
  };

  const formik = useFormik({
    initialValues: {
      firstName: "",
      lastName: "",
      username: "",
      email: "",
      contact: "",
      cnic: "",
      password: "",
      confirmPassword: "",
      shift: [] as ShiftOption[],
      timeZone: "",
    },
    validationSchema,
    onSubmit: async (values) => {
      try {
        await dispatch(
          createTeacherThunk({
            firstName: values.firstName.trim(),
            lastName: values.lastName.trim(),
            username: values.username.trim(),
            email: values.email.trim(),
            contact: values.contact.trim(),
            cnic: values.cnic.trim(),
            password: values.password.trim(),
            shift: values.shift.length > 0 ? values.shift : null,
            timeZone: values.timeZone || null,
          })
        ).unwrap();
        notify.success("Teacher account created successfully");
        router.push(all_routes.manageTeachers);
      } catch {
        // error shown via saveError useEffect
      }
    },
  });

  const field = (
    name: keyof typeof formik.values,
    label: string,
    type = "text",
    required = true
  ) => (
    <div className="mb-3">
      <label className="form-label fw-medium">
        {label} {required && <span className="text-danger">*</span>}
      </label>
      <input
        type={type}
        className={`form-control${
          formik.touched[name] && formik.errors[name] ? " is-invalid" : ""
        }`}
        name={name}
        value={formik.values[name]}
        onChange={formik.handleChange}
        onBlur={formik.handleBlur}
        autoComplete={type === "password" ? "new-password" : undefined}
        disabled={saving}
      />
      {formik.touched[name] && formik.errors[name] && (
        <div className="invalid-feedback">{formik.errors[name]}</div>
      )}
    </div>
  );

  return (
    <div className="page-wrapper">
      <div className="content">
        {/* Breadcrumb */}
        <div className="d-flex align-items-center gap-2 mb-4">
          <Link
            href={all_routes.manageTeachers}
            className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1"
          >
            <i className="ti ti-arrow-left" />
            Back to Teachers
          </Link>
          <span className="text-muted">/</span>
          <span className="fw-medium">Add Teacher</span>
        </div>

        <div className="card">
          <div className="card-body">
            <div className="border-bottom d-flex align-items-center justify-content-between pb-3 mb-3">
              <h5 className="offcanvas-title fs-18 fw-bold">New Teacher Account</h5>
            </div>
            <form onSubmit={formik.handleSubmit} noValidate>
              <div className="bg-light px-3 py-2 mb-3">
                <h6 className="fw-bold mb-0">Personal Information</h6>
              </div>
              <div className="row">
                <div className="col-md-6">{field("firstName", "First Name")}</div>
                <div className="col-md-6">{field("lastName", "Last Name")}</div>
                <div className="col-md-6">
                  <div className="mb-3">
                    <label className="form-label fw-medium">
                      Contact Number <span className="text-danger">*</span>
                    </label>
                    <PhoneCountryInput
                      value={formik.values.contact}
                      onChange={(val) => formik.setFieldValue("contact", val)}
                      onBlur={() => formik.setFieldTouched("contact", true)}
                      disabled={saving}
                      isInvalid={!!(formik.touched.contact && formik.errors.contact)}
                    />
                    {formik.touched.contact && formik.errors.contact && (
                      <div className="text-danger small mt-1">{formik.errors.contact}</div>
                    )}
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="mb-3">
                    <label className="form-label fw-medium">CNIC <span className="text-danger">*</span></label>
                    <input
                      type="text"
                      className={`form-control${formik.touched.cnic && formik.errors.cnic ? " is-invalid" : ""}`}
                      name="cnic"
                      value={formik.values.cnic}
                      placeholder="12345-6789012-3"
                      maxLength={15}
                      disabled={saving}
                      onBlur={formik.handleBlur}
                      onChange={(e) => {
                        // Strip non-digits, then auto-insert dashes at positions 5 and 13
                        const digits = e.target.value.replace(/\D/g, "").slice(0, 13);
                        let formatted = digits;
                        if (digits.length > 5) formatted = digits.slice(0, 5) + "-" + digits.slice(5);
                        if (digits.length > 12) formatted = formatted.slice(0, 13) + "-" + digits.slice(12);
                        formik.setFieldValue("cnic", formatted);
                      }}
                    />
                    {formik.touched.cnic && formik.errors.cnic ? (
                      <div className="invalid-feedback">{formik.errors.cnic}</div>
                    ) : (
                      <div className="form-text">Format: 12345-6789012-3</div>
                    )}
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="mb-3">
                    <label className="form-label fw-medium">Shifts (select all that apply)</label>
                    <div className="d-flex gap-3 flex-wrap">
                      {SHIFT_OPTIONS.map((s) => (
                        <div key={s} className="form-check">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            id={`create-shift-${s}`}
                            checked={formik.values.shift.includes(s)}
                            disabled={saving}
                            onChange={() => {
                              const current = formik.values.shift;
                              const next = current.includes(s)
                                ? current.filter((x) => x !== s)
                                : [...current, s];
                              formik.setFieldValue("shift", next);
                            }}
                          />
                          <label className="form-check-label" htmlFor={`create-shift-${s}`}>
                            {s === "Morning" ? "☀️ Morning (6am–12pm)" : s === "Afternoon" ? "🌤️ Afternoon (12pm–6pm)" : "🌙 Evening (6pm–12am)"}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="col-md-6">
                  <div className="mb-3">
                    <label className="form-label fw-medium">Time Zone</label>
                    <select
                      className="form-select"
                      name="timeZone"
                      value={formik.values.timeZone}
                      onChange={formik.handleChange}
                      disabled={saving}
                    >
                      <option value="">— Default (PKT) —</option>
                      {TIMEZONE_OPTIONS.map((tz) => (
                        <option key={tz.value} value={tz.value}>{tz.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="bg-light px-3 py-2 mb-3">
                <h6 className="fw-bold mb-0">Login Credentials</h6>
              </div>
              <div className="row">
                <div className="col-md-6">
                  <div className="mb-3">
                    <label className="form-label fw-medium">Username <span className="text-danger">*</span></label>
                    <div className="input-group">
                      <input
                        type="text"
                        className={`form-control${formik.touched.username && formik.errors.username ? " is-invalid" : usernameStatus === "taken" ? " is-invalid" : usernameStatus === "available" ? " is-valid" : ""}`}
                        name="username"
                        value={formik.values.username}
                        disabled={saving}
                        onChange={(e) => {
                          formik.handleChange(e);
                          checkUsername(e.target.value);
                        }}
                        onBlur={formik.handleBlur}
                      />
                      <span className="input-group-text">
                        {usernameStatus === "checking" && <span className="spinner-border spinner-border-sm text-secondary" role="status" />}
                        {usernameStatus === "available" && <i className="ti ti-circle-check text-success" />}
                        {usernameStatus === "taken" && <i className="ti ti-circle-x text-danger" />}
                        {usernameStatus === "idle" && <i className="ti ti-at text-muted" />}
                      </span>
                      {formik.touched.username && formik.errors.username && (
                        <div className="invalid-feedback">{formik.errors.username}</div>
                      )}
                      {!formik.errors.username && usernameStatus === "taken" && (
                        <div className="invalid-feedback">Username is already taken.</div>
                      )}
                    </div>
                    {usernameStatus === "available" && (
                      <div className="text-success small mt-1"><i className="ti ti-check me-1" />Username is available</div>
                    )}
                  </div>
                </div>
                <div className="col-md-6">{field("email", "Email Address", "email")}</div>
                <div className="col-md-6">
                  <div className="mb-3">
                    <label className="form-label fw-medium">Password <span className="text-danger">*</span></label>
                    <div className="input-group">
                      <input
                        type={showPassword ? "text" : "password"}
                        className={`form-control${formik.touched.password && formik.errors.password ? " is-invalid" : ""}`}
                        name="password"
                        value={formik.values.password}
                        onChange={formik.handleChange}
                        onBlur={formik.handleBlur}
                        autoComplete="new-password"
                        disabled={saving}
                      />
                      <button
                        type="button"
                        className="btn btn-outline-secondary"
                        onClick={() => setShowPassword((v) => !v)}
                        tabIndex={-1}
                      >
                        <i className={`ti ${showPassword ? "ti-eye-off" : "ti-eye"}`} />
                      </button>
                      {formik.touched.password && formik.errors.password && (
                        <div className="invalid-feedback">{formik.errors.password}</div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="mb-3">
                    <label className="form-label fw-medium">Confirm Password <span className="text-danger">*</span></label>
                    <div className="input-group">
                      <input
                        type={showConfirm ? "text" : "password"}
                        className={`form-control${formik.touched.confirmPassword && formik.errors.confirmPassword ? " is-invalid" : ""}`}
                        name="confirmPassword"
                        value={formik.values.confirmPassword}
                        onChange={formik.handleChange}
                        onBlur={formik.handleBlur}
                        autoComplete="new-password"
                        disabled={saving}
                      />
                      <button
                        type="button"
                        className="btn btn-outline-secondary"
                        onClick={() => setShowConfirm((v) => !v)}
                        tabIndex={-1}
                      >
                        <i className={`ti ${showConfirm ? "ti-eye-off" : "ti-eye"}`} />
                      </button>
                      {formik.touched.confirmPassword && formik.errors.confirmPassword && (
                        <div className="invalid-feedback">{formik.errors.confirmPassword}</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="d-flex gap-2 justify-content-end mt-2">
                <Link href={all_routes.manageTeachers} className="btn btn-light border">
                  Cancel
                </Link>
                <button
                  type="submit"
                  className="btn btn-primary d-inline-flex align-items-center gap-2"
                  disabled={saving || usernameStatus === "taken" || usernameStatus === "checking"}
                >
                  {saving && (
                    <span
                      className="spinner-border spinner-border-sm"
                      role="status"
                      aria-hidden="true"
                    />
                  )}
                  {saving ? "Creating..." : "Create Teacher"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeacherCreateForm;
