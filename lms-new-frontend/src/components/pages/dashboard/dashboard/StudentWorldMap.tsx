"use client";

import { ComposableMap, Geographies, Geography, ZoomableGroup, Marker } from "react-simple-maps";
import { Tooltip } from "react-tooltip";
import { useState, useEffect, useRef, useCallback } from "react";
import { COUNTRY_ISO3_MAP, COUNTRIES } from "@/lib/countries";

const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

const NUMERIC_TO_ISO3: Record<string, string> = {
  "36":  "AUS", "48":  "BHR", "50":  "BGD", "124": "CAN",
  "818": "EGY", "250": "FRA", "276": "DEU", "356": "IND",
  "360": "IDN", "372": "IRL", "404": "KEN", "414": "KWT",
  "458": "MYS", "554": "NZL", "566": "NGA", "512": "OMN",
  "586": "PAK", "608": "PHL", "634": "QAT", "682": "SAU",
  "702": "SGP", "710": "ZAF", "144": "LKA", "784": "ARE",
  "826": "GBR", "840": "USA",
};

const COUNTRY_FOCUS: Record<string, { center: [number, number]; zoom: number }> = {
  AUS: { center: [134, -27],    zoom: 3 },
  BHR: { center: [50.5,  26.2], zoom: 18 },
  BGD: { center: [90.4,  23.7], zoom: 10 },
  CAN: { center: [-96,   60],   zoom: 2 },
  EGY: { center: [29,    26.5], zoom: 4 },
  FRA: { center: [2.5,   46.5], zoom: 6 },
  DEU: { center: [10.5,  51.2], zoom: 6 },
  IND: { center: [79,    22],   zoom: 4 },
  IDN: { center: [118,   -2],   zoom: 3 },
  IRL: { center: [-8,    53.2], zoom: 8 },
  KEN: { center: [38,    0.5],  zoom: 5 },
  KWT: { center: [47.5,  29.4], zoom: 14 },
  MYS: { center: [110,   4],    zoom: 5 },
  NZL: { center: [172,  -42],   zoom: 4 },
  NGA: { center: [8.5,    9],   zoom: 5 },
  OMN: { center: [57.5,  22],   zoom: 5 },
  PAK: { center: [69,    30.5], zoom: 4 },
  PHL: { center: [122,   12],   zoom: 5 },
  QAT: { center: [51.2,  25.3], zoom: 16 },
  SAU: { center: [45,    24],   zoom: 4 },
  SGP: { center: [103.8,  1.4], zoom: 20 },
  ZAF: { center: [25,   -29],   zoom: 4 },
  LKA: { center: [80.7,   7.9], zoom: 10 },
  ARE: { center: [54,    24],   zoom: 10 },
  GBR: { center: [-2,    54],   zoom: 6 },
  USA: { center: [-98,   38],   zoom: 3 },
};

const COUNTRY_LABELS: { iso3: string; coords: [number, number]; label: string }[] = [
  { iso3: "AUS", coords: [134,  -27],   label: "Australia" },
  { iso3: "BHR", coords: [50.5,  26.2], label: "Bahrain" },
  { iso3: "BGD", coords: [90.4,  23.7], label: "Bangladesh" },
  { iso3: "CAN", coords: [-96,   60],   label: "Canada" },
  { iso3: "EGY", coords: [29,    26.5], label: "Egypt" },
  { iso3: "FRA", coords: [2.5,   46.5], label: "France" },
  { iso3: "DEU", coords: [10.5,  51.2], label: "Germany" },
  { iso3: "IND", coords: [79,    22],   label: "India" },
  { iso3: "IDN", coords: [118,   -2],   label: "Indonesia" },
  { iso3: "IRL", coords: [-8,    53.2], label: "Ireland" },
  { iso3: "KEN", coords: [38,    0.5],  label: "Kenya" },
  { iso3: "KWT", coords: [47.5,  29.4], label: "Kuwait" },
  { iso3: "MYS", coords: [110,   4],    label: "Malaysia" },
  { iso3: "NZL", coords: [172,  -42],   label: "N.Zealand" },
  { iso3: "NGA", coords: [8.5,   9],    label: "Nigeria" },
  { iso3: "OMN", coords: [57.5,  22],   label: "Oman" },
  { iso3: "PAK", coords: [69,    30.5], label: "Pakistan" },
  { iso3: "PHL", coords: [122,   12],   label: "Philippines" },
  { iso3: "QAT", coords: [51.2,  25.3], label: "Qatar" },
  { iso3: "SAU", coords: [45,    24],   label: "Saudi Arabia" },
  { iso3: "SGP", coords: [103.8,  1.4], label: "Singapore" },
  { iso3: "ZAF", coords: [25,   -29],   label: "S.Africa" },
  { iso3: "LKA", coords: [80.7,   7.9], label: "Sri Lanka" },
  { iso3: "ARE", coords: [54,    24],   label: "UAE" },
  { iso3: "GBR", coords: [-2,    54],   label: "UK" },
  { iso3: "USA", coords: [-98,   38],   label: "USA" },
];

