"use client";

import { useEffect } from "react";
import { useFormik } from "formik";
import * as Yup from "yup";
import PhoneCountryInput from "@/components/shared/PhoneCountryInput";
import { phoneYupValidator } from "@/lib/phoneCountries";
import { useAppDispatch, useAppSelector } from "@/core/redux/hooks";
import { updateTeacherThunk, resetTeacherSaveStatus } from "@/core/redux/teacherSlice";
import { Teacher } from "@/types/teacher";

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

interface EditTeacherModalProps {
  open: boolean;
  teacher: Teacher | null;
  onCancel: () => void;
  onSuccess: () => void;
}

const validationSchema = Yup.object({
  firstName: Yup.string().trim().required("First name is required"),
  lastName: Yup.string().trim().required("Last name is required"),
  contact: Yup.string().trim().required("Contact is required").test("phone", "", phoneYupValidator),
  cnic: Yup.string().trim().required("CNIC is required"),
});

const EditTeacherModal = ({ open, teacher, onCancel, onSuccess }: EditTeacherModalProps) => {
  const dispatch = useAppDispatch();
  const { saveStatus, saveError } = useAppSelector((state) => state.teachers);
  const saving = saveStatus === "loading";

  const formik = useFormik({
    initialValues: {
      firstName: teacher?.firstName ?? "",
      lastName: teacher?.lastName ?? "",
      contact: teacher?.contact ?? "",
      cnic: teacher?.cnic ?? "",
      shift: (teacher?.shift ?? []) as ShiftOption[],
      timeZone: teacher?.timeZone ?? "",
    },
    validationSchema,
    enableReinitialize: true,
    onSubmit: async (values) => {
      if (!teacher) return;
      try {
        await dispatch(
          updateTeacherThunk({
            id: String(teacher.id),
            payload: {
              firstName: values.firstName.trim(),
              lastName: values.lastName.trim(),
              contact: values.contact.trim(),
              cnic: values.cnic.trim(),
              shift: values.shift.length > 0 ? values.shift : null,
              timeZone: values.timeZone || null,
            },
          })
        ).unwrap();
        onSuccess();
      } catch {
        // error is shown via Redux state
      }
    },
  });

  const handleCancel = () => {
    if (saving) return;
    formik.resetForm();
    dispatch(resetTeacherSaveStatus());
    onCancel();
  };

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
      formik.resetForm();
      dispatch(resetTeacherSaveStatus());
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
        onClick={!saving ? handleCancel : undefined}
      />
      <div
        className="modal fade show"
        style={{ display: "block", zIndex: 1055 }}
        tabIndex={-1}
      >
        <div className="modal-dialog modal-dialog-centered modal-lg">
          <div className="modal-content">
            <div className="modal-header">
              <h4 className="modal-title text-dark fw-bold">Edit Teacher</h4>
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
                  <div className="col-lg-6">
                    <div className="mb-3">
                      <label className="form-label">
                        First Name <span className="text-danger">*</span>
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        name="firstName"
                        value={formik.values.firstName}
                        onChange={formik.handleChange}
                        onBlur={formik.handleBlur}
                        disabled={saving}
                      />
                      {formik.touched.firstName && formik.errors.firstName && (
                        <div className="text-danger small mt-1">{formik.errors.firstName}</div>
                      )}
                    </div>
                  </div>

                  <div className="col-lg-6">
                    <div className="mb-3">
                      <label className="form-label">
                        Last Name <span className="text-danger">*</span>
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        name="lastName"
                        value={formik.values.lastName}
                        onChange={formik.handleChange}
                        onBlur={formik.handleBlur}
                        disabled={saving}
                      />
                      {formik.touched.lastName && formik.errors.lastName && (
                        <div className="text-danger small mt-1">{formik.errors.lastName}</div>
                      )}
                    </div>
                  </div>

                  <div className="col-lg-6">
                    <div className="mb-3">
                      <label className="form-label">
                        Contact <span className="text-danger">*</span>
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

                  <div className="col-lg-6">
                    <div className="mb-3">
                      <label className="form-label">
                        CNIC <span className="text-danger">*</span>
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        name="cnic"
                        value={formik.values.cnic}
                        onChange={formik.handleChange}
                        onBlur={formik.handleBlur}
                        disabled={saving}
                      />
                      {formik.touched.cnic && formik.errors.cnic && (
                        <div className="text-danger small mt-1">{formik.errors.cnic}</div>
                      )}
                    </div>
                  </div>

                  <div className="col-lg-6">
                    <div className="mb-3">
                      <label className="form-label">Shifts (select all that apply)</label>
                      <div className="d-flex gap-3 flex-wrap">
                        {SHIFT_OPTIONS.map((s) => (
                          <div key={s} className="form-check">
                            <input
                              className="form-check-input"
                              type="checkbox"
                              id={`shift-${s}`}
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
                            <label className="form-check-label" htmlFor={`shift-${s}`}>
                              {s === "Morning" ? "☀️ Morning (6am–12pm)" : s === "Afternoon" ? "🌤️ Afternoon (12pm–6pm)" : "🌙 Evening (6pm–12am)"}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="col-lg-6">
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
                </div>
              </div>

              <div className="modal-footer d-flex align-items-center gap-1">
                <button
                  type="button"
                  className="btn btn-light border"
                  onClick={handleCancel}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={saving || !formik.isValid}
                >
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

export default EditTeacherModal;
