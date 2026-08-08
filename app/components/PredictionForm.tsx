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
} from "lucide-react";
import { getTopCandidates } from "../utils/neighborhoods";

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
  has_storage: boolean; // UI placebo — not sent to model
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
  type:      { label: "نوع ملک",      icon: <Home size={14} /> },
  area:      { label: "متراژ",         icon: <Ruler size={14} /> },
  rooms:     { label: "اتاق‌ها",        icon: <BedDouble size={14} /> },
  age:       { label: "سال ساخت",      icon: <Calendar size={14} /> },
  floors:    { label: "طبقه",          icon: <Layers size={14} /> },
  amenities: { label: "امکانات",       icon: <CheckSquare size={14} /> },
  review:    { label: "بررسی نهایی",   icon: <Zap size={14} /> },
};

// ─── Defaults ─────────────────────────────────────────────────────────────────
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
  has_storage: false,
};

// ─── Spinner ──────────────────────────────────────────────────────────────────
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

// ─── Step Progress Bar ────────────────────────────────────────────────────────
function StepBar({ current }: { current: Step }) {
  const idx = STEPS.indexOf(current);
  const pct = (idx / (STEPS.length - 1)) * 100;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: "0.6rem", color: "#546e8a", fontWeight: 700 }}>
          مرحله {idx + 1} از {STEPS.length}
        </span>
        <span style={{ fontSize: "0.6rem", color: "#546e8a" }}>
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
function OptionCard({
  icon, label, sub, selected, onClick, id,
}: {
  icon: React.ReactNode; label: string; sub?: string;
  selected: boolean; onClick: () => void; id?: string;
}) {
  return (
    <button
      id={id}
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
        <div style={{ fontSize: "0.85rem", fontWeight: 800, color: selected ? "#f59e0b" : "#9ab0c7" }}>
          {label}
        </div>
        {sub && (
          <div style={{ fontSize: "0.62rem", color: "#546e8a", marginTop: "3px" }}>{sub}</div>
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
        background: selected ? "rgba(249,115,22,0.16)" : "rgba(255,255,255,0.03)",
        border: selected ? "1.5px solid rgba(249,115,22,0.55)" : "1px solid rgba(255,255,255,0.08)",
        borderRadius: "100px",
        padding: "9px 20px",
        cursor: "pointer",
        fontSize: "0.85rem",
        fontWeight: 800,
        color: selected ? "#f97316" : "#64748b",
        transition: "all 0.18s ease",
        transform: selected ? "scale(1.06)" : "scale(1)",
        boxShadow: selected ? "0 0 14px rgba(249,115,22,0.22)" : "none",
      }}
    >
      {label}
    </button>
  );
}

// ─── Amenity Toggle (pill-shaped, full row) ───────────────────────────────────
function AmenityToggle({
  icon, label, sub, value, onChange, id, color = "green",
}: {
  icon: React.ReactNode; label: string; sub?: string;
  value: boolean; onChange: (v: boolean) => void; id?: string;
  color?: "green" | "teal" | "blue";
}) {
  const colors = {
    green: { bg: "rgba(34,197,94,0.06)", border: "rgba(34,197,94,0.28)", iconBg: "rgba(34,197,94,0.12)", iconColor: "#22c55e", textColor: "#22c55e" },
    teal:  { bg: "rgba(45,212,191,0.06)", border: "rgba(45,212,191,0.28)", iconBg: "rgba(45,212,191,0.12)", iconColor: "#2dd4bf", textColor: "#2dd4bf" },
    blue:  { bg: "rgba(96,165,250,0.06)", border: "rgba(96,165,250,0.28)", iconBg: "rgba(96,165,250,0.12)", iconColor: "#60a5fa", textColor: "#60a5fa" },
  };
  const c = colors[color];

  return (
    <button
      id={id}
      onClick={() => onChange(!value)}
      style={{
        background: value ? c.bg : "rgba(255,255,255,0.025)",
        border: value ? `1.5px solid ${c.border}` : "1px solid rgba(255,255,255,0.07)",
        borderRadius: "14px",
        padding: "14px 16px",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "12px",
        transition: "all 0.2s ease",
        width: "100%",
        boxShadow: value ? `0 0 14px ${c.border}40` : "none",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <div
          style={{
            width: "34px",
            height: "34px",
            borderRadius: "10px",
            background: value ? c.iconBg : "rgba(255,255,255,0.05)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: value ? c.iconColor : "#546e8a",
            flexShrink: 0,
          }}
        >
          {icon}
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: "0.82rem", fontWeight: 800, color: value ? c.textColor : "#9ab0c7" }}>
            {label}
          </div>
          {sub && <div style={{ fontSize: "0.62rem", color: "#546e8a", marginTop: "2px" }}>{sub}</div>}
        </div>
      </div>
      {/* Pill toggle */}
      <div
        className={`toggle-track ${value ? "active" : ""}`}
        aria-checked={value}
        role="switch"
      >
        <div className="toggle-thumb" />
      </div>
    </button>
  );
}

