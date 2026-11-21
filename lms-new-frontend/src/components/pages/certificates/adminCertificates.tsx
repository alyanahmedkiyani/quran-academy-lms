"use client";

import { useEffect, useRef, useState } from "react";
import { Input, Table, Popover, Select as AntSelect } from "antd";
import type { ColumnsType } from "antd/es/table";
import CommonSelect, { Option as SelectOption } from "@/core/common/common-select/commonSelect";
import ConfirmationModal from "@/core/common/modals/confirmationModal";
import { useNotification } from "@/hooks/useNotification";
import { useAppSelector } from "@/core/redux/hooks";
import { canAccess, PERMISSIONS } from "@/lib/permissions";
import { usePermissionGuard } from "@/lib/usePermissionGuard";
import {
  getAllCertificates,
  createCertificate,
  bulkCreateCertificates,
  issueCertificateNow,
  uploadCertificateImage,
  revokeCertificate,
  restoreCertificate,
  deleteCertificate,
} from "@/services/certificateService";
import { fetchAllStudents } from "@/services/studentService";
import { fetchAllCourses } from "@/services/courseService";
import type { Certificate } from "@/types/certificate";
import type { Student } from "@/types/student";
import { media_base_url, resolveImageUrl } from "@/environment";

async function downloadFile(url: string, filename: string) {
  const res = await fetch(url);
  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(blobUrl);
}

interface CourseOption { id: number; courseName: string }

// ── Status Badge ──────────────────────────────────────────────────────────────

const StatusBadge = ({ status }: { status: string }) => {
  if (status === "upcoming")
    return (
      <span className="badge badge-soft-warning border border-warning fw-medium">
        <i className="ti ti-clock me-1" />Upcoming
      </span>
    );
  if (status === "issued")
    return (
      <span className="badge badge-soft-success border border-success fw-medium">
        <i className="ti ti-circle-check me-1" />Issued
      </span>
    );
  return (
    <span className="badge badge-soft-danger border border-danger fw-medium">
      <i className="ti ti-ban me-1" />Revoked
    </span>
  );
};

// ── Create Certificate Modal ──────────────────────────────────────────────────

interface CreateModalProps {
  open: boolean;
  students: Student[];
  courses: CourseOption[];
  onClose: () => void;
  onCreated: (cert: Certificate) => void;
}

