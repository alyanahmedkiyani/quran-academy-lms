"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAppSelector } from "@/core/redux/hooks";
import { api_base_url, withAuthorization, handleResponse } from "@/services/apiClient";
import { resolveImageUrl } from "@/environment";

interface TeacherSummary {
  id: number | string;
  firstName: string;
  lastName: string;
  email: string;
  imageUrl?: string | null;
  shift?: string[] | null;
}

const SHIFT_COLORS: Record<string, string> = {
  Morning: "#F59E0B",
  Afternoon: "#3B82F6",
  Evening: "#8B5CF6",
};

const fetchMyTeachers = async (studentId: string): Promise<TeacherSummary[]> => {
  const res = await fetch(`${api_base_url}/student/my-teachers/${studentId}`, {
    headers: withAuthorization(),
  });
  const data = await handleResponse<{ teachers: TeacherSummary[] }>(res);
  return data.teachers;
};

export default function MyTeachers() {
  const { user } = useAppSelector((s) => s.auth);
  const [teachers, setTeachers] = useState<TeacherSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    fetchMyTeachers(String(user.id))
      .then(setTeachers)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user?.id]);

  return (
    <div className="page-wrapper">
      <div className="content">
        <div className="mb-4">
          <h4 className="fw-bold mb-0">My Teachers</h4>
          <p className="text-muted mb-0 fs-13">Your assigned instructors</p>
        </div>

        {loading ? (
          <div className="d-flex justify-content-center py-5">
            <div className="spinner-border text-primary" role="status" />
          </div>
        ) : teachers.length === 0 ? (
          <div className="text-center py-5 text-muted">
            <i className="ti ti-users fs-1 d-block mb-2" />
            No teachers assigned yet.
          </div>
        ) : (
          <div className="row g-3">
            {teachers.map((t) => (
              <div key={t.id} className="col-12 col-sm-6 col-md-4 col-lg-3">
                <div className="card h-100 shadow-sm border-0">
                  <div className="card-body d-flex flex-column align-items-center text-center p-4">
                    {t.imageUrl ? (
                      <img
                        src={`${resolveImageUrl(t.imageUrl)}`}
                        alt={`${t.firstName} ${t.lastName}`}
                        className="rounded-circle mb-3"
                        style={{ width: 72, height: 72, objectFit: "cover" }}
                      />
                    ) : (
                      <div
                        className="rounded-circle d-flex align-items-center justify-content-center mb-3 bg-primary text-white fw-bold fs-5"
                        style={{ width: 72, height: 72 }}
                      >
                        {t.firstName[0]}{t.lastName[0]}
                      </div>
                    )}
                    <h6 className="mb-1 fw-semibold">
                      {t.firstName} {t.lastName}
                    </h6>
                    <p className="text-muted fs-12 mb-2">{t.email}</p>
                    {t.shift && t.shift.length > 0 && (
                      <div className="d-flex flex-wrap gap-1 justify-content-center mb-3">
                        {t.shift.map((s) => (
                          <span
                            key={s}
                            className="badge"
                            style={{
                              backgroundColor: SHIFT_COLORS[s] ?? "#6c757d",
                              fontSize: 11,
                            }}
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    )}
                    <Link
                      href={`/student/my-teachers/${t.id}`}
                      className="btn btn-sm btn-outline-primary w-100 mt-auto"
                    >
                      <i className="ti ti-eye me-1" />
                      View Profile
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
