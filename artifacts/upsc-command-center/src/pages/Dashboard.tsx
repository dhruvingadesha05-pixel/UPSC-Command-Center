import { useQueryClient } from "@tanstack/react-query";
import { useCreateStudyLog, useGetDashboardSummary, useGetStudyLogs, getGetDashboardSummaryQueryKey, getGetStudyLogsQueryKey } from "@workspace/api-client-react";
import { useState, type FormEvent } from "react";
import { ArrowRight, BookOpen, Flame, GlassWater, Moon, Plus, Timer } from "lucide-react";
import { Link } from "wouter";
import { Aira } from "@/components/Aira";
import { daysUntil, EmptyState, ErrorState, formatMinutes, LoadingState, PageHeading, Panel, inputClass, primaryButton, today } from "@/lib/shared";

const dailyQuotes = ["Begin where you are. Use what you have. Do what you can.", "Consistency turns ordinary hours into extraordinary preparation.", "A focused hour is a vote for the future you are building."];

export function Dashboard() {
  const summary = useGetDashboardSummary();
  const logs = useGetStudyLogs({ days: 30 });
  const createStudy = useCreateStudyLog();
  const client = useQueryClient();
  const [subject, setSubject] = useState("");
  const [minutes, setMinutes] = useState("60");
  const [notes, setNotes] = useState("");
  if (summary.isLoading) return <LoadingState />;
  if (summary.isError || !summary.data) return <ErrorState retry={() => summary.refetch()} />;
  const data = summary.data;
  const progress = Math.min(100, Math.round((data.studyMinutesToday / Math.max(1, data.studyTargetMinutes)) * 100));
  const submitStudy = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!subject.trim()) return;
    createStudy.mutate({ data: { date: today(), subject: subject.trim(), durationMinutes: Number(minutes), notes } }, {
      onSuccess: () => {
        setSubject("");
        setNotes("");
        client.invalidateQueries({ queryKey: getGetStudyLogsQueryKey({ days: 30 }) });
        client.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
      },
    });
  };
  return <div className="fade-up"><div className="flex flex-wrap items-start justify-between gap-4"><PageHeading eyebrow="Daily operating view" title="Good work starts here." detail={`${new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })} · Keep preparation, health, and time in the same frame.`}/><div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3"><p className="font-mono text-[9px] uppercase tracking-[.16em] text-amber-800">Today’s line</p><p className="mt-1 max-w-xs font-serif text-sm italic text-slate-700">“{dailyQuotes[Math.floor(Date.now() / 86400000) % dailyQuotes.length]}”</p></div></div>
    <div className="mb-4 flex flex-wrap gap-2 text-[11px]"><span className="rounded-full border border-blue-100 bg-white px-3 py-1.5 font-semibold text-blue-900" data-testid="countdown-spipa-dashboard">SPIPA 2027 estimate · {daysUntil("2027-05-16")} days</span><span className="rounded-full border border-amber-200 bg-white px-3 py-1.5 font-semibold text-amber-800" data-testid="countdown-upsc-dashboard">CSE Prelims 2028 estimate · {daysUntil("2028-05-28")} days</span><span className="self-center text-slate-400">Dates are estimates; official notifications take precedence.</span></div>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Panel className="relative overflow-hidden"><div className="flex justify-between"><div><p className="text-xs font-medium text-slate-500">Study today</p><p className="mt-2 font-serif text-3xl font-extrabold text-[#1E3A8A]" data-testid="value-study-today">{formatMinutes(data.studyMinutesToday)}</p></div><BookOpen className="text-blue-700" size={19}/></div><div className="mt-4 h-2 overflow-hidden rounded-full bg-blue-100"><div className="h-full rounded-full bg-[#1E3A8A] transition-all" style={{ width: `${progress}%` }}/></div><p className="mt-2 text-[11px] text-slate-500">{progress}% of {formatMinutes(data.studyTargetMinutes)} target</p></Panel>
      <Panel><div className="flex justify-between"><div><p className="text-xs font-medium text-slate-500">Study streak</p><p className="mt-2 font-serif text-3xl font-extrabold text-slate-900" data-testid="value-study-streak">{data.studyStreak}<span className="ml-1 text-sm font-semibold">days</span></p></div><Flame className="text-amber-600" size={19}/></div><p className="mt-4 text-[11px] text-slate-500">A streak is built one honest session at a time.</p></Panel>
      <Panel><div className="flex justify-between"><div><p className="text-xs font-medium text-slate-500">Water</p><p className="mt-2 font-serif text-3xl font-extrabold text-slate-900" data-testid="value-water-today">{(data.waterMl / 1000).toFixed(1)}<span className="ml-1 text-sm font-semibold">L</span></p></div><GlassWater className="text-teal-700" size={19}/></div><p className="mt-4 text-[11px] text-slate-500">Goal {(data.waterGoalMl / 1000).toFixed(1)} L today</p></Panel>
      <Panel><div className="flex justify-between"><div><p className="text-xs font-medium text-slate-500">Recovery</p><p className="mt-2 font-serif text-3xl font-extrabold text-slate-900" data-testid="value-sleep-today">{data.sleepHours ?? "—"}<span className="ml-1 text-sm font-semibold">hrs</span></p></div><Moon className="text-indigo-700" size={19}/></div><p className="mt-4 text-[11px] text-slate-500">{data.weightKg ? `${data.weightKg} kg logged` : "No weight logged today"}</p></Panel>
    </div>
    <div className="mt-5 grid gap-5 xl:grid-cols-[1.1fr_.9fr]"><div className="space-y-5"><Aira/><Panel><div className="flex items-center justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[.15em] text-slate-400">Make it count</p><h2 className="mt-1 font-serif text-xl font-bold">Log a study session</h2></div><Timer className="text-blue-800" size={20}/></div><form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={submitStudy}><label className="text-xs font-semibold text-slate-600">Subject<input value={subject} onChange={(event) => setSubject(event.target.value)} className={`${inputClass} mt-1`} placeholder="e.g. Indian Polity" required data-testid="input-study-subject"/></label><label className="text-xs font-semibold text-slate-600">Minutes<input value={minutes} onChange={(event) => setMinutes(event.target.value)} className={`${inputClass} mt-1`} type="number" min="1" max="1440" required data-testid="input-study-minutes"/></label><label className="text-xs font-semibold text-slate-600 sm:col-span-2">Notes (optional)<input value={notes} onChange={(event) => setNotes(event.target.value)} className={`${inputClass} mt-1`} placeholder="What did you cover?" data-testid="input-study-notes"/></label><button className={`${primaryButton} sm:col-span-2`} disabled={createStudy.isPending} data-testid="button-log-study"><Plus size={16}/>{createStudy.isPending ? "Saving…" : "Record session"}</button></form></Panel></div>
      <Panel><div className="flex items-center justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[.15em] text-slate-400">Recent work</p><h2 className="mt-1 font-serif text-xl font-bold">Study sessions</h2></div><Link href="/analytics" className="inline-flex items-center gap-1 text-xs font-semibold text-blue-800" data-testid="link-view-analytics">View analytics<ArrowRight size={13}/></Link></div>{logs.isLoading ? <div className="mt-5 space-y-3"><div className="h-12 animate-pulse rounded-lg bg-slate-100"/><div className="h-12 animate-pulse rounded-lg bg-slate-100"/></div> : logs.isError ? <div className="mt-5"><ErrorState retry={() => logs.refetch()}/></div> : !logs.data?.length ? <div className="mt-5"><EmptyState title="A clean page." detail="Your first study session will appear here."/></div> : <div className="mt-4 divide-y divide-slate-100">{logs.data.slice(0, 6).map((log) => <div key={log.id} className="flex items-center justify-between py-3" data-testid={`row-study-${log.id}`}><div><p className="text-sm font-semibold text-slate-800">{log.subject}</p><p className="mt-1 text-[11px] text-slate-400">{log.date}{log.notes ? ` · ${log.notes}` : ""}</p></div><span className="font-mono text-xs text-blue-900">{formatMinutes(log.durationMinutes)}</span></div>)}</div>}</Panel></div>
    <div className="mt-5 grid gap-4 sm:grid-cols-2"><Link href="/sprint" className="group rounded-2xl bg-[#1E3A8A] p-5 text-white transition hover:-translate-y-0.5" data-testid="link-sprint-card"><p className="font-mono text-[10px] uppercase tracking-[.16em] text-blue-200">15 day focus</p><div className="mt-2 flex items-center justify-between"><span className="font-serif text-xl font-bold">Backlog sprint</span><ArrowRight className="transition group-hover:translate-x-1"/></div><p className="mt-2 text-xs text-blue-100">Review the next target and keep the sequence moving.</p></Link><Link href="/calendar" className="group rounded-2xl border border-slate-200 bg-white p-5 text-slate-900 transition hover:-translate-y-0.5" data-testid="link-time-card"><p className="font-mono text-[10px] uppercase tracking-[.16em] text-amber-700">Time is a resource</p><div className="mt-2 flex items-center justify-between"><span className="font-serif text-xl font-bold">Find a free block</span><ArrowRight className="text-blue-800 transition group-hover:translate-x-1"/></div><p className="mt-2 text-xs text-slate-500">See actual available time around your commitments.</p></Link></div>
  </div>;
}
