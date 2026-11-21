"use client";

import { useEffect, useRef, useState } from "react";
import { Modal } from "antd";
import { useFormik } from "formik";
import * as Yup from "yup";

import { useAppDispatch, useAppSelector } from "@/core/redux/hooks";
import { updateCourseThunk, resetCourseSaveStatus } from "@/core/redux/courseSlice";
import { Course } from "@/types/course";
import { media_base_url } from "@/environment";
import { CoursePDF, getCoursePDFs, uploadCoursePDFs, deleteCoursePDF } from "@/services/coursePDFService";
import { useNotification } from "@/hooks/useNotification";

interface EditCourseModalProps {
  open: boolean;
  course: Course | null;
  onCancel: () => void;
  onSuccess: () => void;
}

const validationSchema = Yup.object({
  courseName: Yup.string().trim().required("Course name is required"),
  duration: Yup.string().trim(),
  description: Yup.string().trim(),
  price: Yup.number().min(0, "Price must be 0 or more").nullable(),
  isComing: Yup.boolean(),
});

const EditCourseModal = ({ open, course, onCancel, onSuccess }: EditCourseModalProps) => {
  const dispatch = useAppDispatch();
  const notify = useNotification();
  const { saveStatus, saveError } = useAppSelector((state) => state.courses);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // PDF state
  const [existingPdfs, setExistingPdfs] = useState<CoursePDF[]>([]);
  const [newPdfs, setNewPdfs] = useState<File[]>([]);
  const [loadingPdfs, setLoadingPdfs] = useState(false);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  const saving = saveStatus === "loading";

  useEffect(() => {
    if (saveError) notify.error(saveError);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveError]);

  const formik = useFormik({
    enableReinitialize: true,
    initialValues: {
      courseName: course?.courseName ?? "",
      duration: course?.duration ?? "",
      description: course?.description ?? "",
      price: course?.price ?? "",
      isComing: course?.isComing ?? false,
    },
    validationSchema,
    onSubmit: async (values) => {
      if (!course) return;
      const fd = new FormData();
      fd.append("courseName", values.courseName.trim());
      if (values.duration) fd.append("duration", values.duration.trim());
      if (values.description) fd.append("description", values.description.trim());
      if (values.price !== "" && values.price !== null && values.price !== undefined) {
        fd.append("price", String(values.price));
      }
      fd.append("isComing", String(values.isComing));
      if (selectedFile) fd.append("file", selectedFile);

      try {
        await dispatch(updateCourseThunk({ id: String(course.id), formData: fd })).unwrap();
        if (newPdfs.length > 0) {
          await uploadCoursePDFs(Number(course.id), newPdfs);
        }
        notify.success("Course updated successfully");
        handleClose();
        onSuccess();
      } catch {
        // error shown via saveError useEffect
      }
    },
  });

  // Fetch existing PDFs when modal opens
  useEffect(() => {
    if (!open || !course?.id) return;
    setLoadingPdfs(true);
    getCoursePDFs(Number(course.id))
      .then(setExistingPdfs)
      .catch(() => setExistingPdfs([]))
      .finally(() => setLoadingPdfs(false));
  }, [open, course?.id]);

  // Preview when file is selected
  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(selectedFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [selectedFile]);

  const handleClose = () => {
    if (saving) return;
    formik.resetForm();
    setSelectedFile(null);
    setPreviewUrl(null);
    setExistingPdfs([]);
    setNewPdfs([]);
    dispatch(resetCourseSaveStatus());
    onCancel();
  };

  const handleDeleteExistingPdf = async (pdfId: number) => {
    if (!course?.id) return;
    try {
      await deleteCoursePDF(Number(course.id), pdfId);
      setExistingPdfs((prev) => prev.filter((p) => p.id !== pdfId));
      notify.success("PDF removed");
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message ?? "Failed to remove PDF.";
      notify.error(msg);
    }
  };

  const currentImageSrc = course?.imageUrl
    ? `${media_base_url}/${course.imageUrl}`
    : null;

  return (
    <Modal
      open={open}
      title={<span className="fw-bold fs-16">Edit Course</span>}
      onCancel={handleClose}
      footer={null}
      width={600}
      centered
      destroyOnClose
    >
      <form onSubmit={formik.handleSubmit} noValidate>
        {/* Course Name */}
        <div className="mb-3">
          <label className="form-label fw-medium">
            Course Name <span className="text-danger">*</span>
          </label>
          <input
            type="text"
            className={`form-control ${formik.touched.courseName && formik.errors.courseName ? "is-invalid" : ""}`}
            placeholder="e.g. Advanced Mathematics"
            disabled={saving}
            {...formik.getFieldProps("courseName")}
          />
          {formik.touched.courseName && formik.errors.courseName && (
            <div className="invalid-feedback">{formik.errors.courseName}</div>
          )}
        </div>

        {/* Duration */}
        <div className="mb-3">
          <label className="form-label fw-medium">Duration</label>
          <input
            type="text"
            className="form-control"
            placeholder="e.g. 3 months, 12 weeks"
            disabled={saving}
            {...formik.getFieldProps("duration")}
          />
        </div>

        {/* Description */}
        <div className="mb-3">
          <label className="form-label fw-medium">Description</label>
          <textarea
            className="form-control"
            rows={3}
            placeholder="Brief course description..."
            disabled={saving}
            {...formik.getFieldProps("description")}
          />
        </div>

        {/* Price & isComing row */}
        <div className="row g-3 mb-3">
          <div className="col-6">
            <label className="form-label fw-medium">Price ($)</label>
            <input
              type="number"
              min={0}
              step={0.01}
              className={`form-control ${formik.touched.price && formik.errors.price ? "is-invalid" : ""}`}
              placeholder="0.00"
              disabled={saving}
              {...formik.getFieldProps("price")}
            />
            {formik.touched.price && formik.errors.price && (
              <div className="invalid-feedback">{formik.errors.price as string}</div>
            )}
          </div>
          <div className="col-6 d-flex align-items-end pb-1">
            <div className="form-check form-switch">
              <input
                type="checkbox"
                className="form-check-input"
                id="isComing-edit"
                disabled={saving}
                checked={formik.values.isComing}
                onChange={(e) => formik.setFieldValue("isComing", e.target.checked)}
              />
              <label className="form-check-label fw-medium" htmlFor="isComing-edit">
                Mark as Upcoming
              </label>
            </div>
          </div>
        </div>

        {/* Image */}
        <div className="mb-4">
          <label className="form-label fw-medium">Course Image</label>
          <div className="d-flex align-items-center gap-3 flex-wrap">
            {/* Current or preview */}
            {previewUrl ? (
              <img
                src={previewUrl}
                alt="Preview"
                style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 8, border: "2px solid #dee2e6" }}
              />
            ) : currentImageSrc ? (
              <img
                src={currentImageSrc}
                alt="Current"
                style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 8, border: "2px solid #dee2e6" }}
              />
            ) : (
              <div
                className="d-flex align-items-center justify-content-center bg-light rounded"
                style={{ width: 80, height: 80, border: "2px dashed #dee2e6" }}
              >
                <i className="ti ti-photo text-muted fs-24" />
              </div>
            )}
            <div className="flex-grow-1">
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
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={saving}
              >
                <i className="ti ti-upload me-1" />
                {selectedFile ? "Change Image" : "Upload Image"}
              </button>
              {selectedFile && (
                <div className="mt-1">
                  <small className="text-muted">{selectedFile.name}</small>
                  <button
                    type="button"
                    className="btn btn-link btn-sm text-danger p-0 ms-2"
                    onClick={() => {
                      setSelectedFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                  >
                    Remove
                  </button>
                </div>
              )}
              <div className="mt-1">
                <small className="text-muted">Leave empty to keep current image.</small>
              </div>
            </div>
          </div>
        </div>

        {/* Course Materials (PDFs) */}
        <div className="mb-4">
          <label className="form-label fw-medium">
            <i className="ti ti-file-type-pdf me-1 text-danger" />
            Course Materials (PDFs)
          </label>

          {/* Existing PDFs */}
          {loadingPdfs ? (
            <div className="text-muted small mb-2">
              <span className="spinner-border spinner-border-sm me-1" />
              Loading materials…
            </div>
          ) : existingPdfs.length > 0 ? (
            <div className="border rounded mb-2" style={{ background: "#fafafa" }}>
              {existingPdfs.map((pdf, idx) => (
                <div
                  key={pdf.id}
                  className="d-flex align-items-center gap-2 px-3 py-2"
                  style={{ borderBottom: idx < existingPdfs.length - 1 ? "1px solid #e9ecef" : "none" }}
                >
                  <i className="ti ti-file-type-pdf text-danger" style={{ fontSize: 16 }} />
                  <span className="flex-grow-1 text-truncate" style={{ fontSize: 12 }}>
                    {pdf.originalName}
                  </span>
                  <a
                    href={`${media_base_url}/resources/${pdf.filePath.replace(/^resources\//, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-link btn-sm p-0 text-muted"
                    title="Preview"
                  >
                    <i className="ti ti-eye" style={{ fontSize: 13 }} />
                  </a>
                  <button
                    type="button"
                    className="btn btn-link btn-sm p-0 text-danger"
                    title="Delete"
                    disabled={saving}
                    onClick={() => handleDeleteExistingPdf(pdf.id)}
                  >
                    <i className="ti ti-trash" style={{ fontSize: 13 }} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted small mb-2">No course materials uploaded yet.</p>
          )}

          {/* New PDFs to add */}
          {newPdfs.length > 0 && (
            <div className="border rounded mb-2" style={{ background: "#f0f7ff" }}>
              {newPdfs.map((pdf, idx) => (
                <div
                  key={idx}
                  className="d-flex align-items-center gap-2 px-3 py-2"
                  style={{ borderBottom: idx < newPdfs.length - 1 ? "1px solid #d0e4ff" : "none" }}
                >
                  <i className="ti ti-file-type-pdf text-danger" style={{ fontSize: 16 }} />
                  <span className="flex-grow-1 text-truncate" style={{ fontSize: 12 }}>
                    {pdf.name}
                  </span>
                  <span className="badge bg-primary-subtle text-primary" style={{ fontSize: 10 }}>new</span>
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
                    onClick={() => setNewPdfs((prev) => prev.filter((_, i) => i !== idx))}
                  >
                    <i className="ti ti-x" style={{ fontSize: 13 }} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <button
            type="button"
            className="btn btn-outline-secondary btn-sm"
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
              setNewPdfs((prev) => [...prev, ...files]);
              if (pdfInputRef.current) pdfInputRef.current.value = "";
            }}
          />
        </div>

        {/* Footer buttons */}
        <div className="d-flex justify-content-end gap-2">
          <button
            type="button"
            className="btn btn-light border"
            onClick={handleClose}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary d-inline-flex align-items-center gap-2"
            disabled={saving || !formik.isValid}
          >
            {saving && <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />}
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default EditCourseModal;
