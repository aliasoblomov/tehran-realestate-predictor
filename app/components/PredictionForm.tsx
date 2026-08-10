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
  ChevronRight,
  Zap,
  MapPin,
  Check,
} from "lucide-react";
import { getTopCandidates } from "../utils/neighborhoods";

// ─── Utility: Persian Digits ──────────────────────────────────────────────────
export function toPersianDigits(n: number | string): string {
  if (n === null || n === undefined) return "";
  const persianDigits = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
  return String(n).replace(/\d/g, (d) => persianDigits[parseInt(d, 10)]);
}

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
  has_storage: boolean;
}

interface PredictionFormProps {
  selectedLocation: { lat: number; lon: number } | null;
  onSubmit: (values: FormValues, selectedSlug?: string) => void;
  isLoading: boolean;
  isLocked?: boolean;
  onEdit?: () => void;
  resultData?: { region_id: number; neighborhood_name: string };
  addressName?: string;
}

type Step = "type" | "area" | "rooms" | "age" | "floors" | "amenities" | "review";
const STEPS: Step[] = ["type", "area", "rooms", "age", "floors", "amenities", "review"];

const STEP_META: Record<Step, { label: string; icon: React.ReactNode }> = {
  type:      { label: "نوع ملک",      icon: <Home size={14} /> },
  area:      { label: "متراژ",         icon: <Ruler size={14} /> },
  rooms:     { label: "اتاق‌ها",        icon: <BedDouble size={14} /> },
  age:       { label: "سال ساخت",      icon: <Calendar size={14} /> },
  floors:    { label: "طبقه",          icon: <Layers size={14} /> },
  amenities: { label: "امکانات",       icon: <CheckSquare size={14} /> },
  review:    { label: "بررسی نهایی",   icon: <Zap size={14} /> },
};

const DEFAULT: FormValues = {
  area: 100,
  building_age: 10,
  total_floors: 5,
  floor_num: 2,
  unit_per_floor: 2,
  rooms_count: 2,
  has_elevator: true,
  has_parking: true,
  is_villa: false,
  has_storage: true,
};

function Spinner() {
  return (
    <div
      style={{
        width: "18px",
        height: "18px",
        border: "2px solid rgba(255,255,255,0.22)",
        borderTopColor: "#fff",
        borderRadius: "50%",
        flexShrink: 0,
      }}
      className="animate-spin-slow"
    />
  );
}

function StepBar({ current }: { current: Step }) {
  const idx = STEPS.indexOf(current);
  const pct = (idx / (STEPS.length - 1)) * 100;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: "0.62rem", color: "#546e8a", fontWeight: 700 }}>
          مرحله {toPersianDigits(idx + 1)} از {toPersianDigits(STEPS.length)}
        </span>
        <span style={{ fontSize: "0.62rem", color: "#546e8a" }}>
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

function OptionCard({
  icon, label, sub, selected, onClick, id,
}: {
  icon: React.ReactNode; label: string; sub?: string;
  selected: boolean; onClick: () => void; id?: string;
}) {
  return (
    <button
      id={id}
      type="button"
      onClick={onClick}
      style={{
        background: selected
          ? "linear-gradient(135deg, rgba(245,158,11,0.14), rgba(249,115,22,0.08))"
          : "rgba(255,255,255,0.025)",
        border: selected
          ? "1.5px solid rgba(245,158,11,0.55)"
          : "1px solid rgba(255,255,255,0.07)",
        borderRadius: "16px",
        padding: "20px 14px",
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "10px",
        flex: 1,
        transition: "all 0.2s ease",
        boxShadow: selected ? "0 0 18px rgba(245,158,11,0.18)" : "none",
        transform: selected ? "translateY(-2px)" : "none",
      }}
    >
      <div
        style={{
          width: "42px",
          height: "42px",
          borderRadius: "12px",
          background: selected ? "rgba(245,158,11,0.15)" : "rgba(255,255,255,0.05)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: selected ? "#f59e0b" : "#546e8a",
        }}
      >
        {icon}
      </div>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: "0.88rem", fontWeight: 800, color: selected ? "#f59e0b" : "#9ab0c7" }}>
          {label}
        </div>
        {sub && (
          <div style={{ fontSize: "0.62rem", color: "#546e8a", marginTop: "3px" }}>{sub}</div>
        )}
      </div>
    </button>
  );
}

