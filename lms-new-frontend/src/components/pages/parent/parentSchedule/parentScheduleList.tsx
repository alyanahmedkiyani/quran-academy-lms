"use client";

import { useEffect } from "react";
import { useAppSelector, useAppDispatch } from "@/core/redux/hooks";
import { fetchSchedulesThunk } from "@/core/redux/upcomingCourseSlice";
import { media_base_url } from "@/environment";

const ParentScheduleList = () => {
  const dispatch = useAppDispatch();
  const { schedules, schedulesStatus, schedulesError } = useAppSelector(
    (state) => state.upcomingCourses
  );

  useEffect(() => {
    dispatch(fetchSchedulesThunk());
  }, [dispatch]);

  const loading = schedulesStatus === "loading";

  return (
    <div className="page-wrapper">
      <div className="content">
        {/* Header */}
        <div className="d-flex align-items-sm-center flex-sm-row flex-column gap-2 pb-3 mb-3">
          <div className="flex-grow-1">
            <h4 className="fw-bold mb-0">
              Class Schedule
              {!loading && (
                <span className="badge badge-soft-primary fw-medium border py-1 px-2 border-primary fs-13 ms-2">
                  {schedules.length}
                </span>
              )}
            </h4>
            <p className="text-muted mb-0 mt-1">Upcoming and active classes for your children</p>
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

        {!loading && schedules.length === 0 && !schedulesError && (
          <div className="card">
            <div className="card-body text-center py-5">
              <i className="ti ti-calendar-off fs-48 text-muted mb-3 d-block" />
              <h5 className="fw-bold text-muted">No Classes Scheduled</h5>
              <p className="text-muted mb-0">There are no scheduled classes at the moment.</p>
            </div>
          </div>
        )}

        {!loading && schedules.length > 0 && (
          <div className="row g-4">
            {schedules.map((schedule) => {
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

                      {teacherName && (
                        <div className="mt-auto pt-3">
                          <hr className="my-2" />
                          <div className="d-flex align-items-center gap-2">
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
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default ParentScheduleList;
