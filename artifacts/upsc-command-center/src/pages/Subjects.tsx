import { useQueryClient } from "@tanstack/react-query";
import {
  getGetCalendarEventsQueryKey,
  getGetFreeSlotsQueryKey,
  getGetSubjectsQueryKey,
  useAutoScheduleSubjects,
  useCreateSubject,
  useCreateSubjectTopic,
  useGetSubjects,
  useUpdateSubject,
  useUpdateSubjectTopic,
} from "@workspace/api-client-react";
import { BookOpenCheck, CalendarClock, Check, Clock3, Plus, Sparkles } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeading,
  Panel,
  dateOffset,
  inputClass,
  primaryButton,
  today,
} from "@/lib/shared";

type ModuleStatus = "planned" | "in-progress" | "complete";

export function Subjects() {
  const query = useGetSubjects();
  const createSubject = useCreateSubject();
  const updateSubject = useUpdateSubject();
  const createTopic = useCreateSubjectTopic();
  const updateTopic = useUpdateSubjectTopic();
  const autoSchedule = useAutoScheduleSubjects();
  const client = useQueryClient();
  const [title, setTitle] = useState("");
  const [startDate, setStartDate] = useState(today());
  const [endDate, setEndDate] = useState(dateOffset(today(), 30));
  const [hours, setHours] = useState("20");
  const [topics, setTopics] = useState("");
  const [newTopicByModule, setNewTopicByModule] = useState<Record<number, string>>({});
  const [scheduleMessage, setScheduleMessage] = useState("");
  const days = useMemo(() => dateOffset(today(), 0), []);

  if (query.isLoading) return <LoadingState label="Loading subject plan" />;
  if (query.isError || !query.data) return <ErrorState retry={() => query.refetch()} />;

  const refresh = () =>
    client.invalidateQueries({ queryKey: getGetSubjectsQueryKey() });

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const topicList = topics.split("\n").map((item) => item.trim()).filter(Boolean);
    createSubject.mutate(
      {
        data: {
          title: title.trim(),
          startDate,
          endDate,
          estimatedHours: Number(hours),
          topics: topicList,
        },
      },
      {
        onSuccess: () => {
          setTitle("");
          setTopics("");
          void refresh();
        },
      },
    );
  };

  const changeStatus = (id: number, status: ModuleStatus) =>
    updateSubject.mutate({ id, data: { status } }, { onSuccess: () => void refresh() });

  const toggleTopic = (id: number, completed: boolean) =>
    updateTopic.mutate(
      { id, data: { completed: !completed } },
      { onSuccess: () => void refresh() },
    );

  const addTopic = (moduleId: number) => {
    const topicTitle = newTopicByModule[moduleId]?.trim();
    if (!topicTitle) return;
    createTopic.mutate(
      { data: { moduleId, title: topicTitle } },
      {
        onSuccess: () => {
          setNewTopicByModule((current) => ({ ...current, [moduleId]: "" }));
          void refresh();
        },
      },
    );
  };

  const runAutoSchedule = () => {
    setScheduleMessage("");
    autoSchedule.mutate(undefined, {
      onSuccess: (result) => {
        setScheduleMessage(result.message);
        client.invalidateQueries({ queryKey: getGetCalendarEventsQueryKey() });
        client.invalidateQueries({ queryKey: getGetFreeSlotsQueryKey({ days: 14 }) });
      },
    });
  };

  const outstandingTopics = query.data.reduce(
    (count, module) => count + module.topics.filter((topic) => !topic.completed).length,
    0,
  );

  return (
    <div className="fade-up">
      <PageHeading
        eyebrow="Plan the long road"
        title="Schedule subjects in manageable modules."
        detail="Set date windows, estimated hours, and a topic checklist. When ready, place unfinished topics into open Google Calendar slots."
      />
      <div className="grid gap-5 xl:grid-cols-[.8fr_1.2fr]">
        <Panel>
          <div className="flex items-center gap-2">
            <BookOpenCheck size={19} className="text-blue-800" />
            <div>
              <h2 className="font-serif text-xl font-bold">Create a study module</h2>
              <p className="text-xs text-slate-500">Break a subject into clear topics.</p>
            </div>
          </div>
          <form onSubmit={submit} className="mt-4 space-y-3">
            <label className="block text-xs font-semibold text-slate-600">
              Module or subject
              <input className={`${inputClass} mt-1`} value={title} onChange={(event) => setTitle(event.target.value)} maxLength={160} placeholder="e.g. Indian Polity — Parliament" required data-testid="input-subject-title" />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs font-semibold text-slate-600">
                Starts
                <input className={`${inputClass} mt-1`} type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} required data-testid="input-subject-start" />
              </label>
              <label className="text-xs font-semibold text-slate-600">
                Ends
                <input className={`${inputClass} mt-1`} type="date" min={startDate} value={endDate} onChange={(event) => setEndDate(event.target.value)} required data-testid="input-subject-end" />
              </label>
            </div>
            <label className="block text-xs font-semibold text-slate-600">
              Estimated hours
              <input className={`${inputClass} mt-1`} type="number" min="1" max="2000" step="0.5" value={hours} onChange={(event) => setHours(event.target.value)} required data-testid="input-subject-hours" />
            </label>
            <label className="block text-xs font-semibold text-slate-600">
              Topics · one per line
              <textarea className={`${inputClass} mt-1 min-h-28 resize-y`} value={topics} onChange={(event) => setTopics(event.target.value)} placeholder={"Constitutional framework\nParliamentary committees\nQuestion hour"} data-testid="input-subject-topics" />
            </label>
            <button className={`${primaryButton} w-full`} disabled={createSubject.isPending} data-testid="button-create-subject">
              <Plus size={16} />{createSubject.isPending ? "Saving…" : "Add study module"}
            </button>
            {createSubject.isError && <p className="text-xs text-rose-700">Module could not be saved. Check the date range and values.</p>}
          </form>
        </Panel>

        <Panel className="border-blue-100 bg-[linear-gradient(120deg,#fff_55%,#f1f6ff_100%)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-2">
              <Sparkles size={19} className="text-amber-600" />
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[.15em] text-slate-400">Calendar allocator</p>
                <h2 className="mt-1 font-serif text-xl font-bold">Find room for unfinished topics</h2>
              </div>
            </div>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-blue-900">{outstandingTopics} topics remaining</span>
          </div>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
            The scheduler checks your connected Google Calendar and the available day window in Settings. It creates one calendar event per topic within that module’s date range; existing scheduled topics are not duplicated.
          </p>
          <button onClick={runAutoSchedule} className={`${primaryButton} mt-4`} disabled={autoSchedule.isPending || !outstandingTopics} data-testid="button-auto-schedule-subjects">
            <CalendarClock size={16} />{autoSchedule.isPending ? "Checking calendar…" : "Schedule topics in Google Calendar"}
          </button>
          {scheduleMessage && <p className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900" role="status">{scheduleMessage}</p>}
          {autoSchedule.isError && <p className="mt-3 text-sm text-rose-700">Calendar scheduling failed. Check the connection and try again.</p>}
          {!!autoSchedule.data?.assignments.length && (
            <div className="mt-3 space-y-2">
              {autoSchedule.data.assignments.slice(0, 5).map((assignment) => (
                <div key={assignment.eventId} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 text-xs">
                  <span className="font-semibold text-slate-800">{assignment.subjectTitle}: {assignment.topicTitle}</span>
                  <span className="text-slate-500">{new Date(assignment.start).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</span>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <div className="mt-5 space-y-4">
        {!query.data.length ? (
          <Panel><EmptyState title="Your subject plan is clear." detail="Create a module above to start turning the syllabus into dated, trackable topics." /></Panel>
        ) : (
          query.data.map((module) => {
            const completeCount = module.topics.filter((topic) => topic.completed).length;
            const progress = module.topics.length ? Math.round(completeCount / module.topics.length * 100) : 0;
            return (
              <Panel key={module.id} data-testid={`subject-module-${module.id}`}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-[10px] uppercase tracking-[.15em] text-slate-400">
                      {module.startDate} — {module.endDate}
                    </p>
                    <h2 className="mt-1 font-serif text-xl font-bold text-slate-900">{module.title}</h2>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1"><Clock3 size={13} />{module.estimatedHours} estimated hrs</span>
                      <span>{completeCount}/{module.topics.length} topics · {progress}%</span>
                    </div>
                    <div className="mt-3 h-1.5 max-w-md overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-[#1E3A8A]" style={{ width: `${progress}%` }} />
                    </div>
                  </div>
                  <label className="text-xs font-semibold text-slate-600">
                    Status
                    <select className={`${inputClass} mt-1 min-w-36`} value={module.status} onChange={(event) => changeStatus(module.id, event.target.value as ModuleStatus)} aria-label={`Status for ${module.title}`}>
                      <option value="planned">Planned</option>
                      <option value="in-progress">In progress</option>
                      <option value="complete">Complete</option>
                    </select>
                  </label>
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {module.topics.map((topic) => (
                    <label key={topic.id} className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-3 transition ${topic.completed ? "border-emerald-100 bg-emerald-50/70" : "border-slate-100 bg-slate-50 hover:bg-white"}`}>
                      <input type="checkbox" checked={topic.completed} onChange={() => toggleTopic(topic.id, topic.completed)} disabled={updateTopic.isPending} className="mt-0.5 h-4 w-4 accent-[#1E3A8A]" data-testid={`check-topic-${topic.id}`} />
                      <span className="min-w-0 flex-1">
                        <span className={`block text-sm font-semibold ${topic.completed ? "text-emerald-900 line-through" : "text-slate-800"}`}>{topic.title}</span>
                        {topic.estimatedHours !== null && <span className="mt-1 block text-[10px] text-slate-500">{topic.estimatedHours} hrs estimated</span>}
                      </span>
                      {topic.completed && <Check size={15} className="text-emerald-700" />}
                    </label>
                  ))}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <input className={`${inputClass} max-w-sm`} value={newTopicByModule[module.id] ?? ""} onChange={(event) => setNewTopicByModule((current) => ({ ...current, [module.id]: event.target.value }))} placeholder="Add a topic to this module" aria-label={`New topic for ${module.title}`} />
                  <button onClick={() => addTopic(module.id)} disabled={createTopic.isPending || !newTopicByModule[module.id]?.trim()} className="inline-flex items-center gap-2 rounded-xl border border-blue-200 px-4 py-2 text-sm font-semibold text-blue-900 hover:bg-blue-50" data-testid={`button-add-topic-${module.id}`}>
                    <Plus size={15} />Add topic
                  </button>
                </div>
              </Panel>
            );
          })
        )}
      </div>
      {updateSubject.isError && <p className="mt-3 text-xs text-rose-700">Module status could not be updated.</p>}
      {createTopic.isError && <p className="mt-3 text-xs text-rose-700">The topic could not be added to its module.</p>}
      <p className="mt-3 text-[10px] text-slate-400" aria-hidden="true">{days}</p>
    </div>
  );
}
