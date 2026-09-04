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

  const onLocationSelectRef = useRef(onLocationSelect);
  useEffect(() => {
    onLocationSelectRef.current = onLocationSelect;
  }, [onLocationSelect]);

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

    // ── OpenStreetMap — free, no API key, good Persian labels ──
    L.tileLayer(
      "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap contributors",
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

      const marker = L!.marker([lat, lng], { icon: goldIcon, draggable: true })
        .addTo(map)
        .bindPopup(
          `<div style="text-align:center; padding: 4px 0; font-family:'Vazirmatn',sans-serif;">
            <div id="popup-address" style="font-size:0.85rem; font-weight: 700; color:#f97316; margin-top:6px;">در حال دریافت آدرس...</div>
          </div>`,
          { closeButton: false }
        )
        .openPopup();

      markerRef.current = marker;
      onLocationSelectRef.current(lat, lng);
      setAddress(null);

      // ── Drag end: update parent state with new pin position ──
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      marker.on("dragend", async (ev: any) => {
        const targetMarker = ev?.target || marker;
        const newPos = targetMarker.getLatLng();
        const newLat = newPos.lat;
        const newLng = newPos.lng;
        onLocationSelectRef.current(newLat, newLng);
        setAddress(null);
        marker.setPopupContent(
          `<div style="text-align:center; padding: 4px 0; font-family:'Vazirmatn',sans-serif;">
            <div style="font-size:0.85rem; font-weight: 700; color:#f97316; margin-top:6px;">در حال دریافت آدرس...</div>
          </div>`
        );
        marker.openPopup();
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${newLat}&lon=${newLng}&format=json&accept-language=fa`);
          const data = await res.json();
          let addrStr = "آدرس نامشخص";
          if (data.address) {
            const addr = data.address;
            const city = addr.city || addr.town || addr.state || "تهران";
            let regionText = "";
            const suburb = addr.suburb || addr.municipality || addr.city_district || "";
            const regionMatch = suburb.match(/منطقه\s*\d+/);
            if (regionMatch) regionText = regionMatch[0];
            const nb = addr.neighbourhood || addr.residential || "";
            const road = addr.road || "";
            
            const persianDigits = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
            const toFa = (n: string) => String(n).replace(/\d/g, (d) => persianDigits[parseInt(d, 10)]);
            const plate = addr.house_number ? `پلاک ${toFa(addr.house_number)}` : "";

            const addressParts = [city, regionText, nb, road, plate].filter(Boolean);
            if (addressParts.length > 0) addrStr = addressParts.join("، ");
            else if (data.display_name) addrStr = data.display_name.split(",").slice(0, 2).join("، ");
          }
          setAddress(addrStr);
          marker.setPopupContent(
            `<div style="text-align:center; padding: 6px 4px; font-family:'Vazirmatn',sans-serif;">
              <div style="font-weight:700; color:#f97316; font-size:0.85rem;">${addrStr}</div>
            </div>`
          );
        } catch { /* ignore */ }
      });

      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=fa`);
        const data = await res.json();

        let addrStr = "آدرس نامشخص";
        if (data.address) {
          const addr = data.address;
          const city = addr.city || addr.town || addr.state || "تهران";
          let regionText = "";
          const suburb = addr.suburb || addr.municipality || addr.city_district || "";
          const regionMatch = suburb.match(/منطقه\s*\d+/);
          if (regionMatch) regionText = regionMatch[0];
          const nb = addr.neighbourhood || addr.residential || "";
          const road = addr.road || "";
          
          const persianDigits = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
          const toFa = (n: string) => String(n).replace(/\d/g, (d) => persianDigits[parseInt(d, 10)]);
          const plate = addr.house_number ? `پلاک ${toFa(addr.house_number)}` : "";

          const addressParts = [city, regionText, nb, road, plate].filter(Boolean);
          if (addressParts.length > 0) addrStr = addressParts.join("، ");
          else if (data.display_name) addrStr = data.display_name.split(",").slice(0, 2).join("، ");
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

      {/* Top right pinned badge removed for better mobile UX */}
    </div>
  );
}
