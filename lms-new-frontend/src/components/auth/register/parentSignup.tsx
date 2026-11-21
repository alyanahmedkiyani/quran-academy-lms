"use client";

import { all_routes } from "@/routes/all_routes";
import Link from "next/link";
import { ChangeEvent, FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { signupParentRequest } from "@/services/authService";
import AuthCenteredLayout from "@/components/auth/shared/AuthCenteredLayout";
import PasswordField from "@/components/auth/shared/PasswordField";

const ParentSignupComponent = () => {
  const router = useRouter();

  const [formValues, setFormValues] = useState({
    firstName: "",
    lastName: "",
    username: "",
    email: "",
    contact: "",
    address: "",
    studentId: "",
    password: "",
    confirmPassword: "",
  });

  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmPasswordVisible, setConfirmPasswordVisible] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormValues((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFeedback(null);

    if (!formValues.firstName.trim() || !formValues.username.trim() || !formValues.password.trim() || !formValues.studentId.trim()) {
      setFeedback({ type: "error", message: "First name, username, student ID, and password are required." });
      return;
    }

    if (formValues.password !== formValues.confirmPassword) {
      setFeedback({ type: "error", message: "Passwords do not match." });
      return;
    }

    if (formValues.password.length < 5) {
      setFeedback({ type: "error", message: "Password must be at least 5 characters." });
      return;
    }

    setLoading(true);
    try {
      await signupParentRequest({
        firstName: formValues.firstName.trim(),
        lastName: formValues.lastName.trim(),
        username: formValues.username.trim(),
        email: formValues.email.trim(),
        contact: formValues.contact.trim(),
        address: formValues.address.trim(),
        studentId: Number(formValues.studentId),
        password: formValues.password,
      });
      setFeedback({ type: "success", message: "Account created successfully! You can now log in." });
      setTimeout(() => router.replace(all_routes.login), 2000);
    } catch (error: any) {
      setFeedback({ type: "error", message: error?.message ?? "Registration failed. Please try again." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCenteredLayout width="md" onSubmit={handleSubmit}>
      <div className="text-center mb-4">
        <h5 className="mb-1 fs-20 fw-bold">Parent Registration</h5>
        <p className="text-muted mb-0">Create your parent account to monitor your child&apos;s progress</p>
      </div>

      {feedback && (
        <div className={`alert alert-${feedback.type === "success" ? "success" : "danger"} py-2`} role="alert">
          {feedback.message}
        </div>
      )}

      <div className="row g-3">
        <div className="col-sm-6">
          <label className="form-label" htmlFor="firstName">
            First Name <span className="text-danger">*</span>
          </label>
          <input
            id="firstName"
            type="text"
            name="firstName"
            value={formValues.firstName}
            onChange={handleChange}
            className="form-control"
            placeholder="First name"
            required
          />
        </div>
        <div className="col-sm-6">
          <label className="form-label" htmlFor="lastName">
            Last Name
          </label>
          <input
            id="lastName"
            type="text"
            name="lastName"
            value={formValues.lastName}
            onChange={handleChange}
            className="form-control"
            placeholder="Last name"
          />
        </div>
        <div className="col-sm-6">
          <label className="form-label" htmlFor="username">
            Username <span className="text-danger">*</span>
          </label>
          <input
            id="username"
            type="text"
            name="username"
            autoComplete="username"
            value={formValues.username}
            onChange={handleChange}
            className="form-control"
            placeholder="Choose a username"
            required
          />
        </div>
        <div className="col-sm-6">
          <label className="form-label" htmlFor="studentId">
            Student ID <span className="text-danger">*</span>
          </label>
          <input
            id="studentId"
            type="number"
            name="studentId"
            value={formValues.studentId}
            onChange={handleChange}
            className="form-control"
            placeholder="Your child's student ID"
            required
          />
        </div>
        <div className="col-sm-6">
          <label className="form-label" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            name="email"
            value={formValues.email}
            onChange={handleChange}
            className="form-control"
            placeholder="you@example.com"
          />
        </div>
        <div className="col-sm-6">
          <label className="form-label" htmlFor="contact">
            Contact
          </label>
          <input
            id="contact"
            type="text"
            name="contact"
            value={formValues.contact}
            onChange={handleChange}
            className="form-control"
            placeholder="Phone number"
          />
        </div>
        <div className="col-12">
          <label className="form-label" htmlFor="address">
            Address
          </label>
          <input
            id="address"
            type="text"
            name="address"
            value={formValues.address}
            onChange={handleChange}
            className="form-control"
            placeholder="Your address"
          />
        </div>
        <div className="col-sm-6">
          <PasswordField
            id="password"
            label="Password *"
            name="password"
            value={formValues.password}
            onChange={handleChange}
            visible={passwordVisible}
            onToggle={() => setPasswordVisible((p) => !p)}
            autoComplete="new-password"
            required
          />
        </div>
        <div className="col-sm-6">
          <PasswordField
            id="confirmPassword"
            label="Confirm Password *"
            name="confirmPassword"
            value={formValues.confirmPassword}
            onChange={handleChange}
            visible={confirmPasswordVisible}
            onToggle={() => setConfirmPasswordVisible((p) => !p)}
            autoComplete="new-password"
            required
          />
        </div>
      </div>

      <div className="mt-2 mb-2">
        <button type="submit" className="btn btn-primary text-white w-100 fw-semibold" disabled={loading}>
          {loading ? "Creating account..." : "Create Account"}
        </button>
      </div>

      <div className="text-center mt-2">
        <span className="fs-14 text-body">Already have an account? </span>
        <Link href={all_routes.login} className="hover-a fw-semibold">
          Sign In
        </Link>
      </div>
    </AuthCenteredLayout>
  );
};

export default ParentSignupComponent;
