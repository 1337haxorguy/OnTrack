import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useApp, DAYS } from "../context/AppContext";
import { useAuth0 } from "@auth0/auth0-react";
import type { Goal, FollowupQuestion, DayPlan } from "../context/AppContext";

const API_BASE = "http://localhost:3000";

const fmt = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const emptyGoal = (): Omit<Goal, "id"> => {
  const today = new Date();
  const future = new Date();
  future.setDate(today.getDate() + 30);
  return {
    title: "",
    skill_level: "beginner",
    timeframe: { start_date: fmt(today), end_date: fmt(future) },
    restrictions: [],
    requests: [],
    additional_context: "",
    followup_questions: [],
    hours_per_week: 4,
    has_daily_limit: false,
    daily_limit_minutes: 60,
    selected_days: [],
  };
};

const TEMPLATES: Array<{ title: string; hours_per_week: number }> = [
  { title: "Learn guitar", hours_per_week: 4 },
  { title: "Run a 5K", hours_per_week: 3 },
  { title: "Learn Spanish", hours_per_week: 5 },
  { title: "Build a morning routine", hours_per_week: 2 },
  { title: "Learn to cook", hours_per_week: 3 },
  { title: "Get stronger at the gym", hours_per_week: 4 },
  { title: "Learn to draw", hours_per_week: 3 },
  { title: "Start meditating", hours_per_week: 2 },
];

const SKILL_LEVELS: Array<{ value: Goal["skill_level"]; label: string; desc: string }> = [
  { value: "beginner",     label: "Beginner",     desc: "Just starting out" },
  { value: "intermediate", label: "Intermediate", desc: "Some experience"   },
  { value: "advanced",     label: "Advanced",     desc: "Well practised"    },
];

const inputCls =
  "px-3 py-2.5 border border-gray-700 rounded-lg bg-gray-900 text-white text-sm w-full " +
  "focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 " +
  "transition-colors placeholder:text-gray-600";

const cardCls = "rounded-xl border border-gray-800 bg-gray-900/40 p-5 flex flex-col gap-5";
const fieldLabel = "text-xs font-medium text-gray-400";
const fieldHint  = "text-xs text-gray-600 -mt-3";

const STEP_LABELS = ["Your goal", "Time", "Personalise"];

// ---- Shared sub-components ----

