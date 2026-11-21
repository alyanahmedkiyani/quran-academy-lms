"use client";

import Link from "next/link";
import ImageWithBasePath from "@/core/imageWithBasePath";
import { all_routes } from "@/routes/all_routes";
import AuthSplitLayout from "@/components/auth/shared/AuthSplitLayout";

const EmailVerificationIllustrationComponent = () => {
  return (
    <AuthSplitLayout
      panelClassName="auth-side-panel-illustration"
      panel={
        <ImageWithBasePath
          src="assets/img/auth/email-verification-illustration-img.png"
          alt="Email verification illustration"
          className="img-fluid"
        />
      }
    >
      <div className="mb-3 text-center">
        <span className="auth-portal-icon auth-portal-icon-success">
          <i className="ti ti-circle-check-filled fs-24" />
        </span>
      </div>
      <div className="text-center mb-3">
        <h5 className="mb-1 fs-20 fw-bold">Email Sent!</h5>
        <p className="text-muted mb-0">Check your email &amp; change your password.</p>
      </div>
      <div className="mt-3">
        <Link
          href={all_routes.twostepverificationillustration}
          className="btn btn-primary text-white w-100 fw-semibold"
        >
          Continue
        </Link>
      </div>
    </AuthSplitLayout>
  );
};

export default EmailVerificationIllustrationComponent;
