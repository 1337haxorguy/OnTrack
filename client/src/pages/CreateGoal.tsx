import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useApp, DAYS, LIMITS_ENABLED, FREE_LIMITS } from "../context/AppContext";
import { useAuth } from "../context/AuthContext";
import type { Goal, FollowupQuestion, DayPlan, QuestionType } from "../context/AppContext";
import CurvedWordmark from "../components/CurvedWordmark";

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

// ── Design tokens ─────────────────────────────────────────────
const GREEN        = "#2F7D5E";
const GREEN_BG     = "#E8F1EC";
const GREEN_INK    = "#1F5E46";
const INK_05       = "rgba(13,13,13,0.05)";
const INK_08       = "rgba(13,13,13,0.08)";
const INK_12       = "rgba(13,13,13,0.12)";
const INK_25       = "rgba(13,13,13,0.25)";
const INK_40       = "rgba(13,13,13,0.40)";
const INK_60       = "rgba(13,13,13,0.60)";

// ── Suggestion chips (matching TEMPLATES titles) ───────────────
const CHIPS = [
  "learn guitar",
  "run a 5k",
  "learn spanish",
  "build a morning routine",
  "learn to cook",
  "get stronger at the gym",
  "learn to draw",
  "start meditating",
];

// ── Timeframe chip options ─────────────────────────────────────
interface TimeframeOption {
  label: string;
  days: number | null | undefined; // null = no end date, undefined = custom
}
const TIMEFRAME_OPTIONS: TimeframeOption[] = [
  { label: "2 weeks",     days: 14   },
  { label: "1 month",     days: 30   },
  { label: "3 months",    days: 90   },
  { label: "6 months",    days: 180  },
  { label: "1 year",      days: 365  },
  { label: "no end date", days: null },
  { label: "custom…",     days: undefined },
];

function chipToTimeframe(days: number | null | undefined): { start_date: string; end_date: string } | null {
  if (days === undefined) return null; // custom — don't update form.timeframe
  const today = new Date();
  const start = fmt(today);
  if (days === null) return { start_date: start, end_date: "" };
  const end = new Date(today);
  end.setDate(today.getDate() + days);
  return { start_date: start, end_date: fmt(end) };
}

// ── Slab accent component ──────────────────────────────────────
function Slab({ children }: { children: React.ReactNode }) {
  return (
    <span className="relative inline-block">
      {children}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 rounded-full"
        style={{ bottom: "0.06em", height: "0.14em", background: GREEN, zIndex: -1 }}
      />
    </span>
  );
}

// ── Stepper ───────────────────────────────────────────────────
const STEP_LABELS = ["your goal", "your pace", "personal touches"];

