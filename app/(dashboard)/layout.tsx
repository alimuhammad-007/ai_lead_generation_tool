import { Sidebar } from "@/components/Sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      {/* pt-14 on mobile offsets the fixed top bar from Sidebar */}
      <div className="flex min-w-0 flex-1 flex-col pt-14 lg:pt-0">
        {children}
      </div>
    </div>
  );
}
