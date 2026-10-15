"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  Globe,
  MapPin,
  Sparkles,
  Navigation,
  Key,
  X,
  Check,
  AlertTriangle,
  Anchor,
  Factory,
  Building2,
  Layers,
  Wind,
  Truck,
  ArrowRight
} from "lucide-react";

export interface SupplyNode {
  id: string;
  label: string;
  name: string;
  type: "supplier" | "port" | "plant" | "customer";
  country: string;
  flag: string;
  lat: number;
  lng: number;
  x: number; // Percentage for vector fallback (0-100)
  y: number;
  risk: "critical" | "high" | "warn" | "ok";
  details: string;
  product?: string;
  leadTime?: string;
}

export interface SupplyEdge {
  id: string;
  from: string;
  to: string;
  type: "sea" | "air" | "road";
  risk: "critical" | "warn" | "ok" | "alternate";
  statusText: string;
}

export const SUPPLY_NODES: SupplyNode[] = [
  {
    id: "SUP-FORMOSA",
    label: "Formosa Semicon",
    name: "Formosa Semiconductor Corp",
    type: "supplier",
    country: "Taiwan",
    flag: "🇹🇼",
    lat: 24.78,
    lng: 120.99,
    x: 74.3,
    y: 53.5,
    risk: "critical",
    details: "Tier-1 Gate-Driver ICs (IC-GD-01). 48h landfall shutdown.",
    product: "Gate-Driver ICs",
    leadTime: "18 days (Frozen)"
  },
  {
    id: "PORT-KEE",
    label: "Keelung Port",
    name: "Port of Keelung (TWKEL)",
    type: "port",
    country: "Taiwan",
    flag: "🇹🇼",
    lat: 25.13,
    lng: 121.74,
    x: 75.8,
    y: 52.0,
    risk: "critical",
    details: "Maritime port closed due to Typhoon Haikui-2 storm surge.",
    product: "Sea Freight Export",
    leadTime: "Berth Delay: +72h"
  },
  {
    id: "SUP-PENANG",
    label: "Penang Micro",
    name: "Penang Semiconductor Lab",
    type: "supplier",
    country: "Malaysia",
    flag: "🇲🇾",
    lat: 5.31,
    lng: 100.29,
    x: 53.0,
    y: 77.0,
    risk: "ok",
    details: "Pre-qualified alternative IC foundry with available fab capacity.",
    product: "IC-GD-01 Alternate",
    leadTime: "4 days (Air Freight)"
  },
  {
    id: "PORT-PEN",
    label: "Penang Port",
    name: "Penang Maritime Hub",
    type: "port",
    country: "Malaysia",
    flag: "🇲🇾",
    lat: 5.416,
    lng: 100.366,
    x: 54.0,
    y: 75.5,
    risk: "ok",
    details: "Active emergency freight routing hub dispatching air & sea parcels.",
    product: "Multi-modal Port",
    leadTime: "Normal (24h clearance)"
  },
  {
    id: "SUP-NSK",
    label: "NSK Japan",
    name: "NSK Precision Bearings",
    type: "supplier",
    country: "Japan",
    flag: "🇯🇵",
    lat: 35.68,
    lng: 139.76,
    x: 88.0,
    y: 36.5,
    risk: "ok",
    details: "Bearing 6205-C3 supplier for CNC-07 spindle maintenance.",
    product: "Spindle Bearings",
    leadTime: "3 days (Express)"
  },
  {
    id: "PNQ",
    label: "Pune Plant",
    name: "GembaOS Pune Facility",
    type: "plant",
    country: "India",
    flag: "🇮🇳",
    lat: 18.5204,
    lng: 73.8567,
    x: 25.5,
    y: 56.0,
    risk: "warn",
    details: "Traction inverter assembly line. Stock-out buffer: 9 days.",
    product: "TM-300 Inverters",
    leadTime: "Line L1 Active"
  },
  {
    id: "RYG",
    label: "Rayong Plant",
    name: "GembaOS Rayong Facility",
    type: "plant",
    country: "Thailand",
    flag: "🇹🇭",
    lat: 12.6815,
    lng: 101.2816,
    x: 56.5,
    y: 66.0,
    risk: "ok",
    details: "Die-casting & housing sub-assembly. 45-day ingot inventory.",
    product: "Aluminium Housings",
    leadTime: "Line R1 Stable"
  },
  {
    id: "NGO",
    label: "Nagoya Plant",
    name: "GembaOS Nagoya Facility",
    type: "plant",
    country: "Japan",
    flag: "🇯🇵",
    lat: 35.1815,
    lng: 136.9066,
    x: 85.5,
    y: 38.0,
    risk: "ok",
    details: "Motor stator winding & precision assembly facility.",
    product: "Stators & Rotors",
    leadTime: "Line N1 Stable"
  },
  {
    id: "CUST-ZENITH",
    label: "Zenith Motors",
    name: "Zenith Automotive EV",
    type: "customer",
    country: "India",
    flag: "🇮🇳",
    lat: 13.0827,
    lng: 80.2707,
    x: 28.5,
    y: 65.5,
    risk: "warn",
    details: "SO-1001: 500 units TM-300 due Oct 25. Risk of $1.82M breach.",
    product: "Customer Order #1001",
    leadTime: "Due: 10 Days"
  },
  {
    id: "CUST-KIRIN",
    label: "Kirin Mobility",
    name: "Kirin Mobility Tokyo",
    type: "customer",
    country: "Japan",
    flag: "🇯🇵",
    lat: 35.6762,
    lng: 139.6503,
    x: 90.0,
    y: 34.0,
    risk: "ok",
    details: "SO-1002: 800 motor assemblies. Fully protected via Nagoya buffer.",
    product: "Customer Order #1002",
    leadTime: "On Schedule"
  }
];

