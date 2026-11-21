"use client";

import ImageWithBasePath from "@/core/imageWithBasePath";
import type { OTPProps } from "antd/es/input/OTP";
import { useEffect, useState } from "react";
import { Input } from "antd";
import { all_routes } from "@/routes/all_routes";
import Link from "next/link";
import AuthSplitLayout from "@/components/auth/shared/AuthSplitLayout";

const TwoStepVerificationIllustrationComponent = () => {
  const onChange: OTPProps["onChange"] = (text) => {
    console.log("onChange:", text);
  };

  const onInput: OTPProps["onInput"] = (value) => {
    console.log("onInput:", value);
  };
  const sharedProps: OTPProps = {
    onChange,
    onInput,
  };

  const [seconds, setSeconds] = useState(60);

  useEffect(() => {
    if (seconds <= 0) return;

    const intervalId = setInterval(() => {
      setSeconds((prevSeconds) => {
        if (prevSeconds <= 1) {
          clearInterval(intervalId);
          return 0;
        }
        return prevSeconds - 1;
      });
    }, 1000);

    return () => clearInterval(intervalId);
  }, [seconds]);

  const formatTime = (totalSeconds: number) => {
    const minutes = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${minutes < 10 ? "0" + minutes : minutes}:${secs < 10 ? "0" + secs : secs}`;
  };

  return (
    <AuthSplitLayout
      panelClassName="auth-side-panel-illustration"
      panel={
        <ImageWithBasePath
          src="assets/img/auth/twostep-verification-illustration-img.png"
          alt="Two-step verification illustration"
          className="img-fluid"
        />
      }
    >
      <div className="text-center mb-3">
        <h5 className="mb-1 fs-20 fw-bold">2 Step Verification</h5>
        <p className="text-muted mb-0">
          Please enter the OTP received to confirm your account ownership. A code has been sent to
          <span className="text-body fw-semibold d-block">******doe@example.com</span>
        </p>
      </div>
      <div className="text-center otp-input">
        <div className="d-flex align-items-center justify-content-center mb-3">
          <Input.OTP length={4} {...sharedProps} />
        </div>
        <div className="d-flex justify-content-center">
          <div className="mb-3 d-flex align-items-center">
            <p className="text-muted me-4 mb-0">
              Didn&apos;t receive code?{" "}
              <Link href="#" className="text-primary">
                Resend Code
              </Link>
            </p>
            <span className="text-danger">{formatTime(seconds)}</span>
          </div>
        </div>
      </div>
      <div className="mt-0">
        <Link href={all_routes.resetpasswordillustration} className="btn btn-primary text-white w-100 fw-semibold">
          Submit
        </Link>
      </div>
    </AuthSplitLayout>
  );
};

export default TwoStepVerificationIllustrationComponent;
