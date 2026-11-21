"use client";

import { useEffect, useState } from "react";
import { useAppSelector } from "@/core/redux/hooks";
import { fetchParentById } from "@/services/parentService";
import { fetchCoursesByStudentId } from "@/services/courseDetailsService";
import { CourseDetail } from "@/types/course";
import { media_base_url } from "@/environment";

interface StudentCourseData {
  studentId: string;
  studentName: string;
  courses: CourseDetail[];
  loading: boolean;
  error: string | null;
}

const CourseCard = ({ assignment }: { assignment: CourseDetail }) => {
  const course = assignment.Course;
  const teacher = assignment.Teacher;
  const courseName = course?.courseName ?? `Course #${assignment.courseId}`;
  const imageSrc = course?.imageUrl
    ? `${media_base_url}/${course.imageUrl}`
    : null;

  const teacherName = teacher ? `${teacher.firstName} ${teacher.lastName}` : null;
  const teacherImageSrc = teacher?.imageUrl
    ? `${media_base_url}/${teacher.imageUrl}`
    : null;

  return (
    <div className="card shadow-sm h-100">
      {imageSrc ? (
        <img
          src={imageSrc}
          alt={courseName}
          className="card-img-top"
          style={{ height: 130, objectFit: "cover" }}
        />
      ) : (
        <div
          className="d-flex align-items-center justify-content-center bg-light"
          style={{ height: 130 }}
        >
          <i className="ti ti-book fs-40 text-muted" />
        </div>
      )}
      <div className="card-body d-flex flex-column">
        <div className="mb-1">
          {course?.isComing ? (
            <span className="badge badge-soft-warning border border-warning" style={{ fontSize: 10 }}>
              Upcoming
            </span>
          ) : (
            <span className="badge badge-soft-success border border-success" style={{ fontSize: 10 }}>
              Active
            </span>
          )}
        </div>
        <h6 className="fw-bold mb-1" style={{ fontSize: 14 }}>
          {courseName}
        </h6>
        {course?.duration && (
          <div className="d-flex align-items-center gap-1 mb-2">
            <i className="ti ti-clock text-muted" style={{ fontSize: 12 }} />
            <small className="text-muted">{course.duration}</small>
          </div>
        )}
        {teacherName && (
          <div className="mt-auto d-flex align-items-center gap-2 pt-2 border-top">
            {teacherImageSrc ? (
              <img
                src={teacherImageSrc}
                alt={teacherName}
                style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover" }}
              />
            ) : (
              <div
                className="d-flex align-items-center justify-content-center bg-primary text-white fw-bold"
                style={{ width: 28, height: 28, borderRadius: "50%", fontSize: 10 }}
              >
                {teacherName
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase()
                  .slice(0, 2)}
              </div>
            )}
            <small className="text-muted">{teacherName}</small>
          </div>
        )}
      </div>
    </div>
  );
};

