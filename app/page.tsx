"use client";

import dynamic from "next/dynamic";
import { useState, useCallback } from "react";
import Navbar from "./components/Navbar";
import PredictionForm, { FormValues } from "./components/PredictionForm";
import ResultCard, { PredictionResult } from "./components/ResultCard";

// FastAPI backend URL — set NEXT_PUBLIC_API_URL in Vercel environment variables
const API_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ||
  "http://localhost:8000";

// Dynamic import of MapComponent to avoid SSR (Leaflet requires browser APIs)
const MapComponent = dynamic(() => import("./components/MapComponent"), {
  ssr: false,
  loading: () => (
    <div
      style={{
        width: "100%",
        height: "100%",
        borderRadius: "16px",
        background: "#0d1425",
        border: "1px solid rgba(255,255,255,0.06)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        gap: "12px",
      }}
    >
      <div
        style={{
          width: "40px",
          height: "40px",
          border: "3px solid rgba(249,115,22,0.2)",
          borderTopColor: "#f97316",
          borderRadius: "50%",
        }}
        className="animate-spin-slow"
      />
      <span style={{ fontSize: "0.8rem", color: "#475569" }}>Loading map…</span>
    </div>
  ),
});

export default function Home() {
  const [selectedLocation, setSelectedLocation] = useState<{
    lat: number;
    lon: number;
  } | null>(null);
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [usdRate, setUsdRate] = useState<number | null>(null);

  const handleLocationSelect = useCallback((lat: number, lon: number) => {
    setSelectedLocation({ lat, lon });
    // Clear previous result when location changes
    setResult(null);
    setError(null);
  }, []);

  const handleSubmit = useCallback(
    async (values: FormValues) => {
      if (!selectedLocation) return;

      setIsLoading(true);
      setError(null);
      setResult(null);

      try {
        const payload = {
          lat: selectedLocation.lat,
          lon: selectedLocation.lon,
          area: values.area,
          building_age: values.building_age,
          total_floors: values.total_floors,
          floor_num: values.floor_num,
          unit_per_floor: values.unit_per_floor,
          rooms_count: values.rooms_count,
          has_elevator: values.has_elevator,
          has_parking: values.has_parking,
          has_warehouse: values.has_warehouse,
          is_rebuilt: values.is_rebuilt,
          is_villa: values.is_villa,
        };

        const response = await fetch(`${API_URL}/predict`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const data = await response.json();

        if (!response.ok || data.detail) {
          setError(data.detail || `Server error: ${response.status}`);
          return;
        }

        setResult({ ...data, area: values.area });
        if (data.usd_rate) setUsdRate(data.usd_rate);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const isCors = msg.includes("Failed to fetch") || msg.includes("NetworkError");
        setError(
          isCors
            ? `Cannot reach API at ${API_URL}. Check NEXT_PUBLIC_API_URL or ensure backend is running.`
            : msg
        );
      } finally {
        setIsLoading(false);
      }
    },
    [selectedLocation]
  );

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Navbar usdRate={usdRate} />

      {/* ── Hero section ── */}
      <div
        style={{
          padding: "32px 24px 12px",
          maxWidth: "1440px",
          margin: "0 auto",
          width: "100%",
        }}
      >
        <h1
          style={{
            fontSize: "clamp(1.5rem, 3vw, 2.4rem)",
            fontWeight: 900,
            letterSpacing: "-0.03em",
            lineHeight: 1.1,
            margin: 0,
          }}
        >
          Tehran Property{" "}
          <span className="gradient-text">Price Predictor</span>
        </h1>
        <p
          style={{
            color: "#64748b",
            fontSize: "0.875rem",
            marginTop: "8px",
            maxWidth: "540px",
          }}
        >
          Drop a pin on the map, enter property details, and get an AI-powered
          valuation powered by XGBoost + BigQuery spatial analysis and live economic data.
        </p>
      </div>

      {/* ── Main layout ── */}
      <div
        style={{
          flex: 1,
          padding: "12px 24px 24px",
          maxWidth: "1440px",
          margin: "0 auto",
          width: "100%",
          display: "grid",
          gridTemplateColumns: "1fr 420px",
          gridTemplateRows: "1fr auto",
          gap: "16px",
        }}
        id="main-grid"
      >
        {/* Map panel */}
        <div
          className="glass-card"
          style={{
            height: "clamp(400px, 55vh, 640px)",
            padding: "4px",
            overflow: "hidden",
          }}
          id="map-panel"
        >
          <MapComponent
            onLocationSelect={handleLocationSelect}
            selectedLocation={selectedLocation}
          />
        </div>

        {/* Form panel */}
        <div
          className="glass-card"
          style={{
            padding: "20px",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            maxHeight: "clamp(400px, 55vh, 640px)",
          }}
          id="form-panel"
        >
          <PredictionForm
            selectedLocation={selectedLocation}
            onSubmit={handleSubmit}
            isLoading={isLoading}
          />
        </div>

        {/* Results panel — full width */}
        <div
          style={{
            gridColumn: "1 / -1",
          }}
          id="results-panel"
        >
          <ResultCard result={result} error={error} isLoading={isLoading} />
        </div>
      </div>

      {/* ── Responsive CSS ── */}
      <style>{`
        @media (max-width: 900px) {
          #main-grid {
            grid-template-columns: 1fr !important;
            grid-template-rows: auto auto auto !important;
          }
          #map-panel {
            height: clamp(320px, 50vw, 460px) !important;
          }
          #form-panel {
            max-height: none !important;
          }
        }
        @media (max-width: 600px) {
          #main-grid {
            padding: 8px 12px 16px !important;
          }
        }
      `}</style>
    </main>
  );
}
