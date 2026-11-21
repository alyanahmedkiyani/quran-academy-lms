"use client";

import { useEffect, useRef, useState } from "react";
import { useFormik } from "formik";
import * as Yup from "yup";
import PhoneCountryInput from "@/components/shared/PhoneCountryInput";
import { phoneYupValidator } from "@/lib/phoneCountries";
import { useAppDispatch, useAppSelector } from "@/core/redux/hooks";
import { updateStudentThunk, resetStudentSaveStatus } from "@/core/redux/studentSlice";
import { Student } from "@/types/student";
import { Teacher } from "@/types/teacher";
import { fetchAllTeachers } from "@/services/teacherService";
import { Course } from "@/types/course";
import { fetchAllCourses } from "@/services/courseService";
import CommonSelect, { Option as SelectOption } from "@/core/common/common-select/commonSelect";
import { fetchAllPlans, Plan } from "@/services/planService";
import { api_base_url, withAuthorization } from "@/services/apiClient";
import { COUNTRIES } from "@/lib/countries";

interface EditStudentModalProps {
  open: boolean;
  student: Student | null;
  onCancel: () => void;
  onSuccess: () => void;
}

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

const validationSchema = Yup.object({
  username: Yup.string().trim().min(3, "Username must be at least 3 characters"),
  firstName: Yup.string().trim().required("First name is required"),
  lastName: Yup.string().trim().required("Last name is required"),
  contact: Yup.string().trim().test("phone", "", phoneYupValidator),
  address: Yup.string().trim(),
  countryName: Yup.string().trim(),
  state: Yup.string().trim(),
  city: Yup.string().trim(),
  timeZone: Yup.string().trim(),
  classTime: Yup.string().trim(),
  newClassTime: Yup.string().trim(),
  nameForTeacher: Yup.string().trim(),
});

