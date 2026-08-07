"use client";

import { useState, useEffect } from "react";
import {
  DollarSign,
  TrendingUp,
  BarChart3,
  MapPin,
  AlertCircle,
  CheckCircle,
  ChevronRight,
  ChevronDown,
  Zap,
  Globe,
  Shield,
  Activity,
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
  // V2 core prices
  base_price_per_sqm: number;
  base_price_low: number;
  base_price_high: number;
  micro_ratio: number;
  final_price_per_sqm: number;
  final_total_price: number;
  final_total_low: number;
  final_total_high: number;
  // Context
  usd_rate: number;
  neighborhood: string;
  neighborhood_name: string;
  region_id: number;
  year_jalali: number;
  month_jalali: number;
  // Debug
  macro_diff: number;
  macro_diff_q05: number;
  macro_diff_q95: number;
  housing_to_usd_lag1: number;
  // Relational
  spatial: SpatialFeatures;
  candidate_neighborhoods: CandidateNeighborhood[];
  market_pulse: MarketPulse;
  // injected by frontend
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
  return n.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function fmtM(n: number): string {
  // Format as Millions Tomans
  return fmt(n, n >= 100 ? 0 : n >= 10 ? 1 : 2);
}

function fmtToman(millionTomans: number): string {
  const tomans = Math.round(millionTomans * 1_000_000);
  return tomans.toLocaleString("en-US");
}

// ─── Sub-components ───────────────────────────────────────────────────────────
interface MetricCardProps {
  label: string;
  value: string;
  sub?: string;
  color: string;
  bg: string;
  icon: React.ReactNode;
  delay?: number;
}

function MetricCard({ label, value, sub, color, bg, icon, delay = 0 }: MetricCardProps) {
  return (
    <div
      style={{
        background: bg,
        border: `1px solid ${color}22`,
        borderRadius: "14px",
        padding: "16px 18px",
        display: "flex",
        flexDirection: "column",
        gap: "6px",
        animation: `fadeUp 0.45s cubic-bezier(0.4,0,0.2,1) ${delay}ms both`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
        <div
          style={{
            width: "24px",
            height: "24px",
            borderRadius: "7px",
            background: `${color}18`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: color,
          }}
        >
          {icon}
        </div>
        <span
          style={{
            fontSize: "0.62rem",
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "#475569",
          }}
        >
          {label}
        </span>
      </div>
      <div
        style={{
          fontSize: "1.2rem",
          fontWeight: 800,
          color: color,
          letterSpacing: "-0.02em",
          lineHeight: 1,
        }}
        className="animate-countUp"
      >
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: "0.68rem", color: "#475569", marginTop: "1px" }}>
          {sub}
        </div>
      )}
    </div>
  );
}

