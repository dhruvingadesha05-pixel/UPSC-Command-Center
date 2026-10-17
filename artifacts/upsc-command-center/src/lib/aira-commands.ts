export type ParsedWorkoutCommand = {
  exerciseName: string;
  sets: number;
  repsPerSet: number;
  weightPerSet: number;
  weightUnit: "kg" | "lbs";
};

export type ParsedHabitCommand = {
  name: string;
  category: "good" | "bad";
};

export type ParsedStudyPlanCommand = {
  kind: "module" | "block";
  title: string;
  startDate: string;
  endDate: string;
  estimatedHours: number;
  topics: string[];
};

export function parseWorkoutCommand(command: string): ParsedWorkoutCommand | null {
  const match = command.trim().match(
    /^(?:(?:i did|log|record|add)\s+)?(?:(?:a\s+)?workout\s+)?(\d+)\s+sets?\s+(?:of\s+)?(\d+)\s*(?:reps?\s+(?:of\s+)?)?(.+?)\s+(?:at|with)\s+(body\s*weight|\d+(?:\.\d+)?\s*(?:kg|kgs|kilograms?|lbs?|pounds?))$/i,
  );
  if (!match) return null;

  const sets = Number(match[1]);
  const repsPerSet = Number(match[2]);
  const exerciseName = match[3].trim();
  const weightText = match[4].trim();
  const bodyweight = /^body\s*weight$/i.test(weightText);
  const weightPerSet = bodyweight ? 0 : Number.parseFloat(weightText);
  const weightUnit = /(?:lbs?|pounds?)$/i.test(weightText) ? "lbs" : "kg";

  if (
    !exerciseName ||
    exerciseName.length > 120 ||
    sets < 1 ||
    sets > 50 ||
    repsPerSet < 1 ||
    repsPerSet > 500 ||
    !Number.isFinite(weightPerSet) ||
    weightPerSet < 0 ||
    weightPerSet > 2000
  ) {
    return null;
  }

  return { exerciseName, sets, repsPerSet, weightPerSet, weightUnit };
}

export function parseHabitCommand(command: string): ParsedHabitCommand | null {
  const match = command.trim().match(
    /^(?:add|create|track)\s+(?:a\s+)?habit(?:\s+(?:to\s+(build|avoid)|(good|bad)))?(?:\s*(?::|called|named)\s*)?(.+)$/i,
  );
  if (!match) return null;

  const name = match[3].trim();
  if (!name || name.length > 120) return null;

  return {
    name,
    category: match[1]?.toLowerCase() === "avoid" || match[2]?.toLowerCase() === "bad"
      ? "bad"
      : "good",
  };
}

export function parseStudyPlanCommand(command: string): ParsedStudyPlanCommand | null {
  const match = command.trim().match(
    /^(?:plan|add|create|schedule)\s+(?:a\s+)?(?:(?:future|long-term)\s+)?(?:study\s+)?(module|block)\s+(.+?)\s+from\s+(\d{4}-\d{2}-\d{2})\s+(?:to|through)\s+(\d{4}-\d{2}-\d{2})\s+for\s+(\d+(?:\.\d+)?)\s+hours?(?:\s+covering\s+(.+))?$/i,
  );
  if (!match) return null;

  const kind = match[1].toLowerCase() as ParsedStudyPlanCommand["kind"];
  const title = match[2].trim();
  const startDate = match[3];
  const endDate = match[4];
  const estimatedHours = Number(match[5]);
  const topics = match[6]
    ? match[6].split(/[,;\n]/).map((topic) => topic.trim()).filter(Boolean)
    : kind === "block"
      ? [title]
      : [];

  if (
    !title ||
    title.length > 160 ||
    !Number.isFinite(estimatedHours) ||
    estimatedHours < 1 ||
    estimatedHours > 2000 ||
    topics.length > 100 ||
    topics.some((topic) => topic.length > 200)
  ) {
    return null;
  }

  return { kind, title, startDate, endDate, estimatedHours, topics };
}
