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
  Building,
  Info,
  Download,
} from "lucide-react";

// ─── Utility: Persian Digits & Currency Formatters ────────────────────────────
export function toPersianDigits(n: number | string): string {
  if (n === null || n === undefined) return "";
  const persianDigits = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
  return String(n).replace(/\d/g, (d) => persianDigits[parseInt(d, 10)]);
}

export function formatPersianCurrency(millionTomans: number): string {
  if (!millionTomans || isNaN(millionTomans)) return "۰ تومان";
  if (millionTomans >= 1000) {
    const billion = (millionTomans / 1000).toFixed(2);
    return `${toPersianDigits(billion)} میلیارد تومان`;
  }
  const formatted = (millionTomans >= 10 ? millionTomans.toFixed(1) : millionTomans.toFixed(2));
  return `${toPersianDigits(formatted)} میلیون تومان`;
}

export function formatTomanFull(millionTomans: number): string {
  const tomans = Math.round(millionTomans * 1_000_000);
  return toPersianDigits(tomans.toLocaleString("fa-IR")) + " تومان";
}

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
  neighborhood_avg_price_sqm: number;
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
  nearest_metro_station?: string;
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
  neighborhood_avg_price?: number;
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

import { PERSIAN_NEIGHBORHOODS } from "../utils/neighborhoods";

// ─── Clean Overlay Tooltip (No Circle, No Border) ────────────────────────────
function Tooltip({ text }: { text: string }) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ position: "relative", display: "inline-flex", alignItems: "center" }} onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      <Info
        size={13}
        style={{
          color: show ? "#f59e0b" : "#64748b",
          cursor: "pointer",
          marginRight: "4px",
          transition: "color 0.2s ease",
          flexShrink: 0,
        }}
      />
      {show && (
        <div
          style={{
            position: "absolute",
            bottom: "calc(100% + 8px)",
            right: 0,
            background: "#161b27",
            border: "1px solid rgba(245, 158, 11, 0.35)",
            borderRadius: "12px",
            padding: "10px 14px",
            fontSize: "0.72rem",
            color: "#edf2f7",
            lineHeight: "1.6",
            width: "230px",
            zIndex: 999,
            boxShadow: "0 8px 32px rgba(0,0,0,0.65)",
            pointerEvents: "none",
            animation: "fadeUp 0.2s cubic-bezier(0.4,0,0.2,1) both",
          }}
        >
          {text}
        </div>
      )}
    </div>
  );
}

// ─── AQI Grade Badge ──────────────────────────────────────────────────────────
function AQIBadge({ aqi }: { aqi: number }) {
  const grade =
    aqi <= 50  ? { label: "پاک", color: "#22c55e", bg: "rgba(34,197,94,0.12)",   border: "rgba(34,197,94,0.35)" } :
    aqi <= 100 ? { label: "قابل قبول", color: "#f59e0b", bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.35)" } :
    aqi <= 150 ? { label: "ناسالم برای حساس‌ها", color: "#f97316", bg: "rgba(249,115,22,0.12)", border: "rgba(249,115,22,0.35)" } :
                 { label: "ناسالم", color: "#f43f5e", bg: "rgba(244,63,94,0.12)", border: "rgba(244,63,94,0.35)" };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
      <span style={{ fontSize: "0.85rem", fontWeight: 800, color: "#edf2f7", direction: "ltr" }}>
        {toPersianDigits(Math.round(aqi))}
      </span>
      <span
        style={{
          background: grade.bg,
          border: `1px solid ${grade.border}`,
          color: grade.color,
          padding: "3px 10px",
          borderRadius: "100px",
          fontSize: "0.68rem",
          fontWeight: 800,
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
            style={{
              width: "10px",
              height: "10px",
              borderRadius: "3px",
              background: dot <= clampedLevel ? colors[clampedLevel - 1] : "rgba(255,255,255,0.08)",
              border: dot <= clampedLevel ? `1px solid ${colors[clampedLevel - 1]}` : "1px solid rgba(255,255,255,0.06)",
            }}
          />
        ))}
      </div>
      <span style={{ fontSize: "0.72rem", fontWeight: 800, color: colors[clampedLevel - 1] }}>
        {labels[clampedLevel - 1]} ({toPersianDigits(clampedLevel)}/۴)
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
  const distText = meters >= 1000
    ? `${toPersianDigits((meters / 1000).toFixed(1))} کیلومتر`
    : `${toPersianDigits(Math.round(meters))} متر`;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
      <span style={{ fontSize: "0.85rem", fontWeight: 800, color: "#edf2f7" }}>
        {distText}
      </span>
      {isSweetSpot && (
        <span
          style={{
            background: "rgba(45, 212, 191, 0.12)",
            border: "1px solid rgba(45, 212, 191, 0.35)",
            color: "#2dd4bf",
            borderRadius: "100px",
            padding: "2px 9px",
            fontSize: "0.62rem",
            fontWeight: 800,
          }}
        >
          ✦ نقطه طلایی {label}
        </span>
      )}
    </div>
  );
}

