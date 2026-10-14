import { useQueryClient } from "@tanstack/react-query";
import { getGetSettingsQueryKey, useGetNotionDatabases, useGetSettings, useUpdateSettings } from "@workspace/api-client-react";
import type { AppSettingsUpdate } from "@workspace/api-client-react";
import { useEffect, useState, type FormEvent } from "react";
import { Link2, Save, Settings2 } from "lucide-react";
import { ErrorState, LoadingState, PageHeading, Panel, inputClass, primaryButton } from "@/lib/shared";

export function Settings() {
  const query = useGetSettings();
  const databases = useGetNotionDatabases();
  const update = useUpdateSettings();
  const client = useQueryClient();
  const [study, setStudy] = useState("360");
  const [water, setWater] = useState("2500");
  const [sleep, setSleep] = useState("8");
  const [tasksDb, setTasksDb] = useState("");
  const [scheduleDb, setScheduleDb] = useState("");
  const [calendar, setCalendar] = useState("primary");
  const [dayStart, setDayStart] = useState("6");
  const [dayEnd, setDayEnd] = useState("22");
  const [initialized, setInitialized] = useState(false);
  useEffect(() => {
    if (!query.data || initialized) return;
    setStudy(String(query.data.dailyStudyTargetMinutes));
    setWater(String(query.data.waterGoalMl));
    setSleep(String(query.data.sleepGoalHours));
    setTasksDb(query.data.notionTasksDatabaseId ?? "");
    setScheduleDb(query.data.notionScheduleDatabaseId ?? "");
    setCalendar(query.data.calendarId);
    setDayStart(String(query.data.dayStartHour));
    setDayEnd(String(query.data.dayEndHour));
    setInitialized(true);
  }, [query.data, initialized]);
  if (query.isLoading) return <LoadingState label="Loading settings"/>;
  if (query.isError || !query.data) return <ErrorState retry={() => query.refetch()}/>;
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const payload: AppSettingsUpdate = { dailyStudyTargetMinutes: Number(study), waterGoalMl: Number(water), sleepGoalHours: Number(sleep), notionTasksDatabaseId: tasksDb || null, notionScheduleDatabaseId: scheduleDb || null, calendarId: calendar, dayStartHour: Number(dayStart), dayEndHour: Number(dayEnd) };
    update.mutate({ data: payload }, { onSuccess: () => client.invalidateQueries({ queryKey: getGetSettingsQueryKey() }) });
  };
  return <div className="fade-up"><PageHeading eyebrow="Make the system yours" title="Targets and connections." detail="Set personal study and wellness targets, choose connected Notion databases, and define the hours used to find free blocks."/>
    <form onSubmit={submit} className="space-y-5"><Panel><div className="flex items-center gap-2"><Settings2 size={19} className="text-blue-800"/><div><h2 className="font-serif text-xl font-bold">Daily targets</h2><p className="text-xs text-slate-500">A useful baseline, not a rulebook.</p></div></div><div className="mt-5 grid gap-4 md:grid-cols-3"><label className="text-xs font-semibold text-slate-600">Study target · minutes<input className={`${inputClass} mt-1`} type="number" min="15" max="1440" value={study} onChange={(event) => setStudy(event.target.value)} data-testid="input-setting-study-target"/></label><label className="text-xs font-semibold text-slate-600">Water goal · ml<input className={`${inputClass} mt-1`} type="number" min="250" max="12000" step="100" value={water} onChange={(event) => setWater(event.target.value)} data-testid="input-setting-water-goal"/></label><label className="text-xs font-semibold text-slate-600">Sleep goal · hours<input className={`${inputClass} mt-1`} type="number" min="1" max="24" step="0.25" value={sleep} onChange={(event) => setSleep(event.target.value)} data-testid="input-setting-sleep-goal"/></label></div></Panel>
    <Panel><div className="flex items-center gap-2"><Link2 size={19} className="text-amber-700"/><div><h2 className="font-serif text-xl font-bold">Notion & calendar</h2><p className="text-xs text-slate-500">Choose database IDs from the connected Notion workspace.</p></div></div>{databases.isLoading ? <div className="mt-4 h-10 animate-pulse rounded-xl bg-slate-100"/> : databases.isError ? <p className="mt-4 text-sm text-rose-700">Notion databases could not be loaded. You can still save other settings.</p> : null}<div className="mt-5 grid gap-4 md:grid-cols-2"><label className="text-xs font-semibold text-slate-600">Tasks database<select className={`${inputClass} mt-1`} value={tasksDb} onChange={(event) => setTasksDb(event.target.value)} data-testid="select-notion-tasks-database"><option value="">Not connected</option>{databases.data?.map((database) => <option key={database.id} value={database.id}>{database.title}</option>)}</select></label><label className="text-xs font-semibold text-slate-600">Schedule database<select className={`${inputClass} mt-1`} value={scheduleDb} onChange={(event) => setScheduleDb(event.target.value)} data-testid="select-notion-schedule-database"><option value="">Not connected</option>{databases.data?.map((database) => <option key={database.id} value={database.id}>{database.title}</option>)}</select></label><label className="text-xs font-semibold text-slate-600 md:col-span-2">Calendar ID<input className={`${inputClass} mt-1`} value={calendar} onChange={(event) => setCalendar(event.target.value)} required data-testid="input-calendar-id"/></label></div></Panel>
    <Panel><h2 className="font-serif text-xl font-bold">Available day window</h2><p className="mt-1 text-xs text-slate-500">Used by the automated free-time matrix.</p><div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="text-xs font-semibold text-slate-600">Start hour<input className={`${inputClass} mt-1`} type="number" min="0" max="23" value={dayStart} onChange={(event) => setDayStart(event.target.value)} data-testid="input-day-start-hour"/></label><label className="text-xs font-semibold text-slate-600">End hour<input className={`${inputClass} mt-1`} type="number" min="1" max="24" value={dayEnd} onChange={(event) => setDayEnd(event.target.value)} data-testid="input-day-end-hour"/></label></div></Panel>
    <div className="flex flex-wrap items-center gap-3"><button className={primaryButton} disabled={update.isPending} data-testid="button-save-settings"><Save size={16}/>{update.isPending ? "Saving settings…" : "Save settings"}</button>{update.isSuccess && <span className="text-sm font-semibold text-emerald-700" data-testid="status-settings-saved">Settings saved.</span>}{update.isError && <span className="text-sm text-rose-700" data-testid="status-settings-error">Could not save settings. Try again.</span>}</div></form>
  </div>;
}