function Stepper({ step }: { step: 1 | 2 | 3 }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 44 }}>
      {STEP_LABELS.map((label, idx) => {
        const n = idx + 1;
        const done    = n < step;
        const current = n === step;
        return (
          <div key={n} style={{ display: "flex", alignItems: "center" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, minWidth: 72 }}>
              {/* Dot */}
              <div style={{
                width: 28, height: 28, borderRadius: "50%",
                background: done || current ? GREEN : "#fff",
                border: done || current ? `2px solid ${GREEN}` : `1px solid ${INK_12}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: current ? `0 0 0 4px ${GREEN_BG}` : "none",
                color: done || current ? "#fff" : INK_25,
                fontWeight: 600, fontSize: 12,
                transition: "all .2s",
              }}>
                {done ? (
                  <svg width="12" height="10" viewBox="0 0 12 10" fill="none">
                    <path d="M1.5 5l3 3.5 6-7" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : String(n)}
              </div>
              {/* Label */}
              <span style={{
                fontSize: 11, letterSpacing: "0.06em", fontWeight: 600,
                color: current ? "#0d0d0d" : done ? GREEN_INK : INK_40,
                textTransform: "lowercase",
              }}>
                {label}
              </span>
            </div>
            {/* Connecting bar (after each step except last) */}
            {idx < STEP_LABELS.length - 1 && (
              <div style={{ flex: "0 0 60px", height: 2, borderRadius: 999, background: INK_08, margin: "0 0 18px 0", position: "relative" }}>
                {done && (
                  <div style={{ position: "absolute", inset: 0, background: GREEN, borderRadius: 999 }} />
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Topbar ────────────────────────────────────────────────────
function Topbar({ step, onBack, savedState }: {
  step: 1 | 2 | 3 | 4;
  onBack: () => void;
  savedState: "idle" | "saving" | "saved";
}) {
  const backLabel = step === 1 ? "← back to goals" : "← back";
  return (
    <div style={{
      position: "sticky", top: 0, zIndex: 20, height: 64,
      background: "rgba(249,249,249,.92)",
      backdropFilter: "saturate(1.2) blur(10px)",
      borderBottom: `1px solid ${INK_08}`,
    }}>
      <div style={{
        maxWidth: 820, margin: "0 auto", height: 64,
        padding: "0 28px", display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        {/* Left: back */}
        <button
          onClick={onBack}
          style={{ fontSize: 13, fontWeight: 600, color: INK_60, background: "none", border: "none", cursor: "pointer", padding: 0 }}
          onMouseEnter={e => (e.currentTarget.style.color = "#0d0d0d")}
          onMouseLeave={e => (e.currentTarget.style.color = INK_60)}
        >
          {step > 3 ? "" : backLabel}
        </button>
        {/* Center: wordmark */}
        <CurvedWordmark scale={0.38} />
        {/* Right: saved indicator */}
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <div style={{
            width: 6, height: 6, borderRadius: "50%",
            background: GREEN,
            boxShadow: `0 0 0 4px ${GREEN_BG}`,
          }} />
          <span style={{ fontSize: 12, color: INK_40 }}>
            {savedState === "saving" ? "saving…" : "saved just now"}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── QuestionInput (used in step 3 and edit mode) ──────────────
function QuestionInput({
  fq, index, updateAnswer,
}: {
  fq: FollowupQuestion;
  index: number;
  updateAnswer: (i: number, v: string) => void;
}) {
  const optionBtn = (label: string, active: boolean, onClick: () => void, isCheckbox = false) => (
    <button
      key={label}
      type="button"
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "12px 14px", borderRadius: 12, width: "100%", textAlign: "left",
        border: `1px solid ${active ? GREEN : INK_12}`,
        background: active ? GREEN_BG : "#fff",
        marginBottom: 8, fontSize: 14, cursor: "pointer",
        transition: "border-color .15s, background .15s",
      }}
    >
      {/* Radio / checkbox indicator */}
      {isCheckbox ? (
        <span style={{
          width: 18, height: 18, borderRadius: 5, border: `1.5px solid ${active ? GREEN : INK_25}`,
          background: active ? GREEN : "transparent",
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          transition: "all .15s",
        }}>
          {active && (
            <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
              <path d="M1 4l3 3 5-6" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </span>
      ) : (
        <span style={{
          width: 18, height: 18, borderRadius: "50%", border: `1.5px solid ${active ? GREEN : INK_25}`,
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          transition: "all .15s",
        }}>
          {active && <span style={{ width: 8, height: 8, borderRadius: "50%", background: GREEN }} />}
        </span>
      )}
      <span style={{ color: active ? "#0d0d0d" : INK_60 }}>{label}</span>
    </button>
  );

  return (
    <div style={{ marginBottom: 0 }}>
      <p style={{ fontSize: 14.5, fontWeight: 600, lineHeight: 1.4, color: "#0d0d0d", marginBottom: 12 }}>
        <span style={{ fontWeight: 500, color: INK_40 }}>{String(index + 1).padStart(2, "0")}. </span>
        {fq.question}
      </p>

      {/* Boolean */}
      {fq.type === "boolean" && (
        <div>
          {["Yes", "No"].map(opt => optionBtn(opt, fq.user_response === opt, () =>
            updateAnswer(index, fq.user_response === opt ? "" : opt)
          ))}
        </div>
      )}

      {/* Multiple choice */}
      {fq.type === "multiple_choice" && (
        <div>
          {(fq.options ?? []).map(opt => optionBtn(opt, fq.user_response === opt, () =>
            updateAnswer(index, fq.user_response === opt ? "" : opt)
          ))}
        </div>
      )}

      {/* Multi select */}
      {fq.type === "multi_select" && (
        <div>
          {(fq.options ?? []).map(opt => {
            const selected = fq.user_response.split(",").map(s => s.trim()).filter(Boolean).includes(opt);
            return optionBtn(opt, selected, () => {
              const current = fq.user_response.split(",").map(s => s.trim()).filter(Boolean);
              const next = selected ? current.filter(s => s !== opt) : [...current, opt];
              updateAnswer(index, next.join(", "));
            }, true);
          })}
        </div>
      )}

      {/* Scale */}
      {fq.type === "scale" && (
        <div>
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            {[1,2,3,4,5].map(n => (
              <button
                key={n}
                type="button"
                onClick={() => updateAnswer(index, fq.user_response === String(n) ? "" : String(n))}
                style={{
                  width: 42, height: 42, borderRadius: 10,
                  border: `1px solid ${fq.user_response === String(n) ? GREEN : INK_12}`,
                  background: fq.user_response === String(n) ? GREEN : "#fff",
                  color: fq.user_response === String(n) ? "#fff" : INK_40,
                  fontWeight: 600, fontSize: 14, cursor: "pointer",
                  transition: "all .15s",
                }}
              >{n}</button>
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: INK_40 }}>
            <span>Not at all</span><span>Very much</span>
          </div>
        </div>
      )}

      {/* Open ended */}
      {(!fq.type || fq.type === "open_ended") && (
        <input
          placeholder="Your answer… (optional)"
          value={fq.user_response}
          onChange={e => updateAnswer(index, e.target.value)}
          style={{
            width: "100%", padding: "10px 14px", borderRadius: 10,
            border: `1px solid ${INK_12}`, background: "#fff",
            fontSize: 14, color: "#0d0d0d", outline: "none",
            boxSizing: "border-box",
          }}
          onFocus={e => (e.target.style.boxShadow = `0 0 0 4px ${GREEN_BG}`)}
          onBlur={e => (e.target.style.boxShadow = "none")}
        />
      )}
    </div>
  );
}

// ── Shared input / card styles (for edit mode) ─────────────────
const inputCls =
  "px-3 py-3 border border-black/10 rounded-xl bg-white text-black text-sm w-full " +
  "focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-black/30 " +
  "transition-colors placeholder:text-black/25";

const cardCls = "rounded-2xl border border-black/8 bg-white p-5 flex flex-col gap-5 shadow-sm";
const fieldLabel = "text-xs font-medium text-black/40";

// ── Edit mode sub-components ───────────────────────────────────
function SkillLevelPicker({ value, onChange }: { value: Goal["skill_level"]; onChange: (v: Goal["skill_level"]) => void }) {
  const levels: Array<{ value: Goal["skill_level"]; label: string; desc: string }> = [
    { value: "beginner",     label: "Beginner",     desc: "Just starting out" },
    { value: "intermediate", label: "Intermediate", desc: "Some experience"   },
    { value: "advanced",     label: "Advanced",     desc: "Well practised"    },
  ];
  return (
    <div className="flex flex-col gap-2">
      <label className={fieldLabel}>Your current level</label>
      <div className="grid grid-cols-3 gap-2">
        {levels.map(({ value: v, label, desc }) => (
          <button key={v} type="button" onClick={() => onChange(v)}
            className={`flex flex-col items-start px-3 py-2.5 rounded-xl border text-left transition-all ${
              value === v ? "border-black bg-black text-white" : "border-black/10 bg-white text-black/40 hover:border-black/25 hover:text-black/60"
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

function DateRangePicker({ start, end, onStart, onEnd }: {
  start: string; end: string; onStart: (v: string) => void; onEnd: (v: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="flex flex-col gap-1.5">
        <label className={fieldLabel}>Start date</label>
        <input type="date" className={inputCls} value={start} onChange={e => onStart(e.target.value)} />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className={fieldLabel}>End date</label>
        <input type="date" className={inputCls} value={end} onChange={e => onEnd(e.target.value)} />
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────
export default function CreateGoal() {
  const { goals, setGoals, schedule, setPlan, showToast, incrementGenerations } = useApp();
  const { isAuthenticated, getToken } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = !!id;

  const [form, setForm]                   = useState<Omit<Goal, "id">>(emptyGoal());
  const [step, setStep]                   = useState<1 | 2 | 3 | 4>(1);
  const [newRestriction, setNewRestriction] = useState("");
  const [qLoading, setQLoading]             = useState(false);
  const [qError, setQError]                 = useState("");
  const [titleError, setTitleError]         = useState("");
  const [saveLoading, setSaveLoading]       = useState(false);
  const [saveError, setSaveError]           = useState("");
  const [generating, setGenerating]         = useState(false);
  const [generateError, setGenerateError]   = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showRegenPrompt, setShowRegenPrompt] = useState(false);
  const [regenLoading, setRegenLoading] = useState(false);
  const [regenError, setRegenError] = useState("");
  const [showDraft, setShowDraft] = useState(true);
  const [timeframeChip, setTimeframeChip] = useState("1 month");
  const [savedState, setSavedState] = useState<"idle" | "saving" | "saved">("saved");
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced "saving…" indicator
  useEffect(() => {
    if (isEditing) return;
    setSavedState("saving");
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    savedTimerRef.current = setTimeout(() => setSavedState("saved"), 300);
    return () => { if (savedTimerRef.current) clearTimeout(savedTimerRef.current); };
  }, [form]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    document.title = isEditing && form.title.trim()
      ? `${form.title.trim()} — OnTrack`
      : "New Goal — OnTrack";
  }, [isEditing, form.title]);

  // Populate form from existing goal (edit mode)
  useEffect(() => {
    if (id) {
      const existing = goals.find(g => g.id === id);
      if (existing) {
        const { id: _, ...rest } = existing;
        setForm(rest);
      }
    }
  }, [id, goals]);

  const patch = (update: Partial<Omit<Goal, "id">>) =>
    setForm(prev => ({ ...prev, ...update }));

  // ── Question generation ──────────────────────────────────────
  const generateQuestions = async () => {
    if (!form.title.trim()) return;
    setQLoading(true);
    setQError("");
    try {
      const res = await fetch(`${API_BASE}/api/generate/followup-questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
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
    } catch (e: unknown) {
      setQError(e instanceof Error ? e.message : "Failed to generate questions");
    } finally {
      setQLoading(false);
    }
  };

  const updateAnswer = (i: number, answer: string) => {
    patch({
      followup_questions: form.followup_questions.map((fq, j) =>
        j === i ? { ...fq, user_response: answer } : fq
      ),
    });
  };

  // ── Plan generation ──────────────────────────────────────────
  const hasSchedule = Object.values(schedule.free_slots).some(slots => slots.length > 0);

  const generatePlan = async (allGoals: Goal[]) => {
    setGenerating(true);
    setGenerateError("");
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (isAuthenticated) {
        const token = await getToken().catch(() => null);
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
      if (!res.ok) {
        if (res.status === 429) {
          const body = await res.json().catch(() => ({}));
          if (body.error === "generation_limit_reached") {
            throw new Error("You've used all your free generations.");
          }
        }
        throw new Error(`Server error: ${res.status}`);
      }
      const data = await res.json();
      const planWithIds: DayPlan[] = (data.weekly_tasks || []).map((day: DayPlan) => ({
        ...day,
        time_blocks: day.time_blocks.map(b => ({ ...b, id: crypto.randomUUID() })),
      }));
      setPlan(planWithIds);
      incrementGenerations();
      // Show success state
      setStep(4);
      setGenerating(false);
    } catch (e: unknown) {
      setGenerateError(e instanceof Error ? e.message : "Failed to generate plan");
      setGenerating(false);
    }
  };

  // ── Save handlers ────────────────────────────────────────────
  const handleGenerate = async () => {
    if (!form.title.trim()) return;

    if (LIMITS_ENABLED && isAuthenticated && goals.length >= FREE_LIMITS.goals) {
      setGenerateError(`You've reached the ${FREE_LIMITS.goals}-goal limit on the free plan.`);
      return;
    }
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
      followup_questions: form.followup_questions.filter(fq => fq.user_response.trim()),
    };
    const newGoal = { ...cleanedForm, id: crypto.randomUUID() };
    const updatedGoals = [...goals, newGoal];
    setGoals(updatedGoals);
    await generatePlan(updatedGoals);
  };

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
      setGoals(prev => prev.map(g => (g.id === id ? { ...form, id } : g)));
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
        const token = await getToken().catch(() => null);
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
        time_blocks: day.time_blocks.map(b => ({ ...b, id: crypto.randomUUID(), goal_id: id })),
      }));
      setPlan(prev => {
        if (!prev) return newDays;
        const allDates = new Set([...prev.map(d => d.date), ...newDays.map(d => d.date)]);
        return Array.from(allDates).sort().map(date => {
          const existing = prev.find(d => d.date === date);
          const replacement = newDays.find(d => d.date === date);
          if (!existing) return replacement!;
          const keptBlocks = existing.time_blocks.filter(b => b.goal_id !== id);
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
    setGoals(prev => prev.filter(g => g.id !== id));
    navigate("/");
  };

  // ── Topbar back handler ──────────────────────────────────────
  const handleBack = () => {
    if (step === 1 || step === 4) return navigate("/");
    setStep(s => (s - 1) as 1 | 2 | 3 | 4);
  };

  // ── Slider fill ──────────────────────────────────────────────
  const sliderPct = ((form.hours_per_week - 1) / 19 * 100).toFixed(1) + "%";

  // ── Day abbreviations ────────────────────────────────────────
  const DAY_ABBR: Record<string, string> = {
    monday: "mo", tuesday: "tu", wednesday: "we",
    thursday: "th", friday: "fr", saturday: "sa", sunday: "su",
  };

  // ── Edit mode ────────────────────────────────────────────────
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
                onChange={e => { patch({ title: e.target.value }); if (saveError) setSaveError(""); }}
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
            <SkillLevelPicker value={form.skill_level} onChange={v => patch({ skill_level: v })} />
            <DateRangePicker
              start={form.timeframe.start_date}
              end={form.timeframe.end_date}
              onStart={v => patch({ timeframe: { ...form.timeframe, start_date: v } })}
              onEnd={v => patch({ timeframe: { ...form.timeframe, end_date: v } })}
            />
          </section>

          {/* Time commitment */}
          <section className={cardCls}>
            <h2 className="text-sm font-semibold text-black">Time commitment</h2>
            {/* Hours slider */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label className={fieldLabel}>Hours per week</label>
                <span className="text-sm font-semibold text-black tabular-nums">
                  {form.hours_per_week} hr{form.hours_per_week !== 1 && "s"}
                </span>
              </div>
              <input
                type="range" min={1} max={20} step={1}
                className="ontrack-range w-full"
                value={form.hours_per_week}
                style={{ background: `linear-gradient(to right, ${GREEN} 0%, ${GREEN} ${sliderPct}, ${INK_05} ${sliderPct}, ${INK_05} 100%)` }}
                onChange={e => patch({ hours_per_week: Number(e.target.value) })}
              />
              <div className="flex justify-between text-xs text-black/25">
                <span>1 hr</span><span>20 hrs</span>
              </div>
            </div>
            {/* Days */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label className={fieldLabel}>Preferred days</label>
                <span className="text-xs text-black/30">
                  {form.selected_days.length === 0 ? "AI decides" : `${form.selected_days.length} selected`}
                </span>
              </div>
              <div className="flex gap-1.5">
                {DAYS.map(day => {
                  const active = form.selected_days.includes(day);
                  const abbr = DAY_ABBR[day] ?? day.slice(0, 2);
                  return (
                    <button key={day} type="button"
                      onClick={() => patch({
                        selected_days: form.selected_days.includes(day)
                          ? form.selected_days.filter(d => d !== day)
                          : [...form.selected_days, day],
                      })}
                      className={`flex-1 py-2 text-xs font-medium rounded-lg border transition-all ${
                        active ? "bg-black border-black text-white" : "bg-white border-black/10 text-black/35 hover:border-black/25 hover:text-black/60"
                      }`}
                    >{abbr}</button>
                  );
                })}
              </div>
            </div>
            {/* Daily limit */}
            <div className="flex flex-col gap-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <button type="button" role="switch" aria-checked={form.has_daily_limit}
                  onClick={() => patch({ has_daily_limit: !form.has_daily_limit })}
                  className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ${form.has_daily_limit ? "bg-black" : "bg-black/15"}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.has_daily_limit ? "translate-x-4" : "translate-x-0"}`} />
                </button>
                <span className="text-sm text-black/60">Daily time limit</span>
              </label>
              {form.has_daily_limit && (
                <div className="flex items-center gap-3 ml-12">
                  <input type="number" min={15} max={480} step={15}
                    className="px-3 py-2 border border-black/10 rounded-xl bg-white text-black text-sm w-24 focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-black/30 transition-colors"
                    value={form.daily_limit_minutes}
                    onChange={e => patch({ daily_limit_minutes: Number(e.target.value) })}
                  />
                  <span className="text-sm text-black/40">minutes per day</span>
                </div>
              )}
            </div>
          </section>

          {/* Personalisation questions */}
          {form.followup_questions.length > 0 && (
            <section className={cardCls}>
              <h2 className="text-sm font-semibold text-black">Personalisation</h2>
              <div className="flex flex-col gap-5">
                {form.followup_questions.map((fq, i) => (
                  <QuestionInput key={i} fq={fq} index={i} updateAnswer={updateAnswer} />
                ))}
              </div>
            </section>
          )}

          {/* Additional context */}
          <section className={cardCls}>
            <h2 className="text-sm font-semibold text-black">Additional context</h2>
            <div className="flex flex-col gap-2">
              <label className={fieldLabel}>Restrictions</label>
              {form.restrictions.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {form.restrictions.map((r, i) => (
                    <span key={i} className="inline-flex items-center gap-1 text-xs bg-black/5 border border-black/10 rounded-full pl-3 pr-1.5 py-1 text-black/60">
                      {r}
                      <button onClick={() => patch({ restrictions: form.restrictions.filter((_, j) => j !== i) })}
                        className="w-4 h-4 flex items-center justify-center rounded-full text-black/30 hover:text-black hover:bg-black/10 transition-colors">×</button>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <input className={inputCls} placeholder="e.g. Wrist soreness, no loud practice after 10pm"
                  value={newRestriction}
                  onChange={e => setNewRestriction(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter" && newRestriction.trim()) {
                      patch({ restrictions: [...form.restrictions, newRestriction.trim()] });
                      setNewRestriction("");
                    }
                  }}
                />
                <button onClick={() => { if (!newRestriction.trim()) return; patch({ restrictions: [...form.restrictions, newRestriction.trim()] }); setNewRestriction(""); }}
                  disabled={!newRestriction.trim()}
                  className="px-3 py-2 bg-white border border-black/10 rounded-xl text-black text-sm hover:bg-black/5 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">Add</button>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <label className={fieldLabel}>Background & context</label>
              <textarea className={`${inputCls} min-h-[100px] resize-y`}
                placeholder="e.g. I know basic open chords and want to perform at an open mic in 2 months."
                value={form.additional_context}
                onChange={e => patch({ additional_context: e.target.value })}
              />
            </div>
          </section>

          {/* Post-save regen prompt */}
          {showRegenPrompt && (
            <div className="rounded-2xl border border-black/8 bg-white p-4 flex flex-col gap-3 shadow-sm">
              <p className="text-sm text-black font-medium">Goal saved!</p>
              <p className="text-sm text-black/50">Would you like to regenerate the plan blocks for <span className="text-black font-medium">{form.title}</span>? Other goals won't be affected.</p>
              {regenError && <p className="text-xs text-red-500">{regenError}</p>}
              <div className="flex gap-2">
                <button onClick={regenerateSavedGoal} disabled={regenLoading}
                  className="flex-1 py-2 bg-black rounded-full text-white text-sm font-medium hover:bg-black/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                  {regenLoading ? "Regenerating…" : "Regenerate"}
                </button>
                <button onClick={() => navigate("/")} disabled={regenLoading}
                  className="flex-1 py-2 border border-black/10 rounded-full text-black/40 text-sm hover:border-black/25 hover:text-black/70 disabled:opacity-50 transition-colors">
                  Not now
                </button>
              </div>
            </div>
          )}

          {/* Actions */}
          {!showRegenPrompt && (
            <div className="flex items-center gap-3 pt-1">
              <button className="flex-1 py-2.5 bg-black rounded-full text-white text-sm font-medium hover:bg-black/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                onClick={handleEditSave} disabled={!form.title.trim() || saveLoading}>
                {saveLoading ? "Checking…" : "Save changes"}
              </button>
              {showDeleteConfirm ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-black/40 whitespace-nowrap">Are you sure?</span>
                  <button className="px-3 py-2.5 bg-red-50 border border-red-200 rounded-full text-red-500 text-sm hover:bg-red-100 transition-colors" onClick={deleteGoal}>Delete</button>
                  <button className="px-3 py-2.5 text-sm text-black/40 hover:text-black transition-colors" onClick={() => setShowDeleteConfirm(false)}>Cancel</button>
                </div>
              ) : (
                <button className="px-4 py-2.5 border border-black/10 rounded-full text-black/40 text-sm hover:border-red-200 hover:text-red-500 transition-colors"
                  onClick={() => setShowDeleteConfirm(true)}>Delete</button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── New goal — 3-step wizard + success ────────────────────────
  const lastGoal = goals.length > 0 ? goals[goals.length - 1] : null;

  return (
    <div style={{ minHeight: "100vh", background: "#F9F9F9", color: "#0d0d0d" }}>
      {/* Topbar */}
      <Topbar step={step} onBack={handleBack} savedState={savedState} />

      {/* Main content */}
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "40px 28px 120px" }}>

        {/* Stepper (hidden on success) */}
        {step !== 4 && <Stepper step={step as 1 | 2 | 3} />}

        {/* ── Step 1: what do you want to get good at? ── */}
        {step === 1 && (
          <div key={1} className="step-fade">
            {/* Heading */}
            <h1 style={{ fontSize: 36, fontWeight: 800, letterSpacing: "-0.025em", lineHeight: 1.04, marginBottom: 14, color: "#0d0d0d" }}>
              what do you want to <Slab>get good at?</Slab>
            </h1>
            <p style={{ fontSize: 14, color: INK_40, marginBottom: 32, lineHeight: 1.6 }}>
              ontrack is built for long-term growth — skills and habits you want to genuinely develop over weeks or months. be specific; the more detail, the better your plan.
            </p>

            {/* Draft strip */}
            {lastGoal && showDraft && (
              <div style={{
                display: "flex", alignItems: "center", gap: 12,
                background: GREEN, borderRadius: 14, padding: "14px 16px",
                marginBottom: 24, color: "#fff",
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: "50%",
                  background: "rgba(255,255,255,0.25)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 16, flexShrink: 0,
                }}>↻</div>
                <span style={{ flex: 1, fontSize: 14, lineHeight: 1.4 }}>
                  <strong>you have a recent draft.</strong> pick up where you left off, or start fresh.
                </span>
                <button
                  onClick={() => navigate(`/goals/${lastGoal.id}`)}
                  style={{
                    padding: "7px 16px", borderRadius: 999, background: "#fff",
                    color: GREEN, fontWeight: 600, fontSize: 13, border: "none", cursor: "pointer", flexShrink: 0,
                  }}
                >resume</button>
                <button
                  onClick={() => setShowDraft(false)}
                  aria-label="dismiss"
                  style={{
                    width: 28, height: 28, borderRadius: "50%",
                    background: "rgba(255,255,255,0.2)", border: "none",
                    color: "#fff", fontSize: 16, cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                  }}
                >×</button>
              </div>
            )}

            {/* Goal input */}
            <textarea
              autoFocus
              rows={3}
              placeholder="e.g. Learn fingerstyle guitar, run a 5K, build a morning routine…"
              value={form.title}
              onChange={e => { patch({ title: e.target.value }); if (titleError) setTitleError(""); }}
              style={{
                width: "100%", padding: "18px 20px", borderRadius: 14,
                border: `1px solid ${INK_12}`, background: "#fff",
                fontSize: 17, fontWeight: 500, color: "#0d0d0d",
                resize: "vertical", outline: "none", boxSizing: "border-box",
                fontFamily: "inherit", lineHeight: 1.5, display: "block",
              }}
              onFocus={e => (e.target.style.boxShadow = `0 0 0 4px ${GREEN_BG}`)}
              onBlur={e => (e.target.style.boxShadow = "none")}
            />
            {titleError && (
              <p style={{ fontSize: 12, color: "#ef4444", marginTop: 6 }}>{titleError}</p>
            )}

            {/* Suggestion chips */}
            <div style={{ marginTop: 20, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 12.5, color: INK_40 }}>try one of these →</span>
              {CHIPS.map(chip => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => patch({ title: chip })}
                  style={{
                    padding: "6px 14px", borderRadius: 999,
                    border: `1px solid ${form.title === chip ? INK_25 : INK_12}`,
                    background: form.title === chip ? INK_05 : "#fff",
                    color: form.title === chip ? "#0d0d0d" : INK_40,
                    fontSize: 13, cursor: "pointer", transition: "all .15s",
                  }}
                >{chip}</button>
              ))}
            </div>

            {/* Skill level */}
            <p style={{ fontSize: 12.5, color: INK_40, marginTop: 28, marginBottom: 10, fontWeight: 500 }}>
              your current level
            </p>
            <div style={{
              display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
              border: `1px solid ${INK_12}`, borderRadius: 14, overflow: "hidden",
            }}>
              {(["beginner", "intermediate", "advanced"] as Goal["skill_level"][]).map((lvl, i) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => patch({ skill_level: lvl })}
                  style={{
                    padding: "14px 16px", textAlign: "center",
                    background: form.skill_level === lvl ? GREEN_BG : "#fff",
                    color: form.skill_level === lvl ? GREEN_INK : INK_40,
                    fontWeight: form.skill_level === lvl ? 600 : 500,
                    fontSize: 14, border: "none", cursor: "pointer",
                    borderRight: i < 2 ? `1px solid ${INK_12}` : "none",
                    transition: "all .15s",
                  }}
                >
                  {lvl}
                </button>
              ))}
            </div>

            {/* Footer */}
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 32 }}>
              <button
                disabled={!form.title.trim()}
                onClick={() => setStep(2)}
                style={{
                  padding: "13px 28px", borderRadius: 999,
                  background: !form.title.trim() ? INK_12 : GREEN,
                  color: "#fff", fontWeight: 600, fontSize: 15, border: "none",
                  cursor: form.title.trim() ? "pointer" : "not-allowed",
                  transition: "background .15s",
                }}
              >
                continue →
              </button>
            </div>
          </div>
        )}

        {/* ── Step 2: pick your pace ── */}
        {step === 2 && (
          <div key={2} className="step-fade">
            <h1 style={{ fontSize: 36, fontWeight: 800, letterSpacing: "-0.025em", lineHeight: 1.04, marginBottom: 14, color: "#0d0d0d" }}>
              pick your <Slab>pace.</Slab>
            </h1>
            <p style={{ fontSize: 14, color: INK_40, marginBottom: 32, lineHeight: 1.6 }}>
              how long is this goal, and how much time can you realistically give it each week? you can change this anytime.
            </p>

            {/* Timeframe card */}
            <div style={{
              background: "#fff", border: `1px solid ${INK_12}`, borderRadius: 16,
              padding: 22, marginBottom: 16,
            }}>
              <p style={{ fontSize: 15, fontWeight: 700, marginBottom: 4, color: "#0d0d0d" }}>goal timeframe</p>
              <p style={{ fontSize: 13, color: INK_40, marginBottom: 16 }}>how long do you want to work on this?</p>
              {/* Chip row */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {TIMEFRAME_OPTIONS.map(opt => {
                  const active = timeframeChip === opt.label;
                  return (
                    <button
                      key={opt.label}
                      type="button"
                      onClick={() => {
                        setTimeframeChip(opt.label);
                        const tf = chipToTimeframe(opt.days);
                        if (tf !== null) patch({ timeframe: tf });
                      }}
                      style={{
                        padding: "8px 16px", borderRadius: 999,
                        border: `1px solid ${active ? GREEN : INK_12}`,
                        background: active ? GREEN_BG : "#fff",
                        color: active ? GREEN_INK : INK_40,
                        fontWeight: active ? 600 : 500,
                        fontSize: 13, cursor: "pointer", transition: "all .15s",
                      }}
                    >{opt.label}</button>
                  );
                })}
              </div>
              {/* Custom date pickers */}
              {timeframeChip === "custom…" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 16 }}>
                  <div>
                    <label style={{ fontSize: 12, color: INK_40, display: "block", marginBottom: 6 }}>Start date</label>
                    <input type="date"
                      className={inputCls}
                      value={form.timeframe.start_date}
                      onChange={e => patch({ timeframe: { ...form.timeframe, start_date: e.target.value } })}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, color: INK_40, display: "block", marginBottom: 6 }}>End date</label>
                    <input type="date"
                      className={inputCls}
                      value={form.timeframe.end_date}
                      onChange={e => patch({ timeframe: { ...form.timeframe, end_date: e.target.value } })}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Pace + days card */}
            <div style={{
              background: "#fff", border: `1px solid ${INK_12}`, borderRadius: 16,
              padding: 22, marginBottom: 16,
            }}>
              {/* Hours slider */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <span style={{ fontSize: 13, color: INK_40, fontWeight: 500 }}>hours per week</span>
                <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.01em", color: "#0d0d0d" }}>
                  {form.hours_per_week}
                  <span style={{ fontSize: 13, fontWeight: 600, color: INK_40, marginLeft: 4 }}>hrs</span>
                </span>
              </div>
              <input
                type="range" min={1} max={20} step={1}
                className="ontrack-range"
                value={form.hours_per_week}
                style={{ background: `linear-gradient(to right, ${GREEN} 0%, ${GREEN} ${sliderPct}, ${INK_05} ${sliderPct}, ${INK_05} 100%)` }}
                onChange={e => patch({ hours_per_week: Number(e.target.value) })}
              />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: INK_40, marginTop: 6 }}>
                <span>1 hr</span><span>20 hrs</span>
              </div>

              {/* Days */}
              <div style={{ marginTop: 22 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ fontSize: 12, color: INK_40, fontWeight: 500 }}>preferred days</span>
                  <span style={{ fontSize: 12, color: INK_40 }}>{form.selected_days.length} selected</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8 }}>
                  {DAYS.map(day => {
                    const active = form.selected_days.includes(day);
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => patch({
                          selected_days: active
                            ? form.selected_days.filter(d => d !== day)
                            : [...form.selected_days, day],
                        })}
                        style={{
                          padding: "10px 0", borderRadius: 10,
                          background: active ? GREEN : INK_05,
                          color: active ? "#fff" : INK_25,
                          fontWeight: 700, fontSize: 12, textTransform: "uppercase",
                          border: "none", cursor: "pointer", transition: "all .15s",
                        }}
                      >{DAY_ABBR[day]}</button>
                    );
                  })}
                </div>
              </div>

              {/* Daily limit toggle */}
              <div style={{
                marginTop: 18, paddingTop: 18,
                borderTop: `1px dashed ${INK_08}`,
                display: "flex", alignItems: "center", justifyContent: "space-between",
              }}>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 600, color: "#0d0d0d" }}>daily time limit</p>
                  <p style={{ fontSize: 12, color: INK_40, marginTop: 2 }}>cap any single session (e.g. never more than 90 min)</p>
                </div>
                {/* Toggle */}
                <button
                  type="button"
                  role="switch"
                  aria-checked={form.has_daily_limit}
                  onClick={() => patch({ has_daily_limit: !form.has_daily_limit })}
                  style={{
                    width: 40, height: 22, borderRadius: 999,
                    background: form.has_daily_limit ? GREEN : INK_12,
                    border: "none", cursor: "pointer", position: "relative",
                    transition: "background .2s", flexShrink: 0,
                  }}
                >
                  <span style={{
                    position: "absolute", top: 3, left: 3, width: 16, height: 16,
                    borderRadius: "50%", background: "#fff",
                    transform: form.has_daily_limit ? "translateX(18px)" : "none",
                    transition: "transform .2s",
                    boxShadow: "0 1px 3px rgba(0,0,0,.15)",
                  }} />
                </button>
              </div>
              {form.has_daily_limit && (
                <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 10 }}>
                  <input
                    type="number" min={15} max={480} step={15}
                    className={inputCls}
                    style={{ width: 100 }}
                    value={form.daily_limit_minutes}
                    onChange={e => patch({ daily_limit_minutes: Number(e.target.value) })}
                  />
                  <span style={{ fontSize: 13, color: INK_40 }}>minutes per day</span>
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
              <button onClick={() => setStep(1)}
                style={{ fontSize: 14, color: INK_40, background: "none", border: "none", cursor: "pointer", padding: "10px 0" }}
                onMouseEnter={e => (e.currentTarget.style.color = "#0d0d0d")}
                onMouseLeave={e => (e.currentTarget.style.color = INK_40)}
              >← back</button>
              <button
                onClick={() => {
                  setStep(3);
                  if (form.followup_questions.length === 0 && !qLoading) {
                    generateQuestions();
                  }
                }}
                style={{
                  padding: "13px 28px", borderRadius: 999,
                  background: GREEN, color: "#fff", fontWeight: 600, fontSize: 15,
                  border: "none", cursor: "pointer",
                }}
              >continue →</button>
            </div>
          </div>
        )}

        {/* ── Step 3: a few personal touches ── */}
        {step === 3 && (
          <div key={3} className="step-fade">
            <h1 style={{ fontSize: 36, fontWeight: 800, letterSpacing: "-0.025em", lineHeight: 1.04, marginBottom: 14, color: "#0d0d0d" }}>
              a few <Slab>personal touches.</Slab>
            </h1>
            <p style={{ fontSize: 14, color: INK_40, marginBottom: 32, lineHeight: 1.6 }}>
              help the ai shape a plan that actually fits your life. all optional — skip what doesn't apply.
            </p>

            {/* AI questions loading */}
            {qLoading && (
              <div style={{ textAlign: "center", padding: "40px 0" }}>
                <div style={{
                  width: 36, height: 36, borderRadius: "50%",
                  border: `2px solid ${GREEN_BG}`, borderTop: `2px solid ${GREEN}`,
                  animation: "spin 0.8s linear infinite",
                  margin: "0 auto 12px",
                }} />
                <p style={{ fontSize: 14, color: INK_40 }}>personalising your questions…</p>
              </div>
            )}

            {/* AI questions error */}
            {qError && !qLoading && (
              <div style={{
                background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 12,
                padding: "14px 16px", marginBottom: 16, display: "flex",
                alignItems: "center", justifyContent: "space-between", gap: 12,
              }}>
                <p style={{ fontSize: 13, color: "#dc2626" }}>{qError}</p>
                <button onClick={generateQuestions}
                  style={{
                    padding: "6px 14px", borderRadius: 999, background: "#dc2626",
                    color: "#fff", fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer",
                  }}>retry</button>
              </div>
            )}

            {/* AI question cards */}
            {!qLoading && form.followup_questions.map((fq, i) => (
              <div key={i} style={{
                background: "#fff", border: `1px solid ${INK_12}`, borderRadius: 16,
                padding: 22, marginBottom: 14,
              }}>
                <QuestionInput fq={fq} index={i} updateAnswer={updateAnswer} />
              </div>
            ))}

            {/* Restrictions card */}
            <div style={{
              background: "#fff", border: `1px solid ${INK_12}`, borderRadius: 16,
              padding: 22, marginBottom: 14,
            }}>
              <p style={{ fontSize: 14.5, fontWeight: 600, lineHeight: 1.4, color: "#0d0d0d", marginBottom: 6 }}>
                anything to keep in mind?
              </p>
              <p style={{ fontSize: 12, color: INK_40, marginBottom: 12 }}>
                injuries, equipment limits, noise restrictions — optional.
              </p>
              {form.restrictions.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                  {form.restrictions.map((r, i) => (
                    <span key={i} style={{
                      display: "inline-flex", alignItems: "center", gap: 4,
                      padding: "4px 10px 4px 12px", borderRadius: 999,
                      background: INK_05, border: `1px solid ${INK_12}`,
                      fontSize: 12, color: INK_60,
                    }}>
                      {r}
                      <button
                        onClick={() => patch({ restrictions: form.restrictions.filter((_, j) => j !== i) })}
                        style={{
                          width: 16, height: 16, borderRadius: "50%",
                          background: "none", border: "none", cursor: "pointer",
                          color: INK_40, fontSize: 14, display: "flex",
                          alignItems: "center", justifyContent: "center",
                        }}
                      >×</button>
                    </span>
                  ))}
                </div>
              )}
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  placeholder="e.g. Wrist soreness, no loud practice after 10pm…"
                  value={newRestriction}
                  onChange={e => setNewRestriction(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter" && newRestriction.trim()) {
                      patch({ restrictions: [...form.restrictions, newRestriction.trim()] });
                      setNewRestriction("");
                    }
                  }}
                  style={{
                    flex: 1, padding: "10px 14px", borderRadius: 10,
                    border: `1px solid ${INK_12}`, background: "#fff",
                    fontSize: 13, color: "#0d0d0d", outline: "none",
                  }}
                  onFocus={e => (e.target.style.boxShadow = `0 0 0 4px ${GREEN_BG}`)}
                  onBlur={e => (e.target.style.boxShadow = "none")}
                />
                <button
                  onClick={() => {
                    if (!newRestriction.trim()) return;
                    patch({ restrictions: [...form.restrictions, newRestriction.trim()] });
                    setNewRestriction("");
                  }}
                  disabled={!newRestriction.trim()}
                  style={{
                    padding: "10px 18px", borderRadius: 10,
                    border: `1px solid ${INK_12}`, background: "#fff",
                    fontSize: 13, color: INK_40, cursor: newRestriction.trim() ? "pointer" : "not-allowed",
                    opacity: newRestriction.trim() ? 1 : 0.5,
                  }}
                >add</button>
              </div>
            </div>

            {/* Context card */}
            <div style={{
              background: "#fff", border: `1px solid ${INK_12}`, borderRadius: 16,
              padding: 22, marginBottom: 14,
            }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: "#0d0d0d", marginBottom: 4 }}>
                background & context
              </p>
              <p style={{ fontSize: 12, color: INK_40, marginBottom: 12 }}>
                current level details, deadlines, sub-goals — anything that should shape your plan.
              </p>
              <textarea
                rows={4}
                placeholder="e.g. I know basic open chords and can play simple songs. I want to perform at an open mic in 2 months."
                value={form.additional_context}
                onChange={e => patch({ additional_context: e.target.value })}
                style={{
                  width: "100%", minHeight: 90, padding: "10px 14px", borderRadius: 10,
                  border: `1px solid ${INK_12}`, background: "#fff",
                  fontSize: 13, color: "#0d0d0d", resize: "vertical",
                  outline: "none", fontFamily: "inherit", lineHeight: 1.5,
                  boxSizing: "border-box",
                }}
                onFocus={e => (e.target.style.boxShadow = `0 0 0 4px ${GREEN_BG}`)}
                onBlur={e => (e.target.style.boxShadow = "none")}
              />
            </div>

            {/* Schedule notice strip */}
            {!hasSchedule && (
              <div style={{
                display: "flex", alignItems: "flex-start", gap: 12,
                background: GREEN_BG, borderRadius: 12, padding: "14px 16px", marginBottom: 16,
              }}>
                <div style={{
                  width: 28, height: 28, borderRadius: "50%",
                  background: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 14, color: GREEN_INK, flexShrink: 0,
                }}>ⓘ</div>
                <p style={{ fontSize: 13, color: GREEN_INK, lineHeight: 1.5 }}>
                  <strong>heads up —</strong> you haven't set your weekly availability yet, so tasks will use default times.{" "}
                  <button onClick={() => navigate("/profile")}
                    style={{ color: GREEN_INK, fontWeight: 600, textDecoration: "underline", background: "none", border: "none", cursor: "pointer", padding: 0, fontSize: 13 }}>
                    set it now
                  </button>{" "}
                  or continue and update it later.
                </p>
              </div>
            )}

            {/* Generate error */}
            {generateError && (
              <div style={{
                background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 12,
                padding: "14px 16px", marginBottom: 16,
              }}>
                <p style={{ fontSize: 13, color: "#dc2626" }}>{generateError}</p>
              </div>
            )}

            {/* Generating spinner */}
            {generating && (
              <div style={{ textAlign: "center", padding: "40px 0" }}>
                <div style={{
                  width: 40, height: 40, borderRadius: "50%",
                  border: `2px solid ${GREEN_BG}`, borderTop: `2px solid ${GREEN}`,
                  animation: "spin 0.8s linear infinite",
                  margin: "0 auto 16px",
                }} />
                <p style={{ fontSize: 14, color: INK_40 }}>building your personalised plan…</p>
                <p style={{ fontSize: 12, color: INK_25, marginTop: 6 }}>this usually takes 10–20 seconds</p>
              </div>
            )}

            {/* Footer */}
            {!generating && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                <button onClick={() => setStep(2)}
                  style={{ fontSize: 14, color: INK_40, background: "none", border: "none", cursor: "pointer", padding: "10px 0" }}
                  onMouseEnter={e => (e.currentTarget.style.color = "#0d0d0d")}
                  onMouseLeave={e => (e.currentTarget.style.color = INK_40)}
                >← back</button>
                <button
                  onClick={handleGenerate}
                  disabled={saveLoading || !form.title.trim()}
                  style={{
                    padding: "13px 28px", borderRadius: 999,
                    background: saveLoading || !form.title.trim() ? INK_12 : GREEN,
                    color: "#fff", fontWeight: 600, fontSize: 15,
                    border: "none", cursor: saveLoading || !form.title.trim() ? "not-allowed" : "pointer",
                    transition: "background .15s",
                  }}
                >
                  {saveLoading ? "checking…" : "make my plan →"}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Step 4: success ── */}
        {step === 4 && (
          <div key={4} className="step-fade" style={{ textAlign: "center", paddingTop: 40 }}>
            {/* Green tick circle */}
            <div style={{
              width: 72, height: 72, borderRadius: "50%",
              background: GREEN, margin: "0 auto 28px",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: `0 0 0 10px ${GREEN_BG}`,
            }}>
              <svg width="32" height="26" viewBox="0 0 32 26" fill="none">
                <path d="M2 13l9 10.5L30 2" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h1 style={{ fontSize: 40, fontWeight: 800, letterSpacing: "-0.025em", lineHeight: 1.04, marginBottom: 16, color: "#0d0d0d" }}>
              your plan is <Slab>in motion.</Slab>
            </h1>
            <p style={{ fontSize: 15, color: INK_60, lineHeight: 1.6, maxWidth: 420, margin: "0 auto 36px" }}>
              we've scheduled your first two weeks around your availability. miss a day? we'll reshuffle — no guilt trips.
            </p>
            <button
              onClick={() => navigate("/")}
              style={{
                padding: "15px 36px", borderRadius: 999,
                background: GREEN, color: "#fff", fontWeight: 600, fontSize: 16,
                border: "none", cursor: "pointer",
              }}
            >
              see my goals →
            </button>
          </div>
        )}
      </div>

      {/* Spin keyframe injected as style tag */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
