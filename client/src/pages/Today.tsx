import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { useAuth0 } from "@auth0/auth0-react";
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
  const { goals, setGoals, schedule, plan, setPlan } = useApp();
  const { isAuthenticated, getAccessTokenSilently } = useAuth0();

  useEffect(() => { document.title = "Today — OnTrack"; }, []);

  const [regenLoading, setRegenLoading]   = useState(false);
  const [regenError, setRegenError]       = useState("");
  const [feedback, setFeedback]           = useState("");
  const [showFeedback, setShowFeedback]   = useState(false);
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
      const token = await getAccessTokenSilently().catch(() => null);
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
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      applyNewDay(await res.json());
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
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const data: DayPlan | null = await res.json();
      if (!data) throw new Error("No response from server");
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
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const data: DayPlan | null = await res.json();
      if (!data) throw new Error("No response from server");
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
        <div className="w-16 h-16 rounded-2xl bg-indigo-600/20 border border-indigo-600/30 flex items-center justify-center mb-5">
          <svg className="w-8 h-8 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
          </svg>
        </div>
        {hasGoals ? (
          <>
            <h2 className="text-xl font-bold mb-2">No plan generated yet</h2>
            <p className="text-gray-400 mb-6 text-sm max-w-xs leading-relaxed">
              You have {goals.length} goal{goals.length !== 1 && "s"} set up. Head to Goals and hit <span className="text-white font-medium">Generate Plan</span> to get your week scheduled.
            </p>
            <Link
              to="/"
              className="px-5 py-2.5 bg-indigo-600 rounded-lg text-white text-sm hover:bg-indigo-700 transition-colors"
            >
              Generate my plan →
            </Link>
          </>
        ) : (
          <>
            <h2 className="text-xl font-bold mb-2">No goals yet</h2>
            <p className="text-gray-400 mb-6 text-sm max-w-xs leading-relaxed">
              Create your first goal and OnTrack will build a daily plan to get you there.
            </p>
            <Link
              to="/goals/new"
              className="px-5 py-2.5 bg-indigo-600 rounded-lg text-white text-sm hover:bg-indigo-700 transition-colors"
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
          <h1 className="text-2xl font-bold text-white">Today</h1>
          <p className="text-sm text-gray-500 mt-0.5">{todayLabel}</p>
        </div>
        {todayPlan && (
          <button
            onClick={() => { setShowFeedback(v => !v); setRegenError(""); }}
            className={`flex items-center gap-2 px-3 py-2 text-sm border rounded-lg transition-colors ${
              showFeedback
                ? "border-indigo-600/60 bg-indigo-600/10 text-indigo-400"
                : "border-gray-700 text-gray-400 hover:border-gray-500 hover:text-white"
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
            Regenerate day
          </button>
        )}
      </div>

      {/* Save-to-goal banner */}
      {pendingSave && (
        <div className="mb-5 rounded-xl border border-amber-700/40 bg-amber-950/30 p-4 flex flex-col gap-3">
          <div>
            <p className="text-xs font-semibold text-amber-300 mb-1">Save this preference to a goal?</p>
            <p className="text-xs text-amber-200/60 italic">"{pendingSave.feedback}"</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {goals.length > 1 && (
              <select
                className="px-2.5 py-1.5 border border-gray-700 rounded-lg bg-gray-900 text-white text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/40 cursor-pointer"
                value={pendingSave.goalId}
                onChange={e => setPendingSave(prev => prev ? { ...prev, goalId: e.target.value } : null)}
              >
                {goals.map(g => <option key={g.id} value={g.id}>{g.title}</option>)}
              </select>
            )}
            {goals.length === 1 && (
              <span className="text-xs text-gray-400">→ <span className="text-white">{goals[0].title}</span></span>
            )}
            <button
              onClick={saveFeedbackToGoal}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 rounded-lg text-xs text-white font-medium transition-colors"
            >
              Save to goal
            </button>
            <button
              onClick={() => setPendingSave(null)}
              className="px-3 py-1.5 text-xs text-gray-500 hover:text-white transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Day-level regenerate panel */}
      {showFeedback && (
        <div className="mb-5 rounded-xl border border-indigo-800/50 bg-indigo-950/40 p-4 flex flex-col gap-3">
          <p className="text-xs font-medium text-indigo-300">What would you like today's plan to look like?</p>
          <textarea
            className="w-full px-3 py-2.5 border border-gray-700 rounded-lg bg-gray-900 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition-colors placeholder:text-gray-600 resize-none min-h-[80px]"
            placeholder="e.g. Make it shorter, focus on theory, less warm-up today…"
            value={feedback}
            onChange={e => setFeedback(e.target.value)}
          />
          {regenError && <p className="text-xs text-red-400">{regenError}</p>}
          <div className="flex gap-2">
            <button
              onClick={regenerateDay}
              disabled={regenLoading}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-sm text-white font-medium disabled:opacity-50 transition-colors"
            >
              {regenLoading && <span className="w-3.5 h-3.5 border border-white/40 border-t-white rounded-full animate-spin" />}
              {regenLoading ? "Regenerating…" : "Regenerate"}
            </button>
            <button
              onClick={() => { setShowFeedback(false); setFeedback(""); setRegenError(""); }}
              className="px-4 py-2 text-sm text-gray-500 hover:text-white transition-colors"
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
            <div className="w-14 h-14 rounded-2xl bg-gray-800 border border-gray-700 flex items-center justify-center mb-5">
              <svg className="w-7 h-7 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-base font-semibold text-white mb-1">Free day</h2>
            {nextLabel ? (
              <p className="text-sm text-gray-500 mb-6 max-w-xs">
                Nothing scheduled today. Next session is on <span className="text-gray-300">{nextLabel}</span>.
              </p>
            ) : (
              <p className="text-sm text-gray-500 mb-6 max-w-xs">
                Nothing else scheduled this week. Generate a new plan when you're ready.
              </p>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => setShowFeedback(true)}
                className="px-4 py-2 border border-gray-700 rounded-lg text-gray-400 text-sm hover:border-gray-500 hover:text-gray-200 transition-colors"
              >
                Add tasks for today
              </button>
              {!nextLabel && (
                <Link to="/" className="px-4 py-2 bg-indigo-600 rounded-lg text-white text-sm hover:bg-indigo-700 transition-colors">
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
          <div className="px-4 py-3 rounded-xl border border-gray-800 bg-gray-900/40 flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-600/20 flex items-center justify-center shrink-0 mt-0.5">
              <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
              </svg>
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium mb-0.5">Today's focus</p>
              <p className="text-sm text-gray-300 leading-relaxed">{todayPlan.objective}</p>
            </div>
          </div>

          {/* Time blocks */}
          {todayPlan.time_blocks.map((block, bi) => {
            const blockAllDone = block.tasks.length > 0 && block.tasks.every(t => t.completed);
            const blockSomeDone = !blockAllDone && block.tasks.some(t => t.completed);
            return (
            <div key={block.id ?? bi} className="rounded-xl border border-gray-800 bg-gray-900/40 overflow-hidden">

              {/* Block header */}
              <div className="px-4 py-3 border-b border-gray-800/60 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <button
                    onClick={() => toggleBlockComplete(bi)}
                    className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                      blockAllDone ? "bg-emerald-600 border-emerald-600" : blockSomeDone ? "border-indigo-500 bg-indigo-900/40" : "border-gray-600 hover:border-gray-400"
                    }`}
                  >
                    {blockAllDone && (
                      <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 10 8" fill="none">
                        <path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                    {blockSomeDone && <div className="w-1.5 h-0.5 bg-indigo-400 rounded-full" />}
                  </button>
                  <span className={`text-sm font-semibold truncate ${blockAllDone ? "text-gray-500 line-through" : "text-white"}`}>{block.label}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {block.start_time && block.end_time && (
                    <span className="text-xs text-gray-500 tabular-nums">
                      {formatTime(block.start_time)} – {formatTime(block.end_time)}
                    </span>
                  )}
                  <button
                    onClick={() => setBlockOpen(prev => ({ ...prev, [bi]: !prev[bi] }))}
                    className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                      blockOpen[bi]
                        ? "border-indigo-600/50 bg-indigo-600/10 text-indigo-400"
                        : "border-gray-700 text-gray-500 hover:border-gray-600 hover:text-gray-300"
                    }`}
                  >
                    Regenerate
                  </button>
                </div>
              </div>

              {/* Per-block regen panel */}
              {blockOpen[bi] && (
                <div className="px-4 py-3 border-b border-indigo-900/40 bg-indigo-950/30 flex flex-col gap-2">
                  <p className="text-xs text-indigo-300">What should this block look like instead?</p>
                  <textarea
                    className="w-full px-3 py-2 border border-gray-700 rounded-lg bg-gray-900 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-colors placeholder:text-gray-600 resize-none min-h-[64px]"
                    placeholder="e.g. More practical exercises, shorter duration, skip warm-up…"
                    value={blockFeedback[bi] || ""}
                    onChange={e => setBlockFeedback(prev => ({ ...prev, [bi]: e.target.value }))}
                  />
                  {blockError[bi] && <p className="text-xs text-red-400">{blockError[bi]}</p>}
                  <div className="flex gap-2">
                    <button
                      onClick={() => regenerateBlock(bi, block)}
                      disabled={blockRegen[bi]}
                      className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-xs text-white font-medium disabled:opacity-50 transition-colors"
                    >
                      {blockRegen[bi] && <span className="w-3 h-3 border border-white/40 border-t-white rounded-full animate-spin" />}
                      {blockRegen[bi] ? "Regenerating…" : "Regenerate block"}
                    </button>
                    <button
                      onClick={() => setBlockOpen(prev => ({ ...prev, [bi]: false }))}
                      className="px-3 py-1.5 text-xs text-gray-500 hover:text-white transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Tasks */}
              <div className="divide-y divide-gray-800/60">
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
                              task.completed ? "bg-emerald-600 border-emerald-600" : "border-gray-600 hover:border-gray-400"
                            }`}
                          >
                            {task.completed && (
                              <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 10 8" fill="none">
                                <path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            )}
                          </button>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium mb-1 ${task.completed ? "text-gray-500 line-through" : "text-gray-200"}`}>{task.title}</p>
                            <p className={`text-xs leading-relaxed ${task.completed ? "text-gray-600 line-through" : "text-gray-500"}`}>{task.description}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 mt-0.5">
                            <span className="text-xs text-gray-600 tabular-nums whitespace-nowrap">{task.estimated_minutes}m</span>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => {
                                  setTaskEdit(prev => ({ ...prev, [key]: { title: task.title, description: task.description, estimated_minutes: task.estimated_minutes } }));
                                  setTaskOpen(prev => ({ ...prev, [key]: "edit" }));
                                }}
                                className="px-2 py-1 text-xs border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 rounded-md transition-colors"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => setTaskOpen(prev => ({ ...prev, [key]: isRegening ? null : "regen" }))}
                                className={`px-2 py-1 text-xs border rounded-md transition-colors ${
                                  isRegening
                                    ? "border-indigo-600/50 bg-indigo-600/10 text-indigo-400"
                                    : "border-gray-700 text-gray-400 hover:text-white hover:border-gray-500"
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
                        <div className="px-4 py-3 flex flex-col gap-2 bg-gray-900/60">
                          <input
                            className="w-full px-2.5 py-1.5 border border-gray-700 rounded-lg bg-gray-900 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500"
                            value={editVals.title}
                            onChange={e => setTaskEdit(prev => ({ ...prev, [key]: { ...editVals, title: e.target.value } }))}
                            placeholder="Task title"
                          />
                          <textarea
                            className="w-full px-2.5 py-1.5 border border-gray-700 rounded-lg bg-gray-900 text-xs text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 resize-none min-h-[60px] placeholder:text-gray-600"
                            value={editVals.description}
                            onChange={e => setTaskEdit(prev => ({ ...prev, [key]: { ...editVals, description: e.target.value } }))}
                            placeholder="Description"
                          />
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min={1}
                              className="w-20 px-2.5 py-1.5 border border-gray-700 rounded-lg bg-gray-900 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500"
                              value={editVals.estimated_minutes}
                              onChange={e => setTaskEdit(prev => ({ ...prev, [key]: { ...editVals, estimated_minutes: parseInt(e.target.value) || 0 } }))}
                            />
                            <span className="text-xs text-gray-500">minutes</span>
                            <div className="flex gap-2 ml-auto">
                              <button
                                onClick={() => saveTaskEdit(bi, ti)}
                                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-xs text-white font-medium transition-colors"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => { setTaskOpen(prev => ({ ...prev, [key]: null })); setTaskEdit(prev => { const n = { ...prev }; delete n[key]; return n; }); }}
                                className="px-3 py-1.5 text-xs text-gray-500 hover:text-white transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Per-task regen panel */}
                      {isRegening && (
                        <div className="px-4 py-3 border-t border-indigo-900/30 bg-indigo-950/20 flex flex-col gap-2">
                          <p className="text-xs text-indigo-300">What should this task look like instead?</p>
                          <textarea
                            className="w-full px-3 py-2 border border-gray-700 rounded-lg bg-gray-900 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-colors placeholder:text-gray-600 resize-none min-h-[56px]"
                            placeholder="e.g. Make it easier, focus on X instead, less time…"
                            value={taskFeedback[key] || ""}
                            onChange={e => setTaskFeedback(prev => ({ ...prev, [key]: e.target.value }))}
                          />
                          {taskError[key] && <p className="text-xs text-red-400">{taskError[key]}</p>}
                          <div className="flex gap-2">
                            <button
                              onClick={() => regenerateTask(bi, ti, block)}
                              disabled={taskRegen[key]}
                              className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-xs text-white font-medium disabled:opacity-50 transition-colors"
                            >
                              {taskRegen[key] && <span className="w-3 h-3 border border-white/40 border-t-white rounded-full animate-spin" />}
                              {taskRegen[key] ? "Regenerating…" : "Regenerate task"}
                            </button>
                            <button
                              onClick={() => setTaskOpen(prev => ({ ...prev, [key]: null }))}
                              className="px-3 py-1.5 text-xs text-gray-500 hover:text-white transition-colors"
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
              <div className="px-4 py-2 border-t border-gray-800/40 bg-gray-900/40 flex justify-end">
                <span className="text-xs text-gray-600">
                  {block.tasks.reduce((s, t) => s + t.estimated_minutes, 0)} min total
                </span>
              </div>
            </div>
            );
          })}

          {/* Day total */}
          <div className="flex justify-end pt-1">
            <span className="text-xs text-gray-600 tabular-nums">
              {totalMins} min scheduled today
            </span>
          </div>

        </div>
      )}
    </div>
  );
}
