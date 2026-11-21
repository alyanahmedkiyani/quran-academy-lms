export interface Country {
  name: string;
  iso3: string;
}

export const COUNTRIES: Country[] = [
  { name: "Australia",              iso3: "AUS" },
  { name: "Bahrain",                iso3: "BHR" },
  { name: "Bangladesh",             iso3: "BGD" },
  { name: "Canada",                 iso3: "CAN" },
  { name: "Egypt",                  iso3: "EGY" },
  { name: "France",                 iso3: "FRA" },
  { name: "Germany",                iso3: "DEU" },
  { name: "India",                  iso3: "IND" },
  { name: "Indonesia",              iso3: "IDN" },
  { name: "Ireland",                iso3: "IRL" },
  { name: "Kenya",                  iso3: "KEN" },
  { name: "Kuwait",                 iso3: "KWT" },
  { name: "Malaysia",               iso3: "MYS" },
  { name: "New Zealand",            iso3: "NZL" },
  { name: "Nigeria",                iso3: "NGA" },
  { name: "Oman",                   iso3: "OMN" },
  { name: "Pakistan",               iso3: "PAK" },
  { name: "Philippines",            iso3: "PHL" },
  { name: "Qatar",                  iso3: "QAT" },
  { name: "Saudi Arabia",           iso3: "SAU" },
  { name: "Singapore",              iso3: "SGP" },
  { name: "South Africa",           iso3: "ZAF" },
  { name: "Sri Lanka",              iso3: "LKA" },
  { name: "United Arab Emirates",   iso3: "ARE" },
  { name: "United Kingdom",         iso3: "GBR" },
  { name: "United States",          iso3: "USA" },
];

export const COUNTRY_ISO3_MAP: Record<string, string> = Object.fromEntries(
  COUNTRIES.map((c) => [c.name, c.iso3])
);
