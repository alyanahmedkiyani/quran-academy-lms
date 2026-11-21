"use client";

import Link from "next/link";
import { all_routes } from "@/routes/all_routes";
import TeacherOverview from "./TeacherOverview";

const TeacherOverviewPage = () => {
  return (
    <div className="page-wrapper">
      <div className="content">
        <div className="mb-3 border-bottom pb-3">
          <h4 className="fw-bold mb-0">My Profile</h4>
        </div>

        <div className="card mb-4">
          <div className="card-body">
            <div className="row">
              {/* ── Left nav ── */}
              <div className="col-lg-3">
                <div className="text-start">
                  <Link
                    href={all_routes.teacherOverview}
                    className="d-block w-100 btn btn-md border rounded fs-14 fw-medium text-primary text-start mb-1 active"
                  >
                    <i className="ti ti-layout-dashboard me-2 text-primary" /> My Overview
                  </Link>
                  <Link
                    href={all_routes.teacherProfile}
                    className="d-block w-100 btn btn-md border rounded fs-14 fw-medium text-dark text-start mb-1"
                  >
                    <i className="ti ti-user-cog me-2 text-dark" /> Profile Settings
                  </Link>
                  <Link
                    href={all_routes.teacherSettings}
                    className="d-block w-100 btn btn-md border rounded fs-14 fw-medium text-dark text-start mb-1"
                  >
                    <i className="ti ti-lock-star me-2 text-dark" /> Change Password
                  </Link>
                </div>
              </div>

              {/* ── Overview content ── */}
              <div className="col-lg-9">
                <div className="border-1 border-start ps-4">
                  <TeacherOverview />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeacherOverviewPage;
