import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../context/AppContext";
import type { DayPlan } from "../context/AppContext";
import { useAuth0 } from "@auth0/auth0-react";

const API_BASE = import.meta.env.VITE_API_BASE;

function toDateStr(d: Date) {
  return d.toLocaleDateString("en-CA");
}

export default function GoalsOverview() {
  const { goals, schedule, plan, setPlan, showToast } = useApp();
  const { isAuthenticated, getAccessTokenSilently } = useAuth0();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const today = toDateStr(new Date());
  const isPlanStale = !!plan && plan.length > 0 && plan.every(d => d.date < today);

  useEffect(() => { document.title = "OnTrack"; }, []);

  const generate = async () => {
    if (goals.length === 0) return;
    setLoading(true);
    setError("");
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (isAuthenticated) {
        const token = await getAccessTokenSilently().catch(() => null);
        if (token) headers["Authorization"] = `Bearer ${token}`;
      }
      const totalHours = goals.reduce((s, g) => s + g.hours_per_week, 0);
      const res = await fetch(`${API_BASE}/api/generate`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          goals,
          availability: schedule,
          preferences: { hours_per_week: totalHours, sessions_per_day: 1 },
        }),
      });
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const data = await res.json();
      const planWithIds: DayPlan[] = (data.weekly_tasks || []).map((day: DayPlan) => ({
        ...day,
        time_blocks: day.time_blocks.map((b) => ({ ...b, id: crypto.randomUUID() })),
      }));
      setPlan(planWithIds);
      showToast({ message: "Your plan is ready!", action: { label: "View calendar →", href: "/calendar" } });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
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
            disabled={loading}
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
        {goals.map((goal) => (
          <Link
            key={goal.id}
            to={`/goals/${goal.id}`}
            className="block border border-gray-700 rounded-lg p-4 hover:border-gray-500 hover:bg-gray-900/40 transition-colors group"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="font-medium mb-2">{goal.title}</h3>
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
              </div>
              <span className="text-gray-600 group-hover:text-gray-400 text-sm transition-colors shrink-0">
                Edit →
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
