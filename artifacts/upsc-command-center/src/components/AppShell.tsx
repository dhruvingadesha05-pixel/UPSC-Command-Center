import { Link, useLocation } from "wouter";
import { useClerk } from "@clerk/react";
import { BookMarked, CalendarDays, ChartNoAxesCombined, Command, HeartPulse, LayoutDashboard, ListChecks, LogOut, Settings, Target } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Aira } from "@/components/Aira";
import { LionMark } from "@/lib/shared";

const navItems = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/sprint", label: "15-day sprint", icon: Target },
  { href: "/analytics", label: "Analytics", icon: ChartNoAxesCombined },
  { href: "/calendar", label: "Calendar & time", icon: CalendarDays },
  { href: "/subjects", label: "Subject planner", icon: BookMarked },
  { href: "/habits", label: "Habits", icon: ListChecks },
  { href: "/wellness", label: "Wellness", icon: HeartPulse },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppShell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { signOut } = useClerk();
  const [airaOpen, setAiraOpen] = useState(false);
  return <div className="min-h-[100dvh] bg-[#F8FAFC] md:flex">
    <aside className="flex w-full flex-col bg-[#14264A] text-slate-100 md:fixed md:inset-y-0 md:w-[248px]">
      <div className="flex items-center gap-3 px-6 py-6"><div className="text-amber-400"><LionMark /></div><div><p className="font-serif text-[15px] font-extrabold tracking-tight">UPSC COMMAND</p><p className="font-mono text-[9px] tracking-[.2em] text-slate-400">CENTER / 2028</p></div></div>
      <div className="mx-5 mb-5 rounded-xl border border-white/10 bg-white/[.06] px-4 py-3"><div className="flex items-center gap-2 text-xs font-semibold"><span className="h-2 w-2 rounded-full bg-emerald-400" />Focused season</div><p className="mt-1 pl-4 text-[11px] text-slate-400">CSE 2028 · SPIPA 2027</p></div>
      <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-1 md:flex-col md:overflow-visible" aria-label="Primary navigation">
        {navItems.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={`flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${location === href ? "bg-white text-[#1E3A8A] font-bold shadow-sm" : "text-slate-300 hover:bg-white/10 hover:text-white"}`} data-testid={`link-nav-${href.slice(1)}`}><Icon size={17} strokeWidth={1.8} /><span>{label}</span></Link>)}
      </nav>
      <div className="hidden border-t border-white/10 p-4 md:block"><div className="flex items-center gap-3 rounded-xl bg-white/[.06] px-3 py-3"><div className="grid h-9 w-9 place-items-center rounded-full bg-amber-400 font-bold text-[#14264A]">A</div><div className="min-w-0 flex-1"><p className="text-xs font-semibold">Aspirant</p><p className="text-[10px] text-slate-400">Personal workspace</p></div><button onClick={() => signOut({ redirectUrl: "/" })} aria-label="Log out" title="Log out" className="text-slate-400 hover:text-white" data-testid="button-logout"><LogOut size={16}/></button></div></div>
    </aside>
    <main className="min-w-0 flex-1 px-4 pb-10 pt-6 md:ml-[248px] md:px-9 md:pt-9"><div className="mx-auto max-w-[1440px]">{children}</div></main>
     {airaOpen && <div className="fixed bottom-[5.25rem] right-4 z-50 w-[min(420px,calc(100vw-2rem))] sm:right-6"><Aira onClose={() => setAiraOpen(false)} /></div>}
     <button type="button" onClick={() => setAiraOpen((open) => !open)} aria-expanded={airaOpen} aria-label={airaOpen ? "Close Aira assistant" : "Open Aira assistant"} className="fixed bottom-5 right-5 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-amber-500 text-[#14264A] shadow-lg shadow-amber-900/20 transition hover:-translate-y-1" title="Ask Aira" data-testid="button-aira"><Command size={20}/></button>
  </div>;
}
