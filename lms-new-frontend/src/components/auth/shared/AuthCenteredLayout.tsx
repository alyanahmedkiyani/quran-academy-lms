"use client";

import { FormEvent, ReactNode } from "react";
import ImageWithBasePath from "@/core/imageWithBasePath";
import AuthBrand from "./AuthBrand";

const widthClass: Record<"sm" | "md" | "lg", string> = {
  sm: "col-lg-4",
  md: "col-lg-5",
  lg: "col-lg-6",
};

interface AuthCenteredLayoutProps {
  children: ReactNode;
  width?: "sm" | "md" | "lg";
  onSubmit?: (e: FormEvent<HTMLFormElement>) => void;
}

const AuthCenteredLayout = ({ children, width = "sm", onSubmit }: AuthCenteredLayoutProps) => {
  return (
    <div className="auth-bg position-relative overflow-hidden">
      <div className="container-fuild position-relative z-1">
        <div className="w-100 overflow-hidden position-relative flex-wrap d-block vh-100">
          <div className="row justify-content-center align-items-center vh-100 overflow-auto flex-wrap py-3">
            <div className={`${widthClass[width]} mx-auto`}>
              <AuthBrand />
              <form className="auth-card card border-0 shadow-sm rounded-4 mb-4" onSubmit={onSubmit}>
                <div className="card-body p-4 p-lg-5">{children}</div>
              </form>
              <p className="text-muted text-center small mb-0">
                Copyright © {new Date().getFullYear()} - QA LMS
              </p>
            </div>
          </div>
        </div>
      </div>
      <ImageWithBasePath src="assets/img/auth/auth-bg-top.png" alt="" className="img-fluid element-01" />
      <ImageWithBasePath src="assets/img/auth/auth-bg-bot.png" alt="" className="img-fluid element-02" />
    </div>
  );
};

export default AuthCenteredLayout;
