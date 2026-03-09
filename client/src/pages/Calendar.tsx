import { useState } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../context/AppContext";
import type { DayPlan, TimeBlock } from "../context/AppContext";
import { useAuth0 } from "@auth0/auth0-react";

const API_BASE = "http://localhost:3000";

function formatDate(dateStr: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

export default function Calendar() {
  const { goals, schedule, plan, setPlan } = useApp();
  const { isAuthenticated, getAccessTokenSilently } = useAuth0();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [regenDayIdx, setRegenDayIdx] = useState<number | null>(null);
  const [regenFeedback, setRegenFeedback] = useState("");
  const [regenLoading, setRegenLoading] = useState(false);
  const [reschedule, setReschedule] = useState<{ dayIdx: number; blockIdx: number } | null>(null);
  const [rsDate, setRsDate] = useState("");
  const [rsStart, setRsStart] = useState("");
  const [rsEnd, setRsEnd] = useState("");

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
    setPlan(null);
    setRegenDayIdx(null);
    setReschedule(null);
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
      const planWithIds: DayPlan[] = (data.weekly_tasks || []).map((day: DayPlan) => ({
        ...day,
        time_blocks: day.time_blocks.map((b) => ({ ...b, id: crypto.randomUUID() })),
      }));
      setPlan(planWithIds);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const regenerateDay = async (dayIdx: number) => {
    if (!plan) return;
    setRegenLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/api/generate/regenerate-day`, {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({
          date: plan[dayIdx].date,
          current_day_plan: plan[dayIdx],
          feedback: regenFeedback,
          goals,
          availability: schedule,
        }),
      });
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const data = await res.json();
      if (data) {
        const newDay: DayPlan = {
          ...data,
          time_blocks: (data.time_blocks || []).map((b: TimeBlock) => ({
            ...b,
            id: crypto.randomUUID(),
          })),
        };
        setPlan((prev) => prev!.map((d, i) => (i === dayIdx ? newDay : d)));
      }
      setRegenDayIdx(null);
      setRegenFeedback("");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to regenerate day");
    } finally {
      setRegenLoading(false);
    }
  };

  const openReschedule = (dayIdx: number, blockIdx: number) => {
    const block = plan![dayIdx].time_blocks[blockIdx];
    setReschedule({ dayIdx, blockIdx });
    setRsDate(plan![dayIdx].date);
    setRsStart(block.start_time || "");
    setRsEnd(block.end_time || "");
  };

  const applyReschedule = () => {
    if (!plan || !reschedule) return;
    const { dayIdx, blockIdx } = reschedule;
    const updatedBlock = {
      ...plan[dayIdx].time_blocks[blockIdx],
      start_time: rsStart,
      end_time: rsEnd,
    };
    if (rsDate === plan[dayIdx].date) {
      setPlan((prev) =>
        prev!.map((d, di) =>
          di === dayIdx
            ? { ...d, time_blocks: d.time_blocks.map((b, bi) => (bi === blockIdx ? updatedBlock : b)) }
            : d
        )
      );
    } else {
      let newPlan = plan
        .map((d, di) =>
          di === dayIdx
            ? { ...d, time_blocks: d.time_blocks.filter((_, bi) => bi !== blockIdx) }
            : d
        )
        .filter((d) => d.time_blocks.length > 0);
      const targetIdx = newPlan.findIndex((d) => d.date === rsDate);
      if (targetIdx >= 0) {
        newPlan[targetIdx] = {
          ...newPlan[targetIdx],
          time_blocks: [...newPlan[targetIdx].time_blocks, updatedBlock],
        };
      } else {
        newPlan.push({
          date: rsDate,
          objective: `Rescheduled: ${updatedBlock.label}`,
          time_blocks: [updatedBlock],
        });
        newPlan.sort((a, b) => a.date.localeCompare(b.date));
      }
      setPlan(newPlan);
    }
    setReschedule(null);
  };

  // Empty states
  if (goals.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <h2 className="text-xl font-bold mb-2">No goals set up yet</h2>
        <p className="text-gray-400 mb-6">Create a goal first, then generate your plan.</p>
        <Link to="/goals/new" className="px-5 py-2.5 bg-indigo-600 rounded text-white hover:bg-indigo-700">
          Create a goal
        </Link>
      </div>
    );
  }

  if (!plan && !loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <h2 className="text-xl font-bold mb-2">No plan yet</h2>
        <p className="text-gray-400 mb-6">Generate a weekly plan based on your goals and schedule.</p>
        <button
          className="px-5 py-2.5 bg-indigo-600 rounded text-white hover:bg-indigo-700"
          onClick={generate}
        >
          Generate Plan
        </button>
        {error && <p className="text-red-400 text-sm mt-3">{error}</p>}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">Calendar</h1>
        <button
          className="px-3 py-1.5 text-sm border border-gray-600 rounded bg-gray-800 hover:bg-gray-700 disabled:opacity-50 transition-colors"
          onClick={generate}
          disabled={loading}
        >
          {loading ? "Generating..." : "Regenerate All"}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded border border-red-700 bg-red-950/50 text-red-300 text-sm">{error}</div>
      )}

      {loading && (
        <div className="flex flex-col gap-4 animate-pulse">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="border border-gray-700 rounded-lg p-4">
              <div className="h-4 bg-gray-800 rounded w-40 mb-3" />
              <div className="h-3 bg-gray-800 rounded w-full mb-2" />
              <div className="h-3 bg-gray-800 rounded w-3/4" />
            </div>
          ))}
        </div>
      )}

      {plan && !loading && (
        <div className="flex flex-col gap-4">
          {plan.map((day, di) => (
            <div key={day.date} className="border border-gray-700 rounded-lg overflow-hidden">
              {/* Day header */}
              <div className="px-4 py-3 bg-gray-900 border-b border-gray-700 flex items-center justify-between">
                <span className="font-medium text-sm">{formatDate(day.date)}</span>
                <button
                  className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                  onClick={() => {
                    setRegenDayIdx(regenDayIdx === di ? null : di);
                    setRegenFeedback("");
                  }}
                >
                  {regenDayIdx === di ? "Cancel" : "Regenerate day"}
                </button>
              </div>

              {/* Objective */}
              <div className="px-4 py-2 text-xs text-gray-500 border-b border-gray-800 bg-gray-900/40 leading-relaxed">
                {day.objective}
              </div>

              {/* Regen day form */}
              {regenDayIdx === di && (
                <div className="px-4 py-3 border-b border-gray-700 bg-gray-900/70 flex flex-col gap-2">
                  <textarea
                    className="p-2 border border-gray-600 rounded bg-gray-900 text-white text-sm w-full min-h-[60px] resize-y focus:outline-none focus:border-indigo-500"
                    placeholder="Optional feedback (e.g. make it harder, focus on barre chords, shorter session…)"
                    value={regenFeedback}
                    onChange={(e) => setRegenFeedback(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <button
                      className="px-3 py-1.5 bg-indigo-600 rounded text-sm text-white hover:bg-indigo-700 disabled:opacity-60"
                      onClick={() => regenerateDay(di)}
                      disabled={regenLoading}
                    >
                      {regenLoading ? "Regenerating..." : "Submit"}
                    </button>
                    <button
                      className="px-3 py-1.5 text-sm text-gray-400 hover:text-white"
                      onClick={() => setRegenDayIdx(null)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Time blocks */}
              <div className="divide-y divide-gray-800">
                {day.time_blocks.map((block, bi) => (
                  <div key={block.id} className="px-4 py-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-indigo-400">{block.label}</span>
                        {block.start_time && block.end_time && (
                          <span className="text-xs text-gray-500 tabular-nums">
                            {block.start_time} – {block.end_time}
                          </span>
                        )}
                      </div>
                      <button
                        className="text-xs text-gray-500 hover:text-white transition-colors"
                        onClick={() =>
                          reschedule?.dayIdx === di && reschedule?.blockIdx === bi
                            ? setReschedule(null)
                            : openReschedule(di, bi)
                        }
                      >
                        {reschedule?.dayIdx === di && reschedule?.blockIdx === bi ? "Cancel" : "Reschedule"}
                      </button>
                    </div>

                    {/* Reschedule form */}
                    {reschedule?.dayIdx === di && reschedule?.blockIdx === bi && (
                      <div className="mb-3 p-3 border border-gray-700 rounded-lg bg-gray-900/70 flex flex-col gap-3">
                        <div className="flex gap-2 flex-wrap">
                          <label className="flex flex-col gap-1 text-xs text-gray-400">
                            Date
                            <input
                              type="date"
                              className="p-1.5 border border-gray-600 rounded bg-gray-900 text-white text-sm focus:outline-none focus:border-indigo-500"
                              value={rsDate}
                              onChange={(e) => setRsDate(e.target.value)}
                            />
                          </label>
                          <label className="flex flex-col gap-1 text-xs text-gray-400">
                            Start time
                            <input
                              type="time"
                              className="p-1.5 border border-gray-600 rounded bg-gray-900 text-white text-sm focus:outline-none focus:border-indigo-500"
                              value={rsStart}
                              onChange={(e) => setRsStart(e.target.value)}
                            />
                          </label>
                          <label className="flex flex-col gap-1 text-xs text-gray-400">
                            End time
                            <input
                              type="time"
                              className="p-1.5 border border-gray-600 rounded bg-gray-900 text-white text-sm focus:outline-none focus:border-indigo-500"
                              value={rsEnd}
                              onChange={(e) => setRsEnd(e.target.value)}
                            />
                          </label>
                        </div>
                        <div className="flex gap-2">
                          <button
                            className="px-3 py-1.5 bg-indigo-600 rounded text-xs text-white hover:bg-indigo-700"
                            onClick={applyReschedule}
                          >
                            Save
                          </button>
                          <button
                            className="px-3 py-1.5 text-xs text-gray-400 hover:text-white"
                            onClick={() => setReschedule(null)}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Tasks */}
                    <div className="flex flex-col gap-2 ml-1">
                      {block.tasks.map((task, ti) => (
                        <div key={ti} className="border-l-2 border-gray-700 pl-3 py-0.5">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{task.title}</span>
                            <span className="text-xs text-gray-500 bg-gray-800 px-1.5 py-0.5 rounded tabular-nums">
                              {task.estimated_minutes} min
                            </span>
                          </div>
                          <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{task.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
