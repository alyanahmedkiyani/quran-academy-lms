"use client";

import { useEffect, useState } from "react";
import { Modal } from "antd";
import { useAppSelector, useAppDispatch } from "@/core/redux/hooks";
import { fetchSchedulesThunk, fetchCourseEnrollmentsThunk } from "@/core/redux/upcomingCourseSlice";
import { UpcomingCourse } from "@/types/course";
import { media_base_url } from "@/environment";

const TeacherScheduleList = () => {
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const { schedules, schedulesStatus, schedulesError, courseEnrollments, courseEnrollmentsStatus } =
    useAppSelector((state) => state.upcomingCourses);

  const [enrollViewCourse, setEnrollViewCourse] = useState<UpcomingCourse | null>(null);

  useEffect(() => {
    dispatch(fetchSchedulesThunk());
  }, [dispatch]);

  // Filter schedules assigned to this teacher
  const mySchedules = schedules.filter(
    (s) => user?.id && String(s.teacherId) === String(user.id)
  );

  const loading = schedulesStatus === "loading";

  const openEnrollView = (schedule: UpcomingCourse) => {
    setEnrollViewCourse(schedule);
    dispatch(fetchCourseEnrollmentsThunk(String(schedule.courseId)));
  };

  return (
    <div className="page-wrapper">
      <div className="content">
        {/* Header */}
        <div className="d-flex align-items-sm-center flex-sm-row flex-column gap-2 pb-3 mb-3">
          <div className="flex-grow-1">
            <h4 className="fw-bold mb-0">
              My Schedule
              {!loading && (
                <span className="badge badge-soft-primary fw-medium border py-1 px-2 border-primary fs-13 ms-2">
                  {mySchedules.length} class{mySchedules.length !== 1 ? "es" : ""}
                </span>
              )}
            </h4>
            <p className="text-muted mb-0 mt-1">Your upcoming and active class schedule</p>
          </div>
          <button
            type="button"
            className="btn btn-outline-light border d-inline-flex align-items-center gap-1"
            onClick={() => dispatch(fetchSchedulesThunk())}
            disabled={loading}
          >
            <i className="ti ti-refresh" />
            Refresh
          </button>
        </div>

        {schedulesError && (
          <div className="alert alert-danger">{schedulesError}</div>
        )}

        {loading && (
          <div className="d-flex justify-content-center align-items-center py-5">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
          </div>
        )}

        {!loading && mySchedules.length === 0 && !schedulesError && (
          <div className="card">
            <div className="card-body text-center py-5">
              <i className="ti ti-calendar-off fs-48 text-muted mb-3 d-block" />
              <h5 className="fw-bold text-muted">No Classes Scheduled</h5>
              <p className="text-muted mb-0">
                You have no scheduled classes yet. Contact your administrator.
              </p>
            </div>
          </div>
        )}

        {!loading && mySchedules.length > 0 && (
          <div className="row g-4">
            {mySchedules.map((schedule) => {
              const course = schedule.Course;
              const courseName = course?.courseName ?? `Course #${schedule.courseId}`;
              const imageSrc = course?.imageUrl
                ? `${media_base_url}/${course.imageUrl}`
                : null;
              const startDate = schedule.startingFrom
                ? new Date(schedule.startingFrom).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })
                : null;

              return (
                <div key={String(schedule.id)} className="col-lg-4 col-md-6">
                  <div className="card h-100 shadow-sm">
                    {/* Course Image */}
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
                      {/* Status */}
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
                        <div className="d-flex align-items-center gap-1 mb-2">
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
                        <hr className="my-2" />
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary w-100"
                          onClick={() => openEnrollView(schedule)}
                        >
                          <i className="ti ti-users me-1" />
                          View Enrolled Students
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Enrolled Students Modal */}
        <Modal
          title={
            enrollViewCourse
              ? `Enrolled Students — ${enrollViewCourse.Course?.courseName ?? "Course"}`
              : "Enrolled Students"
          }
          open={!!enrollViewCourse}
          onCancel={() => setEnrollViewCourse(null)}
          footer={
            <button
              type="button"
              className="btn btn-outline-secondary"
              onClick={() => setEnrollViewCourse(null)}
            >
              Close
            </button>
          }
        >
          {courseEnrollmentsStatus === "loading" ? (
            <div className="d-flex justify-content-center py-4">
              <div className="spinner-border text-primary" role="status" />
            </div>
          ) : courseEnrollments.length === 0 ? (
            <div className="text-center py-4">
              <i className="ti ti-user-off fs-48 text-muted d-block mb-2" />
              <p className="text-muted mb-0">No students have enrolled yet.</p>
            </div>
          ) : (
            <ul className="list-group list-group-flush">
              {courseEnrollments.map((e) => {
                const student = e.Student;
                const name = student
                  ? `${student.firstName} ${student.lastName}`
                  : `Student #${e.studentId}`;
                return (
                  <li
                    key={String(e.id)}
                    className="list-group-item d-flex align-items-center gap-2"
                  >
                    <i className="ti ti-user-circle text-muted fs-18" />
                    <span>{name}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </Modal>
      </div>
    </div>
  );
};

export default TeacherScheduleList;
