"use client";

import { FormEvent, ReactNode } from "react";
import AuthBrand from "./AuthBrand";

interface AuthSplitLayoutProps {
  children: ReactNode;
  panel: ReactNode;
  panelClassName?: string;
  onSubmit?: (e: FormEvent<HTMLFormElement>) => void;
}

const AuthSplitLayout = ({ children, panel, panelClassName = "", onSubmit }: AuthSplitLayoutProps) => {
  return (
    <div className="auth-bg position-relative overflow-hidden">
      <div className="container-fuild position-relative z-1">
        <div className="w-100 overflow-hidden position-relative flex-wrap d-block vh-100 bg-white">
          <div className="row g-0">
            <div className="col-lg-6 d-none d-lg-block">
              <div
                className={`auth-side-panel h-100 d-flex align-items-center justify-content-center p-5 position-relative ${panelClassName}`}
              >
                {panel}
              </div>
            </div>
            <div className="col-lg-6 col-12">
              <div className="row justify-content-center align-items-center overflow-auto flex-wrap vh-100 py-3">
                <div className="col-md-8 mx-auto">
                  <AuthBrand />
                  <form className="auth-card card border-0 shadow-sm rounded-4 m-0" onSubmit={onSubmit}>
                    <div className="card-body p-4 p-lg-5">{children}</div>
                  </form>
                  <p className="text-muted text-center small mt-4 mb-0">
                    Copyright © {new Date().getFullYear()} - QA LMS
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthSplitLayout;
