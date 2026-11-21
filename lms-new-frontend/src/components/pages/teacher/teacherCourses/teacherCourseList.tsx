"use client";

import { useEffect, useState } from "react";
import { useAppSelector } from "@/core/redux/hooks";
import { useTeacherCourses } from "@/hooks/useTeacherCourses";
import { media_base_url } from "@/environment";
import { CourseDetail } from "@/types/course";
import { getCoursePDFs, pdfViewUrl, type CoursePDF } from "@/services/coursePDFService";

// Group CourseDetail assignments by Course
interface CourseGroup {
  courseId: string;
  courseName: string;
  duration?: string;
  description?: string;
  imageUrl?: string | null;
  isComing?: boolean;
  students: {
    id: string;
    name: string;
    profileImg?: string | null;
    nameForTeacher?: string | null;
  }[];
}

const groupByCourse = (assignments: CourseDetail[]): CourseGroup[] => {
  const map = new Map<string, CourseGroup>();
  for (const a of assignments) {
    const cId = String(a.courseId);
    if (!map.has(cId)) {
      map.set(cId, {
        courseId: cId,
        courseName: a.Course?.courseName ?? `Course #${cId}`,
        duration: a.Course?.duration,
        description: a.Course?.description,
        imageUrl: a.Course?.imageUrl,
        isComing: a.Course?.isComing,
        students: [],
      });
    }
    if (a.Student) {
      map.get(cId)!.students.push({
        id: String(a.Student.id),
        name: a.Student.nameForTeacher?.trim()
          ? a.Student.nameForTeacher
          : `${a.Student.firstName} ${a.Student.lastName}`,
        profileImg: a.Student.profileImg,
        nameForTeacher: a.Student.nameForTeacher,
      });
    }
  }
  return Array.from(map.values());
};

const StudentAvatar = ({
  name,
  profileImg,
}: {
  name: string;
  profileImg?: string | null;
}) => {
  const src = profileImg
    ? `${media_base_url}/${profileImg}`
    : null;
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  if (src) {
    return (
      <div title={name} style={{ display: "inline-block" }}>
        <img
          src={src}
          alt={name}
          title={name}
          style={{
            width: 32,
            height: 32,
            borderRadius: "50%",
            objectFit: "cover",
            border: "2px solid #fff",
            marginLeft: -8,
          }}
        />
      </div>
    );
  }

  return (
    <div
      title={name}
      className="d-inline-flex align-items-center justify-content-center bg-primary text-white fw-bold"
      style={{
        width: 32,
        height: 32,
        borderRadius: "50%",
        fontSize: 11,
        border: "2px solid #fff",
        marginLeft: -8,
      }}
    >
      {initials}
    </div>
  );
};

