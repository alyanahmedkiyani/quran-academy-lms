"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useFormik } from "formik";
import * as Yup from "yup";
import { all_routes } from "@/routes/all_routes";
import { useAppDispatch, useAppSelector } from "@/core/redux/hooks";
import { createStudentThunk, resetStudentSaveStatus } from "@/core/redux/studentSlice";
import { fetchPlans } from "@/services/studentService";
import { Plan } from "@/types/student";
import { Teacher } from "@/types/teacher";
import { fetchAllTeachers } from "@/services/teacherService";
import { Course } from "@/types/course";
import { fetchAllCourses } from "@/services/courseService";
import { isAdminAuthorityRole, getDashboardRouteForRole } from "@/lib/roles";
import { useNotification } from "@/hooks/useNotification";
import CommonSelect, { Option as SelectOption } from "@/core/common/common-select/commonSelect";
import PhoneCountryInput from "@/components/shared/PhoneCountryInput";
import { phoneYupValidator } from "@/lib/phoneCountries";
import { api_base_url, withAuthorization } from "@/services/apiClient";
import { COUNTRIES } from "@/lib/countries";

const TIMEZONE_OPTIONS = [
  { value: "Asia/Karachi",        label: "Pakistan (PKT, UTC+5)" },
  { value: "Asia/Dubai",          label: "Dubai / UAE (GST, UTC+4)" },
  { value: "Asia/Kolkata",        label: "India (IST, UTC+5:30)" },
  { value: "Asia/Dhaka",          label: "Bangladesh (BST, UTC+6)" },
  { value: "Asia/Singapore",      label: "Singapore (SGT, UTC+8)" },
  { value: "Asia/Shanghai",       label: "China (CST, UTC+8)" },
  { value: "Asia/Tokyo",          label: "Japan (JST, UTC+9)" },
  { value: "Asia/Seoul",          label: "South Korea (KST, UTC+9)" },
  { value: "Pacific/Auckland",    label: "New Zealand (NZST, UTC+12/13)" },
  { value: "Australia/Sydney",    label: "Australia - Sydney (AEST, UTC+10/11)" },
  { value: "Europe/London",       label: "UK (GMT/BST, UTC+0/1)" },
  { value: "Europe/Paris",        label: "France / CET (UTC+1/2)" },
  { value: "Europe/Berlin",       label: "Germany / CET (UTC+1/2)" },
  { value: "Europe/Moscow",       label: "Russia - Moscow (MSK, UTC+3)" },
  { value: "Africa/Cairo",        label: "Egypt (EET, UTC+2)" },
  { value: "America/New_York",    label: "USA - New York (EST/EDT, UTC-5/-4)" },
  { value: "America/Chicago",     label: "USA - Chicago (CST/CDT, UTC-6/-5)" },
  { value: "America/Denver",      label: "USA - Denver (MST/MDT, UTC-7/-6)" },
  { value: "America/Los_Angeles", label: "USA - Los Angeles (PST/PDT, UTC-8/-7)" },
  { value: "America/Toronto",     label: "Canada - Toronto (EST/EDT, UTC-5/-4)" },
  { value: "America/Sao_Paulo",   label: "Brazil (BRT, UTC-3)" },
  { value: "UTC",                 label: "UTC (UTC+0)" },
];

const STEPS = [
  { number: 1, title: "Student Information", subtitle: "Personal details" },
  { number: 2, title: "Additional Details", subtitle: "Teacher, schedule & notes" },
  { number: 3, title: "Course & Plan", subtitle: "Select course and plan" },
];

const STEP1_FIELDS = [
  "username",
  "password",
  "confirmPassword",
  "firstName",
  "lastName",
  "email",
  "contact",
  "address",
  "countryName",
  "state",
  "city",
] as const;

const STEP3_FIELDS = ["courseId", "planId"] as const;

const formatDate = (d: Date) =>
  d.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });

const usePlans = () => {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetchPlans()
      .then((res) => setPlans(res.plans ?? []))
      .catch((err) => setError(err?.message ?? "Failed to load plans"))
      .finally(() => setLoading(false));
  }, []);

  return { plans, loading, error };
};

const validationSchema = Yup.object({
  firstName: Yup.string().trim().required("First name is required"),
  lastName: Yup.string().trim(),
  username: Yup.string().trim().min(3, "Username must be at least 3 characters").required("Username is required"),
  email: Yup.string().trim().email("Enter a valid email address").required("Email is required"),
  contact: Yup.string().trim().test("phone", "", phoneYupValidator),
  courseId: Yup.string().required("Please select a course"),
  planId: Yup.string().required("Please select a plan"),
  password: Yup.string().trim().min(6, "Password must be at least 6 characters").required("Password is required"),
  confirmPassword: Yup.string()
    .required("Please confirm the password")
    .oneOf([Yup.ref("password")], "Passwords must match"),
  address: Yup.string().trim(),
  countryName: Yup.string().trim().required("Country is required"),
  state: Yup.string().trim(),
  city: Yup.string().trim().required("City is required"),
  timeZone: Yup.string().trim(),
  classTime: Yup.string().trim(),
  newClassTime: Yup.string().trim(),
  nameForTeacher: Yup.string().trim(),
});

