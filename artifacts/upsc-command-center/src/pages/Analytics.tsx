import { useGetSettings, useGetStudyLogs } from "@workspace/api-client-react";
import { Activity, BarChart3 } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { EmptyState, ErrorState, formatMinutes, LoadingState, PageHeading, Panel } from "@/lib/shared";

export function Analytics() {
  const query = useGetStudyLogs({ days: 30 });
  const settings = useGetSettings();
  if (query.isLoading || settings.isLoading) return <LoadingState label="Loading study analytics"/>;
  if (query.isError || settings.isError) return <ErrorState retry={() => { void query.refetch(); void settings.refetch(); }}/>;
  const targetMinutes = settings.data?.dailyStudyTargetMinutes ?? 360;
  const grouped = new Map<string, number>();
  (query.data ?? []).forEach((log) => grouped.set(log.date, (grouped.get(log.date) ?? 0) + log.durationMinutes));
  const data = Array.from({ length: 14 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - 13 + index);
    const key = date.toISOString().slice(0, 10);
    const actual = grouped.get(key) ?? 0;
    return { date: date.toLocaleDateString("en-IN", { day: "numeric", month: "short" }), actual, target: targetMinutes, consistency: actual >= targetMinutes ? 100 : Math.round(actual / targetMinutes * 100) };
  });
  const totals = data.reduce((sum, day) => sum + day.actual, 0);
  const loggedDays = data.filter((day) => day.actual > 0).length;
  return <div className="fade-up"><PageHeading eyebrow="Measure the practice" title="Consistency, made visible." detail="Daily actual minutes against a six-hour reference target. Use the trend to adjust your routine, not to judge a single day."/>
    {!query.data?.length ? <EmptyState title="Your trend starts with a session." detail="Log study time on the overview. Your real daily minutes will appear here."/> : <><div className="mb-5 grid gap-4 sm:grid-cols-3"><Panel><p className="text-xs text-slate-500">Study in last 14 days</p><p className="mt-2 font-serif text-3xl font-extrabold text-[#1E3A8A]" data-testid="value-study-total">{formatMinutes(totals)}</p></Panel><Panel><p className="text-xs text-slate-500">Days with study logged</p><p className="mt-2 font-serif text-3xl font-extrabold text-slate-900" data-testid="value-consistency-days">{loggedDays}<span className="ml-1 text-sm font-semibold text-slate-500">/ 14</span></p></Panel><Panel><p className="text-xs text-slate-500">Average on active days</p><p className="mt-2 font-serif text-3xl font-extrabold text-amber-700" data-testid="value-active-average">{formatMinutes(loggedDays ? Math.round(totals / loggedDays) : 0)}</p></Panel></div>
      <div className="grid gap-5 xl:grid-cols-2"><Panel><div className="mb-4 flex items-center gap-2"><BarChart3 className="text-blue-800" size={18}/><div><h2 className="font-serif text-lg font-bold">Actual study vs target</h2><p className="text-xs text-slate-500">Minutes per day · latest 14 days</p></div></div><div className="h-[300px] w-full" data-testid="chart-study-minutes"><ResponsiveContainer width="100%" height="100%"><BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}><CartesianGrid stroke="#E8EDF4" vertical={false}/><XAxis dataKey="date" tick={{ fill: "#64748B", fontSize: 10 }} axisLine={false} tickLine={false}/><YAxis tick={{ fill: "#64748B", fontSize: 10 }} axisLine={false} tickLine={false}/><Tooltip cursor={{ fill: "#EFF4FB" }}/><Legend wrapperStyle={{ fontSize: 11 }}/><Bar dataKey="actual" name="Actual minutes" fill="#1E3A8A" radius={[5,5,0,0]}/><Bar dataKey="target" name="Target minutes" fill="#E7EDF7" radius={[5,5,0,0]}/></BarChart></ResponsiveContainer></div></Panel>
      <Panel><div className="mb-4 flex items-center gap-2"><Activity className="text-amber-700" size={18}/><div><h2 className="font-serif text-lg font-bold">Daily consistency</h2><p className="text-xs text-slate-500">Progress toward target, percent</p></div></div><div className="h-[300px] w-full" data-testid="chart-daily-consistency"><ResponsiveContainer width="100%" height="100%"><LineChart data={data} margin={{ top: 8, right: 10, left: -18, bottom: 0 }}><CartesianGrid stroke="#E8EDF4" vertical={false}/><XAxis dataKey="date" tick={{ fill: "#64748B", fontSize: 10 }} axisLine={false} tickLine={false}/><YAxis domain={[0,100]} tick={{ fill: "#64748B", fontSize: 10 }} axisLine={false} tickLine={false}/><Tooltip/><Line type="monotone" dataKey="consistency" name="Consistency" stroke="#D97706" strokeWidth={3} dot={{ r: 3, fill: "#D97706" }} activeDot={{ r: 5 }}/></LineChart></ResponsiveContainer></div></Panel></div></>}
  </div>;
}
