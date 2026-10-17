import { useQueryClient } from "@tanstack/react-query";
import {
  getGetHabitsQueryKey,
  useCreateHabit,
  useGetHabits,
  useSaveHabitCheckin,
  useUpdateHabit,
} from "@workspace/api-client-react";
import { Archive, Check, ListChecks, Pencil, Plus, RotateCcw } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
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

type HabitCategory = "good" | "bad";

export function Habits() {
  const query = useGetHabits({ days: 30 });
  const createHabit = useCreateHabit();
  const updateHabit = useUpdateHabit();
  const saveCheckin = useSaveHabitCheckin();
  const client = useQueryClient();
  const [name, setName] = useState("");
  const [category, setCategory] = useState<HabitCategory>("good");
  const [description, setDescription] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editCategory, setEditCategory] = useState<HabitCategory>("good");
  const [editDescription, setEditDescription] = useState("");

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, index) => dateOffset(today(), index - 6)),
    [],
  );
  if (query.isLoading) return <LoadingState label="Loading habits" />;
  if (query.isError || !query.data) return <ErrorState retry={() => query.refetch()} />;

  const habits = query.data.habits;
  const activeHabits = habits.filter((habit) => habit.active);
  const chartData = Array.from({ length: 30 }, (_, index) => {
    const date = dateOffset(today(), index - 29);
    return {
      date: date.slice(5),
      completed: query.data.checkins.filter(
        (checkin) => checkin.date === date && checkin.completed,
      ).length,
    };
  });
  const refresh = () =>
    client.invalidateQueries({ queryKey: getGetHabitsQueryKey({ days: 30 }) });

  const addHabit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (habits.length >= 20 || !name.trim()) return;
    createHabit.mutate(
      { data: { name: name.trim(), category, description: description.trim() || undefined } },
      {
        onSuccess: () => {
          setName("");
          setDescription("");
          setCategory("good");
          void refresh();
        },
      },
    );
  };

  const startEdit = (habit: (typeof habits)[number]) => {
    setEditingId(habit.id);
    setEditName(habit.name);
    setEditCategory(habit.category);
    setEditDescription(habit.description ?? "");
  };

  const saveEdit = (id: number) => {
    updateHabit.mutate(
      {
        id,
        data: {
          name: editName.trim(),
          category: editCategory,
          description: editDescription.trim() || null,
        },
      },
      {
        onSuccess: () => {
          setEditingId(null);
          void refresh();
        },
      },
    );
  };

  const toggleActive = (habit: (typeof habits)[number]) =>
    updateHabit.mutate(
      { id: habit.id, data: { active: !habit.active } },
      { onSuccess: () => void refresh() },
    );

  const toggleCheckin = (habitId: number, date: string, completed: boolean) =>
    saveCheckin.mutate(
      { data: { habitId, date, completed } },
      { onSuccess: () => void refresh() },
    );

  const findCheckin = (habitId: number, date: string) =>
    query.data.checkins.find(
      (checkin) => checkin.habitId === habitId && checkin.date === date,
    );

  return (
    <div className="fade-up">
      <PageHeading
        eyebrow="Small actions, repeated"
        title="Keep the habits that carry you."
        detail="Build a daily check-in rhythm for good habits and behaviors you want to avoid. You can create up to 20 habits."
      />
      <div className="grid gap-5 xl:grid-cols-[.8fr_1.2fr]">
        <Panel>
          <div className="flex items-center gap-2">
            <ListChecks size={19} className="text-blue-800" />
            <div>
              <h2 className="font-serif text-xl font-bold">Add a habit</h2>
              <p className="text-xs text-slate-500">{habits.length} of 20 used</p>
            </div>
          </div>
          <form onSubmit={addHabit} className="mt-4 space-y-3">
            <label className="block text-xs font-semibold text-slate-600">
              Habit name
              <input className={`${inputClass} mt-1`} value={name} onChange={(event) => setName(event.target.value)} maxLength={120} placeholder="e.g. Read the newspaper" required data-testid="input-habit-name" />
            </label>
            <label className="block text-xs font-semibold text-slate-600">
              Category
              <select className={`${inputClass} mt-1`} value={category} onChange={(event) => setCategory(event.target.value as HabitCategory)} data-testid="select-habit-category">
                <option value="good">Build a good habit</option>
                <option value="bad">Avoid a behavior</option>
              </select>
            </label>
            <label className="block text-xs font-semibold text-slate-600">
              Note (optional)
              <input className={`${inputClass} mt-1`} value={description} onChange={(event) => setDescription(event.target.value)} maxLength={500} placeholder="A small reminder" data-testid="input-habit-description" />
            </label>
            <button className={`${primaryButton} w-full`} disabled={createHabit.isPending || habits.length >= 20} data-testid="button-add-habit">
              <Plus size={16} />{createHabit.isPending ? "Saving…" : habits.length >= 20 ? "Habit limit reached" : "Add habit"}
            </button>
            {createHabit.isError && <p className="text-xs text-rose-700">Habit could not be saved.</p>}
          </form>
        </Panel>
        <Panel>
          <p className="font-mono text-[10px] uppercase tracking-[.15em] text-slate-400">Monthly consistency</p>
          <h2 className="mt-1 font-serif text-xl font-bold">Daily completions · last 30 days</h2>
          {!activeHabits.length ? (
            <div className="mt-4"><EmptyState title="Add a habit to begin." detail="Your monthly pattern will appear here." /></div>
          ) : (
            <div className="mt-3 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ left: -20, right: 8, top: 8 }}>
                  <CartesianGrid stroke="#E8EDF4" strokeDasharray="3 3" />
                  <XAxis dataKey="date" interval={4} tick={{ fontSize: 10 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="completed" name="Completed habits" fill="#1E3A8A" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>
      </div>

      <Panel className="mt-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[.15em] text-slate-400">Daily check-in grid</p>
            <h2 className="mt-1 font-serif text-xl font-bold">One day at a time</h2>
          </div>
          <p className="text-xs text-slate-500">For a “behavior to avoid,” check the box when you avoided it.</p>
        </div>
        {!activeHabits.length ? (
          <div className="mt-4"><EmptyState title="No active habits yet." detail="Add one above to start your check-in grid." /></div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[740px] border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="pb-3 pr-3 text-xs font-semibold text-slate-500">Habit</th>
                  {days.map((date) => (
                    <th key={date} className="px-2 pb-3 text-center text-[10px] font-semibold text-slate-500">
                      <span className="block">{new Date(`${date}T12:00:00+05:30`).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", weekday: "short" })}</span>
                      <span className="mt-1 block">{date.slice(8)}</span>
                    </th>
                  ))}
                  <th className="pb-3 pl-2 text-right text-xs font-semibold text-slate-500">Edit</th>
                </tr>
              </thead>
              <tbody>
                {activeHabits.map((habit) => (
                  <tr key={habit.id} className="border-b border-slate-50">
                    <td className="py-3 pr-3">
                      <p className="text-sm font-semibold text-slate-800">{habit.name}</p>
                      <p className={`mt-1 text-[10px] font-semibold uppercase tracking-wider ${habit.category === "good" ? "text-emerald-700" : "text-amber-700"}`}>
                        {habit.category === "good" ? "Build" : "Avoid"}
                      </p>
                    </td>
                    {days.map((date) => {
                      const checkin = findCheckin(habit.id, date);
                      return (
                        <td key={date} className="px-2 py-3 text-center">
                          <input
                            type="checkbox"
                            checked={checkin?.completed ?? false}
                            disabled={saveCheckin.isPending || date > today()}
                            onChange={(event) => toggleCheckin(habit.id, date, event.target.checked)}
                            aria-label={`${habit.category === "bad" ? "Avoided" : "Completed"} ${habit.name} on ${date}`}
                            className="h-4 w-4 accent-[#1E3A8A] disabled:opacity-50"
                            data-testid={`checkin-${habit.id}-${date}`}
                          />
                        </td>
                      );
                    })}
                    <td className="py-3 pl-2 text-right">
                      <button onClick={() => startEdit(habit)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-blue-900" aria-label={`Edit ${habit.name}`} data-testid={`button-edit-habit-${habit.id}`}><Pencil size={15} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {editingId !== null && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-slate-950/30 p-4" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setEditingId(null)}>
          <Panel className="w-full max-w-lg shadow-xl" role="dialog" aria-modal="true" aria-labelledby="edit-habit-title">
            <h2 id="edit-habit-title" className="font-serif text-xl font-bold">Edit habit</h2>
            <div className="mt-4 space-y-3">
              <label className="block text-xs font-semibold text-slate-600">Name<input className={`${inputClass} mt-1`} value={editName} onChange={(event) => setEditName(event.target.value)} maxLength={120} /></label>
              <label className="block text-xs font-semibold text-slate-600">Category<select className={`${inputClass} mt-1`} value={editCategory} onChange={(event) => setEditCategory(event.target.value as HabitCategory)}><option value="good">Build a good habit</option><option value="bad">Avoid a behavior</option></select></label>
              <label className="block text-xs font-semibold text-slate-600">Note<input className={`${inputClass} mt-1`} value={editDescription} onChange={(event) => setEditDescription(event.target.value)} maxLength={500} /></label>
              <div className="flex flex-wrap justify-between gap-2 pt-2">
                <button onClick={() => { const habit = habits.find((item) => item.id === editingId); if (habit) toggleActive(habit); setEditingId(null); }} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700">
                  {habits.find((item) => item.id === editingId)?.active ? <Archive size={14} /> : <RotateCcw size={14} />}
                  {habits.find((item) => item.id === editingId)?.active ? "Archive habit" : "Restore habit"}
                </button>
                <div className="flex gap-2">
                  <button onClick={() => setEditingId(null)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700">Cancel</button>
                  <button onClick={() => saveEdit(editingId)} disabled={updateHabit.isPending || !editName.trim()} className={primaryButton}>
                    <Check size={15} />{updateHabit.isPending ? "Saving…" : "Save changes"}
                  </button>
                </div>
              </div>
              {updateHabit.isError && <p className="text-xs text-rose-700">Could not update this habit.</p>}
            </div>
          </Panel>
        </div>
      )}
      {saveCheckin.isError && <p className="mt-3 text-xs text-rose-700">Check-in failed to save. Try again.</p>}
    </div>
  );
}
