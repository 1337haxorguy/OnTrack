import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useApp, FREE_LIMITS } from "../context/AppContext";
import { useAuth } from "../context/AuthContext";
import type { DayPlan, TimeBlock, Goal } from "../context/AppContext";

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
  const period = h < 12 ? "am" : "pm";
  const hour = h % 12 || 12;
  return m === 0 ? `${hour} ${period}` : `${hour}:${m.toString().padStart(2, "0")} ${period}`;
}

function calcDurationMins(block: TimeBlock): number {
  if (block.start_time && block.end_time) {
    const [sh, sm] = block.start_time.split(":").map(Number);
    const [eh, em] = block.end_time.split(":").map(Number);
    return (eh * 60 + em) - (sh * 60 + sm);
  }
  return block.tasks.reduce((s, t) => s + t.estimated_minutes, 0);
}

function attributeBlock(block: TimeBlock, goals: Goal[]): string | null {
  if (!goals.length) return null;
  if (goals.length === 1) return goals[0].title.toLowerCase();
  const blockWords = block.label.toLowerCase().split(/\s+/);
  let best: Goal | null = null;
  let bestScore = 0;
  for (const goal of goals) {
    const goalWords = goal.title.toLowerCase().split(/\s+/);
    const score = blockWords.filter(w =>
      goalWords.some(gw => gw.includes(w) || w.includes(gw))
    ).length;
    if (score > bestScore) { bestScore = score; best = goal; }
  }
  return bestScore > 0 && best ? best.title.toLowerCase() : null;
}

