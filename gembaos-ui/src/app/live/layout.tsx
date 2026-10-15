export default function LiveLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0B0F14]">
      {children}
    </div>
  );
}
