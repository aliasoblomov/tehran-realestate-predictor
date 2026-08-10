"use client";

import dynamic from "next/dynamic";
import { useState, useCallback, useEffect, useRef } from "react";
import Navbar from "./components/Navbar";
import PredictionForm, { FormValues, toPersianDigits } from "./components/PredictionForm";
import ResultCard, { PredictionResult } from "./components/ResultCard";
import { Sparkles, TrendingUp, MapPin, Home as HomeIcon, X } from "lucide-react";

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
  const selectedLocationRef = useRef<{ lat: number; lon: number } | null>(null);
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [usdRate, setUsdRate] = useState<number | null>(null);
  const [debugMode, setDebugMode] = useState(false);
  const [lastFormValues, setLastFormValues] = useState<FormValues | null>(null);
  const [addressName, setAddressName] = useState<string>("");
  const [isHowItWorksOpen, setIsHowItWorksOpen] = useState(false);

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

  const handleLocationSelect = useCallback(async (lat: number, lon: number) => {
    const loc = { lat, lon };
    setSelectedLocation(loc);
    selectedLocationRef.current = loc;
    setResult(null);
    setError(null);
    setAddressName("");

    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=fa`);
      const data = await res.json();
      if (data && data.address) {
        const addr = data.address;
        
        // City (تهران)
        const city = addr.city || addr.town || addr.state || "تهران";
        
        // Region (منطقه ۲)
        let regionText = "";
        const suburb = addr.suburb || addr.municipality || addr.city_district || "";
        const regionMatch = suburb.match(/منطقه\s*\d+/);
        if (regionMatch) {
          regionText = regionMatch[0]; // "منطقه ۲"
        }

        // Neighbourhood (کوی نصر / گیشا)
        const nb = addr.neighbourhood || addr.residential || "";

        // Road (هفدهم)
        const road = addr.road || "";

        // Plate (پلاک ۲۵۶)
        const plate = addr.house_number ? `پلاک ${toPersianDigits(addr.house_number)}` : "";

        // e.g. "تهران، منطقه ۲، کوی نصر، هفدهم، پلاک ۲۵۶"
        const addressParts = [city, regionText, nb, road, plate].filter(Boolean);
        setAddressName(addressParts.join("، "));
      }
    } catch (e) {
      console.error("Nominatim fetch failed", e);
    }
  }, []);

  const handleSubmit = useCallback(
    async (values: FormValues, overrideSlug?: string) => {
      const loc = selectedLocationRef.current || selectedLocation;
      if (!loc) return;

      setLastFormValues(values);
      setIsLoading(true);
      setError(null);

      try {
        const payload: Record<string, unknown> = {
          lat: loc.lat,
          lon: loc.lon,
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
          setError(data.detail || `خطای سرور: ${response.status}`);
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
            ? `اتصال به API در ${API_URL} ممکن نیست. NEXT_PUBLIC_API_URL را بررسی کنید.`
            : msg
        );
      } finally {
        setIsLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedLocation, usdRate]
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
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          flexWrap: "wrap",
          gap: "16px",
        }}
      >
        <div>
          <h1
            style={{
              fontSize: "clamp(1.4rem, 3vw, 2.2rem)",
              fontWeight: 900,
              lineHeight: 1.15,
              margin: 0,
            }}
          >
            ارزیاب هوشمند ملک{" "}
            <span className="gradient-text">تهران</span>
            {debugMode && (
              <span
                style={{
                  marginRight: "12px",
                  fontSize: "0.6rem",
                  fontWeight: 700,
                  letterSpacing: "0.08em",
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
          <p style={{ color: "#546e8a", fontSize: "0.82rem", marginTop: "6px", maxWidth: "560px", marginBottom: 0 }}>
            ارزیابی قیمت ملک با مدل XGBoost V2 · داده‌های مکانی BigQuery · سیگنال‌های اقتصادی زنده
          </p>
        </div>
        
        <button
          className="no-print"
          onClick={() => setIsHowItWorksOpen(true)}
          style={{
            display: "flex", alignItems: "center", gap: "6px",
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "12px",
            padding: "8px 16px",
            color: "#edf2f7",
            fontSize: "0.8rem",
            fontWeight: 700,
            cursor: "pointer",
            transition: "background 0.2s"
          }}
          onMouseOver={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.08)"}
          onMouseOut={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}
        >
          <Sparkles size={14} color="#2dd4bf" />
          <span>چگونه کار میکند؟</span>
        </button>
      </div>

      {/* ── Main Layout ── */}
      <div
        className="grid grid-cols-1 lg:grid-cols-[1fr_380px] px-4 md:px-6 pb-6 gap-4"
        style={{
          flex: 1,
          maxWidth: "1440px",
          overflowX: "hidden",
          margin: "0 auto",
          width: "100%",
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
            maxHeight: result ? "auto" : "clamp(380px, 52vh, 600px)",
          }}
          id="form-panel"
        >
          <PredictionForm
            selectedLocation={selectedLocation}
            onSubmit={handleSubmit}
            isLoading={isLoading}
            isLocked={!!result}
            onEdit={() => setResult(null)}
            resultData={result ? { region_id: result.region_id, neighborhood_name: result.neighborhood_name } : undefined}
            addressName={addressName}
          />
        </div>

        {/* Results panel — full width */}
        <div className="lg:col-span-2" id="results-panel">
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
        @media (max-width: 1024px) {
          #map-panel {
            height: clamp(300px, 50vw, 440px) !important;
          }
          #form-panel {
            max-height: none !important;
          }
        }
        @media print {
          @page {
            size: A4 portrait;
            margin: 0;
          }
          body, html {
            background: #0f1117 !important;
            color: #edf2f7 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            height: 100%;
            overflow: visible !important;
          }
          #main-grid {
            display: block !important;
            padding: 15px !important;
          }
          .glass-card {
            background: rgba(22, 27, 39, 1) !important;
            border: 1px solid rgba(255,255,255,0.07) !important;
            box-shadow: none !important;
            margin-bottom: 20px;
          }
          .no-print, #map-panel, nav, footer {
            display: none !important;
          }
          /* Prevent elements from page breaking awkwardly */
          .avoid-break {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          /* Force gradient backgrounds to print */
          .gradient-print {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>

      {/* ── Footer ── */}
      <footer className="no-print" style={{ textAlign: "center", padding: "20px", color: "#334155", fontSize: "0.7rem", borderTop: "1px solid rgba(255,255,255,0.02)", marginTop: "20px", opacity: 0.6 }}>
         developer contact: <a href="mailto:aliizadi27@gmail.com" style={{ color: "inherit", textDecoration: "none" }}>aliizadi27@gmail.com</a>
      </footer>

      {/* ── How it Works Modal ── */}
      {isHowItWorksOpen && (
        <div
          className="no-print"
          style={{
            position: "fixed",
            top: 0, left: 0, right: 0, bottom: 0,
            background: "rgba(15, 17, 23, 0.8)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
            animation: "fadeUp 0.3s cubic-bezier(0.4, 0, 0.2, 1) both",
          }}
          onClick={() => setIsHowItWorksOpen(false)}
        >
          <div
            style={{
              background: "#161b27",
              border: "1px solid rgba(245, 158, 11, 0.22)",
              borderRadius: "24px",
              maxWidth: "500px",
              width: "100%",
              padding: "32px",
              position: "relative",
              boxShadow: "0 20px 40px rgba(0,0,0,0.4), 0 0 40px rgba(245, 158, 11, 0.1)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setIsHowItWorksOpen(false)}
              style={{
                position: "absolute", top: "20px", right: "20px",
                background: "rgba(255,255,255,0.05)",
                border: "none",
                borderRadius: "50%",
                width: "32px", height: "32px",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#9ab0c7", cursor: "pointer",
                transition: "background 0.2s"
              }}
              onMouseOver={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.1)"}
              onMouseOut={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}
            >
              <X size={16} />
            </button>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "26px" }}>
              <Sparkles size={22} color="#f59e0b" />
              <h2 style={{ fontSize: "1.3rem", fontWeight: 900, margin: 0, color: "#edf2f7" }}>هوش مصنوعی چگونه قیمت را تخمین می‌زند؟</h2>
            </div>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "22px" }}>
              <div style={{ display: "flex", gap: "14px", alignItems: "flex-start" }}>
                <div style={{ background: "rgba(245,158,11,0.1)", padding: "10px", borderRadius: "12px", color: "#f59e0b" }}><TrendingUp size={20} /></div>
                <div>
                  <h3 style={{ fontSize: "1rem", fontWeight: 800, color: "#edf2f7", marginBottom: "4px", marginTop: "0" }}>شاخص‌های کلان (Macro)</h3>
                  <p style={{ fontSize: "0.82rem", color: "#9ab0c7", margin: 0, lineHeight: 1.6 }}>تورم، قیمت ارز، و ریسک‌های ژئوپلیتیک که پایه‌ی اقتصاد مسکن را تشکیل می‌دهند.</p>
                </div>
              </div>

              <div style={{ display: "flex", gap: "14px", alignItems: "flex-start" }}>
                <div style={{ background: "rgba(45,212,191,0.1)", padding: "10px", borderRadius: "12px", color: "#2dd4bf" }}><MapPin size={20} /></div>
                <div>
                  <h3 style={{ fontSize: "1rem", fontWeight: 800, color: "#edf2f7", marginBottom: "4px", marginTop: "0" }}>ویژگی‌های محلی (Location)</h3>
                  <p style={{ fontSize: "0.82rem", color: "#9ab0c7", margin: 0, lineHeight: 1.6 }}>فاصله تا مترو و بزرگراه، کیفیت هوا (AQI)، ریسک زلزله، قرارگیری در بافت فرسوده و طرح ترافیک.</p>
                </div>
              </div>

              <div style={{ display: "flex", gap: "14px", alignItems: "flex-start" }}>
                <div style={{ background: "rgba(249,115,22,0.1)", padding: "10px", borderRadius: "12px", color: "#f97316" }}><HomeIcon size={20} /></div>
                <div>
                  <h3 style={{ fontSize: "1rem", fontWeight: 800, color: "#edf2f7", marginBottom: "4px", marginTop: "0" }}>مشخصات ملکی (Property)</h3>
                  <p style={{ fontSize: "0.82rem", color: "#9ab0c7", margin: 0, lineHeight: 1.6 }}>متراژ، سن بنا، طبقه، آسانسور و پارکینگ که ضریب ارزش نهایی ملک را تعیین می‌کنند.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
