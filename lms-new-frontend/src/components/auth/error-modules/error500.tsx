"use client";

import ImageWithBasePath from "@/core/imageWithBasePath";
import { all_routes } from "@/routes/all_routes";
import Link from "next/link";
import AuthBrand from "@/components/auth/shared/AuthBrand";

const Error500Component = () => {
  return (
    <div className="auth-bg position-relative overflow-hidden">
      <div className="container-fuild">
        <div className="w-100 overflow-hidden position-relative flex-wrap d-block vh-100 z-1">
          <div className="row justify-content-center align-items-center vh-100 overflow-auto flex-wrap">
            <div className="col-lg-6">
              <div className="d-flex flex-column align-items-center justify-content-center">
                <AuthBrand className="mb-5" />
                <div className="error-images mb-3">
                  <ImageWithBasePath src="assets/img/error-500.svg" alt="Server error" className="img-fluid" />
                </div>
                <div className="text-center">
                  <h4 className="mb-2 fw-bold">Something went wrong on our end</h4>
                  <p className="fs-14 text-muted text-center">
                    Server error 500. We&apos;re on it — please try again in a few minutes.
                  </p>
                  <div className="d-flex justify-content-center pb-3">
                    <Link href={all_routes.dashboard} className="btn btn-primary d-flex align-items-center fw-semibold">
                      <i className="ti ti-chevron-left me-2" />
                      Back to Dashboard
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <ImageWithBasePath src="assets/img/auth/auth-bg-top.png" alt="" className="img-fluid element-01" />
      <ImageWithBasePath src="assets/img/auth/auth-bg-bot.png" alt="" className="img-fluid element-02" />
    </div>
  );
};

export default Error500Component;
