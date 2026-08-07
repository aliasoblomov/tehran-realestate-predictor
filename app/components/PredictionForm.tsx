"use client";

import { useState, useCallback, useEffect } from "react";
import {
  Home,
  Building2,
  Ruler,
  BedDouble,
  Calendar,
  Layers,
  CheckSquare,
  ChevronLeft,
  Loader2,
  Zap,
  MapPin,
  Check,
} from "lucide-react";
import { getTopCandidates, CandidateNeighborhood } from "../utils/neighborhoods";

// ─── Types ────────────────────────────────────────────────────────────────────
export interface FormValues {
  area: number;
  building_age: number;
  total_floors: number;
  floor_num: number;
  unit_per_floor: number;
  rooms_count: number;
  has_elevator: boolean;
  has_parking: boolean;
  is_villa: boolean;
}

interface PredictionFormProps {
  selectedLocation: { lat: number; lon: number } | null;
  onSubmit: (values: FormValues, selectedSlug?: string) => void;
  isLoading: boolean;
}

// ─── Step Definitions ─────────────────────────────────────────────────────────
type Step = "type" | "area" | "rooms" | "age" | "floors" | "amenities" | "review";

const STEPS: Step[] = ["type", "area", "rooms", "age", "floors", "amenities", "review"];

const STEP_META: Record<Step, { label: string; icon: React.ReactNode }> = {
  type:      { label: "Property Type", icon: <Home size={14} /> },
  area:      { label: "Area (m²)",     icon: <Ruler size={14} /> },
  rooms:     { label: "Bedrooms",      icon: <BedDouble size={14} /> },
  age:       { label: "Building Age",  icon: <Calendar size={14} /> },
  floors:    { label: "Floor Details", icon: <Layers size={14} /> },
  amenities: { label: "Amenities",     icon: <CheckSquare size={14} /> },
  review:    { label: "Review",        icon: <Zap size={14} /> },
};

// ─── Default Values ────────────────────────────────────────────────────────────
const DEFAULT: FormValues = {
  area: 100,
  building_age: 10,
  total_floors: 6,
  floor_num: 2,
  unit_per_floor: 2,
  rooms_count: 2,
  has_elevator: true,
  has_parking: true,
  is_villa: false,
};

// ─── Spinner ──────────────────────────────────────────────────────────────────
function Spinner() {
  return (
    <div
      style={{
        width: "18px",
        height: "18px",
        border: "2px solid rgba(255,255,255,0.2)",
        borderTopColor: "#fff",
        borderRadius: "50%",
        flexShrink: 0,
      }}
      className="animate-spin-slow"
    />
  );
}

// ─── Step Progress Bar ────────────────────────────────────────────────────────
function StepBar({ current }: { current: Step }) {
  const idx = STEPS.indexOf(current);
  const pct = ((idx) / (STEPS.length - 1)) * 100;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: "0.62rem", color: "#475569", fontWeight: 600 }}>
          Step {idx + 1} of {STEPS.length}
        </span>
        <span style={{ fontSize: "0.62rem", color: "#64748b" }}>
          {STEP_META[current].label}
        </span>
      </div>
      <div
        style={{
          height: "3px",
          borderRadius: "100px",
          background: "rgba(255,255,255,0.06)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            background: "linear-gradient(90deg, #f59e0b, #f97316)",
            borderRadius: "100px",
            transition: "width 0.4s cubic-bezier(0.4,0,0.2,1)",
          }}
        />
      </div>
    </div>
  );
}

// ─── Option Card ──────────────────────────────────────────────────────────────
interface OptionCardProps {
  icon: React.ReactNode;
  label: string;
  sub?: string;
  selected: boolean;
  onClick: () => void;
  id?: string;
}

