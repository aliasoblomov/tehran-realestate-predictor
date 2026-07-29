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
} from "lucide-react";

export interface PredictionResult {
  base_price_per_sqm: number;
  quality_ratio: number;
  final_total_price: number;
  final_price_per_sqm: number;
  usd_rate: number;
  neighborhood: string;
  region_id: number;
  area: number;
  error?: string;
}

interface ResultCardProps {
  result: PredictionResult | null;
  error: string | null;
  isLoading: boolean;
}

function formatMillionTomans(amount: number): string {
  const tomans = amount / 10_000_000;
  return tomans.toLocaleString("en-US", { maximumFractionDigits: 1 });
}

function formatFull(amount: number): string {
  return amount.toLocaleString("en-US");
}

interface MetricProps {
  label: string;
  value: string;
  subValue?: string;
  color: string;
  icon: React.ReactNode;
  delay?: number;
}

function Metric({ label, value, subValue, color, icon, delay = 0 }: MetricProps) {
  return (
    <div
      style={{
        background: "rgba(255, 255, 255, 0.025)",
        border: "1px solid rgba(255, 255, 255, 0.06)",
        borderRadius: "12px",
        padding: "16px",
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        animation: `fadeUp 0.5s cubic-bezier(0.4, 0, 0.2, 1) ${delay}ms both`,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          color: color,
        }}
      >
        {icon}
        <span style={{ fontSize: "0.68rem", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "#64748b" }}>
          {label}
        </span>
      </div>
      <div
        style={{
          fontSize: "1.25rem",
          fontWeight: 800,
          color: color,
          letterSpacing: "-0.02em",
          lineHeight: 1,
        }}
        className="animate-countUp"
      >
        {value}
      </div>
      {subValue && (
        <div style={{ fontSize: "0.7rem", color: "#475569", marginTop: "2px" }}>
          {subValue}
        </div>
      )}
    </div>
  );
}

