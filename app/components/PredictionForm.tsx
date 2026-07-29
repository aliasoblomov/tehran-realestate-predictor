"use client";

import { useState, useEffect } from "react";
import {
  Home,
  Layers,
  Clock,
  Users,
  Zap,
  Car,
  Package,
  RefreshCw,
  Building2,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Loader2,
  Edit3,
  MapPin,
} from "lucide-react";
import { getTopCandidates, CandidateNeighborhood } from "../utils/neighborhoods";

export interface FormValues {
  area: number;
  building_age: number;
  total_floors: number;
  floor_num: number;
  unit_per_floor: number;
  rooms_count: number;
  has_elevator: boolean;
  has_parking: boolean;
  has_warehouse: boolean;
  is_rebuilt: boolean;
  is_villa: boolean;
}

interface PredictionFormProps {
  selectedLocation: { lat: number; lon: number } | null;
  onSubmit: (values: FormValues, selectedSlug?: string) => void;
  isLoading: boolean;
}

interface ToggleProps {
  label: string;
  icon: React.ReactNode;
  value: boolean;
  onChange: (v: boolean) => void;
}

function BigToggle({ label, icon, value, onChange }: ToggleProps) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "12px",
        background: value
          ? "linear-gradient(145deg, rgba(249,115,22,0.15) 0%, rgba(249,115,22,0.05) 100%)"
          : "rgba(255, 255, 255, 0.02)",
        border: `1px solid ${value ? "rgba(249,115,22,0.4)" : "rgba(255, 255, 255, 0.06)"}`,
        borderRadius: "16px",
        padding: "20px 16px",
        cursor: "pointer",
        transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
        width: "100%",
        position: "relative",
        overflow: "hidden"
      }}
      className={value ? "shadow-[0_0_20px_rgba(249,115,22,0.15)]" : ""}
    >
      <div style={{ 
        color: value ? "#f97316" : "#64748b",
        transform: value ? "scale(1.1)" : "scale(1)",
        transition: "all 0.3s"
      }}>
        {icon}
      </div>
      <span
        style={{
          fontSize: "0.85rem",
          fontWeight: 600,
          color: value ? "#f1f5f9" : "#94a3b8",
        }}
      >
        {label}
      </span>
      {value && (
        <div style={{ position: "absolute", top: "8px", right: "8px", color: "#f97316" }}>
          <CheckCircle2 size={14} />
        </div>
      )}
    </button>
  );
}

interface NumberInputProps {
  label: string;
  icon: React.ReactNode;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  unit?: string;
  large?: boolean;
}

function BigNumberInput({
  label,
  icon,
  value,
  onChange,
  min = 0,
  max = 9999,
  unit,
  large = false
}: NumberInputProps) {
  return (
    <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "16px", padding: "16px", flex: 1 }}>
      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          marginBottom: "12px",
          fontSize: "0.8rem",
          fontWeight: 600,
          color: "#94a3b8",
        }}
      >
        <span style={{ color: "#f97316" }}>{icon}</span>
        {label}
      </label>
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <input
          type="number"
          value={value || ""}
          min={min}
          max={max}
          onChange={(e) => {
            const v = parseFloat(e.target.value);
            if (!isNaN(v)) onChange(Math.max(min, Math.min(max, v)));
            else if (e.target.value === "") onChange(0);
          }}
          style={{
            background: "transparent",
            border: "none",
            color: "#f1f5f9",
            fontSize: large ? "2.5rem" : "1.5rem",
            fontWeight: 800,
            width: "100%",
            outline: "none",
            letterSpacing: "-0.03em"
          }}
          placeholder="0"
        />
        {unit && (
          <span style={{ fontSize: "1rem", color: "#64748b", fontWeight: 600, paddingRight: "12px" }}>
            {unit}
          </span>
        )}
      </div>
    </div>
  );
}