function Pill({ label, selected, onClick, id }: { label: string; selected: boolean; onClick: () => void; id?: string }) {
  return (
    <button
      id={id}
      type="button"
      onClick={onClick}
      style={{
        background: selected ? "rgba(249,115,22,0.16)" : "rgba(255,255,255,0.03)",
        border: selected ? "1.5px solid rgba(249,115,22,0.55)" : "1px solid rgba(255,255,255,0.08)",
        borderRadius: "100px",
        padding: "10px 18px",
        cursor: "pointer",
        fontSize: "0.82rem",
        fontWeight: 800,
        color: selected ? "#f97316" : "#64748b",
        transition: "all 0.18s ease",
        transform: selected ? "scale(1.05)" : "scale(1)",
        boxShadow: selected ? "0 0 12px rgba(249,115,22,0.22)" : "none",
      }}
    >
      {label}
    </button>
  );
}

// ─── Fully Enclosed Segmented Control for Amenities ───────────────────────────
function AmenitySegment({
  icon, label, sub, value, onChange, id
}: {
  icon: React.ReactNode; label: string; sub?: string;
  value: boolean; onChange: (v: boolean) => void; id?: string;
}) {
  return (
    <div
      id={id}
      style={{
        background: "rgba(255,255,255,0.025)",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: "14px",
        padding: "12px 14px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "12px",
        width: "100%",
        boxSizing: "border-box",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <div
          style={{
            width: "34px",
            height: "34px",
            borderRadius: "10px",
            background: value ? "rgba(245,158,11,0.12)" : "rgba(255,255,255,0.04)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: value ? "#f59e0b" : "#546e8a",
            flexShrink: 0,
          }}
        >
          {icon}
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: "0.82rem", fontWeight: 800, color: "#edf2f7" }}>
            {label}
          </div>
          {sub && <div style={{ fontSize: "0.62rem", color: "#546e8a", marginTop: "2px" }}>{sub}</div>}
        </div>
      </div>

      {/* Enclosed Segment Controls */}
      <div
        style={{
          background: "rgba(0,0,0,0.35)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: "100px",
          padding: "3px",
          display: "flex",
          gap: "3px",
          flexShrink: 0,
        }}
      >
        <button
          type="button"
          onClick={() => onChange(true)}
          style={{
            background: value ? "linear-gradient(135deg, #22c55e, #16a34a)" : "transparent",
            color: value ? "#fff" : "#64748b",
            border: "none",
            borderRadius: "100px",
            padding: "5px 14px",
            fontSize: "0.74rem",
            fontWeight: 800,
            cursor: "pointer",
            transition: "all 0.2s ease",
            boxShadow: value ? "0 2px 10px rgba(34,197,94,0.4)" : "none",
          }}
        >
          دارد
        </button>
        <button
          type="button"
          onClick={() => onChange(false)}
          style={{
            background: !value ? "rgba(244,63,94,0.2)" : "transparent",
            color: !value ? "#f43f5e" : "#64748b",
            border: !value ? "1px solid rgba(244,63,94,0.4)" : "none",
            borderRadius: "100px",
            padding: "5px 14px",
            fontSize: "0.74rem",
            fontWeight: 800,
            cursor: "pointer",
            transition: "all 0.2s ease",
          }}
        >
          ندارد
        </button>
      </div>
    </div>
  );
}

