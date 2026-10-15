"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/app-store";
import type { PlantInfo } from "@/lib/api-client";
import { Globe, MapPin, Sparkles, Navigation, Key, X, Check } from "lucide-react";

// Geographic GPS coordinates
const PLANT_COORDS: Record<string, { lat: number; lng: number; x: number; y: number; name: string }> = {
  PNQ: { lat: 18.5204, lng: 73.8567, x: 25.5, y: 56.0, name: "Pune Plant" },
  RYG: { lat: 12.6815, lng: 101.2816, x: 55.5, y: 66.0, name: "Rayong Plant" },
  NGO: { lat: 35.1815, lng: 136.9066, x: 86.5, y: 38.0, name: "Nagoya Plant" },
};

const SUPPLIER_NODES = [
  {
    id: "TPE",
    label: "Taiwan (TPE)",
    supplierName: "Formosa Semiconductor",
    flag: "🇹🇼",
    role: "Tier-1 Gate-Driver ICs",
    statusText: "Disrupted (Typhoon Path)",
    isWarning: true,
    lat: 25.033,
    lng: 121.5654,
    x: 74.3,
    y: 55.0,
    type: "tier1" as const,
  },
  {
    id: "PEN",
    label: "Penang (PEN)",
    supplierName: "Penang Electronics",
    flag: "🇲🇾",
    role: "Alt Qualified IC Supplier",
    statusText: "Active Alternate Corridor",
    isWarning: false,
    lat: 5.4164,
    lng: 100.3327,
    x: 53.5,
    y: 78.0,
    type: "alt" as const,
  },
];

const DISRUPTIONS = [
  {
    id: "typhoon-haikui-2",
    name: "Typhoon Haikui-2",
    category: "Cat 3 Tropical Cyclone",
    wind: "175 km/h",
    lat: 23.8,
    lng: 124.5,
    x: 77.0,
    y: 48.0,
  },
];