const RANK_COLORS = ["#16a34a", "#2563eb", "#f59e0b", "#dc2626", "#9333ea"] as const;
const RANK_HOVER  = ["#15803d", "#1d4ed8", "#d97706", "#b91c1c", "#7e22ce"] as const;
const COLOR_OTHERS = "#86efac";
const COLOR_OTHERS_HOVER = "#4ade80";

const ACTIVE_ISO3 = new Set(COUNTRIES.map((c) => c.iso3));

const ISO3_TO_ISO2: Record<string, string> = {
  AUS: "AU", BHR: "BH", BGD: "BD", CAN: "CA", EGY: "EG",
  FRA: "FR", DEU: "DE", IND: "IN", IDN: "ID", IRL: "IE",
  KEN: "KE", KWT: "KW", MYS: "MY", NZL: "NZ", NGA: "NG",
  OMN: "OM", PAK: "PK", PHL: "PH", QAT: "QA", SAU: "SA",
  SGP: "SG", ZAF: "ZA", LKA: "LK", ARE: "AE", GBR: "GB",
  USA: "US",
};

function FlagImage({ iso2 }: { iso2: string }) {
  return (
    <img
      src={`https://flagcdn.com/16x12/${iso2.toLowerCase()}.png`}
      srcSet={`https://flagcdn.com/32x24/${iso2.toLowerCase()}.png 2x`}
      width={16}
      height={12}
      alt={iso2}
      style={{ borderRadius: 2, objectFit: "cover", flexShrink: 0 }}
      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
    />
  );
}

interface Props {
  data: { country: string; count: number }[];
}

const DEFAULT_CENTER: [number, number] = [10, 15];
const DEFAULT_ZOOM = 3;
const MIN_ZOOM = 1;
const MAX_ZOOM = 20;
const ZOOM_STEP = 0.5;
const ANIM_DURATION = 900; // ms

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// Shortest-path longitude difference (avoids animating 340° the wrong way)
function shortLon(from: number, to: number): number {
  let diff = to - from;
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;
  return diff;
}

