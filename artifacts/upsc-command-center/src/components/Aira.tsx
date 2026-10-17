import { useEffect, useRef, useState } from "react";
import {
  CalendarDays,
  Check,
  Mic,
  MicOff,
  Send,
  Sparkles,
  Volume2,
  X,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetCalendarEventsQueryKey,
  getGetDashboardSummaryQueryKey,
  getGetFreeSlotsQueryKey,
  getGetHabitsQueryKey,
  getGetSettingsQueryKey,
  getGetSprintTasksQueryKey,
  getGetStudyLogsQueryKey,
  getGetSubjectsQueryKey,
  getGetWorkoutLogsQueryKey,
  useAutoScheduleSubjects,
  useCreateCalendarEvent,
  useCreateHabit,
  useCreateStudyLog,
  useCreateSubject,
  useCreateWorkoutLog,
  useGetDashboardSummary,
  useGetFreeSlots,
  useGetHabits,
  useGetSettings,
  useGetSprintTasks,
  useSaveHabitCheckin,
  useUpdateSprintTask,
} from "@workspace/api-client-react";
import { Panel, inputClass, primaryButton, dateOffset, today } from "@/lib/shared";
import {
  parseHabitCommand,
  parseStudyPlanCommand,
  parseWorkoutCommand,
} from "@/lib/aira-commands";

type SpeechRecognitionResult = { transcript: string };
type SpeechRecognitionEvent = { results: ArrayLike<ArrayLike<SpeechRecognitionResult>> };
type SpeechRecognitionInstance = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

const SpeechWindow = window as Window & {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
};

type AiraProps = { onClose?: () => void };

function indiaDateFor(value: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  return `${parts.find((part) => part.type === "year")?.value}-${parts.find((part) => part.type === "month")?.value}-${parts.find((part) => part.type === "day")?.value}`;
}

