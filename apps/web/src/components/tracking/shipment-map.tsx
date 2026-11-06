"use client";

import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";

export function ShipmentMap({ lat, lng, label = "Mövqe", className = "h-[420px]" }: { lat?: number | null; lng?: number | null; label?: string; className?: string }) {
  const container = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const valid = typeof lat === "number" && typeof lng === "number" && Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
  useEffect(() => {
    if (!valid || !container.current) return;
    let disposed = false;
    let map: import("leaflet").Map | undefined;
    let observer: ResizeObserver | undefined;
    setFailed(false);
    import("leaflet").then((L) => {
      if (disposed || !container.current) return;
      map = L.map(container.current, { scrollWheelZoom: false }).setView([lat!, lng!], 5);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' }).addTo(map);
      const popup = document.createElement("div");
      popup.textContent = label;
      L.circleMarker([lat!, lng!], { radius: 9, weight: 3, color: "#fff", fillColor: "#2563eb", fillOpacity: 1 }).addTo(map).bindPopup(popup).openPopup();
      L.control.scale({ imperial: false }).addTo(map);
      observer = new ResizeObserver(() => map?.invalidateSize());
      observer.observe(container.current);
    }).catch(() => { if (!disposed) setFailed(true); });
    return () => { disposed = true; observer?.disconnect(); map?.remove(); };
  }, [valid, lat, lng, label]);
  if (!valid || failed) return <div className={`flex items-center justify-center bg-royal/5 p-8 text-center text-sm text-muted ${className}`} role="status">{failed ? "Xəritə yüklənmədi. Səhifəni yeniləyin." : "Təsdiqlənmiş koordinat gözlənilir."}</div>;
  return <div ref={container} role="region" aria-label={label} className={`relative z-0 w-full ${className}`} />;
}
