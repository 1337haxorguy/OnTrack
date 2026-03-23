import { useState } from "react";

const API_BASE = "https://ontrack-sq87.onrender.com";

interface Task {
  title: string;
  description: string;
  estimated_minutes: number;
}

interface TimeBlock {
  label: string;
  start_time: string | null;
  end_time: string | null;
  tasks: Task[];
}

interface DayPlan {
  date: string;
  objective: string;
  time_blocks: TimeBlock[];
}

interface GenerateResponse {
  weekly_tasks: DayPlan[];
}

interface FollowupQuestion {
  question: string;
  user_response: string;
}

const ALL_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;

interface FormData {
  hobby_title: string;
  goals: string[];
  restrictions: string[];
  requests: string[];
  additional_context: string;
  followup_questions: FollowupQuestion[];
  timezone: string;
  start_date: string;
  target_end_date: string;
  week_index: number;
  // Scheduling — user-facing
  hours_per_week: number;
  selected_days: string[];
  has_daily_limit: boolean;
  daily_limit_minutes: number;
  multiple_sessions: boolean;
  sessions_per_day: number;
  prefers_time_blocks: boolean;
}

const defaultForm: FormData = {
  hobby_title: "Guitar Practice",
  goals: ["Learn 8 songs from memory", "Improve barre chord transitions and endurance"],
  restrictions: ["Cannot practice loudly after 21:00", "Occasional wrist soreness"],
  requests: ["Include warm-up and cool-down in each session", "Balance technique drills with song work"],
  additional_context: "Intermediate player with more availability on weekends. Prefers early evenings on weekdays.",
  followup_questions: [
    { question: "What style of music do you primarily want to focus on?", user_response: "I'm interested in fingerstyle acoustic and some classic rock" },
    { question: "Do you have any upcoming performances or deadlines?", user_response: "Yes, I'd like to perform at an open mic night in 2 months" },
  ],
  timezone: "America/New_York",
  start_date: "2026-02-10",
  target_end_date: "2026-03-31",
  week_index: 1,
  hours_per_week: 4,
  selected_days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
  has_daily_limit: false,
  daily_limit_minutes: 90,
  multiple_sessions: false,
  sessions_per_day: 2,
  prefers_time_blocks: true,
};

function deriveAIFields(form: FormData) {
  const days_per_week = form.selected_days.length || 5;
  return {
    days_per_week,
    min_hours_per_week: Math.max(1, form.hours_per_week - 1),
    max_hours_per_week: form.hours_per_week + 1,
    min_intraday_frequency: 1,
    max_intraday_frequency: form.multiple_sessions ? form.sessions_per_day : 1,
    prefers_time_blocks: form.prefers_time_blocks,
  };
}

