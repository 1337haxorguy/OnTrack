import { useState, useEffect } from "react";
import { useApp, FREE_LIMITS } from "../context/AppContext";
import { useAuth } from "../context/AuthContext";
import type { DayPlan } from "../context/AppContext";

const API_BASE = import.meta.env.VITE_API_BASE;

function toDateStr(d: Date) {
  return d.toLocaleDateString("en-CA"); // YYYY-MM-DD
}

export default function Recap() {
  const { goals, schedule, plan, setPlan, showToast, usage, incrementGenerations, limitsEnabled } = useApp();
  const genLimitHit = limitsEnabled && isAuthenticated && usage.generations >= FREE_LIMITS.generations;

  const toggleBlockComplete = (dayIdx: number, blockIdx: number) => {
    const allDone = plan![dayIdx]?.time_blocks[blockIdx]?.tasks.every(t => t.completed);
    setPlan(prev => prev!.map((d, di) =>
      di !== dayIdx ? d : {
        ...d,
        time_blocks: d.time_blocks.map((b, bi) =>
          bi !== blockIdx ? b : {
            ...b,
            tasks: b.tasks.map(t => ({ ...t, completed: !allDone })),
          }
        ),
      }
    ));
  };

  const toggleTaskComplete = (dayIdx: number, blockIdx: number, taskIdx: number) => {
    setPlan(prev =>
      prev!.map((d, di) =>
        di !== dayIdx ? d : {
          ...d,
          time_blocks: d.time_blocks.map((b, bi) =>
            bi !== blockIdx ? b : {
              ...b,
              tasks: b.tasks.map((t, ti) =>
                ti !== taskIdx ? t : { ...t, completed: !t.completed }
              ),
            }
          ),
        }
      )
    );
  };
  const { isAuthenticated, getToken } = useAuth();

  useEffect(() => { document.title = "Weekly Recap — OnTrack"; }, []);

  const [notes, setNotes] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [expandedTask, setExpandedTask] = useState<string | null>(null);

  const today = toDateStr(new Date());

  // Only show recap when plan exists and is entirely in the past
  const isPlanStale = !!plan && plan.length > 0 && plan.every(d => d.date < today);

  // Flatten all tasks from the plan
  const allTaskDetails = (plan ?? []).flatMap(day =>
    day.time_blocks.flatMap(block =>
      block.tasks.map(task => ({
        title: task.title,
        block: block.label,
        date: day.date,
        estimated_minutes: task.estimated_minutes,
        completed: !!task.completed,
      }))
    )
  );

  const completedCount = allTaskDetails.filter(t => t.completed).length;
  const totalCount = allTaskDetails.length;
  const completionPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  // Date range label
  const dates = (plan ?? []).map(d => d.date).sort();
  const rangeLabel = dates.length > 0
    ? `${new Date(dates[0] + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${new Date(dates[dates.length - 1] + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
    : "";

  // Group by day for the detailed list
  const dayGroups = (plan ?? []).map((day, dayIdx) => ({
    date: day.date,
    dayIdx,
    label: new Date(day.date + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" }),
    blocks: day.time_blocks.map((block, blockIdx) => ({
      label: block.label,
      blockIdx,
      tasks: block.tasks.map((t, taskIdx) => ({ title: t.title, description: t.description, estimated_minutes: t.estimated_minutes, completed: !!t.completed, taskIdx })),
    })),
  }));

  const generateNextWeek = async () => {
    if (goals.length === 0) return;
    setGenerating(true);
    setError("");
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (isAuthenticated) {
        const token = await getToken().catch(() => null);
        if (token) headers["Authorization"] = `Bearer ${token}`;
      }

      // Always generate for exactly next week (Mon–Sun)
      const now = new Date();
      const day = now.getDay(); // 0=Sun … 6=Sat
      const daysUntilMonday = ((8 - day) % 7) || 7;
      const nextMon = new Date(now);
      nextMon.setDate(now.getDate() + daysUntilMonday);
      nextMon.setHours(0, 0, 0, 0);
      const nextSun = new Date(nextMon);
      nextSun.setDate(nextMon.getDate() + 6);
      const weekStart = nextMon.toLocaleDateString("en-CA");
      const weekEnd = nextSun.toLocaleDateString("en-CA");

      // Override each goal's timeframe to next week only
      const goalsForNextWeek = goals.map(g => ({
        ...g,
        timeframe: { start_date: weekStart, end_date: weekEnd },
      }));

      const totalHours = goals.reduce((s, g) => s + g.hours_per_week, 0);

      const previous_week = {
        total_tasks: totalCount,
        completed_tasks: completedCount,
        task_details: allTaskDetails,
        notes: notes.trim(),
      };

      const res = await fetch(`${API_BASE}/api/generate`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          goals: goalsForNextWeek,
          availability: schedule,
          preferences: { hours_per_week: totalHours, sessions_per_day: 1 },
          previous_week,
        }),
      });

      if (res.status === 429) { const b = await res.json(); throw new Error(b.error === "generation_limit_reached" ? "You've used all your free generations." : "Too many requests."); }
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      incrementGenerations();
      const data = await res.json();
      const planWithIds: DayPlan[] = (data.weekly_tasks || []).map((day: DayPlan) => ({
        ...day,
        time_blocks: day.time_blocks.map(b => ({ ...b, id: crypto.randomUUID() })),
      }));
      setPlan(prev => {
        const newDates = new Set(planWithIds.map((d: DayPlan) => d.date));
        const oldDays = (prev ?? []).filter(d => !newDates.has(d.date));
        return [...oldDays, ...planWithIds].sort((a, b) => a.date.localeCompare(b.date));
      });
      showToast({ message: "Next week's plan is ready!", action: { label: "View calendar →", href: "/calendar" } });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to generate");
      setGenerating(false);
    }
  };

  if (!plan || plan.length === 0) {
    return (
      <div className="max-w-2xl pb-20">
        <h1 className="text-xl font-bold text-black mb-4">Weekly Recap</h1>
        <p className="text-black/40 text-sm">No plan to recap yet. Generate a plan first.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl pb-20">
      <div className="mb-8">
        <h1 className="text-xl font-bold text-black">Weekly Recap</h1>
        {rangeLabel && <p className="text-sm text-black/40 mt-0.5">{rangeLabel}</p>}
        {!isPlanStale && (
          <p className="text-xs text-amber-700 mt-2">Your week isn't over yet — you can still complete tasks before generating next week.</p>
        )}
      </div>

      {/* Completion summary */}
      <div className="rounded-2xl border border-black/8 bg-white shadow-sm p-5 mb-4 flex items-center gap-6">
        {/* Ring */}
        <div className="relative w-20 h-20 shrink-0">
          <svg viewBox="0 0 36 36" className="w-20 h-20 -rotate-90">
            <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e5e7eb" strokeWidth="3" />
            <circle
              cx="18" cy="18" r="15.9" fill="none"
              stroke={completionPct >= 80 ? "#22c55e" : completionPct >= 50 ? "#000000" : "#f59e0b"}
              strokeWidth="3"
              strokeDasharray={`${completionPct} ${100 - completionPct}`}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-lg font-bold text-black">{completionPct}%</span>
          </div>
        </div>
        <div>
          <p className="text-2xl font-bold text-black">{completedCount}<span className="text-black/40 text-lg font-normal">/{totalCount}</span></p>
          <p className="text-sm text-black/50">tasks completed</p>
          <p className="text-xs text-black/30 mt-1">
            {completionPct >= 80 ? "Great week — consider increasing intensity." :
             completionPct >= 50 ? "Solid effort. See what you can adjust." :
             "Tough week. Consider reducing volume next week."}
          </p>
        </div>
      </div>

      {/* Day-by-day breakdown */}
      <div className="flex flex-col gap-3 mb-6">
        {dayGroups.map(day => {
          const dayTotal = day.blocks.reduce((s, b) => s + b.tasks.length, 0);
          const dayDone = day.blocks.reduce((s, b) => s + b.tasks.filter(t => t.completed).length, 0);
          return (
            <div key={day.date} className="rounded-2xl border border-black/8 bg-white shadow-sm overflow-hidden">
              <div className="px-4 py-2.5 border-b border-black/6 flex items-center justify-between">
                <span className="text-sm font-medium text-black/60">{day.label}</span>
                <span className={`text-xs tabular-nums ${dayDone === dayTotal ? "text-emerald-600" : "text-black/30"}`}>
                  {dayDone}/{dayTotal}
                </span>
              </div>
              <div className="divide-y divide-black/5">
                {day.blocks.map((block, bi) => (
                  <div key={bi}>
                    <div className="px-4 pt-2.5 pb-1 flex items-center gap-2">
                      {(() => {
                        const allDone = block.tasks.length > 0 && block.tasks.every(t => t.completed);
                        const someDone = !allDone && block.tasks.some(t => t.completed);
                        return (
                          <button
                            onClick={() => toggleBlockComplete(day.dayIdx, block.blockIdx)}
                            className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-colors ${
                              allDone ? "bg-emerald-600 border-emerald-600" : someDone ? "border-black/25 bg-black/5" : "border-black/15 hover:border-black/40"
                            }`}
                          >
                            {allDone && (
                              <svg className="w-2 h-2 text-white" viewBox="0 0 10 8" fill="none">
                                <path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            )}
                            {someDone && <div className="w-1.5 h-0.5 bg-black/40 rounded-full" />}
                          </button>
                        );
                      })()}
                      <span className="text-xs font-semibold text-black/30 uppercase tracking-wide">{block.label}</span>
                    </div>
                    {block.tasks.map((task, ti) => {
                      const taskKey = `${day.date}-${bi}-${ti}`;
                      const isExpanded = expandedTask === taskKey;
                      return (
                        <div key={ti}>
                          <div className="px-4 py-2 flex items-center gap-3 hover:bg-black/[0.02] transition-colors">
                            <button
                              onClick={() => toggleTaskComplete(day.dayIdx, block.blockIdx, task.taskIdx)}
                              className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                                task.completed ? "bg-emerald-600 border-emerald-600" : "border-black/15 hover:border-black/40"
                              }`}
                            >
                              {task.completed && (
                                <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 10 8" fill="none">
                                  <path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              )}
                            </button>
                            <button
                              onClick={() => task.description && setExpandedTask(isExpanded ? null : taskKey)}
                              className={`flex-1 flex items-center gap-2 text-left ${task.description ? "cursor-pointer" : "cursor-default"}`}
                            >
                              <span className={`text-sm flex-1 ${task.completed ? "text-black/30 line-through" : "text-black/60"}`}>
                                {task.title}
                              </span>
                              <span className="text-xs text-black/20 tabular-nums shrink-0">{task.estimated_minutes}m</span>
                              {task.description && (
                                <svg className={`w-3.5 h-3.5 text-black/25 shrink-0 transition-transform ${isExpanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              )}
                            </button>
                          </div>
                          {isExpanded && task.description && (
                            <p className="px-4 pb-3 text-xs text-black/40 leading-relaxed pl-11">
                              {task.description}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Notes for the AI */}
      <div className="rounded-2xl border border-black/8 bg-white shadow-sm p-5 mb-4">
        <h2 className="text-sm font-semibold text-black mb-1">How did the week go?</h2>
        <p className="text-xs text-black/40 mb-3">Optional — this gets sent to the AI to shape next week's plan.</p>
        <textarea
          className="w-full px-3 py-2.5 border border-black/10 rounded-lg bg-[#F9F9F9] text-black text-sm focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-black/25 transition-colors placeholder:text-black/25 resize-none min-h-[90px]"
          placeholder="e.g. The sessions felt too long, I kept skipping gym days, guitar is going well…"
          value={notes}
          onChange={e => setNotes(e.target.value)}
        />
      </div>

      {error && <p className="text-sm text-red-500 mb-3">{error}</p>}

      {genLimitHit && (
        <p className="text-xs text-black/40 mb-2 text-center">You've used all {FREE_LIMITS.generations} free generations. Upgrade to continue.</p>
      )}
      <button
        onClick={generateNextWeek}
        disabled={generating || goals.length === 0 || genLimitHit}
        className="w-full py-3 bg-black hover:bg-black/80 rounded-full text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
      >
        {generating && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
        {generating ? "Generating next week…" : "Generate next week →"}
      </button>
    </div>
  );
}
