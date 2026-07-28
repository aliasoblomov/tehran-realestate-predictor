"use client";

import { useState } from "react";
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
  MapPin,
  Loader2,
} from "lucide-react";

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
  onSubmit: (values: FormValues) => void;
  isLoading: boolean;
}

interface ToggleProps {
  label: string;
  icon: React.ReactNode;
  value: boolean;
  onChange: (v: boolean) => void;
  id: string;
}

function Toggle({ label, icon, value, onChange, id }: ToggleProps) {
  return (
    <button
      id={id}
      type="button"
      onClick={() => onChange(!value)}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "12px",
        background: value
          ? "rgba(245, 158, 11, 0.08)"
          : "rgba(255, 255, 255, 0.03)",
        border: `1px solid ${value ? "rgba(245, 158, 11, 0.3)" : "rgba(255, 255, 255, 0.06)"}`,
        borderRadius: "10px",
        padding: "10px 12px",
        cursor: "pointer",
        transition: "all 0.2s",
        width: "100%",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <span style={{ color: value ? "#f59e0b" : "#475569", transition: "color 0.2s" }}>
          {icon}
        </span>
        <span
          style={{
            fontSize: "0.8rem",
            fontWeight: 500,
            color: value ? "#f1f5f9" : "#94a3b8",
            transition: "color 0.2s",
          }}
        >
          {label}
        </span>
      </div>
      <div className={`toggle-track ${value ? "active" : ""}`}>
        <div className="toggle-thumb" />
      </div>
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
  id: string;
}

function NumberInput({
  label,
  icon,
  value,
  onChange,
  min = 0,
  max = 9999,
  unit,
  id,
}: NumberInputProps) {
  return (
    <div>
      <label
        htmlFor={id}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          marginBottom: "6px",
          fontSize: "0.75rem",
          fontWeight: 600,
          color: "#64748b",
          letterSpacing: "0.04em",
          textTransform: "uppercase",
        }}
      >
        <span style={{ color: "#f59e0b" }}>{icon}</span>
        {label}
      </label>
      <div style={{ position: "relative" }}>
        <input
          id={id}
          type="number"
          className="form-input"
          value={value || ""}
          min={min}
          max={max}
          placeholder="0"
          onChange={(e) => {
            const v = parseFloat(e.target.value);
            if (!isNaN(v)) onChange(Math.max(min, Math.min(max, v)));
            else if (e.target.value === "") onChange(0);
          }}
          style={{ paddingRight: unit ? "52px" : "14px" }}
        />
        {unit && (
          <div
            style={{
              position: "absolute",
              right: "12px",
              top: "50%",
              transform: "translateY(-50%)",
              fontSize: "0.7rem",
              color: "#475569",
              fontWeight: 600,
              pointerEvents: "none",
            }}
          >
            {unit}
          </div>
        )}
        {/* Stepper arrows */}
        <div
          style={{
            position: "absolute",
            right: unit ? "46px" : "8px",
            top: "50%",
            transform: "translateY(-50%)",
            display: "flex",
            flexDirection: "column",
            gap: "1px",
          }}
        >
          <button
            type="button"
            onClick={() => onChange(Math.min(max, value + 1))}
            style={{
              background: "none",
              border: "none",
              padding: "1px",
              cursor: "pointer",
              color: "#475569",
              display: "flex",
              alignItems: "center",
              transition: "color 0.15s",
            }}
            onMouseOver={(e) =>
              ((e.currentTarget as HTMLButtonElement).style.color = "#f59e0b")
            }
            onMouseOut={(e) =>
              ((e.currentTarget as HTMLButtonElement).style.color = "#475569")
            }
          >
            <ChevronUp size={12} />
          </button>
          <button
            type="button"
            onClick={() => onChange(Math.max(min, value - 1))}
            style={{
              background: "none",
              border: "none",
              padding: "1px",
              cursor: "pointer",
              color: "#475569",
              display: "flex",
              alignItems: "center",
              transition: "color 0.15s",
            }}
            onMouseOver={(e) =>
              ((e.currentTarget as HTMLButtonElement).style.color = "#f59e0b")
            }
            onMouseOut={(e) =>
              ((e.currentTarget as HTMLButtonElement).style.color = "#475569")
            }
          >
            <ChevronDown size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PredictionForm({
  selectedLocation,
  onSubmit,
  isLoading,
}: PredictionFormProps) {
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

  const set = (key: keyof FormValues) => (v: boolean | number) =>
    setValues((prev) => ({ ...prev, [key]: v }));

  const canSubmit =
    !!selectedLocation &&
    values.area > 0 &&
    !isLoading;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "20px",
        height: "100%",
        overflowY: "auto",
        overflowX: "hidden",
        paddingRight: "2px",
      }}
    >
      {/* Location status */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          padding: "12px 14px",
          borderRadius: "10px",
          background: selectedLocation
            ? "rgba(45, 212, 191, 0.08)"
            : "rgba(71, 85, 105, 0.15)",
          border: `1px solid ${selectedLocation ? "rgba(45, 212, 191, 0.25)" : "rgba(255, 255, 255, 0.06)"}`,
          transition: "all 0.3s",
        }}
      >
        <MapPin
          size={16}
          color={selectedLocation ? "#2dd4bf" : "#475569"}
          style={{ flexShrink: 0 }}
        />
        <div>
          {selectedLocation ? (
            <>
              <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "#2dd4bf" }}>
                Location pinned ✓
              </div>
              <div style={{ fontSize: "0.68rem", color: "#64748b", marginTop: "1px" }}>
                {selectedLocation.lat.toFixed(4)}° N, {selectedLocation.lon.toFixed(4)}° E
              </div>
            </>
          ) : (
            <div style={{ fontSize: "0.75rem", color: "#475569", fontWeight: 500 }}>
              Pin a location on the map first
            </div>
          )}
        </div>
      </div>

      {/* Physical Properties */}
      <div>
        <div
          style={{
            fontSize: "0.65rem",
            fontWeight: 700,
            color: "#475569",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            marginBottom: "12px",
          }}
        >
          Property Details
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          <NumberInput
            id="input-area"
            label="Area"
            icon={<Home size={12} />}
            value={values.area}
            onChange={set("area") as (v: number) => void}
            min={20}
            max={5000}
            unit="m²"
          />
          <NumberInput
            id="input-rooms"
            label="Rooms"
            icon={<Building2 size={12} />}
            value={values.rooms_count}
            onChange={set("rooms_count") as (v: number) => void}
            min={1}
            max={20}
          />
          <NumberInput
            id="input-age"
            label="Building Age"
            icon={<Clock size={12} />}
            value={values.building_age}
            onChange={set("building_age") as (v: number) => void}
            min={0}
            max={100}
            unit="yrs"
          />
          <NumberInput
            id="input-total-floors"
            label="Total Floors"
            icon={<Layers size={12} />}
            value={values.total_floors}
            onChange={set("total_floors") as (v: number) => void}
            min={1}
            max={60}
          />
          <NumberInput
            id="input-floor-num"
            label="Floor Number"
            icon={<ChevronUp size={12} />}
            value={values.floor_num}
            onChange={set("floor_num") as (v: number) => void}
            min={0}
            max={60}
          />
          <NumberInput
            id="input-units"
            label="Units/Floor"
            icon={<Users size={12} />}
            value={values.unit_per_floor}
            onChange={set("unit_per_floor") as (v: number) => void}
            min={1}
            max={20}
          />
        </div>
      </div>

      {/* Amenities */}
      <div>
        <div
          style={{
            fontSize: "0.65rem",
            fontWeight: 700,
            color: "#475569",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            marginBottom: "12px",
          }}
        >
          Amenities & Flags
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
            <Toggle
              id="toggle-elevator"
              label="Elevator"
              icon={<Zap size={13} />}
              value={values.has_elevator}
              onChange={set("has_elevator") as (v: boolean) => void}
            />
            <Toggle
              id="toggle-parking"
              label="Parking"
              icon={<Car size={13} />}
              value={values.has_parking}
              onChange={set("has_parking") as (v: boolean) => void}
            />
            <Toggle
              id="toggle-warehouse"
              label="Warehouse"
              icon={<Package size={13} />}
              value={values.has_warehouse}
              onChange={set("has_warehouse") as (v: boolean) => void}
            />
            <Toggle
              id="toggle-rebuilt"
              label="Rebuilt"
              icon={<RefreshCw size={13} />}
              value={values.is_rebuilt}
              onChange={set("is_rebuilt") as (v: boolean) => void}
            />
          </div>
          <Toggle
            id="toggle-villa"
            label="Villa Property"
            icon={<Building2 size={13} />}
            value={values.is_villa}
            onChange={set("is_villa") as (v: boolean) => void}
          />
        </div>
      </div>

      {/* Submit */}
      <button
        id="btn-predict"
        type="button"
        className="btn-gold"
        disabled={!canSubmit}
        onClick={() => onSubmit(values)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "10px",
          fontSize: "0.95rem",
          marginTop: "auto",
        }}
      >
        {isLoading ? (
          <>
            <Loader2 size={18} className="animate-spin-slow" />
            Analyzing Property...
          </>
        ) : (
          <>
            <Zap size={18} />
            Predict Price
          </>
        )}
      </button>

      {!selectedLocation && (
        <p
          style={{
            textAlign: "center",
            fontSize: "0.72rem",
            color: "#475569",
            marginTop: "-8px",
          }}
        >
          ↖ Pin a location on the map to enable prediction
        </p>
      )}
    </div>
  );
}
