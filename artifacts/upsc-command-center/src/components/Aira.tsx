import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Send, Volume2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetDashboardSummaryQueryKey, getGetSprintTasksQueryKey, getGetStudyLogsQueryKey, useCreateStudyLog, useGetFreeSlots, useGetSprintTasks, useUpdateSprintTask } from "@workspace/api-client-react";
import { Panel, inputClass, primaryButton, today } from "@/lib/shared";

type SpeechRecognitionResult = { transcript: string };
type SpeechRecognitionEvent = { results: ArrayLike<ArrayLike<SpeechRecognitionResult>> };
type SpeechRecognitionInstance = { lang: string; interimResults: boolean; continuous: boolean; onresult: ((event: SpeechRecognitionEvent) => void) | null; onerror: (() => void) | null; onend: (() => void) | null; start: () => void; stop: () => void; abort: () => void };
type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

const SpeechWindow = window as Window & { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor };

export function Aira() {
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const [notice, setNotice] = useState("");
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const lockRef = useRef(false);
  const queryClient = useQueryClient();
  const createStudy = useCreateStudyLog();
  const sprint = useGetSprintTasks();
  const updateSprint = useUpdateSprintTask();
  const freeSlots = useGetFreeSlots({ days: 14 });
  const speechSupported = Boolean(SpeechWindow.SpeechRecognition || SpeechWindow.webkitSpeechRecognition);

  useEffect(() => () => {
    recognitionRef.current?.abort();
    recognitionRef.current = null;
    lockRef.current = false;
    window.speechSynthesis?.cancel();
  }, []);

  const say = (message: string) => {
    setNotice(message);
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const response = new SpeechSynthesisUtterance(message);
      response.rate = 0.96;
      window.speechSynthesis.speak(response);
    }
  };

  const runCommand = (raw = text) => {
    const command = raw.trim();
    const lower = command.toLowerCase();
    if (!command) return;
    const studyMatch = lower.match(/(?:log|record|studied)\s+(\d+)\s*(?:minutes|min)\s+(?:of\s+)?(.+)/);
    if (studyMatch) {
      createStudy.mutate({ data: { date: today(), durationMinutes: Number(studyMatch[1]), subject: studyMatch[2].trim(), notes: "Logged with Aira" } }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetStudyLogsQueryKey({ days: 30 }) });
          queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
          say(`Recorded ${studyMatch[1]} minutes for ${studyMatch[2]}.`);
        },
        onError: () => say("I could not save that session. Please try again."),
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
      updateSprint.mutate({ id: match.id, data: { completed: true } }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetSprintTasksQueryKey() });
          say(`Marked ${match.title} complete for day ${dayNumber}.`);
        },
        onError: () => say("I could not update that sprint target. Please try again."),
      });
      return;
    }
    if (lower.includes("sprint")) {
      const total = sprint.data?.length ?? 0;
      const done = sprint.data?.filter((task) => task.completed).length ?? 0;
      say(sprint.isLoading ? "Your sprint is loading." : `Your sprint has ${done} of ${total} targets complete.`);
      return;
    }
    if (lower.includes("calendar") || lower.includes("free time") || lower.includes("schedule")) {
      const nextSlot = freeSlots.data?.[0];
      if (freeSlots.isLoading) {
        say("Your available time is loading.");
      } else if (nextSlot) {
        const start = new Date(nextSlot.start).toLocaleString("en-IN", { weekday: "long", hour: "numeric", minute: "2-digit" });
        say(`You have ${Math.floor(nextSlot.durationMinutes / 60)} hours and ${nextSlot.durationMinutes % 60} minutes free, starting ${start}.`);
      } else {
        say("No free blocks were returned. Check calendar connection and day hours in Settings.");
      }
      return;
    }
    say("Try: log 45 minutes of Polity, show sprint, complete day 3, or find free time.");
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

  return <Panel className="overflow-hidden border-blue-100 bg-[linear-gradient(120deg,#fff_45%,#eff5ff_100%)]">
    <div className="flex items-start justify-between gap-3"><div><p className="font-mono text-[10px] font-bold uppercase tracking-[.18em] text-blue-800">Aira · voice study companion</p><h2 className="mt-1 font-serif text-xl font-bold text-slate-900">Tell me what you did.</h2></div><div className={`grid h-10 w-10 place-items-center rounded-xl ${listening ? "animate-pulse bg-rose-100 text-rose-700" : "bg-blue-100 text-blue-800"}`}><Volume2 size={18}/></div></div>
    <div className="mt-4 flex gap-2"><input value={text} onChange={(event) => setText(event.target.value)} onKeyDown={(event) => event.key === "Enter" && runCommand()} className={inputClass} placeholder="Try “log 45 minutes of Polity”" aria-label="Aira command" data-testid="input-aira-command"/><button className={primaryButton} onClick={() => runCommand()} disabled={createStudy.isPending || updateSprint.isPending} aria-label="Send command" data-testid="button-aira-send"><Send size={16}/></button></div>
    <div className="mt-3 flex items-center justify-between gap-3"><button onClick={listening ? cancelListening : startListening} className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold ${listening ? "bg-rose-100 text-rose-800" : "bg-blue-50 text-blue-900"}`} data-testid="button-aira-microphone">{listening ? <MicOff size={15}/> : <Mic size={15}/>} {listening ? "Stop listening" : speechSupported ? "Speak a command" : "Voice unavailable"}</button><span className="text-right text-[11px] text-slate-500" data-testid="status-aira">{notice || (speechSupported ? "Voice or text commands" : "Text fallback enabled")}</span></div>
  </Panel>;
}