const CreateCertificateModal = ({ open, students, courses, onClose, onCreated }: CreateModalProps) => {
  const notify = useNotification();
  const fileRef = useRef<HTMLInputElement>(null);
  const [selectedStudent, setSelectedStudent] = useState<SelectOption | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<SelectOption | null>(null);
  const [certStatus, setCertStatus] = useState<"issued" | "upcoming">("issued");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setSelectedStudent(null);
      setSelectedCourse(null);
      setCertStatus("issued");
      setNotes("");
      setFile(null);
      setPreview(null);
      setError(null);
    }
  }, [open]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    if (f) {
      const reader = new FileReader();
      reader.onload = (ev) => setPreview(ev.target?.result as string);
      reader.readAsDataURL(f);
    } else {
      setPreview(null);
    }
  };

  const handleSubmit = async () => {
    setError(null);
    if (!selectedStudent || !selectedCourse) {
      setError("Please select both a student and a course.");
      return;
    }
    setLoading(true);
    try {
      const cert = await createCertificate({
        courseId: selectedCourse.value,
        studentId: selectedStudent.value,
        status: certStatus,
        notes: notes.trim() || undefined,
        file,
      });
      notify.success(certStatus === "upcoming" ? "Upcoming certificate created." : "Certificate issued successfully.");
      onCreated(cert);
    } catch (err: unknown) {
      setError((err as { message?: string })?.message ?? "Failed to create certificate.");
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="modal show d-block" style={{ backgroundColor: "rgba(0,0,0,0.5)", zIndex: 1050 }}>
      <div className="modal-dialog modal-lg modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title fw-bold">
              <i className="ti ti-certificate me-2 text-primary" />
              {certStatus === "upcoming" ? "Create Upcoming Certificate" : "Issue Certificate"}
            </h5>
            <button type="button" className="btn-close" onClick={onClose} disabled={loading} />
          </div>
          <div className="modal-body">
            {error && <div className="alert alert-danger py-2 mb-3">{error}</div>}

            {/* Issue type toggle */}
            <div className="mb-4 p-3 rounded" style={{ background: "#f8f9fa" }}>
              <label className="form-label fw-medium d-block mb-2">Certificate Type</label>
              <div className="d-flex gap-2 flex-wrap">
                <button
                  type="button"
                  className={`btn btn-sm ${certStatus === "issued" ? "btn-success" : "btn-outline-success"}`}
                  onClick={() => setCertStatus("issued")}
                >
                  <i className="ti ti-circle-check me-1" />
                  Issue Now
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${certStatus === "upcoming" ? "btn-warning" : "btn-outline-warning"}`}
                  onClick={() => setCertStatus("upcoming")}
                >
                  <i className="ti ti-clock me-1" />
                  Mark as Upcoming
                </button>
              </div>
              <small className="text-muted mt-2 d-block">
                {certStatus === "issued"
                  ? "Certificate will be immediately visible and downloadable by the student."
                  : "Student sees a 'Coming Soon' preview. You can officially issue it later when ready."}
              </small>
            </div>

            <div className="row g-3">
              <div className="col-md-6">
                <label className="form-label fw-medium">
                  Student <span className="text-danger">*</span>
                </label>
                <CommonSelect
                  options={students.map((s) => ({ value: String(s.id), label: `${s.firstName} ${s.lastName}` }))}
                  value={selectedStudent}
                  onChange={setSelectedStudent}
                  placeholder="Select student"
                  isClearable
                />
              </div>

              <div className="col-md-6">
                <label className="form-label fw-medium">
                  Course <span className="text-danger">*</span>
                </label>
                <CommonSelect
                  options={courses.map((c) => ({ value: String(c.id), label: c.courseName }))}
                  value={selectedCourse}
                  onChange={setSelectedCourse}
                  placeholder="Select course"
                  isClearable
                />
              </div>

              <div className="col-12">
                <label className="form-label fw-medium">
                  Certificate Image
                  {certStatus === "upcoming" && (
                    <span className="text-muted fw-normal ms-1 fs-12">(optional — upload later)</span>
                  )}
                </label>
                <div
                  className="border rounded p-3 text-center"
                  style={{ cursor: "pointer", borderStyle: "dashed" }}
                  onClick={() => fileRef.current?.click()}
                >
                  {preview ? (
                    <img
                      src={preview}
                      alt="Preview"
                      style={{ maxHeight: 200, maxWidth: "100%", objectFit: "contain" }}
                    />
                  ) : (
                    <div className="text-muted py-3">
                      <i className="ti ti-photo-up fs-32 d-block mb-2" />
                      <span style={{ fontSize: 13 }}>Click to upload certificate image (PNG, JPG)</span>
                    </div>
                  )}
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpg,image/jpeg"
                  className="d-none"
                  onChange={handleFileChange}
                />
                {file && (
                  <div className="d-flex align-items-center gap-2 mt-2">
                    <i className="ti ti-file-check text-success" />
                    <small className="text-muted">{file.name}</small>
                    <button
                      type="button"
                      className="btn btn-link btn-sm p-0 text-danger ms-auto"
                      onClick={() => {
                        setFile(null);
                        setPreview(null);
                        if (fileRef.current) fileRef.current.value = "";
                      }}
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>

              <div className="col-12">
                <label className="form-label fw-medium">Notes</label>
                <textarea
                  className="form-control"
                  rows={2}
                  placeholder="Optional notes…"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline-secondary" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button
              type="button"
              className={`btn ${certStatus === "upcoming" ? "btn-warning" : "btn-primary"}`}
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <span className="spinner-border spinner-border-sm me-1" />
              ) : (
                <i className={`ti ${certStatus === "upcoming" ? "ti-clock" : "ti-certificate"} me-1`} />
              )}
              {certStatus === "upcoming" ? "Save as Upcoming" : "Issue Certificate"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Replace Image Modal ───────────────────────────────────────────────────────

interface ReplaceImageModalProps {
  open: boolean;
  cert: Certificate | null;
  onClose: () => void;
  onUpdated: (imageUrl: string) => void;
}

const ReplaceImageModal = ({ open, cert, onClose, onUpdated }: ReplaceImageModalProps) => {
  const notify = useNotification();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) { setFile(null); setPreview(null); }
  }, [open]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    if (f) {
      const reader = new FileReader();
      reader.onload = (ev) => setPreview(ev.target?.result as string);
      reader.readAsDataURL(f);
    } else {
      setPreview(null);
    }
  };

  const handleSave = async () => {
    if (!cert || !file) return;
    setLoading(true);
    try {
      const result = await uploadCertificateImage(cert.id, file);
      notify.success("Certificate image updated.");
      onUpdated(result.templateImageUrl);
    } catch (err: unknown) {
      notify.error((err as { message?: string })?.message ?? "Failed to update image.");
    } finally {
      setLoading(false);
    }
  };

  if (!open || !cert) return null;

  return (
    <div className="modal show d-block" style={{ backgroundColor: "rgba(0,0,0,0.5)", zIndex: 1050 }}>
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title fw-bold">Replace Certificate Image</h5>
            <button type="button" className="btn-close" onClick={onClose} disabled={loading} />
          </div>
          <div className="modal-body">
            <div
              className="border rounded p-3 text-center"
              style={{ cursor: "pointer", borderStyle: "dashed" }}
              onClick={() => fileRef.current?.click()}
            >
              {preview ? (
                <img src={preview} alt="Preview" style={{ maxHeight: 200, maxWidth: "100%", objectFit: "contain" }} />
              ) : (
                <div className="text-muted py-3">
                  <i className="ti ti-photo-up fs-32 d-block mb-2" />
                  <span style={{ fontSize: 13 }}>Click to select new image</span>
                </div>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpg,image/jpeg"
              className="d-none"
              onChange={handleFileChange}
            />
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline-secondary" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary" onClick={handleSave} disabled={loading || !file}>
              {loading && <span className="spinner-border spinner-border-sm me-1" />}
              Save Image
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Bulk Create Modal ─────────────────────────────────────────────────────────

interface BulkCreateModalProps {
  open: boolean;
  students: Student[];
  courses: CourseOption[];
  onClose: () => void;
  onBulkCreated: (certs: Certificate[]) => void;
}

const BulkCreateModal = ({ open, students, courses, onClose, onBulkCreated }: BulkCreateModalProps) => {
  const notify = useNotification();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadTargetId = useRef<number | null>(null);

  const [phase, setPhase] = useState<"form" | "upload">("form");
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<SelectOption | null>(null);
  const [certStatus, setCertStatus] = useState<"issued" | "upcoming">("issued");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdCerts, setCreatedCerts] = useState<Certificate[]>([]);
  const [skipped, setSkipped] = useState<{ studentId: number; reason: string }[]>([]);
  const [uploadingId, setUploadingId] = useState<number | null>(null);

  useEffect(() => {
    if (!open) {
      setPhase("form");
      setSelectedStudentIds([]);
      setSelectedCourse(null);
      setCertStatus("issued");
      setNotes("");
      setError(null);
      setCreatedCerts([]);
      setSkipped([]);
    }
  }, [open]);

  const handleCreate = async () => {
    setError(null);
    if (!selectedCourse || selectedStudentIds.length === 0) {
      setError("Please select a course and at least one student.");
      return;
    }
    setLoading(true);
    try {
      const result = await bulkCreateCertificates({
        courseId: selectedCourse.value,
        studentIds: selectedStudentIds,
        status: certStatus,
        notes: notes.trim() || undefined,
      });
      onBulkCreated(result.created);
      setCreatedCerts(result.created);
      setSkipped(result.skipped);
      setPhase("upload");
      if (result.skipped.length > 0) {
        notify.warning(`${result.created.length} created, ${result.skipped.length} skipped (duplicates).`);
      } else {
        notify.success(`${result.created.length} certificate(s) created.`);
      }
    } catch (err: unknown) {
      setError((err as { message?: string })?.message ?? "Failed to create certificates.");
    } finally {
      setLoading(false);
    }
  };

  const handleUploadClick = (certId: number) => {
    uploadTargetId.current = certId;
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const certId = uploadTargetId.current;
    if (!file || !certId) return;
    e.target.value = "";
    setUploadingId(certId);
    try {
      const result = await uploadCertificateImage(certId, file);
      setCreatedCerts((prev) =>
        prev.map((c) => (c.id === certId ? { ...c, templateImageUrl: result.templateImageUrl } : c))
      );
      notify.success("Image uploaded.");
    } catch (err: unknown) {
      notify.error((err as { message?: string })?.message ?? "Failed to upload image.");
    } finally {
      setUploadingId(null);
    }
  };

  if (!open) return null;

  return (
    <div className="modal show d-block" style={{ backgroundColor: "rgba(0,0,0,0.5)", zIndex: 1050 }}>
      <div className="modal-dialog modal-lg modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title fw-bold">
              <i className="ti ti-copy me-2 text-primary" />
              {phase === "form" ? "Bulk Create Certificates" : "Upload Certificate Images"}
            </h5>
            <button type="button" className="btn-close" onClick={onClose} disabled={loading} />
          </div>

          <div className="modal-body">
            {phase === "form" ? (
              <>
                {error && <div className="alert alert-danger py-2 mb-3">{error}</div>}

                {/* Status toggle */}
                <div className="mb-4 p-3 rounded" style={{ background: "#f8f9fa" }}>
                  <label className="form-label fw-medium d-block mb-2">Certificate Type</label>
                  <div className="d-flex gap-2 flex-wrap">
                    <button
                      type="button"
                      className={`btn btn-sm ${certStatus === "issued" ? "btn-success" : "btn-outline-success"}`}
                      onClick={() => setCertStatus("issued")}
                    >
                      <i className="ti ti-circle-check me-1" />Issue Now
                    </button>
                    <button
                      type="button"
                      className={`btn btn-sm ${certStatus === "upcoming" ? "btn-warning" : "btn-outline-warning"}`}
                      onClick={() => setCertStatus("upcoming")}
                    >
                      <i className="ti ti-clock me-1" />Mark as Upcoming
                    </button>
                  </div>
                  <small className="text-muted mt-2 d-block">
                    {certStatus === "issued"
                      ? "All selected students will receive an issued certificate immediately."
                      : "Students will see a Coming Soon preview. You can issue them later."}
                  </small>
                </div>

                <div className="row g-3">
                  <div className="col-12">
                    <label className="form-label fw-medium">
                      Students <span className="text-danger">*</span>
                      {selectedStudentIds.length > 0 && (
                        <span className="badge bg-primary ms-2">{selectedStudentIds.length} selected</span>
                      )}
                    </label>
                    <AntSelect
                      mode="multiple"
                      style={{ width: "100%" }}
                      placeholder="Select one or more students…"
                      value={selectedStudentIds}
                      onChange={setSelectedStudentIds}
                      options={students.map((s) => ({
                        value: String(s.id),
                        label: `${s.firstName} ${s.lastName}`,
                      }))}
                      optionFilterProp="label"
                      maxTagCount="responsive"
                      size="large"
                      dropdownStyle={{ zIndex: 1060 }}
                    />
                  </div>

                  <div className="col-12">
                    <label className="form-label fw-medium">
                      Course <span className="text-danger">*</span>
                    </label>
                    <CommonSelect
                      options={courses.map((c) => ({ value: String(c.id), label: c.courseName }))}
                      value={selectedCourse}
                      onChange={setSelectedCourse}
                      placeholder="Select course"
                      isClearable
                    />
                  </div>

                  <div className="col-12">
                    <label className="form-label fw-medium">Notes</label>
                    <textarea
                      className="form-control"
                      rows={2}
                      placeholder="Optional notes applied to all certificates…"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                  </div>
                </div>
              </>
            ) : (
              <>
                {skipped.length > 0 && (
                  <div className="alert alert-warning py-2 mb-3">
                    <i className="ti ti-alert-triangle me-1" />
                    <strong>{skipped.length}</strong> student(s) skipped — already have an active certificate for this course.
                  </div>
                )}
                <p className="text-muted mb-3" style={{ fontSize: 13 }}>
                  <i className="ti ti-info-circle me-1" />
                  Upload a certificate image for each student now, or close and do it later via the main table.
                </p>
                <div className="table-responsive">
                  <table className="table table-sm align-middle mb-0">
                    <thead className="table-light">
                      <tr>
                        <th style={{ width: 60 }}>Image</th>
                        <th>Student</th>
                        <th>Status</th>
                        <th style={{ width: 140 }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {createdCerts.map((cert) => {
                        const src = cert.templateImageUrl ? `${resolveImageUrl(cert.templateImageUrl)}` : null;
                        const isUploading = uploadingId === cert.id;
                        return (
                          <tr key={cert.id}>
                            <td>
                              {src ? (
                                <img
                                  src={src}
                                  alt="cert"
                                  style={{ width: 48, height: 34, objectFit: "cover", borderRadius: 4 }}
                                />
                              ) : (
                                <div
                                  className="d-flex align-items-center justify-content-center bg-light rounded"
                                  style={{ width: 48, height: 34 }}
                                >
                                  <i className="ti ti-certificate text-muted fs-16" />
                                </div>
                              )}
                            </td>
                            <td>
                              <div className="d-flex align-items-center gap-2">
                                {cert.Student?.profileImg ? (
                                  <img
                                    src={`${media_base_url}/${cert.Student.profileImg}`}
                                    alt=""
                                    width={28} height={28}
                                    style={{ borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
                                  />
                                ) : (
                                  <span
                                    className="d-flex align-items-center justify-content-center bg-primary text-white fw-bold"
                                    style={{ width: 28, height: 28, borderRadius: "50%", fontSize: 10, flexShrink: 0 }}
                                  >
                                    {cert.Student?.firstName?.[0]}{cert.Student?.lastName?.[0]}
                                  </span>
                                )}
                                <span className="fw-semibold">{cert.Student?.firstName} {cert.Student?.lastName}</span>
                              </div>
                            </td>
                            <td>
                              <StatusBadge status={cert.status} />
                            </td>
                            <td>
                              <button
                                type="button"
                                className={`btn btn-sm ${src ? "btn-outline-primary" : "btn-primary"}`}
                                onClick={() => handleUploadClick(cert.id)}
                                disabled={isUploading}
                              >
                                {isUploading ? (
                                  <span className="spinner-border spinner-border-sm me-1" />
                                ) : (
                                  <i className="ti ti-photo-up me-1" />
                                )}
                                {src ? "Replace" : "Upload Image"}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpg,image/jpeg"
                  className="d-none"
                  onChange={handleFileSelected}
                />
              </>
            )}
          </div>

          <div className="modal-footer">
            {phase === "form" ? (
              <>
                <button type="button" className="btn btn-outline-secondary" onClick={onClose} disabled={loading}>
                  Cancel
                </button>
                <button
                  type="button"
                  className={`btn ${certStatus === "upcoming" ? "btn-warning" : "btn-primary"}`}
                  onClick={handleCreate}
                  disabled={loading || selectedStudentIds.length === 0 || !selectedCourse}
                >
                  {loading ? (
                    <span className="spinner-border spinner-border-sm me-1" />
                  ) : (
                    <i className="ti ti-certificate me-1" />
                  )}
                  Create {selectedStudentIds.length > 1 ? `${selectedStudentIds.length} ` : ""}
                  Certificate{selectedStudentIds.length !== 1 ? "s" : ""}
                </button>
              </>
            ) : (
              <button type="button" className="btn btn-success" onClick={onClose}>
                <i className="ti ti-check me-1" />
                Done
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────

type TabKey = "all" | "upcoming" | "issued" | "revoked";

interface CertificateRow {
  key: string;
  serial: number;
  studentName: string;
  studentProfileImg: string | null;
  courseName: string;
  issuedAt: string;
  status: string;
  templateImageUrl: string | null;
  raw: Certificate;
}

const AdminCertificates = () => {
  const notify = useNotification();
  const user = useAppSelector((state) => state.auth.user);

  usePermissionGuard(PERMISSIONS.CERTIFICATES_VIEW);
  const roleName = user?.role?.name ?? null;
  const permissions = user?.permissions ?? [];
  const canManage = canAccess(roleName, permissions, PERMISSIONS.CERTIFICATES_MANAGE);

  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<TabKey>("all");

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showBulkCreateModal, setShowBulkCreateModal] = useState(false);
  const [replaceTarget, setReplaceTarget] = useState<Certificate | null>(null);
  const [issueTarget, setIssueTarget] = useState<Certificate | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<Certificate | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<Certificate | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Certificate | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [certs, studentsRes, coursesRes] = await Promise.all([
        getAllCertificates(),
        fetchAllStudents(),
        fetchAllCourses(),
      ]);
      setCertificates(certs);
      setStudents(studentsRes.students ?? []);
      setCourses((coursesRes.courses ?? []).map((c) => ({ id: Number(c.id), courseName: c.courseName })));
    } catch (err: unknown) {
      notify.error((err as { message?: string })?.message ?? "Failed to load data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const counts = {
    all: certificates.length,
    upcoming: certificates.filter((c) => c.status === "upcoming").length,
    issued: certificates.filter((c) => c.status === "issued").length,
    revoked: certificates.filter((c) => c.status === "revoked").length,
  };

  const filtered = certificates.filter((c) => {
    const name = c.Student ? `${c.Student.firstName} ${c.Student.lastName}`.toLowerCase() : "";
    const course = c.Course?.courseName?.toLowerCase() ?? "";
    const matchesSearch =
      !searchTerm || name.includes(searchTerm.toLowerCase()) || course.includes(searchTerm.toLowerCase());
    const matchesTab = activeTab === "all" || c.status === activeTab;
    return matchesSearch && matchesTab;
  });

  const tableData: CertificateRow[] = filtered.map((c, idx) => ({
    key: String(c.id),
    serial: idx + 1,
    studentName: c.Student ? `${c.Student.firstName} ${c.Student.lastName}` : `Student #${c.studentId}`,
    studentProfileImg: c.Student?.profileImg ?? null,
    courseName: c.Course?.courseName ?? `Course #${c.courseId}`,
    issuedAt: c.issuedAt
      ? new Date(c.issuedAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
      : "—",
    status: c.status,
    templateImageUrl: c.templateImageUrl,
    raw: c,
  }));

  const handleCreated = (cert: Certificate) => {
    setCertificates((prev) => [cert, ...prev]);
    setShowCreateModal(false);
  };

  const handleBulkCreated = (certs: Certificate[]) => {
    setCertificates((prev) => [...certs, ...prev]);
  };

  const handleImageUpdated = (id: number, imageUrl: string) => {
    setCertificates((prev) => prev.map((c) => (c.id === id ? { ...c, templateImageUrl: imageUrl } : c)));
    setReplaceTarget(null);
  };

  const handleIssueNow = async () => {
    if (!issueTarget) return;
    setActionLoading(true);
    try {
      const updated = await issueCertificateNow(issueTarget.id);
      setCertificates((prev) => prev.map((c) => (c.id === issueTarget.id ? updated : c)));
      notify.success("Certificate issued successfully.");
      setIssueTarget(null);
    } catch (err: unknown) {
      notify.error((err as { message?: string })?.message ?? "Failed to issue certificate.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRevoke = async () => {
    if (!revokeTarget) return;
    setActionLoading(true);
    try {
      await revokeCertificate(revokeTarget.id);
      setCertificates((prev) =>
        prev.map((c) => (c.id === revokeTarget.id ? { ...c, status: "revoked" as const } : c))
      );
      notify.success("Certificate revoked.");
      setRevokeTarget(null);
    } catch (err: unknown) {
      notify.error((err as { message?: string })?.message ?? "Failed to revoke.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRestore = async () => {
    if (!restoreTarget) return;
    setActionLoading(true);
    try {
      await restoreCertificate(restoreTarget.id);
      setCertificates((prev) =>
        prev.map((c) => (c.id === restoreTarget.id ? { ...c, status: "issued" as const } : c))
      );
      notify.success("Certificate restored successfully.");
      setRestoreTarget(null);
    } catch (err: unknown) {
      notify.error((err as { message?: string })?.message ?? "Failed to restore.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setActionLoading(true);
    try {
      await deleteCertificate(deleteTarget.id);
      setCertificates((prev) => prev.filter((c) => c.id !== deleteTarget.id));
      notify.success("Certificate deleted.");
      setDeleteTarget(null);
    } catch (err: unknown) {
      notify.error((err as { message?: string })?.message ?? "Failed to delete.");
    } finally {
      setActionLoading(false);
    }
  };

  const columns: ColumnsType<CertificateRow> = [
    {
      title: "#",
      dataIndex: "serial",
      key: "serial",
      width: 55,
      render: (v) => <span className="text-muted">{v}</span>,
    },
    {
      title: "Certificate",
      dataIndex: "templateImageUrl",
      key: "img",
      width: 90,
      render: (url: string | null, record) => {
        const src = url ? `${resolveImageUrl(url)}` : null;
        if (record.status === "upcoming" && !src) {
          return (
            <div
              className="d-flex align-items-center justify-content-center rounded"
              style={{
                width: 56, height: 40,
                background: "linear-gradient(135deg,#fef3c7,#fde68a)",
                border: "1px dashed #f59e0b",
              }}
              title="Image not yet uploaded"
            >
              <i className="ti ti-clock" style={{ color: "#f59e0b", fontSize: 16 }} />
            </div>
          );
        }
        if (!src) {
          return (
            <div className="d-flex align-items-center justify-content-center bg-light rounded" style={{ width: 56, height: 40 }}>
              <i className="ti ti-certificate text-muted fs-18" />
            </div>
          );
        }
        return (
          <Popover content={<img src={src} alt="Certificate" style={{ maxWidth: 280, maxHeight: 200, objectFit: "contain" }} />}>
            <img src={src} alt="Certificate" style={{ width: 56, height: 40, objectFit: "cover", borderRadius: 6, cursor: "pointer" }} />
          </Popover>
        );
      },
    },
    {
      title: "Student",
      dataIndex: "studentName",
      key: "studentName",
      render: (v, row) => (
        <div className="d-flex align-items-center gap-2">
          {row.studentProfileImg ? (
            <img
              src={`${media_base_url}/${row.studentProfileImg}`}
              alt=""
              width={32} height={32}
              style={{ borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
            />
          ) : (
            <span
              className="d-flex align-items-center justify-content-center bg-primary text-white fw-bold"
              style={{ width: 32, height: 32, borderRadius: "50%", fontSize: 11, flexShrink: 0 }}
            >
              {v.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2)}
            </span>
          )}
          <span className="fw-semibold">{v}</span>
        </div>
      ),
    },
    {
      title: "Course",
      dataIndex: "courseName",
      key: "courseName",
      render: (v) => <span className="text-muted">{v}</span>,
    },
    {
      title: "Issued Date",
      dataIndex: "issuedAt",
      key: "issuedAt",
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (status: string) => <StatusBadge status={status} />,
    },
    {
      title: "Actions",
      key: "actions",
      width: 200,
      render: (_, record) => (
        <div className="d-flex gap-1 flex-nowrap align-items-center">
          {/* Download — only if image exists */}
          {record.templateImageUrl && (
            <button
              type="button"
              className="btn btn-outline-info btn-icon btn-sm"
              title="Download Certificate"
              onClick={() => {
                const url = `${resolveImageUrl(record.templateImageUrl)}`;
                const name = `${record.studentName}-${record.courseName}-certificate.jpg`;
                downloadFile(url, name).catch(() => {});
              }}
            >
              <i className="ti ti-download" />
            </button>
          )}
          {canManage && (
            <>
              {/* Issue Now — upcoming only */}
              {record.status === "upcoming" && (
                <button
                  type="button"
                  className="btn btn-success btn-sm d-inline-flex align-items-center gap-1 px-2"
                  title="Issue Now"
                  onClick={() => setIssueTarget(record.raw)}
                >
                  <i className="ti ti-certificate fs-14" />
                  <span style={{ fontSize: 11 }}>Issue</span>
                </button>
              )}
              {/* Replace image */}
              <button
                type="button"
                className="btn btn-outline-primary btn-icon btn-sm"
                title="Replace Image"
                onClick={() => setReplaceTarget(record.raw)}
              >
                <i className="ti ti-photo-edit" />
              </button>
              {/* Revoke — issued only */}
              {record.status === "issued" && (
                <button
                  type="button"
                  className="btn btn-outline-warning btn-icon btn-sm"
                  title="Revoke"
                  onClick={() => setRevokeTarget(record.raw)}
                >
                  <i className="ti ti-ban" />
                </button>
              )}
              {/* Restore — revoked only */}
              {record.status === "revoked" && (
                <button
                  type="button"
                  className="btn btn-outline-success btn-icon btn-sm"
                  title="Restore"
                  onClick={() => setRestoreTarget(record.raw)}
                >
                  <i className="ti ti-restore" />
                </button>
              )}
              {/* Delete */}
              <button
                type="button"
                className="btn btn-outline-danger btn-icon btn-sm"
                title="Delete"
                onClick={() => setDeleteTarget(record.raw)}
              >
                <i className="ti ti-trash" />
              </button>
            </>
          )}
        </div>
      ),
    },
  ];

  const tabs: { key: TabKey; label: string; icon: string }[] = [
    { key: "all",      label: "All",      icon: "ti-list" },
    { key: "upcoming", label: "Upcoming", icon: "ti-clock" },
    { key: "issued",   label: "Issued",   icon: "ti-circle-check" },
    { key: "revoked",  label: "Revoked",  icon: "ti-ban" },
  ];

  return (
    <div className="page-wrapper">
      <div className="content">
        {/* Header */}
        <div className="d-flex align-items-sm-center flex-sm-row flex-column gap-2 pb-3 mb-3">
          <div className="flex-grow-1">
            <h4 className="fw-bold mb-0">
              Certificates
              <span className="badge badge-soft-primary fw-medium border py-1 px-2 border-primary fs-13 ms-2">
                Total: {certificates.length}
              </span>
            </h4>
            <p className="text-muted mb-0 mt-1">Issue, schedule upcoming, and manage student certificates</p>
          </div>
          <div className="d-flex gap-2 flex-wrap">
            <button
              type="button"
              className="btn btn-outline-light border d-inline-flex align-items-center gap-1"
              onClick={loadData}
              disabled={loading}
            >
              <i className="ti ti-refresh" />
              Refresh
            </button>
            {canManage && (
              <>
                <button
                  type="button"
                  className="btn btn-outline-primary fs-13 btn-md"
                  onClick={() => setShowBulkCreateModal(true)}
                >
                  <i className="ti ti-copy me-1" />
                  Bulk Create
                </button>
                <button
                  type="button"
                  className="btn btn-primary fs-13 btn-md"
                  onClick={() => setShowCreateModal(true)}
                >
                  <i className="ti ti-plus me-1" />
                  Add Certificate
                </button>
              </>
            )}
          </div>
        </div>

        {/* Tabs */}
        <ul className="nav nav-tabs mb-0" style={{ borderBottom: "none" }}>
          {tabs.map((tab) => (
            <li key={tab.key} className="nav-item">
              <button
                type="button"
                className={`nav-link ${activeTab === tab.key ? "active" : ""}`}
                onClick={() => setActiveTab(tab.key)}
              >
                <i className={`ti ${tab.icon} me-1`} />
                {tab.label}
                <span
                  className={`badge ms-2 ${activeTab === tab.key ? "bg-primary" : "bg-secondary"}`}
                  style={{ fontSize: 11 }}
                >
                  {counts[tab.key]}
                </span>
              </button>
            </li>
          ))}
        </ul>

        {/* Filter + Table */}
        <div className="card" style={{ borderRadius: "0 8px 8px 8px", marginTop: 0 }}>
          <div className="card-body pb-2 border-bottom">
            <Input
              placeholder="Search by student name or course…"
              prefix={<i className="ti ti-search text-muted" />}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              allowClear
              size="large"
              style={{ borderWidth: "2px", boxShadow: "0 2px 4px rgba(0,0,0,0.1)", maxWidth: 480 }}
            />
          </div>
          <div className="card-body" style={{ paddingTop: 16 }}>
            {activeTab === "upcoming" && counts.upcoming > 0 && (
              <div className="alert alert-warning d-flex align-items-center gap-2 py-2 mb-3">
                <i className="ti ti-info-circle fs-18" />
                <span style={{ fontSize: 13 }}>
                  These certificates are <strong>not yet visible to students as issued</strong> — they see a
                  &ldquo;Coming Soon&rdquo; preview. Click <strong>Issue</strong> to release them.
                </span>
              </div>
            )}
            <Table<CertificateRow>
              className="table table-nowrap datatable"
              columns={columns}
              dataSource={tableData}
              rowKey="key"
              loading={loading}
              pagination={{ pageSize: 10, showSizeChanger: false }}
              scroll={{ x: 900 }}
              locale={{ emptyText: "No certificates found." }}
            />
          </div>
        </div>
      </div>

      {/* Bulk Create Modal */}
      <BulkCreateModal
        open={showBulkCreateModal}
        students={students}
        courses={courses}
        onClose={() => setShowBulkCreateModal(false)}
        onBulkCreated={handleBulkCreated}
      />

      {/* Create Modal */}
      <CreateCertificateModal
        open={showCreateModal}
        students={students}
        courses={courses}
        onClose={() => setShowCreateModal(false)}
        onCreated={handleCreated}
      />

      {/* Replace Image Modal */}
      <ReplaceImageModal
        open={!!replaceTarget}
        cert={replaceTarget}
        onClose={() => setReplaceTarget(null)}
        onUpdated={(url) => replaceTarget && handleImageUpdated(replaceTarget.id, url)}
      />

      {/* Issue Now Confirmation */}
      <ConfirmationModal
        open={!!issueTarget}
        title="Issue Certificate Now?"
        description={
          issueTarget ? (
            <>
              This will officially issue the certificate to{" "}
              <strong>
                {issueTarget.Student?.firstName} {issueTarget.Student?.lastName}
              </strong>{" "}
              for <strong>{issueTarget.Course?.courseName}</strong>. The student will immediately see it as issued.
            </>
          ) : undefined
        }
        confirmText="Issue Now"
        confirmVariant="primary"
        confirmLoading={actionLoading}
        icon={<i className="ti ti-certificate" />}
        onConfirm={handleIssueNow}
        onCancel={() => { if (!actionLoading) setIssueTarget(null); }}
      />

      {/* Revoke Confirmation */}
      <ConfirmationModal
        open={!!revokeTarget}
        title="Revoke Certificate?"
        description={
          revokeTarget ? (
            <>
              Revoke the certificate issued to{" "}
              <strong>
                {revokeTarget.Student?.firstName} {revokeTarget.Student?.lastName}
              </strong>
              ? The student will no longer be able to use it.
            </>
          ) : undefined
        }
        confirmText="Revoke"
        confirmVariant="warning"
        confirmLoading={actionLoading}
        icon={<i className="ti ti-ban" />}
        onConfirm={handleRevoke}
        onCancel={() => { if (!actionLoading) setRevokeTarget(null); }}
      />

      {/* Restore Confirmation */}
      <ConfirmationModal
        open={!!restoreTarget}
        title="Restore Certificate?"
        description={
          restoreTarget ? (
            <>
              Restore the revoked certificate for{" "}
              <strong>
                {restoreTarget.Student?.firstName} {restoreTarget.Student?.lastName}
              </strong>
              ? It will be marked as <strong>issued</strong> again and visible to the student.
            </>
          ) : undefined
        }
        confirmText="Restore"
        confirmVariant="primary"
        confirmLoading={actionLoading}
        icon={<i className="ti ti-restore" />}
        onConfirm={handleRestore}
        onCancel={() => { if (!actionLoading) setRestoreTarget(null); }}
      />

      {/* Delete Confirmation */}
      <ConfirmationModal
        open={!!deleteTarget}
        title="Delete Certificate?"
        description={<>Permanently delete this certificate? This cannot be undone.</>}
        confirmText="Delete"
        confirmVariant="danger"
        confirmLoading={actionLoading}
        icon={<i className="ti ti-trash" />}
        onConfirm={handleDelete}
        onCancel={() => { if (!actionLoading) setDeleteTarget(null); }}
      />
    </div>
  );
};

export default AdminCertificates;