// ─── Confidence Range Bar (Left to Right Q05 -> Q95) ──────────────────────────
function ConfidenceBar({ low, mid, high }: { low: number; mid: number; high: number }) {
  if (!low || !high || low >= high) return null;
  const range = high - low;
  const midPct = ((mid - low) / range) * 100;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "12px", direction: "ltr" }}>
      {/* Min (Q05 on Left) and Max (Q95 on Right) */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
          <span style={{ fontSize: "0.6rem", color: "#546e8a", fontWeight: 700 }}>Q05 (حداقل)</span>
          <span style={{ fontSize: "0.78rem", fontWeight: 800, color: "#9ab0c7" }}>
            {formatPersianCurrency(low)}
          </span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
          <span style={{ fontSize: "0.6rem", color: "#546e8a", fontWeight: 700 }}>Q95 (حداکثر)</span>
          <span style={{ fontSize: "0.78rem", fontWeight: 800, color: "#9ab0c7" }}>
            {formatPersianCurrency(high)}
          </span>
        </div>
      </div>

      {/* Bold gradient bar (Left to Right) */}
      <div
        style={{
          height: "8px",
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
            background: "linear-gradient(90deg, rgba(249,115,22,0.18), rgba(245,158,11,0.6), rgba(249,115,22,0.18))",
          }}
        />
        {/* Median pin */}
        <div
          style={{
            position: "absolute",
            left: `${midPct}%`,
            top: "50%",
            transform: "translate(-50%, -50%)",
            width: "16px", height: "16px",
            borderRadius: "50%",
            background: "#f97316",
            border: "3px solid #fff",
            boxShadow: "0 0 12px rgba(249,115,22,0.8)",
            zIndex: 1,
          }}
        />
      </div>

      {/* Explicit confidence statement */}
      <div
        style={{
          textAlign: "center",
          fontSize: "0.75rem",
          fontWeight: 800,
          color: "#f59e0b",
          marginTop: "4px",
          direction: "rtl",
        }}
      >
        با احتمال ۹۵٪ قیمت واقعی در این بازه قرار دارد
      </div>
    </div>
  );
}

