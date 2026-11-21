"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { resolveImageUrl } from "@/environment";
import { useAppDispatch, useAppSelector } from "@/core/redux/hooks";
import { fetchParentsThunk } from "@/core/redux/parentSlice";
import { all_routes } from "@/routes/all_routes";
import { isAdminAuthorityRole, getDashboardRouteForRole } from "@/lib/roles";

const ParentDetail = () => {
  const { id } = useParams<{ id: string }>();
  const dispatch = useAppDispatch();
  const router = useRouter();
  const user = useAppSelector((state) => state.auth.user);
  const { allItems, listStatus } = useAppSelector((state) => state.parents);

  useEffect(() => {
    if (user && !isAdminAuthorityRole(user.role?.name)) {
      router.replace(getDashboardRouteForRole(user.role?.name));
    }
  }, [user, router]);

  useEffect(() => {
    if (listStatus === "idle") {
      dispatch(fetchParentsThunk());
    }
  }, [listStatus, dispatch]);

  const parent = allItems.find((p) => String(p.id) === String(id));
  const loading = listStatus === "loading";

  if (loading) {
    return (
      <div className="page-wrapper">
        <div className="content d-flex justify-content-center align-items-center" style={{ minHeight: 300 }}>
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!parent) {
    return (
      <div className="page-wrapper">
        <div className="content">
          <div className="alert alert-warning mb-3">Parent not found.</div>
          <Link href={all_routes.manageParents} className="btn btn-outline-secondary btn-sm d-inline-flex align-items-center gap-1">
            <i className="ti ti-arrow-left" />
            Back to Parents
          </Link>
        </div>
      </div>
    );
  }

  const initials = `${parent.firstName?.[0] ?? ""}${parent.lastName?.[0] ?? ""}`.toUpperCase() || "?";
  const fullName = `${parent.firstName} ${parent.lastName ?? ""}`.trim();
  const linkedStudents = parent.students ?? [];

  const infoRow = (icon: string, label: string, value: string) => (
    <div className="d-flex align-items-center mb-3" key={label}>
      <span
        className="avatar avatar-sm rounded-circle bg-light text-dark d-flex align-items-center justify-content-center flex-shrink-0 me-2"
        style={{ width: 36, height: 36 }}
      >
        <i className={`ti ${icon} fs-16`} />
      </span>
      <div>
        <h6 className="fw-semibold fs-13 mb-0">{label}</h6>
        <p className="mb-0 text-muted fs-14">{value || "—"}</p>
      </div>
    </div>
  );

  return (
    <div className="page-wrapper">
      <div className="content">
        {/* Back nav */}
        <div className="mb-4">
          <Link href={all_routes.manageParents} className="btn btn-sm btn-outline-secondary d-inline-flex align-items-center gap-1">
            <i className="ti ti-chevron-left" />
            Back to Parents
          </Link>
        </div>

        {/* Header Card */}
        <div className="card mb-4">
          <div className="card-body">
            <div className="d-flex align-items-center gap-4 flex-wrap">
              <div className="flex-shrink-0" style={{ width: 80, height: 80 }}>
                {parent.profileImg ? (
                  <img
                    src={`${resolveImageUrl(parent.profileImg)}`}
                    alt={fullName}
                    width={80} height={80}
                    style={{ borderRadius: "50%", objectFit: "cover", width: 80, height: 80 }}
                    onError={(e) => { (e.target as HTMLImageElement).src = "/assets/img/users/user-01.jpg"; }}
                  />
                ) : (
                  <div
                    className="avatar rounded-circle bg-primary text-white d-flex align-items-center justify-content-center fw-bold"
                    style={{ width: 80, height: 80, fontSize: 28 }}
                  >
                    {initials}
                  </div>
                )}
              </div>
              <div className="flex-grow-1">
                <h5 className="fw-bold mb-2">{fullName}</h5>
                <div className="d-flex flex-wrap gap-2 align-items-center">
                  <span className="badge border bg-white text-dark fs-13">@{parent.username}</span>
                  <span className="badge badge-soft-info border border-info fs-13">Parent</span>
                  <span className="badge badge-soft-secondary border fs-13">
                    <i className="ti ti-users me-1" />
                    {linkedStudents.length} student{linkedStudents.length !== 1 ? "s" : ""}
                  </span>
                  {parent.email && (
                    <span className="badge badge-soft-primary border border-primary fs-13">
                      <i className="ti ti-mail me-1" />
                      {parent.email}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 2-column layout */}
        <div className="row g-4">
          {/* Main — col-lg-8 */}
          <div className="col-lg-8">
            {/* Account Info */}
            <div className="card mb-4">
              <div className="card-body">
                <h5 className="fw-bold mb-3">Account Information</h5>
                <div className="row g-3">
                  <div className="col-sm-6">
                    <div className="bg-light rounded p-3">
                      <p className="text-muted fs-12 mb-1">Email Address</p>
                      <p className="fw-semibold mb-0">{parent.email || "—"}</p>
                    </div>
                  </div>
                  <div className="col-sm-6">
                    <div className="bg-light rounded p-3">
                      <p className="text-muted fs-12 mb-1">Username</p>
                      <p className="fw-semibold mb-0">@{parent.username}</p>
                    </div>
                  </div>
                  <div className="col-sm-6">
                    <div className="bg-light rounded p-3">
                      <p className="text-muted fs-12 mb-1">Contact Number</p>
                      <p className="fw-semibold mb-0">{parent.contact || "—"}</p>
                    </div>
                  </div>
                  <div className="col-sm-6">
                    <div className="bg-light rounded p-3">
                      <p className="text-muted fs-12 mb-1">Address</p>
                      <p className="fw-semibold mb-0">{parent.address || "—"}</p>
                    </div>
                  </div>
                  {parent.createdAt && (
                    <div className="col-sm-6">
                      <div className="bg-light rounded p-3">
                        <p className="text-muted fs-12 mb-1">Member Since</p>
                        <p className="fw-semibold mb-0">
                          {new Date(parent.createdAt).toLocaleDateString("en-US", {
                            year: "numeric", month: "long", day: "numeric",
                          })}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Linked Students list */}
            <div className="card">
              <div className="card-body">
                <h5 className="fw-bold mb-3">
                  Linked Students
                  <span className="badge badge-soft-primary border border-primary fs-13 ms-2">
                    {linkedStudents.length}
                  </span>
                </h5>
                {linkedStudents.length === 0 ? (
                  <p className="text-muted mb-0">No students linked to this parent.</p>
                ) : (
                  <div className="d-flex flex-column gap-3">
                    {linkedStudents.map((s) => {
                      const sInitials = `${s.firstName?.[0] ?? ""}${s.lastName?.[0] ?? ""}`.toUpperCase();
                      const sName = `${s.firstName} ${s.lastName ?? ""}`.trim();
                      const isActive = (s.status ?? "active").toLowerCase() === "active";
                      return (
                        <div key={s.id} className="d-flex align-items-center gap-3 p-3 bg-light rounded">
                          <div className="flex-shrink-0" style={{ width: 44, height: 44 }}>
                            {s.profileImg ? (
                              <img src={`${resolveImageUrl(s.profileImg)}`} alt={sName} width={44} height={44} style={{ borderRadius: "50%", objectFit: "cover", width: 44, height: 44 }} onError={(e) => { (e.target as HTMLImageElement).src = "/assets/img/users/user-01.jpg"; }} />
                            ) : (
                              <div className="avatar rounded-circle bg-success text-white d-flex align-items-center justify-content-center fw-bold" style={{ width: 44, height: 44, fontSize: 16 }}>
                                {sInitials}
                              </div>
                            )}
                          </div>
                          <div className="flex-grow-1">
                            <p className="fw-semibold mb-0 fs-15">{sName}</p>
                            <p className="text-muted mb-0 fs-13">@{s.username}</p>
                          </div>
                          <span
                            className={`badge fs-12 ${
                              isActive
                                ? "badge-soft-success border border-success"
                                : "badge-soft-danger border border-danger"
                            }`}
                          >
                            {isActive ? "Active" : "Inactive"}
                          </span>
                          <Link
                            href={`/admin/students/${s.id}`}
                            className="btn btn-sm btn-outline-primary"
                          >
                            View
                          </Link>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar — col-lg-4 */}
          <div className="col-lg-4">
            <div className="card">
              <div className="card-body">
                <h5 className="fw-bold mb-3">About</h5>
                {infoRow("ti-mail", "Email", parent.email || "—")}
                {infoRow("ti-phone", "Contact", parent.contact || "—")}
                {infoRow("ti-user", "Username", `@${parent.username}`)}
                {infoRow("ti-map-pin", "Address", parent.address || "—")}
                {infoRow(
                  "ti-users",
                  "Linked Students",
                  linkedStudents.length > 0
                    ? linkedStudents.map((s) => `${s.firstName} ${s.lastName ?? ""}`.trim()).join(", ")
                    : "None"
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ParentDetail;
