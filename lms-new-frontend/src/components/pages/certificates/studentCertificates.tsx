"use client";

import { useEffect, useState } from "react";
import { useAppSelector } from "@/core/redux/hooks";
import { getStudentCertificates } from "@/services/certificateService";
import type { Certificate } from "@/types/certificate";
import { resolveImageUrl } from "@/environment";

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

// ── Certificate Card ──────────────────────────────────────────────────────────

const CertificateCard = ({ cert }: { cert: Certificate }) => {
  const [downloading, setDownloading] = useState(false);
  const isUpcoming = cert.status === "upcoming";
  const imageSrc = cert.templateImageUrl
    ? `${resolveImageUrl(cert.templateImageUrl)}`
    : null;
  const courseName = cert.Course?.courseName ?? `Course #${cert.courseId}`;
  const issuedDate = cert.issuedAt
    ? new Date(cert.issuedAt).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  return (
    <div className="card h-100 shadow-sm" style={{ overflow: "hidden", opacity: isUpcoming ? 0.9 : 1 }}>
      {/* Image area */}
      {isUpcoming ? (
        <div style={{ position: "relative", height: 200, overflow: "hidden" }}>
          {imageSrc ? (
            <img
              src={imageSrc}
              alt={courseName}
              className="w-100"
              style={{ height: 200, objectFit: "cover", filter: "blur(6px) brightness(0.7)" }}
            />
          ) : (
            <div
              className="w-100"
              style={{
                height: 200,
                background: "linear-gradient(135deg,#fef3c7 0%,#fde68a 50%,#fbbf24 100%)",
              }}
            />
          )}
          {/* Coming soon overlay */}
          <div
            className="d-flex flex-column align-items-center justify-content-center"
            style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.45)", color: "#fff", textAlign: "center" }}
          >
            <i className="ti ti-clock fs-36 mb-2" />
            <span className="fw-bold" style={{ fontSize: 15 }}>Coming Soon</span>
            <small style={{ fontSize: 12, opacity: 0.85 }}>Your certificate is being prepared</small>
          </div>
        </div>
      ) : imageSrc ? (
        <div style={{ position: "relative" }}>
          <img
            src={imageSrc}
            alt={`${courseName} Certificate`}
            className="w-100"
            style={{ height: 200, objectFit: "cover" }}
          />
          <button
            className="btn btn-primary btn-sm"
            style={{ position: "absolute", top: 10, right: 10, opacity: 0.9 }}
            title="Download Certificate"
            disabled={downloading}
            onClick={async () => {
              if (!imageSrc) return;
              setDownloading(true);
              try { await downloadFile(imageSrc, `${courseName}-certificate.jpg`); }
              finally { setDownloading(false); }
            }}
          >
            {downloading
              ? <span className="spinner-border spinner-border-sm" />
              : <><i className="ti ti-download me-1" />Download</>}
          </button>
        </div>
      ) : (
        <div className="d-flex align-items-center justify-content-center bg-light" style={{ height: 200 }}>
          <div className="text-center text-muted">
            <i className="ti ti-certificate fs-48 d-block mb-2" />
            <small>Image not uploaded yet</small>
          </div>
        </div>
      )}

      {/* Body */}
      <div className="card-body">
        <div className="mb-2">
          {isUpcoming ? (
            <span className="badge badge-soft-warning border border-warning fw-medium">
              <i className="ti ti-clock me-1" />Upcoming
            </span>
          ) : (
            <span className="badge badge-soft-success border border-success fw-medium">
              <i className="ti ti-circle-check me-1" />Issued
            </span>
          )}
        </div>

        <h6 className="fw-bold mb-1">{courseName}</h6>

        {cert.Course?.duration && (
          <div className="d-flex align-items-center gap-1 mb-1">
            <i className="ti ti-clock text-muted fs-14" />
            <small className="text-muted">{cert.Course.duration}</small>
          </div>
        )}

        <div className="d-flex align-items-center gap-1 mb-2">
          <i className="ti ti-calendar text-muted fs-14" />
          <small className="text-muted">
            {isUpcoming ? "Certificate will be issued soon" : issuedDate ? `Issued: ${issuedDate}` : "—"}
          </small>
        </div>

        {cert.notes && (
          <p className="text-muted mb-0" style={{ fontSize: 12, lineHeight: 1.5 }}>
            {cert.notes}
          </p>
        )}

        {!isUpcoming && imageSrc && (
          <button
            className="btn btn-outline-primary btn-sm w-100 mt-3"
            disabled={downloading}
            onClick={async () => {
              setDownloading(true);
              try { await downloadFile(imageSrc, `${courseName}-certificate.jpg`); }
              finally { setDownloading(false); }
            }}
          >
            {downloading
              ? <><span className="spinner-border spinner-border-sm me-1" />Downloading…</>
              : <><i className="ti ti-download me-1" />Download Certificate</>}
          </button>
        )}

        {isUpcoming && (
          <div
            className="mt-3 rounded p-2 text-center"
            style={{ background: "#fef9c3", border: "1px solid #fde68a" }}
          >
            <small style={{ color: "#92400e", fontSize: 12 }}>
              <i className="ti ti-info-circle me-1" />
              You&apos;ll be able to download it once it&apos;s officially issued.
            </small>
          </div>
        )}
      </div>
    </div>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────

const StudentCertificates = () => {
  const user = useAppSelector((state) => state.auth.user);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    getStudentCertificates(user.id)
      .then(setCertificates)
      .catch((err) => setError((err as { message?: string })?.message ?? "Failed to load certificates."))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const issued = certificates.filter((c) => c.status === "issued");
  const upcoming = certificates.filter((c) => c.status === "upcoming");

  return (
    <div className="page-wrapper">
      <div className="content">
        {/* Header */}
        <div className="d-flex align-items-sm-center flex-sm-row flex-column gap-2 pb-3 mb-3">
          <div className="flex-grow-1">
            <h4 className="fw-bold mb-0">
              My Certificates
              {!loading && issued.length > 0 && (
                <span className="badge badge-soft-success fw-medium border py-1 px-2 border-success fs-13 ms-2">
                  {issued.length} Issued
                </span>
              )}
              {!loading && upcoming.length > 0 && (
                <span className="badge badge-soft-warning fw-medium border py-1 px-2 border-warning fs-13 ms-2">
                  {upcoming.length} Upcoming
                </span>
              )}
            </h4>
            <p className="text-muted mb-0 mt-1">Your earned certificates and upcoming awards</p>
          </div>
          <button
            type="button"
            className="btn btn-outline-light border d-inline-flex align-items-center gap-1"
            onClick={load}
            disabled={loading}
          >
            <i className="ti ti-refresh" />
            Refresh
          </button>
        </div>

        {loading && (
          <div className="d-flex justify-content-center align-items-center py-5">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading…</span>
            </div>
          </div>
        )}

        {!loading && error && <div className="alert alert-danger">{error}</div>}

        {!loading && !error && certificates.length === 0 && (
          <div className="card">
            <div className="card-body text-center py-5">
              <i className="ti ti-certificate-off fs-48 text-muted mb-3 d-block" />
              <h5 className="fw-bold text-muted">No Certificates Yet</h5>
              <p className="text-muted mb-0">
                Complete your courses and your certificates will appear here.
              </p>
            </div>
          </div>
        )}

        {/* Issued section */}
        {!loading && !error && issued.length > 0 && (
          <div className="mb-5">
            <h6 className="fw-bold mb-3 d-flex align-items-center gap-2">
              <span
                className="d-inline-flex align-items-center justify-content-center rounded-circle bg-success text-white"
                style={{ width: 28, height: 28, fontSize: 14 }}
              >
                <i className="ti ti-circle-check" />
              </span>
              Issued Certificates
            </h6>
            <div className="row g-4">
              {issued.map((cert) => (
                <div key={cert.id} className="col-lg-4 col-md-6">
                  <CertificateCard cert={cert} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Upcoming section */}
        {!loading && !error && upcoming.length > 0 && (
          <div>
            <h6 className="fw-bold mb-3 d-flex align-items-center gap-2">
              <span
                className="d-inline-flex align-items-center justify-content-center rounded-circle bg-warning text-white"
                style={{ width: 28, height: 28, fontSize: 14 }}
              >
                <i className="ti ti-clock" />
              </span>
              Upcoming Certificates
              <small className="text-muted fw-normal" style={{ fontSize: 12 }}>
                — will be officially issued soon
              </small>
            </h6>
            <div className="row g-4">
              {upcoming.map((cert) => (
                <div key={cert.id} className="col-lg-4 col-md-6">
                  <CertificateCard cert={cert} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentCertificates;