const ParentCourseView = () => {
  const user = useAppSelector((state) => state.auth.user);

  const [childrenData, setChildrenData] = useState<StudentCourseData[]>([]);
  const [parentLoading, setParentLoading] = useState(true);
  const [parentError, setParentError] = useState<string | null>(null);
  const [expandedChildren, setExpandedChildren] = useState<Set<string>>(new Set());

  const loadData = async () => {
    if (!user?.id) return;
    setParentLoading(true);
    setParentError(null);

    try {
      const parent = await fetchParentById(String(user.id));
      const linkedStudents = parent.students ?? [];

      if (linkedStudents.length === 0) {
        setChildrenData([]);
        setParentLoading(false);
        return;
      }

      // Initialize with loading state for each student
      const initial: StudentCourseData[] = linkedStudents.map((s) => ({
        studentId: String(s.id),
        studentName: `${s.firstName} ${s.lastName}`,
        courses: [],
        loading: true,
        error: null,
      }));
      setChildrenData(initial);
      // Expand all by default
      setExpandedChildren(new Set(initial.map((d) => d.studentId)));
      setParentLoading(false);

      // Fetch each student's courses in parallel
      await Promise.all(
        linkedStudents.map(async (s) => {
          try {
            const response = await fetchCoursesByStudentId(String(s.id));
            setChildrenData((prev) =>
              prev.map((cd) =>
                cd.studentId === String(s.id)
                  ? { ...cd, courses: response.course, loading: false }
                  : cd
              )
            );
          } catch (err: unknown) {
            const message =
              typeof err === "string"
                ? err
                : (err as { message?: string })?.message ?? "Failed to load courses.";
            setChildrenData((prev) =>
              prev.map((cd) =>
                cd.studentId === String(s.id)
                  ? { ...cd, loading: false, error: message }
                  : cd
              )
            );
          }
        })
      );
    } catch (err: unknown) {
      const message =
        typeof err === "string"
          ? err
          : (err as { message?: string })?.message ?? "Failed to load your children's data.";
      setParentError(message);
      setParentLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user?.id]);

  const toggleExpand = (studentId: string) => {
    setExpandedChildren((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      return next;
    });
  };

  return (
    <div className="page-wrapper">
      <div className="content">
        {/* Header */}
        <div className="d-flex align-items-sm-center flex-sm-row flex-column gap-2 pb-3 mb-3">
          <div className="flex-grow-1">
            <h4 className="fw-bold mb-0">Child Progress</h4>
            <p className="text-muted mb-0 mt-1">
              View your children&apos;s enrolled courses and their teachers
            </p>
          </div>
          <button
            type="button"
            className="btn btn-outline-light border d-inline-flex align-items-center gap-1"
            onClick={loadData}
            disabled={parentLoading}
          >
            <i className="ti ti-refresh" />
            Refresh
          </button>
        </div>

        {/* Global error */}
        {parentError && (
          <div className="alert alert-danger" role="alert">
            {parentError}
          </div>
        )}

        {/* Parent loading */}
        {parentLoading && (
          <div className="d-flex justify-content-center align-items-center py-5">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
          </div>
        )}

        {/* No children */}
        {!parentLoading && childrenData.length === 0 && !parentError && (
          <div className="card">
            <div className="card-body text-center py-5">
              <i className="ti ti-users-group fs-48 text-muted mb-3 d-block" />
              <h5 className="fw-bold text-muted">No Children Linked</h5>
              <p className="text-muted mb-0">
                No children are linked to your account. Contact your administrator.
              </p>
            </div>
          </div>
        )}

        {/* Per-child sections */}
        {!parentLoading &&
          childrenData.map((child) => {
            const isExpanded = expandedChildren.has(child.studentId);

            return (
              <div key={child.studentId} className="card mb-4">
                <div
                  className="card-header d-flex align-items-center justify-content-between"
                  style={{ cursor: "pointer" }}
                  onClick={() => toggleExpand(child.studentId)}
                >
                  <div className="d-flex align-items-center gap-3">
                    <div
                      className="d-flex align-items-center justify-content-center bg-primary text-white fw-bold rounded-circle"
                      style={{ width: 40, height: 40, fontSize: 14 }}
                    >
                      {child.studentName
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .toUpperCase()
                        .slice(0, 2)}
                    </div>
                    <div>
                      <h6 className="fw-bold mb-0">{child.studentName}</h6>
                      {!child.loading && (
                        <small className="text-muted">
                          {child.courses.length} course{child.courses.length !== 1 ? "s" : ""} enrolled
                        </small>
                      )}
                    </div>
                  </div>
                  <i
                    className={`ti ${isExpanded ? "ti-chevron-up" : "ti-chevron-down"} text-muted`}
                  />
                </div>

                {isExpanded && (
                  <div className="card-body">
                    {/* Child's courses loading */}
                    {child.loading && (
                      <div className="d-flex justify-content-center py-3">
                        <div className="spinner-border spinner-border-sm text-primary" role="status" />
                      </div>
                    )}

                    {/* Child's courses error */}
                    {!child.loading && child.error && (
                      <div className="alert alert-warning py-2 mb-0">{child.error}</div>
                    )}

                    {/* Child's courses empty */}
                    {!child.loading && !child.error && child.courses.length === 0 && (
                      <div className="text-center py-3">
                        <i className="ti ti-book-off fs-32 text-muted mb-2 d-block" />
                        <p className="text-muted mb-0" style={{ fontSize: 14 }}>
                          {child.studentName} is not enrolled in any courses yet.
                        </p>
                      </div>
                    )}

                    {/* Child's course cards */}
                    {!child.loading && !child.error && child.courses.length > 0 && (
                      <div className="row g-3">
                        {child.courses.map((assignment) => (
                          <div key={String(assignment.id)} className="col-lg-3 col-md-4 col-sm-6">
                            <CourseCard assignment={assignment} />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
      </div>
    </div>
  );
};

export default ParentCourseView;