function formatIndiaTime(value: string) {
  return new Date(value).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "long",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function Aira({ onClose }: AiraProps) {
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const [notice, setNotice] = useState("");
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const lockRef = useRef(false);
  const queryClient = useQueryClient();
  const createStudy = useCreateStudyLog();
  const createWorkout = useCreateWorkoutLog();
  const createHabit = useCreateHabit();
  const createSubject = useCreateSubject();
  const createCalendarEvent = useCreateCalendarEvent();
  const saveCheckin = useSaveHabitCheckin();
  const autoSchedule = useAutoScheduleSubjects();
  const sprint = useGetSprintTasks();
  const updateSprint = useUpdateSprintTask();
  const freeSlots = useGetFreeSlots({ days: 14 });
  const summary = useGetDashboardSummary();
  const settings = useGetSettings();
  const habits = useGetHabits({ days: 30 });
  const speechSupported = Boolean(SpeechWindow.SpeechRecognition || SpeechWindow.webkitSpeechRecognition);

  useEffect(() => () => {
    recognitionRef.current?.abort();
    recognitionRef.current = null;
    lockRef.current = false;
    window.speechSynthesis?.cancel();
  }, []);

  const say = (message: string) => {
    setNotice(message);
    if ("speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined") {
      window.speechSynthesis.cancel();
      const response = new SpeechSynthesisUtterance(message);
      response.lang = "en-IN";
      response.rate = 0.96;
      window.speechSynthesis.speak(response);
    }
  };

  const refresh = (...keys: unknown[]) => {
    for (const queryKey of keys) {
      void queryClient.invalidateQueries({ queryKey: queryKey as readonly unknown[] });
    }
  };

  const runCommand = (raw = text) => {
    const command = raw.trim();
    const lower = command.toLowerCase();
    if (!command) return;

    const studyMatch = lower.match(/(?:log|record|studied)\s+(\d+)\s*(?:minutes|min)\s+(?:of\s+)?(.+)/);
    if (studyMatch) {
      createStudy.mutate(
        { data: { date: today(), durationMinutes: Number(studyMatch[1]), subject: studyMatch[2].trim(), notes: "Logged with Aira" } },
        {
          onSuccess: () => {
            setText("");
            refresh(
              getGetStudyLogsQueryKey({ days: 30 }),
              getGetDashboardSummaryQueryKey(),
            );
            say(`Recorded ${studyMatch[1]} minutes for ${studyMatch[2]}.`);
          },
          onError: () => say("I could not save that session. Please try again."),
        },
      );
      return;
    }

    const workout = parseWorkoutCommand(command);
    if (workout) {
      createWorkout.mutate(
        {
          data: {
            date: today(),
            ...workout,
          },
        },
        {
          onSuccess: () => {
            setText("");
            refresh(getGetWorkoutLogsQueryKey({ days: 30 }));
            say(`Logged ${workout.sets} sets of ${workout.repsPerSet} ${workout.exerciseName} at ${workout.weightPerSet} ${workout.weightUnit}.`);
          },
          onError: () => say("I could not save that workout. Please try again."),
        },
      );
      return;
    }

    if (/\bworkout\b|\bsets?\b/i.test(command)) {
      say("Include every workout detail, for example: log workout 3 sets of 10 reps of squats at 30 kg. Use bodyweight instead of a load if needed.");
      return;
    }

    const habitToAdd = parseHabitCommand(command);
    if (habitToAdd) {
      if (habits.isLoading || !habits.data) {
        say("Your habits are loading. Try again in a moment.");
        return;
      }
      if (habits.data.habits.length >= 20) {
        say("Your habit list is full. Archive a habit before adding another.");
        return;
      }
      createHabit.mutate(
        { data: habitToAdd },
        {
          onSuccess: () => {
            setText("");
            refresh(getGetHabitsQueryKey({ days: 30 }));
            say(`Added ${habitToAdd.category === "bad" ? "avoid" : "good"} habit: ${habitToAdd.name}.`);
          },
          onError: () => say("I could not add that habit. Check the 20-habit limit and try again."),
        },
      );
      return;
    }

    const studyPlan = parseStudyPlanCommand(command);
    if (studyPlan) {
      const validDate = (value: string) => {
        const parsed = new Date(`${value}T00:00:00.000Z`);
        return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
      };
      if (
        !validDate(studyPlan.startDate) ||
        !validDate(studyPlan.endDate) ||
        studyPlan.startDate < today() ||
        studyPlan.endDate < studyPlan.startDate
      ) {
        say("Use valid dates in YYYY-MM-DD format, with a start date today or later and an end date on or after it.");
        return;
      }
      createSubject.mutate(
        {
          data: {
            title: studyPlan.title,
            startDate: studyPlan.startDate,
            endDate: studyPlan.endDate,
            estimatedHours: studyPlan.estimatedHours,
            topics: studyPlan.topics,
          },
        },
        {
          onSuccess: () => {
            setText("");
            refresh(getGetSubjectsQueryKey());
            say(`Added ${studyPlan.kind} "${studyPlan.title}" from ${studyPlan.startDate} through ${studyPlan.endDate} to your study plan.`);
          },
          onError: () => say("I could not save that study plan. Check the dates and estimated hours."),
        },
      );
      return;
    }

    const calendarMatch = command.match(/^(?:schedule|book|add)\s+(.+?)\s+(?:for\s+)?(today|tomorrow)(?:\s+at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i);
    if (calendarMatch) {
      const offset = calendarMatch[2].toLowerCase() === "tomorrow" ? 1 : 0;
      let hour = Number(calendarMatch[3]);
      const minute = Number(calendarMatch[4] ?? 0);
      const meridiem = calendarMatch[5].toLowerCase();
      if (hour < 1 || hour > 12 || minute > 59) {
        say("Use a clock time like 4 PM or 4:30 PM.");
        return;
      }
      hour = hour % 12 + (meridiem === "pm" ? 12 : 0);
      const date = dateOffset(today(), offset);
      const start = new Date(`${date}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00+05:30`);
      if (start.getTime() <= Date.now()) {
        say("That time has already passed. Choose a future time.");
        return;
      }
      const end = new Date(start.getTime() + 60 * 60 * 1000);
      createCalendarEvent.mutate(
        {
          data: {
            title: calendarMatch[1].trim(),
            start: start.toISOString(),
            end: end.toISOString(),
            description: "Added with Aira",
          },
        },
        {
          onSuccess: () => {
            setText("");
            refresh(
              getGetCalendarEventsQueryKey(),
              getGetFreeSlotsQueryKey({ days: 14 }),
            );
            say(`Added ${calendarMatch[1].trim()} to Google Calendar for ${formatIndiaTime(start.toISOString())}.`);
          },
          onError: () => say("I could not add that calendar event. Check the calendar connection and try again."),
        },
      );
      return;
    }

    const habitMatch = command.match(/^(?:mark|check|log)\s+(.+?)\s+(?:done|complete(?:d)?|avoided)$/i);
    if (habitMatch) {
      const matchedHabit = habits.data?.habits.find(
        (habit) =>
          habit.active &&
          habit.name.toLowerCase().includes(habitMatch[1].trim().toLowerCase()),
      );
      if (!matchedHabit) {
        say(habits.isLoading ? "Your habits are loading." : "I could not find that active habit. Check its name in Habits.");
        return;
      }
      saveCheckin.mutate(
        { data: { habitId: matchedHabit.id, date: today(), completed: true } },
        {
          onSuccess: () => {
            setText("");
            refresh(getGetHabitsQueryKey({ days: 30 }));
            say(matchedHabit.category === "bad"
              ? `Marked that you avoided ${matchedHabit.name} today.`
              : `Checked off ${matchedHabit.name} for today.`);
          },
          onError: () => say("I could not save that habit check-in."),
        },
      );
      return;
    }

    if (lower.includes("auto-schedule") || lower.includes("schedule my subjects") || lower.includes("allocate my topics")) {
      autoSchedule.mutate(undefined, {
        onSuccess: (result) => {
          refresh(
            getGetFreeSlotsQueryKey({ days: 14 }),
            getGetCalendarEventsQueryKey(),
          );
          say(result.message);
        },
        onError: () => say("I could not schedule the topics. Check calendar access and your subject date windows."),
      });
      return;
    }

    const sprintMatch = lower.match(/(?:complete|finish|done)\s+(?:day\s*)?(\d+)(?:\s+(.+))?/);
    if (sprintMatch && lower.includes("day")) {
      if (!sprint.data?.length) {
        say("I could not find sprint targets. Open the sprint page to add your plan.");
        return;
      }
      const dayNumber = Number(sprintMatch[1]);
      const taskFragment = sprintMatch[2]?.trim();
      const match = sprint.data.find((task) => task.dayNumber === dayNumber && !task.completed && (!taskFragment || task.title.toLowerCase().includes(taskFragment)));
      if (!match) {
        say(`I could not find an incomplete target for day ${dayNumber}.`);
        return;
      }
      updateSprint.mutate(
        { id: match.id, data: { completed: true } },
        {
          onSuccess: () => {
            refresh(getGetSprintTasksQueryKey());
            say(`Marked ${match.title} complete for day ${dayNumber}.`);
          },
          onError: () => say("I could not update that sprint target. Please try again."),
        },
      );
      return;
    }

    if (lower.includes("daily briefing") || lower.includes("morning briefing") || lower === "brief me") {
      if (summary.isLoading || settings.isLoading) {
        say("Your daily briefing is loading.");
        return;
      }
      if (!summary.data || !settings.data) {
        say("I could not load your briefing. Try again in a moment.");
        return;
      }
      const data = summary.data;
      const nextSlot = freeSlots.data?.[0];
      const slotMessage = nextSlot
        ? ` Your next open block is ${formatIndiaTime(nextSlot.start)} for ${Math.floor(nextSlot.durationMinutes / 60)} hours and ${nextSlot.durationMinutes % 60} minutes.`
        : " I could not find a free block in the current calendar window.";
      say(`Today: ${data.studyMinutesToday} of ${data.studyTargetMinutes} study minutes, ${data.steps.toLocaleString("en-IN")} of ${data.stepGoal.toLocaleString("en-IN")} steps, ${data.waterMl} millilitres of water, and ${data.sleepHours ?? "no"} sleep hours logged.${slotMessage}`);
      return;
    }

    if (lower.includes("sprint")) {
      const total = sprint.data?.length ?? 0;
      const done = sprint.data?.filter((task) => task.completed).length ?? 0;
      say(sprint.isLoading ? "Your sprint is loading." : `Your sprint has ${done} of ${total} targets complete.`);
      return;
    }

    if (lower.includes("calendar") || lower.includes("free time") || lower.includes("free slot") || lower.includes("available time")) {
      const requestedDay = lower.includes("tomorrow") ? dateOffset(today(), 1) : today();
      const slots = freeSlots.data?.filter((slot) => indiaDateFor(slot.start) === requestedDay) ?? [];
      if (freeSlots.isLoading) {
        say("Your available time is loading.");
      } else if (slots.length) {
        const slot = slots[0];
        say(`On ${requestedDay}, you have ${Math.floor(slot.durationMinutes / 60)} hours and ${slot.durationMinutes % 60} minutes free, starting ${formatIndiaTime(slot.start)}.`);
      } else {
        say(`I found no free blocks for ${requestedDay}. Check your calendar connection and available day window in Settings.`);
      }
      return;
    }

    say("Try: log 45 minutes of Polity; log workout 3 sets of 10 reps of squats at 30 kg; add habit to build reading; mark reading done; plan study module Polity from YYYY-MM-DD to YYYY-MM-DD for 20 hours; schedule Polity for tomorrow at 4 PM; show sprint; or give my daily briefing.");
  };

  const startListening = () => {
    const Constructor = SpeechWindow.SpeechRecognition || SpeechWindow.webkitSpeechRecognition;
    if (!Constructor) {
      setNotice("Speech recognition is unavailable in this browser. Type a command instead.");
      return;
    }
    if (lockRef.current) return;
    lockRef.current = true;
    const recognition = new Constructor();
    recognitionRef.current = recognition;
    recognition.lang = "en-IN";
    recognition.interimResults = false;
    recognition.continuous = false;
    setListening(true);
    setNotice("Listening now. Speak a command.");
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript || "";
      setText(transcript);
      runCommand(transcript);
    };
    recognition.onerror = () => {
      setNotice("Microphone access failed or listening was interrupted. Type a command instead.");
      setListening(false);
      lockRef.current = false;
    };
    recognition.onend = () => {
      setListening(false);
      lockRef.current = false;
      recognitionRef.current = null;
    };
    try {
      recognition.start();
    } catch {
      setListening(false);
      lockRef.current = false;
      recognitionRef.current = null;
      setNotice("Could not start the microphone. Type a command instead.");
    }
  };

  const cancelListening = () => {
    recognitionRef.current?.abort();
    recognitionRef.current = null;
    lockRef.current = false;
    setListening(false);
    setNotice("Listening cancelled.");
    window.speechSynthesis?.cancel();
  };

  const pending =
    createStudy.isPending ||
    createWorkout.isPending ||
    createHabit.isPending ||
    createSubject.isPending ||
    createCalendarEvent.isPending ||
    saveCheckin.isPending ||
    autoSchedule.isPending ||
    updateSprint.isPending;

  return (
    <Panel className="overflow-hidden border-blue-100 bg-[linear-gradient(120deg,#fff_45%,#eff5ff_100%)] shadow-xl shadow-blue-950/10">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <div className="mt-0.5 rounded-lg bg-amber-50 p-2 text-amber-700"><Sparkles size={17} /></div>
          <div>
            <p className="font-mono text-[10px] font-bold uppercase tracking-[.18em] text-blue-800">Aira · voice study companion</p>
            <h2 className="mt-1 font-serif text-xl font-bold text-slate-900">What should I help with?</h2>
          </div>
        </div>
        {onClose && <button onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Close Aira"><X size={17} /></button>}
      </div>
      <div className="mt-4 flex gap-2">
        <input
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && runCommand()}
          className={inputClass}
          placeholder="e.g. log 45 minutes of Polity"
          aria-label="Aira command"
          data-testid="input-aira-command"
        />
        <button className={primaryButton} onClick={() => runCommand()} disabled={pending} aria-label="Send command" data-testid="button-aira-send">
          <Send size={16} />
        </button>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <button onClick={listening ? cancelListening : startListening} className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold ${listening ? "bg-rose-100 text-rose-800" : "bg-blue-50 text-blue-900"}`} data-testid="button-aira-microphone">
          {listening ? <MicOff size={15} /> : <Mic size={15} />}
          {listening ? "Stop listening" : speechSupported ? "Speak a command" : "Voice unavailable"}
        </button>
        {pending && <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-800"><CalendarDays size={13} />Working…</span>}
      </div>
      <p className="mt-3 min-h-10 rounded-lg bg-white/80 px-3 py-2 text-[11px] leading-5 text-slate-600" role="status" aria-live="polite" data-testid="status-aira">
        {notice || (speechSupported ? "Voice or text commands · microphone access stays locked to one listening session." : "Text fallback enabled · speech recognition is not available in this browser.")}
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <span className="rounded-full bg-white px-2.5 py-1 text-[9px] text-slate-500"><Check size={11} className="mr-1 inline" />study</span>
        <span className="rounded-full bg-white px-2.5 py-1 text-[9px] text-slate-500">workouts</span>
        <span className="rounded-full bg-white px-2.5 py-1 text-[9px] text-slate-500">calendar</span>
        <span className="rounded-full bg-white px-2.5 py-1 text-[9px] text-slate-500">habits</span>
        <span className="rounded-full bg-white px-2.5 py-1 text-[9px] text-slate-500">briefing</span>
      </div>
    </Panel>
  );
}