function Stepper({
  label, value, min, max, onChange, id,
}: {
  label: string; value: number; min: number; max: number;
  onChange: (v: number) => void; id?: string;
}) {
  const atMax = value >= max;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px", flex: 1 }}>
      <span style={{ fontSize: "0.65rem", color: "#64748b", fontWeight: 700, textAlign: "center" }}>{label}</span>
      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          style={{
            width: "42px", height: "42px",
            borderRadius: "10px",
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            color: "#9ab0c7",
            cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "1.2rem", fontWeight: 700,
          }}
        >
          −
        </button>
        <div
          id={id}
          style={{
            flex: 1,
            textAlign: "center",
            fontWeight: 900,
            fontSize: "1.1rem",
            color: atMax ? "#f59e0b" : "#edf2f7",
          }}
        >
          {atMax ? toPersianDigits(`${max}+`) : toPersianDigits(value)}
        </div>
        <button
          type="button"
          onClick={() => onChange(Math.min(max, value + 1))}
          style={{
            width: "42px", height: "42px",
            borderRadius: "10px",
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            color: "#9ab0c7",
            cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "1.2rem", fontWeight: 700,
          }}
        >
          +
        </button>
      </div>
    </div>
  );
}

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
      <span style={{ fontSize: "0.72rem", color: "#546e8a" }}>{label}</span>
      <span style={{ fontSize: "0.72rem", fontWeight: 800, color: "#9ab0c7" }}>{value}</span>
    </div>
  );
}

// ─── Unit Floor Selection List ────────────────────────────────────────────────
const UNIT_FLOOR_OPTIONS = [
  { label: "زیرهمکف", value: -1 },
  { label: "همکف", value: 0 },
  ...Array.from({ length: 20 }, (_, i) => ({ label: toPersianDigits(i + 1), value: i + 1 })),
  { label: "۲۰+", value: 21 },
];

