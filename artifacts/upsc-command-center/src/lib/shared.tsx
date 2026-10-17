import type { ReactNode } from "react";

export const today = () => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value ?? "2026";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
};

export const dateOffset = (date: string, offset: number) => {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + offset))
    .toISOString()
    .slice(0, 10);
};

export const formatMinutes = (minutes: number) => `${Math.floor(minutes / 60)}h ${minutes % 60}m`;

export const daysUntil = (date: string) => Math.max(0, Math.ceil((new Date(date).getTime() - Date.now()) / 86400000));

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_24px_rgba(25,45,81,0.04)] ${className}`}>{children}</section>;
}

export function PageHeading({ eyebrow, title, detail }: { eyebrow: string; title: string; detail: string }) {
  return <div className="mb-7"><p className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[.2em] text-amber-700">{eyebrow}</p><h1 className="font-serif text-3xl font-extrabold tracking-tight text-slate-900 md:text-4xl">{title}</h1><p className="mt-2 max-w-2xl text-sm text-slate-500">{detail}</p></div>;
}

export function LoadingState({ label = "Loading your command center" }: { label?: string }) {
  return <div className="space-y-4" aria-label={label} data-testid="status-loading"><div className="h-28 animate-pulse rounded-2xl bg-slate-200/70" /><div className="grid gap-4 md:grid-cols-2"><div className="h-48 animate-pulse rounded-2xl bg-slate-200/70" /><div className="h-48 animate-pulse rounded-2xl bg-slate-200/70" /></div></div>;
}

export function ErrorState({ retry }: { retry: () => void }) {
  return <Panel className="border-rose-200 bg-rose-50"><p className="font-semibold text-rose-900" data-testid="status-error">We could not load this view.</p><button className="mt-3 rounded-lg bg-rose-800 px-4 py-2 text-sm font-semibold text-white" onClick={retry} data-testid="button-retry">Try again</button></Panel>;
}

export function EmptyState({ title, detail }: { title: string; detail: string }) {
  return <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-9 text-center"><p className="font-semibold text-slate-800" data-testid="text-empty-title">{title}</p><p className="mt-1 text-sm text-slate-500">{detail}</p></div>;
}

export function LionMark({ className = "h-9 w-9" }: { className?: string }) {
  return <svg className={className} viewBox="0 0 64 64" role="img" aria-label="Ashoka-inspired study emblem" fill="none"><circle cx="32" cy="32" r="29" stroke="currentColor" strokeWidth="2"/><circle cx="32" cy="32" r="23" stroke="currentColor" strokeWidth="1" strokeDasharray="2 3"/><path d="M22 29c0-6 4-10 10-10s10 4 10 10M19 30h26M24 30v9m8-9v9m8-9v9M20 41h24M24 45h16M28 49h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><path d="M32 13v6m-14-2 4 5m24-5-4 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>;
}

export const primaryButton = "inline-flex items-center justify-center gap-2 rounded-xl bg-[#1E3A8A] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#162d6d] disabled:cursor-not-allowed disabled:opacity-50";
export const inputClass = "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-800 focus:ring-2 focus:ring-blue-100";
