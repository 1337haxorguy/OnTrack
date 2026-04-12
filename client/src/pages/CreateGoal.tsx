import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useApp, DAYS } from "../context/AppContext";
import { useAuth0 } from "@auth0/auth0-react";
import type { Goal, FollowupQuestion, DayPlan, QuestionType } from "../context/AppContext";

const API_BASE = import.meta.env.VITE_API_BASE;

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
    selected_days: [...DAYS],
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
  "px-3 py-3 border border-black/10 rounded-xl bg-white text-black text-sm w-full " +
  "focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-black/30 " +
  "transition-colors placeholder:text-black/25";

const cardCls = "rounded-2xl border border-black/8 bg-white p-5 flex flex-col gap-5 shadow-sm";
const fieldLabel = "text-xs font-medium text-black/40";
const fieldHint  = "text-xs text-black/25 -mt-3";

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
            className={`flex flex-col items-start px-3 py-2.5 rounded-xl border text-left transition-all ${
              value === v
                ? "border-black bg-black text-white"
                : "border-black/10 bg-white text-black/40 hover:border-black/25 hover:text-black/60"
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
          <span className="text-sm font-semibold text-black tabular-nums">
            {form.hours_per_week} hr{form.hours_per_week !== 1 && "s"}
          </span>
        </div>
        <input
          type="range" min={1} max={20} step={1}
          className="w-full accent-black cursor-pointer h-1.5"
          value={form.hours_per_week}
          onChange={(e) => patch({ hours_per_week: Number(e.target.value) })}
        />
        <div className="flex justify-between text-xs text-black/25">
          <span>1 hr</span><span>20 hrs</span>
        </div>
      </div>

      {/* Preferred days */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <label className={fieldLabel}>Preferred days</label>
          <span className="text-xs text-black/30">
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
                    ? "bg-black border-black text-white"
                    : "bg-white border-black/10 text-black/35 hover:border-black/25 hover:text-black/60"
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
            className={`relative w-9 h-5 rounded-full transition-colors shrink-0 focus:outline-none focus:ring-2 focus:ring-black/10 ${
              form.has_daily_limit ? "bg-black" : "bg-black/15"
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                form.has_daily_limit ? "translate-x-4" : "translate-x-0"
              }`}
            />
          </button>
          <span className="text-sm text-black/60">Daily time limit</span>
        </label>
        {form.has_daily_limit && (
          <div className="flex items-center gap-3 ml-12">
            <input
              type="number" min={15} max={480} step={15}
              className="px-3 py-2 border border-black/10 rounded-xl bg-white text-black text-sm w-24 focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-black/30 transition-colors"
              value={form.daily_limit_minutes}
              onChange={(e) => patch({ daily_limit_minutes: Number(e.target.value) })}
            />
            <span className="text-sm text-black/40">minutes per day</span>
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
          <h2 className="text-sm font-semibold text-black">
            Additional context
            {hasData && (
              <span className="ml-2 text-xs font-normal text-black/40">
                {[
                  form.restrictions.length > 0 && `${form.restrictions.length} restriction${form.restrictions.length !== 1 ? "s" : ""}`,
                  form.requests.length > 0 && `${form.requests.length} request${form.requests.length !== 1 ? "s" : ""}`,
                  form.additional_context && "context",
                ].filter(Boolean).join(" · ")}
              </span>
            )}
          </h2>
          <p className="text-xs text-black/40 mt-0.5">Injuries, noise limits, specific requests — optional</p>
        </div>
        <span className={`text-black/30 group-hover:text-black/60 transition-all duration-200 ${open ? "rotate-180" : ""}`}>
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
                  <span key={i} className="inline-flex items-center gap-1 text-xs bg-black/5 border border-black/10 rounded-full pl-3 pr-1.5 py-1 text-black/60">
                    {r}
                    <button
                      onClick={() => patch({ restrictions: form.restrictions.filter((_, j) => j !== i) })}
                      className="w-4 h-4 flex items-center justify-center rounded-full text-black/30 hover:text-black hover:bg-black/10 transition-colors"
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
                className="px-3 py-2 bg-white border border-black/10 rounded-xl text-black text-sm hover:bg-black/5 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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
                  <span key={i} className="inline-flex items-center gap-1 text-xs bg-black/5 border border-black/10 rounded-full pl-3 pr-1.5 py-1 text-black/60">
                    {r}
                    <button
                      onClick={() => patch({ requests: form.requests.filter((_, j) => j !== i) })}
                      className="w-4 h-4 flex items-center justify-center rounded-full text-black/30 hover:text-black hover:bg-black/10 transition-colors"
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
                className="px-3 py-2 bg-white border border-black/10 rounded-xl text-black text-sm hover:bg-black/5 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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
// Draft helpers
// ============================================================

const DRAFTS_KEY = "ontrack_goal_drafts";

interface GoalDraft {
  id: string;
  form: Omit<Goal, "id">;
  step: 1 | 2 | 3;
  savedAt: string; // ISO string
}

function loadDrafts(): GoalDraft[] {
  try {
    const raw = localStorage.getItem(DRAFTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveDrafts(drafts: GoalDraft[]) {
  localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts));
}

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// ============================================================
// Main component
// ============================================================

export default function CreateGoal() {
  const { goals, setGoals, schedule, setPlan, showToast } = useApp();
  const { isAuthenticated, getAccessTokenSilently, loginWithRedirect } = useAuth0();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = !!id;

  const [drafts, setDrafts]               = useState<GoalDraft[]>(() => loadDrafts());
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [form, setForm]                   = useState<Omit<Goal, "id">>(emptyGoal());
  const [step, setStep]                   = useState<1 | 2 | 3>(1);
  const [newRestriction, setNewRestriction] = useState("");
  const [newRequest, setNewRequest]         = useState("");
  const [qLoading, setQLoading]             = useState(false);
  const [qError, setQError]                 = useState("");
  const [titleForQuestions, setTitleForQuestions] = useState("");
  const [titleError, setTitleError]         = useState("");
  const [saveLoading, setSaveLoading]       = useState(false);
  const [saveError, setSaveError]           = useState("");
  const [generating, setGenerating]         = useState(false);
  const [generateError, setGenerateError]   = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showCustomDates, setShowCustomDates] = useState(false);
  const [showRegenPrompt, setShowRegenPrompt] = useState(false);
  const [regenLoading, setRegenLoading] = useState(false);
  const [regenError, setRegenError] = useState("");

  useEffect(() => {
    document.title = isEditing && form.title.trim()
      ? `${form.title.trim()} — OnTrack`
      : "New Goal — OnTrack";
  }, [isEditing, form.title]);

  // Auto-save active draft on every form/step change
  useEffect(() => {
    if (isEditing || !activeDraftId) return;
    setDrafts(prev => {
      const updated = prev.map(d =>
        d.id === activeDraftId ? { ...d, form, step, savedAt: new Date().toISOString() } : d
      );
      saveDrafts(updated);
      return updated;
    });
  }, [form, step]); // eslint-disable-line react-hooks/exhaustive-deps

  const startNewDraft = () => {
    const draft: GoalDraft = {
      id: crypto.randomUUID(),
      form: emptyGoal(),
      step: 1,
      savedAt: new Date().toISOString(),
    };
    const updated = [...drafts, draft];
    saveDrafts(updated);
    setDrafts(updated);
    setForm(draft.form);
    setStep(1);
    setActiveDraftId(draft.id);
  };

  const resumeDraft = (draft: GoalDraft) => {
    setForm(draft.form);
    setStep(draft.step);
    setActiveDraftId(draft.id);
  };

  const deleteDraftById = (draftId: string) => {
    const updated = drafts.filter(d => d.id !== draftId);
    saveDrafts(updated);
    setDrafts(updated);
    if (activeDraftId === draftId) setActiveDraftId(null);
  };

  const clearActiveDraft = () => {
    if (!activeDraftId) return;
    deleteDraftById(activeDraftId);
  };

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
      const newQs: FollowupQuestion[] = (data.questions || []).map((q: { question: string; type?: QuestionType; options?: string[] }) => ({
        question: q.question,
        user_response: "",
        type: q.type ?? "open_ended",
        options: q.options ?? [],
      }));
      patch({ followup_questions: newQs });
      setTitleForQuestions(title);
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
      navigate("/");
      showToast({ message: "Your plan is ready!", action: { label: "View calendar →", href: "/calendar" } });
    } catch (e: unknown) {
      setGenerateError(e instanceof Error ? e.message : "Failed to generate plan");
      setGenerating(false);
    }
  };

  // ---- Save handlers ----

  // For new goals: validate → save → generate → navigate to /
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
    clearActiveDraft();
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
      setShowRegenPrompt(true);
    }
  };

  const regenerateSavedGoal = async () => {
    if (!id) return;
    const goal = { ...form, id };
    setRegenLoading(true);
    setRegenError("");
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (isAuthenticated) {
        const token = await getAccessTokenSilently().catch(() => null);
        if (token) headers["Authorization"] = `Bearer ${token}`;
      }
      const res = await fetch(`${API_BASE}/api/generate`, {
        method: "POST",
        headers,
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
        time_blocks: day.time_blocks.map((b) => ({ ...b, id: crypto.randomUUID(), goal_id: id })),
      }));
      setPlan((prev) => {
        if (!prev) return newDays;
        const allDates = new Set([...prev.map((d) => d.date), ...newDays.map((d) => d.date)]);
        return Array.from(allDates).sort().map((date) => {
          const existing = prev.find((d) => d.date === date);
          const replacement = newDays.find((d) => d.date === date);
          if (!existing) return replacement!;
          const keptBlocks = existing.time_blocks.filter((b) => b.goal_id !== id);
          const merged = [...keptBlocks, ...(replacement?.time_blocks ?? [])];
          if (merged.length === 0) return null;
          return { ...existing, time_blocks: merged };
        }).filter((d): d is DayPlan => d !== null);
      });
      showToast({ message: `"${goal.title}" blocks updated!`, action: { label: "View calendar →", href: "/calendar" } });
      navigate("/");
    } catch {
      setRegenError("Failed to regenerate. You can try again from the Goals page.");
    } finally {
      setRegenLoading(false);
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
          <button onClick={() => navigate("/")} className="text-black/40 hover:text-black transition-colors">
            ← Goals
          </button>
          <span className="text-black/20">/</span>
          <span className="text-black/60 font-medium">Edit goal</span>
        </div>

        <div className="flex flex-col gap-4">
          {/* Goal details */}
          <section className={cardCls}>
            <h2 className="text-sm font-semibold text-black">Goal details</h2>
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
            <h2 className="text-sm font-semibold text-black">Time commitment</h2>
            <TimeCommitmentSection form={form} patch={patch} />
          </section>

          {/* Personalisation questions */}
          {form.followup_questions.length > 0 && (
            <section className={cardCls}>
              <h2 className="text-sm font-semibold text-black">Personalisation</h2>
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

          {/* Post-save regen prompt */}
          {showRegenPrompt && (
            <div className="rounded-2xl border border-black/8 bg-white p-4 flex flex-col gap-3 shadow-sm">
              <p className="text-sm text-black font-medium">Goal saved!</p>
              <p className="text-sm text-black/50">Would you like to regenerate the plan blocks for <span className="text-black font-medium">{form.title}</span>? Other goals won't be affected.</p>
              {regenError && <p className="text-xs text-red-500">{regenError}</p>}
              <div className="flex gap-2">
                <button
                  onClick={regenerateSavedGoal}
                  disabled={regenLoading}
                  className="flex-1 py-2 bg-black rounded-full text-white text-sm font-medium hover:bg-black/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {regenLoading ? "Regenerating…" : "Regenerate"}
                </button>
                <button
                  onClick={() => navigate("/")}
                  disabled={regenLoading}
                  className="flex-1 py-2 border border-black/10 rounded-full text-black/40 text-sm hover:border-black/25 hover:text-black/70 disabled:opacity-50 transition-colors"
                >
                  Not now
                </button>
              </div>
            </div>
          )}

          {/* Actions */}
          {!showRegenPrompt && (
          <div className="flex items-center gap-3 pt-1">
            <button
              className="flex-1 py-2.5 bg-black rounded-full text-white text-sm font-medium hover:bg-black/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              onClick={handleEditSave}
              disabled={!form.title.trim() || saveLoading}
            >
              {saveLoading ? "Checking…" : "Save changes"}
            </button>

            {showDeleteConfirm ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-black/40 whitespace-nowrap">Are you sure?</span>
                <button
                  className="px-3 py-2.5 bg-red-50 border border-red-200 rounded-full text-red-500 text-sm hover:bg-red-100 transition-colors"
                  onClick={deleteGoal}
                >Delete</button>
                <button
                  className="px-3 py-2.5 text-sm text-black/40 hover:text-black transition-colors"
                  onClick={() => setShowDeleteConfirm(false)}
                >Cancel</button>
              </div>
            ) : (
              <button
                className="px-4 py-2.5 border border-black/10 rounded-full text-black/40 text-sm hover:border-red-200 hover:text-red-500 transition-colors"
                onClick={() => setShowDeleteConfirm(true)}
              >Delete</button>
            )}
          </div>
          )}
        </div>
      </div>
    );
  }

  // ============================================================
  // Draft picker — shown when no draft is active
  // ============================================================

  if (!isEditing && !activeDraftId) {
    return (
      <div className="max-w-2xl pb-20">
        <div className="flex items-center gap-2 mb-8 text-sm">
          <button onClick={() => navigate("/")} className="text-gray-500 hover:text-white transition-colors">
            ← Goals
          </button>
          <span className="text-gray-700">/</span>
          <span className="text-gray-300 font-medium">New goal</span>
        </div>

        {drafts.length > 0 && (
          <div className="flex flex-col gap-3 mb-6">
            <p className="text-xs font-medium text-black/30 uppercase tracking-widest">Saved drafts</p>
            {drafts.map(draft => (
              <div
                key={draft.id}
                className="flex items-center gap-3 rounded-2xl border border-black/8 bg-white px-4 py-3 hover:border-black/15 transition-colors group shadow-sm"
              >
                <button
                  className="flex-1 flex flex-col items-start text-left min-w-0"
                  onClick={() => resumeDraft(draft)}
                >
                  <span className="text-sm font-medium text-black truncate w-full">
                    {draft.form.title.trim() || "Untitled goal"}
                  </span>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-black/30">
                      Step {draft.step} of 3
                    </span>
                    <span className="text-black/20">·</span>
                    <span className="text-xs text-black/30">{timeAgo(draft.savedAt)}</span>
                  </div>
                </button>
                <button
                  onClick={() => resumeDraft(draft)}
                  className="shrink-0 text-xs px-3 py-1.5 rounded-full border border-black/10 text-black/40 hover:border-black/25 hover:text-black transition-colors"
                >
                  Resume
                </button>
                <button
                  onClick={() => deleteDraftById(draft.id)}
                  className="shrink-0 text-black/20 hover:text-red-500 transition-colors p-1"
                  title="Delete draft"
                >
                  <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
                    <path fillRule="evenodd" d="M5 3.25V4H2.75a.75.75 0 0 0 0 1.5h.3l.815 8.15A1.5 1.5 0 0 0 5.357 15h5.285a1.5 1.5 0 0 0 1.493-1.35l.815-8.15h.3a.75.75 0 0 0 0-1.5H11v-.75A2.25 2.25 0 0 0 8.75 1h-1.5A2.25 2.25 0 0 0 5 3.25Zm2.25-.75a.75.75 0 0 0-.75.75V4h3v-.75a.75.75 0 0 0-.75-.75h-1.5ZM6.05 6a.75.75 0 0 1 .787.713l.275 5.5a.75.75 0 0 1-1.498.075l-.275-5.5A.75.75 0 0 1 6.05 6Zm3.9 0a.75.75 0 0 1 .712.787l-.275 5.5a.75.75 0 0 1-1.498-.075l.275-5.5a.75.75 0 0 1 .786-.711Z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={startNewDraft}
          className="w-full py-3 rounded-2xl border border-dashed border-black/15 text-black/35 hover:border-black/30 hover:text-black/60 text-sm font-medium transition-colors"
        >
          + Start a new goal
        </button>
      </div>
    );
  }

  // ============================================================
  // New goal — 3-step wizard
  // ============================================================

  // Duration preset helpers
  const DURATION_PRESETS: Array<{ label: string; days: number }> = [
    { label: "2 weeks", days: 14 },
    { label: "1 month", days: 30 },
    { label: "3 months", days: 90 },
    { label: "6 months", days: 180 },
    { label: "1 year", days: 365 },
  ];

  const getPresetEndDate = (days: number) =>
    fmt(new Date(new Date(form.timeframe.start_date + "T00:00:00").getTime() + days * 86400000));

  const activePreset = DURATION_PRESETS.find(
    (p) => form.timeframe.end_date === getPresetEndDate(p.days)
  );

  return (
    <div className="max-w-2xl pb-20">

      {/* Guest banner */}
      {!isAuthenticated && (
        <div className="mb-6 flex items-center justify-between gap-4 px-4 py-3 rounded-2xl border border-black/8 bg-white text-sm shadow-sm">
          <span className="text-black/40">Sign up to save your goals and plan.</span>
          <button
            onClick={() => loginWithRedirect()}
            className="shrink-0 px-4 py-1.5 bg-black text-white text-xs font-semibold rounded-full hover:bg-black/80 transition-colors"
          >
            Sign up free
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => {
            if (step > 1) return setStep((s) => (s - 1) as 1 | 2 | 3);
            if (!isAuthenticated) return navigate("/");
            setActiveDraftId(null);
          }}
          className="text-sm text-black/40 hover:text-black transition-colors"
        >
          ← {step > 1 ? "Back" : "Home"}
        </button>
        <span className="text-xs text-black/30 font-medium">Step {step} of 3</span>
      </div>

      {/* Step progress bar — iOS segmented capsule style */}
      <div className="flex gap-1.5 mb-8">
        {[1, 2, 3].map((s) => (
          <div
            key={s}
            className={`h-1 flex-1 rounded-full transition-all duration-300 ${
              s <= step ? "bg-white" : "bg-white/10"
            }`}
          />
        ))}
      </div>

      {/* ---- Step 1: Your Goal ---- */}
      {step === 1 && (
        <div className="flex flex-col gap-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-black mb-1">What do you want to achieve?</h1>
            <p className="text-sm text-black/40">Be specific — the more detail, the better your plan.</p>
          </div>

          {/* Title input */}
          <div className="flex flex-col gap-1.5">
            <input
              className={`${inputCls} text-base ${titleError ? "border-red-300 focus:border-red-400 focus:ring-red-200" : ""}`}
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

          {/* Templates */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-black/30 shrink-0">Try one of these →</span>
            {TEMPLATES.map((t) => (
              <button
                key={t.title}
                type="button"
                onClick={() => applyTemplate(t)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                  form.title === t.title
                    ? "bg-black/8 border-black/30 text-black"
                    : "bg-white border-black/10 text-black/40 hover:border-black/25 hover:text-black/70"
                }`}
              >
                {t.title}
              </button>
            ))}
          </div>

          {/* Skill level */}
          <div className={cardCls}>
            <SkillLevelPicker value={form.skill_level} onChange={(v) => patch({ skill_level: v })} />
          </div>

          <div className="flex justify-end">
            <button
              className="px-7 py-3 bg-black text-white text-sm font-semibold rounded-full hover:bg-black/80 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              disabled={!form.title.trim()}
              onClick={() => {
                const titleChanged = form.title.trim() !== titleForQuestions && form.followup_questions.length > 0;
                if (titleChanged) generateQuestions();
                setStep(2);
              }}
            >
              Continue →
            </button>
          </div>
        </div>
      )}

      {/* ---- Step 2: Time & schedule ---- */}
      {step === 2 && (
        <div className="flex flex-col gap-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-black mb-1">Time & schedule</h1>
            <p className="text-sm text-black/40">How long is this goal, and how much time can you give it?</p>
          </div>

          {/* Goal timeframe */}
          <div className={cardCls}>
            <div>
              <p className="text-sm font-semibold text-black mb-0.5">Goal timeframe</p>
              <p className="text-xs text-black/40">How long do you want to work on this goal?</p>
            </div>

            {/* Duration preset buttons */}
            <div className="flex flex-wrap gap-2">
              {DURATION_PRESETS.map((preset) => {
                const isActive = activePreset?.days === preset.days && !showCustomDates && form.timeframe.end_date !== "";
                return (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => {
                      patch({ timeframe: { ...form.timeframe, end_date: getPresetEndDate(preset.days) } });
                      setShowCustomDates(false);
                    }}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                      isActive
                        ? "bg-black/8 border-black/30 text-black"
                        : "bg-white border-black/10 text-black/40 hover:border-black/25 hover:text-black/70"
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => {
                  patch({ timeframe: { ...form.timeframe, end_date: "" } });
                  setShowCustomDates(false);
                }}
                className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                  form.timeframe.end_date === "" && !showCustomDates
                    ? "bg-black/8 border-black/30 text-black"
                    : "bg-white border-black/10 text-black/40 hover:border-black/25 hover:text-black/70"
                }`}
              >
                No end date
              </button>
              <button
                type="button"
                onClick={() => setShowCustomDates((v) => !v)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                  showCustomDates || (!activePreset && !!form.timeframe.end_date)
                    ? "bg-black/8 border-black/30 text-black"
                    : "bg-white border-black/10 text-black/40 hover:border-black/25 hover:text-black/70"
                }`}
              >
                Custom
              </button>
            </div>

            {(showCustomDates || (!activePreset && !!form.timeframe.end_date)) && (
              <DateRangePicker
                start={form.timeframe.start_date}
                end={form.timeframe.end_date}
                onStart={(v) => patch({ timeframe: { ...form.timeframe, start_date: v } })}
                onEnd={(v) => patch({ timeframe: { ...form.timeframe, end_date: v } })}
              />
            )}
          </div>

          {/* Time commitment */}
          <div className={cardCls}>
            <TimeCommitmentSection form={form} patch={patch} />
          </div>

          <div className="flex justify-between items-center">
            <button onClick={() => setStep(1)} className="px-4 py-2.5 text-sm text-gray-500 hover:text-white transition-colors">
              ← Back
            </button>
            <button
              onClick={() => {
                if (form.followup_questions.length === 0 && !qLoading) {
                  generateQuestions();
                }
                setStep(3);
              }}
              className="px-7 py-3 bg-black text-white text-sm font-semibold rounded-full hover:bg-black/80 transition-colors"
            >
              Continue →
            </button>
          </div>
        </div>
      )}

      {/* ---- Step 3: Personalise + Generate ---- */}
      {step === 3 && (
        <div className="flex flex-col gap-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-black mb-1">Personalise your plan</h1>
            <p className="text-sm text-black/40">Help the AI understand your situation better. All optional.</p>
          </div>

          {/* Personalisation questions */}
          <div className={cardCls}>
            {qLoading && (
              <div className="flex flex-col gap-3">
                {[1, 2, 3].map((n) => (
                  <div key={n} className="flex flex-col gap-2 animate-pulse">
                    <div className="h-3.5 bg-gray-800 rounded w-3/4" />
                    <div className="h-9 bg-gray-800/60 rounded-lg w-full" />
                  </div>
                ))}
              </div>
            )}

            {qError && <p className="text-xs text-red-400">{qError}</p>}

            {!qLoading && form.followup_questions.length > 0 && (
              <div className="flex flex-col gap-5">
                {form.followup_questions.map((fq, i) => (
                  <div key={i} className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-black/60">
                      {i + 1}. {fq.question}
                    </label>
                    {/* Boolean */}
                    {fq.type === "boolean" && (
                      <div className="flex gap-2">
                        {["Yes", "No"].map(opt => (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => updateAnswer(i, fq.user_response === opt ? "" : opt)}
                            className={`px-5 py-2 rounded-lg border text-sm font-medium transition-all ${
                              fq.user_response === opt
                                ? "bg-black/8 border-black/30 text-black"
                                : "bg-white border-black/10 text-black/40 hover:border-black/25 hover:text-black/70"
                            }`}
                          >{opt}</button>
                        ))}
                      </div>
                    )}
                    {/* Multiple choice */}
                    {fq.type === "multiple_choice" && (
                      <div className="flex flex-wrap gap-2">
                        {(fq.options ?? []).map(opt => (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => updateAnswer(i, fq.user_response === opt ? "" : opt)}
                            className={`px-3 py-1.5 rounded-lg border text-sm transition-all ${
                              fq.user_response === opt
                                ? "bg-black/8 border-black/30 text-black"
                                : "bg-white border-black/10 text-black/40 hover:border-black/25 hover:text-black/70"
                            }`}
                          >{opt}</button>
                        ))}
                      </div>
                    )}
                    {/* Multi select */}
                    {fq.type === "multi_select" && (
                      <div className="flex flex-wrap gap-2">
                        {(fq.options ?? []).map(opt => {
                          const selected = fq.user_response.split(",").map(s => s.trim()).filter(Boolean).includes(opt);
                          return (
                            <button
                              key={opt}
                              type="button"
                              onClick={() => {
                                const current = fq.user_response.split(",").map(s => s.trim()).filter(Boolean);
                                const next = selected ? current.filter(s => s !== opt) : [...current, opt];
                                updateAnswer(i, next.join(", "));
                              }}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm transition-all ${
                                selected
                                  ? "bg-indigo-600/20 border-indigo-500/60 text-indigo-300"
                                  : "bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200"
                              }`}
                            >
                              {selected && (
                                <svg className="w-3 h-3 shrink-0" viewBox="0 0 10 8" fill="none">
                                  <path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              )}
                              {opt}
                            </button>
                          );
                        })}
                      </div>
                    )}
                    {/* Scale 1–5 */}
                    {fq.type === "scale" && (
                      <div className="flex flex-col gap-1.5">
                        <div className="flex gap-2">
                          {[1, 2, 3, 4, 5].map(n => (
                            <button
                              key={n}
                              type="button"
                              onClick={() => updateAnswer(i, fq.user_response === String(n) ? "" : String(n))}
                              className={`w-10 h-10 rounded-xl border text-sm font-semibold transition-all ${
                                fq.user_response === String(n)
                                  ? "bg-black border-black text-white"
                                  : "bg-white border-black/10 text-black/40 hover:border-black/25 hover:text-black/70"
                              }`}
                            >{n}</button>
                          ))}
                        </div>
                        <div className="flex justify-between text-xs text-black/25 px-1">
                          <span>Not at all</span><span>Very much</span>
                        </div>
                      </div>
                    )}
                    {/* Open ended */}
                    {(!fq.type || fq.type === "open_ended") && (
                      <input
                        className={inputCls}
                        placeholder="Your answer… (optional)"
                        value={fq.user_response}
                        onChange={(e) => updateAnswer(i, e.target.value)}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}

            {!qLoading && form.followup_questions.length === 0 && !qError && (
              <p className="text-xs text-black/25 italic">
                No questions generated yet — make sure you have a goal title entered.
              </p>
            )}
          </div>

          {/* Restrictions */}
          <div className={cardCls}>
            <div>
              <p className="text-sm font-semibold text-black mb-0.5">Anything to keep in mind?</p>
              <p className="text-xs text-black/40">Injuries, equipment limits, noise restrictions — optional</p>
            </div>

            {form.restrictions.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {form.restrictions.map((r, i) => (
                  <span key={i} className="inline-flex items-center gap-1 text-xs bg-black/5 border border-black/10 rounded-full pl-3 pr-1.5 py-1 text-black/60">
                    {r}
                    <button
                      onClick={() => patch({ restrictions: form.restrictions.filter((_, j) => j !== i) })}
                      className="w-4 h-4 flex items-center justify-center rounded-full text-black/30 hover:text-black hover:bg-black/10 transition-colors"
                    >×</button>
                  </span>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <input
                className={inputCls}
                placeholder="e.g. Wrist soreness, no loud practice after 10pm, access to equipment..."
                value={newRestriction}
                onChange={(e) => setNewRestriction(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (() => {
                  if (!newRestriction.trim()) return;
                  patch({ restrictions: [...form.restrictions, newRestriction.trim()] });
                  setNewRestriction("");
                })()}
              />
              <button
                onClick={() => {
                  if (!newRestriction.trim()) return;
                  patch({ restrictions: [...form.restrictions, newRestriction.trim()] });
                  setNewRestriction("");
                }}
                disabled={!newRestriction.trim()}
                className="px-3 py-2 bg-white border border-black/10 rounded-xl text-black text-sm hover:bg-black/5 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >Add</button>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-gray-400">Background & context</label>
              <p className="text-xs text-gray-600">Current level, deadlines, sub-goals — anything that should shape your plan</p>
              <textarea
                className={`${inputCls} resize-y`}
                rows={3}
                placeholder="e.g. I know basic open chords and can play simple songs. I want to perform at an open mic in 2 months."
                value={form.additional_context}
                onChange={(e) => patch({ additional_context: e.target.value })}
              />
            </div>
          </div>

          {/* Schedule warning */}
          {!hasSchedule && (
            <div className="flex items-start gap-3 px-4 py-3 rounded-xl border border-amber-300/60 bg-amber-50 text-amber-700 text-xs leading-relaxed">
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
            <div className="px-4 py-3 rounded-xl border border-red-200 bg-red-50 text-red-600 text-sm">
              {generateError}
            </div>
          )}

          {/* Generating spinner */}
          {generating && (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <div className="w-8 h-8 border-2 border-black border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-black/50">Building your personalised plan…</p>
              <p className="text-xs text-black/30">This usually takes 10–20 seconds</p>
            </div>
          )}

          {!generating && (
            <div className="flex justify-between items-center pt-1">
              <button
                onClick={() => setStep(2)}
                className="px-4 py-2.5 text-sm text-black/40 hover:text-black transition-colors"
              >
                ← Back
              </button>
              <button
                className="px-7 py-3 bg-black text-white text-sm font-semibold rounded-full hover:bg-black/80 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                onClick={handleGenerate}
                disabled={saveLoading}
              >
                {saveLoading ? "Checking…" : "Make my plan →"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
