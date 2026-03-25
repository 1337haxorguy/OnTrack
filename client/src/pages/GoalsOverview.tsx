import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../context/AppContext";
import type { Goal, DayPlan } from "../context/AppContext";
import { useAuth0 } from "@auth0/auth0-react";

const API_BASE = import.meta.env.VITE_API_BASE;

function toDateStr(d: Date) {
  return d.toLocaleDateString("en-CA");
}

// Tag each block with the goal it most likely belongs to, based on label word overlap.
function attributeBlocks(plan: DayPlan[], goals: Goal[]): DayPlan[] {
  if (goals.length === 0) return plan;
  if (goals.length === 1) {
    return plan.map(day => ({
      ...day,
      time_blocks: day.time_blocks.map(b => ({ ...b, goal_id: goals[0].id })),
    }));
  }
  return plan.map(day => ({
    ...day,
    time_blocks: day.time_blocks.map(b => {
      if (b.goal_id) return b;
      const labelLower = b.label.toLowerCase();
      let bestGoal: Goal | undefined;
      let bestScore = 0;
      for (const g of goals) {
        const words = g.title.toLowerCase().split(/\s+/).filter(w => w.length > 3);
        const score = words.filter(w => labelLower.includes(w)).length;
        if (score > bestScore) { bestScore = score; bestGoal = g; }
      }
      return { ...b, goal_id: bestGoal?.id };
    }),
  }));
}

