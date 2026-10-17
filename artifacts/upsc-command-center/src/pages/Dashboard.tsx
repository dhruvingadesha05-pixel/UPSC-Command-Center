import { useQueryClient } from "@tanstack/react-query";
import {
  getGetDashboardSummaryQueryKey,
  getGetStudyLogsQueryKey,
  useCreateStudyLog,
  useGetDashboardSummary,
  useGetFreeSlots,
  useGetSettings,
  useGetStudyLogs,
} from "@workspace/api-client-react";
import { BookOpen, Flame, Footprints, GlassWater, Moon, Plus, Timer } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link } from "wouter";
import { CountdownTimer } from "@/components/CountdownTimer";
import {
  EmptyState,
  ErrorState,
  formatMinutes,
  LoadingState,
  PageHeading,
  Panel,
  inputClass,
  primaryButton,
  today,
} from "@/lib/shared";

const dailyQuotes = [
  "Begin where you are. Use what you have. Do what you can.",
  "Consistency turns ordinary hours into extraordinary preparation.",
  "A focused hour is a vote for the future you are building.",
];

function formatIndiaTime(value: string) {
  return new Date(value).toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function Dashboard() {
  const summary = useGetDashboardSummary();
  const logs = useGetStudyLogs({ days: 30 });
  const settings = useGetSettings();
  const freeSlots = useGetFreeSlots({ days: 1 });
  const createStudy = useCreateStudyLog();
  const client = useQueryClient();
  const [subject, setSubject] = useState("");
  const [minutes, setMinutes] = useState("60");
  const [notes, setNotes] = useState("");
  if (summary.isLoading || settings.isLoading) {
    return <LoadingState />;
  }
  if (summary.isError || settings.isError || !summary.data || !settings.data) {
    return <ErrorState retry={() => { void summary.refetch(); void settings.refetch(); }} />;
  }
  const data = summary.data;
  const progress = Math.min(
    100,
    Math.round((data.studyMinutesToday / Math.max(1, data.studyTargetMinutes)) * 100),
  );
  const submitStudy = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!subject.trim()) return;
    createStudy.mutate(
      {
        data: {
          date: today(),
          subject: subject.trim(),
          durationMinutes: Number(minutes),
          notes,
        },
      },
      {
        onSuccess: () => {
          setSubject("");
          setNotes("");
          client.invalidateQueries({ queryKey: getGetStudyLogsQueryKey({ days: 30 }) });
          client.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
        },
      },
    );
  };
  const spipaDate = settings.data.spipaExamDate || "2027-05-16";
  const upscDate = settings.data.upscPrelimsDate || "2028-05-28";
  const quote = dailyQuotes[Math.floor(Date.now() / 86400000) % dailyQuotes.length];
  const topSlots = freeSlots.data?.slice(0, 3) ?? [];

  return (
    <div className="fade-up">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeading
          eyebrow="Daily operating view"
          title="Good work starts here."
          detail={`${new Date().toLocaleDateString("en-IN", {
            timeZone: "Asia/Kolkata",
            weekday: "long",
            day: "numeric",
            month: "long",
          })} · Keep preparation, health, and time in the same frame.`}
        />
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="font-mono text-[9px] uppercase tracking-[.16em] text-amber-800">
            Today’s line
          </p>
          <p className="mt-1 max-w-xs font-serif text-sm italic text-slate-700">
            “{quote}”
          </p>
        </div>
      </div>
      <section className="mb-5 grid gap-3 sm:grid-cols-2" aria-label="Exam countdowns">
        <CountdownTimer
          title="SPIPA 2027 Entrance · estimate"
          targetDate={spipaDate}
          tone="blue"
          testId="countdown-spipa-dashboard"
        />
        <CountdownTimer
          title="UPSC CSE Prelims 2028 · estimate"
          targetDate={upscDate}
          tone="gold"
          testId="countdown-upsc-dashboard"
        />
      </section>
      <p className="-mt-3 mb-4 text-[10px] text-slate-500">
        Update estimated target dates in Settings when official dates are announced.
      </p>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Panel>
          <div className="flex justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500">Study today</p>
              <p className="mt-2 font-serif text-3xl font-extrabold text-[#1E3A8A]" data-testid="value-study-today">
                {formatMinutes(data.studyMinutesToday)}
              </p>
            </div>
            <BookOpen className="text-blue-700" size={19} />
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-blue-100">
            <div className="h-full rounded-full bg-[#1E3A8A]" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-2 text-[11px] text-slate-500">
            {progress}% of {formatMinutes(data.studyTargetMinutes)} target
          </p>
        </Panel>
        <Panel>
          <div className="flex justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500">Study streak</p>
              <p className="mt-2 font-serif text-3xl font-extrabold text-slate-900" data-testid="value-study-streak">
                {data.studyStreak}<span className="ml-1 text-sm font-semibold">days</span>
              </p>
            </div>
            <Flame className="text-amber-600" size={19} />
          </div>
          <p className="mt-4 text-[11px] text-slate-500">
            A streak is built one honest session at a time.
          </p>
        </Panel>
        <Panel>
          <div className="flex justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500">Steps today</p>
              <p className="mt-2 font-serif text-3xl font-extrabold text-slate-900" data-testid="value-steps-today">
                {data.steps.toLocaleString("en-IN")}
              </p>
            </div>
            <Footprints className="text-emerald-700" size={19} />
          </div>
          <p className="mt-4 text-[11px] text-slate-500">
            Goal {data.stepGoal.toLocaleString("en-IN")}
          </p>
        </Panel>
        <Panel>
          <div className="flex justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500">Water</p>
              <p className="mt-2 font-serif text-3xl font-extrabold text-slate-900" data-testid="value-water-today">
                {(data.waterMl / 1000).toFixed(1)}<span className="ml-1 text-sm font-semibold">L</span>
              </p>
            </div>
            <GlassWater className="text-teal-700" size={19} />
          </div>
          <p className="mt-4 text-[11px] text-slate-500">
            Goal {(data.waterGoalMl / 1000).toFixed(1)} L today
          </p>
        </Panel>
        <Panel>
          <div className="flex justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500">Recovery</p>
              <p className="mt-2 font-serif text-3xl font-extrabold text-slate-900" data-testid="value-sleep-today">
                {data.sleepHours ?? "—"}<span className="ml-1 text-sm font-semibold">hrs</span>
              </p>
            </div>
            <Moon className="text-indigo-700" size={19} />
          </div>
          <p className="mt-4 text-[11px] text-slate-500">
            {data.weightKg ? `${data.weightKg} kg logged` : "No weight logged today"}
          </p>
        </Panel>
      </div>
      <Panel className="mt-5 border-amber-100 bg-gradient-to-r from-white to-amber-50/70">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[.16em] text-amber-800">
              Morning briefing · Asia/Kolkata
            </p>
            <h2 className="mt-1 font-serif text-xl font-bold">Today, at a glance</h2>
            <p className="mt-2 text-sm text-slate-600">
              Study {formatMinutes(data.studyMinutesToday)} of {formatMinutes(data.studyTargetMinutes)}
              {" · "}water {(data.waterMl / 1000).toFixed(1)} of {(data.waterGoalMl / 1000).toFixed(1)} L
              {" · "}sleep {data.sleepHours ?? "not logged"} of {settings.data.sleepGoalHours} hrs
            </p>
          </div>
          <Link href="/wellness" className="text-xs font-semibold text-blue-900">
            Update health log →
          </Link>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {freeSlots.isLoading ? (
            <span className="text-xs text-slate-500">Finding today’s open blocks…</span>
          ) : freeSlots.isError || !topSlots.length ? (
            <span className="text-xs text-slate-500">
              No free blocks returned yet. Check your calendar connection and day window.
            </span>
          ) : (
            topSlots.map((slot, index) => (
              <span key={`${slot.start}-${index}`} className="rounded-lg border border-emerald-100 bg-white px-3 py-2 text-xs text-slate-700">
                <span className="font-semibold text-emerald-800">{formatIndiaTime(slot.start)}</span>
                {" · "}{Math.floor(slot.durationMinutes / 60)}h {slot.durationMinutes % 60}m free
              </span>
            ))
          )}
        </div>
      </Panel>
      <div className="mt-5 grid gap-5 xl:grid-cols-[1.1fr_.9fr]">
        <Panel>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[.15em] text-slate-400">
                Make it count
              </p>
              <h2 className="mt-1 font-serif text-xl font-bold">Log a study session</h2>
            </div>
            <Timer className="text-blue-800" size={20} />
          </div>
          <form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={submitStudy}>
            <label className="text-xs font-semibold text-slate-600">
              Subject
              <input value={subject} onChange={(event) => setSubject(event.target.value)} className={`${inputClass} mt-1`} placeholder="e.g. Indian Polity" required data-testid="input-study-subject" />
            </label>
            <label className="text-xs font-semibold text-slate-600">
              Minutes
              <input value={minutes} onChange={(event) => setMinutes(event.target.value)} className={`${inputClass} mt-1`} type="number" min="1" max="1440" required data-testid="input-study-minutes" />
            </label>
            <label className="text-xs font-semibold text-slate-600 sm:col-span-2">
              Notes (optional)
              <input value={notes} onChange={(event) => setNotes(event.target.value)} className={`${inputClass} mt-1`} placeholder="What did you cover?" data-testid="input-study-notes" />
            </label>
            <button className={`${primaryButton} sm:col-span-2`} disabled={createStudy.isPending} data-testid="button-log-study">
              <Plus size={16} />{createStudy.isPending ? "Saving…" : "Record session"}
            </button>
          </form>
        </Panel>
        <Panel>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[.15em] text-slate-400">
                Recent work
              </p>
              <h2 className="mt-1 font-serif text-xl font-bold">Study sessions</h2>
            </div>
            <Link href="/analytics" className="text-xs font-semibold text-blue-800">
              View analytics →
            </Link>
          </div>
          {logs.isLoading ? (
            <div className="mt-5 space-y-3">
              <div className="h-12 animate-pulse rounded-lg bg-slate-100" />
              <div className="h-12 animate-pulse rounded-lg bg-slate-100" />
            </div>
          ) : logs.isError ? (
            <div className="mt-5"><ErrorState retry={() => logs.refetch()} /></div>
          ) : !logs.data?.length ? (
            <div className="mt-5">
              <EmptyState title="A clean page." detail="Your first study session will appear here." />
            </div>
          ) : (
            <div className="mt-4 divide-y divide-slate-100">
              {logs.data.slice(0, 6).map((log) => (
                <div key={log.id} className="flex items-center justify-between py-3" data-testid={`row-study-${log.id}`}>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{log.subject}</p>
                    <p className="mt-1 text-[11px] text-slate-400">
                      {log.date}{log.notes ? ` · ${log.notes}` : ""}
                    </p>
                  </div>
                  <span className="font-mono text-xs text-blue-900">
                    {formatMinutes(log.durationMinutes)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Link href="/sprint" className="group rounded-2xl bg-[#1E3A8A] p-5 text-white transition hover:-translate-y-0.5" data-testid="link-sprint-card">
          <p className="font-mono text-[10px] uppercase tracking-[.16em] text-blue-200">15 day focus</p>
          <div className="mt-2 flex items-center justify-between">
            <span className="font-serif text-xl font-bold">Backlog sprint</span>
          </div>
          <p className="mt-2 text-xs text-blue-100">Review the next target and keep the sequence moving.</p>
        </Link>
        <Link href="/subjects" className="group rounded-2xl border border-slate-200 bg-white p-5 text-slate-900 transition hover:-translate-y-0.5" data-testid="link-subjects-card">
          <p className="font-mono text-[10px] uppercase tracking-[.16em] text-amber-700">Long-term plan</p>
          <div className="mt-2 flex items-center justify-between">
            <span className="font-serif text-xl font-bold">Subject scheduler</span>
          </div>
          <p className="mt-2 text-xs text-slate-500">Plan modules, topic checklists, and open study slots.</p>
        </Link>
      </div>
    </div>
  );
}
