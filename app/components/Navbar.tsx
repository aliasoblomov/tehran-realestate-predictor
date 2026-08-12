"use client";

import { MapPin, TrendingUp, Cpu } from "lucide-react";

interface NavbarProps {
  usdRate: number | null;
}

export default function Navbar({ usdRate }: NavbarProps) {
  return (
    <nav
      style={{
        borderBottom: "1px solid rgba(255, 255, 255, 0.07)",
        background: "rgba(15, 17, 23, 0.88)",
        backdropFilter: "blur(28px)",
        WebkitBackdropFilter: "blur(28px)",
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
              width: "36px",
              height: "36px",
              borderRadius: "12px",
              background: "linear-gradient(135deg, #e05a3d, #c24127)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 0 18px rgba(224, 90, 61, 0.42)",
              flexShrink: 0,
            }}
          >
            <MapPin size={16} color="#fff" />
          </div>
          <div>
            <div
              style={{
                fontWeight: 900,
                fontSize: "1rem",
                lineHeight: 1,
                color: "#edf2f7",
              }}
            >
              Ajor <span className="gradient-text">AI</span>
            </div>
            <div
              style={{
                fontSize: "0.63rem",
                color: "#546e8a",
                fontWeight: 600,
                marginTop: "3px",
              }}
            >
              ارزیاب هوشمند ملک
            </div>
          </div>
        </div>

        {/* Center badge */}
        <div
          className="hidden md:flex"
          style={{
            alignItems: "center",
            gap: "8px",
            background: "rgba(45, 212, 191, 0.08)",
            border: "1px solid rgba(45, 212, 191, 0.2)",
            borderRadius: "100px",
            padding: "6px 16px",
          }}
        >
          <Cpu size={13} color="#2dd4bf" />
          <span style={{ fontSize: "0.72rem", color: "#2dd4bf", fontWeight: 700 }}>
            XGBoost · BigQuery Spatial
          </span>
        </div>

        {/* USD Rate badge */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "7px",
            background: "rgba(249,115,22,0.07)",
            border: "1px solid rgba(249,115,22,0.2)",
            borderRadius: "12px",
            padding: "7px 14px",
          }}
        >
          <TrendingUp size={13} color="#f97316" />
          <span style={{ fontSize: "0.7rem", color: "#9ab0c7", fontWeight: 500 }}>
            دلار آزاد:
          </span>
          {usdRate ? (
            <span style={{ fontSize: "0.78rem", fontWeight: 800, color: "#f97316" }}>
              {usdRate.toLocaleString("fa-IR")} تومان
            </span>
          ) : (
            <span
              style={{ width: "72px", height: "12px", display: "inline-block", borderRadius: "6px" }}
              className="skeleton"
            />
          )}
        </div>
      </div>
    </nav>
  );
}
