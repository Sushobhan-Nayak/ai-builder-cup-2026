"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, Shield, Search, CalendarDays, Compass, ShoppingCart,
  TrendingUp, Leaf, Swords, Zap, Settings, ChevronLeft, ChevronRight,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useAppStore } from "@/store/app-store";
import { fetchCurrentUser } from "@/lib/api-client";

const NAV_ITEMS = [
  { href: "/",              icon: LayoutDashboard, label: "Command Center" },
  { href: "/asset-health",  icon: Shield,          label: "Asset Health",       badge: "2" },
  { href: "/quality",       icon: Search,          label: "Quality Studio" },
  { href: "/planner",       icon: CalendarDays,    label: "Production Planner" },
  { href: "/supply-chain",  icon: Compass,         label: "Supply Chain" },
  { href: "/procurement",   icon: ShoppingCart,    label: "Procurement" },
  { href: "/demand",        icon: TrendingUp,      label: "Demand & S&OP" },
  { href: "/sustainability", icon: Leaf,           label: "Sustainability" },
  { href: "/war-room",      icon: Swords,          label: "War Rooms",          badge: "1" },
  { href: "/live",          icon: Zap,             label: "Gemba Live" },
  { href: "/admin",         icon: Settings,        label: "Admin" },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const { user, setUser } = useAppStore();

  useEffect(() => {
    let mounted = true;
    fetchCurrentUser().then((u) => {
      if (mounted) setUser(u);
    });
    return () => {
      mounted = false;
    };
  }, [setUser]);

  // [MOCK DISABLED] Replaced hardcoded Sarah Chen fallback
  const displayName = user?.name || "Operator";
  const displayRole = user?.title || (user?.roles?.[0] ? `${user.roles[0].replace("_", " ")} · ${user.allowed_plants?.join(", ")}` : "Fleet Operations");
  const initial = displayName.charAt(0);

  return (
    <aside className={cn(
      "flex flex-col h-screen bg-base-200 border-r border-base-300 transition-all duration-200 shrink-0",
      collapsed ? "w-14" : "w-56"
    )}>
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-3 py-4 border-b border-base-300">
        <Link href="/" className="flex items-center gap-2.5 min-w-0 group">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-[#1a73e8] via-[#9B72CF] to-[#22d3ee] flex items-center justify-center shrink-0 shadow-md shadow-primary/20 p-0.5">
            <div className="w-full h-full bg-base-300/80 rounded-[6px] flex items-center justify-center">
              <span className="text-white text-sm font-black tracking-tighter">G</span>
            </div>
          </div>
          {!collapsed && (
            <span className="text-lg font-black tracking-tight whitespace-nowrap">
              <span
                className="bg-gradient-to-r from-[#4285F4] via-[#9B72CF] to-[#29B6F6] bg-clip-text text-transparent font-black"
                style={{
                  backgroundImage: "linear-gradient(135deg, #4285F4 0%, #9B72CF 50%, #29B6F6 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                Gem
              </span>
              <span className="text-white font-extrabold">ba</span>
              <span className="text-primary font-black ml-0.5">OS</span>
            </span>
          )}
        </Link>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="ml-auto btn btn-ghost btn-xs px-1"
        >
          {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Nav */}
      <ul className="menu flex-1 overflow-y-auto py-2 px-2 gap-0.5">
        {NAV_ITEMS.map(({ href, icon: Icon, label, badge }) => {
          const active = pathname === href || (href !== "/" && pathname.startsWith(href));
          return (
            <li key={href}>
              <Link
                href={href}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg text-sm py-2",
                  active ? "active" : "text-base-content/50 hover:text-base-content"
                )}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {!collapsed && <span className="truncate">{label}</span>}
                {!collapsed && badge && (
                  <span className="ml-auto badge badge-primary badge-sm">{badge}</span>
                )}
                {collapsed && badge && (
                  <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-primary rounded-full" />
                )}
              </Link>
            </li>
          );
        })}
      </ul>

      {/* Bottom */}
      <div className="border-t border-base-300 py-2 px-2">
        {!collapsed ? (
          <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm">
            <div className="avatar placeholder shrink-0">
              <div className="bg-primary/20 text-primary rounded-full w-7">
                <span className="text-xs font-semibold">{initial}</span>
              </div>
            </div>
            <div className="min-w-0">
              <p className="text-sm text-base-content/90 font-medium truncate">{displayName}</p>
              <p className="text-[11px] text-base-content/50 capitalize truncate">{displayRole}</p>
            </div>
          </div>
        ) : (
          <div className="flex justify-center py-1">
            <div className="avatar placeholder" title={`${displayName} (${displayRole})`}>
              <div className="bg-primary/20 text-primary rounded-full w-7">
                <span className="text-xs font-semibold">{initial}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