export const SUPPLY_EDGES: SupplyEdge[] = [
  {
    id: "e-tw-kee",
    from: "SUP-FORMOSA",
    to: "PORT-KEE",
    type: "road",
    risk: "critical",
    statusText: "Disrupted (Typhoon Surge)"
  },
  {
    id: "e-kee-pnq",
    from: "PORT-KEE",
    to: "PNQ",
    type: "sea",
    risk: "critical",
    statusText: "Suspended Maritime Shipping"
  },
  {
    id: "e-pen-port",
    from: "SUP-PENANG",
    to: "PORT-PEN",
    type: "road",
    risk: "ok",
    statusText: "Immediate Dispatch Corridor"
  },
  {
    id: "e-pen-pnq",
    from: "PORT-PEN",
    to: "PNQ",
    type: "air",
    risk: "alternate",
    statusText: "Emergency Air Freight ($45k)"
  },
  {
    id: "e-pen-ryg",
    from: "PORT-PEN",
    to: "RYG",
    type: "sea",
    risk: "alternate",
    statusText: "Backup Feeder Vessel"
  },
  {
    id: "e-nsk-pnq",
    from: "SUP-NSK",
    to: "PNQ",
    type: "air",
    risk: "ok",
    statusText: "Express Bearing Delivery"
  },
  {
    id: "e-pnq-zenith",
    from: "PNQ",
    to: "CUST-ZENITH",
    type: "road",
    risk: "ok",
    statusText: "Finished Inverter Dispatch"
  },
  {
    id: "e-ngo-kirin",
    from: "NGO",
    to: "CUST-KIRIN",
    type: "road",
    risk: "ok",
    statusText: "OEM Final Delivery"
  }
];

const riskColor: Record<string, string> = {
  critical: "#EF4444",
  high: "#F97316",
  warn: "#F59E0B",
  alternate: "#10B981",
  ok: "#38BDF8"
};