const StudentWorldMap = ({ data }: Props) => {
  const [tooltipContent, setTooltipContent] = useState("");
  const [selectedIso, setSelectedIso] = useState<string | null>(null);

  // Displayed position (drives ZoomableGroup on every RAF tick)
  const [displayCenter, setDisplayCenter] = useState<[number, number]>(DEFAULT_CENTER);
  const [displayZoom, setDisplayZoom] = useState(DEFAULT_ZOOM);

  // Refs tracking the *current* rendered position for use as animation start
  const curCenterRef = useRef<[number, number]>(DEFAULT_CENTER);
  const curZoomRef = useRef(DEFAULT_ZOOM);
  const rafRef = useRef<number | null>(null);

  // Animate from wherever we are now to (toCenter, toZoom)
  const animateTo = useCallback((toCenter: [number, number], toZoom: number) => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);

    const fromCenter: [number, number] = [...curCenterRef.current];
    const fromZoom = curZoomRef.current;
    const lonDiff = shortLon(fromCenter[0], toCenter[0]);
    const latDiff = toCenter[1] - fromCenter[1];
    const zoomDiff = toZoom - fromZoom;
    const startTime = performance.now();

    const tick = (now: number) => {
      const raw = (now - startTime) / ANIM_DURATION;
      const t = Math.min(raw, 1);
      const ease = easeInOutCubic(t);

      const center: [number, number] = [
        fromCenter[0] + lonDiff * ease,
        fromCenter[1] + latDiff * ease,
      ];
      const zoom = fromZoom + zoomDiff * ease;

      curCenterRef.current = center;
      curZoomRef.current = zoom;
      setDisplayCenter([...center]);
      setDisplayZoom(zoom);

      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        rafRef.current = null;
      }
    };

    rafRef.current = requestAnimationFrame(tick);
  }, []);

  // Cleanup on unmount
  useEffect(() => () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current); }, []);

  // Build alpha-3 → student count map
  const isoMap: Record<string, number> = {};
  data.forEach(({ country, count }) => {
    const iso = COUNTRY_ISO3_MAP[country] ?? COUNTRY_ISO3_MAP[country?.trim()];
    if (iso) isoMap[iso] = (isoMap[iso] ?? 0) + count;
  });

  // Rank map: iso3 → 0-based rank. Only top 5 ranked.
  const rankMap: Record<string, number> = {};
  Object.entries(isoMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .forEach(([iso], idx) => { rankMap[iso] = idx; });

  // Auto-navigate to top country on first data load
  const hasAutoZoomed = useRef(false);
  useEffect(() => {
    if (hasAutoZoomed.current || data.length === 0) return;
    const top = [...data].sort((a, b) => b.count - a.count)[0];
    if (!top) return;
    const iso = COUNTRY_ISO3_MAP[top.country] ?? COUNTRY_ISO3_MAP[top.country?.trim()];
    if (!iso) return;
    const focus = COUNTRY_FOCUS[iso];
    if (!focus) return;
    setSelectedIso(iso);
    animateTo(focus.center, focus.zoom);
    hasAutoZoomed.current = true;
  }, [data, animateTo]);

  const totalStudents = data.reduce((s, d) => s + d.count, 0);
  const topCountries = [...data].sort((a, b) => b.count - a.count).slice(0, 10);
  const topMax = topCountries[0]?.count ?? 1;

  const getMapColor = (iso3: string | undefined, isActive: boolean, isSelected: boolean): string => {
    if (isSelected) return "#0ea5e9";
    if (!isActive || !iso3) return "#f1f5f9";
    const count = isoMap[iso3] ?? 0;
    if (count === 0) return "#e2e8f0";
    const rank = rankMap[iso3];
    return rank !== undefined ? RANK_COLORS[rank] : COLOR_OTHERS;
  };

  const getHoverColor = (iso3: string | undefined, isActive: boolean, isSelected: boolean): string => {
    if (isSelected) return "#38bdf8";
    if (!isActive || !iso3) return "#e2e8f0";
    const count = isoMap[iso3] ?? 0;
    if (count === 0) return "#cbd5e1";
    const rank = rankMap[iso3];
    return rank !== undefined ? RANK_HOVER[rank] : COLOR_OTHERS_HOVER;
  };

  const handleCountryClick = (iso: string | null) => {
    if (!iso || iso === selectedIso) {
      setSelectedIso(null);
      animateTo(DEFAULT_CENTER, DEFAULT_ZOOM);
    } else {
      setSelectedIso(iso);
      const focus = COUNTRY_FOCUS[iso];
      if (focus) animateTo(focus.center, focus.zoom);
    }
  };

  const zoomIn  = () => animateTo(curCenterRef.current, Math.min(curZoomRef.current + ZOOM_STEP, MAX_ZOOM));
  const zoomOut = () => animateTo(curCenterRef.current, Math.max(curZoomRef.current - ZOOM_STEP, MIN_ZOOM));

  const getRowColor = (iso: string | undefined, i: number, isSelected: boolean): string => {
    if (isSelected) return "#0ea5e9";
    if (iso && rankMap[iso] !== undefined) return RANK_COLORS[rankMap[iso]];
    return i < 5 ? COLOR_OTHERS : "#94a3b8";
  };

  return (
    <div style={{ display: "flex", gap: 16, minHeight: 260 }}>

      {/* ── Left: Map ── */}
      <div style={{ flex: "1 1 0", minWidth: 0 }}>
        <div style={{ position: "relative" }}>
          {/* +/− zoom controls */}
          <div style={{ position: "absolute", top: 8, right: 8, zIndex: 10, display: "flex", flexDirection: "column", gap: 2 }}>
            {([
              { label: "+", action: zoomIn,  disabled: displayZoom >= MAX_ZOOM },
              { label: "−", action: zoomOut, disabled: displayZoom <= MIN_ZOOM },
            ] as const).map(({ label, action, disabled }) => (
              <button
                key={label}
                onClick={action}
                disabled={disabled}
                style={{
                  width: 24, height: 24,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: "#fff", border: "1px solid #cbd5e1", borderRadius: 5,
                  fontSize: 16, lineHeight: 1,
                  cursor: disabled ? "not-allowed" : "pointer",
                  color: disabled ? "#cbd5e1" : "#374151",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.08)", padding: 0,
                }}
              >
                {label}
              </button>
            ))}
          </div>

          <div data-tooltip-id="world-map-tip" style={{ background: "#f8fafc", borderRadius: 10, overflow: "hidden" }}>
            <ComposableMap
              projection="geoMercator"
              projectionConfig={{ scale: 95, center: [10, 15] }}
              style={{ width: "100%", height: "270px" }}
            >
              <ZoomableGroup center={displayCenter} zoom={displayZoom}>
                <Geographies geography={GEO_URL}>
                  {({ geographies }: { geographies: any[] }) =>
                    geographies.map((geo: any) => {
                      const numericId = String(geo.id);
                      const iso3 = NUMERIC_TO_ISO3[numericId];
                      const isActive = iso3 ? ACTIVE_ISO3.has(iso3) : false;
                      const isSelected = !!iso3 && selectedIso === iso3;
                      const count = iso3 ? (isoMap[iso3] ?? 0) : 0;
                      return (
                        <Geography
                          key={geo.rsmKey}
                          geography={geo}
                          fill={getMapColor(iso3, isActive, isSelected)}
                          stroke={isSelected ? "#0369a1" : "#fff"}
                          strokeWidth={isSelected ? 1 : 0.4}
                          onMouseEnter={() => {
                            if (!isActive) return;
                            const name = geo.properties.name;
                            const rank = iso3 ? rankMap[iso3] : undefined;
                            const rankLabel = rank !== undefined ? ` · #${rank + 1} overall` : "";
                            setTooltipContent(
                              count > 0
                                ? `${name}: ${count} student${count !== 1 ? "s" : ""}${rankLabel}`
                                : `${name}: no students yet`
                            );
                          }}
                          onMouseLeave={() => setTooltipContent("")}
                          style={{
                            default: { outline: "none" },
                            hover: {
                              fill: getHoverColor(iso3, isActive, isSelected),
                              outline: "none",
                              cursor: isActive ? "pointer" : "default",
                            },
                            pressed: { outline: "none" },
                          }}
                        />
                      );
                    })
                  }
                </Geographies>
                {COUNTRY_LABELS.map(({ iso3, coords, label }) => {
                  const isSelected = selectedIso === iso3;
                  const hasStudents = (isoMap[iso3] ?? 0) > 0;
                  const rank = rankMap[iso3];
                  return (
                    <Marker key={iso3} coordinates={coords}>
                      <text
                        textAnchor="middle"
                        style={{
                          fontSize: 5, fontFamily: "inherit",
                          fontWeight: isSelected || hasStudents ? 700 : 500,
                          fill: isSelected ? "#0369a1" : rank !== undefined ? "#fff" : hasStudents ? "#14532d" : "#64748b",
                          pointerEvents: "none", userSelect: "none",
                        }}
                      >
                        {label}
                      </text>
                    </Marker>
                  );
                })}
              </ZoomableGroup>
            </ComposableMap>
          </div>
        </div>

        {/* Legend strip */}
        <div className="d-flex align-items-center gap-2 mt-1 flex-wrap">
          {RANK_COLORS.map((color, i) => (
            <div key={i} className="d-flex align-items-center gap-1">
              <span style={{ width: 10, height: 10, borderRadius: 3, background: color, display: "inline-block", flexShrink: 0 }} />
              <span className="fs-11 text-muted">#{i + 1}</span>
            </div>
          ))}
          <div className="d-flex align-items-center gap-1">
            <span style={{ width: 10, height: 10, borderRadius: 3, background: COLOR_OTHERS, display: "inline-block", flexShrink: 0 }} />
            <span className="fs-11 text-muted">Other</span>
          </div>
          <div className="d-flex align-items-center gap-1">
            <span style={{ width: 10, height: 10, borderRadius: 3, background: "#e2e8f0", display: "inline-block", flexShrink: 0 }} />
            <span className="fs-11 text-muted">None</span>
          </div>
          {selectedIso && (
            <button
              className="btn btn-sm btn-outline-secondary px-2 py-0 fs-11 ms-auto"
              onClick={() => { setSelectedIso(null); animateTo(DEFAULT_CENTER, DEFAULT_ZOOM); }}
            >
              ← Reset view
            </button>
          )}
        </div>

        <Tooltip id="world-map-tip" content={tooltipContent} />
      </div>

      {/* ── Right: Top Countries ── */}
      <div style={{ width: 200, flexShrink: 0, borderLeft: "1px solid #e8ecf4", paddingLeft: 16, display: "flex", flexDirection: "column" }}>
        <div className="d-flex align-items-center justify-content-between mb-2">
          <span className="fs-12 fw-semibold text-dark">Top Countries</span>
          <span className="fs-11 text-muted">{totalStudents} total</span>
        </div>
        <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", scrollbarWidth: "thin" }}>
          {topCountries.map(({ country, count }, i) => {
            const iso = COUNTRY_ISO3_MAP[country];
            const isSelected = !!iso && selectedIso === iso;
            const barPct = Math.round((count / topMax) * 100);
            const rowColor = getRowColor(iso, i, isSelected);
            return (
              <div
                key={country}
                className="mb-2 rounded-2 px-1"
                style={{
                  cursor: "pointer",
                  background: isSelected ? "#e0f2fe" : "transparent",
                  border: isSelected ? "1px solid #7dd3fc" : "1px solid transparent",
                  transition: "background 0.15s",
                }}
                onClick={() => handleCountryClick(iso ?? null)}
              >
                <div className="d-flex align-items-center justify-content-between mb-1 pt-1">
                  <div className="d-flex align-items-center gap-1" style={{ minWidth: 0 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: rowColor, flexShrink: 0, display: "inline-block" }} />
                    <span className="fs-11 fw-semibold" style={{ width: 14, flexShrink: 0, color: isSelected ? "#0369a1" : "#94a3b8" }}>
                      {i + 1}
                    </span>
                    {iso && ISO3_TO_ISO2[iso] && (
                      <FlagImage iso2={ISO3_TO_ISO2[iso]} />
                    )}
                    <span className="fs-12 fw-medium text-truncate" style={{ color: isSelected ? "#0369a1" : "#1e293b", maxWidth: 90 }} title={country}>
                      {country}
                    </span>
                  </div>
                  <span className="fs-11 fw-bold ms-1 pb-1" style={{ color: rowColor, flexShrink: 0 }}>{count}</span>
                </div>
                <div style={{ height: 4, background: "#e2e8f0", borderRadius: 99, overflow: "hidden", marginBottom: 4 }}>
                  <div style={{ width: `${barPct}%`, height: "100%", background: rowColor, borderRadius: 99, transition: "width 0.4s ease, background 0.15s" }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
};

export default StudentWorldMap;