// Google Maps Tactical Dark Night Styling
const GOOGLE_MAPS_DARK_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#0b121e" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0b121e" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#7488a6" }] },
  { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#94a3b8" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "road", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "administrative.country", elementType: "geometry.stroke", stylers: [{ color: "#1f2d42" }] },
  { featureType: "administrative.province", elementType: "geometry.stroke", stylers: [{ color: "#162032" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#060a12" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#334155" }] },
];

interface PlantMapProps {
  plants: PlantInfo[];
  className?: string;
}

export function PlantMap({ plants, className }: PlantMapProps) {
  const { selectedPlant, setSelectedPlant } = useAppStore();
  const mapRef = useRef<HTMLDivElement>(null);
  const [googleMapsLoaded, setGoogleMapsLoaded] = useState(false);
  const [mapEngine, setMapEngine] = useState<"google" | "vector">("vector");
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);
  const [activeKey, setActiveKey] = useState<string>("");
  const [keyInput, setKeyInput] = useState<string>("");
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [keyError, setKeyError] = useState<string | null>(null);

  // 1. Initial key detection (localStorage -> build-time env -> runtime API)
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Check localStorage
    const saved = localStorage.getItem("GEMBAOS_MAPS_KEY");
    if (saved) {
      setActiveKey(saved);
      return;
    }

    // Check build-time env
    const buildKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (buildKey) {
      setActiveKey(buildKey);
      return;
    }

    // Fetch dynamic runtime key from Cloud Run environment variables
    fetch("/api/maps-key")
      .then((res) => res.json())
      .then((data) => {
        if (data?.key) {
          setActiveKey(data.key);
        }
      })
      .catch(() => {});
  }, []);

  // 2. Load Google Maps JS SDK when key is present
  useEffect(() => {
    if (!activeKey || typeof window === "undefined") return;

    if ((window as any).google?.maps) {
      setGoogleMapsLoaded(true);
      setMapEngine("google");
      return;
    }

    // Catch Google Maps auth failures
    (window as any).gm_authFailure = () => {
      console.warn("Google Maps authentication failure. Falling back to Tactical Vector Map.");
      setKeyError("Google Maps authentication error. Please verify your API key.");
      setMapEngine("vector");
    };

    const scriptId = "google-maps-js-sdk";
    const existing = document.getElementById(scriptId);
    if (existing) {
      existing.remove();
    }

    const script = document.createElement("script");
    script.id = scriptId;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(activeKey)}&libraries=geometry`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      setGoogleMapsLoaded(true);
      setMapEngine("google");
      setKeyError(null);
    };
    script.onerror = () => {
      console.warn("Google Maps JS API failed to load; using High-Fidelity Tactical Vector fallback.");
      setKeyError("Failed to load Google Maps script. Check network or key restrictions.");
      setMapEngine("vector");
    };
    document.head.appendChild(script);
  }, [activeKey]);

  // Initialize Google Maps instance when active
  useEffect(() => {
    if (mapEngine !== "google" || !googleMapsLoaded || !mapRef.current) return;
    const google = (window as any).google;
    if (!google?.maps) return;

    try {
      const map = new google.maps.Map(mapRef.current, {
        center: { lat: 21.5, lng: 104.0 }, // Center over SE Asia / East Asia corridor
        zoom: 4,
        minZoom: 3,
        maxZoom: 9,
        styles: GOOGLE_MAPS_DARK_STYLE,
        disableDefaultUI: true,
        zoomControl: true,
        backgroundColor: "#060a12",
      });

      // Markers for Plants
      plants.forEach((plant) => {
        const coord = PLANT_COORDS[plant.id];
        if (!coord) return;

        const isWarning =
          plant.status === "warning" ||
          plant.status === "attention" ||
          plant.status === "ATTENTION_REQUIRED" ||
          (plant.active_anomalies && plant.active_anomalies > 0);

        const markerColor = isWarning ? "#e8a838" : "#3ecf8e";

        const marker = new google.maps.Marker({
          position: { lat: coord.lat, lng: coord.lng },
          map,
          title: `${plant.name} (${plant.id})`,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            fillColor: markerColor,
            fillOpacity: 1,
            strokeColor: "#ffffff",
            strokeWeight: 1.5,
            scale: 7,
          },
        });

        const infoWindow = new google.maps.InfoWindow({
          content: `
            <div style="background:#0b111e; color:#e2e8f0; padding:8px 12px; border-radius:8px; font-family:sans-serif; font-size:12px;">
              <strong style="color:#ffffff;">${plant.flag || ""} ${plant.name} (${plant.id})</strong>
              <div style="margin-top:4px; font-size:11px; color:${isWarning ? '#f59e0b' : '#10b981'};">
                Status: ${isWarning ? "Attention Required" : "Normal Operation"}
              </div>
              <div style="font-size:10px; color:#64748b; margin-top:2px;">Timezone: ${plant.timezone || "UTC"}</div>
            </div>
          `,
        });

        marker.addListener("click", () => {
          setSelectedPlant(plant.id);
          infoWindow.open(map, marker);
        });
      });

      // Markers for Suppliers (Taiwan & Penang)
      SUPPLIER_NODES.forEach((supplier) => {
        const marker = new google.maps.Marker({
          position: { lat: supplier.lat, lng: supplier.lng },
          map,
          title: `${supplier.flag} ${supplier.supplierName} (${supplier.id})`,
          icon: {
            path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
            fillColor: supplier.isWarning ? "#e8a838" : "#38bdf8",
            fillOpacity: 1,
            strokeColor: "#ffffff",
            strokeWeight: 1.5,
            scale: 6,
          },
        });

        const infoWindow = new google.maps.InfoWindow({
          content: `
            <div style="background:#0b111e; color:#e2e8f0; padding:8px 12px; border-radius:8px; font-family:sans-serif; font-size:12px;">
              <strong style="color:#ffffff;">${supplier.flag} ${supplier.supplierName} (${supplier.id})</strong>
              <div style="margin-top:4px; font-size:11px; color:#38bdf8;">Role: ${supplier.role}</div>
              <div style="margin-top:2px; font-size:10px; color:${supplier.isWarning ? '#f59e0b' : '#10b981'};">Status: ${supplier.statusText}</div>
            </div>
          `,
        });

        marker.addListener("click", () => {
          infoWindow.open(map, marker);
        });
      });

      // Supply Line Arcs
      // Primary Corridor: Taiwan -> Nagoya
      new google.maps.Polyline({
        path: [
          { lat: 25.033, lng: 121.5654 }, // Taipei, Taiwan
          { lat: 35.1815, lng: 136.9066 }, // Nagoya
        ],
        geodesic: true,
        strokeColor: "#7c8fff",
        strokeOpacity: 0.8,
        strokeWeight: 2,
        map,
      });

      // Disrupted Corridor (Typhoon Path): Taiwan -> Pune
      new google.maps.Polyline({
        path: [
          { lat: 25.033, lng: 121.5654 }, // Taipei, Taiwan
          { lat: 18.5204, lng: 73.8567 }, // Pune
        ],
        geodesic: true,
        strokeColor: "#f59e0b",
        strokeOpacity: 0.7,
        strokeWeight: 1.5,
        map,
      });

      // Disrupted Corridor (Typhoon Path): Taiwan -> Rayong
      new google.maps.Polyline({
        path: [
          { lat: 25.033, lng: 121.5654 }, // Taipei, Taiwan
          { lat: 12.6815, lng: 101.2816 }, // Rayong
        ],
        geodesic: true,
        strokeColor: "#f59e0b",
        strokeOpacity: 0.7,
        strokeWeight: 1.5,
        map,
      });

      // Active Alternate Corridor: Penang, Malaysia -> Pune (Emergency PO)
      new google.maps.Polyline({
        path: [
          { lat: 5.4164, lng: 100.3327 }, // Penang, Malaysia
          { lat: 18.5204, lng: 73.8567 }, // Pune
        ],
        geodesic: true,
        strokeColor: "#3ecf8e",
        strokeOpacity: 0.9,
        strokeWeight: 2.2,
        map,
      });

      // Active Alternate Corridor: Penang, Malaysia -> Rayong (Emergency PO)
      new google.maps.Polyline({
        path: [
          { lat: 5.4164, lng: 100.3327 }, // Penang, Malaysia
          { lat: 12.6815, lng: 101.2816 }, // Rayong
        ],
        geodesic: true,
        strokeColor: "#3ecf8e",
        strokeOpacity: 0.9,
        strokeWeight: 2.2,
        map,
      });

      // Typhoon Disruption Zone
      new google.maps.Circle({
        strokeColor: "#a855f7",
        strokeOpacity: 0.8,
        strokeWeight: 1.5,
        fillColor: "#7e22ce",
        fillOpacity: 0.25,
        map,
        center: { lat: 23.8, lng: 124.5 },
        radius: 320000, // 320km radius
      });
    } catch (err) {
      console.warn("Google Maps init exception, falling back to Vector view:", err);
      setMapEngine("vector");
    }
  }, [mapEngine, googleMapsLoaded, plants, setSelectedPlant]);

  return (
    <div className={cn("relative w-full h-full bg-[#070b13] border border-base-300 rounded-xl overflow-hidden shadow-lg select-none", className)}>
      {/* Google Maps Container (Used when Google Maps is active) */}
      {mapEngine === "google" && (
        <div ref={mapRef} className="w-full h-full min-h-[500px]" style={{ minHeight: "520px" }} />
      )}

      {/* High-Fidelity Tactical Digital Twin Vector Engine (Fallback & Instant Zero-Key Mode) */}
      {mapEngine === "vector" && (
        <div className="relative w-full h-full overflow-hidden bg-[#070b13]">
          {/* Subtle Geospatial Grid */}
          <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px] opacity-40 pointer-events-none" />

          {/* Real Geographic Vector Landmasses & Navigation Arcs (Asia-Pacific Manufacturing Corridor) */}
          <svg viewBox="0 0 1000 500" className="w-full h-full" preserveAspectRatio="none">
            <defs>
              {/* Landmass gradient */}
              <linearGradient id="landGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#141d2b" />
                <stop offset="100%" stopColor="#0f1724" />
              </linearGradient>

              {/* Supply chain flow glow filter */}
              <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="2" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Geographic Landmass Outlines */}
            {/* 1. Indian Subcontinent */}
            <path
              d="M 170 140 Q 220 150 260 210 Q 300 240 280 300 Q 260 360 250 400 Q 235 430 220 410 Q 180 330 160 270 Q 140 210 170 140 Z"
              fill="url(#landGradient)"
              stroke="#223147"
              strokeWidth="1.2"
              className="transition-colors hover:stroke-cyan-500/40"
            />
            {/* Sri Lanka */}
            <ellipse cx="250" cy="445" rx="8" ry="14" fill="url(#landGradient)" stroke="#223147" strokeWidth="1" />

            {/* 2. East Asia Mainland (China, Korea, Russia Coast) */}
            <path
              d="M 280 140 Q 340 120 450 110 Q 560 100 680 90 Q 770 80 840 70 L 860 130 Q 820 150 780 170 Q 750 190 730 220 L 710 260 Q 640 270 590 270 Q 540 260 480 280 Q 420 270 360 250 Q 310 210 280 140 Z"
              fill="url(#landGradient)"
              stroke="#223147"
              strokeWidth="1.2"
            />

            {/* 3. Southeast Asia & Indochina (Thailand, Vietnam, Myanmar, Malaysia) */}
            <path
              d="M 480 280 Q 530 270 580 280 Q 610 320 620 370 Q 580 380 560 360 Q 550 400 540 460 Q 530 480 520 450 Q 535 390 530 350 Q 500 340 480 320 Z"
              fill="url(#landGradient)"
              stroke="#223147"
              strokeWidth="1.2"
            />

            {/* 4. Japanese Archipelago (Nagoya hub) */}
            <path
              d="M 830 160 Q 850 140 880 130 Q 890 150 860 180 Q 840 210 810 230 Q 795 245 780 235 Q 800 200 830 160 Z"
              fill="url(#landGradient)"
              stroke="#223147"
              strokeWidth="1.2"
            />
            <ellipse cx="880" cy="115" rx="22" ry="14" fill="url(#landGradient)" stroke="#223147" strokeWidth="1" />

            {/* 5. Taiwan Island (Tier-1 Semiconductor & Electronics Supply Node) */}
            <path
              d="M 740 255 Q 752 270 748 295 Q 736 298 734 275 Z"
              fill="url(#landGradient)"
              stroke="#38bdf8"
              strokeWidth="1.5"
            />

            {/* 6. Philippine Archipelago */}
            <ellipse cx="760" cy="360" rx="14" ry="24" fill="url(#landGradient)" stroke="#223147" strokeWidth="1" />
            <ellipse cx="780" cy="410" rx="16" ry="22" fill="url(#landGradient)" stroke="#223147" strokeWidth="1" />

            {/* 7. Indonesian Archipelago (Sumatra, Java, Borneo) */}
            <path d="M 460 480 Q 520 490 580 520" stroke="#223147" strokeWidth="3" fill="none" opacity="0.6" />
            <ellipse cx="650" cy="460" rx="36" ry="28" fill="url(#landGradient)" stroke="#223147" strokeWidth="1" />

            {/* Active Maritime Supply Chain Arcs (Live Flows) */}
            {/* Primary Corridor: Taiwan (TPE) -> Nagoya (NGO) */}
            <path
              d="M 745 275 Q 800 240 865 190"
              stroke="#7c8fff"
              strokeWidth="1.8"
              strokeDasharray="6 4"
              fill="none"
              opacity="0.85"
              className="animate-pulse"
            />

            {/* Disrupted Primary Corridor: Taiwan (TPE) -> Pune (PNQ) - At Risk due to Typhoon Haikui-2 */}
            <path
              d="M 745 275 Q 520 220 255 280"
              stroke="#f59e0b"
              strokeWidth="1.8"
              strokeDasharray="6 4"
              fill="none"
              opacity="0.75"
            />

            {/* Disrupted Primary Corridor: Taiwan (TPE) -> Rayong (RYG) - At Risk due to Typhoon Haikui-2 */}
            <path
              d="M 745 275 Q 650 310 555 330"
              stroke="#f59e0b"
              strokeWidth="1.8"
              strokeDasharray="6 4"
              fill="none"
              opacity="0.75"
            />

            {/* Active Mitigation Route: Penang, Malaysia (PEN) -> Pune (PNQ) - Emergency Air/Sea Expedite */}
            <path
              d="M 535 390 Q 380 370 255 280"
              stroke="#3ecf8e"
              strokeWidth="2.2"
              strokeDasharray="5 5"
              fill="none"
              opacity="0.95"
              filter="url(#glow)"
            />

            {/* Active Mitigation Route: Penang, Malaysia (PEN) -> Rayong, Thailand (RYG) - Alternate Regional Corridor */}
            <path
              d="M 535 390 Q 542 360 555 330"
              stroke="#3ecf8e"
              strokeWidth="2.2"
              strokeDasharray="5 5"
              fill="none"
              opacity="0.95"
              filter="url(#glow)"
            />
          </svg>

          {/* Supplier Nodes (Taiwan & Penang) */}
          {SUPPLIER_NODES.map((node) => (
            <div
              key={node.id}
              className="absolute group cursor-pointer -translate-x-1/2 -translate-y-1/2 z-20"
              style={{ left: `${node.x}%`, top: `${node.y}%` }}
              onMouseEnter={() => setActiveTooltip(node.id)}
              onMouseLeave={() => setActiveTooltip(null)}
            >
              <div className="relative flex items-center">
                {/* Ping Ring for Warning/Activity */}
                {node.isWarning ? (
                  <span className="absolute -inset-1 rounded-full bg-warning animate-ping opacity-75" />
                ) : (
                  <span className="absolute -inset-1 rounded-full bg-sky-400 animate-pulse opacity-40" />
                )}

                {/* Node Diamond */}
                <div
                  className={cn(
                    "w-3.5 h-3.5 rotate-45 transition-all duration-300 relative z-10 border-2 shadow-md",
                    node.isWarning
                      ? "bg-[#e8a838] border-yellow-200 ring-4 ring-[#e8a838]/30"
                      : "bg-sky-400 border-sky-100 ring-4 ring-sky-400/30"
                  )}
                />

                {/* Supplier Badge */}
                <div
                  className={cn(
                    "ml-2.5 px-2 py-0.5 rounded text-[11px] font-semibold shadow-lg whitespace-nowrap flex items-center gap-1.5 transition-all border",
                    node.isWarning
                      ? "bg-base-300/95 text-amber-300 border-amber-500/40 hover:border-amber-400"
                      : "bg-base-300/95 text-sky-200 border-sky-400/40 hover:border-sky-300"
                  )}
                >
                  <span>{node.flag}</span>
                  <span>{node.label}</span>
                  {node.isWarning && <span className="w-1.5 h-1.5 rounded-full bg-warning animate-pulse" />}
                </div>
              </div>

              {/* Hover Tooltip */}
              {activeTooltip === node.id && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-30 pointer-events-none">
                  <div className="bg-base-300/95 backdrop-blur-md rounded-xl px-3 py-2 text-xs whitespace-nowrap shadow-2xl border border-white/10">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-bold text-white text-sm">
                        {node.flag} {node.supplierName}
                      </span>
                      <span className="font-mono text-[10px] text-sky-300 font-semibold bg-sky-950/60 px-1.5 py-0.5 rounded border border-sky-400/30">
                        {node.type === "tier1" ? "TIER-1 SUPPLIER" : "QUALIFIED ALTERNATE"}
                      </span>
                    </div>
                    <div className="mt-1 text-[11px] text-base-content/70">
                      Component: <span className="text-white font-mono font-medium">{node.role}</span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5">
                      <span
                        className={cn(
                          "w-2 h-2 rounded-full",
                          node.isWarning ? "bg-warning animate-pulse" : "bg-success"
                        )}
                      />
                      <span className={cn("text-[10px] font-medium", node.isWarning ? "text-warning" : "text-success")}>
                        {node.statusText}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Typhoon Disruption Alert Beacon */}
          {DISRUPTIONS.map((d) => (
            <div
              key={d.id}
              className="absolute -translate-x-1/2 -translate-y-1/2 z-10 cursor-pointer"
              style={{ left: `${d.x}%`, top: `${d.y}%` }}
              onMouseEnter={() => setActiveTooltip(d.id)}
              onMouseLeave={() => setActiveTooltip(null)}
            >
              <div className="relative flex items-center justify-center">
                {/* Expanding Radar Rings */}
                <div className="w-14 h-14 rounded-full border border-purple-500/30 bg-purple-950/20 animate-ping opacity-40 absolute" />
                <div className="w-9 h-9 rounded-full border border-purple-400/60 bg-purple-900/30 flex items-center justify-center backdrop-blur-xs">
                  <span className="text-base select-none">🌀</span>
                </div>
                <div className="absolute left-full ml-2 bg-purple-950/90 border border-purple-500/40 text-purple-200 text-[10px] font-mono px-2 py-0.5 rounded shadow-lg whitespace-nowrap">
                  {d.name} ({d.wind})
                </div>
              </div>

              {activeTooltip === d.id && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-30 pointer-events-none">
                  <div className="bg-purple-950/95 backdrop-blur-md rounded-lg px-3 py-2 text-xs whitespace-nowrap shadow-xl border border-purple-500/40 text-purple-100">
                    <div className="font-bold flex items-center gap-1.5 text-purple-300">
                      <span>🌀</span> {d.name} — {d.category}
                    </div>
                    <p className="text-[11px] text-purple-200/80 mt-1">
                      Max Sustained Winds: {d.wind} · Bearing: WNW
                    </p>
                    <p className="text-[10px] text-amber-300 mt-0.5 font-medium">
                      Port Disruptions: Kaohsiung & Keelung · Maritime Reroutes Active
                    </p>
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Manufacturing Plants */}
          {plants.map((plant) => {
            const coord = PLANT_COORDS[plant.id] || { x: 50, y: 50, name: plant.name };
            const isWarning =
              plant.status === "warning" ||
              plant.status === "attention" ||
              plant.status === "ATTENTION_REQUIRED" ||
              (plant.active_anomalies && plant.active_anomalies > 0);

            const isSelected = selectedPlant === plant.id;

            return (
              <div
                key={plant.id}
                className="absolute group cursor-pointer -translate-x-1/2 -translate-y-1/2 z-20"
                style={{ left: `${coord.x}%`, top: `${coord.y}%` }}
                onClick={() => setSelectedPlant(isSelected ? "ALL" : plant.id)}
                onMouseEnter={() => setActiveTooltip(plant.id)}
                onMouseLeave={() => setActiveTooltip(null)}
              >
                <div className="relative flex items-center">
                  {/* Ping Ring for Warning */}
                  {isWarning && (
                    <span className="absolute -inset-1 rounded-full bg-warning animate-ping opacity-75" />
                  )}

                  {/* Node Dot */}
                  <div
                    className={cn(
                      "w-3.5 h-3.5 rounded-full transition-all duration-300 relative z-10 border-2",
                      isWarning
                        ? "bg-[#e8a838] border-yellow-200 ring-4 ring-[#e8a838]/30"
                        : "bg-[#3ecf8e] border-emerald-100 ring-4 ring-[#3ecf8e]/30",
                      isSelected && "scale-125 ring-8 ring-primary/40"
                    )}
                  />

                  {/* Plant Badge */}
                  <div
                    className={cn(
                      "ml-2 px-2 py-0.5 rounded text-[11px] font-semibold shadow-lg whitespace-nowrap flex items-center gap-1.5 transition-all border",
                      isSelected
                        ? "bg-primary text-primary-content border-primary"
                        : "bg-base-300/90 text-base-content border-white/10 hover:border-white/30"
                    )}
                  >
                    <span>{plant.flag || "🏭"}</span>
                    <span>{plant.id}</span>
                    {isWarning && <span className="w-1.5 h-1.5 rounded-full bg-warning animate-pulse" />}
                  </div>
                </div>

                {/* Hover Details Card */}
                {activeTooltip === plant.id && (
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-30 pointer-events-none">
                    <div className="bg-base-300/95 backdrop-blur-md rounded-xl px-3 py-2 text-xs whitespace-nowrap shadow-2xl border border-white/10">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-bold text-white text-sm">
                          {plant.flag ? `${plant.flag} ` : ""}{plant.name}
                        </span>
                        <span className="font-mono text-[10px] text-base-content/60">
                          {plant.id}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <span
                          className={cn(
                            "inline-block w-2 h-2 rounded-full",
                            isWarning ? "bg-warning animate-pulse" : "bg-success"
                          )}
                        />
                        <span className="text-[11px] font-medium text-base-content/80">
                          {isWarning ? "Attention Required (CNC-07)" : "Normal Telemetry Baseline"}
                        </span>
                      </div>
                      {plant.timezone && (
                        <p className="text-[10px] text-base-content/50 font-mono mt-1">
                          Timezone: {plant.timezone}
                        </p>
                      )}
                      <p className="text-[9px] text-primary mt-1 font-semibold">
                        Click to filter dashboard by {plant.name}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Top Header & Engine Status Indicator */}
      <div className="absolute top-3 left-3 right-3 flex items-center justify-between z-30 pointer-events-auto">
        <div className="flex items-center gap-2 bg-base-300/80 backdrop-blur-md border border-white/10 px-2.5 py-1 rounded-lg text-[10px] text-base-content/80 shadow">
          <Globe className="w-3.5 h-3.5 text-primary animate-pulse" />
          <span className="font-semibold text-white">Global Manufacturing Digital Twin</span>
          <span className="text-base-content/40 hidden sm:inline">|</span>
          <span className="text-base-content/60 hidden sm:inline font-mono">Asia-Pacific Operations Network</span>
        </div>

        {/* Engine Switcher / Indicator */}
        <div className="flex items-center gap-1.5 bg-base-300/90 backdrop-blur-md border border-white/10 px-2.5 py-1 rounded-lg text-[10px]">
          {googleMapsLoaded ? (
            <button
              onClick={() => setMapEngine(mapEngine === "google" ? "vector" : "google")}
              className="flex items-center gap-1.5 font-mono font-medium text-primary hover:underline cursor-pointer"
              title="Toggle between Google Maps JS API and Tactical Vector Digital Twin"
            >
              <Navigation className="w-3 h-3" />
              <span>{mapEngine === "google" ? "Google Maps (Active)" : "Switch to Google Maps"}</span>
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1 font-mono text-[10px] text-base-content/70">
                <Sparkles className="w-2.5 h-2.5 text-primary" />
                <span>Tactical GeoTwin</span>
              </span>
              <button
                onClick={() => setShowKeyModal(true)}
                className="flex items-center gap-1 text-[10px] text-primary hover:text-primary-focus font-medium bg-primary/10 hover:bg-primary/20 px-1.5 py-0.5 rounded border border-primary/30 transition-colors cursor-pointer"
                title="Connect Google Maps JavaScript API Key"
              >
                <Key className="w-2.5 h-2.5" />
                <span>Connect Google Maps</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Google Maps API Key Modal */}
      {showKeyModal && (
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-base-200 border border-base-300 rounded-2xl p-5 max-w-md w-full shadow-2xl text-left">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-white text-sm">
                <Key className="w-4 h-4 text-primary" />
                <span>Connect Google Maps JavaScript API</span>
              </div>
              <button
                onClick={() => setShowKeyModal(false)}
                className="btn btn-ghost btn-xs btn-circle text-base-content/50 hover:text-base-content"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-base-content/70 mt-2 leading-relaxed">
              Enter your Google Cloud Maps JavaScript API Key below to activate satellite/street tactical night-mode tiles.
            </p>

            <div className="mt-3">
              <input
                type="text"
                placeholder="AIzaSy..."
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                className="input input-sm input-bordered w-full font-mono text-xs bg-base-300"
              />
            </div>

            {keyError && (
              <p className="text-[11px] text-error mt-2 font-mono">{keyError}</p>
            )}

            <div className="mt-4 flex items-center justify-between text-[11px]">
              <span className="text-base-content/40 font-mono">
                Tip: Can also set GOOGLE_MAPS_API_KEY in Cloud Run
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowKeyModal(false)}
                  className="btn btn-ghost btn-xs"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (keyInput.trim()) {
                      localStorage.setItem("GEMBAOS_MAPS_KEY", keyInput.trim());
                      setActiveKey(keyInput.trim());
                      setShowKeyModal(false);
                    }
                  }}
                  disabled={!keyInput.trim()}
                  className="btn btn-primary btn-xs text-white"
                >
                  <Check className="w-3 h-3" />
                  Activate
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Tactical Legend & Telemetry Bar */}
      <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-[10px] text-base-content/60 bg-base-300/75 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10 z-30 pointer-events-auto">
        <div className="flex items-center gap-4 flex-wrap">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#3ecf8e] inline-block shadow-sm shadow-emerald-400/50" />
            <span className="text-base-content/80">Operational Plant</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#e8a838] inline-block animate-pulse shadow-sm shadow-amber-400/50" />
            <span className="text-base-content/80">Anomaly Alert</span>
          </span>
          <span className="flex items-center gap-1.5 text-sky-400">
            <span className="w-2 h-2 rotate-45 border border-sky-400 bg-sky-400/50 inline-block" />
            <span>Tier-1 Supplier</span>
          </span>
          <span className="flex items-center gap-1.5 text-purple-400">
            <span>🌀</span>
            <span>Typhoon Haikui-2 (Disruption)</span>
          </span>
          <span className="flex items-center gap-1.5 text-emerald-400 hidden md:inline-flex">
            <span className="w-3 h-0.5 bg-emerald-400 border-dashed inline-block" />
            <span>Active Supply Route</span>
          </span>
        </div>

        <div className="hidden lg:flex items-center gap-2 font-mono text-[9px] text-base-content/40">
          <span>LAT/LNG WGS-84</span>
          <span>·</span>
          <span>REAL-TIME TELEMETRY</span>
        </div>
      </div>
    </div>
  );
}