export default function TestGenerate() {
  const [form, setForm] = useState<FormData>(defaultForm);
  const [response, setResponse] = useState<GenerateResponse | null>(null);
  const [rawJson, setRawJson] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [latency, setLatency] = useState<number | null>(null);
  const [view, setView] = useState<"formatted" | "raw">("formatted");
  const [formCollapsed, setFormCollapsed] = useState(false);

  const callGenerate = async () => {
    setLoading(true);
    setError("");
    setResponse(null);
    setRawJson("");
    setLatency(null);

    const start = performance.now();

    try {
      const ai = deriveAIFields(form);
      const res = await fetch(`${API_BASE}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_profile: {
            hobby_title: form.hobby_title,
            goals: form.goals,
            restrictions: form.restrictions,
            requests: form.requests,
            additional_context: form.additional_context,
            followup_questions: form.followup_questions,
            timezone: form.timezone,
            start_date: form.start_date,
            target_end_date: form.target_end_date,
            ...ai,
          },
          generation_request: { type: "full_plan", week_index: form.week_index },
        }),
      });

      const elapsed = Math.round(performance.now() - start);
      setLatency(elapsed);

      if (!res.ok) {
        const errBody = await res.text();
        throw new Error(`${res.status} ${res.statusText}: ${errBody}`);
      }

      const data = await res.json();
      setRawJson(JSON.stringify(data, null, 2));
      setResponse(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const totalMinutes = response
    ? response.weekly_tasks.reduce(
        (sum, day) =>
          sum +
          day.time_blocks.reduce(
            (bSum, block) =>
              bSum + block.tasks.reduce((tSum, task) => tSum + task.estimated_minutes, 0),
            0
          ),
        0
      )
    : 0;

  return (
    <div className="max-w-4xl mx-auto text-white">
      {/* Header */}
      <nav className="flex items-center justify-between py-4 mb-6 border-b border-gray-700">
        <div>
          <h1 className="text-3xl font-bold">Generate Endpoint Test</h1>
          <p className="text-sm text-gray-500 mt-1">
            POST /api/generate — hardcoded prompt, returns weekly_tasks JSON
          </p>
        </div>
        <a
          href="/"
          className="px-4 py-1.5 text-sm border border-gray-600 rounded bg-gray-800 text-white hover:bg-gray-700"
        >
          Back to App
        </a>
      </nav>

      {/* Form */}
      <section className="mb-6 border border-gray-700 rounded-lg overflow-hidden">
        <button
          onClick={() => setFormCollapsed(!formCollapsed)}
          className="w-full px-4 py-3 bg-gray-900 text-left flex justify-between items-center hover:bg-gray-800"
        >
          <span className="font-semibold text-sm">User Input</span>
          <span className="text-gray-500 text-xs">{formCollapsed ? "Show" : "Hide"}</span>
        </button>

        {!formCollapsed && (
          <div className="p-4 flex flex-col gap-4">
            {/* Hobby title */}
            <label className="flex flex-col gap-1 text-sm text-gray-400">
              Hobby Title
              <input
                className="p-2 border border-gray-600 rounded bg-gray-900 text-white text-sm"
                value={form.hobby_title}
                onChange={(e) => setForm({ ...form, hobby_title: e.target.value })}
              />
            </label>

            {/* Goals list */}
            <fieldset className="flex flex-col gap-2">
              <legend className="text-sm text-gray-400 mb-1">Goals</legend>
              {form.goals.map((g, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    className="flex-1 p-2 border border-gray-600 rounded bg-gray-900 text-white text-sm"
                    value={g}
                    onChange={(e) => {
                      const next = [...form.goals];
                      next[i] = e.target.value;
                      setForm({ ...form, goals: next });
                    }}
                  />
                  {form.goals.length > 1 && (
                    <button
                      className="text-red-400 text-sm px-2"
                      onClick={() => setForm({ ...form, goals: form.goals.filter((_, j) => j !== i) })}
                    >
                      x
                    </button>
                  )}
                </div>
              ))}
              <button
                className="text-xs px-2 py-1 border border-gray-600 rounded bg-gray-800 text-white hover:bg-gray-700 self-start"
                onClick={() => setForm({ ...form, goals: [...form.goals, ""] })}
              >
                + Add goal
              </button>
            </fieldset>

            {/* Restrictions list */}
            <fieldset className="flex flex-col gap-2">
              <legend className="text-sm text-gray-400 mb-1">Restrictions</legend>
              {form.restrictions.map((r, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    className="flex-1 p-2 border border-gray-600 rounded bg-gray-900 text-white text-sm"
                    value={r}
                    onChange={(e) => {
                      const next = [...form.restrictions];
                      next[i] = e.target.value;
                      setForm({ ...form, restrictions: next });
                    }}
                  />
                  <button
                    className="text-red-400 text-sm px-2"
                    onClick={() => setForm({ ...form, restrictions: form.restrictions.filter((_, j) => j !== i) })}
                  >
                    x
                  </button>
                </div>
              ))}
              <button
                className="text-xs px-2 py-1 border border-gray-600 rounded bg-gray-800 text-white hover:bg-gray-700 self-start"
                onClick={() => setForm({ ...form, restrictions: [...form.restrictions, ""] })}
              >
                + Add restriction
              </button>
            </fieldset>

            {/* Requests list */}
            <fieldset className="flex flex-col gap-2">
              <legend className="text-sm text-gray-400 mb-1">Requests</legend>
              {form.requests.map((r, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    className="flex-1 p-2 border border-gray-600 rounded bg-gray-900 text-white text-sm"
                    value={r}
                    onChange={(e) => {
                      const next = [...form.requests];
                      next[i] = e.target.value;
                      setForm({ ...form, requests: next });
                    }}
                  />
                  <button
                    className="text-red-400 text-sm px-2"
                    onClick={() => setForm({ ...form, requests: form.requests.filter((_, j) => j !== i) })}
                  >
                    x
                  </button>
                </div>
              ))}
              <button
                className="text-xs px-2 py-1 border border-gray-600 rounded bg-gray-800 text-white hover:bg-gray-700 self-start"
                onClick={() => setForm({ ...form, requests: [...form.requests, ""] })}
              >
                + Add request
              </button>
            </fieldset>

            {/* Additional context */}
            <label className="flex flex-col gap-1 text-sm text-gray-400">
              Additional Context
              <textarea
                className="p-2 border border-gray-600 rounded bg-gray-900 text-white text-sm min-h-[60px] resize-y"
                value={form.additional_context}
                onChange={(e) => setForm({ ...form, additional_context: e.target.value })}
              />
            </label>

            {/* Followup questions */}
            <fieldset className="flex flex-col gap-2">
              <legend className="text-sm text-gray-400 mb-1">Follow-up Questions</legend>
              {form.followup_questions.map((fq, i) => (
                <div key={i} className="border border-gray-700 rounded p-3 flex flex-col gap-2">
                  <input
                    className="p-2 border border-gray-600 rounded bg-gray-900 text-white text-sm"
                    placeholder="Question"
                    value={fq.question}
                    onChange={(e) => {
                      const next = [...form.followup_questions];
                      next[i] = { ...next[i], question: e.target.value };
                      setForm({ ...form, followup_questions: next });
                    }}
                  />
                  <input
                    className="p-2 border border-gray-600 rounded bg-gray-900 text-white text-sm"
                    placeholder="User response"
                    value={fq.user_response}
                    onChange={(e) => {
                      const next = [...form.followup_questions];
                      next[i] = { ...next[i], user_response: e.target.value };
                      setForm({ ...form, followup_questions: next });
                    }}
                  />
                  <button
                    className="text-red-400 text-xs self-start"
                    onClick={() => setForm({ ...form, followup_questions: form.followup_questions.filter((_, j) => j !== i) })}
                  >
                    Remove
                  </button>
                </div>
              ))}
              <button
                className="text-xs px-2 py-1 border border-gray-600 rounded bg-gray-800 text-white hover:bg-gray-700 self-start"
                onClick={() => setForm({ ...form, followup_questions: [...form.followup_questions, { question: "", user_response: "" }] })}
              >
                + Add question
              </button>
            </fieldset>

            {/* Dates & meta */}
            <div className="grid grid-cols-2 gap-4">
              <label className="flex flex-col gap-1 text-sm text-gray-400">
                Timezone
                <input
                  className="p-2 border border-gray-600 rounded bg-gray-900 text-white text-sm"
                  value={form.timezone}
                  onChange={(e) => setForm({ ...form, timezone: e.target.value })}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm text-gray-400">
                Week Index
                <input
                  type="number"
                  min={1}
                  className="p-2 border border-gray-600 rounded bg-gray-900 text-white text-sm"
                  value={form.week_index}
                  onChange={(e) => setForm({ ...form, week_index: Number(e.target.value) })}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm text-gray-400">
                Start Date
                <input
                  type="date"
                  className="p-2 border border-gray-600 rounded bg-gray-900 text-white text-sm"
                  value={form.start_date}
                  onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm text-gray-400">
                Target End Date
                <input
                  type="date"
                  className="p-2 border border-gray-600 rounded bg-gray-900 text-white text-sm"
                  value={form.target_end_date}
                  onChange={(e) => setForm({ ...form, target_end_date: e.target.value })}
                />
              </label>
            </div>

            {/* --- SCHEDULING --- */}
            <div className="border-t border-gray-700 pt-4 mt-2">
              <h3 className="text-sm font-semibold mb-3">Scheduling</h3>

              {/* Hours per week — the one required question */}
              <label className="flex flex-col gap-2 text-sm text-gray-400 mb-4">
                How many hours per week can you commit?
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={1}
                    max={20}
                    step={1}
                    className="flex-1 accent-indigo-500"
                    value={form.hours_per_week}
                    onChange={(e) => setForm({ ...form, hours_per_week: Number(e.target.value) })}
                  />
                  <span className="text-white font-medium w-16 text-right">{form.hours_per_week} hr{form.hours_per_week !== 1 && "s"}</span>
                </div>
              </label>

              {/* Customize schedule — collapsible */}
              <details className="group">
                <summary className="text-xs text-indigo-400 cursor-pointer hover:text-indigo-300 select-none mb-3">
                  Customize schedule
                </summary>

                <div className="flex flex-col gap-4 pl-2 border-l-2 border-gray-700">
                  {/* Which days */}
                  <fieldset>
                    <legend className="text-sm text-gray-400 mb-2">Which days work for you?</legend>
                    <div className="flex gap-2 flex-wrap">
                      {ALL_DAYS.map((day) => {
                        const selected = form.selected_days.includes(day);
                        return (
                          <button
                            key={day}
                            type="button"
                            onClick={() =>
                              setForm({
                                ...form,
                                selected_days: selected
                                  ? form.selected_days.filter((d) => d !== day)
                                  : [...form.selected_days, day],
                              })
                            }
                            className={`px-3 py-1.5 text-xs rounded border ${
                              selected
                                ? "bg-indigo-600 border-indigo-500 text-white"
                                : "bg-gray-800 border-gray-600 text-gray-400 hover:bg-gray-700"
                            }`}
                          >
                            {day.slice(0, 3)}
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-xs text-gray-600 mt-1">{form.selected_days.length} day{form.selected_days.length !== 1 && "s"} selected</p>
                  </fieldset>

                  {/* Daily limit */}
                  <div>
                    <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
                      <input
                        type="checkbox"
                        className="accent-indigo-500"
                        checked={form.has_daily_limit}
                        onChange={(e) => setForm({ ...form, has_daily_limit: e.target.checked })}
                      />
                      Set a daily time limit
                    </label>
                    {form.has_daily_limit && (
                      <div className="mt-2 flex items-center gap-2 ml-5">
                        <input
                          type="number"
                          min={15}
                          max={480}
                          step={15}
                          className="p-2 border border-gray-600 rounded bg-gray-900 text-white text-sm w-24"
                          value={form.daily_limit_minutes}
                          onChange={(e) => setForm({ ...form, daily_limit_minutes: Number(e.target.value) })}
                        />
                        <span className="text-sm text-gray-500">minutes max per day</span>
                      </div>
                    )}
                  </div>

                  {/* Multiple sessions */}
                  <div>
                    <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
                      <input
                        type="checkbox"
                        className="accent-indigo-500"
                        checked={form.multiple_sessions}
                        onChange={(e) => setForm({ ...form, multiple_sessions: e.target.checked })}
                      />
                      Split into multiple shorter sessions per day
                    </label>
                    {form.multiple_sessions && (
                      <div className="mt-2 flex items-center gap-2 ml-5">
                        <select
                          className="p-2 border border-gray-600 rounded bg-gray-900 text-white text-sm"
                          value={form.sessions_per_day}
                          onChange={(e) => setForm({ ...form, sessions_per_day: Number(e.target.value) })}
                        >
                          <option value={2}>2 sessions</option>
                          <option value={3}>3 sessions</option>
                        </select>
                        <span className="text-sm text-gray-500">per day</span>
                      </div>
                    )}
                  </div>

                  {/* Time blocks preference */}
                  <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
                    <input
                      type="checkbox"
                      className="accent-indigo-500"
                      checked={form.prefers_time_blocks}
                      onChange={(e) => setForm({ ...form, prefers_time_blocks: e.target.checked })}
                    />
                    Include specific start/end times for each block
                  </label>
                </div>
              </details>

              {/* Derived values preview */}
              {(() => {
                const ai = deriveAIFields(form);
                return (
                  <div className="mt-3 text-xs text-gray-600 flex flex-wrap gap-x-4 gap-y-1">
                    <span>days_per_week: {ai.days_per_week}</span>
                    <span>hours: {ai.min_hours_per_week}-{ai.max_hours_per_week}</span>
                    <span>intraday: {ai.min_intraday_frequency}-{ai.max_intraday_frequency}</span>
                    <span>time_blocks: {ai.prefers_time_blocks ? "yes" : "no"}</span>
                  </div>
                );
              })()}
            </div>

            {/* Reset button */}
            <button
              className="text-xs text-gray-500 hover:text-gray-300 self-start"
              onClick={() => setForm(defaultForm)}
            >
              Reset to defaults
            </button>
          </div>
        )}
      </section>

      {/* Fire button */}
      <section className="mb-6">
        <button
          onClick={callGenerate}
          disabled={loading}
          className="w-full py-3 px-8 bg-indigo-600 border border-indigo-600 rounded text-white text-base font-medium hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? "Calling /api/generate..." : "Send Request"}
        </button>
      </section>

      {/* Error */}
      {error && (
        <div className="mb-6 p-4 rounded border border-red-700 bg-red-950 text-red-300 text-sm">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Results */}
      {response && (
        <>
          {/* Stats bar */}
          <div className="flex items-center gap-4 mb-4 text-sm text-gray-400">
            {latency !== null && <span>Latency: {(latency / 1000).toFixed(1)}s</span>}
            <span>{response.weekly_tasks.length} days</span>
            <span>
              {response.weekly_tasks.reduce((s, d) => s + d.time_blocks.length, 0)} time blocks
            </span>
            <span>
              {response.weekly_tasks.reduce(
                (s, d) => s + d.time_blocks.reduce((bs, b) => bs + b.tasks.length, 0),
                0
              )}{" "}
              tasks
            </span>
            <span>{totalMinutes} total min ({(totalMinutes / 60).toFixed(1)} hrs)</span>
          </div>

          {/* View toggle */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setView("formatted")}
              className={`px-3 py-1.5 text-sm rounded ${
                view === "formatted"
                  ? "bg-indigo-600 text-white"
                  : "bg-gray-800 text-gray-400 border border-gray-600 hover:bg-gray-700"
              }`}
            >
              Formatted
            </button>
            <button
              onClick={() => setView("raw")}
              className={`px-3 py-1.5 text-sm rounded ${
                view === "raw"
                  ? "bg-indigo-600 text-white"
                  : "bg-gray-800 text-gray-400 border border-gray-600 hover:bg-gray-700"
              }`}
            >
              Raw JSON
            </button>
          </div>

          {view === "raw" ? (
            <pre className="p-4 rounded border border-gray-700 bg-gray-950 text-green-400 text-xs overflow-x-auto whitespace-pre-wrap max-h-[70vh] overflow-y-auto">
              {rawJson}
            </pre>
          ) : (
            <div className="flex flex-col gap-4">
              {response.weekly_tasks.map((day, di) => (
                <div key={di} className="border border-gray-700 rounded-lg overflow-hidden">
                  {/* Day header */}
                  <div className="px-4 py-3 bg-gray-900 border-b border-gray-700 flex justify-between items-center">
                    <div>
                      <span className="font-semibold">{day.date}</span>
                      <span className="ml-3 text-sm text-gray-400">
                        {new Date(day.date + "T00:00:00").toLocaleDateString("en-US", {
                          weekday: "long",
                        })}
                      </span>
                    </div>
                    <span className="text-xs text-gray-500">
                      {day.time_blocks.length} block{day.time_blocks.length !== 1 && "s"}
                    </span>
                  </div>

                  {/* Objective */}
                  <div className="px-4 py-2 text-sm text-gray-400 bg-gray-900/50 border-b border-gray-800">
                    {day.objective}
                  </div>

                  {/* Time blocks */}
                  <div className="divide-y divide-gray-800">
                    {day.time_blocks.map((block, bi) => (
                      <div key={bi} className="px-4 py-3">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-sm font-medium text-indigo-400">{block.label}</span>
                          {block.start_time && block.end_time && (
                            <span className="text-xs text-gray-500">
                              {block.start_time} - {block.end_time}
                            </span>
                          )}
                        </div>

                        {/* Tasks */}
                        <div className="flex flex-col gap-2 ml-3">
                          {block.tasks.map((task, ti) => (
                            <div
                              key={ti}
                              className="border-l-2 border-gray-700 pl-3 py-1"
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium">{task.title}</span>
                                <span className="text-xs text-gray-500 bg-gray-800 px-1.5 py-0.5 rounded">
                                  {task.estimated_minutes} min
                                </span>
                              </div>
                              <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">
                                {task.description}
                              </p>
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
        </>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="flex flex-col gap-4 animate-pulse">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="border border-gray-700 rounded-lg p-4">
              <div className="h-4 bg-gray-800 rounded w-32 mb-3" />
              <div className="h-3 bg-gray-800 rounded w-full mb-2" />
              <div className="h-3 bg-gray-800 rounded w-3/4 mb-2" />
              <div className="h-3 bg-gray-800 rounded w-1/2" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
