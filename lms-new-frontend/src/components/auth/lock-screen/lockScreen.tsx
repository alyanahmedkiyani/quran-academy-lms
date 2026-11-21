"use client";

import { useState } from "react";
import ImageWithBasePath from "@/core/imageWithBasePath";
import Link from "next/link";
import { all_routes } from "@/routes/all_routes";
import AuthCenteredLayout from "@/components/auth/shared/AuthCenteredLayout";
import PasswordField from "@/components/auth/shared/PasswordField";

const LockScreenComponent = () => {
  const [passwordVisible, setPasswordVisible] = useState(false);

  return (
    <AuthCenteredLayout>
      <div className="text-center mb-3">
        <h5 className="mb-1 fs-20 fw-bold">Welcome Back!</h5>
      </div>
      <div className="text-center mb-3">
        <span className="avatar avatar-xxl rounded-circle flex-shrink-0 mb-2">
          <ImageWithBasePath src="assets/img/users/user-01.jpg" className="rounded-circle" alt="John Carter" />
        </span>
        <p className="text-body mb-0 fw-semibold">John Carter</p>
      </div>
      <PasswordField
        id="lock-password"
        label="Password"
        visible={passwordVisible}
        onToggle={() => setPasswordVisible((v) => !v)}
      />
      <div className="mb-2">
        <Link href={all_routes.login} className="btn btn-primary text-white w-100 fw-semibold">
          Unlock
        </Link>
      </div>
    </AuthCenteredLayout>
  );
};

export default LockScreenComponent;
