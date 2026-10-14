import { useQueryClient } from "@tanstack/react-query";
import { getGetHealthLogsQueryKey, getGetMealLogsQueryKey, useCreateMealLog, useDeleteMealLog, useGetHealthLogs, useGetMealLogs, useGetSettings, useSaveHealthLog, type MealLog } from "@workspace/api-client-react";
import { useState, type FormEvent } from "react";
import { Apple, GlassWater, HeartPulse, Moon, Plus, Scale, Trash2 } from "lucide-react";
import { EmptyState, ErrorState, LoadingState, PageHeading, Panel, inputClass, primaryButton, today } from "@/lib/shared";

export function Wellness() {
  const health = useGetHealthLogs({ days: 30 });
  const meals = useGetMealLogs({ date: today() });
  const settings = useGetSettings();
  const saveHealth = useSaveHealthLog();
  const addMeal = useCreateMealLog();
  const deleteMeal = useDeleteMealLog();
  const client = useQueryClient();
  const [weight, setWeight] = useState("");
  const [water, setWater] = useState("");
  const [sleep, setSleep] = useState("");
  const [mealName, setMealName] = useState("");
  const [calories, setCalories] = useState("");
  const [mealType, setMealType] = useState<MealLog["mealType"]>("breakfast");
  if (health.isLoading || meals.isLoading || settings.isLoading) return <LoadingState label="Loading wellness records"/>;
  if (health.isError || meals.isError || settings.isError) return <ErrorState retry={() => { void health.refetch(); void meals.refetch(); void settings.refetch(); }}/>;
  const todayLog = health.data?.find((item) => item.date === today());
  const waterValue = Number(water || todayLog?.waterMl || 0);
  const saveVitals = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    saveHealth.mutate({ data: { date: today(), weightKg: weight ? Number(weight) : todayLog?.weightKg, waterMl: waterValue, sleepHours: sleep ? Number(sleep) : todayLog?.sleepHours } }, {
      onSuccess: () => {
        setWeight("");
        setWater("");
        setSleep("");
        client.invalidateQueries({ queryKey: getGetHealthLogsQueryKey({ days: 30 }) });
      },
    });
  };
  const submitMeal = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    addMeal.mutate({ data: { date: today(), name: mealName, calories: Number(calories), mealType } }, { onSuccess: () => { setMealName(""); setCalories(""); client.invalidateQueries({ queryKey: getGetMealLogsQueryKey({ date: today() }) }); } });
  };
  const removeMeal = (id: number) => deleteMeal.mutate({ id }, { onSuccess: () => client.invalidateQueries({ queryKey: getGetMealLogsQueryKey({ date: today() }) }) });
  const goalWater = settings.data?.waterGoalMl ?? 2500;
  const goalSleep = settings.data?.sleepGoalHours ?? 8;
  const mealTotal = meals.data?.reduce((sum, item) => sum + item.calories, 0) ?? 0;
  return <div className="fade-up"><PageHeading eyebrow="Support the long game" title="Well-being is part of preparation." detail="Log today's signals. Targets are yours to set in Settings; this page keeps your physical routine visible beside study work."/>
    <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Panel><div className="flex items-center justify-between"><p className="text-xs text-slate-500">Water today</p><GlassWater size={17} className="text-teal-700"/></div><p className="mt-2 font-serif text-3xl font-extrabold text-slate-900" data-testid="value-wellness-water">{(waterValue / 1000).toFixed(1)}<span className="ml-1 text-sm">L</span></p><p className="mt-2 text-xs text-slate-500">Goal {(goalWater / 1000).toFixed(1)} L</p><div className="mt-3 h-1.5 rounded-full bg-teal-100"><div className="h-full rounded-full bg-teal-700" style={{ width: `${Math.min(100, waterValue / goalWater * 100)}%` }}/></div></Panel>
    <Panel><div className="flex items-center justify-between"><p className="text-xs text-slate-500">Sleep last logged</p><Moon size={17} className="text-indigo-700"/></div><p className="mt-2 font-serif text-3xl font-extrabold text-slate-900" data-testid="value-wellness-sleep">{todayLog?.sleepHours ?? "—"}<span className="ml-1 text-sm">hrs</span></p><p className="mt-2 text-xs text-slate-500">Goal {goalSleep} hours</p></Panel>
    <Panel><div className="flex items-center justify-between"><p className="text-xs text-slate-500">Weight last logged</p><Scale size={17} className="text-blue-800"/></div><p className="mt-2 font-serif text-3xl font-extrabold text-slate-900" data-testid="value-wellness-weight">{todayLog?.weightKg ?? "—"}<span className="ml-1 text-sm">kg</span></p><p className="mt-2 text-xs text-slate-500">{todayLog ? `Recorded ${todayLog.date}` : "Not recorded today"}</p></Panel>
    <Panel><div className="flex items-center justify-between"><p className="text-xs text-slate-500">Meal calories today</p><Apple size={17} className="text-amber-700"/></div><p className="mt-2 font-serif text-3xl font-extrabold text-slate-900" data-testid="value-wellness-calories">{mealTotal}<span className="ml-1 text-sm">kcal</span></p><p className="mt-2 text-xs text-slate-500">{meals.data?.length ?? 0} meals logged</p></Panel></div>
    <div className="grid gap-5 xl:grid-cols-[.9fr_1.1fr]"><Panel><div className="flex items-center gap-2"><HeartPulse className="text-rose-700" size={19}/><div><h2 className="font-serif text-xl font-bold">Daily health log</h2><p className="text-xs text-slate-500">Save today's water, sleep, and weight in one entry.</p></div></div><form onSubmit={saveVitals} className="mt-5 space-y-4"><label className="block text-xs font-semibold text-slate-600">Weight in kg<input className={`${inputClass} mt-1`} type="number" min="20" max="400" step="0.1" placeholder={todayLog?.weightKg ? String(todayLog.weightKg) : "e.g. 68.4"} value={weight} onChange={(event) => setWeight(event.target.value)} data-testid="input-health-weight"/></label><label className="block text-xs font-semibold text-slate-600">Water in ml<input className={`${inputClass} mt-1`} type="number" min="0" max="20000" step="100" placeholder={String(todayLog?.waterMl ?? 0)} value={water} onChange={(event) => setWater(event.target.value)} data-testid="input-health-water"/></label><label className="block text-xs font-semibold text-slate-600">Sleep in hours<input className={`${inputClass} mt-1`} type="number" min="0" max="24" step="0.25" placeholder={todayLog?.sleepHours ? String(todayLog.sleepHours) : "e.g. 7.5"} value={sleep} onChange={(event) => setSleep(event.target.value)} data-testid="input-health-sleep"/></label><button className={`${primaryButton} w-full`} disabled={saveHealth.isPending} data-testid="button-save-health">{saveHealth.isPending ? "Saving…" : "Save today's health log"}</button></form>{saveHealth.isError && <p className="mt-2 text-xs text-rose-700">Could not save. Check values and retry.</p>}</Panel>
    <Panel><div className="flex items-center justify-between gap-3"><div><p className="font-mono text-[10px] uppercase tracking-[.15em] text-slate-400">Food journal</p><h2 className="mt-1 font-serif text-xl font-bold">Meals today</h2></div><span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">{mealTotal} kcal</span></div><form onSubmit={submitMeal} className="mt-4 grid gap-2 sm:grid-cols-[1fr_100px_130px_auto]"><input className={inputClass} placeholder="Meal or snack" value={mealName} onChange={(event) => setMealName(event.target.value)} required data-testid="input-meal-name"/><input className={inputClass} type="number" min="0" max="10000" placeholder="kcal" value={calories} onChange={(event) => setCalories(event.target.value)} required data-testid="input-meal-calories"/><select className={inputClass} value={mealType} onChange={(event) => setMealType(event.target.value as MealLog["mealType"])} aria-label="Meal type" data-testid="select-meal-type"><option value="breakfast">Breakfast</option><option value="lunch">Lunch</option><option value="dinner">Dinner</option><option value="snack">Snack</option></select><button className={`${primaryButton} px-3`} disabled={addMeal.isPending} aria-label="Add meal" data-testid="button-add-meal"><Plus size={16}/></button></form>{!meals.data?.length ? <div className="mt-4"><EmptyState title="No meals logged yet." detail="Add your first meal or snack above."/></div> : <div className="mt-4 divide-y divide-slate-100">{meals.data.map((meal) => <div key={meal.id} className="flex items-center justify-between gap-3 py-3" data-testid={`row-meal-${meal.id}`}><div><p className="text-sm font-semibold text-slate-800">{meal.name}</p><p className="mt-1 text-xs capitalize text-slate-500">{meal.mealType} · {meal.calories} kcal</p></div><button onClick={() => removeMeal(meal.id)} disabled={deleteMeal.isPending} className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-700" aria-label={`Delete ${meal.name}`} data-testid={`button-delete-meal-${meal.id}`}><Trash2 size={15}/></button></div>)}</div>}</Panel></div>
    <Panel className="mt-5"><p className="font-mono text-[10px] uppercase tracking-[.15em] text-slate-400">Recent daily records</p><div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{health.data?.slice(0, 8).map((item) => <div key={item.id} className="rounded-xl bg-slate-50 px-3 py-3" data-testid={`row-health-${item.id}`}><p className="text-xs font-semibold text-slate-700">{item.date}</p><p className="mt-1 text-[11px] text-slate-500">{item.weightKg ?? "—"} kg · {item.waterMl} ml · {item.sleepHours ?? "—"} hrs</p></div>)}</div></Panel>
  </div>;
}
