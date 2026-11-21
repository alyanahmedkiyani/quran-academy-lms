"use client";

import { useState } from "react";
import { PHONE_COUNTRIES, PhoneCountry } from "@/lib/phoneCountries";

interface PhoneCountryInputProps {
  value: string;
  onChange: (val: string) => void;
  onBlur?: () => void;
  disabled?: boolean;
  isInvalid?: boolean;
}

function getCountryFromValue(val: string): PhoneCountry {
  return PHONE_COUNTRIES.find((c) => val.startsWith(c.dialCode)) ?? PHONE_COUNTRIES[0];
}

export default function PhoneCountryInput({
  value,
  onChange,
  onBlur,
  disabled,
  isInvalid,
}: PhoneCountryInputProps) {
  const [selectedCode, setSelectedCode] = useState<string>(
    () => getCountryFromValue(value).code
  );
  const [national, setNational] = useState<string>(() => {
    const c = getCountryFromValue(value);
    return value.startsWith(c.dialCode) ? value.slice(c.dialCode.length) : "";
  });

  const country = PHONE_COUNTRIES.find((c) => c.code === selectedCode) ?? PHONE_COUNTRIES[0];

  const handleCountryChange = (code: string) => {
    setSelectedCode(code);
    setNational("");
    const newCountry = PHONE_COUNTRIES.find((c) => c.code === code)!;
    onChange(newCountry.dialCode);
  };

  const handleNationalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, "").slice(0, country.digits);
    setNational(digits);
    onChange(country.dialCode + digits);
  };

  return (
    <div className="input-group">
      <select
        className="form-select"
        style={{ maxWidth: 115, flexShrink: 0 }}
        value={selectedCode}
        disabled={disabled}
        onChange={(e) => handleCountryChange(e.target.value)}
      >
        {PHONE_COUNTRIES.map((c) => (
          <option key={c.code} value={c.code}>
            {c.flag} {c.dialCode}
          </option>
        ))}
      </select>
      <input
        type="text"
        inputMode="numeric"
        className={`form-control${isInvalid ? " is-invalid" : ""}`}
        placeholder={"0".repeat(country.digits)}
        value={national}
        maxLength={country.digits}
        disabled={disabled}
        onChange={handleNationalChange}
        onBlur={onBlur}
      />
    </div>
  );
}
