"use client";

import { all_routes } from "@/routes/all_routes";
import Link from "next/link";
import { ChangeEvent, FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppDispatch, useAppSelector } from "@/core/redux/hooks";
import { clearAuth, clearAuthError, setAuthError, setAuthLoading, setCredentials } from "@/core/redux/authSlice";
import { loginRequest, loginStudentRequest, loginTeacherRequest, loginParentRequest } from "@/services/authService";
import { persistAuth, clearAuthStorage } from "@/lib/auth-storage";
import { getDashboardRouteForRole, isAdminAuthorityRole, isStudentRole, isTeacherRole, isParentRole } from "@/lib/roles";
import AuthCenteredLayout from "@/components/auth/shared/AuthCenteredLayout";
import PasswordField from "@/components/auth/shared/PasswordField";

type LoginVariant = "student" | "teacher" | "admin" | "parent";

interface LoginComponentProps {
  variant?: LoginVariant;
}

const variantCopy: Record<
  LoginVariant,
  { title: string; subtitle: string; button: string; accent: string; icon: string }
> = {
  student: {
    title: "Student Login",
    subtitle: "Sign in to access your learning portal",
    button: "Sign In",
    accent: "primary",
    icon: "ti-school",
  },
  teacher: {
    title: "Teacher Login",
    subtitle: "Sign in to manage your classes and students",
    button: "Sign In",
    accent: "success",
    icon: "ti-chalkboard",
  },
  admin: {
    title: "Admin Access",
    subtitle: "Restricted portal for Admin & Super Admin roles",
    button: "Admin Login",
    accent: "danger",
    icon: "ti-shield-lock",
  },
  parent: {
    title: "Parent Login",
    subtitle: "Sign in to monitor your child's progress",
    button: "Sign In",
    accent: "info",
    icon: "ti-users",
  },
};

const getLoginFn = (variant: LoginVariant) => {
  if (variant === "student") return loginStudentRequest;
  if (variant === "teacher") return loginTeacherRequest;
  if (variant === "parent") return loginParentRequest;
  return loginRequest;
};

const LoginComponent = ({ variant = "student" }: LoginComponentProps) => {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const { loading } = useAppSelector((state) => state.auth);

  const [passwordVisible, setPasswordVisible] = useState(false);
  const [formValues, setFormValues] = useState({ username: "", password: "" });
  const [formFeedback, setFormFeedback] = useState<string | null>(null);

  const copy = variantCopy[variant];
  const isAdminVariant = variant === "admin";

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormValues((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormFeedback(null);
    dispatch(clearAuthError());

    if (!formValues.username.trim() || !formValues.password.trim()) {
      setFormFeedback("Username and password are required.");
      return;
    }

    dispatch(setAuthLoading());

    try {
      const loginFn = getLoginFn(variant);
      const response = await loginFn({ username: formValues.username.trim(), password: formValues.password });
      const roleName = response.user.role?.name ?? null;

      // Role-portal mismatch guards
      // Only block clearly non-admin roles; sub-admins have custom role names but are valid Admin table users
      if (variant === "admin" && (isStudentRole(roleName) || isTeacherRole(roleName) || isParentRole(roleName))) {
        setFormFeedback("This portal is for Admin or Super Admin accounts only.");
        dispatch(clearAuth());
        clearAuthStorage();
        return;
      }
      if (variant === "student" && !isStudentRole(roleName)) {
        setFormFeedback("This portal is for students only.");
        dispatch(clearAuth());
        clearAuthStorage();
        return;
      }
      if (variant === "teacher" && !isTeacherRole(roleName)) {
        setFormFeedback("This portal is for teachers only.");
        dispatch(clearAuth());
        clearAuthStorage();
        return;
      }
      if (variant === "parent" && !isParentRole(roleName)) {
        setFormFeedback("This portal is for parents only.");
        dispatch(clearAuth());
        clearAuthStorage();
        return;
      }

      dispatch(setCredentials(response));
      persistAuth(response);
      router.replace(getDashboardRouteForRole(roleName ?? undefined));
    } catch (error: any) {
      const message = error?.message ?? "Unable to sign in. Please try again.";
      dispatch(setAuthError(message));
      setFormFeedback(message);
    }
  };

  return (
    <AuthCenteredLayout onSubmit={handleSubmit}>
      <div className="text-center mb-4">
        <span className={`auth-portal-icon auth-portal-icon-${copy.accent} mb-3`}>
          <i className={`ti ${copy.icon} fs-24`} />
        </span>
        <h5 className="mb-1 fs-20 fw-bold">{copy.title}</h5>
        <p className="text-muted mb-0">{copy.subtitle}</p>
      </div>

      {isAdminVariant && (
        <div className="auth-role-banner mb-3 auth-role-banner-danger">
          <div className="d-flex flex-column flex-sm-row align-items-center align-items-sm-start text-center text-sm-start gap-3">
            <span className="badge bg-danger text-white rounded-pill px-3 py-2 d-inline-flex align-items-center gap-2">
              <i className="ti ti-shield-lock fs-16" />
              Admin
            </span>
            <div>
              <p className="fw-semibold text-danger mb-1 mb-sm-0">Privileged access area</p>
              <p className="mb-0 text-body small">
                Additional monitoring applies here. Use Admin or Super Admin credentials only.
              </p>
            </div>
          </div>
        </div>
      )}

      {formFeedback && (
        <div className="alert alert-danger py-2" role="alert">
          {formFeedback}
        </div>
      )}

      <div className="mb-3">
        <label className="form-label" htmlFor="login-username">
          Username
        </label>
        <div className="input-group">
          <span className="input-group-text border-end-0 bg-transparent">
            <i className="ti ti-user fs-14 text-muted" />
          </span>
          <input
            id="login-username"
            type="text"
            name="username"
            autoComplete="username"
            value={formValues.username}
            onChange={handleChange}
            className="form-control border-start-0 ps-0"
            placeholder="Enter your username"
          />
        </div>
      </div>

      <PasswordField
        id="login-password"
        label="Password"
        name="password"
        value={formValues.password}
        onChange={handleChange}
        visible={passwordVisible}
        onToggle={() => setPasswordVisible((prev) => !prev)}
        autoComplete="current-password"
      />

      <div className="d-flex align-items-center mb-3">
        <div className="form-check form-check-md mb-0">
          <input className="form-check-input" id="remember_me" type="checkbox" />
          <label htmlFor="remember_me" className="form-check-label mt-0 text-body">
            Remember Me
          </label>
        </div>
      </div>

      <div className="mb-2">
        <button type="submit" className={`btn btn-${copy.accent} text-white w-100 fw-semibold`} disabled={loading}>
          {loading ? "Signing in..." : copy.button}
        </button>
      </div>

      {/* Cross-portal links */}
      {variant === "student" && (
        <div className="text-center mt-3">
          <span className="fs-14 text-body">Are you a parent? </span>
          <Link href={all_routes.parentLogin} className="hover-a fw-semibold">
            Parent Login
          </Link>
        </div>
      )}

      {variant === "teacher" && (
        <div className="text-center mt-3">
          <span className="fs-14 text-body">Student? </span>
          <Link href={all_routes.login} className="hover-a fw-semibold">
            Student Login
          </Link>
        </div>
      )}

      {variant === "parent" && (
        <div className="text-center mt-3">
          <span className="fs-14 text-body">Are you a student? </span>
          <Link href={all_routes.login} className="hover-a fw-semibold">
            Student Login
          </Link>
        </div>
      )}
    </AuthCenteredLayout>
  );
};

export default LoginComponent;
