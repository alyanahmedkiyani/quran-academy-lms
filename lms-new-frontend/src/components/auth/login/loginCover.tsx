"use client";

import { useState } from "react";
import Link from "next/link";
import { all_routes } from "@/routes/all_routes";
import AuthSplitLayout from "@/components/auth/shared/AuthSplitLayout";
import AuthBrandPanel from "@/components/auth/shared/AuthBrandPanel";
import PasswordField from "@/components/auth/shared/PasswordField";

const LoginCover = () => {
  const [passwordVisible, setPasswordVisible] = useState(false);

  return (
    <AuthSplitLayout
      panelClassName="auth-side-panel-brand"
      panel={
        <AuthBrandPanel
          heading="Everything your school needs, in one place"
          description="Manage classes, track attendance, and stay connected — a single, secure workspace for admins, teachers, parents and students."
          image="assets/img/auth/cover-imgs-1.png"
        />
      }
    >
      <div className="text-center mb-4">
        <h5 className="mb-1 fs-20 fw-bold">Sign In</h5>
        <p className="text-muted mb-0">Please enter your details to access the dashboard</p>
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
      />
      <div className="d-flex align-items-center justify-content-between mb-3">
        <div className="form-check form-check-md mb-0">
          <input className="form-check-input" id="remember_me" type="checkbox" />
          <label htmlFor="remember_me" className="form-check-label mt-0 text-body">
            Remember Me
          </label>
        </div>
        <Link href={all_routes.forgotpasswordcover} className="fs-14">
          Forgot Password?
        </Link>
      </div>
      <div className="mb-2">
        <Link href={all_routes.dashboard} className="btn btn-primary text-white w-100 fw-semibold">
          Login
        </Link>
      </div>
      <div className="text-center mt-3">
        <span className="fs-14 text-body">Don&apos;t have an account yet? </span>
        <Link href={all_routes.registercover} className="hover-a fw-semibold">
          Register
        </Link>
      </div>
    </AuthSplitLayout>
  );
};

export default LoginCover;
