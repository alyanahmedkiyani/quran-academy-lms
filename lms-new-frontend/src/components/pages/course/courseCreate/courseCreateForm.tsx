"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useFormik } from "formik";
import * as Yup from "yup";

import { all_routes } from "@/routes/all_routes";
import { useAppDispatch, useAppSelector } from "@/core/redux/hooks";
import { createCourseThunk, resetCourseSaveStatus } from "@/core/redux/courseSlice";
import { isAdminAuthorityRole, getDashboardRouteForRole } from "@/lib/roles";
import { uploadCoursePDFs } from "@/services/coursePDFService";
import { useNotification } from "@/hooks/useNotification";

const validationSchema = Yup.object({
  courseName: Yup.string().trim().required("Course name is required"),
  duration: Yup.string().trim(),
  description: Yup.string().trim(),
  price: Yup.number().min(0, "Price must be 0 or more").nullable(),
  isComing: Yup.boolean(),
});

const CourseCreateForm = () => {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const notify = useNotification();
  const user = useAppSelector((state) => state.auth.user);
  const { saveStatus, saveError } = useAppSelector((state) => state.courses);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // PDF content
  const [selectedPdfs, setSelectedPdfs] = useState<File[]>([]);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  const saving = saveStatus === "loading";

  useEffect(() => {
    if (user && !isAdminAuthorityRole(user.role?.name)) {
      router.replace(getDashboardRouteForRole(user.role?.name));
    }
    return () => {
      dispatch(resetCourseSaveStatus());
    };
  }, [user, router, dispatch]);

  useEffect(() => {
    if (saveError) notify.error(saveError);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveError]);


  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(selectedFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [selectedFile]);

  const formik = useFormik({
    initialValues: {
      courseName: "",
      duration: "",
      description: "",
      price: "",
      isComing: false,
    },
    validationSchema,
    onSubmit: async (values) => {
      const fd = new FormData();
      fd.append("courseName", values.courseName.trim());
      if (values.duration.trim()) fd.append("duration", values.duration.trim());
      if (values.description.trim()) fd.append("description", values.description.trim());
      if (values.price !== "" && values.price !== null) fd.append("price", String(values.price));
      fd.append("isComing", String(values.isComing));
      if (selectedFile) fd.append("file", selectedFile);

      try {
        const result = await dispatch(createCourseThunk(fd)).unwrap();
        if (selectedPdfs.length > 0 && result.newCourse?.id) {
          await uploadCoursePDFs(Number(result.newCourse.id), selectedPdfs);
        }
        notify.success("Course created successfully");
        dispatch(resetCourseSaveStatus());
        router.push(all_routes.manageCourses);
      } catch {
        // error shown via saveError useEffect
      }
    },
  });

  return (
    <div className="page-wrapper">
      <div className="content">
        {/* Page Header */}
        <div className="d-flex align-items-sm-center flex-sm-row flex-column gap-2 pb-3 mb-3">
          <div className="flex-grow-1">
            <h4 className="fw-bold mb-0">Add New Course</h4>
            <nav aria-label="breadcrumb" className="mt-1">
              <ol className="breadcrumb mb-0">
                <li className="breadcrumb-item">
                  <a href={all_routes.manageCourses} className="text-muted">
                    Courses
                  </a>
                </li>
                <li className="breadcrumb-item active">Add Course</li>
              </ol>
            </nav>
          </div>
          <button
            type="button"
            className="btn btn-outline-light border"
            onClick={() => router.push(all_routes.manageCourses)}
          >
            <i className="ti ti-arrow-left me-1" />
            Back to Courses
          </button>
        </div>

        <div className="card">
          <div className="card-body">
            <form onSubmit={formik.handleSubmit} noValidate>
              <div className="row g-4">
                {/* Left column — form fields */}
                <div className="col-lg-8">
                  {/* Course Name */}
                  <div className="mb-4">
                    <label className="form-label fw-semibold">
                      Course Name <span className="text-danger">*</span>
                    </label>
                    <input
                      type="text"
                      className={`form-control form-control-lg ${
                        formik.touched.courseName && formik.errors.courseName ? "is-invalid" : ""
                      }`}
                      placeholder="e.g. Advanced Mathematics, English Literature"
                      disabled={saving}
                      {...formik.getFieldProps("courseName")}
                    />
                    {formik.touched.courseName && formik.errors.courseName && (
                      <div className="invalid-feedback">{formik.errors.courseName}</div>
                    )}
                  </div>

                  {/* Duration */}
                  <div className="mb-4">
                    <label className="form-label fw-semibold">Duration</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. 3 months, 12 weeks, 48 hours"
                      disabled={saving}
                      {...formik.getFieldProps("duration")}
                    />
                  </div>

                  {/* Description */}
                  <div className="mb-4">
                    <label className="form-label fw-semibold">Description</label>
                    <textarea
                      className="form-control"
                      rows={5}
                      placeholder="Provide a detailed description of what this course covers..."
                      disabled={saving}
                      {...formik.getFieldProps("description")}
                    />
                  </div>

                  {/* Price */}
                  <div className="mb-4">
                    <label className="form-label fw-semibold">Price ($)</label>
                    <div className="input-group">
                      <span className="input-group-text">$</span>
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        className={`form-control ${
                          formik.touched.price && formik.errors.price ? "is-invalid" : ""
                        }`}
                        placeholder="0.00"
                        disabled={saving}
                        {...formik.getFieldProps("price")}
                      />
                      {formik.touched.price && formik.errors.price && (
                        <div className="invalid-feedback">{formik.errors.price as string}</div>
                      )}
                    </div>
                  </div>

                  {/* isComing toggle */}
                  <div className="mb-4">
                    <div className="form-check form-switch">
                      <input
                        type="checkbox"
                        className="form-check-input"
                        id="isComing"
                        style={{ width: 40, height: 20 }}
                        disabled={saving}
                        checked={formik.values.isComing}
                        onChange={(e) => formik.setFieldValue("isComing", e.target.checked)}
                      />
                      <label className="form-check-label fw-semibold ms-2" htmlFor="isComing">
                        Mark as Upcoming Course
                      </label>
                    </div>
                    <small className="text-muted ms-1">
                      Upcoming courses are visible to students before enrollment begins.
                    </small>
                  </div>
                </div>

                {/* Right column — image upload */}
                <div className="col-lg-4">
                  <label className="form-label fw-semibold">Course Image</label>
                  <div
                    className="border rounded d-flex flex-column align-items-center justify-content-center p-3"
                    style={{ minHeight: 200, cursor: "pointer", background: "#fafafa" }}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {previewUrl ? (
                      <img
                        src={previewUrl}
                        alt="Preview"
                        style={{ maxWidth: "100%", maxHeight: 180, objectFit: "cover", borderRadius: 8 }}
                      />
                    ) : (
                      <>
                        <i className="ti ti-photo fs-40 text-muted mb-2" />
                        <p className="text-muted mb-0 text-center">
                          Click to upload course image
                        </p>
                        <small className="text-muted">PNG, JPG up to 5MB</small>
                      </>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="d-none"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0] ?? null;
                      setSelectedFile(file);
                    }}
                    disabled={saving}
                  />
                  {selectedFile && (
                    <div className="mt-2 d-flex align-items-center justify-content-between">
                      <small className="text-muted text-truncate" style={{ maxWidth: 150 }}>
                        {selectedFile.name}
                      </small>
                      <button
                        type="button"
                        className="btn btn-link btn-sm text-danger p-0"
                        onClick={() => {
                          setSelectedFile(null);
                          if (fileInputRef.current) fileInputRef.current.value = "";
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  )}

                  {/* Course Materials (PDFs) */}
                  <div className="mt-4">
                    <label className="form-label fw-semibold">
                      <i className="ti ti-file-type-pdf me-1 text-danger" />
                      Course Materials (PDFs)
                    </label>
                    <p className="text-muted small mb-2">
                      Upload PDFs students can view during live classes.
                    </p>
                    <button
                      type="button"
                      className="btn btn-outline-secondary btn-sm w-100"
                      disabled={saving}
                      onClick={() => pdfInputRef.current?.click()}
                    >
                      <i className="ti ti-file-plus me-1" />
                      Add PDF Files
                    </button>
                    <input
                      ref={pdfInputRef}
                      type="file"
                      className="d-none"
                      accept=".pdf,application/pdf"
                      multiple
                      disabled={saving}
                      onChange={(e) => {
                        const files = Array.from(e.target.files ?? []);
                        setSelectedPdfs((prev) => [...prev, ...files]);
                        if (pdfInputRef.current) pdfInputRef.current.value = "";
                      }}
                    />
                    {selectedPdfs.length > 0 && (
                      <div className="mt-2 border rounded" style={{ background: "#fafafa" }}>
                        {selectedPdfs.map((pdf, idx) => (
                          <div
                            key={idx}
                            className="d-flex align-items-center gap-2 px-2 py-2"
                            style={{ borderBottom: idx < selectedPdfs.length - 1 ? "1px solid #e9ecef" : "none" }}
                          >
                            <i className="ti ti-file-type-pdf text-danger" style={{ fontSize: 16 }} />
                            <span className="flex-grow-1 text-truncate" style={{ fontSize: 12 }}>
                              {pdf.name}
                            </span>
                            <button
                              type="button"
                              className="btn btn-link btn-sm p-0 text-muted"
                              title="Preview"
                              onClick={() => {
                                const url = URL.createObjectURL(pdf);
                                window.open(url, "_blank");
                              }}
                            >
                              <i className="ti ti-eye" style={{ fontSize: 13 }} />
                            </button>
                            <button
                              type="button"
                              className="btn btn-link btn-sm p-0 text-danger"
                              title="Remove"
                              onClick={() => setSelectedPdfs((prev) => prev.filter((_, i) => i !== idx))}
                            >
                              <i className="ti ti-x" style={{ fontSize: 13 }} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Submit */}
              <hr className="my-4" />
              <div className="d-flex justify-content-end gap-2">
                <button
                  type="button"
                  className="btn btn-light border"
                  onClick={() => router.push(all_routes.manageCourses)}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary d-inline-flex align-items-center gap-2 px-4"
                  disabled={saving}
                >
                  {saving && (
                    <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
                  )}
                  {saving ? "Creating..." : "Create Course"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CourseCreateForm;