const EditStudentModal = ({ open, student, onCancel, onSuccess }: EditStudentModalProps) => {
  const dispatch = useAppDispatch();
  const { saveStatus, saveError } = useAppSelector((state) => state.students);
  const saving = saveStatus === "loading";

  const [plans, setPlans] = useState<Plan[]>([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [teachersLoading, setTeachersLoading] = useState(false);
  const [courses, setCourses] = useState<Course[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(false);

  // Username availability check (skip if unchanged from original)
  const [usernameStatus, setUsernameStatus] = useState<"idle" | "checking" | "available" | "taken">("idle");
  const usernameDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const checkUsername = (value: string, originalUsername: string) => {
    if (usernameDebounceRef.current) clearTimeout(usernameDebounceRef.current);
    const trimmed = value.trim();
    // No check needed if unchanged or too short
    if (trimmed === originalUsername || trimmed.length < 3) { setUsernameStatus("idle"); return; }
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

  useEffect(() => {
    if (open && plans.length === 0) {
      setPlansLoading(true);
      fetchAllPlans()
        .then(setPlans)
        .catch(() => {})
        .finally(() => setPlansLoading(false));
    }
    if (open && teachers.length === 0) {
      setTeachersLoading(true);
      fetchAllTeachers()
        .then((res) => setTeachers(res.teachers ?? []))
        .catch(() => {})
        .finally(() => setTeachersLoading(false));
    }
    if (open && courses.length === 0) {
      setCoursesLoading(true);
      fetchAllCourses()
        .then((res) => setCourses(res.courses ?? []))
        .catch(() => {})
        .finally(() => setCoursesLoading(false));
    }
  }, [open, plans.length, teachers.length, courses.length]);

  const formik = useFormik({
    initialValues: {
      username: student?.username ?? "",
      firstName: student?.firstName ?? "",
      lastName: student?.lastName ?? "",
      contact: student?.contact ?? "",
      address: student?.address ?? "",
      countryName: student?.countryName ?? "",
      state: student?.state ?? "",
      city: student?.city ?? "",
      timeZone: student?.timeZone ?? "",
      classTime: student?.classTime ?? "",
      newClassTime: student?.newClassTime ?? "",
      nameForTeacher: student?.nameForTeacher ?? "",
      teacherId: student?.assignedTeacher ? String(student.assignedTeacher.id) : "",
      courseId: student?.courseId ? String(student.courseId) : "",
      planId: student?.planId ? String(student.planId) : "",
      shift: (student?.shift ?? "") as "Morning" | "Afternoon" | "Evening" | "",
      enrollmentChannel: (student?.enrollmentChannel ?? "") as "Meta" | "Google" | "TikTok" | "SEO" | "Email" | "Reference" | "",
      referenceDetails: student?.referenceDetails ?? "",
      studentLabel: (student?.studentLabel ?? "") as "Unassigned" | "Trial" | "New Enrollment" | "Lost" | "Struck off" | "",
      struckOffReason: student?.struckOffReason ?? "",
      note: student?.note ?? "",
    },
    validationSchema,
    enableReinitialize: true,
    onSubmit: async (values) => {
      if (!student) return;
      try {
        await dispatch(
          updateStudentThunk({
            id: String(student.id),
            payload: {
              username: values.username.trim() || undefined,
              firstName: values.firstName.trim(),
              lastName: values.lastName.trim(),
              contact: values.contact.trim() || undefined,
              address: values.address.trim() || undefined,
              countryName: values.countryName.trim() || undefined,
              state: values.state.trim() || undefined,
              city: values.city.trim() || undefined,
              timeZone: values.timeZone.trim() || undefined,
              classTime: values.classTime || undefined,
              newClassTime: values.newClassTime || undefined,
              nameForTeacher: values.nameForTeacher.trim() || undefined,
              teacherId: values.teacherId || null,
              courseId: values.courseId || null,
              planId: values.planId || undefined,
              shift: values.shift || null,
              enrollmentChannel: (values.enrollmentChannel as "Meta" | "Google" | "TikTok" | "SEO" | "Email" | "Reference") || null,
              referenceDetails: values.enrollmentChannel === "Reference" ? values.referenceDetails || undefined : undefined,
              studentLabel: (values.studentLabel as "Unassigned" | "Trial" | "New Enrollment" | "Lost" | "Struck off") || null,
              struckOffReason: values.studentLabel === "Struck off" ? values.struckOffReason || undefined : undefined,
              note: values.note.trim() || undefined,
            },
          }),
        ).unwrap();
        onSuccess();
      } catch {
        // error shown via Redux state
      }
    },
  });

  const handleCancel = () => {
    if (saving) return;
    formik.resetForm();
    dispatch(resetStudentSaveStatus());
    onCancel();
  };

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      setUsernameStatus("idle");
    } else {
      document.body.style.overflow = "";
      formik.resetForm();
      dispatch(resetStudentSaveStatus());
      setUsernameStatus("idle");
    }
    return () => {
      document.body.style.overflow = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const field = (name: keyof typeof formik.values, label: string, type = "text", required = false) => (
    <div className="mb-3">
      <label className="form-label">
        {label} {required && <span className="text-danger">*</span>}
      </label>
      <input
        type={type}
        className="form-control"
        name={name}
        value={formik.values[name]}
        onChange={formik.handleChange}
        onBlur={formik.handleBlur}
        disabled={saving}
      />
      {formik.touched[name] && formik.errors[name] && (
        <div className="text-danger small mt-1">{String(formik.errors[name])}</div>
      )}
    </div>
  );

  if (!open) return null;

  return (
    <>
      <div className="modal-backdrop fade show" style={{ zIndex: 1040 }} onClick={!saving ? handleCancel : undefined} />
      <div className="modal fade show" style={{ display: "block", zIndex: 1055 }} tabIndex={-1}>
        <div className="modal-dialog modal-dialog-centered modal-lg">
          <div className="modal-content">
            <div className="modal-header">
              <h4 className="modal-title text-dark fw-bold">Edit Student</h4>
              <button
                type="button"
                className="btn-close custom-btn-close opacity-100"
                onClick={handleCancel}
                disabled={saving}
              >
                <i className="ti ti-x fs-16 text-dark" />
              </button>
            </div>
            <form onSubmit={formik.handleSubmit} noValidate>
              <div className="modal-body">
                {saveError && (
                  <div className="alert alert-danger py-2 mb-3" role="alert">
                    {saveError}
                  </div>
                )}

                <div className="row">
                  <div className="col-lg-6">{field("firstName", "First Name", "text", true)}</div>
                  <div className="col-lg-6">{field("lastName", "Last Name", "text", true)}</div>
                  <div className="col-lg-6">
                    <div className="mb-3">
                      <label className="form-label">Username</label>
                      <div className="input-group">
                        <input
                          type="text"
                          className={`form-control${usernameStatus === "taken" ? " is-invalid" : usernameStatus === "available" ? " is-valid" : ""}`}
                          name="username"
                          value={formik.values.username}
                          disabled={saving}
                          onChange={(e) => { formik.handleChange(e); checkUsername(e.target.value, student?.username ?? ""); }}
                          onBlur={formik.handleBlur}
                        />
                        <span className="input-group-text">
                          {usernameStatus === "checking" && <span className="spinner-border spinner-border-sm text-secondary" role="status" />}
                          {usernameStatus === "available" && <i className="ti ti-circle-check text-success" />}
                          {usernameStatus === "taken" && <i className="ti ti-circle-x text-danger" />}
                          {usernameStatus === "idle" && <i className="ti ti-at text-muted" />}
                        </span>
                        {usernameStatus === "taken" && (
                          <div className="invalid-feedback">Username is already taken.</div>
                        )}
                      </div>
                      {usernameStatus === "available" && (
                        <div className="text-success small mt-1"><i className="ti ti-check me-1" />Username is available</div>
                      )}
                    </div>
                  </div>
                  <div className="col-lg-6">
                    <div className="mb-3">
                      <label className="form-label">Contact</label>
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
                  <div className="col-lg-6">
                    <div className="mb-3">
                      <label className="form-label">Assign Teacher</label>
                      <CommonSelect
                        options={[
                          { value: "", label: "— No teacher assigned —" },
                          ...teachers.map((t): SelectOption => ({
                            value: String(t.id),
                            label: `${t.firstName} ${t.lastName}`,
                          })),
                        ]}
                        value={
                          formik.values.teacherId
                            ? (() => {
                                const t = teachers.find((tc) => String(tc.id) === formik.values.teacherId);
                                return t ? { value: String(t.id), label: `${t.firstName} ${t.lastName}` } : null;
                              })()
                            : { value: "", label: "— No teacher assigned —" }
                        }
                        onChange={(opt) => formik.setFieldValue("teacherId", opt ? opt.value : "")}
                        placeholder={teachersLoading ? "Loading teachers..." : "Select a teacher"}
                        isDisabled={saving || teachersLoading}
                      />
                    </div>
                  </div>
                  <div className="col-lg-6">
                    <div className="mb-3">
                      <label className="form-label">Assign Course</label>
                      <CommonSelect
                        options={[
                          { value: "", label: "— No course assigned —" },
                          ...courses.map((c): SelectOption => ({
                            value: String(c.id),
                            label: c.courseName,
                          })),
                        ]}
                        value={
                          formik.values.courseId
                            ? (() => {
                                const c = courses.find((co) => String(co.id) === formik.values.courseId);
                                return c ? { value: String(c.id), label: c.courseName } : null;
                              })()
                            : { value: "", label: "— No course assigned —" }
                        }
                        onChange={(opt) => formik.setFieldValue("courseId", opt ? opt.value : "")}
                        placeholder={coursesLoading ? "Loading courses..." : "Select a course"}
                        isDisabled={saving || coursesLoading}
                      />
                    </div>
                  </div>
                  <div className="col-lg-12">{field("address", "Address")}</div>
                  <div className="col-lg-4">
                    <div className="mb-3">
                      <label className="form-label">Country</label>
                      <select
                        className="form-select"
                        name="countryName"
                        value={formik.values.countryName}
                        onChange={formik.handleChange}
                        onBlur={formik.handleBlur}
                        disabled={saving}
                      >
                        <option value="">— Select country —</option>
                        {COUNTRIES.map((c) => (
                          <option key={c.iso3} value={c.name}>{c.name}</option>
                        ))}
                      </select>
                      {formik.touched.countryName && formik.errors.countryName && (
                        <div className="text-danger small mt-1">{String(formik.errors.countryName)}</div>
                      )}
                    </div>
                  </div>
                  <div className="col-lg-4">{field("state", "State")}</div>
                  <div className="col-lg-4">{field("city", "City")}</div>
                  <div className="col-lg-4">
                    <div className="mb-3">
                      <label className="form-label">Time Zone</label>
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
                  <div className="col-lg-4">{field("classTime", "Class Time", "time")}</div>
                  <div className="col-lg-4">{field("newClassTime", "New Class Time", "time")}</div>
                  <div className="col-lg-6">
                    <div className="mb-3">
                      <label className="form-label">Shift</label>
                      <select
                        className="form-select"
                        name="shift"
                        value={formik.values.shift}
                        onChange={formik.handleChange}
                        disabled={saving}
                      >
                        <option value="">Not assigned</option>
                        <option value="Morning">☀️ Morning (6am–12pm)</option>
                        <option value="Afternoon">🌤️ Afternoon (12pm–6pm)</option>
                        <option value="Evening">🌙 Evening (6pm–12am)</option>
                      </select>
                      {formik.values.shift !== (student?.shift ?? "") && (
                        <div className="text-warning small mt-1">
                          <i className="ti ti-info-circle me-1" />
                          Changing shift affects future calendar filtering only. Existing sessions are not removed.
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="col-lg-6">
                    <div className="mb-3">
                      <label className="form-label">Student Label</label>
                      <select
                        className="form-select"
                        name="studentLabel"
                        value={formik.values.studentLabel}
                        onChange={formik.handleChange}
                        disabled={saving}
                      >
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
                    <div className="col-lg-6">
                      <div className="mb-3">
                        <label className="form-label">Struck Off Reason</label>
                        <textarea
                          className="form-control"
                          name="struckOffReason"
                          rows={2}
                          placeholder="Provide a reason for striking off this student..."
                          value={formik.values.struckOffReason}
                          onChange={formik.handleChange}
                          disabled={saving}
                        />
                      </div>
                    </div>
                  )}
                  <div className="col-lg-6">
                    <div className="mb-3">
                      <label className="form-label">Enrollment Channel</label>
                      <select
                        className="form-select"
                        name="enrollmentChannel"
                        value={formik.values.enrollmentChannel}
                        onChange={formik.handleChange}
                        disabled={saving}
                      >
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
                    <div className="col-lg-6">
                      <div className="mb-3">
                        <label className="form-label">Reference Details</label>
                        <textarea
                          className="form-control"
                          name="referenceDetails"
                          rows={3}
                          placeholder="Add description or additional info about the reference..."
                          value={formik.values.referenceDetails}
                          onChange={formik.handleChange}
                          disabled={saving}
                        />
                      </div>
                    </div>
                  )}
                  <div className="col-lg-12">
                    <div className="mb-3">
                      <label className="form-label">Note <span className="text-muted fw-normal fs-12">(optional)</span></label>
                      <textarea
                        className="form-control"
                        name="note"
                        rows={3}
                        placeholder="Any internal notes about this student..."
                        value={formik.values.note}
                        onChange={formik.handleChange}
                        disabled={saving}
                      />
                    </div>
                  </div>
                  <div className="col-lg-12">
                    <div className="mb-3">
                      <label className="form-label">Subscription Plan</label>
                      <CommonSelect
                        options={plans.map((p): SelectOption => ({
                          value: String(p.id),
                          label: `${p.name} ($${Number(p.price).toFixed(2)})`,
                        }))}
                        value={
                          formik.values.planId
                            ? (() => {
                                const p = plans.find((pl) => String(pl.id) === formik.values.planId);
                                return p
                                  ? { value: String(p.id), label: `${p.name} ($${Number(p.price).toFixed(2)})` }
                                  : null;
                              })()
                            : null
                        }
                        onChange={(opt) => formik.setFieldValue("planId", opt ? opt.value : "")}
                        placeholder={plansLoading ? "Loading plans..." : "Select a plan"}
                        isDisabled={saving || plansLoading}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="modal-footer d-flex align-items-center gap-1">
                <button type="button" className="btn btn-light border" onClick={handleCancel} disabled={saving}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving || !formik.isValid || usernameStatus === "taken" || usernameStatus === "checking"}>
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
};

export default EditStudentModal;
