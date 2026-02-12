import { useState, useEffect } from "react";
import { useAuth0 } from "@auth0/auth0-react";

const API_BASE = "http://localhost:3000";

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;

interface TimeSlot {
  start: string;
  end: string;
}

interface Goal {
  id: string;
  title: string;
  description: string;
  skill_level: "beginner" | "intermediate" | "advanced";
  target_outcome: string;
  timeframe: { start_date: string; end_date: string };
}

interface Task {
  goal_id: string;
  date: string;
  start_time: string;
  end_time: string;
  title: string;
  description: string;
  difficulty: string;
  estimated_duration_minutes: number;
}

const emptyGoal = (): Goal => ({
  id: crypto.randomUUID(),
  title: "",
  description: "",
  skill_level: "beginner",
  target_outcome: "",
  timeframe: { start_date: "", end_date: "" },
});

const emptySchedule = (): Record<string, TimeSlot[]> =>
  Object.fromEntries(DAYS.map((d) => [d, []]));

const difficultyStyles: Record<string, string> = {
  easy: "bg-emerald-900 text-emerald-300",
  moderate: "bg-yellow-900 text-yellow-300",
  challenging: "bg-red-900 text-red-300",
};

function App() {
  const [goals, setGoals] = useState<Goal[]>([emptyGoal()]);
  const [timezone, setTimezone] = useState("America/New_York");
  const [schedule, setSchedule] = useState<Record<string, TimeSlot[]>>(emptySchedule());
  const [blockedDates, setBlockedDates] = useState("");
  const [plan, setPlan] = useState<Task[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [regenIndex, setRegenIndex] = useState<number | null>(null);
  const [regenFeedback, setRegenFeedback] = useState("");
  const [regenLoading, setRegenLoading] = useState(false);

  const { user, isAuthenticated, isLoading, loginWithRedirect, logout, getAccessTokenSilently } = useAuth0();

  useEffect(() => {
    if (!isAuthenticated || !user) return;
    const syncUserWithBackend = async () => {
      try {
        const token = await getAccessTokenSilently();
        await fetch(`${API_BASE}/api/sync-user`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ email: user.email }),
        });
      } catch (e) {
        console.error("Failed to sync user:", e);
      }
    };
    syncUserWithBackend();
  }, [isAuthenticated, user, getAccessTokenSilently]);

  const updateGoal = (index: number, field: string, value: string) => {
    setGoals((prev) => {
      const next = [...prev];
      if (field === "start_date" || field === "end_date") {
        next[index] = { ...next[index], timeframe: { ...next[index].timeframe, [field]: value } };
      } else {
        next[index] = { ...next[index], [field]: value } as Goal;
      }
      return next;
    });
  };

  const addSlot = (day: string) => {
    setSchedule((prev) => ({
      ...prev,
      [day]: [...prev[day], { start: "09:00", end: "10:00" }],
    }));
  };

  const removeSlot = (day: string, i: number) => {
    setSchedule((prev) => ({
      ...prev,
      [day]: prev[day].filter((_, idx) => idx !== i),
    }));
  };

  const updateSlot = (day: string, i: number, field: "start" | "end", value: string) => {
    setSchedule((prev) => ({
      ...prev,
      [day]: prev[day].map((s, idx) => (idx === i ? { ...s, [field]: value } : s)),
    }));
  };

  const generate = async () => {
    setLoading(true);
    setError("");
    setPlan(null);
    try {
      const token = await getAccessTokenSilently();
      const res = await fetch(`${API_BASE}/api/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          user_profile: {
            goals,
            availability: {
              timezone,
              weekly_schedule: schedule,
              blocked_dates: blockedDates
                .split(",")
                .map((d) => d.trim())
                .filter(Boolean),
            },
          },
          generation_request: { type: "full_plan", target_date: null, goal_id: null },
          existing_plan: [],
        }),
      });
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const data = await res.json();
      setPlan(data.plan);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const regenerateTask = async (index: number) => {
    if (!plan || !regenFeedback.trim()) return;
    setRegenLoading(true);
    try {
      const token = await getAccessTokenSilently();
      const res = await fetch(`${API_BASE}/api/generate/regenerate-task`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          task: plan[index],
          feedback: regenFeedback,
          user_profile: {
            goals,
            availability: {
              timezone,
              weekly_schedule: schedule,
              blocked_dates: blockedDates.split(",").map((d) => d.trim()).filter(Boolean),
            },
          },
        }),
      });
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const data = await res.json();
      setPlan((prev) => prev!.map((t, i) => (i === index ? data.task : t)));
      setRegenIndex(null);
      setRegenFeedback("");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to regenerate task");
    } finally {
      setRegenLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto text-white">
      {/* NAVBAR */}
      <nav className="flex items-center justify-between py-4 mb-6 border-b border-gray-700">
        <h1 className="text-3xl font-bold">OnTrack</h1>
        <div className="flex items-center gap-3">
          {isLoading ? (
            <span className="text-sm text-gray-400">Loading...</span>
          ) : isAuthenticated && user ? (
            <>
              <span className="text-sm text-gray-400">{user.name || user.email}</span>
              <button
                onClick={() => logout({ logoutParams: { returnTo: window.location.origin } })}
                className="px-4 py-1.5 text-sm border border-gray-600 rounded bg-gray-800 text-white hover:bg-gray-700"
              >
                Log out
              </button>
            </>
          ) : (
            <button
              onClick={() => loginWithRedirect()}
              className="px-4 py-1.5 text-sm bg-indigo-600 rounded text-white hover:bg-indigo-700"
            >
              Log in
            </button>
          )}
        </div>
      </nav>

      {/* GOALS */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">Goals</h2>
        {goals.map((goal, gi) => (
          <div key={goal.id} className="border border-gray-700 rounded-lg p-4 mb-3 flex flex-col gap-2">
            <input className="p-2 border border-gray-600 rounded bg-gray-900 text-white text-sm w-full" placeholder="Goal title" value={goal.title} onChange={(e) => updateGoal(gi, "title", e.target.value)} />
            <textarea className="p-2 border border-gray-600 rounded bg-gray-900 text-white text-sm w-full min-h-[60px] resize-y" placeholder="Description" value={goal.description} onChange={(e) => updateGoal(gi, "description", e.target.value)} />
            <select className="p-2 border border-gray-600 rounded bg-gray-900 text-white text-sm w-full" value={goal.skill_level} onChange={(e) => updateGoal(gi, "skill_level", e.target.value)}>
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
            <input className="p-2 border border-gray-600 rounded bg-gray-900 text-white text-sm w-full" placeholder="Target outcome" value={goal.target_outcome} onChange={(e) => updateGoal(gi, "target_outcome", e.target.value)} />
            <div className="flex gap-4">
              <label className="flex-1 flex flex-col gap-1 text-sm text-gray-400">
                Start
                <input className="p-2 border border-gray-600 rounded bg-gray-900 text-white text-sm" type="date" value={goal.timeframe.start_date} onChange={(e) => updateGoal(gi, "start_date", e.target.value)} />
              </label>
              <label className="flex-1 flex flex-col gap-1 text-sm text-gray-400">
                End
                <input className="p-2 border border-gray-600 rounded bg-gray-900 text-white text-sm" type="date" value={goal.timeframe.end_date} onChange={(e) => updateGoal(gi, "end_date", e.target.value)} />
              </label>
            </div>
            {goals.length > 1 && (
              <button className="text-red-400 text-sm p-1 self-start" onClick={() => setGoals((prev) => prev.filter((_, i) => i !== gi))}>
                Remove goal
              </button>
            )}
          </div>
        ))}
        <button className="px-4 py-2 border border-gray-600 rounded bg-gray-800 text-white text-sm hover:bg-gray-700" onClick={() => setGoals((prev) => [...prev, emptyGoal()])}>+ Add goal</button>
      </section>

      {/* AVAILABILITY */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">Availability</h2>
        <label className="flex flex-col gap-1 text-sm text-gray-400 mb-4">
          Timezone
          <input className="p-2 border border-gray-600 rounded bg-gray-900 text-white text-sm" value={timezone} onChange={(e) => setTimezone(e.target.value)} />
        </label>

        <div className="flex flex-col gap-2 mb-4">
          {DAYS.map((day) => (
            <div key={day} className="flex items-center gap-2 flex-wrap">
              <strong className="w-24 capitalize text-sm">{day}</strong>
              {schedule[day].map((slot, i) => (
                <div key={i} className="flex items-center gap-1">
                  <input className="p-2 border border-gray-600 rounded bg-gray-900 text-white text-sm w-28" type="time" value={slot.start} onChange={(e) => updateSlot(day, i, "start", e.target.value)} />
                  <span className="text-sm text-gray-500">to</span>
                  <input className="p-2 border border-gray-600 rounded bg-gray-900 text-white text-sm w-28" type="time" value={slot.end} onChange={(e) => updateSlot(day, i, "end", e.target.value)} />
                  <button className="text-red-400 text-sm px-2" onClick={() => removeSlot(day, i)}>x</button>
                </div>
              ))}
              <button className="text-xs px-2 py-1 border border-gray-600 rounded bg-gray-800 text-white hover:bg-gray-700" onClick={() => addSlot(day)}>+ slot</button>
            </div>
          ))}
        </div>

        <label className="flex flex-col gap-1 text-sm text-gray-400">
          Blocked dates <span className="text-xs text-gray-600">(comma-separated, e.g. 2026-02-16, 2026-03-09)</span>
          <input className="p-2 border border-gray-600 rounded bg-gray-900 text-white text-sm" value={blockedDates} onChange={(e) => setBlockedDates(e.target.value)} placeholder="2026-02-16, 2026-03-09" />
        </label>
      </section>

      {/* GENERATE */}
      <section className="mb-8">
        <button className="w-full py-3 px-8 bg-indigo-600 border border-indigo-600 rounded text-white text-base hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed" onClick={generate} disabled={loading}>
          {loading ? "Generating..." : "Generate Plan"}
        </button>
        {error && <p className="text-red-400 mt-2">{error}</p>}
      </section>

      {/* PLAN OUTPUT */}
      {plan && (
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">Your Plan</h2>
          <div className="flex flex-col gap-3">
            {plan.map((task, i) => (
              <div key={i} className="border border-gray-700 rounded-lg p-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-gray-400">{task.date}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full uppercase font-semibold ${difficultyStyles[task.difficulty] || ""}`}>{task.difficulty}</span>
                </div>
                <h3 className="text-base font-semibold mb-1">{task.title}</h3>
                <p className="text-sm text-gray-500 mb-2">
                  {task.start_time} – {task.end_time} ({task.estimated_duration_minutes} min)
                </p>
                <p className="text-sm leading-relaxed">{task.description}</p>

                {regenIndex === i ? (
                  <div className="mt-3 flex flex-col gap-2">
                    <textarea
                      className="p-2 border border-gray-600 rounded bg-gray-900 text-white text-sm w-full min-h-[60px] resize-y"
                      placeholder="What would you like changed about this task?"
                      value={regenFeedback}
                      onChange={(e) => setRegenFeedback(e.target.value)}
                    />
                    <div className="flex gap-2">
                      <button
                        className="px-3 py-1.5 bg-indigo-600 rounded text-sm text-white hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed"
                        onClick={() => regenerateTask(i)}
                        disabled={regenLoading || !regenFeedback.trim()}
                      >
                        {regenLoading ? "Regenerating..." : "Submit"}
                      </button>
                      <button
                        className="px-3 py-1.5 text-sm text-gray-400 hover:text-white"
                        onClick={() => { setRegenIndex(null); setRegenFeedback(""); }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    className="mt-2 text-sm text-indigo-400 hover:text-indigo-300"
                    onClick={() => { setRegenIndex(i); setRegenFeedback(""); }}
                  >
                    Regenerate task
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export default App;
