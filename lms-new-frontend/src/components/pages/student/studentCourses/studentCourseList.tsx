"use client";

import { useEffect, useState } from "react";
import { useAppSelector } from "@/core/redux/hooks";
import { useStudentCourses } from "@/hooks/useStudentCourses";
import { useEnrollment } from "@/hooks/useEnrollment";
import { media_base_url } from "@/environment";
import { CourseDetail } from "@/types/course";
import { getCoursePDFs, pdfViewUrl, type CoursePDF } from "@/services/coursePDFService";

// ─── Teacher Info sub-component ───────────────────────────────────────────────
const TeacherInfo = ({ assignment }: { assignment: CourseDetail }) => {
  const teacher = assignment.Teacher;
  if (!teacher) return <span className="text-muted">No teacher assigned</span>;

  const imageSrc = teacher.imageUrl
    ? `${media_base_url}/${teacher.imageUrl}`
    : null;
  const name = `${teacher.firstName} ${teacher.lastName}`;
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="d-flex align-items-center gap-2">
      {imageSrc ? (
        <img
          src={imageSrc}
          alt={name}
          style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover" }}
        />
      ) : (
        <div
          className="d-flex align-items-center justify-content-center bg-primary text-white fw-bold"
          style={{ width: 36, height: 36, borderRadius: "50%", fontSize: 12 }}
        >
          {initials}
        </div>
      )}
      <div>
        <div className="fw-medium" style={{ fontSize: 13 }}>
          {name}
        </div>
        <div className="text-muted" style={{ fontSize: 11 }}>
          Teacher
        </div>
      </div>
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

// ─── Main Component ────────────────────────────────────────────────────────────
const StudentCourseList = () => {
  const user = useAppSelector((state) => state.auth.user);
  const [pdfModal, setPdfModal] = useState<{ courseId: number; courseName: string } | null>(null);

  // My assigned courses
  const { studentAssignments, loading: assignedLoading, error: assignedError, loadCourses } =
    useStudentCourses();

  // Upcoming courses + enrollment
  const {
    upcomingCourses,
    upcomingLoading,
    upcomingError,
    enrollStatus,
    enrollError,
    enrollingCourseId,
    loadUpcomingCourses,
    loadStudentEnrollments,
    enroll,
    isEnrolled,
    clearEnrollStatus,
  } = useEnrollment();

  const [activeTab, setActiveTab] = useState<"assigned" | "upcoming">("assigned");
  const [enrollFeedback, setEnrollFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  useEffect(() => {
    if (user?.id) {
      loadCourses(String(user.id));
      loadStudentEnrollments(String(user.id));
      loadUpcomingCourses();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Handle enroll feedback — also refresh Tab 1 since backend now auto-creates CourseDetails
  useEffect(() => {
    if (enrollStatus === "succeeded") {
      setEnrollFeedback({
        type: "success",
        message: "Successfully enrolled! The course has been added to your Enrolled Courses.",
      });
      if (user?.id) loadCourses(String(user.id));
      clearEnrollStatus();
      const t = setTimeout(() => setEnrollFeedback(null), 4000);
      return () => clearTimeout(t);
    }
    if (enrollStatus === "failed" && enrollError) {
      setEnrollFeedback({ type: "error", message: enrollError });
      clearEnrollStatus();
      const t = setTimeout(() => setEnrollFeedback(null), 5000);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enrollStatus, enrollError]);

  const handleEnroll = (courseId: string | number) => {
    if (!user?.id) return;
    enroll({ courseId, studentId: user.id });
  };

  return (
    <>
    <div className="page-wrapper">
      <div className="content">
        {/* Header */}
        <div className="d-flex align-items-sm-center flex-sm-row flex-column gap-2 pb-3 mb-3">
          <div className="flex-grow-1">
            <h4 className="fw-bold mb-0">My Courses</h4>
            <p className="text-muted mb-0 mt-1">Your learning journey</p>
          </div>
        </div>

        {/* Tabs */}
        <ul className="nav nav-tabs mb-4">
          <li className="nav-item">
            <button
              type="button"
              className={`nav-link ${activeTab === "assigned" ? "active" : ""}`}
              onClick={() => setActiveTab("assigned")}
            >
              <i className="ti ti-book me-1" />
              Enrolled Courses
              {!assignedLoading && (
                <span
                  className={`badge ms-2 ${activeTab === "assigned" ? "bg-primary" : "bg-secondary"}`}
                  style={{ fontSize: 11 }}
                >
                  {studentAssignments.length}
                </span>
              )}
            </button>
          </li>
          <li className="nav-item">
            <button
              type="button"
              className={`nav-link ${activeTab === "upcoming" ? "active" : ""}`}
              onClick={() => setActiveTab("upcoming")}
            >
              <i className="ti ti-calendar me-1" />
              Available Upcoming
              {!upcomingLoading && (
                <span
                  className={`badge ms-2 ${activeTab === "upcoming" ? "bg-primary" : "bg-secondary"}`}
                  style={{ fontSize: 11 }}
                >
                  {upcomingCourses.length}
                </span>
              )}
            </button>
          </li>
        </ul>

        {/* Enrollment feedback banner */}
        {enrollFeedback && (
          <div
            className={`alert alert-${enrollFeedback.type === "success" ? "success" : "danger"} d-flex align-items-center gap-2`}
            role="alert"
          >
            <i
              className={`ti ${enrollFeedback.type === "success" ? "ti-circle-check" : "ti-alert-circle"} fs-18`}
            />
            {enrollFeedback.message}
          </div>
        )}

        {/* ── Tab: Enrolled (Assigned) Courses ────────────────────────── */}
        {activeTab === "assigned" && (
          <>
            <div className="d-flex justify-content-end mb-3">
              <button
                type="button"
                className="btn btn-outline-light border d-inline-flex align-items-center gap-1"
                onClick={() => user?.id && loadCourses(String(user.id))}
                disabled={assignedLoading}
              >
                <i className="ti ti-refresh" />
                Refresh
              </button>
            </div>

            {assignedError && <div className="alert alert-danger">{assignedError}</div>}

            {assignedLoading && (
              <div className="d-flex justify-content-center align-items-center py-5">
                <div className="spinner-border text-primary" role="status">
                  <span className="visually-hidden">Loading...</span>
                </div>
              </div>
            )}

            {!assignedLoading && studentAssignments.length === 0 && !assignedError && (
              <div className="card">
                <div className="card-body text-center py-5">
                  <i className="ti ti-book-off fs-48 text-muted mb-3 d-block" />
                  <h5 className="fw-bold text-muted">No Courses Enrolled</h5>
                  <p className="text-muted mb-0">
                    You are not enrolled in any courses yet. Check{" "}
                    <button
                      type="button"
                      className="btn btn-link p-0 fw-medium"
                      onClick={() => setActiveTab("upcoming")}
                    >
                      Available Upcoming
                    </button>{" "}
                    to enroll in upcoming courses.
                  </p>
                </div>
              </div>
            )}

            {!assignedLoading && studentAssignments.length > 0 && (
              <div className="row g-4">
                {studentAssignments.map((assignment) => {
                  const course = assignment.Course;
                  const courseName = course?.courseName ?? `Course #${assignment.courseId}`;
                  const imageSrc = course?.imageUrl
                    ? `${media_base_url}/${course.imageUrl}`
                    : null;

                  return (
                    <div key={String(assignment.id)} className="col-lg-4 col-md-6">
                      <div className="card h-100 shadow-sm">
                        {imageSrc ? (
                          <img
                            src={imageSrc}
                            alt={courseName}
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
                          <div className="mb-2">
                            {course?.isComing ? (
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
                          <h6 className="fw-bold mb-1">{courseName}</h6>
                          {course?.duration && (
                            <div className="d-flex align-items-center gap-1 mb-2">
                              <i className="ti ti-clock text-muted fs-14" />
                              <small className="text-muted">{course.duration}</small>
                            </div>
                          )}
                          {course?.description && (
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
                              {course.description}
                            </p>
                          )}
                          <div className="mt-auto">
                            <hr className="my-2" />
                            <TeacherInfo assignment={assignment} />
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-primary w-100 mt-2 d-flex align-items-center justify-content-center gap-1"
                              onClick={() =>
                                setPdfModal({
                                  courseId: Number(assignment.courseId),
                                  courseName: course?.courseName ?? `Course #${assignment.courseId}`,
                                })
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
          </>
        )}

        {/* ── Tab: Available Upcoming Courses ─────────────────────────── */}
        {activeTab === "upcoming" && (
          <>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <p className="text-muted mb-0" style={{ fontSize: 14 }}>
                <i className="ti ti-info-circle me-1" />
                Browse upcoming courses and click <strong>Enroll Now</strong> to enroll. The
                course will immediately appear in your <strong>Enrolled Courses</strong> tab.
              </p>
              <button
                type="button"
                className="btn btn-outline-light border d-inline-flex align-items-center gap-1"
                onClick={() => loadUpcomingCourses()}
                disabled={upcomingLoading}
              >
                <i className="ti ti-refresh" />
                Refresh
              </button>
            </div>

            {upcomingError && <div className="alert alert-danger">{upcomingError}</div>}

            {upcomingLoading && (
              <div className="d-flex justify-content-center align-items-center py-5">
                <div className="spinner-border text-primary" role="status">
                  <span className="visually-hidden">Loading...</span>
                </div>
              </div>
            )}

            {!upcomingLoading && upcomingCourses.length === 0 && !upcomingError && (
              <div className="card">
                <div className="card-body text-center py-5">
                  <i className="ti ti-calendar-off fs-48 text-muted mb-3 d-block" />
                  <h5 className="fw-bold text-muted">No Upcoming Courses</h5>
                  <p className="text-muted mb-0">
                    There are no upcoming courses available for enrollment right now.
                  </p>
                </div>
              </div>
            )}

            {!upcomingLoading && upcomingCourses.length > 0 && (
              <div className="row g-4">
                {upcomingCourses.map((schedule) => {
                  const course = schedule.Course;
                  const courseName = course?.courseName ?? `Course #${schedule.courseId}`;
                  const imageSrc = course?.imageUrl
                    ? `${media_base_url}/${course.imageUrl}`
                    : null;
                  const teacher = schedule.Teacher;
                  const teacherName = teacher
                    ? `${teacher.firstName} ${teacher.lastName}`
                    : null;
                  const teacherImg = teacher?.imageUrl
                    ? `${media_base_url}/${teacher.imageUrl}`
                    : null;
                  const teacherInitials = teacherName
                    ? teacherName
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .toUpperCase()
                        .slice(0, 2)
                    : null;
                  const startDate = schedule.startingFrom
                    ? new Date(schedule.startingFrom).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })
                    : null;

                  // enrolled if self-enrolled OR if admin has directly assigned this course
                  const isAdminAssigned = studentAssignments.some(
                    (a) => String(a.courseId) === String(schedule.courseId)
                  );
                  const enrolled = isEnrolled(schedule.courseId) || isAdminAssigned;
                  const isEnrolling = enrollingCourseId === String(schedule.courseId);

                  return (
                    <div key={String(schedule.id)} className="col-lg-4 col-md-6">
                      <div className="card h-100 shadow-sm">
                        {imageSrc ? (
                          <img
                            src={imageSrc}
                            alt={courseName}
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
                          <div className="mb-2">
                            {schedule.isStarted ? (
                              <span className="badge badge-soft-success border border-success">
                                <i className="ti ti-circle-check me-1" />
                                In Progress
                              </span>
                            ) : (
                              <span className="badge badge-soft-warning border border-warning">
                                <i className="ti ti-clock me-1" />
                                Upcoming
                              </span>
                            )}
                          </div>

                          <h6 className="fw-bold mb-1">{courseName}</h6>

                          {course?.duration && (
                            <div className="d-flex align-items-center gap-1 mb-1">
                              <i className="ti ti-clock text-muted fs-14" />
                              <small className="text-muted">{course.duration}</small>
                            </div>
                          )}

                          {startDate && (
                            <div className="d-flex align-items-center gap-1 mb-2">
                              <i className="ti ti-calendar text-muted fs-14" />
                              <small className="text-muted">Starts: {startDate}</small>
                            </div>
                          )}

                          {course?.description && (
                            <p
                              className="text-muted mb-0"
                              style={{
                                fontSize: 13,
                                lineHeight: 1.5,
                                overflow: "hidden",
                                display: "-webkit-box",
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: "vertical",
                              }}
                            >
                              {course.description}
                            </p>
                          )}

                          <div className="mt-auto pt-3">
                            {teacherName && (
                              <>
                                <hr className="my-2" />
                                <div className="d-flex align-items-center gap-2 mb-3">
                                  {teacherImg ? (
                                    <img
                                      src={teacherImg}
                                      alt={teacherName}
                                      style={{
                                        width: 32,
                                        height: 32,
                                        borderRadius: "50%",
                                        objectFit: "cover",
                                      }}
                                    />
                                  ) : (
                                    <div
                                      className="d-flex align-items-center justify-content-center bg-primary text-white fw-bold"
                                      style={{
                                        width: 32,
                                        height: 32,
                                        borderRadius: "50%",
                                        fontSize: 11,
                                      }}
                                    >
                                      {teacherInitials}
                                    </div>
                                  )}
                                  <div>
                                    <div className="fw-medium" style={{ fontSize: 13 }}>
                                      {teacherName}
                                    </div>
                                    <div className="text-muted" style={{ fontSize: 11 }}>
                                      Teacher
                                    </div>
                                  </div>
                                </div>
                              </>
                            )}

                            {enrolled ? (
                              <button type="button" className="btn btn-success w-100" disabled>
                                <i className="ti ti-circle-check me-1" />
                                Enrolled
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="btn btn-primary w-100"
                                disabled={isEnrolling}
                                onClick={() => handleEnroll(schedule.courseId)}
                              >
                                {isEnrolling ? (
                                  <>
                                    <span className="spinner-border spinner-border-sm me-1" />
                                    Enrolling...
                                  </>
                                ) : (
                                  <>
                                    <i className="ti ti-plus me-1" />
                                    Enroll Now
                                  </>
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
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

export default StudentCourseList;
