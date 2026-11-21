"use client";

import { ChangeEvent, KeyboardEvent } from "react";

interface PasswordFieldProps {
  id: string;
  label: string;
  name?: string;
  value?: string;
  onChange?: (e: ChangeEvent<HTMLInputElement>) => void;
  visible: boolean;
  onToggle: () => void;
  autoComplete?: string;
  placeholder?: string;
  required?: boolean;
}

const PasswordField = ({
  id,
  label,
  name,
  value,
  onChange,
  visible,
  onToggle,
  autoComplete = "current-password",
  placeholder = "••••••••",
  required,
}: PasswordFieldProps) => {
  const handleToggleKeyDown = (e: KeyboardEvent<HTMLSpanElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onToggle();
    }
  };

  return (
    <div className="mb-3">
      <label className="form-label" htmlFor={id}>
        {label}
      </label>
      <div className="pass-group input-group position-relative border rounded">
        <span className="input-group-text bg-transparent border-0">
          <i className="ti ti-lock text-muted fs-14" />
        </span>
        <input
          id={id}
          name={name}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          value={value}
          onChange={onChange}
          required={required}
          className="pass-input form-control border-start-0 ps-0"
          placeholder={placeholder}
        />
        <span
          role="button"
          tabIndex={0}
          aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          aria-pressed={visible}
          className={`ti toggle-password text-muted fs-14 ${visible ? "ti-eye" : "ti-eye-off"}`}
          onClick={onToggle}
          onKeyDown={handleToggleKeyDown}
        />
      </div>
    </div>
  );
};

export default PasswordField;
