/**
 * Shared phone country definitions used for input + Yup validation.
 * Keep in sync with backend/utils/phoneCountries.js
 */
export const PHONE_COUNTRIES = [
  // South Asia
  { code: "PK", flag: "🇵🇰", dialCode: "+92",  label: "Pakistan",       digits: 10 },
  { code: "IN", flag: "🇮🇳", dialCode: "+91",  label: "India",          digits: 10 },
  // North America
  { code: "US", flag: "🇺🇸", dialCode: "+1",   label: "United States",  digits: 10 },
  { code: "CA", flag: "🇨🇦", dialCode: "+1",   label: "Canada",         digits: 10 },
  { code: "MX", flag: "🇲🇽", dialCode: "+52",  label: "Mexico",         digits: 10 },
  // Europe
  { code: "GB", flag: "🇬🇧", dialCode: "+44",  label: "United Kingdom", digits: 10 },
  { code: "DE", flag: "🇩🇪", dialCode: "+49",  label: "Germany",        digits: 10 },
  { code: "FR", flag: "🇫🇷", dialCode: "+33",  label: "France",         digits: 9  },
  { code: "IT", flag: "🇮🇹", dialCode: "+39",  label: "Italy",          digits: 10 },
  { code: "ES", flag: "🇪🇸", dialCode: "+34",  label: "Spain",          digits: 9  },
  { code: "NL", flag: "🇳🇱", dialCode: "+31",  label: "Netherlands",    digits: 9  },
  { code: "RU", flag: "🇷🇺", dialCode: "+7",   label: "Russia",         digits: 10 },
  { code: "TR", flag: "🇹🇷", dialCode: "+90",  label: "Turkey",         digits: 10 },
  // Middle East
  { code: "AE", flag: "🇦🇪", dialCode: "+971", label: "UAE",            digits: 9  },
  { code: "SA", flag: "🇸🇦", dialCode: "+966", label: "Saudi Arabia",   digits: 9  },
  // Asia Pacific
  { code: "CN", flag: "🇨🇳", dialCode: "+86",  label: "China",          digits: 11 },
  { code: "JP", flag: "🇯🇵", dialCode: "+81",  label: "Japan",          digits: 10 },
  { code: "KR", flag: "🇰🇷", dialCode: "+82",  label: "South Korea",    digits: 10 },
  { code: "SG", flag: "🇸🇬", dialCode: "+65",  label: "Singapore",      digits: 8  },
  { code: "MY", flag: "🇲🇾", dialCode: "+60",  label: "Malaysia",       digits: 9  },
  { code: "AU", flag: "🇦🇺", dialCode: "+61",  label: "Australia",      digits: 9  },
  { code: "NZ", flag: "🇳🇿", dialCode: "+64",  label: "New Zealand",    digits: 9  },
  // Americas
  { code: "BR", flag: "🇧🇷", dialCode: "+55",  label: "Brazil",         digits: 11 },
  // Africa
  { code: "ZA", flag: "🇿🇦", dialCode: "+27",  label: "South Africa",   digits: 9  },
  { code: "NG", flag: "🇳🇬", dialCode: "+234", label: "Nigeria",        digits: 10 },
] as const;

export type PhoneCountry = typeof PHONE_COUNTRIES[number];

/** Yup .test() validator — use with .test("phone", "", phoneYupValidator) */
export function phoneYupValidator(
  this: import("yup").TestContext,
  val: string | undefined
): boolean | import("yup").ValidationError {
  if (!val) return this.createError({ message: "Contact number is required" });
  const country = PHONE_COUNTRIES.find((c) => val.startsWith(c.dialCode));
  if (!country) return this.createError({ message: "Select a valid country" });
  const national = val.slice(country.dialCode.length).replace(/\D/g, "");
  if (national.length !== country.digits) {
    return this.createError({
      message: `${country.label} (${country.dialCode}) number must be exactly ${country.digits} digits`,
    });
  }
  return true;
}