// ─── PDF Viewer Modal ──────────────────────────────────────────────────────────
const PDFModal = ({
  courseId,
  courseName,
  onClose,
}: {
  courseId: number;
  courseName: string;
  onClose: () => void;
}) => {
  const [pdfs, setPdfs] = useState<CoursePDF[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCoursePDFs(courseId)
      .then(setPdfs)
      .catch(() => setPdfs([]))
      .finally(() => setLoading(false));
  }, [courseId]);

  return (
    <div
      className="modal show d-block"
      style={{ background: "rgba(0,0,0,0.5)", zIndex: 1055 }}
      onClick={onClose}
    >
      <div className="modal-dialog modal-dialog-centered" onClick={(e) => e.stopPropagation()}>
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title fw-bold">
              <i className="ti ti-file-type-pdf text-danger me-2" />
              {courseName} — Course PDFs
            </h5>
            <button type="button" className="btn-close" onClick={onClose} />
          </div>
          <div className="modal-body">
            {loading ? (
              <div className="text-center py-4">
                <div className="spinner-border spinner-border-sm text-primary" />
                <p className="fs-13 text-muted mt-2 mb-0">Loading PDFs…</p>
              </div>
            ) : pdfs.length === 0 ? (
              <div className="text-center py-4 text-muted">
                <i className="ti ti-file-off fs-40 mb-2 d-block" />
                <p className="fs-13 mb-0">No PDFs uploaded for this course yet.</p>
              </div>
            ) : (
              <div className="list-group list-group-flush">
                {pdfs.map((pdf) => (
                  <a
                    key={pdf.id}
                    href={pdfViewUrl(pdf.filePath)}
                    target="_blank"
                    rel="noreferrer"
                    className="list-group-item list-group-item-action d-flex align-items-center gap-2 px-0"
                  >
                    <i className="ti ti-file-type-pdf text-danger fs-20 flex-shrink-0" />
                    <span className="fs-14 flex-fill text-truncate">{pdf.originalName}</span>
                    <i className="ti ti-external-link text-muted fs-14 flex-shrink-0" />
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const TeacherCourseList = () => {
  const user = useAppSelector((state) => state.auth.user);
  const { teacherAssignments, loading, error, loadCourses } = useTeacherCourses();
  const [pdfModal, setPdfModal] = useState<{ courseId: number; courseName: string } | null>(null);

  useEffect(() => {
    if (user?.id) {
      loadCourses(String(user.id));
    }
  }, [user?.id]);

  const courseGroups = groupByCourse(teacherAssignments);

  return (
    <>
    <div className="page-wrapper">
      <div className="content">
        {/* Header */}
        <div className="d-flex align-items-sm-center flex-sm-row flex-column gap-2 pb-3 mb-3">
          <div className="flex-grow-1">
            <h4 className="fw-bold mb-0">
              My Courses
              {!loading && (
                <span className="badge badge-soft-primary fw-medium border py-1 px-2 border-primary fs-13 ms-2">
                  {courseGroups.length} course{courseGroups.length !== 1 ? "s" : ""}
                </span>
              )}
            </h4>
            <p className="text-muted mb-0 mt-1">Courses you are currently teaching</p>
          </div>
          <button
            type="button"
            className="btn btn-outline-light border d-inline-flex align-items-center gap-1"
            onClick={() => user?.id && loadCourses(String(user.id))}
            disabled={loading}
          >
            <i className="ti ti-refresh" />
            Refresh
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="alert alert-danger" role="alert">
            {error}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="d-flex justify-content-center align-items-center py-5">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
          </div>
        )}

        {/* Empty state */}
        {!loading && courseGroups.length === 0 && !error && (
          <div className="card">
            <div className="card-body text-center py-5">
              <i className="ti ti-book-off fs-48 text-muted mb-3 d-block" />
              <h5 className="fw-bold text-muted">No Courses Assigned Yet</h5>
              <p className="text-muted mb-0">
                You don't have any courses assigned. Contact your administrator to get started.
              </p>
            </div>
          </div>
        )}

        {/* Course Cards Grid */}
        {!loading && courseGroups.length > 0 && (
          <div className="row g-4">
            {courseGroups.map((group) => {
              const imageSrc = group.imageUrl
                ? `${media_base_url}/${group.imageUrl}`
                : null;

              return (
                <div key={group.courseId} className="col-lg-4 col-md-6">
                  <div className="card h-100 shadow-sm hover-shadow">
                    {/* Course Image */}
                    {imageSrc ? (
                      <img
                        src={imageSrc}
                        alt={group.courseName}
                        className="card-img-top"
                        style={{ height: 160, objectFit: "cover" }}
                      />
                    ) : (
                      <div
                        className="d-flex align-items-center justify-content-center bg-light"
                        style={{ height: 160 }}
                      >
                        <i className="ti ti-book fs-48 text-muted" />
                      </div>
                    )}

                    <div className="card-body d-flex flex-column">
                      {/* Status badge */}
                      <div className="mb-2">
                        {group.isComing ? (
                          <span className="badge badge-soft-warning border border-warning">
                            <i className="ti ti-clock me-1" />
                            Upcoming
                          </span>
                        ) : (
                          <span className="badge badge-soft-success border border-success">
                            <i className="ti ti-circle-check me-1" />
                            Active
                          </span>
                        )}
                      </div>

                      {/* Course Name */}
                      <h6 className="fw-bold mb-1">{group.courseName}</h6>

                      {/* Duration */}
                      {group.duration && (
                        <div className="d-flex align-items-center gap-1 mb-2">
                          <i className="ti ti-clock text-muted fs-14" />
                          <small className="text-muted">{group.duration}</small>
                        </div>
                      )}

                      {/* Description */}
                      {group.description && (
                        <p
                          className="text-muted mb-3"
                          style={{
                            fontSize: 13,
                            lineHeight: 1.5,
                            overflow: "hidden",
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                          }}
                        >
                          {group.description}
                        </p>
                      )}

                      <div className="mt-auto">
                        {/* Divider */}
                        <hr className="my-2" />

                        {/* Students section */}
                        <div className="d-flex align-items-center justify-content-between">
                          <span className="text-muted" style={{ fontSize: 13 }}>
                            <i className="ti ti-users me-1" />
                            {group.students.length} student{group.students.length !== 1 ? "s" : ""}
                          </span>
                          {/* Student avatars */}
                          {group.students.length > 0 && (
                            <div className="d-flex align-items-center" style={{ paddingLeft: 8 }}>
                              {group.students.slice(0, 4).map((s) => (
                                <StudentAvatar key={s.id} name={s.name} profileImg={s.profileImg} />
                              ))}
                              {group.students.length > 4 && (
                                <div
                                  className="d-inline-flex align-items-center justify-content-center bg-secondary text-white fw-bold"
                                  style={{
                                    width: 32,
                                    height: 32,
                                    borderRadius: "50%",
                                    fontSize: 11,
                                    border: "2px solid #fff",
                                    marginLeft: -8,
                                  }}
                                >
                                  +{group.students.length - 4}
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Student name list (visible if ≤3) */}
                        {group.students.length > 0 && group.students.length <= 3 && (
                          <div className="mt-2">
                            {group.students.map((s) => (
                              <div key={s.id} className="d-flex align-items-center gap-2 mb-1">
                                <i className="ti ti-user-circle text-muted fs-14" />
                                <small className="text-muted">{s.name}</small>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* View PDFs button */}
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary w-100 mt-3 d-flex align-items-center justify-content-center gap-1"
                          onClick={() =>
                            setPdfModal({ courseId: Number(group.courseId), courseName: group.courseName })
                          }
                        >
                          <i className="ti ti-eye fs-15" />
                          View Course PDFs
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>

    {pdfModal && (
      <PDFModal
        courseId={pdfModal.courseId}
        courseName={pdfModal.courseName}
        onClose={() => setPdfModal(null)}
      />
    )}
    </>
  );
};

export default TeacherCourseList;