export default function PredictionForm({
  selectedLocation,
  onSubmit,
  isLoading,
  isLocked,
  onEdit,
  resultData,
  addressName,
}: PredictionFormProps) {
  const [step, setStep] = useState<Step>("type");
  const [vals, setVals] = useState<FormValues>(DEFAULT);

  const candidates = selectedLocation
    ? getTopCandidates(selectedLocation.lat, selectedLocation.lon, 3)
    : [];

  const [selectedSlug, setSelectedSlug] = useState<string>("");

  useEffect(() => {
    if (candidates.length > 0) {
      setSelectedSlug(candidates[0].slug);
    } else {
      setSelectedSlug("");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLocation?.lat, selectedLocation?.lon]);

  const set = useCallback(<K extends keyof FormValues>(key: K, value: FormValues[K]) => {
    setVals((prev) => {
      const next = { ...prev, [key]: value };
      // Logic check: Total Floors MUST be >= Unit Floor
      if (key === "floor_num" && typeof value === "number") {
        if (value > 0 && next.total_floors < value) {
          next.total_floors = value;
        }
      }
      if (key === "total_floors" && typeof value === "number") {
        if (prev.floor_num > 0 && value < prev.floor_num) {
          next.floor_num = value;
        }
      }
      return next;
    });
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

  if (isLocked && resultData) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "16px", padding: "10px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: "1rem", fontWeight: 900, color: "#edf2f7", display: "flex", alignItems: "center", gap: "6px" }}>
            <MapPin size={18} color="#2dd4bf" />
            مشخصات ملک ارزیابی‌شده
          </div>
          <button
            className="no-print"
            onClick={onEdit}
            style={{
              background: "rgba(249,115,22,0.12)", border: "1px solid rgba(249,115,22,0.3)", borderRadius: "100px",
              padding: "4px 12px", color: "#f97316", fontSize: "0.7rem", fontWeight: 800, cursor: "pointer", transition: "all 0.2s ease"
            }}
          >
            ویرایش اطلاعات
          </button>
        </div>

        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "14px", padding: "14px" }}>
          <div style={{ fontSize: "0.8rem", color: "#9ab0c7", fontWeight: 800, marginBottom: "12px", display: "flex", alignItems: "center", gap: "6px", lineHeight: 1.6 }}>
             📍 {addressName || `استان تهران، شهر تهران، منطقه ${toPersianDigits(resultData.region_id)}، محله ${resultData.neighborhood_name}`}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", fontSize: "0.75rem", color: "#edf2f7", fontWeight: 700 }}>
            <span style={{ background: "rgba(255,255,255,0.05)", padding: "4px 10px", borderRadius: "8px" }}>
              {vals.is_villa ? "🏠 ویلایی" : "🏢 آپارتمان"}
            </span>
            <span style={{ background: "rgba(255,255,255,0.05)", padding: "4px 10px", borderRadius: "8px" }}>
              📏 {toPersianDigits(vals.area)} مترمربع
            </span>
            <span style={{ background: "rgba(255,255,255,0.05)", padding: "4px 10px", borderRadius: "8px" }}>
              🛏️ {toPersianDigits(vals.rooms_count)} اتاق
            </span>
            <span style={{ background: "rgba(255,255,255,0.05)", padding: "4px 10px", borderRadius: "8px" }}>
              🏗️ {vals.building_age === 0 ? "نوساز" : `${toPersianDigits(vals.building_age)} سال ساخت`}
            </span>
            {!vals.is_villa && (
              <span style={{ background: "rgba(255,255,255,0.05)", padding: "4px 10px", borderRadius: "8px" }}>
                🏢 طبقه {toPersianDigits(vals.floor_num)} از {toPersianDigits(vals.total_floors)}
              </span>
            )}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", marginTop: "10px", fontSize: "0.7rem", color: "#546e8a" }}>
            {vals.has_elevator && <span>✅ آسانسور</span>}
            {vals.has_parking && <span>✅ پارکینگ</span>}
            {vals.has_storage && <span>✅ انباری</span>}
          </div>
        </div>
      </div>
    );
  }

  const stepContent: Record<Step, React.ReactNode> = {
    // ── Step 1: نوع ملک ─────────────────────────────────────────────────────
    type: (
      <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        <div style={{ fontSize: "1rem", fontWeight: 900, color: "#edf2f7" }}>
          نوع ملک را انتخاب کنید
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <OptionCard
            id="type-apartment"
            icon={<Building2 size={22} />}
            label="آپارتمان"
            sub="ساختمان چندواحدی"
            selected={!vals.is_villa}
            onClick={() => { set("is_villa", false); setTimeout(goNext, 200); }}
          />
          <OptionCard
            id="type-villa"
            icon={<Home size={22} />}
            label="ویلا"
            sub="خانه مستقل"
            selected={vals.is_villa}
            onClick={() => { set("is_villa", true); setTimeout(goNext, 200); }}
          />
        </div>
      </div>
    ),

    // ── Step 2: متراژ ────────────────────────────────────────────────────────
    area: (
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <div style={{ fontSize: "1rem", fontWeight: 900, color: "#edf2f7" }}>
          متراژ ملک چند متر است؟
        </div>
        <div
          style={{
            background: "rgba(255,255,255,0.025)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: "16px",
            padding: "20px",
            display: "flex",
            flexDirection: "column",
            gap: "14px",
          }}
        >
          <div style={{ display: "flex", alignItems: "baseline", gap: "10px", justifyContent: "center" }}>
            <input
              id="area-input"
              type="number"
              value={vals.area === 0 ? "" : vals.area}
              min={20}
              max={1000}
              onFocus={(e) => {
                if (e.target.value === "0" || e.target.value === "۰") {
                  set("area", "" as unknown as number);
                }
              }}
              onChange={(e) => {
                const val = e.target.value;
                if (val === "") set("area", 0);
                else set("area", Number(val));
              }}
              className="form-input"
              style={{
                fontSize: "2.2rem",
                fontWeight: 900,
                textAlign: "center",
                padding: "12px 16px",
                maxWidth: "150px",
                color: "#f59e0b",
                direction: "ltr",
              }}
            />
            <span style={{ fontSize: "1rem", color: "#546e8a", fontWeight: 700 }}>مترمربع</span>
          </div>
          <input
            id="area-slider"
            type="range"
            min={20}
            max={1000}
            step={5}
            value={vals.area || 20}
            onChange={(e) => set("area", Number(e.target.value))}
            style={{ width: "100%", cursor: "pointer" }}
          />
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            {[50, 100, 150, 200, 300].map((v) => (
              <button
                key={v}
                id={`area-quick-${v}`}
                type="button"
                onClick={() => set("area", v)}
                style={{
                  background: vals.area === v ? "rgba(245,158,11,0.14)" : "rgba(255,255,255,0.04)",
                  border: vals.area === v ? "1px solid rgba(245,158,11,0.45)" : "1px solid rgba(255,255,255,0.07)",
                  borderRadius: "10px",
                  padding: "8px 14px",
                  cursor: "pointer",
                  fontSize: "0.72rem",
                  fontWeight: 700,
                  color: vals.area === v ? "#f59e0b" : "#64748b",
                }}
              >
                {toPersianDigits(v)}
              </button>
            ))}
          </div>
        </div>
      </div>
    ),

    // ── Step 3: اتاق ──────────────────────────────────────────────────────────
    rooms: (
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <div style={{ fontSize: "1rem", fontWeight: 900, color: "#edf2f7" }}>
          تعداد اتاق خواب چند تاست؟
        </div>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <Pill
              key={n}
              id={`rooms-${n}`}
              label={n === 5 ? "۵+" : toPersianDigits(n)}
              selected={vals.rooms_count === n}
              onClick={() => { set("rooms_count", n); setTimeout(goNext, 200); }}
            />
          ))}
        </div>
      </div>
    ),

    // ── Step 4: سن بنا ────────────────────────────────────────────────────────
    age: (
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <div style={{ fontSize: "1rem", fontWeight: 900, color: "#edf2f7" }}>
          سن بنا چقدر است؟
        </div>
        <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "14px", padding: "16px", display: "flex", flexDirection: "column", gap: "14px" }}>
          <Stepper
            label="سن بنا (سال)"
            id="age-stepper"
            value={vals.building_age}
            min={0}
            max={40}
            onChange={(v) => set("building_age", v)}
          />
          <div style={{ display: "flex", justifyContent: "center", gap: "8px", flexWrap: "wrap", marginTop: "10px" }}>
            <Pill label="نوساز" selected={vals.building_age === 0} onClick={() => set("building_age", 0)} />
            <Pill label="۵ سال" selected={vals.building_age === 5} onClick={() => set("building_age", 5)} />
            <Pill label="۱۰ سال" selected={vals.building_age === 10} onClick={() => set("building_age", 10)} />
            <Pill label="۱۵ سال" selected={vals.building_age === 15} onClick={() => set("building_age", 15)} />
            <Pill label="۲۰ سال" selected={vals.building_age === 20} onClick={() => set("building_age", 20)} />
          </div>
        </div>
      </div>
    ),

    // ── Step 5: طبقه (Redesigned 3-Step Floor Logic) ──────────────────────────
    floors: (
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <div style={{ fontSize: "1rem", fontWeight: 900, color: "#edf2f7" }}>
          جزئیات طبقه‌بندی ملک
        </div>

        {/* 1. Unit Floor Selection */}
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <span style={{ fontSize: "0.75rem", fontWeight: 800, color: "#f97316" }}>
            ۱. طبقه واحد:
          </span>
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", maxHeight: "120px", overflowY: "auto", padding: "2px" }}>
            {UNIT_FLOOR_OPTIONS.map((opt) => {
              const isSelected = vals.floor_num === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => set("floor_num", opt.value)}
                  style={{
                    background: isSelected ? "rgba(249,115,22,0.18)" : "rgba(255,255,255,0.03)",
                    border: isSelected ? "1.5px solid #f97316" : "1px solid rgba(255,255,255,0.07)",
                    borderRadius: "100px",
                    padding: "10px 16px",
                    fontSize: "0.78rem",
                    fontWeight: isSelected ? 800 : 600,
                    color: isSelected ? "#f97316" : "#9ab0c7",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. Total Floors & Units per floor */}
        <div
          style={{
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: "14px",
            padding: "14px",
            display: "flex",
            gap: "14px",
          }}
        >
          <Stepper
            label="۲. کل طبقات ساختمان"
            id="total-floors"
            value={vals.total_floors}
            min={Math.max(1, vals.floor_num > 0 ? vals.floor_num : 1)}
            max={35}
            onChange={(v) => set("total_floors", v)}
          />
          <div style={{ width: "1px", background: "rgba(255,255,255,0.06)", alignSelf: "stretch" }} />
          <Stepper
            label="۳. واحد در هر طبقه"
            id="unit-per-floor"
            value={vals.unit_per_floor}
            min={1}
            max={10}
            onChange={(v) => set("unit_per_floor", v)}
          />
        </div>
      </div>
    ),

    // ── Step 6: امکانات (Enclosed Segmented Controls) ─────────────────────────
    amenities: (
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <div style={{ fontSize: "1rem", fontWeight: 900, color: "#edf2f7" }}>
          امکانات ملک
        </div>
        <AmenitySegment
          id="toggle-elevator"
          icon={<Layers size={16} />}
          label="آسانسور"
          sub="تأثیر زیادی بر ارزش طبقات بالا دارد"
          value={vals.has_elevator}
          onChange={(v) => set("has_elevator", v)}
        />
        <AmenitySegment
          id="toggle-parking"
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="7" width="20" height="15" rx="2" />
              <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
            </svg>
          }
          label="پارکینگ"
          sub="جای پارک اختصاصی"
          value={vals.has_parking}
          onChange={(v) => set("has_parking", v)}
        />
        <AmenitySegment
          id="toggle-storage"
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 8h14M5 8a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v0a2 2 0 0 1-2 2M5 8l1 12h12l1-12" />
            </svg>
          }
          label="انباری"
          sub="فضای ذخیره‌سازی اختصاصی"
          value={vals.has_storage}
          onChange={(v) => set("has_storage", v)}
        />
      </div>
    ),

    // ── Step 7: بررسی نهایی ───────────────────────────────────────────────────
    review: (
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <div style={{ fontSize: "1rem", fontWeight: 900, color: "#edf2f7" }}>
          بررسی و ارزیابی
        </div>

        {selectedLocation && candidates.length > 0 && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "8px",
              background: "rgba(249,115,22,0.06)",
              border: "1.5px solid rgba(249,115,22,0.3)",
              borderRadius: "14px",
              padding: "12px 14px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <MapPin size={13} color="#f97316" />
                <span style={{ fontSize: "0.75rem", fontWeight: 800, color: "#f97316" }}>
                  محله را انتخاب کنید (۳ نزدیک‌ترین)
                </span>
              </div>
              <span style={{ fontSize: "0.6rem", color: "#9ab0c7" }}>براساس مختصات</span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {candidates.map((c, idx) => {
                const isSelected = selectedSlug ? selectedSlug === c.slug : idx === 0;
                return (
                  <button
                    key={c.slug}
                    type="button"
                    onClick={() => setSelectedSlug(c.slug)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "9px 12px",
                      borderRadius: "10px",
                      background: isSelected
                        ? "linear-gradient(135deg, rgba(249,115,22,0.2), rgba(245,158,11,0.1))"
                        : "rgba(255,255,255,0.03)",
                      border: isSelected
                        ? "1.5px solid #f97316"
                        : "1px solid rgba(255,255,255,0.07)",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "9px" }}>
                      <div
                        style={{
                          width: "14px",
                          height: "14px",
                          borderRadius: "50%",
                          border: isSelected ? "4px solid #f97316" : "1.5px solid #546e8a",
                          background: isSelected ? "#fff" : "transparent",
                          flexShrink: 0,
                        }}
                      />
                      <div>
                        <span style={{ fontSize: "0.8rem", fontWeight: isSelected ? 800 : 500, color: isSelected ? "#f8fafc" : "#9ab0c7" }}>
                          {c.name}
                        </span>
                        {idx === 0 && (
                          <span
                            style={{
                              marginRight: "6px",
                              fontSize: "0.58rem",
                              fontWeight: 800,
                              background: "rgba(34,197,94,0.15)",
                              color: "#22c55e",
                              border: "1px solid rgba(34,197,94,0.3)",
                              borderRadius: "100px",
                              padding: "1px 7px",
                            }}
                          >
                            نزدیک‌ترین
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ textAlign: "left", fontSize: "0.62rem", color: isSelected ? "#f97316" : "#546e8a" }}>
                      <span style={{ direction: "ltr", display: "inline-block" }}>{toPersianDigits(c.distance_km)} km</span>
                      <span style={{ marginRight: "4px", opacity: 0.7 }}>· منطقه {toPersianDigits(c.region_id)}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Summary */}
        <div
          style={{
            background: "rgba(255,255,255,0.025)",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: "14px",
            padding: "14px",
          }}
        >
          <ReviewRow label="نوع ملک"     value={vals.is_villa ? "ویلا" : "آپارتمان"} />
          <ReviewRow label="متراژ"        value={`${toPersianDigits(vals.area)} مترمربع`} />
          <ReviewRow label="اتاق خواب"    value={`${toPersianDigits(vals.rooms_count)} اتاق`} />
          <ReviewRow label="سن بنا"       value={`${toPersianDigits(vals.building_age)} سال`} />
          <ReviewRow label="طبقه واحد"    value={vals.floor_num === -1 ? "زیرهمکف" : vals.floor_num === 0 ? "همکف" : `طبقه ${toPersianDigits(vals.floor_num)}`} />
          <ReviewRow label="کل طبقات"     value={`${toPersianDigits(vals.total_floors)} طبقه`} />
          <ReviewRow label="واحد/طبقه"   value={toPersianDigits(vals.unit_per_floor)} />
          <ReviewRow label="آسانسور"      value={vals.has_elevator ? "✓ دارد" : "✗ ندارد"} />
          <ReviewRow label="پارکینگ"      value={vals.has_parking ? "✓ دارد" : "✗ ندارد"} />
          <ReviewRow label="انباری"       value={vals.has_storage ? "✓ دارد" : "✗ ندارد"} />
        </div>

        {selectedLocation && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "0.65rem",
              color: "#2dd4bf",
            }}
          >
            <MapPin size={11} />
            <span style={{ direction: "ltr" }}>
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
    <div style={{ display: "flex", flexDirection: "column", gap: "14px", height: "100%" }}>
      <StepBar current={step} />

      {!selectedLocation && (
        <div
          style={{
            background: "rgba(245,158,11,0.06)",
            border: "1px solid rgba(245,158,11,0.22)",
            borderRadius: "12px",
            padding: "10px 14px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            fontSize: "0.75rem",
            color: "#f59e0b",
            fontWeight: 600,
          }}
        >
          <MapPin size={14} color="#f59e0b" />
          ابتدا روی نقشه کلیک کنید تا موقعیت را انتخاب کنید
        </div>
      )}

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

      <div style={{ display: "flex", gap: "8px", marginTop: "auto" }}>
        {!isFirst && (
          <button
            type="button"
            onClick={goPrev}
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: "12px",
              padding: "11px 18px",
              cursor: "pointer",
              color: "#64748b",
              display: "flex",
              alignItems: "center",
              gap: "4px",
              fontSize: "0.82rem",
              fontWeight: 700,
            }}
          >
            <ChevronRight size={14} />
            بازگشت
          </button>
        )}

        {!isReview && (
          <button
            type="button"
            onClick={goNext}
            style={{
              flex: 1,
              background: "rgba(249,115,22,0.09)",
              border: "1px solid rgba(249,115,22,0.28)",
              borderRadius: "12px",
              padding: "12px",
              cursor: "pointer",
              color: "#f97316",
              fontSize: "0.85rem",
              fontWeight: 800,
              transition: "all 0.2s ease",
            }}
          >
            ادامه ←
          </button>
        )}

        {isReview && (
          <button
            id="submit-valuation"
            type="button"
            onClick={() => canProceed && !isLoading && onSubmit(vals, activeSlug)}
            disabled={!canProceed || isLoading}
            className="btn-gold"
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              fontSize: "0.92rem",
              padding: "13px",
            }}
          >
            {isLoading ? (
              <>
                <Spinner />
                در حال محاسبه...
              </>
            ) : (
              <>
                <Zap size={15} />
                دریافت ارزیابی
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