// ─── Market Pulse Widget ──────────────────────────────────────────────────────
function MarketPulseWidget({ pulse }: { pulse: MarketPulse }) {
  const gprDelta = pulse.gpr_index - pulse.gpr_ma3;
  const gprTrend = gprDelta > 5 ? "↑ Rising" : gprDelta < -5 ? "↓ Easing" : "→ Stable";
  const gprColor = gprDelta > 5 ? "#f43f5e" : gprDelta < -5 ? "#22c55e" : "#94a3b8";

  const inflColor = pulse.inflation_yoy > 40 ? "#f43f5e" : pulse.inflation_yoy > 20 ? "#f59e0b" : "#22c55e";

  return (
    <div
      style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: "14px",
        padding: "16px",
        animation: "fadeUp 0.5s cubic-bezier(0.4,0,0.2,1) 550ms both",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          marginBottom: "12px",
        }}
      >
        <Activity size={13} color="#f59e0b" />
        <span
          style={{
            fontSize: "0.62rem",
            fontWeight: 700,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "#64748b",
          }}
        >
          Market Pulse · {pulse.year_jalali}/{pulse.month_jalali}
        </span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "10px",
        }}
      >
        {/* USD */}
        <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
          <span style={{ fontSize: "0.58rem", color: "#475569", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>
            USD Rate
          </span>
          <span style={{ fontSize: "0.95rem", fontWeight: 800, color: "#a855f7" }}>
            {(pulse.usd_toman / 1000).toFixed(0)}K
          </span>
          <span style={{ fontSize: "0.6rem", color: "#475569" }}>Tomans</span>
        </div>

        {/* Region Avg */}
        <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
          <span style={{ fontSize: "0.58rem", color: "#475569", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>
            Region Avg
          </span>
          <span style={{ fontSize: "0.95rem", fontWeight: 800, color: "#2dd4bf" }}>
            {fmtM(pulse.region_avg_price_sqm)}M
          </span>
          <span style={{ fontSize: "0.6rem", color: "#475569" }}>Tomans/m²</span>
        </div>

        {/* Inflation */}
        <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
          <span style={{ fontSize: "0.58rem", color: "#475569", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>
            Inflation
          </span>
          <span style={{ fontSize: "0.95rem", fontWeight: 800, color: inflColor }}>
            {pulse.inflation_yoy.toFixed(1)}%
          </span>
          <span style={{ fontSize: "0.6rem", color: "#475569" }}>YoY (lagged)</span>
        </div>

        {/* GPR */}
        <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
          <span style={{ fontSize: "0.58rem", color: "#475569", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>
            Iran GPR
          </span>
          <span style={{ fontSize: "0.95rem", fontWeight: 800, color: gprColor }}>
            {pulse.gpr_index.toFixed(0)}
          </span>
          <span style={{ fontSize: "0.6rem", color: gprColor }}>{gprTrend}</span>
        </div>
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
    <div style={{ display: "flex", flexDirection: "column", gap: "4px", marginTop: "8px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: "0.6rem", color: "#475569" }}>Q5: {fmtM(low)}M</span>
        <span style={{ fontSize: "0.6rem", color: "#64748b" }}>90% Confidence Range</span>
        <span style={{ fontSize: "0.6rem", color: "#475569" }}>Q95: {fmtM(high)}M</span>
      </div>
      <div
        style={{
          height: "6px",
          borderRadius: "100px",
          background: "rgba(255,255,255,0.06)",
          position: "relative",
          overflow: "visible",
        }}
      >
        {/* Range fill */}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 0,
            height: "100%",
            borderRadius: "100px",
            background: "linear-gradient(90deg, rgba(249,115,22,0.15), rgba(249,115,22,0.4), rgba(249,115,22,0.15))",
          }}
        />
        {/* Median marker */}
        <div
          style={{
            position: "absolute",
            left: `${midPct}%`,
            top: "50%",
            transform: "translate(-50%, -50%)",
            width: "12px",
            height: "12px",
            borderRadius: "50%",
            background: "#f97316",
            border: "2px solid #fff",
            boxShadow: "0 0 8px rgba(249,115,22,0.6)",
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
    {
      label: "1. Economic Context",
      detail: `Housing-to-USD Ratio (lag 1m): ${result.housing_to_usd_lag1.toFixed(6)}`,
      color: "#64748b",
    },
    {
      label: "2. Macro Model → Log Differential",
      detail: `Δ log(H/USD) = ${result.macro_diff.toFixed(6)}  [Q5: ${result.macro_diff_q05.toFixed(4)}, Q95: ${result.macro_diff_q95.toFixed(4)}]`,
      color: "#94a3b8",
    },
    {
      label: "3. Base Region Price / m²",
      detail: `exp(log(${result.housing_to_usd_lag1.toFixed(4)}) + ${result.macro_diff.toFixed(4)}) × ${result.usd_rate.toFixed(0)} = ${fmtM(result.base_price_per_sqm)}M Tomans`,
      color: "#64748b",
    },
    {
      label: "4. Micro Quality Multiplier",
      detail: `Ratio = ${result.micro_ratio.toFixed(6)} → ${((result.micro_ratio - 1) * 100).toFixed(1)}% ${result.micro_ratio >= 1 ? "premium" : "discount"}`,
      color: result.micro_ratio >= 1 ? "#22c55e" : "#f43f5e",
    },
    {
      label: "5. Final Price / m²",
      detail: `${fmtM(result.base_price_per_sqm)}M × ${result.micro_ratio.toFixed(4)} = ${fmtM(result.final_price_per_sqm)}M Tomans`,
      color: "#f97316",
    },
    {
      label: "6. Total Valuation",
      detail: `${fmtM(result.final_price_per_sqm)}M × ${result.area}m² = ${fmtM(result.final_total_price)}M Tomans`,
      color: "#f59e0b",
    },
  ];

  return (
    <div
      style={{
        border: "1px solid rgba(255,255,255,0.05)",
        borderRadius: "12px",
        overflow: "hidden",
        animation: "fadeUp 0.5s cubic-bezier(0.4,0,0.2,1) 600ms both",
      }}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%",
          padding: "12px 16px",
          background: "rgba(255,255,255,0.02)",
          border: "none",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          color: "#94a3b8",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <Zap size={12} color="#f59e0b" />
          <span style={{ fontSize: "0.72rem", fontWeight: 600 }}>
            How We Calculated This
          </span>
        </div>
        <ChevronDown
          size={14}
          color="#475569"
          style={{
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.25s ease",
          }}
        />
      </button>

      {open && (
        <div
          style={{
            background: "rgba(0,0,0,0.2)",
            padding: "12px 16px",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
          }}
        >
          {steps.map((s, i) => (
            <div key={i} style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
              <div
                style={{
                  width: "4px",
                  height: "4px",
                  borderRadius: "50%",
                  background: s.color,
                  marginTop: "6px",
                  flexShrink: 0,
                }}
              />
              <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                <span style={{ fontSize: "0.68rem", fontWeight: 700, color: "#64748b" }}>
                  {s.label}
                </span>
                <code
                  style={{
                    fontSize: "0.65rem",
                    color: s.color,
                    fontFamily: "monospace",
                    background: "rgba(255,255,255,0.03)",
                    borderRadius: "4px",
                    padding: "2px 6px",
                  }}
                >
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
    `  decay = ${result.spatial.urban_decay_class}`,
    ``,
    `> REGION ${result.region_id} · ${result.neighborhood}`,
    `  USD = ${result.usd_rate.toLocaleString()} Tomans`,
    `  GPR = ${result.market_pulse?.gpr_index?.toFixed(1)}`,
  ];

  return (
    <div
      style={{
        background: "#050a0e",
        border: "1px solid rgba(34,197,94,0.2)",
        borderRadius: "10px",
        padding: "14px",
        fontFamily: "monospace",
        fontSize: "0.7rem",
        color: "#22c55e",
        maxHeight: "240px",
        overflowY: "auto",
        animation: "fadeUp 0.4s both",
        lineHeight: "1.6",
      }}
    >
      <div style={{ color: "#4ade80", fontWeight: 700, marginBottom: "8px" }}>
        ⚡ DEBUG · Tehran Predictor V2
      </div>
      {lines.map((l, i) => (
        <div
          key={i}
          style={{
            color: l.startsWith(">") ? "#86efac" : l === "" ? "transparent" : "#22c55e",
            fontWeight: l.startsWith(">") ? 700 : 400,
          }}
        >
          {l || "\u00a0"}
        </div>
      ))}
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
      "Initializing V2 inference pipeline...",
      "Fetching live USD rate from BrsApi...",
      "Querying BigQuery: macro_training_v2...",
      "Running spatial feature engineering...",
      "Executing macro XGBoost ensemble (3 models)...",
      "Applying micro quality multiplier...",
      "Computing confidence intervals...",
    ];
    let i = 0;
    setLoadingSteps([steps[0]]);
    const iv = setInterval(() => {
      i++;
      if (i < steps.length) setLoadingSteps((p) => [...p, steps[i]]);
    }, 1100);
    return () => clearInterval(iv);
  }, [isLoading]);

  // ── Loading ───────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div
        className="glass-card"
        style={{
          padding: "32px",
          minHeight: "320px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          border: "1px solid rgba(249,115,22,0.25)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "center", marginBottom: "20px" }}>
          <div
            style={{
              width: "48px",
              height: "48px",
              border: "3px solid rgba(249,115,22,0.15)",
              borderTopColor: "#f97316",
              borderRadius: "50%",
            }}
            className="animate-spin-slow"
          />
        </div>

        {/* Skeleton price cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "10px", marginBottom: "16px" }}>
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="skeleton"
              style={{ height: "72px", borderRadius: "12px" }}
            />
          ))}
        </div>

        {/* Console log */}
        <div
          style={{
            background: "rgba(5,10,14,0.8)",
            border: "1px solid rgba(34,197,94,0.1)",
            borderRadius: "8px",
            padding: "12px 14px",
            fontFamily: "monospace",
            fontSize: "0.72rem",
            color: "#22c55e",
            minHeight: "120px",
            display: "flex",
            flexDirection: "column",
            gap: "6px",
          }}
        >
          {loadingSteps.map((step, idx) => (
            <div key={idx} className="animate-fadeUp" style={{ display: "flex", gap: "8px" }}>
              <span style={{ color: "#4ade80" }}>{">"}</span> {step}
            </div>
          ))}
          <div style={{ display: "flex", gap: "8px", opacity: 0.5 }}>
            <span style={{ color: "#f97316" }}>_</span>
          </div>
        </div>
      </div>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div
        className="glass-card"
        style={{
          padding: "28px",
          border: "1px solid rgba(244,63,94,0.2)",
          background: "rgba(244,63,94,0.03)",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
          <div
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "10px",
              background: "rgba(244,63,94,0.1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <AlertCircle size={20} color="#f43f5e" />
          </div>
          <div>
            <div style={{ fontWeight: 700, color: "#f43f5e", marginBottom: "6px", fontSize: "0.9rem" }}>
              Prediction Failed
            </div>
            <div
              style={{
                fontSize: "0.75rem",
                color: "#94a3b8",
                background: "rgba(0,0,0,0.3)",
                borderRadius: "6px",
                padding: "8px 10px",
                fontFamily: "monospace",
              }}
            >
              {error}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Empty ─────────────────────────────────────────────────────────────────
  if (!result) {
    return (
      <div
        className="glass-card"
        style={{
          padding: "32px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "14px",
          minHeight: "160px",
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: "56px",
            height: "56px",
            borderRadius: "18px",
            background: "rgba(249,115,22,0.07)",
            border: "1px solid rgba(249,115,22,0.12)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <BarChart3 size={26} color="#ea580c" />
        </div>
        <div>
          <div style={{ fontWeight: 700, color: "#94a3b8", fontSize: "0.9rem", marginBottom: "4px" }}>
            Awaiting Valuation
          </div>
          <div style={{ fontSize: "0.75rem", color: "#475569" }}>
            Drop a pin · Fill in details · Get AI-powered estimate
          </div>
        </div>
        <div style={{ display: "flex", gap: "16px", marginTop: "4px" }}>
          {["Drop pin on map", "Fill form", "Get estimate"].map((step, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: "6px", opacity: 0.45 }}>
              <div
                style={{
                  width: "18px",
                  height: "18px",
                  borderRadius: "50%",
                  background: "rgba(249,115,22,0.18)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "0.58rem",
                  fontWeight: 800,
                  color: "#f97316",
                }}
              >
                {i + 1}
              </div>
              <span style={{ fontSize: "0.68rem", color: "#64748b" }}>{step}</span>
              {i < 2 && <ChevronRight size={10} color="#334155" />}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Result ────────────────────────────────────────────────────────────────
  const usdEquiv = (result.final_total_price * 1_000_000) / result.usd_rate;
  const qualityPct = ((result.micro_ratio - 1) * 100).toFixed(1);
  const qualitySign = result.micro_ratio >= 1 ? "+" : "";
  const qualityColor = result.micro_ratio >= 1 ? "#22c55e" : "#f43f5e";

  return (
    <div
      className="glass-card"
      style={{
        padding: "24px",
        display: "flex",
        flexDirection: "column",
        gap: "16px",
      }}
    >
      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "10px",
              background: "linear-gradient(135deg, #f97316, #ea580c)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 0 14px rgba(249,115,22,0.4)",
            }}
            className="animate-pulse-ring"
          >
            <CheckCircle size={18} color="#fff" />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: "0.9rem", color: "#f1f5f9" }}>
              Valuation Result
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "4px" }}>
              <MapPin size={11} color="#2dd4bf" />
              {result.candidate_neighborhoods?.length > 0 ? (
                <select
                  value={result.neighborhood}
                  onChange={(e) => onNeighborhoodChange?.(e.target.value)}
                  style={{
                    background: "rgba(15,23,42,0.8)",
                    border: "1px solid rgba(45,212,191,0.35)",
                    borderRadius: "6px",
                    color: "#2dd4bf",
                    fontSize: "0.72rem",
                    fontWeight: 700,
                    padding: "3px 8px",
                    cursor: "pointer",
                    outline: "none",
                  }}
                >
                  {result.candidate_neighborhoods.map((c) => (
                    <option key={c.slug} value={c.slug} style={{ background: "#0f172a", color: "#f8fafc" }}>
                      {c.name} ({c.distance_km}km) · Region {c.region_id}
                    </option>
                  ))}
                </select>
              ) : (
                <span style={{ fontSize: "0.68rem", color: "#2dd4bf", fontWeight: 600 }}>
                  {result.neighborhood_name} · Region {result.region_id}
                </span>
              )}
            </div>
          </div>
        </div>
        <div
          style={{
            background: "rgba(45,212,191,0.06)",
            border: "1px solid rgba(45,212,191,0.15)",
            borderRadius: "8px",
            padding: "6px 12px",
            textAlign: "right",
          }}
        >
          <div style={{ fontSize: "0.58rem", color: "#475569", marginBottom: "1px" }}>Area</div>
          <div style={{ fontWeight: 700, color: "#2dd4bf", fontSize: "0.82rem" }}>
            {result.area.toLocaleString()} m²
          </div>
        </div>
      </div>

      {/* ── Hero Price Banner ── */}
      <div
        style={{
          background: "linear-gradient(135deg, rgba(249,115,22,0.1), rgba(13,20,37,0.6) 60%, rgba(245,158,11,0.05))",
          border: "1px solid rgba(249,115,22,0.2)",
          borderRadius: "16px",
          padding: "20px 24px",
          animation: "fadeUp 0.5s cubic-bezier(0.4,0,0.2,1) 100ms both",
        }}
      >
        <div style={{ fontSize: "0.62rem", color: "#64748b", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "8px" }}>
          Estimated Total Value
        </div>
        <div
          className="gradient-text"
          style={{ fontSize: "2rem", fontWeight: 900, letterSpacing: "-0.03em", lineHeight: 1 }}
        >
          {fmtM(result.final_total_price)} M Tomans
        </div>
        <div style={{ fontSize: "0.73rem", color: "#64748b", marginTop: "6px" }}>
          {fmtToman(result.final_total_price)} Tomans &nbsp;·&nbsp; ≈ $
          {usdEquiv.toLocaleString("en-US", { maximumFractionDigits: 0 })} USD
        </div>

        {/* Confidence Range */}
        <ConfidenceBar
          low={result.final_total_low}
          mid={result.final_total_price}
          high={result.final_total_high}
        />
      </div>

      {/* ── Metric Cards ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "10px" }}>
        <MetricCard
          label="Base / m²"
          value={`${fmtM(result.base_price_per_sqm)}M`}
          sub="Macro model (median)"
          color="#94a3b8"
          bg="rgba(148,163,184,0.04)"
          icon={<BarChart3 size={11} />}
          delay={0}
        />
        <MetricCard
          label="Quality ×"
          value={`×${result.micro_ratio.toFixed(3)}`}
          sub={`${qualitySign}${qualityPct}% premium`}
          color={qualityColor}
          bg={`${qualityColor}08`}
          icon={<TrendingUp size={11} />}
          delay={80}
        />
        <MetricCard
          label="Final / m²"
          value={`${fmtM(result.final_price_per_sqm)}M`}
          sub={`≈ $${((result.final_price_per_sqm * 1_000_000) / result.usd_rate).toFixed(0)}/m²`}
          color="#f97316"
          bg="rgba(249,115,22,0.06)"
          icon={<DollarSign size={11} />}
          delay={160}
        />
        <MetricCard
          label="USD Rate"
          value={`${(result.usd_rate / 1000).toFixed(0)}K`}
          sub="Tomans · Live rate"
          color="#a855f7"
          bg="rgba(168,85,247,0.06)"
          icon={<Globe size={11} />}
          delay={240}
        />
      </div>

      {/* ── Market Pulse ── */}
      {result.market_pulse && <MarketPulseWidget pulse={result.market_pulse} />}

      {/* ── Math Accordion ── */}
      <MathAccordion result={result} />

      {/* ── Debug Panel ── */}
      {debugMode && <DebugPanel result={result} />}

      {/* ── Disclaimer ── */}
      <div
        style={{
          fontSize: "0.6rem",
          color: "#1e293b",
          textAlign: "center",
          borderTop: "1px solid rgba(255,255,255,0.03)",
          paddingTop: "10px",
        }}
      >
        AI estimate based on V2 XGBoost ensemble + BigQuery spatial data. Not financial advice. {result.year_jalali}/{result.month_jalali} data.
      </div>
    </div>
  );
}
