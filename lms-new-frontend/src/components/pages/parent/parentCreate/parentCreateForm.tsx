"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useFormik } from "formik";
import * as Yup from "yup";
import Select from "react-select";
import PhoneCountryInput from "@/components/shared/PhoneCountryInput";
import { phoneYupValidator } from "@/lib/phoneCountries";

import { all_routes } from "@/routes/all_routes";
import { useAppDispatch, useAppSelector } from "@/core/redux/hooks";
import { createParentThunk, resetParentSaveStatus } from "@/core/redux/parentSlice";
import { fetchStudentsThunk } from "@/core/redux/studentSlice";
import { isAdminAuthorityRole, getDashboardRouteForRole } from "@/lib/roles";
import { useNotification } from "@/hooks/useNotification";
import { api_base_url, withAuthorization } from "@/services/apiClient";

type StudentOption = { value: string; label: string };

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

const selectStyles = {
  option: (base: any, state: any) => ({
    ...base,
    color: "#6C7688",
    backgroundColor: state.isSelected ? "#ddd" : "white",
    cursor: "pointer",
    "&:hover": {
      backgroundColor: state.isFocused ? "#2e37a4" : "white",
      color: state.isFocused ? "#fff" : "#2e37a4",
    },
  }),
};

const validationSchema = Yup.object({
  firstName: Yup.string().trim().required("First name is required"),
  lastName: Yup.string().trim().required("Last name is required"),
  username: Yup.string().trim().min(3, "Username must be at least 3 characters").required("Username is required"),
  email: Yup.string().trim().email("Enter a valid email address"),
  contact: Yup.string().trim().test("phone", "", phoneYupValidator),
  address: Yup.string().trim(),
  studentIds: Yup.array().min(1, "Please select at least one student to link"),
  password: Yup.string().trim().min(6, "Password must be at least 6 characters").required("Password is required"),
  confirmPassword: Yup.string()
    .required("Please confirm the password")
    .oneOf([Yup.ref("password")], "Passwords must match"),
});