const GOOGLE_MAPS_DARK_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#080d16" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#080d16" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#64748b" }] },
  { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#94a3b8" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "road", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "administrative.country", elementType: "geometry.stroke", stylers: [{ color: "#1f2937" }] },
  { featureType: "administrative.province", elementType: "geometry.stroke", stylers: [{ color: "#111827" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#030712" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#374151" }] }
];

export interface SupplyChainMapProps {
  className?: string;
  canvasHeight?: string;
}

const DEFAULT_MAPS_KEY = "AIzaSyA3ZGIMrJCh6J1f7ST8B_yqo97Xbnv_cZ8";

export function SupplyChainMap({
  className,
  canvasHeight = "h-[450px] lg:h-[500px]",
}: SupplyChainMapProps = {}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [viewMode, setViewMode] = useState<"geospatial" | "schematic">("geospatial");
  const [googleMapsLoaded, setGoogleMapsLoaded] = useState(false);
  const [mapEngine, setMapEngine] = useState<"google" | "vector">("google");
  const [selectedNode, setSelectedNode] = useState<SupplyNode | null>(null);
  const [activeLaneFilter, setActiveLaneFilter] = useState<"all" | "disrupted" | "active">("all");
  const [activeKey, setActiveKey] = useState<string>(
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || DEFAULT_MAPS_KEY
  );
  const [keyInput, setKeyInput] = useState<string>("");
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [keyError, setKeyError] = useState<string | null>(null);

  // 1. Detect API Key (localStorage -> build-time env -> runtime API -> project key)
  useEffect(() => {
    if (typeof window === "undefined") return;

    const saved = localStorage.getItem("GEMBAOS_MAPS_KEY");
    if (saved) {
      setActiveKey(saved);
      return;
    }

    const buildKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (buildKey) {
      setActiveKey(buildKey);
      return;
    }

    fetch("/api/maps-key")
      .then((res) => res.json())
      .then((data) => {
        if (data?.key) {
          setActiveKey(data.key);
        } else {
          setActiveKey(DEFAULT_MAPS_KEY);
        }
      })
      .catch(() => {
        setActiveKey(DEFAULT_MAPS_KEY);
      });
  }, []);

  // 2. Load Google Maps SDK
  useEffect(() => {
    if (!activeKey || typeof window === "undefined") return;

    if ((window as any).google?.maps) {
      setGoogleMapsLoaded(true);
      setMapEngine("google");
      return;
    }

    (window as any).gm_authFailure = () => {
      console.warn("Google Maps auth failed. Using High-Fidelity Tactical Vector fallback.");
      setKeyError("Google Maps auth failed. Check API key restrictions.");
      setMapEngine("vector");
    };

    const scriptId = "google-maps-js-sdk";
    const existing = document.getElementById(scriptId);
    if (!existing) {
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
        setKeyError("Failed to load Google Maps SDK.");
        setMapEngine("vector");
      };
      document.head.appendChild(script);
    } else {
      setGoogleMapsLoaded(true);
      setMapEngine("google");
    }
  }, [activeKey]);

  // 3. Render Google Maps Instance
  useEffect(() => {
    if (viewMode !== "geospatial" || mapEngine !== "google" || !googleMapsLoaded || !mapRef.current) return;
    const google = (window as any).google;
    if (!google?.maps) return;

    try {
      const map = new google.maps.Map(mapRef.current, {
        center: { lat: 21.0, lng: 105.0 }, // Central Asian Logistics Corridor
        zoom: 4,
        minZoom: 3,
        maxZoom: 9,
        styles: GOOGLE_MAPS_DARK_STYLE,
        disableDefaultUI: true,
        zoomControl: true,
        backgroundColor: "#030712"
      });

      // Typhoon Haikui-2 Zone
      new google.maps.Circle({
        strokeColor: "#EF4444",
        strokeOpacity: 0.8,
        strokeWeight: 1.5,
        fillColor: "#EF4444",
        fillOpacity: 0.18,
        map,
        center: { lat: 23.8, lng: 124.5 },
        radius: 380000 // 380 km radius
      });

      // Typhoon Haikui-2 Marker with radar label
      const typhoonSvg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="120" height="42" viewBox="0 0 120 42">
          <circle cx="60" cy="13" r="9" fill="#ef4444" stroke="#ffffff" stroke-width="2"/>
          <circle cx="60" cy="13" r="4" fill="#ffffff"/>
          <rect x="5" y="24" width="110" height="16" rx="4" fill="#450a0a" stroke="#ef4444" stroke-width="1" fill-opacity="0.95"/>
          <text x="60" y="35.5" font-family="-apple-system, sans-serif" font-size="8.5" font-weight="bold" fill="#fca5a5" text-anchor="middle">
            🌀 Haikui-2 (175 km/h)
          </text>
        </svg>
      `;

      new google.maps.Marker({
        position: { lat: 23.8, lng: 124.5 },
        map,
        title: "Typhoon Haikui-2 (Cat 3 Tropical Cyclone - 175 km/h)",
        icon: {
          url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(typhoonSvg),
          scaledSize: new google.maps.Size(120, 42),
          anchor: new google.maps.Point(60, 13)
        }
      });

      // Markers for each node: custom SVG pins with clean labels
      SUPPLY_NODES.forEach((node) => {
        let markerColor = "#38BDF8";
        if (node.risk === "critical") markerColor = "#EF4444";
        else if (node.risk === "warn") markerColor = "#F59E0B";
        else if (node.id === "SUP-PENANG" || node.id === "PORT-PEN") markerColor = "#10B981";

        const nodeSvg = `
          <svg xmlns="http://www.w3.org/2000/svg" width="120" height="34" viewBox="0 0 120 34">
            <circle cx="60" cy="9" r="6.5" fill="${markerColor}" stroke="#ffffff" stroke-width="1.8"/>
            <circle cx="60" cy="9" r="2.5" fill="#ffffff"/>
            <rect x="5" y="19" width="110" height="14" rx="3" fill="#0b121e" stroke="#243042" stroke-width="1" fill-opacity="0.95"/>
            <text x="60" y="29.5" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="8" font-weight="700" fill="#e6edf3" text-anchor="middle">
              ${node.flag} ${node.label}
            </text>
          </svg>
        `;

        const marker = new google.maps.Marker({
          position: { lat: node.lat, lng: node.lng },
          map,
          title: `${node.flag} ${node.name} (${node.label})`,
          icon: {
            url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(nodeSvg),
            scaledSize: new google.maps.Size(120, 34),
            anchor: new google.maps.Point(60, 9)
          }
        });

        marker.addListener("click", () => {
          setSelectedNode(node);
        });
      });

      // Realistic Maritime & Air corridor waypoints
      const MARITIME_ROUTES: Record<string, { lat: number; lng: number }[]> = {
        "e-tw-kee": [
          { lat: 24.78, lng: 120.99 },
          { lat: 25.13, lng: 121.74 }
        ],
        "e-kee-pnq": [
          { lat: 25.13, lng: 121.74 },
          { lat: 18.0, lng: 116.0 },
          { lat: 8.5, lng: 111.0 },
          { lat: 1.5, lng: 104.5 },
          { lat: 5.5, lng: 97.5 },
          { lat: 6.0, lng: 82.0 },
          { lat: 10.0, lng: 76.0 },
          { lat: 18.5204, lng: 73.8567 }
        ],
        "e-pen-port": [
          { lat: 5.31, lng: 100.29 },
          { lat: 5.416, lng: 100.366 }
        ],
        "e-pen-pnq": [
          { lat: 5.416, lng: 100.366 },
          { lat: 6.5, lng: 95.0 },
          { lat: 9.0, lng: 83.0 },
          { lat: 18.5204, lng: 73.8567 }
        ],
        "e-pen-ryg": [
          { lat: 5.416, lng: 100.366 },
          { lat: 6.5, lng: 101.5 },
          { lat: 9.0, lng: 102.5 },
          { lat: 12.6815, lng: 101.2816 }
        ],
        "e-nsk-pnq": [
          { lat: 35.68, lng: 139.76 },
          { lat: 28.0, lng: 126.0 },
          { lat: 18.5204, lng: 73.8567 }
        ],
        "e-pnq-zenith": [
          { lat: 18.5204, lng: 73.8567 },
          { lat: 15.5, lng: 76.5 },
          { lat: 13.0827, lng: 80.2707 }
        ],
        "e-ngo-kirin": [
          { lat: 35.1815, lng: 136.9066 },
          { lat: 35.6762, lng: 139.6503 }
        ]
      };

      // Polylines for shipping lanes
      SUPPLY_EDGES.forEach((edge) => {
        if (activeLaneFilter === "disrupted" && edge.risk !== "critical") return;
        if (activeLaneFilter === "active" && edge.risk === "critical") return;

        const path = MARITIME_ROUTES[edge.id] || [
          { lat: SUPPLY_NODES.find((n) => n.id === edge.from)?.lat || 0, lng: SUPPLY_NODES.find((n) => n.id === edge.from)?.lng || 0 },
          { lat: SUPPLY_NODES.find((n) => n.id === edge.to)?.lat || 0, lng: SUPPLY_NODES.find((n) => n.id === edge.to)?.lng || 0 }
        ];

        let strokeColor = "#38BDF8";
        let strokeOpacity = 0.75;
        let strokeWeight = 2;

        if (edge.risk === "critical") {
          strokeColor = "#EF4444";
          strokeOpacity = 0.85;
          strokeWeight = 2.5;
        } else if (edge.risk === "alternate") {
          strokeColor = "#10B981";
          strokeOpacity = 0.9;
          strokeWeight = 2.5;
        }

        new google.maps.Polyline({
          path,
          geodesic: false,
          strokeColor,
          strokeOpacity,
          strokeWeight,
          map
        });
      });
    } catch (err) {
      console.warn("Failed to mount Google Maps instance:", err);
      setMapEngine("vector");
    }
  }, [viewMode, mapEngine, googleMapsLoaded, activeLaneFilter]);

  const saveCustomKey = (key: string) => {
    const trimmed = key.trim();
    if (!trimmed) {
      localStorage.removeItem("GEMBAOS_MAPS_KEY");
      setActiveKey("");
      setShowKeyModal(false);
      setMapEngine("vector");
      return;
    }
    localStorage.setItem("GEMBAOS_MAPS_KEY", trimmed);
    setActiveKey(trimmed);
    setKeyError(null);
    setShowKeyModal(false);
  };

  return (
    <div className={cn("relative w-full rounded-xl border border-[#243042] bg-[#080d16] overflow-hidden flex flex-col shadow-2xl", className)}>
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 bg-[#0c1322] border-b border-[#243042]">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shrink-0">
            <Globe className="w-3.5 h-3.5 animate-spin-slow" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h2 className="text-xs font-bold text-[#E6EDF3] tracking-wide">
                Asia-Pacific Logistics &amp; Maritime Grid
              </h2>
              <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-semibold bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
                <Navigation className="w-2.5 h-2.5 text-cyan-400" /> NAVIGATOR
              </span>
            </div>
          </div>
        </div>

        {/* Action Controls & Mode Switch */}
        <div className="flex items-center gap-2">
          {/* Mode switch */}
          <div className="bg-[#121c2e] p-0.5 rounded-lg border border-[#243042] flex items-center text-xs">
            <button
              onClick={() => setViewMode("geospatial")}
              className={cn(
                "px-2.5 py-1 rounded-md transition-all font-medium flex items-center gap-1.5",
                viewMode === "geospatial"
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-xs"
                  : "text-[#8B98A9] hover:text-[#E6EDF3]"
              )}
            >
              <Globe className="w-3.5 h-3.5" /> Geospatial Map
            </button>
            <button
              onClick={() => setViewMode("schematic")}
              className={cn(
                "px-2.5 py-1 rounded-md transition-all font-medium flex items-center gap-1.5",
                viewMode === "schematic"
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-xs"
                  : "text-[#8B98A9] hover:text-[#E6EDF3]"
              )}
            >
              <Layers className="w-3.5 h-3.5" /> Schematic Topology
            </button>
          </div>

          {/* Lane Filter */}
          <div className="hidden sm:flex items-center bg-[#121c2e] px-2 py-1 rounded-lg border border-[#243042] text-[11px] gap-1.5 text-[#8B98A9]">
            <span className="font-semibold text-xs text-[#E6EDF3]">Filter:</span>
            <button
              onClick={() => setActiveLaneFilter("all")}
              className={cn("px-1.5 py-0.5 rounded hover:text-white", activeLaneFilter === "all" && "bg-cyan-500/20 text-cyan-300")}
            >
              All Lanes
            </button>
            <button
              onClick={() => setActiveLaneFilter("disrupted")}
              className={cn("px-1.5 py-0.5 rounded hover:text-white", activeLaneFilter === "disrupted" && "bg-red-500/20 text-red-400")}
            >
              Disrupted
            </button>
            <button
              onClick={() => setActiveLaneFilter("active")}
              className={cn("px-1.5 py-0.5 rounded hover:text-white", activeLaneFilter === "active" && "bg-emerald-500/20 text-emerald-400")}
            >
              Alternate
            </button>
          </div>

          {/* Key status */}
          <button
            onClick={() => {
              setKeyInput(activeKey);
              setShowKeyModal(true);
            }}
            className="px-2.5 py-1 rounded-lg bg-[#121c2e] hover:bg-[#1a273e] border border-[#243042] text-[11px] font-medium text-[#8B98A9] hover:text-[#E6EDF3] transition-colors flex items-center gap-1.5"
            title="Google Maps API Key configuration"
          >
            <Key className="w-3 h-3 text-primary" />
            <span className="hidden md:inline">Google Maps:</span>
            <span className={cn("w-1.5 h-1.5 rounded-full", mapEngine === "google" ? "bg-emerald-400 animate-pulse" : "bg-amber-400")} />
            <span>{mapEngine === "google" ? "Live" : "Vector Twin"}</span>
          </button>
        </div>
      </div>

      {/* Main Map Canvas Area */}
      <div className={cn("relative w-full bg-[#050912]", canvasHeight)}>
        {/* VIEW 1: GEOSPATIAL MAP */}
        {viewMode === "geospatial" && (
          <>
            {mapEngine === "google" ? (
              <div ref={mapRef} className="w-full h-full" />
            ) : (
              /* High-Fidelity Tactical Geospatial Vector Fallback */
              <div className="relative w-full h-full overflow-hidden select-none bg-[radial-gradient(ellipse_at_top,#0c1524,#04070e)]">
                {/* Tactical grid background lines */}
                <div
                  className="absolute inset-0 opacity-15"
                  style={{
                    backgroundImage: `linear-gradient(to right, #1e293b 1px, transparent 1px), linear-gradient(to bottom, #1e293b 1px, transparent 1px)`,
                    backgroundSize: "40px 40px"
                  }}
                />

                {/* Continental Coastline Abstract Polygons */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
                  {/* Subtle Asian continent landmass guides */}
                  <path
                    d="M 15 20 Q 25 15 35 25 T 50 35 T 70 30 T 90 20 L 95 60 Q 80 70 65 65 T 50 85 T 30 75 Z"
                    fill="#0a1220"
                    stroke="#1a2536"
                    strokeWidth="0.4"
                    opacity="0.4"
                  />
                  
                  {/* Shipping Lane Lines */}
                  {SUPPLY_EDGES.map((edge) => {
                    if (activeLaneFilter === "disrupted" && edge.risk !== "critical") return null;
                    if (activeLaneFilter === "active" && edge.risk === "critical") return null;

                    const fromNode = SUPPLY_NODES.find((n) => n.id === edge.from);
                    const toNode = SUPPLY_NODES.find((n) => n.id === edge.to);
                    if (!fromNode || !toNode) return null;

                    const isCrit = edge.risk === "critical";
                    const isAlt = edge.risk === "alternate";

                    return (
                      <g key={edge.id}>
                        <line
                          x1={fromNode.x}
                          y1={fromNode.y}
                          x2={toNode.x}
                          y2={toNode.y}
                          stroke={isCrit ? "#EF4444" : isAlt ? "#10B981" : "#38BDF8"}
                          strokeWidth={isCrit ? "0.9" : "0.7"}
                          strokeOpacity={isCrit ? "0.9" : "0.6"}
                          strokeDasharray={isCrit ? "1.5 1" : undefined}
                        />
                      </g>
                    );
                  })}
                </svg>

                {/* Typhoon Haikui-2 Visualizer */}
                <div
                  className="absolute pointer-events-none -translate-x-1/2 -translate-y-1/2 flex items-center justify-center"
                  style={{ left: "77%", top: "48%" }}
                >
                  <div className="w-28 h-28 rounded-full border border-red-500/40 bg-red-500/10 animate-ping" />
                  <div className="absolute w-16 h-16 rounded-full border border-red-500/60 bg-red-500/20 flex flex-col items-center justify-center text-[9px] text-red-300 font-bold backdrop-blur-xs">
                    <Wind className="w-4 h-4 text-red-400 animate-spin-slow mb-0.5" />
                    <span>Haikui-2</span>
                    <span className="text-[8px] text-red-400 font-mono">175 km/h</span>
                  </div>
                </div>

                {/* Tactical Vector Nodes */}
                {SUPPLY_NODES.map((node) => {
                  const isCrit = node.risk === "critical";
                  const isWarn = node.risk === "warn";
                  const isPenangAlt = node.id === "SUP-PENANG";

                  return (
                    <div
                      key={node.id}
                      className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer group z-10"
                      style={{ left: `${node.x}%`, top: `${node.y}%` }}
                      onClick={() => setSelectedNode(node)}
                    >
                      <div className="relative flex flex-col items-center">
                        {/* Glow halo */}
                        <div
                          className={cn(
                            "w-6 h-6 rounded-full flex items-center justify-center transition-transform group-hover:scale-125 border",
                            isCrit
                              ? "bg-red-500/20 border-red-500 text-red-400"
                              : isWarn
                              ? "bg-amber-500/20 border-amber-500 text-amber-400"
                              : isPenangAlt
                              ? "bg-emerald-500/20 border-emerald-500 text-emerald-400"
                              : "bg-cyan-500/20 border-cyan-500 text-cyan-400"
                          )}
                        >
                          {node.type === "supplier" && <Building2 className="w-3 h-3" />}
                          {node.type === "port" && <Anchor className="w-3 h-3" />}
                          {node.type === "plant" && <Factory className="w-3 h-3" />}
                          {node.type === "customer" && <Truck className="w-3 h-3" />}
                        </div>

                        {/* Label Badge */}
                        <div
                          className={cn(
                            "mt-1 px-1.5 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap border shadow-lg backdrop-blur-md flex items-center gap-1",
                            isCrit
                              ? "bg-red-950/80 border-red-500 text-red-200"
                              : isWarn
                              ? "bg-amber-950/80 border-amber-500 text-amber-200"
                              : isPenangAlt
                              ? "bg-emerald-950/80 border-emerald-500 text-emerald-200"
                              : "bg-[#0b121e]/90 border-[#243042] text-[#E6EDF3]"
                          )}
                        >
                          <span>{node.flag}</span>
                          <span>{node.label}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* VIEW 2: SCHEMATIC TOPOLOGY */}
        {viewMode === "schematic" && (
          <div className="relative w-full h-full p-4 flex flex-col justify-between bg-[#080d16]">
            {/* Column Category Headers */}
            <div className="grid grid-cols-4 gap-2 text-center text-xs font-semibold text-[#8B98A9] border-b border-[#243042] pb-2">
              <div className="flex items-center justify-center gap-1.5"><Building2 className="w-3.5 h-3.5 text-cyan-400" /> Tier-1 Suppliers</div>
              <div className="flex items-center justify-center gap-1.5"><Anchor className="w-3.5 h-3.5 text-blue-400" /> Maritime Ports</div>
              <div className="flex items-center justify-center gap-1.5"><Factory className="w-3.5 h-3.5 text-emerald-400" /> GembaOS Plants</div>
              <div className="flex items-center justify-center gap-1.5"><Truck className="w-3.5 h-3.5 text-purple-400" /> OEM Customers</div>
            </div>

            {/* Topology SVG Canvas */}
            <div className="relative flex-1 mt-2">
              <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                {SUPPLY_EDGES.map((edge) => {
                  const schematicCoords: Record<string, { x: number; y: number }> = {
                    "SUP-FORMOSA": { x: 12, y: 25 },
                    "SUP-PENANG": { x: 12, y: 55 },
                    "SUP-NSK": { x: 12, y: 85 },
                    "PORT-KEE": { x: 37, y: 25 },
                    "PORT-PEN": { x: 37, y: 55 },
                    "PNQ": { x: 62, y: 40 },
                    "RYG": { x: 62, y: 70 },
                    "NGO": { x: 62, y: 90 },
                    "CUST-ZENITH": { x: 88, y: 40 },
                    "CUST-KIRIN": { x: 88, y: 80 }
                  };

                  const from = schematicCoords[edge.from];
                  const to = schematicCoords[edge.to];
                  if (!from || !to) return null;

                  const isCrit = edge.risk === "critical";
                  const isAlt = edge.risk === "alternate";

                  return (
                    <line
                      key={edge.id}
                      x1={from.x}
                      y1={from.y}
                      x2={to.x}
                      y2={to.y}
                      stroke={isCrit ? "#EF4444" : isAlt ? "#10B981" : "#38BDF8"}
                      strokeWidth={isCrit ? "0.8" : "0.5"}
                      strokeOpacity="0.7"
                      strokeDasharray={isCrit ? "2 1" : undefined}
                    />
                  );
                })}
              </svg>

              {/* Schematic Nodes Layout */}
              {[
                { id: "SUP-FORMOSA", col: 0, top: 25 },
                { id: "SUP-PENANG", col: 0, top: 55 },
                { id: "SUP-NSK", col: 0, top: 85 },
                { id: "PORT-KEE", col: 1, top: 25 },
                { id: "PORT-PEN", col: 1, top: 55 },
                { id: "PNQ", col: 2, top: 40 },
                { id: "RYG", col: 2, top: 70 },
                { id: "NGO", col: 2, top: 90 },
                { id: "CUST-ZENITH", col: 3, top: 40 },
                { id: "CUST-KIRIN", col: 3, top: 80 }
              ].map(({ id, col, top }) => {
                const node = SUPPLY_NODES.find((n) => n.id === id);
                if (!node) return null;
                const isCrit = node.risk === "critical";
                const isWarn = node.risk === "warn";
                const isAlt = node.id === "SUP-PENANG";

                return (
                  <div
                    key={node.id}
                    className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-transform hover:scale-105"
                    style={{ left: `${col * 25 + 12.5}%`, top: `${top}%` }}
                    onClick={() => setSelectedNode(node)}
                  >
                    <div
                      className={cn(
                        "px-2.5 py-1.5 rounded-lg border text-xs shadow-lg backdrop-blur-md flex items-center gap-2",
                        isCrit
                          ? "bg-red-950/90 border-red-500 text-red-200"
                          : isWarn
                          ? "bg-amber-950/90 border-amber-500 text-amber-200"
                          : isAlt
                          ? "bg-emerald-950/90 border-emerald-500 text-emerald-200"
                          : "bg-[#0f172a] border-[#334155] text-[#E6EDF3]"
                      )}
                    >
                      <span className="text-sm">{node.flag}</span>
                      <div>
                        <p className="font-semibold">{node.label}</p>
                        <p className="text-[10px] text-[#8B98A9] capitalize">{node.type}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Selected Node Details Drawer */}
        {selectedNode && (
          <div className="absolute top-3 left-3 z-30 max-w-xs w-full bg-[#0c1322]/95 border border-[#243042] rounded-xl p-3.5 shadow-2xl backdrop-blur-md text-xs space-y-2 animate-in fade-in slide-in-from-top-2">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg">{selectedNode.flag}</span>
                <div>
                  <h3 className="font-bold text-[#E6EDF3]">{selectedNode.name}</h3>
                  <p className="text-[10px] text-[#8B98A9] font-mono">{selectedNode.id} · {selectedNode.country}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedNode(null)}
                className="text-[#8B98A9] hover:text-white p-1 rounded hover:bg-[#1a273e]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="bg-[#050912] rounded-lg p-2 border border-[#1e293b] space-y-1 text-[11px]">
              <div className="flex justify-between">
                <span className="text-[#8B98A9]">Role / Output:</span>
                <span className="text-[#E6EDF3] font-medium">{selectedNode.product || selectedNode.type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#8B98A9]">Lead Time / Buffer:</span>
                <span className="text-cyan-400 font-mono font-medium">{selectedNode.leadTime || "N/A"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#8B98A9]">Status:</span>
                <span
                  className={cn(
                    "font-bold uppercase text-[10px]",
                    selectedNode.risk === "critical"
                      ? "text-red-400"
                      : selectedNode.risk === "warn"
                      ? "text-amber-400"
                      : "text-emerald-400"
                  )}
                >
                  {selectedNode.risk}
                </span>
              </div>
            </div>

            <p className="text-[11px] text-[#94a3b8] leading-relaxed">{selectedNode.details}</p>
          </div>
        )}

        {/* Legend banner: placed at top right away from Google controls */}
        <div className="absolute top-2.5 right-2.5 bg-[#0c1322]/95 border border-[#243042] rounded-lg px-2.5 py-1 text-[9px] text-[#8B98A9] flex items-center gap-2.5 backdrop-blur-md shadow-lg pointer-events-none z-10">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />
            <span>Disrupted (Typhoon)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block" />
            <span>Active Alternate</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />
            <span>Warning (Buffer &lt;14d)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 inline-block" />
            <span>Normal Operation</span>
          </div>
        </div>
      </div>

      {/* Google Maps API Key Modal */}
      {showKeyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-[#0e1626] border border-[#243042] rounded-xl max-w-md w-full p-5 shadow-2xl text-xs space-y-4">
            <div className="flex items-center justify-between border-b border-[#243042] pb-3">
              <div className="flex items-center gap-2 text-[#E6EDF3] font-semibold text-sm">
                <Key className="w-4 h-4 text-primary" />
                <span>Google Maps Configuration</span>
              </div>
              <button onClick={() => setShowKeyModal(false)} className="text-[#8B98A9] hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-[#8B98A9] leading-relaxed">
              Google Maps API keys are domain-wide. Once entered, the key applies across the Command Center, Supply Chain Control Tower, and all geospatial modules.
            </p>

            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-[#E6EDF3]">Maps JavaScript API Key</label>
              <input
                type="text"
                placeholder="AIzaSy..."
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                className="w-full bg-[#050912] border border-[#243042] rounded-lg px-3 py-2 text-xs text-[#E6EDF3] font-mono focus:outline-hidden focus:border-primary"
              />
            </div>

            {keyError && <p className="text-red-400 text-[11px]">{keyError}</p>}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#243042]">
              <button
                type="button"
                onClick={() => saveCustomKey("")}
                className="px-3 py-1.5 rounded-lg border border-[#243042] text-[#8B98A9] hover:text-white hover:bg-[#1a273e]"
              >
                Clear / Reset
              </button>
              <button
                type="button"
                onClick={() => saveCustomKey(keyInput)}
                className="px-3.5 py-1.5 rounded-lg bg-primary text-primary-foreground font-semibold flex items-center gap-1.5 hover:opacity-90"
              >
                <Check className="w-3.5 h-3.5" /> Save & Connect
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
