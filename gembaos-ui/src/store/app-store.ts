import { create } from "zustand";
import type { UserProfile, PlantInfo } from "@/lib/api-client";

// [MOCK DISABLED] Previously seeded with hardcoded DEFAULT_PLANTS
/*
const DEFAULT_PLANTS: PlantInfo[] = [
  {
    id: "PNQ",
    name: "Pune Plant",
    location: "Pune, India",
    country: "India",
    flag: "🇮🇳",
    timezone: "Asia/Kolkata",
    status: "ATTENTION_REQUIRED",
    active_anomalies: 1,
  },
  {
    id: "RYG",
    name: "Rayong Plant",
    location: "Rayong, Thailand",
    country: "Thailand",
    flag: "🇹🇭",
    timezone: "Asia/Bangkok",
    status: "running",
    active_anomalies: 0,
  },
  {
    id: "NGO",
    name: "Nagoya Plant",
    location: "Nagoya, Japan",
    country: "Japan",
    flag: "🇯🇵",
    timezone: "Asia/Tokyo",
    status: "running",
    active_anomalies: 0,
  },
];
*/

interface AppState {
  user: UserProfile | null;
  setUser: (user: UserProfile | null) => void;
  plants: PlantInfo[];
  setPlants: (plants: PlantInfo[]) => void;
  selectedPlant: string;
  setSelectedPlant: (plant: string) => void;
  copilotOpen: boolean;
  setCopilotOpen: (open: boolean) => void;
  copilotMessage: string;
  setCopilotMessage: (msg: string) => void;
  pendingDecisions: number;
  setPendingDecisions: (n: number) => void;
  activeAlertsCount: number;
  setActiveAlertsCount: (count: number) => void;
  simRunning: boolean;
  setSimRunning: (v: boolean) => void;
  activeScenario: string | null;
  setActiveScenario: (s: string | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
  plants: [],
  setPlants: (plants) => set({ plants }),
  selectedPlant: "ALL",
  setSelectedPlant: (plant) => set({ selectedPlant: plant }),
  copilotOpen: false,
  setCopilotOpen: (open) => set({ copilotOpen: open }),
  copilotMessage: "",
  setCopilotMessage: (msg) => set({ copilotMessage: msg }),
  pendingDecisions: 3,
  setPendingDecisions: (n) => set({ pendingDecisions: n }),
  activeAlertsCount: 0,
  setActiveAlertsCount: (count) => set({ activeAlertsCount: count }),
  simRunning: false,
  setSimRunning: (v) => set({ simRunning: v }),
  activeScenario: null,
  setActiveScenario: (s) => set({ activeScenario: s }),
}));
