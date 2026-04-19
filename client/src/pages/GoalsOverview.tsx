import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import type { Goal, DayPlan } from "../context/AppContext";
import { useAuth } from "../context/AuthContext";

const API_BASE = import.meta.env.VITE_API_BASE;

function toDateStr(d: Date) {
  return d.toLocaleDateString("en-CA");
}

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

// ── Onboarding modal ──────────────────────────────────────────────────────────

function OnboardingModal({ onClose, onCTA }: { onClose: () => void; onCTA: () => void }) {
  const [slide, setSlide] = useState(
    localStorage.getItem("ontrack_onboarding_seen") === "true" ? 3 : 0
  );

  const SLIDES = [
    {
      headline: "Built for the long game.",
      sub: "Not a to-do list. Not a study planner. OnTrack is for skills and habits you want to build over weeks and months — the guitar, the language, the body, the craft.",
      visual: (
        <div className="flex flex-col gap-2">
          {[
            { emoji: "🎸", title: "Learn guitar",       meta: "Intermediate · 4 hrs/wk" },
            { emoji: "🌍", title: "Speak Spanish",       meta: "Beginner · 3 hrs/wk"     },
            { emoji: "🏃", title: "Run a half marathon", meta: "Beginner · 5 hrs/wk"     },
          ].map((g) => (
            <div key={g.title} className="flex items-center gap-3 rounded-xl border border-black/8 bg-[#F9F9F9] px-3.5 py-2.5 shadow-sm">
              <span className="text-lg shrink-0">{g.emoji}</span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-black">{g.title}</p>
                <p className="text-[11px] text-black/35 mt-0.5">{g.meta}</p>
              </div>
              <span className="ml-auto text-black/15 text-sm">›</span>
            </div>
          ))}
        </div>
      ),
    },
    {
      headline: "Tell us what you want to build.",
      sub: "Give it a title, pick your level, set how many hours a week you can commit. That's it for now.",
      visual: (
        <div className="flex flex-col gap-3 rounded-xl border border-black/8 bg-[#F9F9F9] p-3.5 shadow-sm">
          <div className="px-3 py-2.5 rounded-xl border border-black/10 bg-white text-black/25 text-sm">
            e.g. Learn guitar
          </div>
          <div className="flex gap-2">
            {["Beginner", "Intermediate", "Advanced"].map((lvl) => (
              <button
                key={lvl}
                type="button"
                className={`flex-1 py-2 rounded-full border text-xs font-medium transition-all ${
                  lvl === "Beginner"
                    ? "bg-black border-black text-white"
                    : "bg-white border-black/10 text-black/35"
                }`}
              >
                {lvl}
              </button>
            ))}
          </div>
        </div>
      ),
    },
    {
      headline: "The AI will ask a few questions.",
      sub: "A quick back-and-forth to understand where you're starting and what's in your way. Takes about 2 minutes.",
      visual: (
        <div className="flex flex-col gap-2">
          <div className="max-w-[85%] self-start rounded-2xl rounded-tl-sm px-3.5 py-2.5 bg-white border border-black/8 shadow-sm">
            <p className="text-xs text-black/60 leading-relaxed">Do you have access to a guitar right now?</p>
          </div>
          <div className="max-w-[85%] self-end rounded-2xl rounded-tr-sm px-3.5 py-2.5 bg-black">
            <p className="text-xs text-white leading-relaxed">Yes, I have an acoustic at home.</p>
          </div>
        </div>
      ),
    },
    {
      headline: "Your week, fully mapped.",
      sub: "Sessions, times, tasks — scheduled around your life automatically. Ready to build your first goal?",
      visual: (
        <div className="rounded-xl border border-black/8 bg-white shadow-sm overflow-hidden">
          <div className="px-3.5 py-2.5 border-b border-black/6">
            <span className="text-xs font-semibold text-black">Monday</span>
          </div>
          <div className="divide-y divide-black/5">
            {[
              { time: "7:00 AM", label: "Guitar Practice", tasks: ["Chord transitions · 20 min"] },
              { time: "6:00 PM", label: "Evening Run",     tasks: ["Easy 3 km · 30 min"]        },
            ].map((block) => (
              <div key={block.label} className="px-3.5 py-2.5 flex gap-3">
                <span className="text-[10px] text-black/25 pt-0.5 w-12 shrink-0 tabular-nums">{block.time}</span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-black mb-1">{block.label}</p>
                  {block.tasks.map((t) => (
                    <div key={t} className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full border border-black/20 shrink-0" />
                      <p className="text-[11px] text-black/40">{t}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ),
    },
  ] as const;

  const isLast = slide === 3;
  const current = SLIDES[slide];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-white border border-black/8 rounded-2xl shadow-xl overflow-hidden">
        {/* Card header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-1">
          {/* Dot indicators */}
          <div className="flex gap-1.5">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className={`h-1 rounded-full transition-all duration-200 ${
                  i === slide ? "w-5 bg-black" : "w-1.5 bg-black/12"
                }`}
              />
            ))}
          </div>
          {/* Close */}
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full text-black/30 hover:text-black hover:bg-black/5 transition-colors text-lg leading-none"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="px-5 pt-4 pb-5 flex flex-col gap-4">
          {/* Visual */}
          <div>{current.visual}</div>

          {/* Text */}
          <div>
            <h2 className="text-base font-bold text-black tracking-tight mb-1">{current.headline}</h2>
            <p className="text-sm text-black/40 leading-relaxed">{current.sub}</p>
          </div>

          {/* Actions */}
          {isLast ? (
            <button
              onClick={onCTA}
              className="w-full py-3 bg-black text-white rounded-full font-semibold text-sm hover:bg-black/80 transition-colors"
            >
              Create my first goal →
            </button>
          ) : (
            <button
              onClick={() => setSlide((s) => (s + 1) as 0 | 1 | 2 | 3)}
              className="w-full py-3 rounded-full border border-black/10 text-black text-sm font-medium hover:border-black/20 hover:bg-black/[0.02] transition-colors"
            >
              Next →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Save prompt modal ─────────────────────────────────────────────────────────

function SavePromptModal({ onSignUp, onDismiss }: { onSignUp: () => void; onDismiss: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-white border border-black/8 rounded-2xl shadow-xl overflow-hidden">
        <div className="p-6">
          <div className="text-center mb-6">
            <div className="text-4xl mb-3 select-none">🎉</div>
            <h2 className="text-lg font-bold text-black mb-2 tracking-tight">
              Your first week is ready.
            </h2>
            <p className="text-sm text-black/40 leading-relaxed">
              You've done the hard part. Create a free account to save your goals and plan —
              <span className="text-amber-600"> they'll disappear when you close this tab.</span>
            </p>
          </div>

          <div className="flex flex-col gap-2 mb-6">
            {[
              "Access your plan from any device",
              "Your goals are saved permanently",
              "Regenerate and adjust anytime",
            ].map((b) => (
              <div key={b} className="flex items-center gap-2.5">
                <div className="w-4 h-4 rounded-full bg-black/5 border border-black/10 flex items-center justify-center shrink-0">
                  <svg className="w-2 h-2 text-black/60" viewBox="0 0 8 8" fill="currentColor">
                    <path fillRule="evenodd" d="M7.03 1.47a.75.75 0 0 1 0 1.06L3.37 6.19a.75.75 0 0 1-1.06 0L.47 4.35a.75.75 0 0 1 1.06-1.06l1.31 1.31 3.13-3.13a.75.75 0 0 1 1.06 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <span className="text-xs text-black/50">{b}</span>
              </div>
            ))}
          </div>

          <button
            onClick={onSignUp}
            className="w-full py-3.5 bg-black text-white rounded-full font-semibold text-sm hover:bg-black/80 transition-colors mb-3"
          >
            Save my plan — it's free →
          </button>
          <button
            onClick={onDismiss}
            className="w-full py-2.5 text-xs text-black/25 hover:text-black/50 transition-colors"
          >
            Continue without saving
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

// ── Regenerate-goal feedback modal ────────────────────────────────────────────

function RegenGoalModal({
  goal,
  onConfirm,
  onCancel,
}: {
  goal: Goal;
  onConfirm: (feedback: string, save: boolean) => void;
  onCancel: () => void;
}) {
  const [feedback, setFeedback] = useState("");
  const [save,     setSave]     = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-white border border-black/8 rounded-2xl shadow-xl overflow-hidden">
        <div className="px-5 pt-5 pb-1 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-black tracking-tight">Regenerate blocks</h2>
            <p className="text-xs text-black/40 mt-0.5">"{goal.title}"</p>
          </div>
          <button
            onClick={onCancel}
            className="w-7 h-7 flex items-center justify-center rounded-full text-black/30 hover:text-black hover:bg-black/5 transition-colors text-lg leading-none shrink-0"
          >
            ×
          </button>
        </div>

        <div className="px-5 pt-4 pb-5 flex flex-col gap-4">
          {/* Feedback */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-black/60">
              What would you like changed? <span className="text-black/30 font-normal">(optional)</span>
            </label>
            <textarea
              value={feedback}
              onChange={e => setFeedback(e.target.value)}
              placeholder="e.g. Earlier time slots, more variety, shorter sessions…"
              rows={3}
              className="w-full rounded-xl border border-black/10 bg-white px-3.5 py-2.5 text-sm text-black placeholder:text-black/25 resize-none focus:outline-none focus:border-black/25 transition-colors"
              autoFocus
            />
          </div>

          {/* Save toggle */}
          <button
            type="button"
            onClick={() => setSave(s => !s)}
            className="flex items-center gap-3 group"
          >
            {/* Pill toggle */}
            <div
              className={`relative w-9 h-5 rounded-full transition-colors duration-200 shrink-0 ${
                save ? "bg-black" : "bg-black/15"
              }`}
            >
              <div
                className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-all duration-200 ${
                  save ? "left-[18px]" : "left-0.5"
                }`}
              />
            </div>
            <span className="text-sm text-black/60 group-hover:text-black/80 transition-colors text-left">
              Save this feedback to my goal
              <span className="block text-xs text-black/35 font-normal mt-0.5">
                The AI will remember this preference in future plans
              </span>
            </span>
          </button>

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={onCancel}
              className="flex-1 py-3 rounded-full border border-black/10 text-black/50 text-sm font-medium hover:border-black/20 hover:text-black/70 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => onConfirm(feedback.trim(), save)}
              className="flex-1 py-3 rounded-full bg-black text-white text-sm font-semibold hover:bg-black/80 active:scale-[0.98] transition-all"
            >
              Regenerate →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function GoalsOverview() {
  const { goals, setGoals, schedule, plan, setPlan, showToast } = useApp();
  const { isAuthenticated, getToken, openAuthModal } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [loading,          setLoading]          = useState(false);
  const [error,            setError]            = useState("");
  const [regenGoalId,      setRegenGoalId]      = useState<string | null>(null);
  const [regenError,       setRegenError]       = useState<string | null>(null);
  const [regenModalGoalId, setRegenModalGoalId] = useState<string | null>(null);
  const [showSavePrompt, setShowSavePrompt] = useState(
    () => !isAuthenticated && (location.state as { showSave?: boolean } | null)?.showSave === true
  );

  // Onboarding overlay
  const [showOnboarding, setShowOnboarding] = useState(() => goals.length === 0);
  const [pulseButton,    setPulseButton]    = useState(false);

  const closeOnboarding = () => {
    localStorage.setItem("ontrack_onboarding_seen", "true");
    setShowOnboarding(false);
    setPulseButton(true);
    setTimeout(() => setPulseButton(false), 3000);
  };

  const handleOnboardingCTA = () => {
    localStorage.setItem("ontrack_onboarding_seen", "true");
    setShowOnboarding(false);
    navigate("/goals/new");
  };

  const today       = toDateStr(new Date());
  const isPlanStale = !!plan && plan.length > 0 && plan.every(d => d.date < today);
  const noPlan      = !plan || plan.length === 0;

  useEffect(() => { document.title = "OnTrack"; }, []);

  const authHeaders = async (): Promise<Record<string, string>> => {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (isAuthenticated) {
      const token = await getToken().catch(() => null);
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

      if (!isAuthenticated) {
        setShowSavePrompt(true);
      } else {
        showToast({ message: "Your plan is ready!", action: { label: "View calendar →", href: "/calendar" } });
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const regenerateGoal = async (goalId: string, feedback: string, saveFeedback: boolean) => {
    const goal = goals.find(g => g.id === goalId);
    if (!goal) return;

    // Persist feedback to the goal if requested
    if (saveFeedback && feedback) {
      setGoals(prev => prev.map(g =>
        g.id === goalId
          ? { ...g, requests: [...g.requests, feedback] }
          : g
      ));
    }

    // Build the goal sent to the AI — always include feedback in this call
    const goalForApi = feedback
      ? { ...goal, requests: [...goal.requests, `User feedback: ${feedback}`] }
      : goal;

    setRegenGoalId(goalId);
    setRegenError(null);
    try {
      const res = await fetch(`${API_BASE}/api/generate`, {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({
          goals: [goalForApi],
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
        const allDates = new Set([...prev.map(d => d.date), ...newDays.map(d => d.date)]);
        return Array.from(allDates).sort().map(date => {
          const existing = prev.find(d => d.date === date);
          const replacement = newDays.find(d => d.date === date);
          if (!existing) return replacement!;
          const keptBlocks = existing.time_blocks.filter(b => b.goal_id !== goalId);
          const newBlocks = replacement?.time_blocks ?? [];
          const merged = [...keptBlocks, ...newBlocks];
          if (merged.length === 0) return null;
          return { ...existing, time_blocks: merged };
        }).filter((d): d is DayPlan => d !== null);
      });
      showToast({ message: `"${goal.title}" blocks updated!`, action: { label: "View calendar →", href: "/calendar" } });
    } catch {
      setRegenError(goalId);
    } finally {
      setRegenGoalId(null);
    }
  };

  // ── Empty state ─────────────────────────────────────────────────────────────

  if (goals.length === 0) {
    return (
      <>
        {showOnboarding && (
          <OnboardingModal onClose={closeOnboarding} onCTA={handleOnboardingCTA} />
        )}
        <div className="flex flex-col items-center justify-center py-32 text-center">
          <div className="w-16 h-16 rounded-2xl bg-white border border-black/8 shadow-sm flex items-center justify-center mb-5">
            <svg className="w-8 h-8 text-black/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-black mb-2">No goals yet</h2>
          <p className="text-black/40 mb-8 max-w-sm leading-relaxed text-sm">
            Create your first goal and OnTrack will generate a personalized weekly plan to help you get there.
          </p>
          <Link
            to="/goals/new"
            data-tour="new-goal"
            className={`px-6 py-3 bg-black text-white rounded-full font-semibold text-sm hover:bg-black/80 transition-colors ${
              pulseButton ? "ring-2 ring-black ring-offset-2 animate-pulse" : ""
            }`}
          >
            Create your first goal →
          </Link>
        </div>
      </>
    );
  }

  // ── Main view ────────────────────────────────────────────────────────────────

  return (
    <div>

      {/* Onboarding modal (visible if somehow shown while goals exist) */}
      {showOnboarding && goals.length === 0 && (
        <OnboardingModal onClose={closeOnboarding} onCTA={handleOnboardingCTA} />
      )}

      {/* Save plan modal (guest post-generate) */}
      {showSavePrompt && !isAuthenticated && (
        <SavePromptModal
          onSignUp={() => openAuthModal("signup")}
          onDismiss={() => {
            setShowSavePrompt(false);
            showToast({ message: "Your plan is ready!", action: { label: "View calendar →", href: "/calendar" } });
          }}
        />
      )}

      {/* Guest banner */}
      {!isAuthenticated && (
        <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3.5 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-medium text-amber-800">Your plan will disappear when you close this tab.</p>
            <p className="text-xs text-amber-700/60 mt-0.5">Sign up free to save your goals and access them anywhere.</p>
          </div>
          <button
            onClick={() => openAuthModal("signup")}
            className="shrink-0 px-4 py-2 bg-amber-500 text-white text-xs font-bold rounded-full hover:bg-amber-600 transition-colors"
          >
            Save free →
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-bold text-black">Goals</h1>
        <div className="flex gap-2">
          <Link
            to="/goals/new"
            data-tour="new-goal"
            className="px-4 py-2 text-sm border border-black/10 rounded-full text-black/50 hover:text-black hover:border-black/20 bg-white transition-colors"
          >
            + Add goal
          </Link>
          <button
            data-tour="generate-plan"
            className="px-4 py-2 text-sm bg-black text-white rounded-full hover:bg-black/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            onClick={generate}
            disabled={loading || regenGoalId !== null}
          >
            {loading ? "Generating…" : "Generate Plan"}
          </button>
        </div>
      </div>

      {/* No-plan hint */}
      {noPlan && !loading && (
        <div className="mb-5 flex items-start gap-3 px-4 py-3.5 rounded-xl border border-black/6 bg-white shadow-sm">
          <div className="w-1.5 h-1.5 rounded-full bg-black/25 mt-2 shrink-0" />
          <p className="text-xs text-black/40 leading-relaxed">
            Hit <span className="text-black/60 font-medium">Generate Plan</span> above — the AI will schedule a full week of sessions across all your goals, fitted to your availability. Takes about 15 seconds.
          </p>
        </div>
      )}

      {isPlanStale && (
        <Link
          to="/recap"
          className="mb-4 flex items-center justify-between gap-3 p-3.5 rounded-xl border border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <span className="text-sm font-medium">Your plan is complete — review your week and generate a new one</span>
          </div>
          <span className="text-xs text-amber-600 shrink-0">Weekly Recap →</span>
        </Link>
      )}

      {error && (
        <div className="mb-4 p-3 rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm">
          {error}
        </div>
      )}

      {loading && (
        <div className="flex flex-col gap-3 animate-pulse mb-4">
          {[1, 2].map((n) => (
            <div key={n} className="border border-black/8 rounded-2xl p-4 bg-white">
              <div className="h-4 bg-black/6 rounded w-48 mb-2" />
              <div className="h-3 bg-black/4 rounded w-32" />
            </div>
          ))}
        </div>
      )}

      {/* Goal cards */}
      <div className="flex flex-col gap-3">
        {goals.map((goal) => {
          const isRegening = regenGoalId === goal.id;
          const hasError   = regenError === goal.id;
          return (
            <div
              key={goal.id}
              className={`border rounded-2xl p-4 bg-white shadow-sm transition-colors ${
                isRegening ? "border-black/15 bg-black/[0.02]" : "border-black/8"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <Link to={`/goals/${goal.id}`} className="flex-1 min-w-0 group">
                  <h3 className="font-medium text-black mb-2 group-hover:text-black/60 transition-colors">{goal.title}</h3>
                  <div className="flex flex-wrap gap-1.5">
                    <span className="text-xs bg-black/5 border border-black/8 px-2 py-0.5 rounded-full text-black/50 capitalize">
                      {goal.skill_level}
                    </span>
                    {goal.timeframe.start_date && goal.timeframe.end_date && (
                      <span className="text-xs text-black/40 bg-black/4 border border-black/6 px-2 py-0.5 rounded-full">
                        {goal.timeframe.start_date} → {goal.timeframe.end_date}
                      </span>
                    )}
                    <span className="text-xs text-black/40 bg-black/4 border border-black/6 px-2 py-0.5 rounded-full">
                      {goal.hours_per_week} hr{goal.hours_per_week !== 1 && "s"}/week
                    </span>
                    {goal.selected_days.length > 0 && (
                      <span className="text-xs text-black/40 bg-black/4 border border-black/6 px-2 py-0.5 rounded-full">
                        {goal.selected_days.map((d) => d.slice(0, 3)).join(", ")}
                      </span>
                    )}
                    {goal.restrictions.length > 0 && (
                      <span className="text-xs text-orange-600 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-full">
                        {goal.restrictions.length} restriction{goal.restrictions.length !== 1 && "s"}
                      </span>
                    )}
                  </div>
                </Link>

                <div className="flex items-center gap-2 shrink-0">
                  {plan && plan.length > 0 && (
                    <button
                      onClick={() => setRegenModalGoalId(goal.id)}
                      disabled={regenGoalId !== null || loading}
                      title="Regenerate blocks for this goal"
                      className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs border border-black/10 rounded-full text-black/40 hover:border-black/20 hover:text-black/60 disabled:opacity-40 disabled:cursor-not-allowed transition-colors bg-white"
                    >
                      {isRegening ? (
                        <span className="w-3 h-3 border border-black/40 border-t-black rounded-full animate-spin" />
                      ) : (
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                        </svg>
                      )}
                      {isRegening ? "Regenerating…" : "Regenerate"}
                    </button>
                  )}
                  <Link
                    to={`/goals/${goal.id}`}
                    className="text-xs px-2.5 py-1.5 border border-black/10 rounded-full text-black/40 hover:border-black/25 hover:text-black/60 transition-colors bg-white"
                  >
                    Edit →
                  </Link>
                </div>
              </div>

              {hasError && (
                <p className="mt-2 text-xs text-red-500">Failed to regenerate. Try again.</p>
              )}
            </div>
          );
        })}
      </div>

      {/* Bottom sign-up nudge for guests with a plan */}
      {!isAuthenticated && !noPlan && (
        <div className="mt-8 text-center">
          <p className="text-xs text-black/25 mb-2">Don't lose your work —</p>
          <button
            onClick={() => openAuthModal("signup")}
            className="text-xs text-black/50 hover:text-black underline underline-offset-2 transition-colors"
          >
            create a free account to save this plan
          </button>
        </div>
      )}

      {/* Regenerate-goal feedback modal */}
      {regenModalGoalId && (() => {
        const modalGoal = goals.find(g => g.id === regenModalGoalId);
        if (!modalGoal) return null;
        return (
          <RegenGoalModal
            goal={modalGoal}
            onCancel={() => setRegenModalGoalId(null)}
            onConfirm={(feedback, save) => {
              setRegenModalGoalId(null);
              regenerateGoal(regenModalGoalId, feedback, save);
            }}
          />
        );
      })()}
    </div>
  );
}