const StudentCreateForm = () => {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const notify = useNotification();
  const user = useAppSelector((state) => state.auth.user);
  const { saveStatus, saveError } = useAppSelector((state) => state.students);
  const saving = saveStatus === "loading";

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const enrollmentDate = useMemo(() => new Date(), []);

  // Password visibility toggles
  const [showPassword, setShowPassword]               = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

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

  const { plans, loading: plansLoading, error: plansError } = usePlans();

  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [teachersLoading, setTeachersLoading] = useState(false);
  const [courses, setCourses] = useState<Course[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(false);
  useEffect(() => {
    setTeachersLoading(true);
    fetchAllTeachers()
      .then((res) => setTeachers(res.teachers ?? []))
      .catch(() => {})
      .finally(() => setTeachersLoading(false));
    setCoursesLoading(true);
    fetchAllCourses()
      .then((res) => setCourses(res.courses ?? []))
      .catch(() => {})
      .finally(() => setCoursesLoading(false));
  }, []);

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

  useEffect(() => {
    if (plansError) notify.warning(plansError);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plansError]);

  // Cleanup save status on unmount
  useEffect(() => {
    return () => {
      dispatch(resetStudentSaveStatus());
    };
  }, [dispatch]);

  const formik = useFormik({
    initialValues: {
      firstName: "",
      lastName: "",
      username: "",
      email: "",
      contact: "",
      planId: "",
      password: "",
      confirmPassword: "",
      address: "",
      countryName: "",
      state: "",
      city: "",
      timeZone: "",
      classTime: "",
      newClassTime: "",
      nameForTeacher: "",
      teacherId: "",
      courseId: "",
      shift: "" as "Morning" | "Afternoon" | "Evening" | "",
      enrollmentChannel: "" as "Meta" | "Google" | "TikTok" | "SEO" | "Email" | "Reference" | "",
      referenceDetails: "",
      studentLabel: "" as "Unassigned" | "Trial" | "New Enrollment" | "Lost" | "Struck off" | "",
      struckOffReason: "",
      note: "",
    },
    validationSchema,
    onSubmit: async (values) => {
      try {
        await dispatch(
          createStudentThunk({
            firstName: values.firstName.trim(),
            lastName: values.lastName.trim(),
            username: values.username.trim(),
            email: values.email.trim() || undefined,
            contact: values.contact.trim() || undefined,
            planId: values.planId,
            password: values.password.trim(),
            address: values.address.trim() || undefined,
            countryName: values.countryName.trim() || undefined,
            state: values.state.trim() || undefined,
            city: values.city.trim() || undefined,
            timeZone: values.timeZone.trim() || undefined,
            classTime: values.classTime || undefined,
            newClassTime: values.newClassTime || undefined,
            nameForTeacher: values.nameForTeacher.trim() || undefined,
            teacherId: values.teacherId || undefined,
            courseId: values.courseId || undefined,
            shift: (values.shift as "Morning" | "Afternoon" | "Evening") || null,
            enrollmentChannel: (values.enrollmentChannel as "Meta" | "Google" | "TikTok" | "SEO" | "Email" | "Reference") || null,
            referenceDetails: values.enrollmentChannel === "Reference" ? values.referenceDetails || undefined : undefined,
            studentLabel: (values.studentLabel as "Unassigned" | "Trial" | "New Enrollment" | "Lost" | "Struck off") || null,
            struckOffReason: values.studentLabel === "Struck off" ? values.struckOffReason || undefined : undefined,
            note: values.note.trim() || undefined,
          })
        ).unwrap();
        notify.success("Student account created successfully");
        router.push(all_routes.manageStudents);
      } catch {
        // error shown via saveError useEffect
      }
    },
  });

  const validateStep = async (fields: readonly string[]) => {
    const errors = await formik.validateForm();
    const touchedUpdates: Record<string, boolean> = {};
    fields.forEach((f) => { touchedUpdates[f] = true; });
    formik.setTouched({ ...formik.touched, ...touchedUpdates }, false);
    return fields.every((f) => !(errors as Record<string, unknown>)[f]);
  };

  const goToStep2 = async () => {
    if (usernameStatus === "taken" || usernameStatus === "checking") return;
    const ok = await validateStep(STEP1_FIELDS);
    if (ok) { setStep(2); window.scrollTo({ top: 0, behavior: "smooth" }); }
  };

  const goToStep3 = () => { setStep(3); window.scrollTo({ top: 0, behavior: "smooth" }); };

  const goToStep4 = async () => {
    const ok = await validateStep(STEP3_FIELDS);
    if (ok) { setStep(4); window.scrollTo({ top: 0, behavior: "smooth" }); }
  };

  const goBack = () => { setStep((s) => (s > 1 ? ((s - 1) as 1 | 2 | 3) : s)); window.scrollTo({ top: 0, behavior: "smooth" }); };

  const selectedCourse = courses.find((c) => String(c.id) === formik.values.courseId) || null;
  const selectedPlan = plans.find((p) => String(p.id) === formik.values.planId) || null;
  const selectedTeacher = teachers.find((t) => String(t.id) === formik.values.teacherId) || null;
  const fullName = `${formik.values.firstName} ${formik.values.lastName}`.trim();

  const planDuration = (plan: Plan | null) => {
    if (!plan) return "—";
    const name = (plan.name || "").toLowerCase();
    if (name.includes("week")) return "Weekly";
    if (name.includes("month")) return "Monthly";
    return plan.description || "—";
  };

  const textField = (
    name: keyof typeof formik.values,
    label: string,
    type = "text",
    required = false,
    placeholder?: string
  ) => (
    <div className="mb-3">
      <label className="form-label fw-medium">
        {label} {required && <span className="text-danger">*</span>}
      </label>
      <input
        type={type}
        className={`form-control wiz-input${
          formik.touched[name] && formik.errors[name] ? " is-invalid" : ""
        }`}
        name={name}
        placeholder={placeholder}
        value={formik.values[name]}
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

  const summaryRow = (icon: string, label: string, value: string) => (
    <div className="wiz-summary-row">
      <span className="wiz-summary-row__icon"><i className={`ti ${icon}`} /></span>
      <span className="wiz-summary-row__label">{label}</span>
      <span className="wiz-summary-row__value">{value}</span>
    </div>
  );

  const reviewRow = (label: string, value: string) => (
    <div className="wiz-review-row">
      <span className="wiz-review-row__label">{label}</span>
      <span className="wiz-review-row__value">{value}</span>
    </div>
  );

  const combinedAddress = [formik.values.address, formik.values.city, formik.values.state, formik.values.countryName]
    .map((v) => v.trim())
    .filter(Boolean)
    .join(", ") || "—";

  return (
    <div className="page-wrapper">
      <style
        dangerouslySetInnerHTML={{
          __html: `
        .wiz-back-btn {
          border: 1px solid #e4e6f5; background: #fff; color: #2E37A4; font-weight: 600;
          border-radius: 10px; padding: 8px 16px; font-size: 13px; display: inline-flex;
          align-items: center; gap: 8px; transition: background 0.15s ease, border-color 0.15s ease;
        }
        .wiz-back-btn:hover { background: #f5f6ff; border-color: #c9cdf2; color: #2E37A4; }
        .wiz-title { font-size: 28px; font-weight: 800; color: #101828; margin: 20px 0 4px; }
        .wiz-subtitle { color: #667085; font-size: 14px; margin-bottom: 28px; }

        .wiz-stepper { display: flex; align-items: flex-start; margin-bottom: 28px; }
        .wiz-step { display: flex; align-items: center; gap: 12px; flex-shrink: 0; }
        .wiz-step__circle {
          width: 40px; height: 40px; border-radius: 50%; display: inline-flex; align-items: center;
          justify-content: center; font-weight: 700; font-size: 15px; flex-shrink: 0; transition: all 0.2s ease;
        }
        .wiz-step__circle--done { background: #2E37A4; color: #fff; }
        .wiz-step__circle--active { background: #2E37A4; color: #fff; box-shadow: 0 0 0 4px rgba(46,55,164,0.15); }
        .wiz-step__circle--pending { background: #fff; color: #98a2b3; border: 2px solid #e4e6ef; }
        .wiz-step__text { display: flex; flex-direction: column; line-height: 1.25; }
        .wiz-step__title { font-size: 14px; font-weight: 700; }
        .wiz-step__title--muted { color: #98a2b3; }
        .wiz-step__title--active { color: #2E37A4; }
        .wiz-step__subtitle { font-size: 12px; color: #98a2b3; }
        .wiz-connector { flex: 1; height: 2px; background: #e4e6ef; margin: 19px 16px 0; transition: background 0.2s ease; }
        .wiz-connector--done { background: #2E37A4; }

        .wiz-card { background: #fff; border: 1px solid #f0f1f6; border-radius: 18px; padding: 28px; box-shadow: 0 2px 10px rgba(16,24,40,0.04); }
        .wiz-card__title { font-size: 18px; font-weight: 800; color: #101828; margin-bottom: 2px; }
        .wiz-card__subtitle { font-size: 13px; color: #98a2b3; margin-bottom: 22px; }

        .wiz-input, .wiz-select { border-radius: 10px !important; border: 1.5px solid #e4e6ef !important; padding: 10px 14px !important; font-size: 14px; }
        .wiz-input:focus, .wiz-select:focus { border-color: #2E37A4 !important; box-shadow: 0 0 0 3px rgba(46,55,164,0.1) !important; }
        .wiz-input::placeholder { color: #98a2b3; }

        .wiz-sidebar { background: #fff; border: 1px solid #f0f1f6; border-radius: 18px; padding: 24px; }
        .wiz-sidebar__title { font-size: 16px; font-weight: 800; color: #101828; margin-bottom: 20px; }
        .wiz-sidebar__avatar { width: 84px; height: 84px; border-radius: 50%; background: #EEF0FC; color: #2E37A4; display: flex; align-items: center; justify-content: center; font-size: 34px; margin: 0 auto 22px; }
        .wiz-summary-row { display: flex; align-items: center; gap: 10px; padding: 11px 0; border-bottom: 1px solid #f4f4f9; }
        .wiz-summary-row:last-child { border-bottom: none; }
        .wiz-summary-row__icon { color: #98a2b3; font-size: 15px; width: 18px; flex-shrink: 0; }
        .wiz-summary-row__label { font-size: 13px; color: #667085; flex: 1; }
        .wiz-summary-row__value { font-size: 13px; font-weight: 600; color: #101828; max-width: 50%; text-align: right; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .wiz-note-box { background: #F5F6FF; border: 1px solid #e4e6f5; border-radius: 12px; padding: 14px; margin-top: 18px; display: flex; gap: 10px; }
        .wiz-note-box i { color: #2E37A4; margin-top: 2px; }
        .wiz-note-box__title { font-size: 13px; font-weight: 700; color: #2E37A4; }
        .wiz-note-box__text { font-size: 12px; color: #667085; margin-top: 2px; }

        .wiz-course-box { border: 1.5px solid #e4e6ef; border-radius: 12px; padding: 4px 8px; display: flex; align-items: center; gap: 12px; }
        .wiz-course-box__icon { width: 40px; height: 40px; border-radius: 10px; background: #EEF0FC; color: #2E37A4; display: flex; align-items: center; justify-content: center; font-size: 17px; flex-shrink: 0; }
        .wiz-course-box .ant-select-selector { border: none !important; box-shadow: none !important; padding-left: 0 !important; }
        .wiz-course-desc { font-size: 12px; color: #98a2b3; margin-top: 6px; margin-left: 4px; }

        .wiz-plan-card {
          border: 1.5px solid #e4e6ef; border-radius: 12px; padding: 14px 16px; display: flex;
          align-items: center; justify-content: space-between; gap: 12px; cursor: pointer;
          transition: border-color 0.15s ease, background 0.15s ease; margin-bottom: 12px;
        }
        .wiz-plan-card:last-child { margin-bottom: 0; }
        .wiz-plan-card--selected { border-color: #2E37A4; background: #F5F6FF; }
        .wiz-plan-card__radio { width: 18px; height: 18px; border-radius: 50%; border: 2px solid #cbd0e6; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; }
        .wiz-plan-card--selected .wiz-plan-card__radio { border-color: #2E37A4; }
        .wiz-plan-card__radio-dot { width: 9px; height: 9px; border-radius: 50%; background: #2E37A4; }
        .wiz-plan-card__title { font-weight: 700; font-size: 14px; color: #101828; }
        .wiz-plan-card__subtitle { font-size: 12px; color: #98a2b3; margin-top: 1px; }
        .wiz-plan-card__price { font-weight: 700; font-size: 14px; color: #101828; white-space: nowrap; }

        .wiz-section-label { font-size: 14px; font-weight: 700; color: #101828; margin: 24px 0 14px; }
        .wiz-section-label:first-child { margin-top: 0; }

        .wiz-review-heading { margin-bottom: 16px; }
        .wiz-review-heading h3 { font-size: 20px; font-weight: 800; color: #101828; margin-bottom: 2px; }
        .wiz-review-heading p { font-size: 13px; color: #98a2b3; margin: 0; }
        .wiz-review-card { background: #fff; border: 1px solid #f0f1f6; border-radius: 16px; padding: 18px 20px; }
        .wiz-review-card__header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; padding-bottom: 10px; border-bottom: 1px solid #f4f4f9; }
        .wiz-review-card__title { font-size: 14px; font-weight: 800; color: #101828; }
        .wiz-review-card__edit { font-size: 12px; font-weight: 600; color: #2E37A4; border: none; background: none; display: inline-flex; align-items: center; gap: 4px; }
        .wiz-review-row { display: flex; align-items: baseline; gap: 6px; padding: 6px 0; font-size: 13px; }
        .wiz-review-row__label { color: #98a2b3; flex-shrink: 0; }
        .wiz-review-row__value { color: #101828; font-weight: 600; overflow-wrap: anywhere; }

        .wiz-ready-card { text-align: center; padding: 8px 4px; }
        .wiz-ready-icon { width: 64px; height: 64px; border-radius: 50%; background: #E7F8EF; color: #27AE60; display: flex; align-items: center; justify-content: center; font-size: 30px; margin: 0 auto 16px; }
        .wiz-ready-title { font-size: 16px; font-weight: 800; color: #101828; margin-bottom: 6px; }
        .wiz-ready-text { font-size: 12px; color: #667085; margin-bottom: 18px; }

        .wiz-btn-primary {
          background: linear-gradient(135deg, #2E37A4, #4149c9); border: none; color: #fff; font-weight: 700;
          border-radius: 10px; padding: 11px 22px; font-size: 14px; display: inline-flex; align-items: center;
          justify-content: center; gap: 8px; width: 100%; transition: opacity 0.15s ease;
        }
        .wiz-btn-primary:hover { opacity: 0.92; color: #fff; }
        .wiz-btn-primary:disabled { opacity: 0.6; }
        .wiz-btn-outline {
          border: 1.5px solid #e4e6ef; background: #fff; color: #344054; font-weight: 600;
          border-radius: 10px; padding: 10px 20px; font-size: 14px; display: inline-flex; align-items: center; gap: 8px;
        }
        .wiz-btn-outline:hover { background: #f8f9fc; color: #344054; }
      `,
        }}
      />

      <div className="content">
        <Link href={all_routes.manageStudents} className="wiz-back-btn">
          <i className="ti ti-arrow-left" />
          Back to Students
        </Link>

        <h2 className="wiz-title">Add New Student</h2>
        <p className="wiz-subtitle">Create a new student account in 3 simple steps</p>

        {/* Stepper */}
        <div className="wiz-stepper">
          {STEPS.map((s, idx) => (
            <div key={s.number} style={{ display: "flex", alignItems: "center", flex: idx < STEPS.length - 1 ? 1 : "0 0 auto" }}>
              <div className="wiz-step">
                <span
                  className={`wiz-step__circle ${
                    step > s.number ? "wiz-step__circle--done" : step === s.number ? "wiz-step__circle--active" : "wiz-step__circle--pending"
                  }`}
                >
                  {step > s.number ? <i className="ti ti-check" /> : s.number}
                </span>
                <span className="wiz-step__text">
                  <span
                    className={`wiz-step__title ${
                      step >= s.number ? "wiz-step__title--active" : "wiz-step__title--muted"
                    }`}
                  >
                    {s.title}
                  </span>
                  <span className="wiz-step__subtitle">{s.subtitle}</span>
                </span>
              </div>
              {idx < STEPS.length - 1 && <div className={`wiz-connector ${step > s.number ? "wiz-connector--done" : ""}`} />}
            </div>
          ))}
        </div>

        <form onSubmit={formik.handleSubmit} noValidate>
          {step !== 4 && (
          <div className="row g-3">
            {/* ───────── Main column ───────── */}
            <div className="col-lg-8">
              {step === 1 && (
                <div className="wiz-card">
                  <div className="wiz-card__title">Student Information</div>
                  <div className="wiz-card__subtitle">Enter the student&apos;s personal details</div>

                  <div className="row">
                    <div className="col-md-6">{textField("firstName", "First Name", "text", true, "Enter first name")}</div>
                    <div className="col-md-6">{textField("lastName", "Last Name", "text", false, "Enter last name")}</div>

                    <div className="col-md-6">
                      <div className="mb-3">
                        <label className="form-label fw-medium">Username <span className="text-danger">*</span></label>
                        <div className="input-group">
                          <input
                            type="text"
                            className={`form-control wiz-input${formik.touched.username && formik.errors.username ? " is-invalid" : usernameStatus === "taken" ? " is-invalid" : usernameStatus === "available" ? " is-valid" : ""}`}
                            name="username"
                            placeholder="Choose a username"
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
                        </div>
                        {formik.touched.username && formik.errors.username && (
                          <div className="text-danger fs-12 mt-1">{formik.errors.username}</div>
                        )}
                        {!formik.errors.username && usernameStatus === "taken" && (
                          <div className="text-danger fs-12 mt-1">Username is already taken.</div>
                        )}
                        {usernameStatus === "available" && (
                          <div className="text-success fs-12 mt-1"><i className="ti ti-check me-1" />Username is available</div>
                        )}
                      </div>
                    </div>
                    <div className="col-md-6">{textField("email", "Email Address", "email", true, "Enter email address")}</div>

                    <div className="col-md-6">
                      <div className="mb-3">
                        <label className="form-label fw-medium">Password <span className="text-danger">*</span></label>
                        <div className="input-group">
                          <input
                            type={showPassword ? "text" : "password"}
                            className={`form-control wiz-input${formik.touched.password && formik.errors.password ? " is-invalid" : ""}`}
                            name="password"
                            placeholder="Create a password"
                            value={formik.values.password}
                            onChange={formik.handleChange}
                            onBlur={formik.handleBlur}
                            autoComplete="new-password"
                            disabled={saving}
                          />
                          <button type="button" className="input-group-text" onClick={() => setShowPassword((v) => !v)} tabIndex={-1}>
                            <i className={`ti ${showPassword ? "ti-eye-off" : "ti-eye"}`} />
                          </button>
                        </div>
                        {formik.touched.password && formik.errors.password && (
                          <div className="text-danger fs-12 mt-1">{formik.errors.password}</div>
                        )}
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="mb-3">
                        <label className="form-label fw-medium">Confirm Password <span className="text-danger">*</span></label>
                        <div className="input-group">
                          <input
                            type={showConfirmPassword ? "text" : "password"}
                            className={`form-control wiz-input${formik.touched.confirmPassword && formik.errors.confirmPassword ? " is-invalid" : ""}`}
                            name="confirmPassword"
                            placeholder="Re-enter password"
                            value={formik.values.confirmPassword}
                            onChange={formik.handleChange}
                            onBlur={formik.handleBlur}
                            autoComplete="new-password"
                            disabled={saving}
                          />
                          <button type="button" className="input-group-text" onClick={() => setShowConfirmPassword((v) => !v)} tabIndex={-1}>
                            <i className={`ti ${showConfirmPassword ? "ti-eye-off" : "ti-eye"}`} />
                          </button>
                        </div>
                        {formik.touched.confirmPassword && formik.errors.confirmPassword && (
                          <div className="text-danger fs-12 mt-1">{formik.errors.confirmPassword}</div>
                        )}
                      </div>
                    </div>

                    <div className="col-md-6">
                      <div className="mb-3">
                        <label className="form-label fw-medium">Phone Number</label>
                        <PhoneCountryInput
                          value={formik.values.contact}
                          onChange={(val) => formik.setFieldValue("contact", val)}
                          onBlur={() => formik.setFieldTouched("contact", true)}
                          disabled={saving}
                          isInvalid={!!(formik.touched.contact && formik.errors.contact)}
                        />
                        {formik.touched.contact && formik.errors.contact && (
                          <div className="text-danger fs-12 mt-1">{formik.errors.contact}</div>
                        )}
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="mb-3">
                        <label className="form-label fw-medium">Country <span className="text-danger">*</span></label>
                        <select
                          className={`form-select wiz-select${formik.touched.countryName && formik.errors.countryName ? " is-invalid" : ""}`}
                          name="countryName"
                          value={formik.values.countryName}
                          onChange={formik.handleChange}
                          onBlur={formik.handleBlur}
                          disabled={saving}
                        >
                          <option value="">Select country</option>
                          {COUNTRIES.map((c) => (
                            <option key={c.iso3} value={c.name}>{c.name}</option>
                          ))}
                        </select>
                        {formik.touched.countryName && formik.errors.countryName && (
                          <div className="invalid-feedback">{String(formik.errors.countryName)}</div>
                        )}
                      </div>
                    </div>

                    <div className="col-12">{textField("address", "Address", "text", false, "Enter street address")}</div>

                    <div className="col-md-6">{textField("state", "State / Province", "text", false, "Enter state")}</div>
                    <div className="col-md-6">{textField("city", "City", "text", true, "Enter city")}</div>
                  </div>

                  <div className="d-flex justify-content-end mt-2">
                    <button type="button" className="btn wiz-btn-primary" style={{ width: "auto" }} onClick={goToStep2} disabled={saving}>
                      Continue <i className="ti ti-arrow-right" />
                    </button>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="wiz-card">
                  <div className="wiz-card__title">Additional Details</div>
                  <div className="wiz-card__subtitle">Optional information about this enrollment.</div>
                  <div className="row">
                    <div className="col-md-6">
                      <div className="mb-3">
                        <label className="form-label fw-medium">Assign Teacher</label>
                        <CommonSelect
                          options={[
                            { value: "", label: "— No teacher assigned —" },
                            ...teachers.map((t): SelectOption => ({ value: String(t.id), label: `${t.firstName} ${t.lastName}` })),
                          ]}
                          value={selectedTeacher ? { value: String(selectedTeacher.id), label: `${selectedTeacher.firstName} ${selectedTeacher.lastName}` } : { value: "", label: "— No teacher assigned —" }}
                          onChange={(opt) => formik.setFieldValue("teacherId", opt ? opt.value : "")}
                          placeholder={teachersLoading ? "Loading teachers..." : "Select a teacher"}
                          isDisabled={saving || teachersLoading}
                        />
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="mb-3">
                        <label className="form-label fw-medium">Enrollment Channel</label>
                        <select className="form-select wiz-select" name="enrollmentChannel" value={formik.values.enrollmentChannel} onChange={formik.handleChange} disabled={saving}>
                          <option value="">— Not specified —</option>
                          <option value="Meta">Meta</option>
                          <option value="Google">Google</option>
                          <option value="TikTok">TikTok</option>
                          <option value="SEO">SEO</option>
                          <option value="Email">Email</option>
                          <option value="Reference">Reference</option>
                        </select>
                      </div>
                    </div>
                    {formik.values.enrollmentChannel === "Reference" && (
                      <div className="col-md-6">
                        <div className="mb-3">
                          <label className="form-label fw-medium">Reference Details</label>
                          <textarea className="form-control wiz-input" name="referenceDetails" rows={2} placeholder="Add description or additional info..." value={formik.values.referenceDetails} onChange={formik.handleChange} disabled={saving} />
                        </div>
                      </div>
                    )}
                    <div className="col-md-6">
                      <div className="mb-3">
                        <label className="form-label fw-medium">Student Label</label>
                        <select className="form-select wiz-select" name="studentLabel" value={formik.values.studentLabel} onChange={formik.handleChange} disabled={saving}>
                          <option value="">— Not specified —</option>
                          <option value="Unassigned">Unassigned</option>
                          <option value="Trial">Trial</option>
                          <option value="New Enrollment">New Enrollment</option>
                          <option value="Lost">Lost</option>
                          <option value="Struck off">Struck off</option>
                        </select>
                      </div>
                    </div>
                    {formik.values.studentLabel === "Struck off" && (
                      <div className="col-md-6">
                        <div className="mb-3">
                          <label className="form-label fw-medium">Struck Off Reason</label>
                          <textarea className="form-control wiz-input" name="struckOffReason" rows={2} placeholder="Provide a reason..." value={formik.values.struckOffReason} onChange={formik.handleChange} disabled={saving} />
                        </div>
                      </div>
                    )}
                    <div className="col-md-3">
                      <div className="mb-3">
                        <label className="form-label fw-medium">Time Zone</label>
                        <select className="form-select wiz-select" name="timeZone" value={formik.values.timeZone} onChange={formik.handleChange} disabled={saving}>
                          <option value="">— Default (PKT) —</option>
                          {TIMEZONE_OPTIONS.map((tz) => (
                            <option key={tz.value} value={tz.value}>{tz.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="col-md-3">{textField("classTime", "Class Time", "time")}</div>
                    <div className="col-md-3">{textField("newClassTime", "New Class Time (Summer)", "time")}</div>
                    <div className="col-md-3">
                      <div className="mb-3">
                        <label className="form-label fw-medium">Shift</label>
                        <select className="form-select wiz-select" name="shift" value={formik.values.shift} onChange={formik.handleChange} disabled={saving}>
                          <option value="">Not assigned</option>
                          <option value="Morning">☀️ Morning (6am–12pm)</option>
                          <option value="Afternoon">🌤️ Afternoon (12pm–6pm)</option>
                          <option value="Evening">🌙 Evening (6pm–12am)</option>
                        </select>
                      </div>
                    </div>
                    <div className="col-12">
                      <div className="mb-1">
                        <label className="form-label fw-medium">Note <span className="text-muted fw-normal fs-12">(optional)</span></label>
                        <textarea className="form-control wiz-input" name="note" rows={3} placeholder="Any internal notes about this student..." value={formik.values.note} onChange={formik.handleChange} disabled={saving} />
                      </div>
                    </div>
                  </div>

                  <div className="d-flex justify-content-between mt-2">
                    <button type="button" className="btn wiz-btn-outline" onClick={goBack} disabled={saving}>
                      <i className="ti ti-arrow-left" /> Back
                    </button>
                    <button type="button" className="btn wiz-btn-primary" style={{ width: "auto" }} onClick={goToStep3} disabled={saving}>
                      Continue <i className="ti ti-arrow-right" />
                    </button>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="wiz-card">
                  <div className="wiz-card__title">Select Course &amp; Plan</div>
                  <div className="wiz-card__subtitle">Choose the course and subscription plan for this student.</div>

                  <div className="row">
                    <div className="col-md-6">
                      <label className="form-label fw-medium">Course <span className="text-danger">*</span></label>
                      <div className="wiz-course-box">
                        <span className="wiz-course-box__icon"><i className="ti ti-book-2" /></span>
                        <div className="flex-grow-1">
                          <CommonSelect
                            options={courses.map((c): SelectOption => ({ value: String(c.id), label: c.courseName }))}
                            value={selectedCourse ? { value: String(selectedCourse.id), label: selectedCourse.courseName } : null}
                            onChange={(opt) => { formik.setFieldValue("courseId", opt ? opt.value : ""); formik.setFieldTouched("courseId", true); }}
                            placeholder={coursesLoading ? "Loading courses..." : "Select a course"}
                            isDisabled={saving || coursesLoading}
                          />
                        </div>
                      </div>
                      {formik.touched.courseId && formik.errors.courseId && (
                        <div className="text-danger fs-12 mt-1">{formik.errors.courseId}</div>
                      )}
                      {selectedCourse?.description && (
                        <div className="wiz-course-desc">{selectedCourse.description}</div>
                      )}
                    </div>
                  </div>

                  <label className="form-label fw-medium mt-3">Subscription Plan <span className="text-danger">*</span></label>
                  {plansLoading ? (
                    <div className="text-muted fs-13">Loading plans...</div>
                  ) : (
                    plans.map((plan) => {
                      const isSelected = formik.values.planId === String(plan.id);
                      return (
                        <div
                          key={plan.id}
                          className={`wiz-plan-card${isSelected ? " wiz-plan-card--selected" : ""}`}
                          onClick={() => { formik.setFieldValue("planId", String(plan.id)); formik.setFieldTouched("planId", true); }}
                        >
                          <div className="d-flex align-items-center gap-3">
                            <span className="wiz-plan-card__radio">{isSelected && <span className="wiz-plan-card__radio-dot" />}</span>
                            <div>
                              <div className="wiz-plan-card__title">{plan.name}</div>
                              {plan.description && <div className="wiz-plan-card__subtitle">{plan.description}</div>}
                            </div>
                          </div>
                          <div className="wiz-plan-card__price">{plan.price != null ? `$${plan.price} / Month` : "—"}</div>
                        </div>
                      );
                    })
                  )}
                  {formik.touched.planId && formik.errors.planId && (
                    <div className="text-danger fs-12 mt-2">{formik.errors.planId}</div>
                  )}

                  <div className="d-flex justify-content-between mt-4">
                    <button type="button" className="btn wiz-btn-outline" onClick={goBack} disabled={saving}>
                      <i className="ti ti-arrow-left" /> Back
                    </button>
                    <button type="button" className="btn wiz-btn-primary" style={{ width: "auto" }} onClick={goToStep4} disabled={saving}>
                      Continue <i className="ti ti-arrow-right" />
                    </button>
                  </div>
                </div>
              )}

            </div>

            {/* ───────── Sidebar column ───────── */}
            <div className="col-lg-4">
              {step === 1 && (
                <div className="wiz-sidebar">
                  <div className="wiz-sidebar__title">Enrollment Summary</div>
                  <div className="wiz-sidebar__avatar"><i className="ti ti-user" /></div>
                  {summaryRow("ti-user", "Student Name", fullName || "—")}
                  {summaryRow("ti-book", "Course", "—")}
                  {summaryRow("ti-clipboard-list", "Plan", "—")}
                  {summaryRow("ti-user-check", "Assigned Teacher", "—")}
                  {summaryRow("ti-clock", "Class Time", "—")}
                  {summaryRow("ti-calendar", "Enrollment Date", formatDate(enrollmentDate))}
                  <div className="wiz-note-box">
                    <i className="ti ti-info-circle" />
                    <div>
                      <div className="wiz-note-box__title">Note</div>
                      <div className="wiz-note-box__text">You can review all details before creating the student account.</div>
                    </div>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="wiz-sidebar">
                  <div className="wiz-sidebar__title">Schedule Summary</div>
                  {summaryRow("ti-user-check", "Assigned Teacher", selectedTeacher ? `${selectedTeacher.firstName} ${selectedTeacher.lastName}` : "—")}
                  {summaryRow("ti-sun", "Shift", formik.values.shift || "—")}
                  {summaryRow("ti-world", "Time Zone", formik.values.timeZone || "—")}
                  {summaryRow("ti-clock", "Class Time", formik.values.classTime || "—")}
                  {summaryRow("ti-clock-hour-4", "New Class Time (Summer)", formik.values.newClassTime || "—")}
                </div>
              )}

              {step === 3 && (
                <div className="wiz-sidebar">
                  <div className="wiz-sidebar__title">Plan Details</div>
                  {summaryRow("ti-book", "Course", selectedCourse?.courseName || "—")}
                  {summaryRow("ti-clipboard-list", "Plan", selectedPlan?.name || "—")}
                  {summaryRow("ti-hourglass", "Duration", planDuration(selectedPlan))}
                  {summaryRow("ti-currency-dollar", "Price", selectedPlan?.price != null ? `$${selectedPlan.price} / Month` : "—")}
                </div>
              )}
            </div>
          </div>
          )}

          {step === 4 && (
            <>
              <div className="wiz-review-heading">
                <h3>Review Student Information</h3>
                <p>Please review all details before creating the student account.</p>
              </div>
              <div className="row g-3">
                <div className="col-xl-3 col-md-6">
                  <div className="wiz-review-card h-100">
                    <div className="wiz-review-card__header">
                      <span className="wiz-review-card__title">Personal Information</span>
                      <button type="button" className="wiz-review-card__edit" onClick={() => setStep(1)}>
                        <i className="ti ti-edit" /> Edit
                      </button>
                    </div>
                    {reviewRow("Name", fullName || "—")}
                    {reviewRow("Email", formik.values.email || "—")}
                    {reviewRow("Phone", formik.values.contact || "—")}
                    {reviewRow("Address", combinedAddress)}
                  </div>
                </div>

                <div className="col-xl-3 col-md-6">
                  <div className="wiz-review-card h-100">
                    <div className="wiz-review-card__header">
                      <span className="wiz-review-card__title">Course &amp; Plan</span>
                      <button type="button" className="wiz-review-card__edit" onClick={() => setStep(3)}>
                        <i className="ti ti-edit" /> Edit
                      </button>
                    </div>
                    {reviewRow("Course", selectedCourse?.courseName || "—")}
                    {reviewRow("Plan", selectedPlan?.name || "—")}
                    {reviewRow("Schedule", selectedPlan?.description || "—")}
                    {reviewRow("Duration", planDuration(selectedPlan))}
                    {reviewRow("Price", selectedPlan?.price != null ? `$${selectedPlan.price} / Month` : "—")}
                    {reviewRow("Start Date", formatDate(enrollmentDate))}
                  </div>
                </div>

                <div className="col-xl-3 col-md-6">
                  <div className="wiz-review-card h-100">
                    <div className="wiz-review-card__header">
                      <span className="wiz-review-card__title">Additional Information</span>
                      <button type="button" className="wiz-review-card__edit" onClick={() => setStep(2)}>
                        <i className="ti ti-edit" /> Edit
                      </button>
                    </div>
                    {reviewRow("Assigned Teacher", selectedTeacher ? `${selectedTeacher.firstName} ${selectedTeacher.lastName}` : "Not assigned")}
                    {reviewRow("Enrollment Channel", formik.values.enrollmentChannel || "Manual")}
                    {reviewRow("Time Zone", formik.values.timeZone || "Not set")}
                    {reviewRow("Class Time", formik.values.classTime || "—")}
                    {reviewRow("New Class Time (Summer)", formik.values.newClassTime || "—")}
                    {reviewRow("Notes", formik.values.note || "—")}
                  </div>
                </div>

                <div className="col-xl-3 col-md-6">
                  <div className="wiz-sidebar h-100">
                    <div className="wiz-ready-card">
                      <div className="wiz-ready-icon"><i className="ti ti-check" /></div>
                      <div className="wiz-ready-title">Ready to Create</div>
                      <div className="wiz-ready-text">All details look good. You can create the student account now.</div>
                      <button
                        type="button"
                        className="wiz-btn-primary"
                        disabled={saving}
                        onClick={() => formik.handleSubmit()}
                      >
                        {saving && <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />}
                        <i className="ti ti-user-plus" />
                        {saving ? "Creating..." : "Create Student Account"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="d-flex justify-content-start mt-3">
                <button type="button" className="btn wiz-btn-outline" onClick={goBack} disabled={saving}>
                  <i className="ti ti-arrow-left" /> Back
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
};

export default StudentCreateForm;