function OptionCard({ icon, label, sub, selected, onClick, id }: OptionCardProps) {
  return (
    <button
      id={id}
      onClick={onClick}
      style={{
        background: selected
          ? "linear-gradient(135deg, rgba(245,158,11,0.12), rgba(249,115,22,0.08))"
          : "rgba(255,255,255,0.02)",
        border: selected
          ? "1.5px solid rgba(245,158,11,0.5)"
          : "1px solid rgba(255,255,255,0.06)",
        borderRadius: "14px",
        padding: "18px 14px",
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "8px",
        flex: 1,
        transition: "all 0.2s ease",
        color: selected ? "#f59e0b" : "#64748b",
        boxShadow: selected ? "0 0 16px rgba(245,158,11,0.15)" : "none",
        transform: selected ? "translateY(-1px)" : "none",
      }}
    >
      <div
        style={{
          width: "38px",
          height: "38px",
          borderRadius: "10px",
          background: selected ? "rgba(245,158,11,0.15)" : "rgba(255,255,255,0.04)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: selected ? "#f59e0b" : "#475569",
        }}
      >
        {icon}
      </div>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: "0.8rem", fontWeight: 700, color: selected ? "#f59e0b" : "#94a3b8" }}>
          {label}
        </div>
        {sub && (
          <div style={{ fontSize: "0.62rem", color: "#475569", marginTop: "2px" }}>
            {sub}
          </div>
        )}
      </div>
    </button>
  );
}

// ─── Pill Button ──────────────────────────────────────────────────────────────
function Pill({ label, selected, onClick, id }: { label: string; selected: boolean; onClick: () => void; id?: string }) {
  return (
    <button
      id={id}
      onClick={onClick}
      style={{
        background: selected ? "rgba(249,115,22,0.15)" : "rgba(255,255,255,0.03)",
        border: selected ? "1.5px solid rgba(249,115,22,0.5)" : "1px solid rgba(255,255,255,0.07)",
        borderRadius: "100px",
        padding: "8px 18px",
        cursor: "pointer",
        fontSize: "0.82rem",
        fontWeight: 700,
        color: selected ? "#f97316" : "#64748b",
        transition: "all 0.18s ease",
        transform: selected ? "scale(1.05)" : "scale(1)",
        boxShadow: selected ? "0 0 12px rgba(249,115,22,0.2)" : "none",
      }}
    >
      {label}
    </button>
  );
}

// ─── Toggle Amenity ───────────────────────────────────────────────────────────
function AmenityToggle({
  icon,
  label,
  sub,
  value,
  onChange,
  id,
}: {
  icon: React.ReactNode;
  label: string;
  sub?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  id?: string;
}) {
  return (
    <button
      id={id}
      onClick={() => onChange(!value)}
      style={{
        background: value ? "rgba(34,197,94,0.06)" : "rgba(255,255,255,0.02)",
        border: value ? "1.5px solid rgba(34,197,94,0.3)" : "1px solid rgba(255,255,255,0.06)",
        borderRadius: "12px",
        padding: "14px",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "10px",
        transition: "all 0.2s ease",
        width: "100%",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <div
          style={{
            width: "32px",
            height: "32px",
            borderRadius: "8px",
            background: value ? "rgba(34,197,94,0.12)" : "rgba(255,255,255,0.04)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: value ? "#22c55e" : "#475569",
          }}
        >
          {icon}
        </div>
        <div style={{ textAlign: "left" }}>
          <div style={{ fontSize: "0.8rem", fontWeight: 700, color: value ? "#22c55e" : "#94a3b8" }}>
            {label}
          </div>
          {sub && <div style={{ fontSize: "0.62rem", color: "#475569" }}>{sub}</div>}
        </div>
      </div>
      {/* Animated toggle */}
      <div
        className={`toggle-track ${value ? "active" : ""}`}
        style={{ width: "36px", height: "20px" }}
      >
        <div className="toggle-thumb" style={{ width: "12px", height: "12px" }} />
      </div>
    </button>
  );
}

// ─── Number Stepper ───────────────────────────────────────────────────────────
function Stepper({
  label,
  value,
  min,
  max,
  onChange,
  id,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  id?: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "6px",
        flex: 1,
      }}
    >
      <span style={{ fontSize: "0.65rem", color: "#64748b", fontWeight: 600 }}>{label}</span>
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <button
          onClick={() => onChange(Math.max(min, value - 1))}
          style={{
            width: "32px",
            height: "32px",
            borderRadius: "8px",
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.07)",
            color: "#94a3b8",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "1.1rem",
            fontWeight: 700,
          }}
        >
          −
        </button>
        <div
          id={id}
          style={{
            flex: 1,
            textAlign: "center",
            fontWeight: 800,
            fontSize: "1.1rem",
            color: "#f1f5f9",
            letterSpacing: "-0.02em",
          }}
        >
          {value}
        </div>
        <button
          onClick={() => onChange(Math.min(max, value + 1))}
          style={{
            width: "32px",
            height: "32px",
            borderRadius: "8px",
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.07)",
            color: "#94a3b8",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "1.1rem",
            fontWeight: 700,
          }}
        >
          +
        </button>
      </div>
    </div>
  );
}