export default function GoalsOverview() {
  const { goals, schedule, plan, setPlan, showToast } = useApp();
  const { isAuthenticated, getAccessTokenSilently } = useAuth0();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [regenGoalId, setRegenGoalId] = useState<string | null>(null);
  const [regenError, setRegenError] = useState<string | null>(null);

  const today = toDateStr(new Date());
  const isPlanStale = !!plan && plan.length > 0 && plan.every(d => d.date < today);

  useEffect(() => { document.title = "OnTrack"; }, []);

  const authHeaders = async (): Promise<Record<string, string>> => {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (isAuthenticated) {
      const token = await getAccessTokenSilently().catch(() => null);
      if (token) headers["Authorization"] = `Bearer ${token}`;
    }
    return headers;
  };

  const generate = async () => {
    if (goals.length === 0) return;
    setLoading(true);
    setError("");
    try {
      const totalHours = goals.reduce((s, g) => s + g.hours_per_week, 0);
      const res = await fetch(`${API_BASE}/api/generate`, {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({
          goals,
          availability: schedule,
          preferences: { hours_per_week: totalHours, sessions_per_day: 1 },
        }),
      });
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const data = await res.json();
      const newPlan: DayPlan[] = (data.weekly_tasks || []).map((day: DayPlan) => ({
        ...day,
        time_blocks: day.time_blocks.map((b) => ({ ...b, id: crypto.randomUUID() })),
      }));
      setPlan(attributeBlocks(newPlan, goals));
      showToast({ message: "Your plan is ready!", action: { label: "View calendar →", href: "/calendar" } });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  // Regenerate only the blocks belonging to a single goal, preserving all other goals' blocks.
  const regenerateGoal = async (goalId: string) => {
    const goal = goals.find(g => g.id === goalId);
    if (!goal) return;
    setRegenGoalId(goalId);
    setRegenError(null);
    try {
      const res = await fetch(`${API_BASE}/api/generate`, {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({
          goals: [goal],
          availability: schedule,
          preferences: { hours_per_week: goal.hours_per_week, sessions_per_day: 1 },
        }),
      });
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const data = await res.json();
      const newDays: DayPlan[] = (data.weekly_tasks || []).map((day: DayPlan) => ({
        ...day,
        time_blocks: day.time_blocks.map(b => ({ ...b, id: crypto.randomUUID(), goal_id: goalId })),
      }));

      setPlan(prev => {
        if (!prev) return newDays;
        const newDates = new Set(newDays.map(d => d.date));
        const allDates = new Set([...prev.map(d => d.date), ...newDays.map(d => d.date)]);
        return Array.from(allDates).sort().map(date => {
          const existing = prev.find(d => d.date === date);
          const replacement = newDays.find(d => d.date === date);
          if (!existing) return replacement!;
          // Keep blocks from other goals, swap in new blocks for this goal
          const keptBlocks = existing.time_blocks.filter(b => b.goal_id !== goalId);
          const newBlocks = replacement?.time_blocks ?? [];
          // If this goal no longer has blocks for this date, drop the day if nothing else is scheduled
          const merged = [...keptBlocks, ...newBlocks];
          if (merged.length === 0) return null;
          return { ...existing, time_blocks: merged };
        }).filter((d): d is DayPlan => d !== null);
      });
      showToast({ message: `"${goal.title}" blocks updated!`, action: { label: "View calendar →", href: "/calendar" } });
    } catch (e: unknown) {
      setRegenError(goalId);
    } finally {
      setRegenGoalId(null);
    }
  };

  if (goals.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <div className="w-16 h-16 rounded-2xl bg-indigo-600/20 border border-indigo-600/30 flex items-center justify-center mb-5">
          <svg className="w-8 h-8 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold mb-2">No goals yet</h2>
        <p className="text-gray-400 mb-8 max-w-sm leading-relaxed">
          Create your first goal and OnTrack will generate a personalized plan of daily tasks to help you get there.
        </p>
        <Link
          to="/goals/new"
          className="px-6 py-3 bg-indigo-600 rounded-lg text-white font-medium hover:bg-indigo-700 transition-colors"
        >
          Create your first goal
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">Goals</h1>
        <div className="flex gap-2">
          <Link
            to="/goals/new"
            className="px-3 py-1.5 text-sm border border-gray-600 rounded bg-gray-800 hover:bg-gray-700 transition-colors"
          >
            + Add goal
          </Link>
          <button
            className="px-4 py-1.5 text-sm bg-indigo-600 rounded hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            onClick={generate}
            disabled={loading || regenGoalId !== null}
          >
            {loading ? "Generating..." : "Generate Plan"}
          </button>
        </div>
      </div>

      {isPlanStale && (
        <Link
          to="/recap"
          className="mb-4 flex items-center justify-between gap-3 p-3.5 rounded-lg border border-amber-700/50 bg-amber-900/20 text-amber-300 hover:bg-amber-900/30 transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <span className="text-sm font-medium">Your plan is complete — review your week and generate a new one</span>
          </div>
          <span className="text-xs text-amber-400 shrink-0">Weekly Recap →</span>
        </Link>
      )}

      {error && (
        <div className="mb-4 p-3 rounded border border-red-700 bg-red-950/50 text-red-300 text-sm">
          {error}
        </div>
      )}

      {loading && (
        <div className="flex flex-col gap-3 animate-pulse mb-4">
          {[1, 2].map((n) => (
            <div key={n} className="border border-gray-700 rounded-lg p-4">
              <div className="h-4 bg-gray-800 rounded w-48 mb-2" />
              <div className="h-3 bg-gray-800 rounded w-32" />
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-3">
        {goals.map((goal) => {
          const isRegening = regenGoalId === goal.id;
          const hasError = regenError === goal.id;
          return (
            <div
              key={goal.id}
              className={`border rounded-lg p-4 transition-colors ${isRegening ? "border-indigo-700/60 bg-indigo-950/20" : "border-gray-700 bg-transparent"}`}
            >
              <div className="flex items-start justify-between gap-3">
                <Link to={`/goals/${goal.id}`} className="flex-1 min-w-0 group">
                  <h3 className="font-medium mb-2 group-hover:text-indigo-300 transition-colors">{goal.title}</h3>
                  <div className="flex flex-wrap gap-1.5">
                    <span className="text-xs bg-gray-800 border border-gray-700 px-2 py-0.5 rounded-full text-gray-300 capitalize">
                      {goal.skill_level}
                    </span>
                    {goal.timeframe.start_date && goal.timeframe.end_date && (
                      <span className="text-xs text-gray-500 bg-gray-800/50 border border-gray-700/50 px-2 py-0.5 rounded-full">
                        {goal.timeframe.start_date} → {goal.timeframe.end_date}
                      </span>
                    )}
                    <span className="text-xs text-gray-500 bg-gray-800/50 border border-gray-700/50 px-2 py-0.5 rounded-full">
                      {goal.hours_per_week} hr{goal.hours_per_week !== 1 && "s"}/week
                    </span>
                    {goal.selected_days.length > 0 && (
                      <span className="text-xs text-gray-500 bg-gray-800/50 border border-gray-700/50 px-2 py-0.5 rounded-full">
                        {goal.selected_days.map((d) => d.slice(0, 3)).join(", ")}
                      </span>
                    )}
                    {goal.restrictions.length > 0 && (
                      <span className="text-xs text-orange-400/70 bg-orange-900/20 border border-orange-800/30 px-2 py-0.5 rounded-full">
                        {goal.restrictions.length} restriction{goal.restrictions.length !== 1 && "s"}
                      </span>
                    )}
                  </div>
                </Link>

                <div className="flex items-center gap-2 shrink-0">
                  {plan && plan.length > 0 && (
                    <button
                      onClick={() => regenerateGoal(goal.id)}
                      disabled={regenGoalId !== null || loading}
                      title="Regenerate blocks for this goal"
                      className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs border border-gray-700 rounded-lg text-gray-400 hover:border-indigo-600/60 hover:text-indigo-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      {isRegening ? (
                        <span className="w-3 h-3 border border-indigo-400 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                        </svg>
                      )}
                      {isRegening ? "Regenerating…" : "Regenerate"}
                    </button>
                  )}
                  <Link to={`/goals/${goal.id}`} className="text-xs px-2.5 py-1.5 border border-gray-700 rounded-lg text-gray-400 hover:border-gray-500 hover:text-gray-200 transition-colors">
                    Edit →
                  </Link>
                </div>
              </div>

              {hasError && (
                <p className="mt-2 text-xs text-red-400">Failed to regenerate. Try again.</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
