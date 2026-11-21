"use client";

import Link from "next/link";
import { all_routes } from "@/routes/all_routes";
import ImageWithBasePath from "@/core/imageWithBasePath";
import AuthSplitLayout from "@/components/auth/shared/AuthSplitLayout";

const ForgotPasswordIllustrationComponent = () => {
  return (
    <AuthSplitLayout
      panelClassName="auth-side-panel-illustration"
      panel={
        <ImageWithBasePath
          src="assets/img/auth/forgot-illustration-img.png"
          alt="Forgot password illustration"
          className="img-fluid"
        />
      }
    >
      <div className="text-center mb-4">
        <h5 className="mb-1 fs-20 fw-bold">Forgot Password</h5>
        <p className="text-muted mb-0">No worries, we&apos;ll send you reset instructions</p>
      </div>
      <div className="mb-3">
        <label className="form-label" htmlFor="illustration-email">
          Email Address
        </label>
        <div className="input-group">
          <span className="input-group-text border-end-0 bg-transparent">
            <i className="ti ti-mail fs-14 text-muted" />
          </span>
          <input
            id="illustration-email"
            type="text"
            className="form-control border-start-0 ps-0"
            placeholder="Enter Email Address"
          />
        </div>
      </div>
      <div className="mb-3">
        <Link
          href={all_routes.emailverificationillustration}
          className="btn btn-primary text-white w-100 fw-semibold"
        >
          Reset Password
        </Link>
      </div>
      <div className="text-center">
        <span className="fs-14 text-body">Return to </span>
        <Link href={all_routes.loginillustration} className="hover-a fw-semibold">
          Login
        </Link>
      </div>
    </AuthSplitLayout>
  );
};

export default ForgotPasswordIllustrationComponent;
