import { useQueryClient } from "@tanstack/react-query";
import { getGetCalendarEventsQueryKey, getGetFreeSlotsQueryKey, getGetNotionScheduleQueryKey, getGetNotionTasksQueryKey, useCreateCalendarEvent, useCreateNotionTask, useGetCalendarEvents, useGetFreeSlots, useGetNotionSchedule, useGetNotionTasks, useGetSettings, useSyncNotionAndCalendar } from "@workspace/api-client-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { CalendarDays, Clock3, Plus, RefreshCw } from "lucide-react";
import { EmptyState, ErrorState, LoadingState, PageHeading, Panel, inputClass, primaryButton } from "@/lib/shared";

const dateTime = (value: string) => new Date(value).toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

export function Calendar() {
  const events = useGetCalendarEvents({ days: 14 });
  const slots = useGetFreeSlots({ days: 14 });
  const notionSchedule = useGetNotionSchedule();
  const notionTasks = useGetNotionTasks();
  const settings = useGetSettings();
  const addEvent = useCreateCalendarEvent();
  const addNotion = useCreateNotionTask();
  const sync = useSyncNotionAndCalendar();
  const client = useQueryClient();
  const syncLock = useRef(false);
  const runSyncRef = useRef<() => void>(() => undefined);
  const [eventOpen, setEventOpen] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [syncMessage, setSyncMessage] = useState("");
  const refresh = () => {
    client.invalidateQueries({ queryKey: getGetCalendarEventsQueryKey({ days: 14 }) });
    client.invalidateQueries({ queryKey: getGetFreeSlotsQueryKey({ days: 14 }) });
    client.invalidateQueries({ queryKey: getGetNotionScheduleQueryKey() });
    client.invalidateQueries({ queryKey: getGetNotionTasksQueryKey() });
  };
  runSyncRef.current = () => {
    if (syncLock.current || sync.isPending) return;
    syncLock.current = true;
    sync.mutate(undefined, {
      onSuccess: (result) => {
        refresh();
        setSyncMessage(
          `${result.message} · ${result.notionToCalendarCreated} created in Calendar · ${result.notionToCalendarUpdated} updated in Calendar · ${result.calendarToNotionUpdated} updated in Notion · ${result.unchanged} unchanged.`,
        );
      },
      onError: () => setSyncMessage("Sync failed. Check your Notion and calendar settings, then try again."),
      onSettled: () => {
        syncLock.current = false;
      },
    });
  };
  const tasksDatabaseConfigured = Boolean(settings.data?.notionTasksDatabaseId);
  useEffect(() => {
    if (!tasksDatabaseConfigured) return;
    const intervalId = window.setInterval(() => runSyncRef.current(), 5 * 60 * 1000);
    return () => window.clearInterval(intervalId);
  }, [tasksDatabaseConfigured]);
  const loading = events.isLoading || slots.isLoading;
  const error = events.isError || slots.isError;
  if (loading) return <LoadingState label="Loading calendar and availability"/>;
  if (error) return <ErrorState retry={() => { void events.refetch(); void slots.refetch(); }}/>;
  const createEvent = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    addEvent.mutate({ data: { title, start: new Date(start).toISOString(), end: new Date(end).toISOString(), description: "Added in UPSC Command Center" } }, { onSuccess: () => { setEventOpen(false); setTitle(""); refresh(); } });
  };
  const createTask = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    addNotion.mutate({ data: { title: taskTitle, status: "Not started" } }, { onSuccess: () => { setTaskOpen(false); setTaskTitle(""); refresh(); } });
  };
  const slotRows = slots.data ?? [];
  const maxDuration = Math.max(...slotRows.map((slot) => slot.durationMinutes), 1);
  return <div className="fade-up"><div className="flex flex-wrap items-start justify-between gap-4"><PageHeading eyebrow="Calendar + schedule + open hours" title="The space between commitments." detail="Upcoming events, Notion schedule, and available blocks from your connected calendar. Free-time matrix reflects real returned slots."/><div className="flex flex-col items-start gap-2 sm:items-end"><button onClick={() => runSyncRef.current()} className={`${primaryButton} ${sync.isPending ? "opacity-70" : ""}`} disabled={sync.isPending || syncLock.current} data-testid="button-sync-calendar"><RefreshCw size={15} className={sync.isPending ? "animate-spin" : ""}/>{sync.isPending ? "Syncing…" : "Sync Notion ↔ Calendar"}</button><span className="text-[10px] text-slate-500" data-testid="status-calendar-auto-sync">{tasksDatabaseConfigured ? "Automatic sync every 5 minutes while this page is open" : "Automatic sync paused · configure a Notion tasks database"}</span></div></div>
    {syncMessage && <p className="mb-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900" data-testid="status-sync-summary">{syncMessage}</p>}
    {sync.isError && <p className="mb-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-800" data-testid="status-sync-error">Sync failed. Check your settings and try again.</p>}
    <div className="mb-5 grid gap-5 xl:grid-cols-[1.1fr_.9fr]"><Panel><div className="flex items-center justify-between"><div className="flex items-center gap-2"><CalendarDays className="text-blue-800" size={18}/><div><h2 className="font-serif text-lg font-bold">Upcoming events</h2><p className="text-xs text-slate-500">Next 14 days</p></div></div><button className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-blue-900" onClick={() => setEventOpen(!eventOpen)} data-testid="button-add-calendar-event"><Plus size={14} className="inline"/> Event</button></div>
      {eventOpen && <form onSubmit={createEvent} className="my-4 grid gap-2 rounded-xl bg-slate-50 p-3 sm:grid-cols-2"><input className={inputClass} placeholder="Event title" value={title} onChange={(event) => setTitle(event.target.value)} required data-testid="input-event-title"/><input className={inputClass} type="datetime-local" value={start} onChange={(event) => setStart(event.target.value)} required data-testid="input-event-start"/><input className={inputClass} type="datetime-local" value={end} onChange={(event) => setEnd(event.target.value)} required data-testid="input-event-end"/><button className={primaryButton} disabled={addEvent.isPending} data-testid="button-save-event">Save event</button></form>}
      {!events.data?.length ? <div className="mt-4"><EmptyState title="No upcoming events returned." detail="Connect a calendar in Settings or add an event to begin."/></div> : <div className="mt-4 divide-y divide-slate-100">{events.data.map((item) => <div key={item.id} className="flex gap-3 py-3" data-testid={`row-event-${item.id}`}><span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-amber-500"/><div><p className="text-sm font-semibold text-slate-800">{item.title}</p><p className="mt-1 text-xs text-slate-500">{item.allDay ? "All day" : `${dateTime(item.start)} – ${new Date(item.end).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}`}</p>{item.description && <p className="mt-1 text-xs text-slate-400">{item.description}</p>}</div></div>)}</div>}
    </Panel>
    <Panel><div className="flex items-center justify-between"><div className="flex items-center gap-2"><Clock3 className="text-amber-700" size={18}/><div><h2 className="font-serif text-lg font-bold">Automated free-time matrix</h2><p className="text-xs text-slate-500">Calculated from API availability</p></div></div><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-800">{slotRows.length} blocks</span></div>
      {!slotRows.length ? <div className="mt-4"><EmptyState title="No free slots returned." detail="Check calendar connection and daily hours in Settings."/></div> : <div className="mt-5 space-y-3">{slotRows.map((slot, index) => <div key={`${slot.start}-${index}`} className="grid grid-cols-[90px_1fr_52px] items-center gap-3" data-testid={`row-free-slot-${index}`}><span className="text-[10px] text-slate-500">{dateTime(slot.start).split(" ").slice(0,3).join(" ")}</span><div className="h-7 rounded-md bg-slate-100 p-1"><div className="h-full rounded bg-[#1E3A8A]" style={{ width: `${Math.max(12, slot.durationMinutes / maxDuration * 100)}%` }}/></div><span className="font-mono text-[10px] text-slate-600">{Math.floor(slot.durationMinutes / 60)}h {slot.durationMinutes % 60}m</span><p className="col-span-3 -mt-2 pl-[102px] text-[10px] text-slate-400">{new Date(slot.start).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })} – {new Date(slot.end).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}</p></div>)}</div>}
    </Panel></div>
    <div className="grid gap-5 lg:grid-cols-2"><Panel><div className="flex items-center justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[.15em] text-slate-400">Notion planning</p><h2 className="mt-1 font-serif text-lg font-bold">Tasks</h2></div><button className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-blue-900" onClick={() => setTaskOpen(!taskOpen)} data-testid="button-add-notion-task"><Plus size={14} className="inline"/> Add task</button></div>{taskOpen && <form onSubmit={createTask} className="mt-3 flex gap-2"><input className={inputClass} value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} placeholder="Task title" required data-testid="input-notion-task"/><button className={primaryButton} disabled={addNotion.isPending} data-testid="button-save-notion-task">Add</button></form>}{!notionTasks.data?.length ? <div className="mt-4"><EmptyState title="No Notion tasks available." detail="Connect your tasks database in Settings."/></div> : <div className="mt-3 divide-y divide-slate-100">{notionTasks.data.map((task) => <a key={task.id} href={task.url} target="_blank" rel="noreferrer" className="block py-3" data-testid={`link-notion-task-${task.id}`}><p className="text-sm font-semibold text-slate-800">{task.title}</p><p className="mt-1 text-xs text-slate-500">{task.status || "No status"}{task.dueDate ? ` · due ${task.dueDate}` : ""}</p></a>)}</div>}</Panel>
    <Panel><div><p className="font-mono text-[10px] uppercase tracking-[.15em] text-slate-400">Notion schedule</p><h2 className="mt-1 font-serif text-lg font-bold">Schedule items</h2></div>{notionSchedule.isLoading ? <div className="mt-4 h-20 animate-pulse rounded-xl bg-slate-100"/> : notionSchedule.isError ? <p className="mt-4 text-sm text-rose-700">Schedule could not be loaded.</p> : !notionSchedule.data?.length ? <div className="mt-4"><EmptyState title="No schedule entries." detail="Connect a schedule database in Settings."/></div> : <div className="mt-3 divide-y divide-slate-100">{notionSchedule.data.map((item) => <div key={item.id} className="flex justify-between gap-3 py-3" data-testid={`row-notion-schedule-${item.id}`}><div><p className="text-sm font-semibold text-slate-800">{item.title}</p><p className="text-xs text-slate-500">{item.dueDate || "No date"} · {item.status || "Planned"}</p></div><a className="text-xs font-semibold text-blue-800" href={item.url} target="_blank" rel="noreferrer">Open</a></div>)}</div>}</Panel></div>
  </div>;
}
