"use client";

import { useState, useEffect } from "react";
import {
  TrendingUp,
  BarChart3,
  MapPin,
  AlertCircle,
  CheckCircle,
  ChevronRight,
  ChevronDown,
  Zap,
  Activity,
  Shield,
  Wind,
  Navigation,
  Train,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
export interface CandidateNeighborhood {
  slug: string;
  region_id: number;
  distance_km: number;
  name: string;
}

export interface MarketPulse {
  usd_toman: number;
  region_avg_price_sqm: number;
  inflation_yoy: number;
  gpr_index: number;
  gpr_ma3: number;
  month_jalali: number;
  year_jalali: number;
}

export interface SpatialFeatures {
  dist_to_metro_m: number;
  dist_to_cbd_m: number;
  dist_to_highway_m: number;
  commercial_density: number;
  seismic_risk_level: number;
  air_quality_aqi: number;
  traffic_zone_status: number;
  urban_decay_class: number;
}

export interface PredictionResult {
  base_price_per_sqm: number;
  base_price_low: number;
  base_price_high: number;
  micro_ratio: number;
  final_price_per_sqm: number;
  final_total_price: number;
  final_total_low: number;
  final_total_high: number;
  usd_rate: number;
  neighborhood: string;
  neighborhood_name: string;
  region_id: number;
  year_jalali: number;
  month_jalali: number;
  macro_diff: number;
  macro_diff_q05: number;
  macro_diff_q95: number;
  housing_to_usd_lag1: number;
  spatial: SpatialFeatures;
  candidate_neighborhoods: CandidateNeighborhood[];
  market_pulse: MarketPulse;
  area: number;
  error?: string;
}

interface ResultCardProps {
  result: PredictionResult | null;
  error: string | null;
  isLoading: boolean;
  onNeighborhoodChange?: (slug: string) => void;
  debugMode?: boolean;
}

// ─── Formatters ───────────────────────────────────────────────────────────────
function fmt(n: number, decimals = 2): string {
  if (!n || isNaN(n)) return "0";
  return n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtM(n: number): string {
  return fmt(n, n >= 100 ? 0 : n >= 10 ? 1 : 2);
}

function fmtToman(millionTomans: number): string {
  const t = Math.round(millionTomans * 1_000_000);
  return t.toLocaleString("fa-IR");
}

// ─── Tooltip ──────────────────────────────────────────────────────────────────
function Tooltip({ text }: { text: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="tooltip-wrapper" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      <span className="tooltip-icon">ⓘ</span>
      {show && <div className="tooltip-content">{text}</div>}
    </div>
  );
}

// ─── AQI Grade Badge ──────────────────────────────────────────────────────────
function AQIBadge({ aqi }: { aqi: number }) {
  const grade =
    aqi <= 50  ? { label: "پاک", color: "#22c55e", bg: "rgba(34,197,94,0.1)",   border: "rgba(34,197,94,0.3)" } :
    aqi <= 100 ? { label: "قابل قبول", color: "#f59e0b", bg: "rgba(245,158,11,0.1)", border: "rgba(245,158,11,0.3)" } :
    aqi <= 150 ? { label: "ناسالم برای حساس‌ها", color: "#f97316", bg: "rgba(249,115,22,0.1)", border: "rgba(249,115,22,0.3)" } :
                 { label: "ناسالم", color: "#f43f5e", bg: "rgba(244,63,94,0.1)", border: "rgba(244,63,94,0.3)" };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
      <span style={{ fontSize: "0.85rem", fontWeight: 800, color: "#edf2f7", direction: "ltr" }}>
        {Math.round(aqi)}
      </span>
      <span
        className="aqi-grade"
        style={{
          background: grade.bg,
          border: `1px solid ${grade.border}`,
          color: grade.color,
        }}
      >
        {grade.label}
      </span>
    </div>
  );
}

// ─── Seismic Scale ────────────────────────────────────────────────────────────
function SeismicScale({ level }: { level: number }) {
  const clampedLevel = Math.max(1, Math.min(4, Math.round(level)));
  const colors = ["#22c55e", "#f59e0b", "#f97316", "#f43f5e"];
  const labels = ["خیلی کم", "کم", "متوسط", "بالا"];

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
      <div style={{ display: "flex", gap: "4px" }}>
        {[1, 2, 3, 4].map((dot) => (
          <div
            key={dot}
            className="seismic-dot"
            style={{
              background: dot <= clampedLevel ? colors[clampedLevel - 1] : "rgba(255,255,255,0.08)",
              border: dot <= clampedLevel ? `1px solid ${colors[clampedLevel - 1]}66` : "1px solid rgba(255,255,255,0.06)",
            }}
          />
        ))}
      </div>
      <span style={{ fontSize: "0.72rem", fontWeight: 700, color: colors[clampedLevel - 1] }}>
        {labels[clampedLevel - 1]} ({clampedLevel}/۴)
      </span>
    </div>
  );
}

