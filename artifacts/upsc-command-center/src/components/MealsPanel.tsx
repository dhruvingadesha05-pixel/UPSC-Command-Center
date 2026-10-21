import { useQueryClient } from "@tanstack/react-query";
import {
  getGetDashboardSummaryQueryKey,
  getGetMealLogsQueryKey,
  useCreateMealLog,
  useDeleteMealLog,
  useGetMealLogs,
  useUpdateMealLog,
  type MealLog,
} from "@workspace/api-client-react";
import { Apple, Pencil, Plus, Trash2, X } from "lucide-react";
import { useState, type FormEvent } from "react";
import { EmptyState, Panel, inputClass, primaryButton } from "@/lib/shared";

type MealType = MealLog["mealType"];

const sections: { type: MealType; label: string }[] = [
  { type: "breakfast", label: "Breakfast" },
  { type: "lunch", label: "Lunch" },
  { type: "dinner", label: "Dinner" },
  { type: "snack", label: "Snacks" },
];

/**
 * Meals & Calories for one calendar day (`date` = YYYY-MM-DD).
 * Parent remounts this via `key={date}` so form state never leaks between days.
 */
export function MealsPanel({ date }: { date: string }) {
  const client = useQueryClient();
  const meals = useGetMealLogs({ date });
  const addMeal = useCreateMealLog();
  const updateMeal = useUpdateMealLog();
  const deleteMeal = useDeleteMealLog();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [mealType, setMealType] = useState<MealType>("breakfast");

  const list = meals.data ?? [];
  const totalKcal = list.reduce((sum, item) => sum + item.calories, 0);
  const totalProtein = list.reduce((sum, item) => sum + item.proteinG, 0);
  const saving = addMeal.isPending || updateMeal.isPending;

  const refresh = () => {
    void client.invalidateQueries({ queryKey: getGetMealLogsQueryKey({ date }) });
    void client.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
  };
  const resetForm = () => {
    setEditingId(null);
    setName("");
    setCalories("");
    setProtein("");
  };
  const startEdit = (meal: MealLog) => {
    setEditingId(meal.id);
    setName(meal.name);
    setCalories(String(meal.calories));
    setProtein(String(meal.proteinG));
    setMealType(meal.mealType);
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = {
      date,
      name: name.trim(),
      calories: Number(calories),
      proteinG: Number(protein || 0),
      mealType,
    };
    const onSuccess = () => {
      resetForm();
      refresh();
    };
    if (editingId === null) addMeal.mutate({ data }, { onSuccess });
    else updateMeal.mutate({ id: editingId, data }, { onSuccess });
  };

  const remove = (id: number) =>
    deleteMeal.mutate(
      { id },
      {
        onSuccess: () => {
          if (editingId === id) resetForm();
          refresh();
        },
      },
    );

  return (
    <Panel>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Apple size={18} className="text-amber-700" />
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[.15em] text-slate-400">Meals &amp; Calories</p>
            <h2 className="font-serif text-xl font-bold">Food journal · {date}</h2>
          </div>
        </div>
        <p className="text-right text-xs font-semibold text-slate-600" data-testid="text-meal-totals">
          {totalKcal} kcal · {totalProtein} g protein
        </p>
      </div>

      <form onSubmit={submit} className="mt-4 grid gap-2 sm:grid-cols-[1fr_90px_90px_120px_auto]">
        <input className={inputClass} placeholder="Meal name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} data-testid="input-meal-name" />
        <input className={inputClass} type="number" min="0" max="10000" placeholder="kcal" value={calories} onChange={(e) => setCalories(e.target.value)} required data-testid="input-meal-calories" />
        <input className={inputClass} type="number" min="0" max="1000" placeholder="protein g" value={protein} onChange={(e) => setProtein(e.target.value)} data-testid="input-meal-protein" />
        <select className={inputClass} value={mealType} onChange={(e) => setMealType(e.target.value as MealType)} aria-label="Meal type" data-testid="select-meal-type">
          {sections.map((s) => (
            <option key={s.type} value={s.type}>{s.label}</option>
          ))}
        </select>
        <div className="flex gap-2">
          <button className={`${primaryButton} px-3`} disabled={saving} aria-label={editingId === null ? "Add meal" : "Save meal"} data-testid="button-add-meal">
            {editingId === null ? <Plus size={16} /> : "Save"}
          </button>
          {editingId !== null && (
            <button type="button" onClick={resetForm} className="rounded-xl border border-slate-200 px-3 text-slate-500" aria-label="Cancel edit" data-testid="button-cancel-meal-edit">
              <X size={16} />
            </button>
          )}
        </div>
      </form>
      {(addMeal.isError || updateMeal.isError || deleteMeal.isError) && (
        <p className="mt-2 text-xs text-rose-700">Could not save the meal. Check the values and retry.</p>
      )}

      {meals.isLoading ? (
        <p className="mt-4 text-xs text-slate-500">Loading meals…</p>
      ) : !list.length ? (
        <div className="mt-4"><EmptyState title="No meals logged for this day." detail="Add a meal above; past dates can be filled in too." /></div>
      ) : (
        <div className="mt-4 space-y-4">
          {sections.map(({ type, label }) => {
            const rows = list.filter((item) => item.mealType === type);
            if (!rows.length) return null;
            return (
              <div key={type}>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
                <div className="divide-y divide-slate-100">
                  {rows.map((meal) => (
                    <div key={meal.id} className="flex items-center justify-between gap-3 py-2.5" data-testid={`row-meal-${meal.id}`}>
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{meal.name}</p>
                        <p className="mt-0.5 text-xs text-slate-500">{meal.calories} kcal · {meal.proteinG} g protein</p>
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => startEdit(meal)} className="rounded-lg p-2 text-slate-400 hover:bg-blue-50 hover:text-blue-800" aria-label={`Edit ${meal.name}`} data-testid={`button-edit-meal-${meal.id}`}><Pencil size={15} /></button>
                        <button onClick={() => remove(meal.id)} disabled={deleteMeal.isPending} className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-700" aria-label={`Delete ${meal.name}`} data-testid={`button-delete-meal-${meal.id}`}><Trash2 size={15} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}
