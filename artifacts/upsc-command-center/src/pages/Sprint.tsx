import { useQueryClient } from "@tanstack/react-query";
import { getGetSprintTasksQueryKey, useGetSprintTasks, useUpdateSprintTask, useCreateSprintTask, type SprintTask } from "@workspace/api-client-react";
import { useState, type FormEvent } from "react";
import { Check, Circle, Plus, Target } from "lucide-react";
import { EmptyState, ErrorState, LoadingState, PageHeading, Panel, inputClass, primaryButton } from "@/lib/shared";

export function Sprint() {
  const query = useGetSprintTasks();
  const update = useUpdateSprintTask();
  const create = useCreateSprintTask();
  const client = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [target, setTarget] = useState("");
  const [day, setDay] = useState("1");
  const [priority, setPriority] = useState<SprintTask["priority"]>("medium");
  if (query.isLoading) return <LoadingState label="Loading sprint tasks"/>;
  if (query.isError) return <ErrorState retry={() => query.refetch()}/>;
  const tasks = query.data ?? [];
  const completed = tasks.filter((task) => task.completed).length;
  const refresh = () => client.invalidateQueries({ queryKey: getGetSprintTasksQueryKey() });
  const createTask = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    create.mutate({ data: { dayNumber: Number(day), title, subject, target, priority } }, { onSuccess: () => { setTitle(""); setSubject(""); setTarget(""); setFormOpen(false); refresh(); } });
  };
  const toggleTask = (task: SprintTask) => update.mutate({ id: task.id, data: { completed: !task.completed } }, { onSuccess: refresh });
  return <div className="fade-up"><div className="flex flex-wrap items-start justify-between gap-4"><PageHeading eyebrow="Reset the sequence" title="Fifteen days. One clear backlog." detail="A focused recovery plan for overdue preparation. Completion is deliberate: finish the target, then mark it done."/><button className={primaryButton} onClick={() => setFormOpen(!formOpen)} data-testid="button-add-sprint-task"><Plus size={16}/>{formOpen ? "Close form" : "Add target"}</button></div>
    <Panel className="mb-5 overflow-hidden bg-[#14264A] text-white"><div className="flex flex-wrap items-center justify-between gap-5"><div><p className="font-mono text-[10px] uppercase tracking-[.18em] text-amber-300">Sprint completion</p><p className="mt-2 font-serif text-3xl font-extrabold" data-testid="value-sprint-progress">{completed}<span className="text-lg font-medium text-blue-200"> / {tasks.length} targets</span></p></div><div className="min-w-[220px] flex-1 max-w-lg"><div className="h-3 overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full bg-amber-400 transition-all" style={{ width: `${tasks.length ? (completed / tasks.length) * 100 : 0}%` }}/></div><p className="mt-2 text-right text-xs text-blue-200">{tasks.length ? Math.round(completed / tasks.length * 100) : 0}% through your reset</p></div><Target className="text-amber-300" size={30}/></div></Panel>
    {formOpen && <Panel className="mb-5 border-blue-200"><h2 className="font-serif text-lg font-bold">Add a sprint target</h2><form onSubmit={createTask} className="mt-4 grid gap-3 sm:grid-cols-2"><input className={inputClass} placeholder="Target title" value={title} onChange={(event) => setTitle(event.target.value)} required data-testid="input-sprint-title"/><input className={inputClass} placeholder="Subject" value={subject} onChange={(event) => setSubject(event.target.value)} required data-testid="input-sprint-subject"/><input className={inputClass} placeholder="What does done look like?" value={target} onChange={(event) => setTarget(event.target.value)} required data-testid="input-sprint-target"/><div className="flex gap-2"><input className={inputClass} type="number" min="1" max="15" value={day} onChange={(event) => setDay(event.target.value)} aria-label="Sprint day" data-testid="input-sprint-day"/><select className={inputClass} value={priority} onChange={(event) => setPriority(event.target.value as SprintTask["priority"])} aria-label="Priority" data-testid="select-sprint-priority"><option value="high">High priority</option><option value="medium">Medium priority</option><option value="low">Low priority</option></select></div><button className={`${primaryButton} sm:col-span-2`} disabled={create.isPending} data-testid="button-save-sprint-task">{create.isPending ? "Adding…" : "Add target to sprint"}</button></form></Panel>}
    {!tasks.length ? <EmptyState title="No sprint targets yet." detail="Add your first backlog target to begin a focused 15-day reset."/> : <div className="grid gap-4 lg:grid-cols-3">{Array.from({ length: 15 }, (_, i) => i + 1).map((dayNumber) => {
      const dayTasks = tasks.filter((task) => task.dayNumber === dayNumber);
      return <Panel key={dayNumber} className={dayTasks.some((task) => task.completed) ? "border-emerald-200" : ""}><div className="mb-4 flex items-center justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[.15em] text-slate-400">Day {String(dayNumber).padStart(2, "0")}</p><p className="mt-1 font-serif text-lg font-bold text-slate-900">{dayTasks.length ? `${dayTasks.filter((task) => task.completed).length}/${dayTasks.length} done` : "Open focus"}</p></div><span className="grid h-9 w-9 place-items-center rounded-full bg-blue-50 text-blue-800">{dayTasks.length ? <Check size={16}/> : String(dayNumber).padStart(2, "0")}</span></div>{dayTasks.length ? <div className="space-y-2">{dayTasks.map((task) => <button key={task.id} onClick={() => toggleTask(task)} disabled={update.isPending} className={`w-full rounded-xl border p-3 text-left transition ${task.completed ? "border-emerald-100 bg-emerald-50/70" : "border-slate-100 bg-slate-50 hover:border-blue-200"}`} data-testid={`button-complete-task-${task.id}`}><span className="flex items-start gap-2.5">{task.completed ? <Check className="mt-0.5 shrink-0 text-emerald-700" size={16}/> : <Circle className="mt-0.5 shrink-0 text-slate-400" size={16}/>}<span className="min-w-0"><span className={`block text-sm font-semibold ${task.completed ? "text-slate-500 line-through" : "text-slate-800"}`}>{task.title}</span><span className="mt-1 block text-[11px] text-slate-500">{task.subject} · {task.target}</span></span></span></button>)}</div> : <div className="rounded-xl border border-dashed border-slate-200 px-3 py-4 text-xs text-slate-400">Add a focused target to this day.</div>}</Panel>;
    })}</div>}
  </div>;
}