// ─── Review Item ──────────────────────────────────────────────────────────────
function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "7px 0",
        borderBottom: "1px solid rgba(255,255,255,0.04)",
      }}
    >
      <span style={{ fontSize: "0.72rem", color: "#64748b" }}>{label}</span>
      <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "#94a3b8" }}>{value}</span>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function PredictionForm({
  selectedLocation,
  onSubmit,
  isLoading,
}: PredictionFormProps) {
  const [step, setStep] = useState<Step>("type");
  const [vals, setVals] = useState<FormValues>(DEFAULT);

  // Compute 3 closest candidate neighborhoods
  const candidates = selectedLocation
    ? getTopCandidates(selectedLocation.lat, selectedLocation.lon, 3)
    : [];

  const [selectedSlug, setSelectedSlug] = useState<string>("");

  useEffect(() => {
    if (candidates.length > 0) {
      // Pre-select the closest neighborhood by default
      setSelectedSlug(candidates[0].slug);
    } else {
      setSelectedSlug("");
    }
  }, [selectedLocation?.lat, selectedLocation?.lon]);

  const set = useCallback(<K extends keyof FormValues>(key: K, value: FormValues[K]) => {
    setVals((prev) => ({ ...prev, [key]: value }));
  }, []);

  const goNext = useCallback(() => {
    const idx = STEPS.indexOf(step);
    if (idx < STEPS.length - 1) setStep(STEPS[idx + 1]);
  }, [step]);

  const goPrev = useCallback(() => {
    const idx = STEPS.indexOf(step);
    if (idx > 0) setStep(STEPS[idx - 1]);
  }, [step]);

  const canProceed = !!selectedLocation;

  // Age segmented options
  const AGE_OPTIONS = [
    { label: "Brand New", value: 0 },
    { label: "1–5 yr", value: 3 },
    { label: "5–15 yr", value: 10 },
    { label: "15+ yr", value: 20 },
  ];

  const stepContent: Record<Step, React.ReactNode> = {
    // ── Step 1: Property Type ────────────────────────────────────────────────
    type: (
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <div style={{ fontSize: "1rem", fontWeight: 800, color: "#f1f5f9" }}>
          What type of property?
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <OptionCard
            id="type-apartment"
            icon={<Building2 size={22} />}
            label="Apartment"
            sub="Multi-unit building"
            selected={!vals.is_villa}
            onClick={() => { set("is_villa", false); setTimeout(goNext, 180); }}
          />
          <OptionCard
            id="type-villa"
            icon={<Home size={22} />}
            label="Villa"
            sub="Stand-alone house"
            selected={vals.is_villa}
            onClick={() => { set("is_villa", true); setTimeout(goNext, 180); }}
          />
        </div>
      </div>
    ),

    // ── Step 2: Area ─────────────────────────────────────────────────────────
    area: (
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <div style={{ fontSize: "1rem", fontWeight: 800, color: "#f1f5f9" }}>
          What's the area?
        </div>
        <div
          style={{
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: "14px",
            padding: "20px",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
          }}
        >
          <div style={{ display: "flex", alignItems: "baseline", gap: "8px", justifyContent: "center" }}>
            <input
              id="area-input"
              type="number"
              value={vals.area}
              min={20}
              max={1000}
              onChange={(e) => set("area", Number(e.target.value))}
              className="form-input"
              style={{
                fontSize: "2rem",
                fontWeight: 900,
                textAlign: "center",
                letterSpacing: "-0.03em",
                padding: "8px 12px",
                maxWidth: "160px",
                color: "#f59e0b",
              }}
            />
            <span style={{ fontSize: "1rem", color: "#64748b", fontWeight: 600 }}>m²</span>
          </div>
          <input
            id="area-slider"
            type="range"
            min={20}
            max={1000}
            step={5}
            value={vals.area}
            onChange={(e) => set("area", Number(e.target.value))}
            style={{ width: "100%", accentColor: "#f59e0b", cursor: "pointer", height: "4px" }}
          />
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            {[50, 100, 150, 200, 300].map((v) => (
              <button
                key={v}
                id={`area-quick-${v}`}
                onClick={() => set("area", v)}
                style={{
                  background: vals.area === v ? "rgba(245,158,11,0.12)" : "rgba(255,255,255,0.03)",
                  border: vals.area === v ? "1px solid rgba(245,158,11,0.4)" : "1px solid rgba(255,255,255,0.06)",
                  borderRadius: "8px",
                  padding: "4px 8px",
                  cursor: "pointer",
                  fontSize: "0.65rem",
                  fontWeight: 600,
                  color: vals.area === v ? "#f59e0b" : "#64748b",
                }}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      </div>
    ),

    // ── Step 3: Rooms ─────────────────────────────────────────────────────────
    rooms: (
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <div style={{ fontSize: "1rem", fontWeight: 800, color: "#f1f5f9" }}>
          How many bedrooms?
        </div>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <Pill
              key={n}
              id={`rooms-${n}`}
              label={n === 5 ? "5+" : String(n)}
              selected={vals.rooms_count === n}
              onClick={() => { set("rooms_count", n); setTimeout(goNext, 180); }}
            />
          ))}
        </div>
      </div>
    ),

    // ── Step 4: Age ───────────────────────────────────────────────────────────
    age: (
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <div style={{ fontSize: "1rem", fontWeight: 800, color: "#f1f5f9" }}>
          How old is the building?
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
          {AGE_OPTIONS.map((opt) => (
            <button
              key={opt.label}
              id={`age-${opt.label.toLowerCase().replace(/\s+/g, "-")}`}
              onClick={() => { set("building_age", opt.value); setTimeout(goNext, 180); }}
              style={{
                background: vals.building_age === opt.value
                  ? "rgba(245,158,11,0.1)"
                  : "rgba(255,255,255,0.02)",
                border: vals.building_age === opt.value
                  ? "1.5px solid rgba(245,158,11,0.45)"
                  : "1px solid rgba(255,255,255,0.06)",
                borderRadius: "12px",
                padding: "14px",
                cursor: "pointer",
                fontSize: "0.82rem",
                fontWeight: 700,
                color: vals.building_age === opt.value ? "#f59e0b" : "#64748b",
                transition: "all 0.18s ease",
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "0.65rem", color: "#475569" }}>Or enter exact:</span>
          <input
            id="age-exact"
            type="number"
            value={vals.building_age}
            min={0}
            max={80}
            onChange={(e) => set("building_age", Number(e.target.value))}
            className="form-input"
            style={{ maxWidth: "80px", padding: "6px 10px", fontSize: "0.85rem" }}
          />
          <span style={{ fontSize: "0.65rem", color: "#475569" }}>years</span>
        </div>
      </div>
    ),

    // ── Step 5: Floors ────────────────────────────────────────────────────────
    floors: (
      <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        <div style={{ fontSize: "1rem", fontWeight: 800, color: "#f1f5f9" }}>
          Floor details
        </div>
        <div style={{ display: "flex", gap: "12px" }}>
          <Stepper
            label="Total Floors"
            id="total-floors"
            value={vals.total_floors}
            min={1}
            max={40}
            onChange={(v) => set("total_floors", v)}
          />
          <div style={{ width: "1px", background: "rgba(255,255,255,0.05)", alignSelf: "stretch" }} />
          <Stepper
            label="Your Floor"
            id="floor-num"
            value={vals.floor_num}
            min={0}
            max={vals.total_floors}
            onChange={(v) => set("floor_num", Math.min(v, vals.total_floors))}
          />
          <div style={{ width: "1px", background: "rgba(255,255,255,0.05)", alignSelf: "stretch" }} />
          <Stepper
            label="Units/Floor"
            id="unit-per-floor"
            value={vals.unit_per_floor}
            min={1}
            max={10}
            onChange={(v) => set("unit_per_floor", v)}
          />
        </div>
      </div>
    ),

    // ── Step 6: Amenities ─────────────────────────────────────────────────────
    amenities: (
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        <div style={{ fontSize: "1rem", fontWeight: 800, color: "#f1f5f9" }}>
          Amenities
        </div>
        <AmenityToggle
          id="toggle-elevator"
          icon={<Layers size={15} />}
          label="Elevator"
          sub="Impacts floor premium significantly"
          value={vals.has_elevator}
          onChange={(v) => set("has_elevator", v)}
        />
        <AmenityToggle
          id="toggle-parking"
          icon={
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="7" width="20" height="15" rx="2" />
              <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
            </svg>
          }
          label="Parking"
          sub="Dedicated parking spot"
          value={vals.has_parking}
          onChange={(v) => set("has_parking", v)}
        />
      </div>
    ),

    // ── Step 7: Review ────────────────────────────────────────────────────────
    review: (
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <div style={{ fontSize: "1rem", fontWeight: 800, color: "#f1f5f9" }}>
          Ready to Valuate
        </div>

        {/* ── Neighborhood Disambiguation (Top 3 Candidates) ── */}
        {selectedLocation && candidates.length > 0 && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "8px",
              background: "rgba(249, 115, 22, 0.06)",
              border: "1.5px solid rgba(249, 115, 22, 0.3)",
              borderRadius: "12px",
              padding: "12px 14px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <MapPin size={13} color="#f97316" />
                <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#f97316" }}>
                  Select Neighborhood (3 Closest)
                </span>
              </div>
              <span style={{ fontSize: "0.62rem", color: "#94a3b8" }}>
                Coordinates match
              </span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {candidates.map((c, idx) => {
                const isSelected = (selectedSlug ? selectedSlug === c.slug : idx === 0);
                return (
                  <button
                    key={c.slug}
                    type="button"
                    onClick={() => setSelectedSlug(c.slug)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      background: isSelected
                        ? "linear-gradient(135deg, rgba(249,115,22,0.2), rgba(245,158,11,0.12))"
                        : "rgba(255,255,255,0.03)",
                      border: isSelected
                        ? "1.5px solid #f97316"
                        : "1px solid rgba(255,255,255,0.06)",
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <div
                        style={{
                          width: "14px",
                          height: "14px",
                          borderRadius: "50%",
                          border: isSelected ? "4px solid #f97316" : "1.5px solid #64748b",
                          background: isSelected ? "#fff" : "transparent",
                          flexShrink: 0,
                        }}
                      />
                      <div>
                        <span
                          style={{
                            fontSize: "0.78rem",
                            fontWeight: isSelected ? 700 : 500,
                            color: isSelected ? "#f8fafc" : "#94a3b8",
                          }}
                        >
                          {c.name}
                        </span>
                        {idx === 0 && (
                          <span
                            style={{
                              marginLeft: "6px",
                              fontSize: "0.58rem",
                              fontWeight: 700,
                              background: "rgba(34,197,94,0.15)",
                              color: "#22c55e",
                              border: "1px solid rgba(34,197,94,0.3)",
                              borderRadius: "4px",
                              padding: "1px 5px",
                            }}
                          >
                            Closest
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ textAlign: "right", fontSize: "0.65rem", color: isSelected ? "#f97316" : "#64748b" }}>
                      <span>{c.distance_km} km</span>
                      <span style={{ marginLeft: "4px", opacity: 0.7 }}>· Region {c.region_id}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div
          style={{
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.05)",
            borderRadius: "12px",
            padding: "14px",
          }}
        >
          <ReviewRow label="Type"         value={vals.is_villa ? "Villa" : "Apartment"} />
          <ReviewRow label="Area"         value={`${vals.area} m²`} />
          <ReviewRow label="Bedrooms"     value={String(vals.rooms_count)} />
          <ReviewRow label="Building Age" value={`${vals.building_age} yr`} />
          <ReviewRow label="Floor"        value={`${vals.floor_num} / ${vals.total_floors}`} />
          <ReviewRow label="Units/Floor"  value={String(vals.unit_per_floor)} />
          <ReviewRow label="Elevator"     value={vals.has_elevator ? "✓ Yes" : "✗ No"} />
          <ReviewRow label="Parking"      value={vals.has_parking ? "✓ Yes" : "✗ No"} />
        </div>
        {selectedLocation && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "0.68rem",
              color: "#2dd4bf",
            }}
          >
            <MapPin size={11} />
            <span>
              {selectedLocation.lat.toFixed(5)}, {selectedLocation.lon.toFixed(5)}
            </span>
          </div>
        )}
      </div>
    ),
  };

  const isReview = step === "review";
  const isFirst  = step === "type";

  const activeSlug = selectedSlug || (candidates.length > 0 ? candidates[0].slug : undefined);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "14px",
        height: "100%",
      }}
    >
      {/* Progress */}
      <StepBar current={step} />

      {/* Location guard */}
      {!selectedLocation && (
        <div
          style={{
            background: "rgba(245,158,11,0.06)",
            border: "1px solid rgba(245,158,11,0.2)",
            borderRadius: "10px",
            padding: "10px 12px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            fontSize: "0.72rem",
            color: "#f59e0b",
          }}
        >
          <MapPin size={13} color="#f59e0b" />
          Drop a pin on the map first
        </div>
      )}

      {/* Step content */}
      <div
        key={step}
        style={{
          flex: 1,
          animation: "fadeUp 0.3s cubic-bezier(0.4,0,0.2,1) both",
          overflowY: "auto",
        }}
      >
        {stepContent[step]}
      </div>

      {/* Nav buttons */}
      <div style={{ display: "flex", gap: "8px", marginTop: "auto" }}>
        {!isFirst && (
          <button
            onClick={goPrev}
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: "10px",
              padding: "11px 16px",
              cursor: "pointer",
              color: "#64748b",
              display: "flex",
              alignItems: "center",
              gap: "4px",
              fontSize: "0.8rem",
              fontWeight: 600,
            }}
          >
            <ChevronLeft size={14} />
            Back
          </button>
        )}

        {!isReview && (
          <button
            onClick={goNext}
            style={{
              flex: 1,
              background: "rgba(249,115,22,0.08)",
              border: "1px solid rgba(249,115,22,0.25)",
              borderRadius: "10px",
              padding: "11px",
              cursor: "pointer",
              color: "#f97316",
              fontSize: "0.82rem",
              fontWeight: 700,
              transition: "all 0.2s ease",
            }}
          >
            Continue →
          </button>
        )}

        {isReview && (
          <button
            id="submit-valuation"
            onClick={() => canProceed && !isLoading && onSubmit(vals, activeSlug)}
            disabled={!canProceed || isLoading}
            className="btn-gold"
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              fontSize: "0.88rem",
              padding: "13px",
            }}
          >
            {isLoading ? (
              <>
                <Spinner />
                Calculating...
              </>
            ) : (
              <>
                <Zap size={15} />
                Get Valuation
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
