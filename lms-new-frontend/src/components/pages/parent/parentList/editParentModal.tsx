"use client";

import { useEffect } from "react";
import { useFormik } from "formik";
import * as Yup from "yup";
import Select from "react-select";
import PhoneCountryInput from "@/components/shared/PhoneCountryInput";
import { phoneYupValidator } from "@/lib/phoneCountries";
import { useAppDispatch, useAppSelector } from "@/core/redux/hooks";
import { updateParentThunk, resetParentSaveStatus } from "@/core/redux/parentSlice";
import { fetchStudentsThunk } from "@/core/redux/studentSlice";
import { Parent } from "@/types/parent";

interface EditParentModalProps {
  open: boolean;
  parent: Parent | null;
  onCancel: () => void;
  onSuccess: () => void;
}

type StudentOption = { value: string; label: string };

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
  contact: Yup.string().trim().test("phone", "", phoneYupValidator),
  address: Yup.string().trim(),
  studentIds: Yup.array().min(1, "Please keep at least one student linked"),
});

const EditParentModal = ({ open, parent, onCancel, onSuccess }: EditParentModalProps) => {
  const dispatch = useAppDispatch();
  const { saveStatus, saveError } = useAppSelector((state) => state.parents);
  const saving = saveStatus === "loading";

  const { allItems: students, listStatus: studentListStatus } = useAppSelector(
    (state) => state.students
  );

  useEffect(() => {
    if (studentListStatus === "idle") {
      dispatch(fetchStudentsThunk());
    }
  }, [studentListStatus, dispatch]);

  const initialStudentIds = (parent?.students ?? []).map((s) => String(s.id));

  const formik = useFormik({
    initialValues: {
      firstName: parent?.firstName ?? "",
      lastName: parent?.lastName ?? "",
      contact: parent?.contact ?? "",
      address: parent?.address ?? "",
      timeZone: parent?.timeZone ?? "",
      studentIds: initialStudentIds,
    },
    validationSchema,
    enableReinitialize: true,
    onSubmit: async (values) => {
      if (!parent) return;
      try {
        await dispatch(
          updateParentThunk({
            id: String(parent.id),
            payload: {
              firstName: values.firstName.trim(),
              lastName: values.lastName.trim(),
              contact: values.contact.trim() || undefined,
              address: values.address.trim() || undefined,
              timeZone: values.timeZone || null,
              studentIds: values.studentIds,
            },
          })
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
    dispatch(resetParentSaveStatus());
    onCancel();
  };

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
      formik.resetForm();
      dispatch(resetParentSaveStatus());
    }
    return () => { document.body.style.overflow = ""; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const studentOptions: StudentOption[] = students.map((s) => ({
    value: String(s.id),
    label: `${s.firstName} ${s.lastName ?? ""}`.trim() + ` (${s.username})`,
  }));

  const selectedStudentOptions = studentOptions.filter((o) =>
    formik.values.studentIds.includes(o.value)
  );

  return (
    <>
      <div
        className="modal-backdrop fade show"
        style={{ zIndex: 1040 }}
        onClick={!saving ? handleCancel : undefined}
      />
      <div className="modal fade show" style={{ display: "block", zIndex: 1055 }} tabIndex={-1}>
        <div className="modal-dialog modal-dialog-centered modal-lg">
          <div className="modal-content">
            <div className="modal-header">
              <h4 className="modal-title text-dark fw-bold">Edit Parent</h4>
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

                {/* Linked Students */}
                <div className="bg-light px-3 py-2 mb-3 rounded">
                  <h6 className="fw-bold mb-0">Linked Students</h6>
                </div>
                <div className="mb-3">
                  <label className="form-label">
                    Students <span className="text-danger">*</span>
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
                    isDisabled={saving || studentListStatus === "loading"}
                  />
                  {formik.submitCount > 0 && formik.errors.studentIds && (
                    <div className="text-danger small mt-1">
                      {String(formik.errors.studentIds)}
                    </div>
                  )}
                </div>

                {/* Personal Info */}
                <div className="bg-light px-3 py-2 mb-3 rounded">
                  <h6 className="fw-bold mb-0">Personal Information</h6>
                </div>
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

                  <div className="col-lg-8">
                    <div className="mb-3">
                      <label className="form-label">Address</label>
                      <input
                        type="text"
                        className="form-control"
                        name="address"
                        value={formik.values.address}
                        onChange={formik.handleChange}
                        onBlur={formik.handleBlur}
                        disabled={saving}
                      />
                    </div>
                  </div>

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
                  disabled={saving}
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

export default EditParentModal;