export default function ResultCard({ result, error, isLoading }: ResultCardProps) {
  // Loading skeleton state
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);
  const loadingMessages = [
    "Connecting to BigQuery...",
    "Calculating distances to Metro...",
    "Running XGBoost models...",
    "Finalizing valuation..."
  ];

  useEffect(() => {
    if (!isLoading) return;
    const int = setInterval(() => {
      setLoadingMsgIdx((prev) => (prev + 1) % loadingMessages.length);
    }, 1500);
    return () => clearInterval(int);
  }, [isLoading]);

  if (isLoading) {
    return (
      <div
        className="glass-card"
        style={{ padding: "28px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "20px", minHeight: "250px" }}
      >
        <div className="animate-spin-slow" style={{ width: "40px", height: "40px", border: "3px solid rgba(249,115,22,0.2)", borderTopColor: "#f97316", borderRadius: "50%" }} />
        <div style={{ color: "#94a3b8", fontSize: "0.9rem", fontWeight: 600 }} className="animate-fadeUp" key={loadingMsgIdx}>
          {loadingMessages[loadingMsgIdx]}
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div
        className="glass-card"
        style={{
          padding: "28px",
          border: "1px solid rgba(244, 63, 94, 0.25)",
          background: "rgba(244, 63, 94, 0.04)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "10px",
              background: "rgba(244, 63, 94, 0.1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <AlertCircle size={20} color="#f43f5e" />
          </div>
          <div>
            <div style={{ fontWeight: 700, color: "#f43f5e", marginBottom: "4px" }}>
              Prediction Failed
            </div>
            <div style={{ fontSize: "0.8rem", color: "#94a3b8" }}>{error}</div>
          </div>
        </div>
      </div>
    );
  }

  // Empty state
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
          gap: "12px",
          minHeight: "140px",
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: "52px",
            height: "52px",
            borderRadius: "16px",
            background: "rgba(249, 115, 22, 0.08)",
            border: "1px solid rgba(249, 115, 22, 0.15)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <BarChart3 size={24} color="#ea580c" />
        </div>
        <div>
          <div style={{ fontWeight: 700, color: "#94a3b8", fontSize: "0.9rem" }}>
            Awaiting Prediction
          </div>
          <div style={{ fontSize: "0.75rem", color: "#475569", marginTop: "4px" }}>
            Pin a location, fill in property details, and click &ldquo;Predict Price&rdquo;
          </div>
        </div>
        <div
          style={{
            display: "flex",
            gap: "20px",
            marginTop: "8px",
          }}
        >
          {["Drop pin on map", "Fill form", "Get AI estimate"].map((step, i) => (
            <div
              key={i}
              style={{ display: "flex", alignItems: "center", gap: "6px", opacity: 0.5 }}
            >
              <div
                style={{
                  width: "20px",
                  height: "20px",
                  borderRadius: "50%",
                  background: "rgba(249, 115, 22, 0.2)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "0.6rem",
                  fontWeight: 800,
                  color: "#f97316",
                  flexShrink: 0,
                }}
              >
                {i + 1}
              </div>
              <span style={{ fontSize: "0.7rem", color: "#64748b" }}>{step}</span>
              {i < 2 && <ChevronRight size={10} color="#334155" />}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Result display
  const usdPrice = result.final_total_price / result.usd_rate;
  const qualityPct = ((result.quality_ratio - 1) * 100).toFixed(1);
  const qualitySign = result.quality_ratio >= 1 ? "+" : "";

  return (
    <div
      className="glass-card"
      style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "20px" }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
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
              boxShadow: "0 0 16px rgba(249, 115, 22, 0.4)",
              animation: "pulse-ring 2s infinite",
            }}
          >
            <CheckCircle size={18} color="#fff" />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: "0.95rem", color: "#f1f5f9" }}>
              Prediction Result
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "2px" }}>
              <MapPin size={11} color="#2dd4bf" />
              <span style={{ fontSize: "0.68rem", color: "#2dd4bf", fontWeight: 600 }}>
                {result.neighborhood
                  ? result.neighborhood.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
                  : "Unknown"}{" "}
                · Region {result.region_id}
              </span>
            </div>
          </div>
        </div>

        <div
          style={{
            background: "rgba(45, 212, 191, 0.08)",
            border: "1px solid rgba(45, 212, 191, 0.2)",
            borderRadius: "8px",
            padding: "6px 12px",
          }}
        >
          <div style={{ fontSize: "0.62rem", color: "#475569", marginBottom: "1px" }}>Area</div>
          <div style={{ fontWeight: 700, color: "#2dd4bf", fontSize: "0.85rem" }}>
            {result.area.toLocaleString()} m²
          </div>
        </div>
      </div>

      {/* Metrics grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "10px" }}>
        <Metric
          label="Base Price / m²"
          value={`${formatMillionTomans(result.base_price_per_sqm)} M Tomans`}
          subValue="Macro model output"
          color="#94a3b8"
          icon={<BarChart3 size={12} />}
          delay={0}
        />
        <Metric
          label="Quality Ratio"
          value={`×${result.quality_ratio.toFixed(4)}`}
          subValue={`${qualitySign}${qualityPct}% location premium`}
          color={result.quality_ratio >= 1 ? "#2dd4bf" : "#f43f5e"}
          icon={<TrendingUp size={12} />}
          delay={100}
        />
        <Metric
          label="Final / m²"
          value={`${formatMillionTomans(result.final_price_per_sqm)} M Tomans`}
          subValue={`≈ $${(result.final_price_per_sqm / result.usd_rate).toFixed(0)}/m²`}
          color="#f97316"
          icon={<DollarSign size={12} />}
          delay={200}
        />
        <Metric
          label="USD Rate"
          value={`${result.usd_rate.toLocaleString("en-US")} Tomans`}
          subValue="Live free market rate"
          color="#a855f7"
          icon={<TrendingUp size={12} />}
          delay={300}
        />
      </div>

      {/* Final total price hero */}
      <div
        style={{
          background: "linear-gradient(135deg, rgba(249,115,22,0.1) 0%, rgba(13,20,37,0.5) 100%)",
          border: "1px solid rgba(249, 115, 22, 0.25)",
          borderRadius: "14px",
          padding: "20px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "12px",
          animation: "fadeUp 0.5s cubic-bezier(0.4, 0, 0.2, 1) 400ms both",
        }}
      >
        <div>
          <div style={{ fontSize: "0.68rem", color: "#64748b", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "6px" }}>
            Estimated Total Price
          </div>
          <div
            className="gradient-text"
            style={{ fontSize: "1.75rem", fontWeight: 900, letterSpacing: "-0.03em", lineHeight: 1 }}
          >
            {formatMillionTomans(result.final_total_price)} M Tomans
          </div>
          <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "4px" }}>
            {formatFull(result.final_total_price)} Rials &nbsp;·&nbsp; ≈ ${usdPrice.toLocaleString("en-US", { maximumFractionDigits: 0 })} USD
          </div>
        </div>

        {/* Breakdown mini chart */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "6px",
            minWidth: "180px",
          }}
        >
          {[
            { label: "Base/m²", val: result.base_price_per_sqm, max: result.final_price_per_sqm, color: "#64748b" },
            { label: "Final/m²", val: result.final_price_per_sqm, max: result.final_price_per_sqm, color: "#f97316" },
          ].map(({ label, val, max, color }) => (
            <div key={label}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "3px" }}>
                <span style={{ fontSize: "0.65rem", color: "#64748b" }}>{label}</span>
                <span style={{ fontSize: "0.65rem", color, fontWeight: 700 }}>{formatMillionTomans(val)}</span>
              </div>
              <div
                style={{
                  height: "4px",
                  borderRadius: "100px",
                  background: "rgba(255,255,255,0.06)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${(val / max) * 100}%`,
                    background: color,
                    borderRadius: "100px",
                    transition: "width 1s cubic-bezier(0.4,0,0.2,1)",
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Disclaimer */}
      <div
        style={{
          fontSize: "0.65rem",
          color: "#334155",
          textAlign: "center",
          borderTop: "1px solid rgba(255,255,255,0.04)",
          paddingTop: "12px",
        }}
      >
        Estimate based on XGBoost ML model trained on Tehran market data. Not financial advice.
      </div>
    </div>
  );
}
