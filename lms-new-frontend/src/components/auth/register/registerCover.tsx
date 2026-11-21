"use client";

import { useState } from "react";
import Link from "next/link";
import { all_routes } from "@/routes/all_routes";
import AuthSplitLayout from "@/components/auth/shared/AuthSplitLayout";
import AuthBrandPanel from "@/components/auth/shared/AuthBrandPanel";
import PasswordField from "@/components/auth/shared/PasswordField";

const RegisterCoverComponent = () => {
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmPasswordVisible, setConfirmPasswordVisible] = useState(false);

  return (
    <AuthSplitLayout
      panelClassName="auth-side-panel-brand"
      panel={
        <AuthBrandPanel
          heading="Join your school's learning workspace"
          description="Create an account to access courses, track progress, and stay in sync with your school community."
          image="assets/img/auth/cover-imgs-1.png"
        />
      }
    >
      <div className="text-center mb-4">
        <h5 className="mb-1 fs-20 fw-bold">Register</h5>
        <p className="text-muted mb-0">Please enter your details to create account</p>
      </div>
      <div className="mb-3">
        <label className="form-label" htmlFor="cover-name">
          Full Name
        </label>
        <div className="input-group">
          <span className="input-group-text border-end-0 bg-transparent">
            <i className="ti ti-user fs-14 text-muted" />
          </span>
          <input id="cover-name" type="text" className="form-control border-start-0 ps-0" placeholder="Enter Name" />
        </div>
      </div>
      <div className="mb-3">
        <label className="form-label" htmlFor="cover-email">
          Email Address
        </label>
        <div className="input-group">
          <span className="input-group-text border-end-0 bg-transparent">
            <i className="ti ti-mail fs-14 text-muted" />
          </span>
          <input
            id="cover-email"
            type="text"
            className="form-control border-start-0 ps-0"
            placeholder="Enter Email Address"
          />
        </div>
      </div>
      <PasswordField
        id="cover-password"
        label="Password"
        visible={passwordVisible}
        onToggle={() => setPasswordVisible((v) => !v)}
        autoComplete="new-password"
      />
      <PasswordField
        id="cover-confirm-password"
        label="Confirm Password"
        visible={confirmPasswordVisible}
        onToggle={() => setConfirmPasswordVisible((v) => !v)}
        autoComplete="new-password"
      />
      <div className="d-flex align-items-center mb-3">
        <div className="form-check form-check-md mb-0">
          <input className="form-check-input" id="remember_me" type="checkbox" />
          <label htmlFor="remember_me" className="form-check-label mt-0 text-body">
            I agree to the
            <Link href={all_routes.termsCondition} className="text-decoration-underline text-primary ms-1 me-1">
              Terms of Service
            </Link>
            &amp;
            <Link href={all_routes.privacyPolicy} className="text-decoration-underline text-primary ms-1">
              Privacy Policy
            </Link>
          </label>
        </div>
      </div>
      <div className="mb-2">
        <Link href={all_routes.loginCover} className="btn btn-primary text-white w-100 fw-semibold">
          Register
        </Link>
      </div>
      <div className="text-center mt-3">
        <span className="fs-14 text-body">Already have an account? </span>
        <Link href={all_routes.loginCover} className="hover-a fw-semibold">
          Login
        </Link>
      </div>
    </AuthSplitLayout>
  );
};

export default RegisterCoverComponent;
