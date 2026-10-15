import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GembaOS — Intelligent Manufacturing",
  description: "Agentic Operating System for Manufacturing — Google Cloud AI Builder Cup 2026",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#0B0F14] text-[#E6EDF3] antialiased">
        {children}
      </body>
    </html>
  );
}
