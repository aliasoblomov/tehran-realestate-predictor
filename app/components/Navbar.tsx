"use client";

import { MapPin, TrendingUp, Cpu, AlertTriangle } from "lucide-react";

interface NavbarProps {
  usdRate: number | null;
}

export default function Navbar({ usdRate }: NavbarProps) {
  return (
    <nav
      style={{
        borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
        background: "rgba(8, 12, 20, 0.85)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        position: "sticky",
        top: 0,
        zIndex: 100,
      }}
    >
      <div
        style={{
          maxWidth: "1440px",
          margin: "0 auto",
          padding: "0 24px",
          height: "64px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "16px",
        }}
      >
        {/* Brand */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div
            style={{
              width: "34px",
              height: "34px",
              borderRadius: "10px",
              background: "linear-gradient(135deg, #f59e0b, #d97706)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 0 16px rgba(245, 158, 11, 0.4)",
              flexShrink: 0,
            }}
          >
            <MapPin size={16} color="#fff" />
          </div>
          <div>
            <div
              style={{
                fontWeight: 800,
                fontSize: "1rem",
                lineHeight: 1,
                letterSpacing: "-0.02em",
                color: "#f1f5f9",
              }}
            >
              Tehran<span className="gradient-text">AI</span>
            </div>
            <div
              style={{
                fontSize: "0.65rem",
                color: "#475569",
                fontWeight: 500,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              Real Estate Predictor
            </div>
          </div>
        </div>

        {/* Center badge */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            background: "rgba(45, 212, 191, 0.08)",
            border: "1px solid rgba(45, 212, 191, 0.2)",
            borderRadius: "100px",
            padding: "6px 14px",
          }}
        >
          <Cpu size={13} color="#2dd4bf" />
          <span style={{ fontSize: "0.72rem", color: "#2dd4bf", fontWeight: 600 }}>
            XGBoost · BigQuery Spatial
          </span>
        </div>

        {/* USD Rate indicator */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              background: "rgba(255, 255, 255, 0.04)",
              border: "1px solid rgba(255, 255, 255, 0.06)",
              borderRadius: "8px",
              padding: "6px 12px",
            }}
          >
            <TrendingUp size={13} color="#f59e0b" />
            <span
              style={{
                fontSize: "0.72rem",
                color: "#94a3b8",
                fontWeight: 500,
              }}
            >
              USD/IRR:&nbsp;
            </span>
            {usdRate ? (
              <span
                style={{
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  color: "#f59e0b",
                }}
              >
                {usdRate.toLocaleString("en-US")}
              </span>
            ) : (
              <span
                style={{
                  width: "60px",
                  height: "12px",
                  display: "inline-block",
                  borderRadius: "4px",
                }}
                className="skeleton"
              />
            )}
          </div>

          {!usdRate && (
            <div title="Fetching live rate..." style={{ color: "#475569" }}>
              <AlertTriangle size={14} />
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