export default function Today() {
  const { goals, setGoals, schedule, plan, setPlan, usage, incrementGenerations, limitsEnabled, unlimited } = useApp();
  const { isAuthenticated, getToken } = useAuth();
  const genLimitHit = limitsEnabled && isAuthenticated && !unlimited && usage.generations >= FREE_LIMITS.generations;

  useEffect(() => { document.title = "Today — OnTrack"; }, []);

  const now = new Date();
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const dayOfWeek = now.toLocaleDateString("en-US", { weekday: "long" }).toLowerCase();
  const monthDay = now.toLocaleDateString("en-US", { month: "long", day: "numeric" }).toLowerCase();
  const currentTimeStr = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }).toLowerCase();
  const timelineProgress = Math.min(94, Math.max(5, ((nowMins - 6 * 60) / (17 * 60)) * 100));

  const [regenLoading, setRegenLoading]   = useState(false);
  const [regenError, setRegenError]       = useState("");
  const [feedback, setFeedback]           = useState("");
  const [showFeedback, setShowFeedback]   = useState(false);
  const [blockFeedback, setBlockFeedback] = useState<Record<number, string>>({});
  const [blockRegen, setBlockRegen]       = useState<Record<number, boolean>>({});
  const [blockOpen, setBlockOpen]         = useState<Record<number, boolean>>({});
  const [blockError, setBlockError]       = useState<Record<number, string>>({});
  const [expandedBlocks, setExpandedBlocks] = useState<Record<number, boolean>>({});
  const [taskOpen, setTaskOpen]           = useState<Record<string, "regen" | "edit" | null>>({});
  const [taskFeedback, setTaskFeedback]   = useState<Record<string, string>>({});
  const [taskRegen, setTaskRegen]         = useState<Record<string, boolean>>({});
  const [taskEdit, setTaskEdit]           = useState<Record<string, { title: string; description: string; estimated_minutes: number }>>({});
  const [taskError, setTaskError]         = useState<Record<string, string>>({});
  const [pendingSave, setPendingSave]     = useState<{ feedback: string; goalId: string } | null>(null);

  const today      = toDateStr(new Date());
  const todayPlan  = plan?.find(d => d.date === today) ?? null;
  const dayIdx     = plan?.findIndex(d => d.date === today) ?? -1;

  const isBlockExpanded = (bi: number) => expandedBlocks[bi] !== false;

  const getBlockTimeState = (block: TimeBlock): "past" | "current" | "future" => {
    if (!block.start_time) return "future";
    const [sh, sm] = block.start_time.split(":").map(Number);
    const startMins = sh * 60 + sm;
    const endMins = startMins + calcDurationMins(block);
    if (nowMins >= endMins) return "past";
    if (nowMins >= startMins) return "current";
    return "future";
  };

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

  const regenerateDay = async () => {
    setRegenLoading(true);
    setRegenError("");
    try {
      const res = await fetch(`${API_BASE}/api/generate/regenerate-day`, {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({ date: today, current_day_plan: todayPlan, feedback, goals, availability: schedule }),
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

  const saveTaskEdit = (bi: number, ti: number) => {
    const key = `${bi}-${ti}`;
    const edits = taskEdit[key];
    if (!edits || !todayPlan) return;
    const updatedDay: DayPlan = {
      ...todayPlan,
      time_blocks: todayPlan.time_blocks.map((b, i) =>
        i !== bi ? b : { ...b, tasks: b.tasks.map((t, j) => j === ti ? { ...t, ...edits } : t) }
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
            tasks: b.tasks.map((t, taskI) => taskI !== ti ? t : { ...t, completed: !t.completed }),
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

  // ── Empty: no goals ──────────────────────────────────────────────────────────
  if (!goals.length) {
    return (
      <div style={{ fontFamily: "Epilogue, system-ui, sans-serif" }} className="flex flex-col items-center justify-center py-32 text-center">
        <div className="w-12 h-12 rounded-2xl bg-[#E8F1EC] flex items-center justify-center mb-5">
          <svg className="w-6 h-6 text-[#2F7D5E]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-black mb-2">no goals yet</h2>
        <p className="text-black/40 mb-6 text-sm max-w-xs leading-relaxed">
          create your first goal and ontrack will build a daily plan to get you there.
        </p>
        <Link to="/goals/new" className="px-5 py-2.5 bg-[#2F7D5E] hover:bg-[#1F5E46] text-white rounded-full text-sm font-semibold transition-colors">
          create a goal →
        </Link>
      </div>
    );
  }

  // ── Main render ─────────────────────────────────────────────────────────────
  return (
    <div style={{ fontFamily: "Epilogue, system-ui, sans-serif" }} className="max-w-3xl pb-24">

      {/* Header */}
      <div className="flex items-end justify-between gap-6 mb-9">
        <div>
          <h1 className="text-[40px] sm:text-[52px] font-extrabold text-black leading-[0.98] tracking-[-0.03em] mb-2">
            {dayOfWeek},{" "}
            <span className="relative inline">
              {monthDay}
              <span
                className="absolute left-0 right-0 rounded-full -z-[1]"
                style={{ bottom: "0.06em", height: "0.13em", background: "#2F7D5E" }}
                aria-hidden
              />
            </span>
            .
          </h1>
          {todayPlan && (
            <p className="text-sm text-black/60 leading-relaxed max-w-[56ch]">
              {todayPlan.objective}
            </p>
          )}
        </div>
        <button
          onClick={() => { setShowFeedback(v => !v); setRegenError(""); }}
          className={`shrink-0 flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-full border transition-colors ${
            showFeedback
              ? "border-black/20 bg-black/[0.05] text-black"
              : "border-black/10 text-black bg-white hover:border-black/20"
          }`}
        >
          {todayPlan ? "↻ regenerate day" : "↻ generate today"}
        </button>
      </div>

      {/* Day-level regen panel */}
      {showFeedback && (
        <div className="mb-6 rounded-2xl border border-black/8 bg-white shadow-sm p-4 flex flex-col gap-3">
          <p className="text-xs font-bold uppercase tracking-wider text-black/40">
            what would you like today to look like?
          </p>
          <textarea
            className="w-full px-3 py-2.5 border border-black/10 rounded-xl bg-[#F9F9F9] text-black text-sm focus:outline-none focus:ring-1 focus:ring-black/15 placeholder:text-black/25 resize-none min-h-[80px]"
            placeholder="e.g. make it shorter, focus on theory, less warm-up today…"
            value={feedback}
            onChange={e => setFeedback(e.target.value)}
          />
          {regenError && <p className="text-xs text-red-500">{regenError}</p>}
          <div className="flex gap-2">
            <button
              onClick={regenerateDay}
              disabled={regenLoading || genLimitHit}
              title={genLimitHit ? "You've used all your free generations." : undefined}
              className="flex items-center gap-2 px-4 py-2 bg-[#2F7D5E] hover:bg-[#1F5E46] rounded-full text-sm text-white font-semibold disabled:opacity-50 transition-colors"
            >
              {regenLoading && <span className="w-3.5 h-3.5 border border-white/40 border-t-white rounded-full animate-spin" />}
              {regenLoading ? "regenerating…" : "regenerate"}
            </button>
            <button
              onClick={() => { setShowFeedback(false); setFeedback(""); setRegenError(""); }}
              className="px-4 py-2 text-sm text-black/40 hover:text-black transition-colors"
            >
              cancel
            </button>
          </div>
        </div>
      )}

      {/* Pending-save banner */}
      {pendingSave && (
        <div className="mb-5 rounded-2xl border border-[#D9E8DF] bg-[#E8F1EC] p-4 flex flex-col gap-3">
          <div>
            <p className="text-xs font-semibold text-[#1F5E46] mb-1">save this preference to a goal?</p>
            <p className="text-xs text-[#2F7D5E]/70 italic">"{pendingSave.feedback}"</p>
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
              className="px-3 py-1.5 bg-[#2F7D5E] hover:bg-[#1F5E46] rounded-full text-xs text-white font-semibold transition-colors"
            >
              save to goal
            </button>
            <button
              onClick={() => setPendingSave(null)}
              className="px-3 py-1.5 text-xs text-black/40 hover:text-black transition-colors"
            >
              dismiss
            </button>
          </div>
        </div>
      )}

      {/* No plan for today / Free day */}
      {!todayPlan && (() => {
        const nextDay = plan?.find(d => d.date > today) ?? null;
        const nextLabel = nextDay
          ? new Date(nextDay.date + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" }).toLowerCase()
          : null;
        return (
          <div className="flex flex-col items-center py-24 text-center">
            <div className="w-12 h-12 rounded-2xl bg-[#E8F1EC] flex items-center justify-center mb-5">
              <svg className="w-6 h-6 text-[#2F7D5E]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-black mb-1.5">{!plan ? "no plan yet." : "free day."}</h2>
            {!plan ? (
              <p className="text-sm text-black/40 mb-6 max-w-xs">
                you have {goals.length} goal{goals.length !== 1 ? "s" : ""} set up. hit <span className="text-black font-medium">generate today</span> above to schedule your day.
              </p>
            ) : nextLabel ? (
              <p className="text-sm text-black/40 mb-6 max-w-xs">
                nothing scheduled today. next session is <span className="text-black/60">{nextLabel}</span>.
              </p>
            ) : (
              <p className="text-sm text-black/40 mb-6 max-w-xs">
                nothing else scheduled this week. generate a new plan when you're ready.
              </p>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => setShowFeedback(true)}
                className="px-4 py-2 border border-black/10 rounded-full text-black/40 text-sm font-medium hover:border-black/20 hover:text-black bg-white transition-colors"
              >
                {!plan ? "generate today" : "add tasks for today"}
              </button>
              {!plan && (
                <Link to="/" className="px-4 py-2 bg-[#2F7D5E] hover:bg-[#1F5E46] rounded-full text-white text-sm font-semibold transition-colors">
                  generate full plan →
                </Link>
              )}
              {plan && !nextLabel && (
                <Link to="/" className="px-4 py-2 bg-[#2F7D5E] hover:bg-[#1F5E46] rounded-full text-white text-sm font-semibold transition-colors">
                  generate next week →
                </Link>
              )}
            </div>
          </div>
        );
      })()}

      {/* Plan */}
      {todayPlan && (
        <div className="grid items-start gap-[22px]" style={{ gridTemplateColumns: "88px 1fr" }}>

          {/* Timeline gutter — hidden on mobile */}
          <aside className="hidden sm:flex sticky top-[84px] flex-col gap-1 pt-2">
            <span className="text-[10px] uppercase tracking-[0.14em] text-black/40 font-bold">now</span>
            <span className="text-[13px] font-bold text-black tabular-nums tracking-tight">{currentTimeStr}</span>
            <div
              className="mt-3.5 w-1 rounded-full relative self-stretch"
              style={{ background: "rgba(13,13,13,0.05)", minHeight: "380px" }}
            >
              <div
                className="absolute left-0 right-0 top-0 rounded-full"
                style={{ height: `${timelineProgress}%`, background: "#2F7D5E" }}
              />
              <span
                className="absolute -left-[4px] w-3 h-3 rounded-full border-2 border-[#F9F9F9]"
                style={{ top: `${timelineProgress}%`, background: "#2F7D5E" }}
              />
            </div>
          </aside>

          {/* Blocks */}
          <div className="flex flex-col gap-4">
            {todayPlan.time_blocks.map((block, bi) => {
              const blockAllDone = block.tasks.length > 0 && block.tasks.every(t => t.completed);
              const timeState = getBlockTimeState(block);
              const isCurrent = !blockAllDone && timeState === "current";
              const isExpanded = isBlockExpanded(bi);
              const doneTasks = block.tasks.filter(t => t.completed).length;
              const durationMins = calcDurationMins(block);
              const goalTag = attributeBlock(block, goals);

              return (
                <article
                  key={block.id ?? bi}
                  className="rounded-[18px] border overflow-hidden transition-all duration-200"
                  style={
                    blockAllDone
                      ? { background: "linear-gradient(180deg,#fff 0%,#E8F1EC 240%)", borderColor: "#D9E8DF" }
                      : isCurrent
                      ? { background: "#fff", borderColor: "#D9E8DF", boxShadow: "0 0 0 4px #E8F1EC" }
                      : { background: "#fff", borderColor: "rgba(13,13,13,0.08)" }
                  }
                >
                  {/* Block head */}
                  <div
                    className="grid items-center gap-3.5 px-5 py-[18px] cursor-pointer"
                    style={{ gridTemplateColumns: "auto 1fr auto auto" }}
                    onClick={() => setExpandedBlocks(prev => ({ ...prev, [bi]: !isExpanded }))}
                  >
                    {/* Time */}
                    <div className="flex flex-col gap-0.5 min-w-[84px]">
                      <span className="text-sm font-bold text-black tabular-nums tracking-tight">
                        {block.start_time ? formatTime(block.start_time) : "—"}
                      </span>
                      <span className="text-[11px] uppercase tracking-[0.04em] font-bold text-black/40">
                        {durationMins} min
                      </span>
                    </div>

                    {/* Label + goal tag */}
                    <div className="flex flex-col gap-1">
                      {goalTag && (
                        <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.12em] font-bold text-[#1F5E46]">
                          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "#2F7D5E" }} />
                          {goalTag}
                        </span>
                      )}
                      <span className={`text-[17px] font-bold tracking-tight leading-tight ${blockAllDone ? "text-black/60" : "text-black"}`}>
                        {block.label}
                      </span>
                    </div>

                    {/* Status */}
                    <span className="hidden sm:block text-xs font-semibold text-black/40 whitespace-nowrap tabular-nums">
                      <strong className="text-black font-bold">{doneTasks}/{block.tasks.length}</strong> done
                    </span>

                    {/* Actions */}
                    <div className="flex gap-1.5" onClick={e => e.stopPropagation()}>
                      {!blockAllDone && (
                        <button
                          onClick={() => setBlockOpen(prev => ({ ...prev, [bi]: !prev[bi] }))}
                          title="regenerate block"
                          className={`w-[30px] h-[30px] rounded-full border flex items-center justify-center text-sm transition-colors ${
                            blockOpen[bi]
                              ? "border-black/25 text-black bg-black/[0.04]"
                              : "border-black/12 text-black/60 bg-white hover:text-black hover:border-black/25"
                          }`}
                        >
                          ↻
                        </button>
                      )}
                      <button
                        onClick={() => setExpandedBlocks(prev => ({ ...prev, [bi]: !isExpanded }))}
                        className="w-[30px] h-[30px] rounded-full border border-black/12 bg-white flex items-center justify-center text-black/60 hover:text-black hover:border-black/25 transition-all"
                      >
                        <svg
                          className="w-3 h-3 transition-transform duration-250"
                          style={{ transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)" }}
                          viewBox="0 0 12 12" fill="none"
                        >
                          <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Block-level regen panel */}
                  {blockOpen[bi] && (
                    <div className="px-5 py-3 border-t border-black/8 bg-black/[0.02] flex flex-col gap-2">
                      <p className="text-xs text-black/50 font-medium">what should this block look like instead?</p>
                      <textarea
                        className="w-full px-3 py-2 border border-black/10 rounded-xl bg-white text-black text-sm focus:outline-none focus:ring-1 focus:ring-black/15 placeholder:text-black/25 resize-none min-h-[64px]"
                        placeholder="e.g. more practical exercises, shorter, skip warm-up…"
                        value={blockFeedback[bi] || ""}
                        onChange={e => setBlockFeedback(prev => ({ ...prev, [bi]: e.target.value }))}
                      />
                      {blockError[bi] && <p className="text-xs text-red-500">{blockError[bi]}</p>}
                      <div className="flex gap-2">
                        <button
                          onClick={() => regenerateBlock(bi, block)}
                          disabled={blockRegen[bi] || genLimitHit}
                          title={genLimitHit ? "You've used all your free generations." : undefined}
                          className="flex items-center gap-2 px-3 py-1.5 bg-[#2F7D5E] hover:bg-[#1F5E46] rounded-full text-xs text-white font-semibold disabled:opacity-50 transition-colors"
                        >
                          {blockRegen[bi] && <span className="w-3 h-3 border border-white/40 border-t-white rounded-full animate-spin" />}
                          {blockRegen[bi] ? "regenerating…" : "regenerate block"}
                        </button>
                        <button
                          onClick={() => setBlockOpen(prev => ({ ...prev, [bi]: false }))}
                          className="px-3 py-1.5 text-xs text-black/40 hover:text-black transition-colors"
                        >
                          cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Expandable body */}
                  <div className={`today-block-body${isExpanded ? " is-open" : ""}`}>
                    <div>
                      <div className="border-t border-black/8 px-5 pb-[18px]">

                        {/* Tasks */}
                        {block.tasks.map((task, ti) => {
                          const key = `${bi}-${ti}`;
                          const mode = taskOpen[key] ?? null;
                          const isEditing = mode === "edit";
                          const isTaskRegening = mode === "regen";
                          const editVals = taskEdit[key] ?? {
                            title: task.title,
                            description: task.description,
                            estimated_minutes: task.estimated_minutes,
                          };

                          return (
                            <div
                              key={ti}
                              className="py-4 border-b border-dashed border-black/8 last:border-b-0"
                            >
                              {/* Normal task row */}
                              {!isEditing && (
                                <div className="flex gap-3.5 items-start">
                                  <button
                                    onClick={() => toggleTaskComplete(bi, ti)}
                                    className={`w-[22px] h-[22px] rounded-[8px] border flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                                      task.completed
                                        ? "bg-[#2F7D5E] border-[#2F7D5E]"
                                        : "border-black/25 bg-white hover:border-black"
                                    }`}
                                  >
                                    {task.completed && (
                                      <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                                        <path d="M2.5 6.8L5.2 9.5L10.5 3.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                      </svg>
                                    )}
                                  </button>

                                  <div className="flex-1 min-w-0">
                                    <p className={`text-sm font-semibold tracking-tight mb-1 ${task.completed ? "text-black/40 line-through decoration-[#2F7D5E] decoration-[1.5px]" : "text-black"}`}>
                                      {task.title}
                                    </p>
                                    <p className={`text-[13px] leading-relaxed max-w-[64ch] ${task.completed ? "text-black/30 line-through decoration-[#2F7D5E] decoration-[1.5px]" : "text-black/60"}`}>
                                      {task.description}
                                    </p>
                                    <div className="flex gap-1.5 mt-2">
                                      <button
                                        onClick={() => {
                                          setTaskEdit(prev => ({ ...prev, [key]: { title: task.title, description: task.description, estimated_minutes: task.estimated_minutes } }));
                                          setTaskOpen(prev => ({ ...prev, [key]: "edit" }));
                                        }}
                                        className="px-2 py-1 text-[11px] border border-black/10 text-black/40 hover:text-black hover:border-black/20 rounded-full transition-colors font-semibold"
                                      >
                                        edit
                                      </button>
                                      <button
                                        onClick={() => setTaskOpen(prev => ({ ...prev, [key]: isTaskRegening ? null : "regen" }))}
                                        className={`px-2 py-1 text-[11px] border rounded-full transition-colors font-semibold ${
                                          isTaskRegening
                                            ? "border-black/20 bg-black/[0.05] text-black"
                                            : "border-black/10 text-black/40 hover:text-black hover:border-black/20"
                                        }`}
                                      >
                                        regen
                                      </button>
                                    </div>
                                  </div>

                                  <span className={`text-xs font-bold tabular-nums px-2.5 py-1 rounded-full whitespace-nowrap shrink-0 ${
                                    task.completed ? "bg-[#E8F1EC] text-[#1F5E46]" : "bg-black/5 text-black/60"
                                  }`}>
                                    {task.estimated_minutes} min
                                  </span>
                                </div>
                              )}

                              {/* Inline edit */}
                              {isEditing && (
                                <div className="flex flex-col gap-2">
                                  <input
                                    className="w-full px-2.5 py-1.5 border border-black/10 rounded-lg bg-white text-sm text-black focus:outline-none focus:ring-1 focus:ring-black/15 placeholder:text-black/25"
                                    value={editVals.title}
                                    onChange={e => setTaskEdit(prev => ({ ...prev, [key]: { ...editVals, title: e.target.value } }))}
                                    placeholder="task title"
                                  />
                                  <textarea
                                    className="w-full px-2.5 py-1.5 border border-black/10 rounded-lg bg-white text-xs text-black/60 focus:outline-none focus:ring-1 focus:ring-black/15 resize-none min-h-[60px] placeholder:text-black/25"
                                    value={editVals.description}
                                    onChange={e => setTaskEdit(prev => ({ ...prev, [key]: { ...editVals, description: e.target.value } }))}
                                    placeholder="description"
                                  />
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="number" min={1}
                                      className="w-20 px-2.5 py-1.5 border border-black/10 rounded-lg bg-white text-sm text-black focus:outline-none focus:ring-1 focus:ring-black/15"
                                      value={editVals.estimated_minutes}
                                      onChange={e => setTaskEdit(prev => ({ ...prev, [key]: { ...editVals, estimated_minutes: parseInt(e.target.value) || 0 } }))}
                                    />
                                    <span className="text-xs text-black/40">minutes</span>
                                    <div className="flex gap-2 ml-auto">
                                      <button
                                        onClick={() => saveTaskEdit(bi, ti)}
                                        className="px-3 py-1.5 bg-[#2F7D5E] hover:bg-[#1F5E46] rounded-full text-xs text-white font-semibold transition-colors"
                                      >
                                        save
                                      </button>
                                      <button
                                        onClick={() => { setTaskOpen(prev => ({ ...prev, [key]: null })); setTaskEdit(prev => { const n = { ...prev }; delete n[key]; return n; }); }}
                                        className="px-3 py-1.5 text-xs text-black/40 hover:text-black transition-colors"
                                      >
                                        cancel
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* Per-task regen panel */}
                              {isTaskRegening && (
                                <div className="mt-2.5 px-3 py-3 bg-[#F9F9F9] rounded-xl border border-black/8 flex flex-col gap-2">
                                  <p className="text-xs text-black/50 font-medium">what should this task look like instead?</p>
                                  <textarea
                                    className="w-full px-3 py-2 border border-black/10 rounded-lg bg-white text-black text-sm focus:outline-none focus:ring-1 focus:ring-black/15 placeholder:text-black/25 resize-none min-h-[56px]"
                                    placeholder="e.g. make it easier, focus on something different…"
                                    value={taskFeedback[key] || ""}
                                    onChange={e => setTaskFeedback(prev => ({ ...prev, [key]: e.target.value }))}
                                  />
                                  {taskError[key] && <p className="text-xs text-red-500">{taskError[key]}</p>}
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => regenerateTask(bi, ti, block)}
                                      disabled={taskRegen[key] || genLimitHit}
                                      title={genLimitHit ? "You've used all your free generations." : undefined}
                                      className="flex items-center gap-2 px-3 py-1.5 bg-[#2F7D5E] hover:bg-[#1F5E46] rounded-full text-xs text-white font-semibold disabled:opacity-50 transition-colors"
                                    >
                                      {taskRegen[key] && <span className="w-3 h-3 border border-white/40 border-t-white rounded-full animate-spin" />}
                                      {taskRegen[key] ? "regenerating…" : "regenerate task"}
                                    </button>
                                    <button
                                      onClick={() => setTaskOpen(prev => ({ ...prev, [key]: null }))}
                                      className="px-3 py-1.5 text-xs text-black/40 hover:text-black transition-colors"
                                    >
                                      cancel
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}

                        {/* Inline tweak row for current block */}
                        {isCurrent && (
                          <div className="mt-3 px-3.5 py-2.5 rounded-xl border border-dashed border-black/12 flex gap-2.5 items-center bg-[#F9F9F9]">
                            <span className="text-[11px] uppercase tracking-[0.12em] font-bold text-black/40 shrink-0">tweak</span>
                            <input
                              className="flex-1 min-w-0 border-none bg-transparent outline-none text-[13px] text-black placeholder:text-black/25 py-1"
                              placeholder="not feeling this today? say what you'd rather do."
                              value={blockFeedback[bi] || ""}
                              onChange={e => setBlockFeedback(prev => ({ ...prev, [bi]: e.target.value }))}
                            />
                            <button
                              onClick={() => regenerateBlock(bi, block)}
                              disabled={blockRegen[bi] || genLimitHit}
                              title={genLimitHit ? "You've used all your free generations." : undefined}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#E8F1EC] hover:bg-[#D9E8DF] border border-[#D9E8DF] text-[#1F5E46] rounded-full text-xs font-semibold disabled:opacity-50 transition-colors shrink-0"
                            >
                              {blockRegen[bi] && <span className="w-3 h-3 border border-[#2F7D5E]/40 border-t-[#2F7D5E] rounded-full animate-spin" />}
                              {blockRegen[bi] ? "…" : "regenerate"}
                            </button>
                          </div>
                        )}

                      </div>
                    </div>
                  </div>
                </article>
              );
            })}

            <p className="mt-3 text-center text-xs text-black/40 tracking-[0.04em]">
              that's everything for today.
              {plan && plan.find(d => d.date > today) && (
                <>
                  {" "}
                  <Link to="/calendar" className="text-[#1F5E46] font-semibold no-underline hover:underline">
                    view tomorrow →
                  </Link>
                </>
              )}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