// ─── Market Pulse Widget (Historical Neighborhood Avg from BigQuery) ───────────
function MarketPulseWidget({ pulse, basePrice }: {
  pulse: MarketPulse; basePrice: number;
}) {
  const safeInflation = pulse.inflation_yoy > 500 ? pulse.inflation_yoy / 100 : pulse.inflation_yoy;
  const inflColor = safeInflation > 50 ? "#f43f5e" : safeInflation > 30 ? "#f97316" : safeInflation > 15 ? "#f59e0b" : "#22c55e";

  const gprDelta = pulse.gpr_index - pulse.gpr_ma3;
  const gprTrendText = gprDelta > 2 ? "افزایش نسبت به ماه قبل" : gprDelta < -2 ? "کاهش نسبت به ماه قبل" : "بدون تغییر نسبت به ماه قبل";
  const gprTrendColor = gprDelta > 2 ? "#f43f5e" : gprDelta < -2 ? "#22c55e" : "#546e8a";

  const nbAvgPrice = pulse.neighborhood_avg_price_sqm || basePrice;

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
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
        <Activity size={14} color="#f59e0b" />
        <span style={{ fontSize: "0.72rem", fontWeight: 800, color: "#edf2f7", letterSpacing: "0.05em" }}>
          نبض بازار و شاخص‌های کلان · {toPersianDigits(pulse.year_jalali)}/{toPersianDigits(pulse.month_jalali)}
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "14px" }}>
        {/* District Average */}
        <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "14px", padding: "12px 14px", display: "flex", flexDirection: "column", gap: "4px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <Building size={13} color="#2dd4bf" />
            <span style={{ fontSize: "0.65rem", color: "#546e8a", fontWeight: 800 }}>میانگین منطقه (قیمت پایه)</span>
            <Tooltip text="قیمت میانگین هر مترمربع در کل منطقه، محاسبه‌شده از نسبت مسکن به دلار lag-1." />
          </div>
          <span style={{ fontSize: "0.95rem", fontWeight: 900, color: "#2dd4bf" }}>
            {formatPersianCurrency(basePrice)}
          </span>
        </div>

        {/* Neighborhood Average (True Historical Quality Avg from BigQuery) */}
        <div style={{ background: "rgba(249,115,22,0.03)", border: "1px solid rgba(249,115,22,0.18)", borderRadius: "14px", padding: "12px 14px", display: "flex", flexDirection: "column", gap: "4px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <MapPin size={13} color="#f97316" />
            <span style={{ fontSize: "0.65rem", color: "#546e8a", fontWeight: 800 }}>میانگین محله (تاریخچه‌ای)</span>
            <Tooltip text="قیمت میانگین تاریخی محله، حاصل ضرب قیمت پایه منطقه در میانگین ضریب کیفی معاملات محله در BigQuery." />
          </div>
          <span style={{ fontSize: "0.95rem", fontWeight: 900, color: "#f97316" }}>
            {formatPersianCurrency(nbAvgPrice)}
          </span>
        </div>

        {/* Inflation YoY */}
        <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "14px", padding: "12px 14px", display: "flex", flexDirection: "column", gap: "4px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <TrendingUp size={13} color={inflColor} />
            <span style={{ fontSize: "0.65rem", color: "#546e8a", fontWeight: 800 }}>تورم نقطه به نقطه مسکن</span>
            <Tooltip text="نرخ تورم عمومی سالانه با تأخیر ۳ ماهه. این شاخص در روند کلان قیمت تأثیر مستقیم دارد." />
          </div>
          <span style={{ fontSize: "1.05rem", fontWeight: 900, color: inflColor }}>
            {toPersianDigits(safeInflation.toFixed(1))}٪
          </span>
          <span style={{ fontSize: "0.6rem", color: "#546e8a" }}>سالانه (با تأخیر)</span>
        </div>

        {/* GPR Index */}
        <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "14px", padding: "12px 14px", display: "flex", flexDirection: "column", gap: "4px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <Shield size={13} color="#edf2f7" />
            <span style={{ fontSize: "0.65rem", color: "#546e8a", fontWeight: 800 }}>شاخص ریسک ژئوپولیتیک (GPR)</span>
            <Tooltip text="شاخص سنجش تنش‌های سیاسی و بین‌المللی. مقادیر بالا نشان‌دهنده ریسک محیطی بالاتر است." />
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
            <span style={{ fontSize: "1.05rem", fontWeight: 900, color: "#edf2f7" }}>
              {toPersianDigits(Math.round(pulse.gpr_index))}
            </span>
          </div>
          <span style={{ fontSize: "0.64rem", color: gprTrendColor, fontWeight: 700 }}>
            {gprTrendText}
          </span>
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
      label: "فاصله تا ایستگاه مترو",
      tooltip: "دسترسی پیاده به مترو (کمتر از ۵۰۰ متر) ارزش ملک را تا ۱۵٪ افزایش می‌دهد.",
      value: (
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <DistanceBadge meters={spatial.dist_to_metro_m} sweetSpotMin={0} sweetSpotMax={500} label="🚇" />
          {spatial.nearest_metro_station && (
            <span style={{ fontSize: "0.65rem", color: "#546e8a", fontWeight: 700 }}>
              ایستگاه {spatial.nearest_metro_station}
            </span>
          )}
        </div>
      ),
    },
    {
      icon: <Navigation size={14} />,
      label: "فاصله تا بزرگراه",
      tooltip: "فاصله بین ۲۰۰ تا ۹۰۰ متر از بزرگراه، دسترسی عالی بدون سر و صدا ایجاد می‌کند.",
      value: <DistanceBadge meters={spatial.dist_to_highway_m} sweetSpotMin={200} sweetSpotMax={900} label="🛣️" />,
    },
    {
      icon: <Wind size={14} />,
      label: "کیفیت هوا (AQI)",
      tooltip: "شاخص کیفیت هوا: ۰-۵۰ پاک، ۵۱-۱۰۰ قابل قبول، ۱۰۱-۱۵۰ ناسالم برای حساس‌ها، بالای ۱۵۰ ناسالم.",
      value: <AQIBadge aqi={spatial.air_quality_aqi} />,
    },
    {
      icon: <Shield size={14} />,
      label: "ریسک زلزله",
      tooltip: "درجه خطرات لرزه‌ای منطقه بر اساس داده‌های پهنه‌بندی از ۱ (کم‌ترین) تا ۴ (بیش‌ترین).",
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
        <span style={{ fontSize: "0.68rem", fontWeight: 800, color: "#546e8a", textTransform: "uppercase", letterSpacing: "0.08em" }}>
          ویژگی‌های مکانی و دسترسی‌ها
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
            موقعیت طلایی 🌟
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

// ─── Math Accordion ───────────────────────────────────────────────────────────
function MathAccordion({ result }: { result: PredictionResult }) {
  const [open, setOpen] = useState(false);

  const steps = [
    { label: "۱. نسبت مسکن به دلار (لگ یک ماهه)", detail: `housing_to_usd_lag1 = ${result.housing_to_usd_lag1.toFixed(6)}`, color: "#64748b" },
    { label: "۲. مدل ماکرو → لگ دیفرانسیل", detail: `Δ log(H/USD) = ${result.macro_diff.toFixed(6)}  [Q5: ${result.macro_diff_q05.toFixed(4)}, Q95: ${result.macro_diff_q95.toFixed(4)}]`, color: "#9ab0c7" },
    { label: "۳. قیمت پایه ماکرو / مترمربع", detail: `exp(log(${result.housing_to_usd_lag1.toFixed(4)}) + ${result.macro_diff.toFixed(4)}) × ${result.usd_rate.toFixed(0)} = ${formatPersianCurrency(result.base_price_per_sqm)}`, color: "#64748b" },
    { label: "۴. ضریب کیفی میکرو", detail: `Ratio = ${result.micro_ratio.toFixed(6)} → ${toPersianDigits(((result.micro_ratio - 1) * 100).toFixed(1))}٪ ${result.micro_ratio >= 1 ? "پریمیوم" : "تخفیف"}`, color: result.micro_ratio >= 1 ? "#22c55e" : "#f43f5e" },
    { label: "۵. قیمت نهایی / مترمربع", detail: `${formatPersianCurrency(result.base_price_per_sqm)} × ${result.micro_ratio.toFixed(4)} = ${formatPersianCurrency(result.final_price_per_sqm)}`, color: "#f97316" },
    { label: "۶. ارزش کل ملک", detail: `${formatPersianCurrency(result.final_price_per_sqm)} × ${toPersianDigits(result.area)} مترمربع = ${formatPersianCurrency(result.final_total_price)}`, color: "#f59e0b" },
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
        type="button"
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
          <span style={{ fontSize: "0.75rem", fontWeight: 700 }}>محاسبه ریاضی جزئیات</span>
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
    `> PRICES`,
    `  base (median) = ${formatPersianCurrency(result.base_price_per_sqm)}`,
    `  final         = ${formatPersianCurrency(result.final_price_per_sqm)}`,
    `  total         = ${formatPersianCurrency(result.final_total_price)}`,
    ``,
    `> MICRO MODEL`,
    `  micro_ratio   = ${result.micro_ratio.toFixed(6)}`,
    ``,
    `> SPATIAL`,
    `  metro = ${result.spatial.dist_to_metro_m.toFixed(0)}m`,
    `  hwy   = ${result.spatial.dist_to_highway_m.toFixed(0)}m`,
    `  AQI   = ${result.spatial.air_quality_aqi.toFixed(0)}`,
    `  seismic = ${result.spatial.seismic_risk_level}`,
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
        <span style={{ fontSize: "0.62rem", fontWeight: 800, color: "#546e8a", textTransform: "uppercase", letterSpacing: "0.04em" }}>
          {label}
        </span>
        {tooltip && <Tooltip text={tooltip} />}
      </div>
      <div style={{ fontSize: "1.1rem", fontWeight: 900, color, lineHeight: 1.2 }} className="animate-countUp">
        {value}
      </div>
      {sub && <div style={{ fontSize: "0.66rem", color: "#546e8a", marginTop: "2px" }}>{sub}</div>}
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

  // ── Loading State ───────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="glass-card" style={{ padding: "32px", minHeight: "320px", display: "flex", flexDirection: "column", justifyContent: "center", border: "1px solid rgba(249,115,22,0.2)" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: "20px" }}>
          <div style={{ width: "52px", height: "52px", border: "3px solid rgba(249,115,22,0.12)", borderTopColor: "#f97316", borderRadius: "50%" }} className="animate-spin-slow" />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "10px", marginBottom: "16px" }}>
          {[0, 1, 2].map((i) => (
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

  // ── Error State ─────────────────────────────────────────────────────────────
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
                {toPersianDigits(i + 1)}
              </div>
              <span style={{ fontSize: "0.7rem", color: "#64748b" }}>{s}</span>
              {i < 2 && <ChevronRight size={11} color="#334155" />}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Calculated Values ───────────────────────────────────────────────────────
  const qualityPct = ((result.micro_ratio - 1) * 100).toFixed(1);
  const qualitySign = result.micro_ratio >= 1 ? "+" : "";
  const qualityColor = result.micro_ratio >= 1 ? "#22c55e" : "#f43f5e";
  const usdEquiv = (result.final_total_price * 1_000_000) / result.usd_rate;

  const dataSubtext = `بر اساس داده‌های معاملات واقعی از ۱۳۹۵ تا ${toPersianDigits(result.year_jalali)}/${toPersianDigits(result.month_jalali)}`;

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
              <span style={{ fontSize: "0.75rem", color: "#2dd4bf", fontWeight: 800 }}>
                 محله {PERSIAN_NEIGHBORHOODS[result.neighborhood] || result.neighborhood_name} · منطقه {toPersianDigits(result.region_id)}
              </span>
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "stretch", gap: "12px" }}>
          <button 
            className="no-print"
            onClick={() => window.print()}
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px", padding: "0 16px", display: "flex", gap: "6px", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#edf2f7", fontSize: "0.7rem", fontWeight: 700 }}
          >
            <Download size={14} />
            <span>گزارش PDF</span>
          </button>
          <div style={{ background: "rgba(45,212,191,0.07)", border: "1px solid rgba(45,212,191,0.18)", borderRadius: "10px", padding: "6px 14px", display: "flex", flexDirection: "column", justifyContent: "center", textAlign: "right" }}>
            <div style={{ fontSize: "0.57rem", color: "#546e8a", marginBottom: "2px", fontWeight: 700 }}>متراژ ملک</div>
            <div style={{ fontWeight: 900, color: "#2dd4bf", fontSize: "0.88rem" }}>
              {toPersianDigits(result.area.toLocaleString())} مترمربع
            </div>
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
        <div style={{ fontSize: "0.65rem", color: "#546e8a", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "6px" }}>
          ارزش تخمینی کل ملک
        </div>
        <div className="gradient-text" style={{ fontSize: "2.1rem", fontWeight: 900, lineHeight: 1.1 }}>
          {formatPersianCurrency(result.final_total_price)}
        </div>
        <div style={{ fontSize: "0.75rem", color: "#546e8a", marginTop: "8px", display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
          <span>{formatTomanFull(result.final_total_price)}</span>
          <span>·</span>
          <span style={{ direction: "ltr", display: "inline-block" }}>
            ≈ ${toPersianDigits(usdEquiv.toLocaleString("en-US", { maximumFractionDigits: 0 }))} USD
          </span>
        </div>
        <div style={{ fontSize: "0.64rem", color: "#546e8a", marginTop: "6px", fontStyle: "italic" }}>
          {dataSubtext}
        </div>

        {/* Confidence Interval Chart (Left to Right) */}
        <ConfidenceBar low={result.final_total_low} mid={result.final_total_price} high={result.final_total_high} />
      </div>

      {/* ── Metric Cards ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px" }}>
        <MetricCard
          label="قیمت پایه / مترمربع"
          value={formatPersianCurrency(result.base_price_per_sqm)}
          sub="مدل ماکرو (میانه)"
          color="#9ab0c7"
          bg="rgba(154,176,199,0.04)"
          icon={<BarChart3 size={11} />}
          delay={0}
          tooltip="قیمت پایه هر مترمربع بر اساس مدل ماکروی اقتصاد مسکن تهران."
        />
        <MetricCard
          label="ضریب کیفی میکرو"
          value={`×${toPersianDigits(result.micro_ratio.toFixed(3))}`}
          sub={`${toPersianDigits(qualitySign)}${toPersianDigits(qualityPct)}٪ ${result.micro_ratio >= 1 ? "پریمیوم" : "تخفیف"}`}
          color={qualityColor}
          bg={`${qualityColor}08`}
          icon={<TrendingUp size={11} />}
          delay={80}
          tooltip="ضریب کیفی ناشی از مشخصات خاص ملک (طبقه، متراژ، امکانات و موقعیت مکانی)."
        />
        <MetricCard
          label="قیمت نهایی / مترمربع"
          value={formatPersianCurrency(result.final_price_per_sqm)}
          sub={`≈ $${toPersianDigits(((result.final_price_per_sqm * 1_000_000) / result.usd_rate).toFixed(0))}`}
          color="#f97316"
          bg="rgba(249,115,22,0.06)"
          icon={<Activity size={11} />}
          delay={160}
          tooltip="قیمت نهایی هر مترمربع پس از اعمال ضریب کیفی روی قیمت پایه."
        />
      </div>

      {/* ── Market Pulse ── */}
      {result.market_pulse && (
        <MarketPulseWidget
          pulse={result.market_pulse}
          basePrice={result.base_price_per_sqm}
        />
      )}

      {/* ── Spatial Features Panel ── */}
      {result.spatial && <SpatialPanel spatial={result.spatial} />}

      {/* ── Math Accordion ── */}
      <MathAccordion result={result} />

      {/* ── Debug Panel ── */}
      {debugMode && <DebugPanel result={result} />}

      {/* ── Disclaimer ── */}
      <div style={{ fontSize: "0.62rem", color: "#334155", textAlign: "center", borderTop: "1px solid rgba(255,255,255,0.04)", paddingTop: "10px", lineHeight: 1.7 }}>
        ارزیابی هوشمند بر اساس مدل XGBoost V2 و داده‌های مکانی BigQuery — داده‌ها: {toPersianDigits(result.year_jalali)}/{toPersianDigits(result.month_jalali)}
      </div>
    </div>
  );
}
