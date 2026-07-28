"use client";

import { useEffect, useRef, useCallback } from "react";

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

  const initMap = useCallback(async () => {
    if (!mapRef.current || mapInstanceRef.current) return;

    // Dynamic import to avoid SSR issues
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

    // Tehran coordinates
    const TEHRAN_CENTER: [number, number] = [35.6961, 51.4183];

    const map = L.map(mapRef.current, {
      center: TEHRAN_CENTER,
      zoom: 12,
      zoomControl: true,
      attributionControl: false,
    });

    // Dark-themed tile layer (CartoDB Dark Matter)
    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
      {
        maxZoom: 19,
        subdomains: "abcd",
      }
    ).addTo(map);

    // Custom gold pin icon
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
            background: linear-gradient(135deg, #f59e0b, #d97706);
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            border: 3px solid rgba(255,255,255,0.9);
            box-shadow: 0 4px 20px rgba(245, 158, 11, 0.7), 0 0 0 0 rgba(245, 158, 11, 0.6);
            animation: pulse-ring 2s infinite;
          ">
          </div>
          <div style="
            width: 6px;
            height: 6px;
            background: #f59e0b;
            border-radius: 50%;
            margin-top: 2px;
            box-shadow: 0 0 8px rgba(245, 158, 11, 0.8);
          "></div>
        </div>
      `,
      iconSize: [32, 42],
      iconAnchor: [16, 42],
      popupAnchor: [0, -42],
    });

    // Click handler
    map.on("click", (e: { latlng: { lat: number; lng: number } }) => {
      const { lat, lng } = e.latlng;

      // Remove old marker
      if (markerRef.current) {
        markerRef.current.remove();
      }

      // Place new marker
      const marker = L!.marker([lat, lng], { icon: goldIcon })
        .addTo(map)
        .bindPopup(
          `<div style="text-align:center; padding: 4px 0;">
            <div style="font-size:0.7rem; color:#94a3b8; margin-bottom:4px;">Selected Location</div>
            <div style="font-weight:700; color:#f59e0b; font-size:0.82rem;">
              ${lat.toFixed(5)}° N, ${lng.toFixed(5)}° E
            </div>
          </div>`,
          { closeButton: false }
        )
        .openPopup();

      markerRef.current = marker;
      onLocationSelect(lat, lng);
    });

    // Tehran district overlay label
    L.marker(TEHRAN_CENTER, {
      icon: L.divIcon({
        className: "",
        html: `<div style="
          background: rgba(13, 20, 37, 0.8);
          border: 1px solid rgba(245, 158, 11, 0.3);
          color: #f59e0b;
          font-size: 0.65rem;
          font-weight: 700;
          letter-spacing: 0.1em;
          padding: 3px 8px;
          border-radius: 4px;
          white-space: nowrap;
          text-transform: uppercase;
          backdrop-filter: blur(8px);
        ">Tehran CBD</div>`,
        iconAnchor: [36, 10],
      }),
    }).addTo(map);

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

  // Update marker if selectedLocation changes externally (e.g., reset)
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
          borderRadius: "16px",
          overflow: "hidden",
        }}
        id="tehran-map"
      />

      {/* Click instruction overlay (shown when no pin yet) */}
      {!selectedLocation && (
        <div
          style={{
            position: "absolute",
            bottom: "16px",
            left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(8, 12, 20, 0.88)",
            border: "1px solid rgba(245, 158, 11, 0.3)",
            borderRadius: "100px",
            padding: "8px 20px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            zIndex: 1000,
            backdropFilter: "blur(12px)",
            pointerEvents: "none",
          }}
        >
          <div className="map-pulse" />
          <span
            style={{
              fontSize: "0.75rem",
              color: "#94a3b8",
              fontWeight: 500,
              whiteSpace: "nowrap",
            }}
          >
            Click anywhere on the map to drop a pin
          </span>
        </div>
      )}

      {/* Coordinates badge */}
      {selectedLocation && (
        <div
          style={{
            position: "absolute",
            top: "12px",
            left: "12px",
            background: "rgba(8, 12, 20, 0.9)",
            border: "1px solid rgba(245, 158, 11, 0.35)",
            borderRadius: "8px",
            padding: "8px 12px",
            zIndex: 1000,
            backdropFilter: "blur(12px)",
          }}
          className="animate-fadeUp"
        >
          <div style={{ fontSize: "0.62rem", color: "#475569", marginBottom: "2px", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>
            Pinned Location
          </div>
          <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "#f59e0b" }}>
            {selectedLocation.lat.toFixed(5)}° N
          </div>
          <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "#2dd4bf" }}>
            {selectedLocation.lon.toFixed(5)}° E
          </div>
        </div>
      )}
    </div>
  );
}