export default function PredictionForm({
  selectedLocation,
  onSubmit,
  isLoading,
}: PredictionFormProps) {
  const [step, setStep] = useState(1);
  const [values, setValues] = useState<FormValues>({
    area: 100,
    building_age: 5,
    total_floors: 6,
    floor_num: 3,
    unit_per_floor: 2,
    rooms_count: 2,
    has_elevator: true,
    has_parking: true,
    has_warehouse: false,
    is_rebuilt: false,
    is_villa: false,
  });

  const [selectedSlug, setSelectedSlug] = useState<string>("");

  const candidates: CandidateNeighborhood[] = selectedLocation
    ? getTopCandidates(selectedLocation.lat, selectedLocation.lon)
    : [];

  useEffect(() => {
    if (selectedLocation) {
      const top = getTopCandidates(selectedLocation.lat, selectedLocation.lon);
      if (top.length > 0) {
        setSelectedSlug(top[0].slug);
      }
    } else {
      setSelectedSlug("");
    }
  }, [selectedLocation]);

  const set = (key: keyof FormValues) => (v: boolean | number) =>
    setValues((prev) => ({ ...prev, [key]: v }));

  const canSubmit = !!selectedLocation && values.area > 0 && !isLoading;

  const nextStep = () => setStep(s => Math.min(4, s + 1));
  const prevStep = () => setStep(s => Math.max(1, s - 1));

  const SummaryRow = ({ label, value, onEdit }: { label: string, value: string, onEdit: () => void }) => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
      <span style={{ color: "#94a3b8", fontSize: "0.85rem" }}>{label}</span>
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <span style={{ color: "#f1f5f9", fontWeight: 600, fontSize: "0.9rem" }}>{value}</span>
        <button onClick={onEdit} style={{ background: "none", border: "none", color: "#f97316", cursor: "pointer", padding: "4px" }}>
          <Edit3 size={14} />
        </button>
      </div>
    </div>
  );

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflowX: "hidden",
      }}
    >
      {/* Wizard Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {[1, 2, 3, 4].map(idx => (
            <div
              key={idx}
              style={{
                width: step === idx ? "24px" : "8px",
                height: "4px",
                borderRadius: "4px",
                background: step >= idx ? "#f97316" : "rgba(255,255,255,0.1)",
                transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
              }}
            />
          ))}
        </div>
        <div style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 600, letterSpacing: "0.05em" }}>
          STEP {step} OF 4
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", paddingRight: "4px" }} className="animate-fadeUp" key={step}>
        
        {step === 1 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            <div>
              <h2 style={{ fontSize: "1.4rem", fontWeight: 800, color: "#f1f5f9", margin: "0 0 6px" }}>Core Details</h2>
              <p style={{ fontSize: "0.85rem", color: "#94a3b8", margin: 0 }}>Start with the primary characteristics of the property.</p>
            </div>
            
            <BigNumberInput label="Total Area" icon={<Home size={16} />} value={values.area} onChange={set("area") as (v: number) => void} unit="m²" large={true} />
            
            <div style={{ display: "flex", gap: "16px" }}>
              <BigNumberInput label="Rooms" icon={<Building2 size={14} />} value={values.rooms_count} onChange={set("rooms_count") as (v: number) => void} />
              <BigNumberInput label="Age" icon={<Clock size={14} />} value={values.building_age} onChange={set("building_age") as (v: number) => void} unit="yrs" />
            </div>
          </div>
        )}

        {step === 2 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            <div>
              <h2 style={{ fontSize: "1.4rem", fontWeight: 800, color: "#f1f5f9", margin: "0 0 6px" }}>Floor & Building</h2>
              <p style={{ fontSize: "0.85rem", color: "#94a3b8", margin: 0 }}>Provide details about the building structure.</p>
            </div>
            
            <BigNumberInput label="Property Floor Number" icon={<ChevronUp size={16} />} value={values.floor_num} onChange={set("floor_num") as (v: number) => void} large={true} />
            
            <div style={{ display: "flex", gap: "16px" }}>
              <BigNumberInput label="Total Floors" icon={<Layers size={14} />} value={values.total_floors} onChange={set("total_floors") as (v: number) => void} />
              <BigNumberInput label="Units / Floor" icon={<Users size={14} />} value={values.unit_per_floor} onChange={set("unit_per_floor") as (v: number) => void} />
            </div>
          </div>
        )}

        {step === 3 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            <div>
              <h2 style={{ fontSize: "1.4rem", fontWeight: 800, color: "#f1f5f9", margin: "0 0 6px" }}>Amenities & Flags</h2>
              <p style={{ fontSize: "0.85rem", color: "#94a3b8", margin: 0 }}>Select all options that apply to this property.</p>
            </div>
            
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <BigToggle label="Elevator" icon={<Zap size={24} />} value={values.has_elevator} onChange={set("has_elevator") as (v: boolean) => void} />
              <BigToggle label="Parking" icon={<Car size={24} />} value={values.has_parking} onChange={set("has_parking") as (v: boolean) => void} />
              <BigToggle label="Warehouse" icon={<Package size={24} />} value={values.has_warehouse} onChange={set("has_warehouse") as (v: boolean) => void} />
              <BigToggle label="Rebuilt" icon={<RefreshCw size={24} />} value={values.is_rebuilt} onChange={set("is_rebuilt") as (v: boolean) => void} />
            </div>
            <BigToggle label="Villa / House Property" icon={<Home size={24} />} value={values.is_villa} onChange={set("is_villa") as (v: boolean) => void} />
          </div>
        )}

        {step === 4 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <div>
              <h2 style={{ fontSize: "1.4rem", fontWeight: 800, color: "#f1f5f9", margin: "0 0 6px" }}>Summary</h2>
              <p style={{ fontSize: "0.85rem", color: "#94a3b8", margin: 0 }}>Review your inputs before valuation.</p>
            </div>
            
            <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "16px", padding: "8px 20px" }}>
              <SummaryRow label="Location Pinned" value={selectedLocation ? "Yes" : "No"} onEdit={() => {}} />
              <SummaryRow label="Area & Rooms" value={`${values.area}m², ${values.rooms_count} Rooms`} onEdit={() => setStep(1)} />
              <SummaryRow label="Floor Info" value={`Floor ${values.floor_num} of ${values.total_floors}`} onEdit={() => setStep(2)} />
              <SummaryRow label="Amenities" value={[
                values.has_elevator && "Elevator",
                values.has_parking && "Parking",
                values.has_warehouse && "Storage",
                values.is_rebuilt && "Rebuilt",
                values.is_villa && "Villa"
              ].filter(Boolean).join(", ") || "None"} onEdit={() => setStep(3)} />
            </div>

            {selectedLocation && candidates.length > 0 && (
              <div
                style={{
                  background: "rgba(249, 115, 22, 0.08)",
                  border: "1px solid rgba(249, 115, 22, 0.3)",
                  borderRadius: "14px",
                  padding: "14px 16px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#f97316", fontWeight: 700, fontSize: "0.82rem" }}>
                  <MapPin size={14} /> Candidate Neighborhood (3 Closest Match)
                </div>
                <select
                  value={selectedSlug}
                  onChange={(e) => setSelectedSlug(e.target.value)}
                  style={{
                    background: "#0f172a",
                    border: "1px solid rgba(249, 115, 22, 0.5)",
                    borderRadius: "8px",
                    color: "#f8fafc",
                    fontSize: "0.82rem",
                    fontWeight: 600,
                    padding: "10px 12px",
                    width: "100%",
                    cursor: "pointer",
                    outline: "none",
                  }}
                >
                  {candidates.map((c) => (
                    <option key={c.slug} value={c.slug}>
                      {c.name} ({c.distance_km} km) · Region {c.region_id}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {!selectedLocation && (
              <div style={{ padding: "12px", borderRadius: "8px", background: "rgba(249,115,22,0.1)", color: "#f97316", fontSize: "0.85rem", display: "flex", alignItems: "center", gap: "8px" }}>
                <MapPin size={16} /> Please pin a location on the map.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer Navigation */}
      <div style={{ display: "flex", gap: "12px", marginTop: "24px", paddingTop: "20px", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
        {step > 1 && (
          <button
            onClick={prevStep}
            style={{
              padding: "14px 20px",
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "12px",
              color: "#f1f5f9",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.2s"
            }}
          >
            <ChevronLeft size={18} />
          </button>
        )}
        
        {step < 4 ? (
          <button
            onClick={nextStep}
            style={{
              flex: 1,
              padding: "14px",
              background: "#f1f5f9",
              border: "none",
              borderRadius: "12px",
              color: "#0f172a",
              fontWeight: 700,
              fontSize: "0.95rem",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              boxShadow: "0 4px 12px rgba(255,255,255,0.1)"
            }}
          >
            Next Step <ChevronRight size={18} />
          </button>
        ) : (
          <button
            disabled={!canSubmit}
            onClick={() => onSubmit(values, selectedSlug)}
            style={{
              flex: 1,
              padding: "14px",
              background: canSubmit ? "linear-gradient(135deg, #f97316, #ea580c)" : "rgba(255,255,255,0.05)",
              border: "none",
              borderRadius: "12px",
              color: canSubmit ? "#ffffff" : "#64748b",
              fontWeight: 700,
              fontSize: "0.95rem",
              cursor: canSubmit ? "pointer" : "not-allowed",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              boxShadow: canSubmit ? "0 4px 20px rgba(249,115,22,0.4)" : "none",
              transition: "all 0.3s"
            }}
          >
            {isLoading ? (
              <><Loader2 size={18} className="animate-spin-slow" /> Valuing Property...</>
            ) : (
              <><Zap size={18} /> Generate Valuation</>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
