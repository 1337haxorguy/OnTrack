import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useApp, FREE_LIMITS } from "../context/AppContext";
import { useAuth } from "../context/AuthContext";
import type { DayPlan, TimeBlock } from "../context/AppContext";

const API_BASE = import.meta.env.VITE_API_BASE;

function toDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function calcEndTime(startTime: string, tasks: { estimated_minutes: number }[]): string {
  const totalMins = tasks.reduce((s, t) => s + t.estimated_minutes, 0);
  const [h, m] = startTime.split(":").map(Number);
  const endMins = h * 60 + m + totalMins;
  const endH = Math.floor(endMins / 60) % 24;
  const endM = endMins % 60;
  return `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;
}

function formatTime(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const period = h < 12 ? "AM" : "PM";
  const hour = h % 12 || 12;
  return m === 0 ? `${hour} ${period}` : `${hour}:${m.toString().padStart(2, "0")} ${period}`;
}

export default function Today() {
  const { goals, setGoals, schedule, plan, setPlan, usage, incrementGenerations, limitsEnabled } = useApp();
  const { isAuthenticated, getToken } = useAuth();
  const genLimitHit = limitsEnabled && isAuthenticated && usage.generations >= FREE_LIMITS.generations;

  useEffect(() => { document.title = "Today — OnTrack"; }, []);

  const [regenLoading, setRegenLoading]   = useState(false);
  const [regenError, setRegenError]       = useState("");
  const [feedback, setFeedback]           = useState("");
  const [showFeedback, setShowFeedback]   = useState(false);
  const [showTodayHint, setShowTodayHint] = useState(
    () => localStorage.getItem("ontrack_today_hint") !== "1"
  );
  // Per-block regen state
  const [blockFeedback, setBlockFeedback] = useState<Record<number, string>>({});
  const [blockRegen, setBlockRegen]       = useState<Record<number, boolean>>({});
  const [blockOpen, setBlockOpen]         = useState<Record<number, boolean>>({});
  const [blockError, setBlockError]       = useState<Record<number, string>>({});
  // Per-task state (key = `${bi}-${ti}`)
  const [taskOpen, setTaskOpen]           = useState<Record<string, "regen" | "edit" | null>>({});
  const [taskFeedback, setTaskFeedback]   = useState<Record<string, string>>({});
  const [taskRegen, setTaskRegen]         = useState<Record<string, boolean>>({});
  const [taskEdit, setTaskEdit]           = useState<Record<string, { title: string; description: string; estimated_minutes: number }>>({});
  const [taskError, setTaskError]         = useState<Record<string, string>>({});
  // Save-to-goal prompt
  const [pendingSave, setPendingSave]     = useState<{ feedback: string; goalId: string } | null>(null);

  const today       = toDateStr(new Date());
  const todayLabel  = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  const todayPlan = plan?.find(d => d.date === today) ?? null;
  const dayIdx    = plan?.findIndex(d => d.date === today) ?? -1;

  const authHeaders = async (): Promise<Record<string, string>> => {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (isAuthenticated) {
      const token = await getToken().catch(() => null);
      if (token) headers["Authorization"] = `Bearer ${token}`;
    }
    return headers;
  };

  const applyNewDay = (data: DayPlan) => {
    const newDay: DayPlan = {
      ...data,
      time_blocks: (data.time_blocks || []).map((b: TimeBlock) => ({
        ...b,
        id: crypto.randomUUID(),
      })),
    };
    if (dayIdx >= 0) {
      setPlan(prev => prev!.map((d, i) => (i === dayIdx ? newDay : d)));
    } else {
      setPlan(prev =>
        prev
          ? [...prev, newDay].sort((a, b) => a.date.localeCompare(b.date))
          : [newDay]
      );
    }
  };

  // Regenerate entire day
  const regenerateDay = async () => {
    setRegenLoading(true);
    setRegenError("");
    try {
      const res = await fetch(`${API_BASE}/api/generate/regenerate-day`, {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({
          date: today,
          current_day_plan: todayPlan,
          feedback,
          goals,
          availability: schedule,
        }),
      });
      if (res.status === 429) { const b = await res.json(); throw new Error(b.error === "generation_limit_reached" ? "You've used all your free generations." : "Too many requests."); }
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      applyNewDay(await res.json());
      incrementGenerations();
      setFeedback("");
      setShowFeedback(false);
    } catch (e: unknown) {
      setRegenError(e instanceof Error ? e.message : "Failed to regenerate");
    } finally {
      setRegenLoading(false);
    }
  };

  // Regenerate a single block by asking the AI to replace just that block
  const regenerateBlock = async (blockIdx: number, block: TimeBlock) => {
    setBlockRegen(prev => ({ ...prev, [blockIdx]: true }));
    const fb = blockFeedback[blockIdx] || "";

    const singleBlockDay: DayPlan = {
      date: today,
      objective: block.label,
      time_blocks: [{ ...block, start_time: null, end_time: null }],
    };

    try {
      const res = await fetch(`${API_BASE}/api/generate/regenerate-day`, {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({
          date: today,
          current_day_plan: singleBlockDay,
          feedback: fb || `Regenerate only the "${block.label}" block.`,
          goals,
          availability: schedule,
          preserve_times: true,
        }),
      });
      if (res.status === 429) { const b = await res.json(); throw new Error(b.error === "generation_limit_reached" ? "You've used all your free generations." : "Too many requests."); }
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const data: DayPlan | null = await res.json();
      if (!data) throw new Error("No response from server");
      incrementGenerations();
      const newBlock = data.time_blocks?.[0];
      if (newBlock && todayPlan) {
        const updatedDay: DayPlan = {
          ...todayPlan,
          time_blocks: todayPlan.time_blocks.map((b, i) => {
            if (i !== blockIdx) return b;
            // Keep original start_time, recalculate end_time from new tasks
            const endTime = b.start_time ? calcEndTime(b.start_time, newBlock.tasks) : b.end_time;
            return { ...b, tasks: newBlock.tasks, end_time: endTime, id: crypto.randomUUID() };
          }),
        };
        if (dayIdx >= 0) {
          setPlan(prev => prev!.map((d, i) => (i === dayIdx ? updatedDay : d)));
        }
      }
      setBlockFeedback(prev => ({ ...prev, [blockIdx]: "" }));
      setBlockOpen(prev => ({ ...prev, [blockIdx]: false }));
      setBlockError(prev => ({ ...prev, [blockIdx]: "" }));
      if (fb && goals.length > 0) setPendingSave({ feedback: fb, goalId: goals[0].id });
    } catch (e: unknown) {
      setBlockError(prev => ({ ...prev, [blockIdx]: e instanceof Error ? e.message : "Failed to regenerate block" }));
    } finally {
      setBlockRegen(prev => ({ ...prev, [blockIdx]: false }));
    }
  };

  // Regenerate a single task within a block
  const regenerateTask = async (bi: number, ti: number, block: TimeBlock) => {
    const key = `${bi}-${ti}`;
    setTaskRegen(prev => ({ ...prev, [key]: true }));
    const fb = taskFeedback[key] || "";
    const task = block.tasks[ti];

    const singleBlockDay: DayPlan = {
      date: today,
      objective: block.label,
      time_blocks: [{ ...block, tasks: [task], start_time: null, end_time: null }],
    };

    try {
      const res = await fetch(`${API_BASE}/api/generate/regenerate-day`, {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({
          date: today,
          current_day_plan: singleBlockDay,
          feedback: fb || `Regenerate only the "${task.title}" task in the "${block.label}" block. Return exactly 1 time block with exactly 1 task.`,
          goals,
          availability: schedule,
          preserve_times: true,
        }),
      });
      if (res.status === 429) { const b = await res.json(); throw new Error(b.error === "generation_limit_reached" ? "You've used all your free generations." : "Too many requests."); }
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const data: DayPlan | null = await res.json();
      if (!data) throw new Error("No response from server");
      incrementGenerations();
      const newTask = data.time_blocks?.[0]?.tasks?.[0];
      if (newTask && todayPlan) {
        const updatedDay: DayPlan = {
          ...todayPlan,
          time_blocks: todayPlan.time_blocks.map((b, i) => {
            if (i !== bi) return b;
            const updatedTasks = b.tasks.map((t, j) => (j === ti ? newTask : t));
            const endTime = b.start_time ? calcEndTime(b.start_time, updatedTasks) : b.end_time;
            return { ...b, tasks: updatedTasks, end_time: endTime };
          }),
        };
        if (dayIdx >= 0) {
          setPlan(prev => prev!.map((d, i) => (i === dayIdx ? updatedDay : d)));
        }
      }
      if (fb && goals.length > 0) setPendingSave({ feedback: fb, goalId: goals[0].id });
      setTaskFeedback(prev => ({ ...prev, [key]: "" }));
      setTaskOpen(prev => ({ ...prev, [key]: null }));
      setTaskError(prev => ({ ...prev, [key]: "" }));
    } catch (e: unknown) {
      setTaskError(prev => ({ ...prev, [key]: e instanceof Error ? e.message : "Failed to regenerate task" }));
    } finally {
      setTaskRegen(prev => ({ ...prev, [key]: false }));
    }
  };

  // Save inline task edits
  const saveTaskEdit = (bi: number, ti: number) => {
    const key = `${bi}-${ti}`;
    const edits = taskEdit[key];
    if (!edits || !todayPlan) return;
    const updatedDay: DayPlan = {
      ...todayPlan,
      time_blocks: todayPlan.time_blocks.map((b, i) =>
        i !== bi ? b : {
          ...b,
          tasks: b.tasks.map((t, j) =>
            j === ti ? { ...t, ...edits } : t
          ),
        }
      ),
    };
    if (dayIdx >= 0) {
      setPlan(prev => prev!.map((d, i) => (i === dayIdx ? updatedDay : d)));
    }
    setTaskOpen(prev => ({ ...prev, [key]: null }));
    setTaskEdit(prev => { const n = { ...prev }; delete n[key]; return n; });
  };

  const toggleTaskComplete = (bi: number, ti: number) => {
    if (dayIdx < 0 || !todayPlan) return;
    setPlan(prev => prev!.map((d, i) =>
      i !== dayIdx ? d : {
        ...d,
        time_blocks: d.time_blocks.map((b, blockI) =>
          blockI !== bi ? b : {
            ...b,
            tasks: b.tasks.map((t, taskI) =>
              taskI !== ti ? t : { ...t, completed: !t.completed }
            ),
          }
        ),
      }
    ));
  };

  const toggleBlockComplete = (bi: number) => {
    if (dayIdx < 0 || !todayPlan) return;
    const allDone = todayPlan.time_blocks[bi].tasks.every(t => t.completed);
    setPlan(prev => prev!.map((d, i) =>
      i !== dayIdx ? d : {
        ...d,
        time_blocks: d.time_blocks.map((b, blockI) =>
          blockI !== bi ? b : {
            ...b,
            tasks: b.tasks.map(t => ({ ...t, completed: !allDone })),
          }
        ),
      }
    ));
  };

  const saveFeedbackToGoal = () => {
    if (!pendingSave) return;
    setGoals(prev => prev.map(g =>
      g.id === pendingSave.goalId
        ? { ...g, restrictions: [...g.restrictions, pendingSave.feedback] }
        : g
    ));
    setPendingSave(null);
  };

  // ---- Empty states ----

  if (!plan) {
    const hasGoals = goals.length > 0;
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <div className="w-16 h-16 rounded-2xl bg-white border border-black/8 shadow-sm flex items-center justify-center mb-5">
          <svg className="w-8 h-8 text-black/25" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
          </svg>
        </div>
        {hasGoals ? (
          <>
            <h2 className="text-xl font-bold text-black mb-2">No plan generated yet</h2>
            <p className="text-black/40 mb-6 text-sm max-w-xs leading-relaxed">
              You have {goals.length} goal{goals.length !== 1 && "s"} set up. Head to Goals and hit <span className="text-black font-medium">Generate Plan</span> to get your week scheduled.
            </p>
            <Link
              to="/"
              className="px-5 py-2.5 bg-black text-white rounded-full text-sm font-medium hover:bg-black/80 transition-colors"
            >
              Generate my plan →
            </Link>
          </>
        ) : (
          <>
            <h2 className="text-xl font-bold text-black mb-2">No goals yet</h2>
            <p className="text-black/40 mb-6 text-sm max-w-xs leading-relaxed">
              Create your first goal and OnTrack will build a daily plan to get you there.
            </p>
            <Link
              to="/goals/new"
              className="px-5 py-2.5 bg-black text-white rounded-full text-sm font-medium hover:bg-black/80 transition-colors"
            >
              Create a goal →
            </Link>
          </>
        )}
      </div>
    );
  }

  // ---- Main render ----

  const totalMins = todayPlan
    ? todayPlan.time_blocks.reduce((s, b) => s + b.tasks.reduce((ts, t) => ts + t.estimated_minutes, 0), 0)
    : 0;

  return (
    <div className="max-w-2xl pb-20">

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-black">Today</h1>
          <p className="text-sm text-black/40 mt-0.5">{todayLabel}</p>
        </div>
        {todayPlan && (
          <button
            onClick={() => { setShowFeedback(v => !v); setRegenError(""); }}
            className={`flex items-center gap-2 px-3 py-2 text-sm border rounded-full transition-colors ${
              showFeedback
                ? "border-black/20 bg-black/[0.05] text-black"
                : "border-black/10 text-black/40 hover:border-black/20 hover:text-black bg-white"
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
            Regenerate day
          </button>
        )}
      </div>

      {/* First-visit orientation hint */}
      {showTodayHint && todayPlan && (
        <div className="mb-5 rounded-xl border border-black/8 bg-white shadow-sm px-4 py-3.5 flex items-start gap-3">
          <div className="w-5 h-5 rounded-full bg-black/5 border border-black/10 flex items-center justify-center shrink-0 mt-0.5">
            <svg className="w-2.5 h-2.5 text-black/40" fill="none" viewBox="0 0 12 12" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 1v4m0 2v.5" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-black/60 mb-1.5">How Today works</p>
            <ul className="text-xs text-black/40 leading-relaxed space-y-1">
              <li>· Tap a task title to <span className="text-black/60">edit or regenerate it</span></li>
              <li>· Tap the circle to <span className="text-black/60">mark a task complete</span></li>
              <li>· Use <span className="text-black/60">Regenerate day</span> (top right) to redo the whole day with feedback</li>
            </ul>
          </div>
          <button
            onClick={() => { localStorage.setItem("ontrack_today_hint", "1"); setShowTodayHint(false); }}
            className="text-black/20 hover:text-black/50 transition-colors shrink-0 p-1 -mr-1 -mt-1"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="currentColor">
              <path d="M3.22 3.22a.75.75 0 0 1 1.06 0L7 5.94l2.72-2.72a.75.75 0 1 1 1.06 1.06L8.06 7l2.72 2.72a.75.75 0 1 1-1.06 1.06L7 8.06l-2.72 2.72a.75.75 0 0 1-1.06-1.06L5.94 7 3.22 4.28a.75.75 0 0 1 0-1.06z" />
            </svg>
          </button>
        </div>
      )}

      {/* Save-to-goal banner */}
      {pendingSave && (
        <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 flex flex-col gap-3">
          <div>
            <p className="text-xs font-semibold text-amber-800 mb-1">Save this preference to a goal?</p>
            <p className="text-xs text-amber-700/60 italic">"{pendingSave.feedback}"</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {goals.length > 1 && (
              <select
                className="px-2.5 py-1.5 border border-black/10 rounded-lg bg-white text-black text-xs focus:outline-none cursor-pointer"
                value={pendingSave.goalId}
                onChange={e => setPendingSave(prev => prev ? { ...prev, goalId: e.target.value } : null)}
              >
                {goals.map(g => <option key={g.id} value={g.id}>{g.title}</option>)}
              </select>
            )}
            {goals.length === 1 && (
              <span className="text-xs text-black/40">→ <span className="text-black">{goals[0].title}</span></span>
            )}
            <button
              onClick={saveFeedbackToGoal}
              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 rounded-full text-xs text-white font-medium transition-colors"
            >
              Save to goal
            </button>
            <button
              onClick={() => setPendingSave(null)}
              className="px-3 py-1.5 text-xs text-black/40 hover:text-black transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Day-level regenerate panel */}
      {showFeedback && (
        <div className="mb-5 rounded-2xl border border-black/8 bg-white shadow-sm p-4 flex flex-col gap-3">
          <p className="text-xs font-medium text-black/50">What would you like today's plan to look like?</p>
          <textarea
            className="w-full px-3 py-2.5 border border-black/10 rounded-lg bg-[#F9F9F9] text-black text-sm focus:outline-none focus:ring-1 focus:ring-black/15 transition-colors placeholder:text-black/25 resize-none min-h-[80px]"
            placeholder="e.g. Make it shorter, focus on theory, less warm-up today…"
            value={feedback}
            onChange={e => setFeedback(e.target.value)}
          />
          {regenError && <p className="text-xs text-red-500">{regenError}</p>}
          <div className="flex gap-2">
            <button
              onClick={regenerateDay}
              disabled={regenLoading || genLimitHit}
              title={genLimitHit ? "You've used all your free generations." : undefined}
              className="flex items-center gap-2 px-4 py-2 bg-black hover:bg-black/80 rounded-full text-sm text-white font-medium disabled:opacity-50 transition-colors"
            >
              {regenLoading && <span className="w-3.5 h-3.5 border border-white/40 border-t-white rounded-full animate-spin" />}
              {regenLoading ? "Regenerating…" : "Regenerate"}
            </button>
            <button
              onClick={() => { setShowFeedback(false); setFeedback(""); setRegenError(""); }}
              className="px-4 py-2 text-sm text-black/40 hover:text-black transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Nothing today */}
      {!todayPlan && (() => {
        const nextDay = plan?.find(d => d.date > today) ?? null;
        const nextLabel = nextDay
          ? new Date(nextDay.date + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })
          : null;
        return (
          <div className="flex flex-col items-center py-24 text-center">
            <div className="w-14 h-14 rounded-2xl bg-white border border-black/8 shadow-sm flex items-center justify-center mb-5">
              <svg className="w-7 h-7 text-black/25" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-base font-semibold text-black mb-1">Free day</h2>
            {nextLabel ? (
              <p className="text-sm text-black/40 mb-6 max-w-xs">
                Nothing scheduled today. Next session is on <span className="text-black/70">{nextLabel}</span>.
              </p>
            ) : (
              <p className="text-sm text-black/40 mb-6 max-w-xs">
                Nothing else scheduled this week. Generate a new plan when you're ready.
              </p>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => setShowFeedback(true)}
                className="px-4 py-2 border border-black/10 rounded-full text-black/40 text-sm hover:border-black/20 hover:text-black bg-white transition-colors"
              >
                Add tasks for today
              </button>
              {!nextLabel && (
                <Link to="/" className="px-4 py-2 bg-black rounded-full text-white text-sm hover:bg-black/80 transition-colors font-medium">
                  Generate next week →
                </Link>
              )}
            </div>
          </div>
        );
      })()}

      {/* Today's plan */}
      {todayPlan && (
        <div className="flex flex-col gap-4">

          {/* Focus summary */}
          <div className="px-4 py-3 rounded-2xl border border-black/8 bg-white shadow-sm flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-black/5 border border-black/8 flex items-center justify-center shrink-0 mt-0.5">
              <svg className="w-4 h-4 text-black/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
              </svg>
            </div>
            <div>
              <p className="text-xs text-black/30 font-medium mb-0.5">Today's focus</p>
              <p className="text-sm text-black/60 leading-relaxed">{todayPlan.objective}</p>
            </div>
          </div>

          {/* Time blocks */}
          {todayPlan.time_blocks.map((block, bi) => {
            const blockAllDone = block.tasks.length > 0 && block.tasks.every(t => t.completed);
            const blockSomeDone = !blockAllDone && block.tasks.some(t => t.completed);
            return (
            <div key={block.id ?? bi} className="rounded-2xl border border-black/8 bg-white shadow-sm overflow-hidden">

              {/* Block header */}
              <div className="px-4 py-3 border-b border-black/6 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <button
                    onClick={() => toggleBlockComplete(bi)}
                    className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                      blockAllDone ? "bg-emerald-600 border-emerald-600" : blockSomeDone ? "border-black/30 bg-black/5" : "border-black/20 hover:border-black/40"
                    }`}
                  >
                    {blockAllDone && (
                      <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 10 8" fill="none">
                        <path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                    {blockSomeDone && <div className="w-1.5 h-0.5 bg-black/40 rounded-full" />}
                  </button>
                  <span className={`text-sm font-semibold truncate ${blockAllDone ? "text-black/30 line-through" : "text-black"}`}>{block.label}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {block.start_time && block.end_time && (
                    <span className="text-xs text-black/30 tabular-nums">
                      {formatTime(block.start_time)} – {formatTime(block.end_time)}
                    </span>
                  )}
                  <button
                    onClick={() => setBlockOpen(prev => ({ ...prev, [bi]: !prev[bi] }))}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                      blockOpen[bi]
                        ? "border-black/20 bg-black/[0.05] text-black"
                        : "border-black/10 text-black/40 hover:border-black/20 hover:text-black"
                    }`}
                  >
                    Regenerate
                  </button>
                </div>
              </div>

              {/* Per-block regen panel */}
              {blockOpen[bi] && (
                <div className="px-4 py-3 border-b border-black/6 bg-black/[0.02] flex flex-col gap-2">
                  <p className="text-xs text-black/50">What should this block look like instead?</p>
                  <textarea
                    className="w-full px-3 py-2 border border-black/10 rounded-lg bg-white text-black text-sm focus:outline-none focus:ring-1 focus:ring-black/15 transition-colors placeholder:text-black/25 resize-none min-h-[64px]"
                    placeholder="e.g. More practical exercises, shorter duration, skip warm-up…"
                    value={blockFeedback[bi] || ""}
                    onChange={e => setBlockFeedback(prev => ({ ...prev, [bi]: e.target.value }))}
                  />
                  {blockError[bi] && <p className="text-xs text-red-500">{blockError[bi]}</p>}
                  <div className="flex gap-2">
                    <button
                      onClick={() => regenerateBlock(bi, block)}
                      disabled={blockRegen[bi] || genLimitHit}
                      title={genLimitHit ? "You've used all your free generations." : undefined}
                      className="flex items-center gap-2 px-3 py-1.5 bg-black hover:bg-black/80 rounded-full text-xs text-white font-medium disabled:opacity-50 transition-colors"
                    >
                      {blockRegen[bi] && <span className="w-3 h-3 border border-white/40 border-t-white rounded-full animate-spin" />}
                      {blockRegen[bi] ? "Regenerating…" : "Regenerate block"}
                    </button>
                    <button
                      onClick={() => setBlockOpen(prev => ({ ...prev, [bi]: false }))}
                      className="px-3 py-1.5 text-xs text-black/40 hover:text-black transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Tasks */}
              <div className="divide-y divide-black/5">
                {block.tasks.map((task, ti) => {
                  const key = `${bi}-${ti}`;
                  const mode = taskOpen[key] ?? null;
                  const isEditing = mode === "edit";
                  const isRegening = mode === "regen";
                  const editVals = taskEdit[key] ?? { title: task.title, description: task.description, estimated_minutes: task.estimated_minutes };

                  return (
                    <div key={ti} className="group">
                      {/* Task row */}
                      {!isEditing && (
                        <div className="px-4 py-3.5 flex gap-3 items-start">
                          <button
                            onClick={() => toggleTaskComplete(bi, ti)}
                            className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                              task.completed ? "bg-emerald-600 border-emerald-600" : "border-black/20 hover:border-black/40"
                            }`}
                          >
                            {task.completed && (
                              <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 10 8" fill="none">
                                <path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            )}
                          </button>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium mb-1 ${task.completed ? "text-black/30 line-through" : "text-black"}`}>{task.title}</p>
                            <p className={`text-xs leading-relaxed ${task.completed ? "text-black/25 line-through" : "text-black/40"}`}>{task.description}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 mt-0.5">
                            <span className="text-xs text-black/25 tabular-nums whitespace-nowrap">{task.estimated_minutes}m</span>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => {
                                  setTaskEdit(prev => ({ ...prev, [key]: { title: task.title, description: task.description, estimated_minutes: task.estimated_minutes } }));
                                  setTaskOpen(prev => ({ ...prev, [key]: "edit" }));
                                }}
                                className="px-2 py-1 text-xs border border-black/10 text-black/40 hover:text-black hover:border-black/20 rounded-full transition-colors"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => setTaskOpen(prev => ({ ...prev, [key]: isRegening ? null : "regen" }))}
                                className={`px-2 py-1 text-xs border rounded-full transition-colors ${
                                  isRegening
                                    ? "border-black/20 bg-black/[0.05] text-black"
                                    : "border-black/10 text-black/40 hover:text-black hover:border-black/20"
                                }`}
                              >
                                Regen
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Inline edit mode */}
                      {isEditing && (
                        <div className="px-4 py-3 flex flex-col gap-2 bg-black/[0.02] border-b border-black/6">
                          <input
                            className="w-full px-2.5 py-1.5 border border-black/10 rounded-lg bg-white text-sm text-black focus:outline-none focus:ring-1 focus:ring-black/15 placeholder:text-black/25"
                            value={editVals.title}
                            onChange={e => setTaskEdit(prev => ({ ...prev, [key]: { ...editVals, title: e.target.value } }))}
                            placeholder="Task title"
                          />
                          <textarea
                            className="w-full px-2.5 py-1.5 border border-black/10 rounded-lg bg-white text-xs text-black/60 focus:outline-none focus:ring-1 focus:ring-black/15 resize-none min-h-[60px] placeholder:text-black/25"
                            value={editVals.description}
                            onChange={e => setTaskEdit(prev => ({ ...prev, [key]: { ...editVals, description: e.target.value } }))}
                            placeholder="Description"
                          />
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min={1}
                              className="w-20 px-2.5 py-1.5 border border-black/10 rounded-lg bg-white text-sm text-black focus:outline-none focus:ring-1 focus:ring-black/15"
                              value={editVals.estimated_minutes}
                              onChange={e => setTaskEdit(prev => ({ ...prev, [key]: { ...editVals, estimated_minutes: parseInt(e.target.value) || 0 } }))}
                            />
                            <span className="text-xs text-black/40">minutes</span>
                            <div className="flex gap-2 ml-auto">
                              <button
                                onClick={() => saveTaskEdit(bi, ti)}
                                className="px-3 py-1.5 bg-black hover:bg-black/80 rounded-full text-xs text-white font-medium transition-colors"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => { setTaskOpen(prev => ({ ...prev, [key]: null })); setTaskEdit(prev => { const n = { ...prev }; delete n[key]; return n; }); }}
                                className="px-3 py-1.5 text-xs text-black/40 hover:text-black transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Per-task regen panel */}
                      {isRegening && (
                        <div className="px-4 py-3 border-t border-black/6 bg-black/[0.02] flex flex-col gap-2">
                          <p className="text-xs text-black/50">What should this task look like instead?</p>
                          <textarea
                            className="w-full px-3 py-2 border border-black/10 rounded-lg bg-white text-black text-sm focus:outline-none focus:ring-1 focus:ring-black/15 transition-colors placeholder:text-black/25 resize-none min-h-[56px]"
                            placeholder="e.g. Make it easier, focus on X instead, less time…"
                            value={taskFeedback[key] || ""}
                            onChange={e => setTaskFeedback(prev => ({ ...prev, [key]: e.target.value }))}
                          />
                          {taskError[key] && <p className="text-xs text-red-500">{taskError[key]}</p>}
                          <div className="flex gap-2">
                            <button
                              onClick={() => regenerateTask(bi, ti, block)}
                              disabled={taskRegen[key] || genLimitHit}
                              title={genLimitHit ? "You've used all your free generations." : undefined}
                              className="flex items-center gap-2 px-3 py-1.5 bg-black hover:bg-black/80 rounded-full text-xs text-white font-medium disabled:opacity-50 transition-colors"
                            >
                              {taskRegen[key] && <span className="w-3 h-3 border border-white/40 border-t-white rounded-full animate-spin" />}
                              {taskRegen[key] ? "Regenerating…" : "Regenerate task"}
                            </button>
                            <button
                              onClick={() => setTaskOpen(prev => ({ ...prev, [key]: null }))}
                              className="px-3 py-1.5 text-xs text-black/40 hover:text-black transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Block total */}
              <div className="px-4 py-2 border-t border-black/5 bg-black/[0.02] flex justify-end">
                <span className="text-xs text-black/25">
                  {block.tasks.reduce((s, t) => s + t.estimated_minutes, 0)} min total
                </span>
              </div>
            </div>
            );
          })}

          {/* Day total */}
          <div className="flex justify-end pt-1">
            <span className="text-xs text-black/25 tabular-nums">
              {totalMins} min scheduled today
            </span>
          </div>

        </div>
      )}
    </div>
  );
}