function SkillLevelPicker({ value, onChange }: { value: Goal["skill_level"]; onChange: (v: Goal["skill_level"]) => void }) {
  return (
    <div className="flex flex-col gap-2">
      <label className={fieldLabel}>Your current level</label>
      <div className="grid grid-cols-3 gap-2">
        {SKILL_LEVELS.map(({ value: v, label, desc }) => (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            className={`flex flex-col items-start px-3 py-2.5 rounded-lg border text-left transition-all ${
              value === v
                ? "border-indigo-500 bg-indigo-600/15 text-white"
                : "border-gray-700 bg-gray-900 text-gray-400 hover:border-gray-600 hover:text-gray-300"
            }`}
          >
            <span className="text-sm font-medium">{label}</span>
            <span className="text-xs opacity-60 mt-0.5">{desc}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function DateRangePicker({
  start, end, onStart, onEnd,
}: {
  start: string; end: string;
  onStart: (v: string) => void; onEnd: (v: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="flex flex-col gap-1.5">
        <label className={fieldLabel}>Start date</label>
        <input type="date" className={inputCls} value={start} onChange={(e) => onStart(e.target.value)} />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className={fieldLabel}>End date</label>
        <input type="date" className={inputCls} value={end} onChange={(e) => onEnd(e.target.value)} />
      </div>
    </div>
  );
}

function TimeCommitmentSection({
  form, patch,
}: {
  form: Omit<Goal, "id">;
  patch: (u: Partial<Omit<Goal, "id">>) => void;
}) {
  const toggleDay = (day: string) =>
    patch({
      selected_days: form.selected_days.includes(day)
        ? form.selected_days.filter((d) => d !== day)
        : [...form.selected_days, day],
    });

  return (
    <>
      {/* Hours per week */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <label className={fieldLabel}>Hours per week</label>
          <span className="text-sm font-semibold text-white tabular-nums">
            {form.hours_per_week} hr{form.hours_per_week !== 1 && "s"}
          </span>
        </div>
        <input
          type="range" min={1} max={20} step={1}
          className="w-full accent-indigo-500 cursor-pointer h-1.5"
          value={form.hours_per_week}
          onChange={(e) => patch({ hours_per_week: Number(e.target.value) })}
        />
        <div className="flex justify-between text-xs text-gray-700">
          <span>1 hr</span><span>20 hrs</span>
        </div>
      </div>

      {/* Preferred days */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <label className={fieldLabel}>Preferred days</label>
          <span className="text-xs text-gray-600">
            {form.selected_days.length === 0 ? "AI decides" : `${form.selected_days.length} selected`}
          </span>
        </div>
        <div className="flex gap-1.5">
          {DAYS.map((day) => {
            const active = form.selected_days.includes(day);
            const abbr = day.slice(0, 1).toUpperCase() + day.slice(1, 2);
            return (
              <button
                key={day}
                type="button"
                onClick={() => toggleDay(day)}
                className={`flex-1 py-2 text-xs font-medium rounded-lg border transition-all ${
                  active
                    ? "bg-indigo-600 border-indigo-500 text-white"
                    : "bg-gray-900 border-gray-700 text-gray-500 hover:border-gray-600 hover:text-gray-300"
                }`}
              >
                {abbr}
              </button>
            );
          })}
        </div>
      </div>

      {/* Daily limit */}
      <div className="flex flex-col gap-3">
        <label className="flex items-center gap-3 cursor-pointer">
          <button
            type="button"
            role="switch"
            aria-checked={form.has_daily_limit}
            onClick={() => patch({ has_daily_limit: !form.has_daily_limit })}
            className={`relative w-9 h-5 rounded-full transition-colors shrink-0 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 ${
              form.has_daily_limit ? "bg-indigo-600" : "bg-gray-700"
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                form.has_daily_limit ? "translate-x-4" : "translate-x-0"
              }`}
            />
          </button>
          <span className="text-sm text-gray-300">Daily time limit</span>
        </label>
        {form.has_daily_limit && (
          <div className="flex items-center gap-3 ml-12">
            <input
              type="number" min={15} max={480} step={15}
              className="px-3 py-2 border border-gray-700 rounded-lg bg-gray-900 text-white text-sm w-24 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition-colors"
              value={form.daily_limit_minutes}
              onChange={(e) => patch({ daily_limit_minutes: Number(e.target.value) })}
            />
            <span className="text-sm text-gray-500">minutes per day</span>
          </div>
        )}
      </div>
    </>
  );
}

function AdditionalContextSection({
  form, patch, newRestriction, setNewRestriction, newRequest, setNewRequest,
}: {
  form: Omit<Goal, "id">;
  patch: (u: Partial<Omit<Goal, "id">>) => void;
  newRestriction: string; setNewRestriction: (v: string) => void;
  newRequest: string; setNewRequest: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const hasData = form.restrictions.length > 0 || form.requests.length > 0 || !!form.additional_context;

  const addRestriction = () => {
    if (!newRestriction.trim()) return;
    patch({ restrictions: [...form.restrictions, newRestriction.trim()] });
    setNewRestriction("");
  };
  const addRequest = () => {
    if (!newRequest.trim()) return;
    patch({ requests: [...form.requests, newRequest.trim()] });
    setNewRequest("");
  };

  return (
    <section className={cardCls}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center justify-between w-full text-left group"
      >
        <div>
          <h2 className="text-sm font-semibold text-white">
            Additional context
            {hasData && (
              <span className="ml-2 text-xs font-normal text-indigo-400">
                {[
                  form.restrictions.length > 0 && `${form.restrictions.length} restriction${form.restrictions.length !== 1 ? "s" : ""}`,
                  form.requests.length > 0 && `${form.requests.length} request${form.requests.length !== 1 ? "s" : ""}`,
                  form.additional_context && "context",
                ].filter(Boolean).join(" · ")}
              </span>
            )}
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">Injuries, noise limits, specific requests — optional</p>
        </div>
        <span className={`text-gray-500 group-hover:text-gray-300 transition-all duration-200 ${open ? "rotate-180" : ""}`}>
          <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
            <path fillRule="evenodd" clipRule="evenodd" d="M3.47 5.47a.75.75 0 0 1 1.06 0L8 8.94l3.47-3.47a.75.75 0 1 1 1.06 1.06l-4 4a.75.75 0 0 1-1.06 0l-4-4a.75.75 0 0 1 0-1.06z" />
          </svg>
        </span>
      </button>

      {open && (
        <div className="flex flex-col gap-5">
          {/* Restrictions */}
          <div className="flex flex-col gap-2">
            <label className={fieldLabel}>Restrictions</label>
            <p className={fieldHint}>Injuries, noise limits, equipment constraints</p>
            {form.restrictions.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {form.restrictions.map((r, i) => (
                  <span key={i} className="inline-flex items-center gap-1 text-xs bg-gray-800 border border-gray-700 rounded-full pl-3 pr-1.5 py-1 text-gray-300">
                    {r}
                    <button
                      onClick={() => patch({ restrictions: form.restrictions.filter((_, j) => j !== i) })}
                      className="w-4 h-4 flex items-center justify-center rounded-full text-gray-500 hover:text-white hover:bg-gray-600 transition-colors"
                    >×</button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input
                className={inputCls}
                placeholder="e.g. Wrist soreness, no loud practice after 10pm"
                value={newRestriction}
                onChange={(e) => setNewRestriction(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addRestriction()}
              />
              <button
                onClick={addRestriction}
                disabled={!newRestriction.trim()}
                className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >Add</button>
            </div>
          </div>

          {/* Requests */}
          <div className="flex flex-col gap-2">
            <label className={fieldLabel}>Requests</label>
            <p className={fieldHint}>Things you always want included in your sessions</p>
            {form.requests.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {form.requests.map((r, i) => (
                  <span key={i} className="inline-flex items-center gap-1 text-xs bg-gray-800 border border-gray-700 rounded-full pl-3 pr-1.5 py-1 text-gray-300">
                    {r}
                    <button
                      onClick={() => patch({ requests: form.requests.filter((_, j) => j !== i) })}
                      className="w-4 h-4 flex items-center justify-center rounded-full text-gray-500 hover:text-white hover:bg-gray-600 transition-colors"
                    >×</button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input
                className={inputCls}
                placeholder="e.g. Always include a warm-up, balance theory with practice"
                value={newRequest}
                onChange={(e) => setNewRequest(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addRequest()}
              />
              <button
                onClick={addRequest}
                disabled={!newRequest.trim()}
                className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >Add</button>
            </div>
          </div>

          {/* Background context */}
          <div className="flex flex-col gap-2">
            <label className={fieldLabel}>Background & context</label>
            <p className={fieldHint}>Current level, deadlines, sub-goals — anything that should shape your plan</p>
            <textarea
              className={`${inputCls} min-h-[100px] resize-y`}
              placeholder="e.g. I know basic open chords and can play simple songs. I want to perform at an open mic in 2 months."
              value={form.additional_context}
              onChange={(e) => patch({ additional_context: e.target.value })}
            />
          </div>
        </div>
      )}
    </section>
  );
}

// ============================================================
// Main component
// ============================================================

export default function CreateGoal() {
  const { goals, setGoals, schedule, setPlan } = useApp();
  const { isAuthenticated, getAccessTokenSilently } = useAuth0();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = !!id;

  const [form, setForm]                     = useState<Omit<Goal, "id">>(emptyGoal());
  const [step, setStep]                     = useState<1 | 2 | 3>(1);
  const [newRestriction, setNewRestriction] = useState("");
  const [newRequest, setNewRequest]         = useState("");
  const [qLoading, setQLoading]             = useState(false);
  const [qError, setQError]                 = useState("");
  const [titleError, setTitleError]         = useState("");
  const [saveLoading, setSaveLoading]       = useState(false);
  const [saveError, setSaveError]           = useState("");
  const [generating, setGenerating]         = useState(false);
  const [generateError, setGenerateError]   = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (id) {
      const existing = goals.find((g) => g.id === id);
      if (existing) {
        const { id: _, ...rest } = existing;
        setForm(rest);
      }
    }
  }, [id, goals]);

  const patch = (update: Partial<Omit<Goal, "id">>) =>
    setForm((prev) => ({ ...prev, ...update }));

  // ---- Question generation ----

  const generateQuestions = async (titleOverride?: string) => {
    const title = titleOverride ?? form.title;
    if (!title.trim()) return;
    setQLoading(true);
    setQError("");
    try {
      const res = await fetch(`${API_BASE}/api/generate/followup-questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          skill_level: form.skill_level,
          restrictions: form.restrictions,
          requests: form.requests,
          additional_context: form.additional_context,
        }),
      });
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const data = await res.json();
      const newQs: FollowupQuestion[] = (data.questions || []).map((q: { question: string }) => ({
        question: q.question,
        user_response: "",
      }));
      patch({ followup_questions: newQs });
    } catch (e: unknown) {
      setQError(e instanceof Error ? e.message : "Failed to generate questions");
    } finally {
      setQLoading(false);
    }
  };

  const handleTitleBlur = () => {
    if (form.title.trim().length > 2 && !qLoading && form.followup_questions.length === 0) {
      generateQuestions();
    }
  };

  const applyTemplate = (t: typeof TEMPLATES[number]) => {
    patch({ title: t.title, hours_per_week: t.hours_per_week });
    generateQuestions(t.title);
  };

  const updateAnswer = (i: number, answer: string) => {
    patch({
      followup_questions: form.followup_questions.map((fq, j) =>
        j === i ? { ...fq, user_response: answer } : fq
      ),
    });
  };

  // ---- Plan generation ----

  const hasSchedule = Object.values(schedule.free_slots).some((slots) => slots.length > 0);

  const generatePlan = async (allGoals: Goal[]) => {
    setGenerating(true);
    setGenerateError("");
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (isAuthenticated) {
        const token = await getAccessTokenSilently().catch(() => null);
        if (token) headers["Authorization"] = `Bearer ${token}`;
      }
      const totalHours = allGoals.reduce((s, g) => s + g.hours_per_week, 0);
      const res = await fetch(`${API_BASE}/api/generate`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          goals: allGoals,
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
      navigate("/calendar");
    } catch (e: unknown) {
      setGenerateError(e instanceof Error ? e.message : "Failed to generate plan");
      setGenerating(false);
    }
  };

  // ---- Save handlers ----

  // For new goals: validate → save → generate → navigate to /calendar
  const handleGenerate = async () => {
    if (!form.title.trim()) return;
    setSaveLoading(true);
    setTitleError("");
    try {
      const res = await fetch(`${API_BASE}/api/generate/validate-goal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: form.title }),
      });
      const data = await res.json();
      if (!data.valid) {
        setGenerateError(data.reason || "That doesn't look like a valid goal. Please be more specific.");
        setSaveLoading(false);
        return;
      }
    } catch {
      // allow on network error
    } finally {
      setSaveLoading(false);
    }

    const cleanedForm = {
      ...form,
      followup_questions: form.followup_questions.filter((fq) => fq.user_response.trim()),
    };
    const newGoal = { ...cleanedForm, id: crypto.randomUUID() };
    const updatedGoals = [...goals, newGoal];
    setGoals(updatedGoals);
    await generatePlan(updatedGoals);
  };

  // For edit mode: validate → save → navigate to /
  const handleEditSave = async () => {
    if (!form.title.trim()) return;
    setSaveLoading(true);
    setSaveError("");
    try {
      const res = await fetch(`${API_BASE}/api/generate/validate-goal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: form.title }),
      });
      const data = await res.json();
      if (!data.valid) {
        setSaveError(data.reason || "That doesn't look like a valid goal. Please be more specific.");
        return;
      }
    } catch {
      // allow on network error
    } finally {
      setSaveLoading(false);
    }
    if (id) {
      setGoals((prev) => prev.map((g) => (g.id === id ? { ...form, id } : g)));
      navigate("/");
    }
  };

  const deleteGoal = () => {
    if (!id) return;
    setGoals((prev) => prev.filter((g) => g.id !== id));
    navigate("/");
  };

  // ============================================================
  // Edit mode — single-page form
  // ============================================================

  if (isEditing) {
    return (
      <div className="max-w-2xl pb-20">
        <div className="flex items-center gap-2 mb-8 text-sm">
          <button onClick={() => navigate("/")} className="text-gray-500 hover:text-white transition-colors">
            ← Goals
          </button>
          <span className="text-gray-700">/</span>
          <span className="text-gray-300 font-medium">Edit goal</span>
        </div>

        <div className="flex flex-col gap-4">
          {/* Goal details */}
          <section className={cardCls}>
            <h2 className="text-sm font-semibold text-white">Goal details</h2>
            <div className="flex flex-col gap-1.5">
              <label className={fieldLabel}>What do you want to achieve?</label>
              <input
                className={`${inputCls} ${saveError ? "border-red-500/70 focus:border-red-500 focus:ring-red-500/30" : ""}`}
                placeholder="e.g. Learn fingerstyle guitar, Run a 5K"
                value={form.title}
                autoFocus
                onChange={(e) => { patch({ title: e.target.value }); if (saveError) setSaveError(""); }}
              />
              {saveError && (
                <p className="text-xs text-red-400 flex items-center gap-1.5">
                  <svg className="w-3 h-3 shrink-0" viewBox="0 0 12 12" fill="currentColor">
                    <path d="M6 0a6 6 0 1 0 0 12A6 6 0 0 0 6 0zm.75 9H5.25V7.5h1.5V9zm0-3H5.25V3h1.5v3z" />
                  </svg>
                  {saveError}
                </p>
              )}
            </div>
            <SkillLevelPicker value={form.skill_level} onChange={(v) => patch({ skill_level: v })} />
            <DateRangePicker
              start={form.timeframe.start_date}
              end={form.timeframe.end_date}
              onStart={(v) => patch({ timeframe: { ...form.timeframe, start_date: v } })}
              onEnd={(v) => patch({ timeframe: { ...form.timeframe, end_date: v } })}
            />
          </section>

          {/* Time commitment */}
          <section className={cardCls}>
            <h2 className="text-sm font-semibold text-white">Time commitment</h2>
            <TimeCommitmentSection form={form} patch={patch} />
          </section>

          {/* Personalisation questions */}
          {form.followup_questions.length > 0 && (
            <section className={cardCls}>
              <h2 className="text-sm font-semibold text-white">Personalisation</h2>
              <div className="flex flex-col gap-4">
                {form.followup_questions.map((fq, i) => (
                  <div key={i} className="flex flex-col gap-1.5">
                    <label className={fieldLabel}>{fq.question}</label>
                    <input
                      className={inputCls}
                      placeholder="Your answer…"
                      value={fq.user_response}
                      onChange={(e) => updateAnswer(i, e.target.value)}
                    />
                  </div>
                ))}
              </div>
            </section>
          )}

          <AdditionalContextSection
            form={form} patch={patch}
            newRestriction={newRestriction} setNewRestriction={setNewRestriction}
            newRequest={newRequest} setNewRequest={setNewRequest}
          />

          {/* Actions */}
          <div className="flex items-center gap-3 pt-1">
            <button
              className="flex-1 py-2.5 bg-indigo-600 rounded-lg text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              onClick={handleEditSave}
              disabled={!form.title.trim() || saveLoading}
            >
              {saveLoading ? "Checking…" : "Save changes"}
            </button>

            {showDeleteConfirm ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400 whitespace-nowrap">Are you sure?</span>
                <button
                  className="px-3 py-2.5 bg-red-900/40 border border-red-800 rounded-lg text-red-400 text-sm hover:bg-red-900/60 transition-colors"
                  onClick={deleteGoal}
                >Delete</button>
                <button
                  className="px-3 py-2.5 text-sm text-gray-500 hover:text-white transition-colors"
                  onClick={() => setShowDeleteConfirm(false)}
                >Cancel</button>
              </div>
            ) : (
              <button
                className="px-4 py-2.5 border border-gray-700 rounded-lg text-gray-400 text-sm hover:border-red-800/70 hover:text-red-400 transition-colors"
                onClick={() => setShowDeleteConfirm(true)}
              >Delete</button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ============================================================
  // New goal — 3-step wizard
  // ============================================================

  return (
    <div className="max-w-2xl pb-20">

      {/* Header */}
      <div className="flex items-center gap-2 mb-6 text-sm">
        <button
          onClick={() => step > 1 ? setStep((s) => (s - 1) as 1 | 2 | 3) : navigate("/")}
          className="text-gray-500 hover:text-white transition-colors"
        >
          ←
        </button>
        <span className="text-gray-700">/</span>
        <span className="text-gray-300 font-medium">New goal</span>
      </div>

      {/* Step progress bar */}
      <div className="flex items-center gap-1 mb-8">
        {STEP_LABELS.map((label, i) => {
          const s = (i + 1) as 1 | 2 | 3;
          const isCurrent = s === step;
          const isDone = s < step;
          return (
            <div key={s} className="flex items-center gap-1 flex-1 last:flex-none">
              <div className="flex items-center gap-1.5 min-w-0">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 transition-colors ${
                    isCurrent
                      ? "bg-indigo-600 text-white"
                      : isDone
                      ? "bg-indigo-900/60 text-indigo-400 border border-indigo-700/60"
                      : "bg-gray-800 text-gray-600 border border-gray-700"
                  }`}
                >
                  {isDone ? (
                    <svg className="w-3.5 h-3.5" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path d="M2.5 7l3 3 6-6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : s}
                </div>
                <span
                  className={`text-xs font-medium truncate ${
                    isCurrent ? "text-white" : isDone ? "text-indigo-400" : "text-gray-600"
                  }`}
                >
                  {label}
                </span>
              </div>
              {i < STEP_LABELS.length - 1 && (
                <div className={`h-px flex-1 mx-1 ${s < step ? "bg-indigo-700/60" : "bg-gray-800"}`} />
              )}
            </div>
          );
        })}
      </div>

      {/* ---- Step 1: Your Goal ---- */}
      {step === 1 && (
        <div className="flex flex-col gap-4">
          <section className={cardCls}>
            <div>
              <h2 className="text-sm font-semibold text-white mb-1">What do you want to achieve?</h2>
              <p className="text-xs text-gray-500">Be specific — the more detail, the better your plan.</p>
            </div>

            {/* Templates */}
            <div className="flex flex-col gap-2">
              <p className="text-xs text-gray-500">Start from a template</p>
              <div className="flex flex-wrap gap-2">
                {TEMPLATES.map((t) => (
                  <button
                    key={t.title}
                    type="button"
                    onClick={() => applyTemplate(t)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                      form.title === t.title
                        ? "bg-indigo-600/20 border-indigo-500/60 text-indigo-300"
                        : "bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200"
                    }`}
                  >
                    {t.title}
                  </button>
                ))}
              </div>
            </div>

            {/* Title */}
            <div className="flex flex-col gap-1.5">
              <label className={fieldLabel}>Or describe your own goal</label>
              <input
                className={`${inputCls} ${titleError ? "border-red-500/70 focus:border-red-500 focus:ring-red-500/30" : ""}`}
                placeholder="e.g. Learn fingerstyle guitar, Run a 5K, Build a morning routine"
                value={form.title}
                autoFocus
                onChange={(e) => { patch({ title: e.target.value }); if (titleError) setTitleError(""); }}
                onBlur={handleTitleBlur}
              />
              {titleError && (
                <p className="text-xs text-red-400 flex items-center gap-1.5">
                  <svg className="w-3 h-3 shrink-0" viewBox="0 0 12 12" fill="currentColor">
                    <path d="M6 0a6 6 0 1 0 0 12A6 6 0 0 0 6 0zm.75 9H5.25V7.5h1.5V9zm0-3H5.25V3h1.5v3z" />
                  </svg>
                  {titleError}
                </p>
              )}
            </div>

            <SkillLevelPicker value={form.skill_level} onChange={(v) => patch({ skill_level: v })} />

            <DateRangePicker
              start={form.timeframe.start_date}
              end={form.timeframe.end_date}
              onStart={(v) => patch({ timeframe: { ...form.timeframe, start_date: v } })}
              onEnd={(v) => patch({ timeframe: { ...form.timeframe, end_date: v } })}
            />
          </section>

          <div className="flex justify-end">
            <button
              className="px-6 py-2.5 bg-indigo-600 rounded-lg text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              disabled={!form.title.trim()}
              onClick={() => setStep(2)}
            >
              Next →
            </button>
          </div>
        </div>
      )}

      {/* ---- Step 2: Time commitment ---- */}
      {step === 2 && (
        <div className="flex flex-col gap-4">
          <section className={cardCls}>
            <h2 className="text-sm font-semibold text-white">Time commitment</h2>
            <TimeCommitmentSection form={form} patch={patch} />
          </section>

          <div className="flex justify-between">
            <button onClick={() => setStep(1)} className="px-4 py-2.5 text-sm text-gray-500 hover:text-white transition-colors">
              ← Back
            </button>
            <button
              onClick={() => setStep(3)}
              className="px-6 py-2.5 bg-indigo-600 rounded-lg text-white text-sm font-medium hover:bg-indigo-700 transition-colors"
            >
              Next →
            </button>
          </div>
        </div>
      )}

      {/* ---- Step 3: Personalise + Generate ---- */}
      {step === 3 && (
        <div className="flex flex-col gap-4">

          {/* Personalisation questions */}
          <section className={cardCls}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-white mb-1">Personalisation questions</h2>
                <p className="text-xs text-gray-500">
                  {form.title.trim()
                    ? "AI questions based on your goal. All optional — answer what you can."
                    : "Enter a goal title first."}
                </p>
              </div>
              {form.title.trim() && (
                <button
                  className="shrink-0 flex items-center gap-1.5 text-xs px-3 py-1.5 bg-indigo-600/20 border border-indigo-600/40 rounded-lg text-indigo-400 hover:bg-indigo-600/30 hover:text-indigo-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  onClick={() => generateQuestions()}
                  disabled={qLoading}
                >
                  {qLoading ? (
                    <>
                      <span className="w-3 h-3 border border-indigo-400 border-t-transparent rounded-full animate-spin" />
                      Generating…
                    </>
                  ) : form.followup_questions.length > 0 ? "Regenerate" : "Generate"}
                </button>
              )}
            </div>

            {qLoading && form.followup_questions.length === 0 && (
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span className="w-3 h-3 border border-gray-500 border-t-transparent rounded-full animate-spin" />
                Generating personalised questions…
              </div>
            )}

            {qError && <p className="text-xs text-red-400">{qError}</p>}

            {form.followup_questions.length > 0 && (
              <div className="flex flex-col gap-4">
                {form.followup_questions.map((fq, i) => (
                  <div key={i} className="flex flex-col gap-1.5">
                    <label className={fieldLabel}>{fq.question}</label>
                    <input
                      className={inputCls}
                      placeholder="Your answer… (optional)"
                      value={fq.user_response}
                      onChange={(e) => updateAnswer(i, e.target.value)}
                    />
                  </div>
                ))}
              </div>
            )}

            {form.followup_questions.length === 0 && !qLoading && !qError && (
              <p className="text-xs text-gray-600 italic">
                Questions are generated automatically when you enter your goal title, or click "Generate" above.
              </p>
            )}
          </section>

          <AdditionalContextSection
            form={form} patch={patch}
            newRestriction={newRestriction} setNewRestriction={setNewRestriction}
            newRequest={newRequest} setNewRequest={setNewRequest}
          />

          {/* Schedule warning */}
          {!hasSchedule && (
            <div className="flex items-start gap-3 px-4 py-3 rounded-lg border border-amber-700/50 bg-amber-900/20 text-amber-300/80 text-xs leading-relaxed">
              <svg className="w-4 h-4 shrink-0 mt-0.5" viewBox="0 0 16 16" fill="currentColor">
                <path fillRule="evenodd" d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zM0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8zm8-3.5a.75.75 0 0 1 .75.75v4a.75.75 0 0 1-1.5 0v-4A.75.75 0 0 1 8 4.5zm0 7.25a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5z" />
              </svg>
              <div>
                You haven&apos;t set your availability yet — tasks will be scheduled at default times.{" "}
                <button
                  onClick={() => navigate("/profile")}
                  className="underline hover:text-amber-200 transition-colors"
                >
                  Set it now
                </button>{" "}
                or continue and update it later.
              </div>
            </div>
          )}

          {generateError && (
            <div className="px-4 py-3 rounded-lg border border-red-700/60 bg-red-950/40 text-red-300 text-sm">
              {generateError}
            </div>
          )}

          {/* Generating spinner */}
          {generating && (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-gray-400">Building your personalised plan…</p>
              <p className="text-xs text-gray-600">This usually takes 10–20 seconds</p>
            </div>
          )}

          {!generating && (
            <div className="flex justify-between pt-1">
              <button
                onClick={() => setStep(2)}
                className="px-4 py-2.5 text-sm text-gray-500 hover:text-white transition-colors"
              >
                ← Back
              </button>
              <button
                className="px-6 py-2.5 bg-indigo-600 rounded-lg text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                onClick={handleGenerate}
                disabled={saveLoading}
              >
                {saveLoading ? "Checking…" : "Generate plan →"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