// ─── Distance Badge (with Sweet Spot) ────────────────────────────────────────
function DistanceBadge({
  meters, sweetSpotMin, sweetSpotMax, label,
}: {
  meters: number; sweetSpotMin: number; sweetSpotMax: number; label: string;
}) {
  const isSweetSpot = meters >= sweetSpotMin && meters <= sweetSpotMax;
  const distKm = meters >= 1000 ? `${(meters / 1000).toFixed(1)} کم‌تر از كيلومتر` : `${Math.round(meters)} متر`;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
      <span style={{ fontSize: "0.85rem", fontWeight: 800, color: "#edf2f7", direction: "ltr" }}>
        {meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`}
      </span>
      {isSweetSpot && (
        <span className="sweet-spot-badge">
          ✦ نقطه طلایی {label}
        </span>
      )}
    </div>
  );
}

// ─── GPR Sparkline ────────────────────────────────────────────────────────────
function GPRSparkline({ current, ma3 }: { current: number; ma3: number }) {
  // Approximate 3-month mini-sparkline: [ma3, lerp, current]
  const pts = [ma3, (ma3 + current) / 2, current];
  const minV = Math.min(...pts) * 0.98;
  const maxV = Math.max(...pts) * 1.02;
  const norm = (v: number) => ((v - minV) / (maxV - minV)) * 20;
  const d = `M 0,${20 - norm(pts[0])} L 12,${20 - norm(pts[1])} L 24,${20 - norm(pts[2])}`;
  const rising = current > ma3 + 2;
  const easing = current < ma3 - 2;
  const strokeColor = rising ? "#f43f5e" : easing ? "#22c55e" : "#f59e0b";

  return (
    <svg width="28" height="24" viewBox="0 0 24 24" fill="none" style={{ display: "inline-block", verticalAlign: "middle" }}>
      <path d={d} stroke={strokeColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="24" cy={20 - norm(pts[2])} r="2.5" fill={strokeColor} />
    </svg>
  );
}

// ─── GPR Risk Label ───────────────────────────────────────────────────────────
function GPRLabel({ gpr }: { gpr: number }) {
  const tier =
    gpr < 80   ? { label: "پایین",   color: "#22c55e", bg: "rgba(34,197,94,0.1)",   border: "rgba(34,197,94,0.25)" } :
    gpr < 120  ? { label: "متوسط",   color: "#f59e0b", bg: "rgba(245,158,11,0.1)",  border: "rgba(245,158,11,0.25)" } :
    gpr < 180  ? { label: "بالا",    color: "#f97316", bg: "rgba(249,115,22,0.1)",  border: "rgba(249,115,22,0.25)" } :
                 { label: "بحرانی",  color: "#f43f5e", bg: "rgba(244,63,94,0.1)",   border: "rgba(244,63,94,0.25)" };

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "2px 10px",
        borderRadius: "100px",
        fontSize: "0.65rem",
        fontWeight: 800,
        background: tier.bg,
        border: `1px solid ${tier.border}`,
        color: tier.color,
      }}
    >
      {tier.label}
    </span>
  );
}

// ─── Market Pulse Widget ──────────────────────────────────────────────────────
function MarketPulseWidget({ pulse }: { pulse: MarketPulse }) {
  const inflColor =
    pulse.inflation_yoy > 50 ? "#f43f5e" :
    pulse.inflation_yoy > 30 ? "#f97316" :
    pulse.inflation_yoy > 15 ? "#f59e0b" : "#22c55e";

  return (
    <div
      style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: "18px",
        padding: "18px 20px",
        animation: "fadeUp 0.5s cubic-bezier(0.4,0,0.2,1) 550ms both",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "16px" }}>
        <div className="live-dot" />
        <Activity size={13} color="#f59e0b" />
        <span style={{ fontSize: "0.65rem", fontWeight: 800, color: "#546e8a", letterSpacing: "0.08em", textTransform: "uppercase" }}>
          نبض بازار · {pulse.year_jalali}/{pulse.month_jalali}
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "14px" }}>
        {/* Region Avg */}
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <span style={{ fontSize: "0.58rem", color: "#546e8a", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              میانگین منطقه
            </span>
            <Tooltip text="قیمت میانگین هر متر مربع در منطقه انتخاب‌شده، محاسبه‌شده از نسبت مسکن به دلار لگ یک ماهه" />
          </div>
          <span style={{ fontSize: "1.05rem", fontWeight: 900, color: "#2dd4bf", direction: "ltr" }}>
            {fmtM(pulse.region_avg_price_sqm)}M
          </span>
          <span style={{ fontSize: "0.6rem", color: "#546e8a" }}>تومان/م²</span>
        </div>

        {/* Inflation */}
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <span style={{ fontSize: "0.58rem", color: "#546e8a", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              تورم مسکن
            </span>
            <Tooltip text="نرخ تورم سالانه شاخص عمومی قیمت‌ها، با تأخیر ۳ ماهه — هرچه بالاتر، فشار قیمتی بیشتر" />
          </div>
          <span style={{ fontSize: "1.05rem", fontWeight: 900, color: inflColor, direction: "ltr" }}>
            {pulse.inflation_yoy.toFixed(1)}٪
          </span>
          <span style={{ fontSize: "0.6rem", color: "#546e8a" }}>سالانه (با تأخیر)</span>
        </div>

        {/* GPR */}
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <span style={{ fontSize: "0.58rem", color: "#546e8a", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              ریسک ژئوپولیتیک
            </span>
            <Tooltip text="شاخص GPR ایران — مقادیر بالای ۱۲۰ یعنی تنش جدی؛ بالای ۱۸۰ یعنی بحران. این شاخص مستقیماً قیمت ملک را تحت تأثیر قرار می‌دهد." />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ fontSize: "1.05rem", fontWeight: 900, color: "#edf2f7", direction: "ltr" }}>
              {Math.round(pulse.gpr_index)}
            </span>
            <GPRSparkline current={pulse.gpr_index} ma3={pulse.gpr_ma3} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "2px" }}>
            <GPRLabel gpr={pulse.gpr_index} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Spatial Panel ────────────────────────────────────────────────────────────
function SpatialPanel({ spatial }: { spatial: SpatialFeatures }) {
  const metroSweet = spatial.dist_to_metro_m <= 500;
  const hwySweet = spatial.dist_to_highway_m >= 200 && spatial.dist_to_highway_m <= 900;

  const rows = [
    {
      icon: <Train size={14} />,
      label: "فاصله تا مترو",
      tooltip: "نزدیکی به مترو معمولاً ارزش ملک را تا ۱۵٪ افزایش می‌دهد. فاصله کمتر از ۵۰۰ متر 'نقطه طلایی' محسوب می‌شود.",
      value: <DistanceBadge meters={spatial.dist_to_metro_m} sweetSpotMin={0} sweetSpotMax={500} label="🚇" />,
    },
    {
      icon: <Navigation size={14} />,
      label: "فاصله تا بزرگراه",
      tooltip: "فاصله بین ۲۰۰ تا ۹۰۰ متر از بزرگراه بهترین حالت است؛ دسترسی خوب بدون آلودگی صوتی.",
      value: <DistanceBadge meters={spatial.dist_to_highway_m} sweetSpotMin={200} sweetSpotMax={900} label="🛣️" />,
    },
    {
      icon: <Wind size={14} />,
      label: "کیفیت هوا (AQI)",
      tooltip: "شاخص کیفیت هوا: ۰-۵۰ پاک، ۵۱-۱۰۰ قابل قبول، ۱۰۱-۱۵۰ ناسالم برای حساس‌ها، بالای ۱۵۰ ناسالم. هوای پاک ارزش ملک را بالا می‌برد.",
      value: <AQIBadge aqi={spatial.air_quality_aqi} />,
    },
    {
      icon: <Shield size={14} />,
      label: "ریسک زلزله",
      tooltip: "سطح خطر لرزه‌ای منطقه از ۱ (خیلی کم) تا ۴ (بالا). این فاکتور مستقیماً در مدل میکرو تأثیر دارد.",
      value: <SeismicScale level={spatial.seismic_risk_level} />,
    },
  ];

  return (
    <div
      style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: "18px",
        padding: "18px 20px",
        animation: "fadeUp 0.5s cubic-bezier(0.4,0,0.2,1) 650ms both",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "14px" }}>
        <MapPin size={13} color="#2dd4bf" />
        <span style={{ fontSize: "0.65rem", fontWeight: 800, color: "#546e8a", textTransform: "uppercase", letterSpacing: "0.08em" }}>
          ویژگی‌های مکانی
        </span>
        {(metroSweet || hwySweet) && (
          <span
            style={{
              marginRight: "auto",
              fontSize: "0.6rem",
              fontWeight: 800,
              color: "#2dd4bf",
              background: "rgba(45,212,191,0.1)",
              border: "1px solid rgba(45,212,191,0.25)",
              borderRadius: "100px",
              padding: "2px 10px",
            }}
          >
            نقطه طلایی موقعیت 🌟
          </span>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {rows.map((row) => (
          <div
            key={row.label}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "10px 12px",
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.05)",
              borderRadius: "12px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div
                style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "8px",
                  background: "rgba(45,212,191,0.08)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#2dd4bf",
                  flexShrink: 0,
                }}
              >
                {row.icon}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#9ab0c7" }}>
                  {row.label}
                </span>
                <Tooltip text={row.tooltip} />
              </div>
            </div>
            <div style={{ textAlign: "left" }}>{row.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Confidence Range Bar ─────────────────────────────────────────────────────
function ConfidenceBar({ low, mid, high }: { low: number; mid: number; high: number }) {
  if (!low || !high || low >= high) return null;
  const range = high - low;
  const midPct = ((mid - low) / range) * 100;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "5px", marginTop: "10px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: "0.6rem", color: "#546e8a" }}>
          Q5: {fmtM(low)}M تومان
        </span>
        <span style={{ fontSize: "0.58rem", color: "#546e8a" }}>بازه اطمینان ۹۰٪</span>
        <span style={{ fontSize: "0.6rem", color: "#546e8a" }}>
          Q95: {fmtM(high)}M تومان
        </span>
      </div>
      <div
        style={{
          height: "7px",
          borderRadius: "100px",
          background: "rgba(255,255,255,0.06)",
          position: "relative",
          overflow: "visible",
        }}
      >
        <div
          style={{
            position: "absolute", left: 0, right: 0, top: 0, height: "100%",
            borderRadius: "100px",
            background: "linear-gradient(90deg, rgba(249,115,22,0.12), rgba(249,115,22,0.42), rgba(249,115,22,0.12))",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: `${midPct}%`,
            top: "50%",
            transform: "translate(-50%, -50%)",
            width: "14px", height: "14px",
            borderRadius: "50%",
            background: "#f97316",
            border: "2.5px solid #fff",
            boxShadow: "0 0 10px rgba(249,115,22,0.65)",
            zIndex: 1,
          }}
        />
      </div>
    </div>
  );
}

// ─── Math Accordion ───────────────────────────────────────────────────────────
function MathAccordion({ result }: { result: PredictionResult }) {
  const [open, setOpen] = useState(false);

  const steps = [
    { label: "۱. نسبت مسکن به دلار (لگ یک ماهه)", detail: `housing_to_usd_lag1 = ${result.housing_to_usd_lag1.toFixed(6)}`, color: "#64748b" },
    { label: "۲. مدل ماکرو → لگ دیفرانسیل", detail: `Δ log(H/USD) = ${result.macro_diff.toFixed(6)}  [Q5: ${result.macro_diff_q05.toFixed(4)}, Q95: ${result.macro_diff_q95.toFixed(4)}]`, color: "#9ab0c7" },
    { label: "۳. قیمت پایه ماکرو / م²", detail: `exp(log(${result.housing_to_usd_lag1.toFixed(4)}) + ${result.macro_diff.toFixed(4)}) × ${result.usd_rate.toFixed(0)} = ${fmtM(result.base_price_per_sqm)}M تومان`, color: "#64748b" },
    { label: "۴. ضریب کیفی میکرو", detail: `Ratio = ${result.micro_ratio.toFixed(6)} → ${((result.micro_ratio - 1) * 100).toFixed(1)}% ${result.micro_ratio >= 1 ? "پریمیوم" : "تخفیف"}`, color: result.micro_ratio >= 1 ? "#22c55e" : "#f43f5e" },
    { label: "۵. قیمت نهایی / م²", detail: `${fmtM(result.base_price_per_sqm)}M × ${result.micro_ratio.toFixed(4)} = ${fmtM(result.final_price_per_sqm)}M تومان`, color: "#f97316" },
    { label: "۶. ارزش کل ملک", detail: `${fmtM(result.final_price_per_sqm)}M × ${result.area}m² = ${fmtM(result.final_total_price)}M تومان`, color: "#f59e0b" },
  ];

  return (
    <div
      style={{
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: "14px",
        overflow: "hidden",
        animation: "fadeUp 0.5s cubic-bezier(0.4,0,0.2,1) 700ms both",
      }}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%",
          padding: "12px 18px",
          background: "rgba(255,255,255,0.02)",
          border: "none",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          color: "#9ab0c7",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <Zap size={12} color="#f59e0b" />
          <span style={{ fontSize: "0.75rem", fontWeight: 700 }}>چگونه محاسبه شد؟</span>
        </div>
        <ChevronDown
          size={14}
          color="#546e8a"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.25s ease" }}
        />
      </button>

      {open && (
        <div style={{ background: "rgba(0,0,0,0.18)", padding: "12px 18px", display: "flex", flexDirection: "column", gap: "10px" }}>
          {steps.map((s, i) => (
            <div key={i} style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
              <div style={{ width: "4px", height: "4px", borderRadius: "50%", background: s.color, marginTop: "6px", flexShrink: 0 }} />
              <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "#64748b" }}>{s.label}</span>
                <code style={{ fontSize: "0.65rem", color: s.color, fontFamily: "monospace", background: "rgba(255,255,255,0.03)", borderRadius: "4px", padding: "2px 6px", direction: "ltr", display: "inline-block" }}>
                  {s.detail}
                </code>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Debug Panel ──────────────────────────────────────────────────────────────
function DebugPanel({ result }: { result: PredictionResult }) {
  const lines = [
    `> MACRO V2 LOG-DIFFERENTIAL`,
    `  housing_to_usd_lag1 = ${result.housing_to_usd_lag1.toFixed(6)}`,
    `  macro_diff (median) = ${result.macro_diff.toFixed(6)}`,
    `  macro_diff_q05      = ${result.macro_diff_q05.toFixed(6)}`,
    `  macro_diff_q95      = ${result.macro_diff_q95.toFixed(6)}`,
    ``,
    `> PRICES [M Tomans/m²]`,
    `  base (median) = ${fmtM(result.base_price_per_sqm)}`,
    `  base (q05)    = ${fmtM(result.base_price_low)}`,
    `  base (q95)    = ${fmtM(result.base_price_high)}`,
    ``,
    `> MICRO MODEL`,
    `  micro_ratio   = ${result.micro_ratio.toFixed(6)}`,
    `  final/m²      = ${fmtM(result.final_price_per_sqm)}`,
    ``,
    `> TOTAL [M Tomans]`,
    `  final         = ${fmtM(result.final_total_price)}`,
    `  low  (q05)    = ${fmtM(result.final_total_low)}`,
    `  high (q95)    = ${fmtM(result.final_total_high)}`,
    ``,
    `> SPATIAL`,
    `  metro = ${result.spatial.dist_to_metro_m.toFixed(0)}m`,
    `  CBD   = ${result.spatial.dist_to_cbd_m.toFixed(0)}m`,
    `  hwy   = ${result.spatial.dist_to_highway_m.toFixed(0)}m`,
    `  AQI   = ${result.spatial.air_quality_aqi.toFixed(0)}`,
    `  seismic = ${result.spatial.seismic_risk_level}`,
    ``,
    `> REGION ${result.region_id} · ${result.neighborhood}`,
    `  USD = ${result.usd_rate.toLocaleString()} Tomans`,
    `  GPR = ${result.market_pulse?.gpr_index?.toFixed(1)}`,
  ];

  return (
    <div style={{ background: "#060c10", border: "1px solid rgba(34,197,94,0.2)", borderRadius: "12px", padding: "14px", fontFamily: "monospace", fontSize: "0.7rem", color: "#22c55e", maxHeight: "240px", overflowY: "auto", lineHeight: "1.6" }}>
      <div style={{ color: "#4ade80", fontWeight: 700, marginBottom: "8px" }}>⚡ DEBUG · Tehran Predictor V2</div>
      {lines.map((l, i) => (
        <div key={i} style={{ color: l.startsWith(">") ? "#86efac" : l === "" ? "transparent" : "#22c55e", fontWeight: l.startsWith(">") ? 700 : 400 }}>
          {l || "\u00a0"}
        </div>
      ))}
    </div>
  );
}

// ─── Metric Card ─────────────────────────────────────────────────────────────
function MetricCard({ label, value, sub, color, bg, icon, delay = 0, tooltip }: {
  label: string; value: string; sub?: string; color: string; bg: string;
  icon: React.ReactNode; delay?: number; tooltip?: string;
}) {
  return (
    <div style={{ background: bg, border: `1px solid ${color}22`, borderRadius: "16px", padding: "16px", display: "flex", flexDirection: "column", gap: "6px", animation: `fadeUp 0.45s cubic-bezier(0.4,0,0.2,1) ${delay}ms both` }}>
      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
        <div style={{ width: "24px", height: "24px", borderRadius: "7px", background: `${color}18`, display: "flex", alignItems: "center", justifyContent: "center", color }}>
          {icon}
        </div>
        <span style={{ fontSize: "0.6rem", fontWeight: 700, color: "#546e8a", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          {label}
        </span>
        {tooltip && <Tooltip text={tooltip} />}
      </div>
      <div style={{ fontSize: "1.15rem", fontWeight: 900, color, lineHeight: 1 }} className="animate-countUp">
        {value}
      </div>
      {sub && <div style={{ fontSize: "0.66rem", color: "#546e8a", marginTop: "1px" }}>{sub}</div>}
    </div>
  );
}

// ─── Main ResultCard ──────────────────────────────────────────────────────────
export default function ResultCard({
  result,
  error,
  isLoading,
  onNeighborhoodChange,
  debugMode = false,
}: ResultCardProps) {
  const [loadingSteps, setLoadingSteps] = useState<string[]>([]);

  useEffect(() => {
    if (!isLoading) { setLoadingSteps([]); return; }
    const steps = [
      "راه‌اندازی pipeline استنتاج V2...",
      "دریافت نرخ لحظه‌ای دلار از BrsApi...",
      "کوئری BigQuery: macro_training_v2...",
      "محاسبه ویژگی‌های مکانی از GIS...",
      "اجرای مدل XGBoost ماکرو (۳ مدل)...",
      "اعمال ضریب کیفی میکرو...",
      "محاسبه بازه‌های اطمینان...",
    ];
    let i = 0;
    setLoadingSteps([steps[0]]);
    const iv = setInterval(() => {
      i++;
      if (i < steps.length) setLoadingSteps((p) => [...p, steps[i]]);
    }, 1100);
    return () => clearInterval(iv);
  }, [isLoading]);

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="glass-card" style={{ padding: "32px", minHeight: "320px", display: "flex", flexDirection: "column", justifyContent: "center", border: "1px solid rgba(249,115,22,0.2)" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: "20px" }}>
          <div style={{ width: "52px", height: "52px", border: "3px solid rgba(249,115,22,0.12)", borderTopColor: "#f97316", borderRadius: "50%" }} className="animate-spin-slow" />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "10px", marginBottom: "16px" }}>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="skeleton" style={{ height: "72px", borderRadius: "14px" }} />
          ))}
        </div>
        <div style={{ background: "rgba(5,10,14,0.85)", border: "1px solid rgba(34,197,94,0.1)", borderRadius: "10px", padding: "14px", fontFamily: "monospace", fontSize: "0.72rem", color: "#22c55e", minHeight: "130px", display: "flex", flexDirection: "column", gap: "6px" }}>
          {loadingSteps.map((step, idx) => (
            <div key={idx} className="animate-fadeUp" style={{ display: "flex", gap: "8px", direction: "rtl" }}>
              <span style={{ color: "#4ade80" }}>{">"}</span>
              {step}
            </div>
          ))}
          <div style={{ display: "flex", gap: "8px", opacity: 0.5 }}><span style={{ color: "#f97316" }}>_</span></div>
        </div>
      </div>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="glass-card" style={{ padding: "28px", border: "1px solid rgba(244,63,94,0.2)", background: "rgba(244,63,94,0.025)" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
          <div style={{ width: "42px", height: "42px", borderRadius: "12px", background: "rgba(244,63,94,0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <AlertCircle size={20} color="#f43f5e" />
          </div>
          <div>
            <div style={{ fontWeight: 800, color: "#f43f5e", marginBottom: "8px", fontSize: "0.95rem" }}>ارزیابی ناموفق</div>
            <div style={{ fontSize: "0.75rem", color: "#9ab0c7", background: "rgba(0,0,0,0.25)", borderRadius: "8px", padding: "10px 12px", fontFamily: "monospace", direction: "ltr" }}>
              {error}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Empty State ────────────────────────────────────────────────────────────
  if (!result) {
    return (
      <div className="glass-card" style={{ padding: "36px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "16px", minHeight: "180px", textAlign: "center" }}>
        <div style={{ width: "60px", height: "60px", borderRadius: "20px", background: "rgba(249,115,22,0.07)", border: "1px solid rgba(249,115,22,0.14)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <BarChart3 size={28} color="#ea580c" />
        </div>
        <div>
          <div style={{ fontWeight: 800, color: "#9ab0c7", fontSize: "1rem", marginBottom: "6px" }}>
            در انتظار ارزیابی
          </div>
          <div style={{ fontSize: "0.78rem", color: "#546e8a" }}>
            روی نقشه کلیک کنید · مشخصات را وارد کنید · ارزیابی هوشمند دریافت کنید
          </div>
        </div>
        <div style={{ display: "flex", gap: "20px", marginTop: "4px" }}>
          {["انتخاب موقعیت", "ورود اطلاعات", "دریافت ارزیابی"].map((s, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: "7px", opacity: 0.5 }}>
              <div style={{ width: "20px", height: "20px", borderRadius: "50%", background: "rgba(249,115,22,0.18)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.6rem", fontWeight: 900, color: "#f97316" }}>
                {i + 1}
              </div>
              <span style={{ fontSize: "0.7rem", color: "#64748b" }}>{s}</span>
              {i < 2 && <ChevronRight size={11} color="#334155" />}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Result ─────────────────────────────────────────────────────────────────
  const qualityPct = ((result.micro_ratio - 1) * 100).toFixed(1);
  const qualitySign = result.micro_ratio >= 1 ? "+" : "";
  const qualityColor = result.micro_ratio >= 1 ? "#22c55e" : "#f43f5e";
  const usdEquiv = (result.final_total_price * 1_000_000) / result.usd_rate;

  // Data range subtext
  const dataSubtext = `بر اساس داده‌های معاملات واقعی از ۱۴۰۰/۱ تا ${result.year_jalali}/${result.month_jalali}`;

  return (
    <div className="glass-card" style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: "18px" }}>

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div
            style={{ width: "40px", height: "40px", borderRadius: "12px", background: "linear-gradient(135deg, #f97316, #ea580c)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 16px rgba(249,115,22,0.42)" }}
            className="animate-pulse-ring"
          >
            <CheckCircle size={20} color="#fff" />
          </div>
          <div>
            <div style={{ fontWeight: 900, fontSize: "0.95rem", color: "#edf2f7" }}>نتیجه ارزیابی ملک</div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "4px" }}>
              <MapPin size={11} color="#2dd4bf" />
              {result.candidate_neighborhoods?.length > 0 ? (
                <select
                  value={result.neighborhood}
                  onChange={(e) => onNeighborhoodChange?.(e.target.value)}
                  style={{
                    background: "rgba(15,23,42,0.85)", border: "1px solid rgba(45,212,191,0.38)", borderRadius: "8px",
                    color: "#2dd4bf", fontSize: "0.73rem", fontWeight: 800, padding: "3px 10px", cursor: "pointer", outline: "none",
                    fontFamily: "Vazirmatn, sans-serif",
                  }}
                >
                  {result.candidate_neighborhoods.map((c) => (
                    <option key={c.slug} value={c.slug} style={{ background: "#161b27", color: "#f8fafc" }}>
                      {c.name} ({c.distance_km}km) · منطقه {c.region_id}
                    </option>
                  ))}
                </select>
              ) : (
                <span style={{ fontSize: "0.7rem", color: "#2dd4bf", fontWeight: 700 }}>
                  {result.neighborhood_name} · منطقه {result.region_id}
                </span>
              )}
            </div>
          </div>
        </div>
        <div style={{ background: "rgba(45,212,191,0.07)", border: "1px solid rgba(45,212,191,0.18)", borderRadius: "10px", padding: "7px 14px", textAlign: "right" }}>
          <div style={{ fontSize: "0.57rem", color: "#546e8a", marginBottom: "2px", fontWeight: 700 }}>متراژ</div>
          <div style={{ fontWeight: 900, color: "#2dd4bf", fontSize: "0.85rem", direction: "ltr" }}>
            {result.area.toLocaleString()} م²
          </div>
        </div>
      </div>

      {/* ── Hero Price Banner ── */}
      <div
        style={{
          background: "linear-gradient(135deg, rgba(249,115,22,0.1), rgba(22,27,39,0.6) 60%, rgba(245,158,11,0.06))",
          border: "1px solid rgba(249,115,22,0.22)",
          borderRadius: "20px",
          padding: "22px 26px",
          animation: "fadeUp 0.5s cubic-bezier(0.4,0,0.2,1) 100ms both",
        }}
      >
        <div style={{ fontSize: "0.62rem", color: "#546e8a", fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "8px" }}>
          ارزش تخمینی کل ملک
        </div>
        <div className="gradient-text" style={{ fontSize: "2.1rem", fontWeight: 900, lineHeight: 1 }}>
          {fmtM(result.final_total_price)} میلیون تومان
        </div>
        <div style={{ fontSize: "0.72rem", color: "#546e8a", marginTop: "7px", display: "flex", gap: "12px", flexWrap: "wrap" }}>
          <span>{fmtToman(result.final_total_price)} تومان</span>
          <span>·</span>
          <span style={{ direction: "ltr", display: "inline-block" }}>≈ ${usdEquiv.toLocaleString("en-US", { maximumFractionDigits: 0 })} USD</span>
        </div>
        <div style={{ fontSize: "0.62rem", color: "#546e8a", marginTop: "6px", fontStyle: "italic" }}>
          {dataSubtext}
        </div>

        <ConfidenceBar low={result.final_total_low} mid={result.final_total_price} high={result.final_total_high} />
      </div>

      {/* ── Metric Cards ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "10px" }}>
        <MetricCard
          label="قیمت پایه / م²"
          value={`${fmtM(result.base_price_per_sqm)}M`}
          sub="مدل ماکرو (میانه)"
          color="#9ab0c7"
          bg="rgba(154,176,199,0.04)"
          icon={<BarChart3 size={11} />}
          delay={0}
          tooltip="قیمت پایه محاسبه‌شده از نسبت مسکن به دلار و مدل ماکرو. این قیمت ویژگی‌های خاص ملک را لحاظ نمی‌کند."
        />
        <MetricCard
          label="ضریب کیفی ×"
          value={`×${result.micro_ratio.toFixed(3)}`}
          sub={`${qualitySign}${qualityPct}٪ ${result.micro_ratio >= 1 ? "پریمیوم" : "تخفیف"}`}
          color={qualityColor}
          bg={`${qualityColor}08`}
          icon={<TrendingUp size={11} />}
          delay={80}
          tooltip="خروجی مدل میکرو که تأثیر ویژگی‌های خاص ملک (متراژ، طبقه، امکانات، موقعیت) را به‌صورت ضریب نشان می‌دهد."
        />
        <MetricCard
          label="قیمت نهایی / م²"
          value={`${fmtM(result.final_price_per_sqm)}M`}
          sub={`تومان — ≈ $${((result.final_price_per_sqm * 1_000_000) / result.usd_rate).toFixed(0)}/م²`}
          color="#f97316"
          bg="rgba(249,115,22,0.06)"
          icon={<Activity size={11} />}
          delay={160}
          tooltip="قیمت هر متر مربع پس از اعمال ضریب کیفی میکرو روی قیمت پایه ماکرو."
        />
      </div>

      {/* ── Market Pulse ── */}
      {result.market_pulse && <MarketPulseWidget pulse={result.market_pulse} />}

      {/* ── Spatial Features Panel ── */}
      {result.spatial && <SpatialPanel spatial={result.spatial} />}

      {/* ── Math Accordion ── */}
      <MathAccordion result={result} />

      {/* ── Debug Panel ── */}
      {debugMode && <DebugPanel result={result} />}

      {/* ── Disclaimer ── */}
      <div style={{ fontSize: "0.6rem", color: "#334155", textAlign: "center", borderTop: "1px solid rgba(255,255,255,0.04)", paddingTop: "10px", lineHeight: 1.7 }}>
        ارزیابی هوشمند بر اساس مدل XGBoost V2 و داده‌های مکانی BigQuery — مشاوره مالی نیست.
        داده‌ها: {result.year_jalali}/{result.month_jalali}
      </div>
    </div>
  );
}
