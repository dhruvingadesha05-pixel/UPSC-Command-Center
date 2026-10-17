import { useEffect, useState } from "react";

type CountdownTimerProps = {
  title: string;
  targetDate: string;
  tone: "blue" | "gold";
  testId: string;
};

export function CountdownTimer({
  title,
  targetDate,
  tone,
  testId,
}: CountdownTimerProps) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const target = new Date(`${targetDate}T00:00:00+05:30`).getTime();
  const remaining = Math.max(0, target - now);
  const totalSeconds = Math.floor(remaining / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const toneStyles =
    tone === "blue"
      ? "bg-[#F2F6FC] text-[#1E3A8A]"
      : "bg-[#FFF8EB] text-amber-700";

  return (
    <div className={`rounded-2xl p-5 ${toneStyles}`} data-testid={testId}>
      <p className="font-mono text-[10px] uppercase tracking-[.12em]">
        {title}
      </p>
      <div className="mt-3 flex items-baseline gap-2 font-serif text-3xl font-extrabold tabular-nums sm:text-4xl">
        <span>{days}</span>
        <span className="text-xs font-semibold">d</span>
        <span>{String(hours).padStart(2, "0")}</span>
        <span className="text-xs font-semibold">h</span>
        <span>{String(minutes).padStart(2, "0")}</span>
        <span className="text-xs font-semibold">m</span>
        <span>{String(seconds).padStart(2, "0")}</span>
        <span className="text-xs font-semibold">s</span>
      </div>
      <p className="mt-2 text-[10px] opacity-70">
        Estimate · {targetDate} · Asia/Kolkata
      </p>
    </div>
  );
}