const ParentCreateForm = () => {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const notify = useNotification();
  const user = useAppSelector((state) => state.auth.user);
  const { saveStatus, saveError } = useAppSelector((state) => state.parents);
  const saving = saveStatus === "loading";

  // Username availability check
  const [usernameStatus, setUsernameStatus] = useState<"idle" | "checking" | "available" | "taken">("idle");
  const usernameDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const { allItems: students, listStatus: studentListStatus } = useAppSelector(
    (state) => state.students
  );

  useEffect(() => {
    if (user && !isAdminAuthorityRole(user.role?.name)) {
      router.replace(getDashboardRouteForRole(user.role?.name));
    }
  }, [user, router]);

  useEffect(() => {
    if (studentListStatus === "idle") {
      dispatch(fetchStudentsThunk());
    }
  }, [studentListStatus, dispatch]);

  useEffect(() => {
    return () => { dispatch(resetParentSaveStatus()); };
  }, [dispatch]);

  useEffect(() => {
    if (saveError) notify.error(saveError);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveError]);

  const formik = useFormik({
    initialValues: {
      firstName: "",
      lastName: "",
      username: "",
      email: "",
      contact: "",
      address: "",
      timeZone: "",
      studentIds: [] as string[],
      password: "",
      confirmPassword: "",
    },
    validationSchema,
    onSubmit: async (values) => {
      try {
        await dispatch(
          createParentThunk({
            firstName: values.firstName.trim(),
            lastName: values.lastName.trim(),
            username: values.username.trim(),
            email: values.email.trim() || undefined,
            contact: values.contact.trim() || undefined,
            address: values.address.trim() || undefined,
            timeZone: values.timeZone || null,
            studentIds: values.studentIds,
            password: values.password.trim(),
          })
        ).unwrap();
        notify.success("Parent account created successfully");
        router.push(all_routes.manageParents);
      } catch {
        // error shown via saveError useEffect
      }
    },
  });

  const studentOptions: StudentOption[] = students.map((s) => ({
    value: String(s.id),
    label: `${s.firstName} ${s.lastName ?? ""}`.trim() + ` (${s.username})`,
  }));

  const selectedStudentOptions = studentOptions.filter((o) =>
    formik.values.studentIds.includes(o.value)
  );

  const textField = (
    name: keyof typeof formik.values,
    label: string,
    type = "text",
    required = false
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
        value={formik.values[name] as string}
        onChange={formik.handleChange}
        onBlur={formik.handleBlur}
        autoComplete={type === "password" ? "new-password" : undefined}
        disabled={saving}
      />
      {formik.touched[name] && formik.errors[name] && (
        <div className="invalid-feedback">{String(formik.errors[name])}</div>
      )}
    </div>
  );

  return (
    <div className="page-wrapper">
      <div className="content">
        <div className="d-flex align-items-center gap-2 mb-4">
          <Link
            href={all_routes.manageParents}
            className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1"
          >
            <i className="ti ti-arrow-left" />
            Back to Parents
          </Link>
          <span className="text-muted">/</span>
          <span className="fw-medium">Add Parent</span>
        </div>

        <div className="card">
          <div className="card-body">
            <div className="border-bottom d-flex align-items-center justify-content-between pb-3 mb-3">
              <h5 className="offcanvas-title fs-18 fw-bold">New Parent Account</h5>
            </div>
            <form onSubmit={formik.handleSubmit} noValidate>
              {/* Linked Students — multi-select */}
              <div className="bg-light px-3 py-2 mb-3">
                <h6 className="fw-bold mb-0">Linked Students</h6>
              </div>
              <div className="mb-3">
                <label className="form-label fw-medium">
                  Select Students <span className="text-danger">*</span>
                </label>
                <Select
                  isMulti
                  classNamePrefix="react-select"
                  styles={selectStyles}
                  options={studentOptions}
                  value={selectedStudentOptions}
                  onChange={(selected) => {
                    formik.setFieldValue(
                      "studentIds",
                      selected ? selected.map((o) => o.value) : [],
                      true
                    );
                  }}
                  placeholder={
                    studentListStatus === "loading"
                      ? "Loading students..."
                      : "Search and select students..."
                  }
                  isClearable
                  isDisabled={saving || studentListStatus === "loading"}
                />
                {formik.submitCount > 0 && formik.errors.studentIds && (
                  <div className="text-danger fs-12 mt-1">
                    {String(formik.errors.studentIds)}
                  </div>
                )}
              </div>

              {/* Account Credentials */}
              <div className="bg-light px-3 py-2 mb-3 mt-2">
                <h6 className="fw-bold mb-0">Account Credentials</h6>
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
                        onChange={(e) => { formik.handleChange(e); checkUsername(e.target.value); }}
                        onBlur={formik.handleBlur}
                      />
                      <span className="input-group-text">
                        {usernameStatus === "checking" && <span className="spinner-border spinner-border-sm text-secondary" role="status" />}
                        {usernameStatus === "available" && <i className="ti ti-circle-check text-success" />}
                        {usernameStatus === "taken" && <i className="ti ti-circle-x text-danger" />}
                        {usernameStatus === "idle" && <i className="ti ti-at text-muted" />}
                      </span>
                      {formik.touched.username && formik.errors.username && (
                        <div className="invalid-feedback">{String(formik.errors.username)}</div>
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
                <div className="col-md-6">{textField("email", "Email Address", "email")}</div>
                <div className="col-md-6">{textField("password", "Password", "password", true)}</div>
                <div className="col-md-6">{textField("confirmPassword", "Confirm Password", "password", true)}</div>
              </div>

              {/* Personal Information */}
              <div className="bg-light px-3 py-2 mb-3 mt-2">
                <h6 className="fw-bold mb-0">Personal Information</h6>
              </div>
              <div className="row">
                <div className="col-md-6">{textField("firstName", "First Name", "text", true)}</div>
                <div className="col-md-6">{textField("lastName", "Last Name", "text", true)}</div>
                <div className="col-md-6">
                  <div className="mb-3">
                    <label className="form-label fw-medium">Contact Number</label>
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
                <div className="col-md-8">{textField("address", "Address")}</div>

                <div className="col-md-4">
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

              <div className="d-flex gap-2 justify-content-end mt-2">
                <Link href={all_routes.manageParents} className="btn btn-light border">
                  Cancel
                </Link>
                <button
                  type="submit"
                  className="btn btn-primary d-inline-flex align-items-center gap-2"
                  disabled={saving || usernameStatus === "taken" || usernameStatus === "checking"}
                >
                  {saving && (
                    <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
                  )}
                  {saving ? "Creating..." : "Create Parent"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ParentCreateForm;
