"use client";

import { useEffect, useRef, useCallback, useState } from "react";

interface MapComponentProps {
  onLocationSelect: (lat: number, lon: number) => void;
  selectedLocation: { lat: number; lon: number } | null;
}

// We import leaflet types only for typing
let L: typeof import("leaflet") | null = null;

export default function MapComponent({
  onLocationSelect,
  selectedLocation,
}: MapComponentProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapInstanceRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markerRef = useRef<any>(null);
  const [address, setAddress] = useState<string | null>(null);

  const initMap = useCallback(async () => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const leaflet = await import("leaflet");
    L = leaflet.default || leaflet;

    // Fix default marker icon path in Next.js/webpack
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl:
        "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
      iconUrl:
        "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
      shadowUrl:
        "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
    });

    const TEHRAN_CENTER: [number, number] = [35.6961, 51.4183];

    const map = L.map(mapRef.current, {
      center: TEHRAN_CENTER,
      zoom: 12,
      zoomControl: true,
      attributionControl: false,
      maxBounds: [[35.5, 51.1], [35.9, 51.8]],
      maxBoundsViscosity: 1.0,
      minZoom: 11,
    });

    // ── CartoDB Voyager — vibrant, high-contrast, crystal-clear map ──
    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
      {
        maxZoom: 19,
        subdomains: "abcd",
      }
    ).addTo(map);

    // ── Custom orange pin icon ──
    const goldIcon = L.divIcon({
      className: "",
      html: `
        <div style="
          position: relative;
          width: 32px;
          height: 42px;
          display: flex;
          flex-direction: column;
          align-items: center;
        ">
          <div style="
            width: 32px;
            height: 32px;
            background: linear-gradient(135deg, #f97316, #ea580c);
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            border: 3px solid rgba(255,255,255,0.92);
            box-shadow: 0 4px 20px rgba(249, 115, 22, 0.72), 0 0 0 0 rgba(249, 115, 22, 0.6);
            animation: pulse-ring 2s infinite;
          ">
          </div>
          <div style="
            width: 6px;
            height: 6px;
            background: #f97316;
            border-radius: 50%;
            margin-top: 2px;
            box-shadow: 0 0 10px rgba(249, 115, 22, 0.85);
          "></div>
        </div>
      `,
      iconSize: [32, 42],
      iconAnchor: [16, 42],
      popupAnchor: [0, -42],
    });

    // ── Click handler ──
    map.on("click", async (e: { latlng: { lat: number; lng: number } }) => {
      const { lat, lng } = e.latlng;

      if (markerRef.current) {
        markerRef.current.remove();
      }

      const marker = L!.marker([lat, lng], { icon: goldIcon })
        .addTo(map)
        .bindPopup(
          `<div style="text-align:center; padding: 4px 0; font-family:'Vazirmatn',sans-serif;">
            <div id="popup-address" style="font-size:0.85rem; font-weight: 700; color:#f97316; margin-top:6px;">در حال دریافت آدرس...</div>
          </div>`,
          { closeButton: false }
        )
        .openPopup();

      markerRef.current = marker;
      onLocationSelect(lat, lng);
      setAddress(null);

      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=fa`);
        const data = await res.json();

        let addrStr = "آدرس نامشخص";
        if (data.address) {
          const parts: string[] = [];
          if (data.address.suburb || data.address.neighbourhood) {
            parts.push(data.address.suburb || data.address.neighbourhood);
          }
          if (data.address.road) {
            parts.push(data.address.road);
          }
          if (parts.length > 0) {
            addrStr = parts.join("، ");
          } else if (data.display_name) {
            addrStr = data.display_name.split(",").slice(0, 2).join("، ");
          }
        }
        setAddress(addrStr);

        const popupContent = `<div style="text-align:center; padding: 6px 4px; font-family:'Vazirmatn',sans-serif;">
            <div style="font-weight:700; color:#f97316; font-size:0.85rem;">
              ${addrStr}
            </div>
          </div>`;
        marker.setPopupContent(popupContent);
      } catch {
        // silently ignore address lookup errors
      }
    });

    mapInstanceRef.current = map;
  }, [onLocationSelect]);

  useEffect(() => {
    initMap();
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [initMap]);

  useEffect(() => {
    if (!selectedLocation && markerRef.current) {
      markerRef.current.remove();
      markerRef.current = null;
    }
  }, [selectedLocation]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      {/* Map container */}
      <div
        ref={mapRef}
        style={{
          width: "100%",
          height: "100%",
          borderRadius: "18px",
          overflow: "hidden",
        }}
        id="tehran-map"
      />

      {/* Click instruction overlay */}
      {!selectedLocation && (
        <div
          style={{
            position: "absolute",
            bottom: "16px",
            left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(15, 17, 23, 0.9)",
            border: "1px solid rgba(249, 115, 22, 0.32)",
            borderRadius: "100px",
            padding: "9px 22px",
            display: "flex",
            alignItems: "center",
            gap: "9px",
            zIndex: 1000,
            backdropFilter: "blur(14px)",
            pointerEvents: "none",
            boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
          }}
        >
          <div className="map-pulse" />
          <span
            style={{
              fontSize: "0.78rem",
              color: "#9ab0c7",
              fontWeight: 600,
              whiteSpace: "nowrap",
            }}
          >
            روی نقشه کلیک کنید تا موقعیت را انتخاب کنید
          </span>
        </div>
      )}

      {/* Pinned address badge */}
      {selectedLocation && (
        <div
          style={{
            position: "absolute",
            top: "12px",
            right: "12px",
            background: "rgba(15, 17, 23, 0.92)",
            border: "1px solid rgba(249, 115, 22, 0.38)",
            borderRadius: "12px",
            padding: "9px 14px",
            zIndex: 1000,
            backdropFilter: "blur(14px)",
            maxWidth: "200px",
          }}
          className="animate-fadeUp"
        >
          <div style={{ fontSize: "0.58rem", color: "#546e8a", marginBottom: "3px", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase" }}>
            موقعیت انتخابی
          </div>
          {address ? (
            <div style={{ fontSize: "0.82rem", color: "#f97316", fontWeight: 700, lineHeight: 1.3 }}>
              {address}
            </div>
          ) : (
            <div style={{ fontSize: "0.72rem", color: "#546e8a", fontWeight: 600 }}>
              در حال بارگذاری...
            </div>
          )}
          <div style={{ fontSize: "0.6rem", color: "#546e8a", marginTop: "4px" }}>
            {selectedLocation.lat.toFixed(4)}, {selectedLocation.lon.toFixed(4)}
          </div>
        </div>
      )}
    </div>
  );
}
