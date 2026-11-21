"use client";

import { useState } from "react";
import Link from "next/link";
import { all_routes } from "@/routes/all_routes";
import ImageWithBasePath from "@/core/imageWithBasePath";
import AuthSplitLayout from "@/components/auth/shared/AuthSplitLayout";
import PasswordField from "@/components/auth/shared/PasswordField";

const ResetPasswordIllustrationComponent = () => {
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmPasswordVisible, setConfirmPasswordVisible] = useState(false);

  return (
    <AuthSplitLayout
      panelClassName="auth-side-panel-illustration"
      panel={
        <ImageWithBasePath
          src="assets/img/auth/reset-illustration-img.png"
          alt="Reset password illustration"
          className="img-fluid"
        />
      }
    >
      <div className="text-center mb-4">
        <h5 className="mb-1 fs-20 fw-bold">Reset Password</h5>
        <p className="text-muted mb-0">Your new password must be different from previous used passwords.</p>
      </div>
      <PasswordField
        id="illustration-new-password"
        label="Password"
        visible={passwordVisible}
        onToggle={() => setPasswordVisible((v) => !v)}
        autoComplete="new-password"
      />
      <PasswordField
        id="illustration-confirm-password"
        label="Confirm Password"
        visible={confirmPasswordVisible}
        onToggle={() => setConfirmPasswordVisible((v) => !v)}
        autoComplete="new-password"
      />
      <div className="mb-3">
        <button type="submit" className="btn btn-primary text-white w-100 fw-semibold">
          Submit
        </button>
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

export default ResetPasswordIllustrationComponent;
