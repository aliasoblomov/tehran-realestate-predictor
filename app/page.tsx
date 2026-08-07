"use client";

import dynamic from "next/dynamic";
import { useState, useCallback, useEffect } from "react";
import Navbar from "./components/Navbar";
import PredictionForm, { FormValues } from "./components/PredictionForm";
import ResultCard, { PredictionResult } from "./components/ResultCard";

// FastAPI backend URL — set NEXT_PUBLIC_API_URL in Vercel environment variables
const API_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ||
  "http://localhost:8000";

// Dynamic import of MapComponent to avoid SSR
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
  const [debugMode, setDebugMode] = useState(false);
  const [lastFormValues, setLastFormValues] = useState<FormValues | null>(null);

  // Read ?debug=true from URL
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      setDebugMode(params.get("debug") === "true");
    }
  }, []);

  // Fetch live USD rate on page load for Navbar display
  useEffect(() => {
    const fetchLiveRate = async () => {
      try {
        const res = await fetch(
          "https://Api.BrsApi.ir/Market/Gold_Currency.php?key=B8rWPPXwLqJFRKbKv347ynyP8ahduHWy"
        );
        const data = await res.json();
        const usdObj = data.currency?.find((c: { symbol: string; price: number }) => c.symbol === "USD");
        if (usdObj?.price) setUsdRate(Number(usdObj.price));
      } catch (err) {
        console.error("Failed to fetch USD on mount:", err);
      }
    };
    fetchLiveRate();
  }, []);

  const handleLocationSelect = useCallback((lat: number, lon: number) => {
    setSelectedLocation({ lat, lon });
    setResult(null);
    setError(null);
  }, []);

  const handleSubmit = useCallback(
    async (values: FormValues, overrideSlug?: string) => {
      if (!selectedLocation) return;

      setLastFormValues(values);
      setIsLoading(true);
      setError(null);

      try {
        const payload: Record<string, unknown> = {
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
          is_villa: values.is_villa,
          usd_rate: usdRate || undefined,
        };

        if (overrideSlug) {
          payload.selected_neighborhood_slug = overrideSlug;
        }

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

        // Inject area from form into the response for display
        setResult({ ...data, area: values.area });

        if (data.usd_rate) setUsdRate(data.usd_rate);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const isCors =
          msg.includes("Failed to fetch") || msg.includes("NetworkError");
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

  const handleNeighborhoodChange = useCallback(
    (slug: string) => {
      if (lastFormValues) {
        handleSubmit(lastFormValues, slug);
      }
    },
    [lastFormValues, handleSubmit]
  );

  return (
    <main style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <Navbar usdRate={usdRate} />

      {/* ── Hero ── */}
      <div
        style={{
          padding: "28px 24px 10px",
          maxWidth: "1440px",
          margin: "0 auto",
          width: "100%",
        }}
      >
        <h1
          style={{
            fontSize: "clamp(1.4rem, 3vw, 2.2rem)",
            fontWeight: 900,
            letterSpacing: "-0.03em",
            lineHeight: 1.1,
            margin: 0,
          }}
        >
          Tehran Property{" "}
          <span className="gradient-text">Price Predictor</span>
          {debugMode && (
            <span
              style={{
                marginLeft: "12px",
                fontSize: "0.6rem",
                fontWeight: 700,
                letterSpacing: "0.1em",
                background: "rgba(34,197,94,0.12)",
                border: "1px solid rgba(34,197,94,0.3)",
                color: "#22c55e",
                borderRadius: "6px",
                padding: "3px 8px",
                verticalAlign: "middle",
              }}
            >
              DEBUG MODE
            </span>
          )}
        </h1>
        <p style={{ color: "#64748b", fontSize: "0.83rem", marginTop: "6px", maxWidth: "520px" }}>
          AI-powered valuation · V2 XGBoost ensemble · BigQuery spatial data · Live macro signals
        </p>
      </div>

      {/* ── Main Layout ── */}
      <div
        style={{
          flex: 1,
          padding: "10px 24px 24px",
          maxWidth: "1440px",
          margin: "0 auto",
          width: "100%",
          display: "grid",
          gridTemplateColumns: "1fr 380px",
          gridTemplateRows: "1fr auto",
          gap: "16px",
        }}
        id="main-grid"
      >
        {/* Map panel */}
        <div
          className="glass-card"
          style={{ height: "clamp(380px, 52vh, 600px)", padding: "4px", overflow: "hidden" }}
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
            maxHeight: "clamp(380px, 52vh, 600px)",
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
        <div style={{ gridColumn: "1 / -1" }} id="results-panel">
          <ResultCard
            result={result}
            error={error}
            isLoading={isLoading}
            onNeighborhoodChange={handleNeighborhoodChange}
            debugMode={debugMode}
          />
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
            height: clamp(300px, 50vw, 440px) !important;
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