// ─── Number Stepper ───────────────────────────────────────────────────────────
function Stepper({
  label, value, min, max, onChange, id,
}: {
  label: string; value: number; min: number; max: number;
  onChange: (v: number) => void; id?: string;
}) {
  const atMax = value >= max;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px", flex: 1 }}>
      <span style={{ fontSize: "0.62rem", color: "#64748b", fontWeight: 700, textAlign: "center" }}>{label}</span>
      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
        <button
          onClick={() => onChange(Math.max(min, value - 1))}
          style={{
            width: "34px", height: "34px",
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
            fontSize: "1.15rem",
            color: atMax ? "#f59e0b" : "#edf2f7",
          }}
        >
          {atMax ? `${max}+` : value}
        </div>
        <button
          onClick={() => onChange(Math.min(max, value + 1))}
          style={{
            width: "34px", height: "34px",
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

// ─── Review Row ───────────────────────────────────────────────────────────────
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

// ─── Main Component ───────────────────────────────────────────────────────────
export default function PredictionForm({
  selectedLocation,
  onSubmit,
  isLoading,
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

  const AGE_OPTIONS = [
    { label: "نوساز", value: 0 },
    { label: "۱ تا ۵ سال", value: 3 },
    { label: "۵ تا ۱۵ سال", value: 10 },
    { label: "بالای ۱۵ سال", value: 20 },
  ];

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
              onFocus={(e) => { if (Number(e.target.value) === 0 || e.target.value === "0") { set("area", 0 as unknown as number); e.target.select(); } }}
              onChange={(e) => {
                const n = e.target.value === "" ? 0 : Number(e.target.value);
                set("area", n);
              }}
              className="form-input"
              style={{
                fontSize: "2.2rem",
                fontWeight: 900,
                textAlign: "center",
                padding: "8px 12px",
                maxWidth: "150px",
                color: "#f59e0b",
                direction: "ltr",
              }}
            />
            <span style={{ fontSize: "1rem", color: "#546e8a", fontWeight: 700 }}>متر مربع</span>
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
                onClick={() => set("area", v)}
                style={{
                  background: vals.area === v ? "rgba(245,158,11,0.14)" : "rgba(255,255,255,0.04)",
                  border: vals.area === v ? "1px solid rgba(245,158,11,0.45)" : "1px solid rgba(255,255,255,0.07)",
                  borderRadius: "10px",
                  padding: "5px 8px",
                  cursor: "pointer",
                  fontSize: "0.68rem",
                  fontWeight: 700,
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
              label={n === 5 ? "۵+" : String(n)}
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
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
          {AGE_OPTIONS.map((opt) => (
            <button
              key={opt.label}
              id={`age-${opt.value}`}
              onClick={() => { set("building_age", opt.value); setTimeout(goNext, 200); }}
              style={{
                background: vals.building_age === opt.value ? "rgba(245,158,11,0.12)" : "rgba(255,255,255,0.025)",
                border: vals.building_age === opt.value
                  ? "1.5px solid rgba(245,158,11,0.5)"
                  : "1px solid rgba(255,255,255,0.07)",
                borderRadius: "14px",
                padding: "16px",
                cursor: "pointer",
                fontSize: "0.85rem",
                fontWeight: 800,
                color: vals.building_age === opt.value ? "#f59e0b" : "#64748b",
                transition: "all 0.18s ease",
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "0.65rem", color: "#546e8a" }}>یا دقیق وارد کنید:</span>
          <input
            id="age-exact"
            type="number"
            value={vals.building_age === 0 ? "" : vals.building_age}
            min={0}
            max={80}
            onFocus={(e) => e.target.select()}
            onChange={(e) => set("building_age", e.target.value === "" ? 0 : Number(e.target.value))}
            className="form-input"
            style={{ maxWidth: "80px", padding: "6px 10px", fontSize: "0.88rem", direction: "ltr", textAlign: "center" }}
          />
          <span style={{ fontSize: "0.65rem", color: "#546e8a" }}>سال</span>
        </div>
      </div>
    ),

    // ── Step 5: طبقه ──────────────────────────────────────────────────────────
    floors: (
      <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        <div style={{ fontSize: "1rem", fontWeight: 900, color: "#edf2f7" }}>
          جزئیات طبقه‌بندی
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <Stepper
            label="کل طبقات"
            id="total-floors"
            value={vals.total_floors}
            min={1}
            max={25}
            onChange={(v) => set("total_floors", v)}
          />
          <div style={{ width: "1px", background: "rgba(255,255,255,0.06)", alignSelf: "stretch" }} />
          <Stepper
            label="طبقه واحد"
            id="floor-num"
            value={vals.floor_num}
            min={0}
            max={vals.total_floors}
            onChange={(v) => set("floor_num", Math.min(v, vals.total_floors))}
          />
          <div style={{ width: "1px", background: "rgba(255,255,255,0.06)", alignSelf: "stretch" }} />
          <Stepper
            label="واحد/طبقه"
            id="unit-per-floor"
            value={vals.unit_per_floor}
            min={1}
            max={10}
            onChange={(v) => set("unit_per_floor", v)}
          />
        </div>
      </div>
    ),

    // ── Step 6: امکانات ───────────────────────────────────────────────────────
    amenities: (
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        <div style={{ fontSize: "1rem", fontWeight: 900, color: "#edf2f7" }}>
          امکانات ملک
        </div>
        <AmenityToggle
          id="toggle-elevator"
          icon={<Layers size={16} />}
          label="آسانسور"
          sub="تأثیر زیادی بر ارزش طبقات بالا دارد"
          value={vals.has_elevator}
          onChange={(v) => set("has_elevator", v)}
          color="green"
        />
        <AmenityToggle
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
          color="teal"
        />
        <AmenityToggle
          id="toggle-storage"
          icon={
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 8h14M5 8a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v0a2 2 0 0 1-2 2M5 8l1 12h12l1-12" />
            </svg>
          }
          label="انباری"
          sub="فضای ذخیره‌سازی جداگانه"
          value={vals.has_storage}
          onChange={(v) => set("has_storage", v)}
          color="blue"
        />
      </div>
    ),

    // ── Step 7: بررسی نهایی ───────────────────────────────────────────────────
    review: (
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <div style={{ fontSize: "1rem", fontWeight: 900, color: "#edf2f7" }}>
          بررسی و ارزیابی
        </div>

        {/* Neighborhood selection */}
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
                      <span style={{ direction: "ltr", display: "inline-block" }}>{c.distance_km} km</span>
                      <span style={{ marginRight: "4px", opacity: 0.7 }}>· منطقه {c.region_id}</span>
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
          <ReviewRow label="متراژ"        value={`${vals.area} م²`} />
          <ReviewRow label="اتاق خواب"    value={`${vals.rooms_count} اتاق`} />
          <ReviewRow label="سن بنا"       value={`${vals.building_age} سال`} />
          <ReviewRow label="طبقه"         value={`${vals.floor_num} از ${vals.total_floors}`} />
          <ReviewRow label="واحد/طبقه"   value={String(vals.unit_per_floor)} />
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

      {/* Location guard */}
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
