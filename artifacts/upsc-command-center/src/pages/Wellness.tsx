import { useQueryClient } from "@tanstack/react-query";
import {
  getGetDashboardSummaryQueryKey,
  getGetHealthLogsQueryKey,
  getGetWorkoutLogsQueryKey,
  useCreateWorkoutLog,
  useGetHealthLogs,
  useGetMealLogs,
  useGetSettings,
  useGetWorkoutLogs,
  useSaveHealthLog,
} from "@workspace/api-client-react";
import {
  Apple,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Dumbbell,
  Footprints,
  GlassWater,
  HeartPulse,
  Moon,
  Plus,
} from "lucide-react";
import { useState, type FormEvent } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { MealsPanel } from "@/components/MealsPanel";
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

const weeklyStructure = [
  { day: "Tuesday", focus: "Strength" },
  { day: "Wednesday", focus: "Cardio & core" },
  { day: "Thursday", focus: "Strength" },
  { day: "Friday", focus: "Mobility & recovery" },
  { day: "Saturday", focus: "Strength" },
  { day: "Sunday", focus: "Conditioning" },
];

export function Wellness() {
  const [selectedDate, setSelectedDate] = useState(today);
  const isToday = selectedDate === today();
  const dayLabel = isToday ? "today" : selectedDate;
  const health = useGetHealthLogs({ days: 30 });
  const dayHealth = useGetHealthLogs({ date: selectedDate });
  const meals = useGetMealLogs({ date: selectedDate });
  const workouts = useGetWorkoutLogs({ days: 30 });
  const settings = useGetSettings();
  const saveHealth = useSaveHealthLog();
  const addWorkout = useCreateWorkoutLog();
  const client = useQueryClient();
  const [weight, setWeight] = useState("");
  const [water, setWater] = useState("");
  const [sleep, setSleep] = useState("");
  const [steps, setSteps] = useState("");
  const [exerciseName, setExerciseName] = useState("");
  const [sets, setSets] = useState("3");
  const [reps, setReps] = useState("10");
  const [workoutWeight, setWorkoutWeight] = useState("0");
  const [workoutUnit, setWorkoutUnit] = useState<"kg" | "lbs">("kg");

  // Switching days clears any half-typed values so they can't be saved onto the wrong date.
  const changeDate = (next: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(next) || next === selectedDate) return;
    setSelectedDate(next > today() ? today() : next);
    setWeight("");
    setWater("");
    setSleep("");
    setSteps("");
  };

  if (health.isLoading || workouts.isLoading || settings.isLoading) {
    return <LoadingState label="Loading wellness records" />;
  }
  if (health.isError || dayHealth.isError || meals.isError || workouts.isError || settings.isError) {
    return (
      <ErrorState
        retry={() => {
          void health.refetch();
          void dayHealth.refetch();
          void meals.refetch();
          void workouts.refetch();
          void settings.refetch();
        }}
      />
    );
  }

  const dayLog = dayHealth.data?.[0];
  const waterValue = water !== "" ? Number(water) : dayLog?.waterMl ?? 0;
  const stepsValue = steps !== "" ? Number(steps) : dayLog?.steps ?? 0;
  const goalWater = settings.data?.waterGoalMl ?? 2500;
  const goalSleep = settings.data?.sleepGoalHours ?? 8;
  const goalSteps = settings.data?.stepGoal ?? 10000;
  const mealTotal = meals.data?.reduce((sum, item) => sum + item.calories, 0) ?? 0;
  const proteinTotal = meals.data?.reduce((sum, item) => sum + item.proteinG, 0) ?? 0;
  const weightChart = (health.data ?? [])
    .filter((item) => item.weightKg !== null)
    .slice(0, 14)
    .reverse()
    .map((item) => ({ date: item.date.slice(5), weight: item.weightKg }));
  const stepChart = (health.data ?? [])
    .slice(0, 7)
    .reverse()
    .map((item) => ({
      date: item.date.slice(5),
      steps: item.steps,
      goal: goalSteps,
    }));
  const workoutChart = Array.from({ length: 7 }, (_, index) => {
    const date = dateOffset(today(), index - 6);
    return {
      date: date.slice(5),
      count: workouts.data?.filter((item) => item.date === date).length ?? 0,
    };
  });

  const saveVitals = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    saveHealth.mutate(
      {
        data: {
          date: selectedDate,
          weightKg: weight ? Number(weight) : dayLog?.weightKg ?? undefined,
          waterMl: waterValue,
          sleepHours: sleep ? Number(sleep) : dayLog?.sleepHours ?? undefined,
          steps: stepsValue,
        },
      },
      {
        onSuccess: () => {
          setWeight("");
          setWater("");
          setSleep("");
          setSteps("");
          client.invalidateQueries({ queryKey: getGetHealthLogsQueryKey({ days: 30 }) });
          client.invalidateQueries({ queryKey: getGetHealthLogsQueryKey({ date: selectedDate }) });
          client.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
        },
      },
    );
  };

  const submitWorkout = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    addWorkout.mutate(
      {
        data: {
          date: today(),
          exerciseName: exerciseName.trim(),
          sets: Number(sets),
          repsPerSet: Number(reps),
          weightPerSet: Number(workoutWeight),
          weightUnit: workoutUnit,
        },
      },
      {
        onSuccess: () => {
          setExerciseName("");
          client.invalidateQueries({ queryKey: getGetWorkoutLogsQueryKey({ days: 30 }) });
        },
      },
    );
  };

  return (
    <div className="fade-up">
      <PageHeading
        eyebrow="Support the long game"
        title="Well-being is part of preparation."
        detail="Track activity, weight, water, sleep, and meals alongside study work. Your records stay private to this workspace."
      />

      <Panel className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CalendarDays size={18} className="text-blue-800" />
          <div>
            <p className="text-xs font-semibold text-slate-600">Logging for</p>
            <p className="text-[11px] text-slate-500">{isToday ? "Today" : "Past date — backfill or edit freely"}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50" aria-label="Previous day" onClick={() => changeDate(dateOffset(selectedDate, -1))} data-testid="button-date-prev"><ChevronLeft size={16} /></button>
          <input className={`${inputClass} w-auto`} type="date" max={today()} value={selectedDate} onChange={(event) => changeDate(event.target.value)} aria-label="Wellness date" data-testid="input-wellness-date" />
          <button type="button" className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 disabled:opacity-40" aria-label="Next day" disabled={isToday} onClick={() => changeDate(dateOffset(selectedDate, 1))} data-testid="button-date-next"><ChevronRight size={16} /></button>
          {!isToday && <button type="button" className="rounded-lg border border-blue-100 px-3 py-2 text-xs font-semibold text-blue-900" onClick={() => changeDate(today())} data-testid="button-date-today">Today</button>}
        </div>
      </Panel>

      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Panel>
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">Water {dayLabel}</p>
            <GlassWater size={17} className="text-teal-700" />
          </div>
          <p className="mt-2 font-serif text-3xl font-extrabold text-slate-900" data-testid="value-wellness-water">
            {(waterValue / 1000).toFixed(1)}<span className="ml-1 text-sm">L</span>
          </p>
          <p className="mt-2 text-xs text-slate-500">Goal {(goalWater / 1000).toFixed(1)} L</p>
          <div className="mt-3 h-1.5 rounded-full bg-teal-100">
            <div className="h-full rounded-full bg-teal-700" style={{ width: `${Math.min(100, waterValue / goalWater * 100)}%` }} />
          </div>
        </Panel>
        <Panel>
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">Steps {dayLabel}</p>
            <Footprints size={17} className="text-emerald-700" />
          </div>
          <p className="mt-2 font-serif text-3xl font-extrabold text-slate-900" data-testid="value-wellness-steps">
            {stepsValue.toLocaleString("en-IN")}
          </p>
          <p className="mt-2 text-xs text-slate-500">Goal {goalSteps.toLocaleString("en-IN")}</p>
          <div className="mt-3 h-1.5 rounded-full bg-emerald-100">
            <div className="h-full rounded-full bg-emerald-700" style={{ width: `${Math.min(100, stepsValue / goalSteps * 100)}%` }} />
          </div>
        </Panel>
        <Panel>
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">Sleep {isToday ? "last logged" : dayLabel}</p>
            <Moon size={17} className="text-indigo-700" />
          </div>
          <p className="mt-2 font-serif text-3xl font-extrabold text-slate-900" data-testid="value-wellness-sleep">
            {dayLog?.sleepHours ?? "—"}<span className="ml-1 text-sm">hrs</span>
          </p>
          <p className="mt-2 text-xs text-slate-500">Goal {goalSleep} hours</p>
        </Panel>
        <Panel>
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">Meal calories {dayLabel}</p>
            <Apple size={17} className="text-amber-700" />
          </div>
          <p className="mt-2 font-serif text-3xl font-extrabold text-slate-900" data-testid="value-wellness-calories">
            {mealTotal}<span className="ml-1 text-sm">kcal</span>
          </p>
          <p className="mt-2 text-xs text-slate-500">{meals.data?.length ?? 0} meals · {proteinTotal} g protein</p>
        </Panel>
      </div>

      <div className="grid gap-5 xl:grid-cols-[.85fr_1.15fr]">
        <Panel>
          <div className="flex items-center gap-2">
            <HeartPulse className="text-rose-700" size={19} />
            <div>
              <h2 className="font-serif text-xl font-bold">Daily health log</h2>
              <p className="text-xs text-slate-500">Save movement and recovery for {dayLabel}.</p>
            </div>
          </div>
          <form onSubmit={saveVitals} className="mt-5 space-y-4">
            <label className="block text-xs font-semibold text-slate-600">
              Weight in kg
              <input className={`${inputClass} mt-1`} type="number" min="20" max="400" step="0.1" placeholder={dayLog?.weightKg ? String(dayLog.weightKg) : "e.g. 68.4"} value={weight} onChange={(event) => setWeight(event.target.value)} data-testid="input-health-weight" />
            </label>
            <label className="block text-xs font-semibold text-slate-600">
              Water in ml
              <input className={`${inputClass} mt-1`} type="number" min="0" max="20000" step="100" placeholder={String(dayLog?.waterMl ?? 0)} value={water} onChange={(event) => setWater(event.target.value)} data-testid="input-health-water" />
            </label>
            <div className="flex gap-2">
              <button type="button" className="rounded-lg border border-teal-100 px-3 py-1.5 text-xs font-semibold text-teal-800" onClick={() => setWater(String(waterValue + 250))}>+250 ml</button>
              <button type="button" className="rounded-lg border border-teal-100 px-3 py-1.5 text-xs font-semibold text-teal-800" onClick={() => setWater(String(waterValue + 500))}>+500 ml</button>
            </div>
            <label className="block text-xs font-semibold text-slate-600">
              Steps
              <input className={`${inputClass} mt-1`} type="number" min="0" max="100000" step="100" placeholder={String(dayLog?.steps ?? 0)} value={steps} onChange={(event) => setSteps(event.target.value)} data-testid="input-health-steps" />
            </label>
            <button type="button" className="rounded-lg border border-emerald-100 px-3 py-1.5 text-xs font-semibold text-emerald-800" onClick={() => setSteps(String(stepsValue + 1000))}>+1,000 steps</button>
            <label className="block text-xs font-semibold text-slate-600">
              Sleep in hours
              <input className={`${inputClass} mt-1`} type="number" min="0" max="24" step="0.25" placeholder={dayLog?.sleepHours ? String(dayLog.sleepHours) : "e.g. 7.5"} value={sleep} onChange={(event) => setSleep(event.target.value)} data-testid="input-health-sleep" />
            </label>
            <button className={`${primaryButton} w-full`} disabled={saveHealth.isPending || dayHealth.isLoading} data-testid="button-save-health">
              {saveHealth.isPending ? "Saving…" : isToday ? "Save today's health log" : `Save health log for ${selectedDate}`}
            </button>
          </form>
          {saveHealth.isError && <p className="mt-2 text-xs text-rose-700">Could not save. Check values and retry.</p>}
        </Panel>

        <div className="space-y-5">
          <Panel>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[.15em] text-slate-400">Fitness tracker</p>
                <h2 className="mt-1 font-serif text-xl font-bold">Log a workout</h2>
              </div>
              <Dumbbell size={19} className="text-blue-800" />
            </div>
            <form onSubmit={submitWorkout} className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-semibold text-slate-600 sm:col-span-2">
                Exercise
                <input className={`${inputClass} mt-1`} placeholder="e.g. Goblet squat" value={exerciseName} onChange={(event) => setExerciseName(event.target.value)} required data-testid="input-workout-exercise" />
              </label>
              <label className="text-xs font-semibold text-slate-600">
                Sets
                <input className={`${inputClass} mt-1`} type="number" min="1" max="100" value={sets} onChange={(event) => setSets(event.target.value)} required data-testid="input-workout-sets" />
              </label>
              <label className="text-xs font-semibold text-slate-600">
                Reps per set
                <input className={`${inputClass} mt-1`} type="number" min="1" max="1000" value={reps} onChange={(event) => setReps(event.target.value)} required data-testid="input-workout-reps" />
              </label>
              <label className="text-xs font-semibold text-slate-600">
                Weight per set
                <input className={`${inputClass} mt-1`} type="number" min="0" max="2000" step="0.5" value={workoutWeight} onChange={(event) => setWorkoutWeight(event.target.value)} required data-testid="input-workout-weight" />
              </label>
              <label className="text-xs font-semibold text-slate-600">
                Unit
                <select className={`${inputClass} mt-1`} value={workoutUnit} onChange={(event) => setWorkoutUnit(event.target.value as "kg" | "lbs")} data-testid="select-workout-unit">
                  <option value="kg">kg</option>
                  <option value="lbs">lbs</option>
                </select>
              </label>
              <button className={`${primaryButton} sm:col-span-2`} disabled={addWorkout.isPending} data-testid="button-add-workout">
                <Plus size={16} />{addWorkout.isPending ? "Saving workout…" : "Save workout"}
              </button>
            </form>
            {addWorkout.isError && <p className="mt-2 text-xs text-rose-700">Workout could not be saved.</p>}
          </Panel>

          <Panel>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[.15em] text-slate-400">Suggested training rhythm</p>
                <h2 className="mt-1 font-serif text-xl font-bold">Tuesday–Sunday structure</h2>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-semibold text-slate-600">Monday · recovery</span>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              {weeklyStructure.map((item) => (
                <div key={item.day} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                  <p className="text-[10px] font-semibold text-slate-500">{item.day}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-800">{item.focus}</p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[10px] text-slate-500">Suggested structure only; choose exercises and load that suit your health and training level.</p>
          </Panel>
        </div>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        <Panel>
          <p className="font-mono text-[10px] uppercase tracking-[.15em] text-slate-400">Bodyweight trend</p>
          <h2 className="mt-1 font-serif text-xl font-bold">Weight history</h2>
          {weightChart.length < 2 ? (
            <div className="mt-4"><EmptyState title="Add two weight entries to see a trend." detail="Only your own log entries appear here." /></div>
          ) : (
            <div className="mt-4 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={weightChart} margin={{ left: -20, right: 8, top: 8 }}>
                  <CartesianGrid stroke="#E8EDF4" strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis domain={["dataMin - 2", "dataMax + 2"]} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="weight" name="Weight (kg)" stroke="#1E3A8A" strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>
        <Panel>
          <p className="font-mono text-[10px] uppercase tracking-[.15em] text-slate-400">Daily movement</p>
          <h2 className="mt-1 font-serif text-xl font-bold">Steps · last 7 days</h2>
          <div className="mt-4 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stepChart} margin={{ left: -20, right: 8, top: 8 }}>
                <CartesianGrid stroke="#E8EDF4" strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="steps" name="Steps" fill="#0F766E" radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel>
          <p className="font-mono text-[10px] uppercase tracking-[.15em] text-slate-400">Activity history</p>
          <h2 className="mt-1 font-serif text-xl font-bold">Workouts · last 7 days</h2>
          <div className="mt-4 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={workoutChart} margin={{ left: -20, right: 8, top: 8 }}>
                <CartesianGrid stroke="#E8EDF4" strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="count" name="Logged exercises" fill="#D97706" radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[.9fr_1.1fr]">
        <MealsPanel key={selectedDate} date={selectedDate} />
        <Panel>
          <p className="font-mono text-[10px] uppercase tracking-[.15em] text-slate-400">Recent activity</p>
          <h2 className="mt-1 font-serif text-xl font-bold">Workout log</h2>
          {!workouts.data?.length ? (
            <div className="mt-4"><EmptyState title="No workouts logged yet." detail="Use the fitness tracker above to record your first session." /></div>
          ) : (
            <div className="mt-3 divide-y divide-slate-100">
              {workouts.data.slice(0, 8).map((item) => (
                <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 py-3" data-testid={`row-workout-${item.id}`}>
                  <div><p className="text-sm font-semibold text-slate-800">{item.exerciseName}</p><p className="mt-1 text-[11px] text-slate-500">{item.date} · {item.sets} sets × {item.repsPerSet} reps</p></div>
                  <span className="rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-900">{item.weightPerSet} {item.weightUnit}</span>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <Panel className="mt-5">
        <p className="font-mono text-[10px] uppercase tracking-[.15em] text-slate-400">Recent daily records</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {health.data?.slice(0, 8).map((item) => (
            <button type="button" key={item.id} onClick={() => changeDate(item.date)} className="rounded-xl bg-slate-50 px-3 py-3 text-left hover:bg-blue-50" data-testid={`row-health-${item.id}`}>
              <p className="text-xs font-semibold text-slate-700">{item.date}</p>
              <p className="mt-1 text-[11px] text-slate-500">{item.weightKg ?? "—"} kg · {item.waterMl} ml · {item.sleepHours ?? "—"} hrs · {item.steps.toLocaleString("en-IN")} steps</p>
            </button>
          ))}
        </div>
      </Panel>
    </div>
  );
}
