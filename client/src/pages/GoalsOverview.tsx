import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { useApp, FREE_LIMITS } from "../context/AppContext";
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

// ── Design helpers ────────────────────────────────────────────────────────────

function Slab({ children }: { children: React.ReactNode }) {
  return (
    <span className="relative inline-block">
      {children}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 rounded-full"
        style={{ bottom: "0.06em", height: "0.14em", background: "#2F7D5E", zIndex: -1 }}
      />
    </span>
  );
}

function goalEmoji(title: string): string {
  const t = title.toLowerCase();
  if (/guitar|piano|bass|drum|violin|ukulele|music/.test(t)) return "🎸";
  if (/\brun|marathon|jog/.test(t)) return "🏃";
  if (/gym|lift|strength|workout|fitness|muscle/.test(t)) return "💪";
  if (/spanish|french|german|japanese|chinese|korean|language|mandarin|italian|portuguese/.test(t)) return "🌍";
  if (/\bread|book/.test(t)) return "📚";
  if (/writ|journal|blog/.test(t)) return "✍️";
  if (/\bcode|program|develop|software/.test(t)) return "💻";
  if (/draw|paint|\bart\b|sketch/.test(t)) return "🎨";
  if (/yoga|meditat/.test(t)) return "🧘";
  if (/cook|chef|bak/.test(t)) return "👨‍🍳";
  if (/swim/.test(t)) return "🏊";
  if (/cycl|bike|bicycl/.test(t)) return "🚴";
  if (/danc/.test(t)) return "💃";
  if (/sing|vocal|voice/.test(t)) return "🎤";
  if (/photo/.test(t)) return "📷";
  if (/chess/.test(t)) return "♟️";
  return "🎯";
}

function getProgress(goal: Goal): number {
  if (!goal.timeframe.start_date || !goal.timeframe.end_date) return 0;
  const start = new Date(goal.timeframe.start_date + "T00:00:00").getTime();
  const end   = new Date(goal.timeframe.end_date   + "T00:00:00").getTime();
  const now   = Date.now();
  if (end <= start) return 100;
  return Math.max(0, Math.min(100, Math.round(((now - start) / (end - start)) * 100)));
}

const ALL_DAYS_ORDER = ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"];
const DAY_ABBR       = ["M","T","W","T","F","S","S"];
const TYPER_WORDS    = ["learn guitar","speak Spanish","run a 10k","write every day","get stronger","speak French","read more"];


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
  const { goals, setGoals, schedule, plan, setPlan, showToast, usage, incrementGenerations, limitsEnabled, unlimited } = useApp();
  const { isAuthenticated, getToken, openAuthModal } = useAuth();
  const location = useLocation();
  const [loading,          setLoading]          = useState(false);
  const [error,            setError]            = useState("");
  const [regenGoalId,      setRegenGoalId]      = useState<string | null>(null);
  const [regenError,       setRegenError]       = useState<string | null>(null);
  const [regenModalGoalId, setRegenModalGoalId] = useState<string | null>(null);
  const [showSavePrompt, setShowSavePrompt] = useState(
    () => !isAuthenticated && (location.state as { showSave?: boolean } | null)?.showSave === true
  );

  // Typewriter for empty state
  const [typerIdx,      setTyperIdx]      = useState(0);
  const [typerText,     setTyperText]     = useState("");
  const [typerDeleting, setTyperDeleting] = useState(false);

  useEffect(() => {
    if (goals.length > 0) return;
    const word = TYPER_WORDS[typerIdx % TYPER_WORDS.length];
    let timer: ReturnType<typeof setTimeout>;
    if (!typerDeleting) {
      if (typerText.length < word.length) {
        timer = setTimeout(() => setTyperText(word.slice(0, typerText.length + 1)), 55);
      } else {
        timer = setTimeout(() => setTyperDeleting(true), 1400);
      }
    } else {
      if (typerText.length > 0) {
        timer = setTimeout(() => setTyperText(t => t.slice(0, -1)), 28);
      } else {
        setTyperDeleting(false);
        setTyperIdx(i => i + 1);
        return;
      }
    }
    return () => clearTimeout(timer);
  }, [typerText, typerDeleting, typerIdx, goals.length]);

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
      const newPlan: DayPlan[] = (data.weekly_tasks || []).map((day: DayPlan) => ({
        ...day,
        time_blocks: day.time_blocks.map((b) => ({ ...b, id: crypto.randomUUID() })),
      }));
      setPlan(attributeBlocks(newPlan, goals));
      incrementGenerations();

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
      if (!res.ok) {
        if (res.status === 429) {
          const body = await res.json().catch(() => ({}));
          if (body.error === "generation_limit_reached") {
            setRegenError(goalId);
            showToast({ message: "You've used all your free generations." });
            return;
          }
        }
        throw new Error(`Server error: ${res.status}`);
      }
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
      incrementGenerations();
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
      <div className="flex flex-col items-center text-center" style={{ marginTop: 60 }}>
        <div className="max-w-[560px] w-full flex flex-col items-center">
          <h1
            className="font-extrabold"
            style={{ fontSize: 52, letterSpacing: "-0.03em", lineHeight: 0.98, marginBottom: 14, maxWidth: "14ch" }}
          >
            lets start <Slab>one step</Slab> at a time
          </h1>

          <p style={{ fontSize: 15, color: "rgba(13,13,13,.6)", lineHeight: 1.55, margin: "0 0 28px", maxWidth: "44ch" }}>
            tell ontrack what you want to get good at. we'll plan your week around it.
          </p>

          <div
            aria-hidden="true"
            className="flex items-center gap-2.5 w-full bg-white"
            style={{
              maxWidth: 480,
              border: "1px solid rgba(13,13,13,.12)",
              borderRadius: 14,
              padding: "14px 14px 14px 18px",
              boxShadow: "0 0 0 4px #E8F1EC",
            }}
          >
            <span style={{ fontSize: 11, color: "rgba(13,13,13,.4)", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700, flexShrink: 0 }}>
              i want to
            </span>
            <span className="flex-1 flex items-center text-left font-semibold" style={{ fontSize: 16, color: "#0D0D0D" }}>
              {typerText}
              <span
                className="inline-block w-[2px] ml-1 rounded-full"
                style={{ height: "1em", background: "#2F7D5E", animation: "blink 1s step-end infinite" }}
              />
            </span>
          </div>

          <Link
            to="/goals/new"
            data-tour="new-goal"
            className="inline-flex items-center rounded-full font-semibold text-white transition-colors"
            style={{ background: "#2F7D5E", padding: "12px 20px", fontSize: 14, marginTop: 22 }}
            onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = "#1F5E46")}
            onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = "#2F7D5E")}
          >
            create your first goal →
          </Link>

          {/* Plan preview */}
          <div className="w-full mt-12" style={{ maxWidth: 380 }}>
            <div className="rounded-xl border border-black/8 bg-white shadow-sm overflow-hidden text-left">
              <div className="px-3.5 py-2.5 border-b border-black/6">
                <span className="text-xs font-semibold text-black">Monday</span>
              </div>
              <div className="divide-y divide-black/5">
                {[
                  { time: "7:00 AM", label: "Guitar Practice", task: "Chord transitions · 20 min" },
                  { time: "6:00 PM", label: "Evening Run",     task: "Easy 3 km · 30 min"        },
                ].map((block) => (
                  <div key={block.label} className="px-3.5 py-2.5 flex gap-3">
                    <span className="text-[10px] text-black/25 pt-0.5 w-12 shrink-0 tabular-nums">{block.time}</span>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-black mb-1">{block.label}</p>
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full border border-black/20 shrink-0" />
                        <p className="text-[11px] text-black/40">{block.task}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <p className="text-sm font-semibold text-black mt-4 mb-1">Your week, fully mapped.</p>
            <p className="text-xs text-black/40 leading-relaxed">
              Sessions, times, tasks — scheduled around your life automatically.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Main view ────────────────────────────────────────────────────────────────

  return (
    <div>

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
      <div className="flex items-end justify-between gap-4 mb-8" style={{ marginBottom: 32 }}>
        <div>
          <h1
            className="font-extrabold tracking-tight leading-none mb-2"
            style={{ fontSize: "clamp(28px,5vw,44px)", letterSpacing: "-0.025em" }}
          >
            {goals.length} {goals.length === 1 ? "thing" : "things"} <Slab>in motion.</Slab>
          </h1>
          <p className="text-sm text-black/40">a quiet list. open one to see this week's plan.</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Link
            to="/goals/new"
            data-tour="new-goal"
            className="px-4 py-2 text-sm border border-black/10 rounded-full text-black/50 hover:text-black hover:border-black/20 bg-white transition-colors font-medium"
          >
            + add goal
          </Link>
          <button
            data-tour="generate-plan"
            className="px-4 py-2 text-sm rounded-full font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            style={{ background: "#2F7D5E" }}
            onClick={generate}
            disabled={loading || regenGoalId !== null || (limitsEnabled && isAuthenticated && !unlimited && usage.generations >= FREE_LIMITS.generations)}
          >
            {loading ? "Generating…" : "Generate Plan"}
          </button>
        </div>
      </div>

      {/* Generation limit note */}
      {limitsEnabled && isAuthenticated && !unlimited && usage.generations >= FREE_LIMITS.generations && (
        <p className="mb-3 text-xs text-black/40 text-right">
          You've used all {FREE_LIMITS.generations} free generations.
        </p>
      )}

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

      {/* Goal cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {goals.map((goal) => {
          const isRegening  = regenGoalId === goal.id;
          const hasError    = regenError === goal.id;
          const progress    = getProgress(goal);
          const emoji       = goalEmoji(goal.title);
          const hasTimeframe = goal.timeframe.start_date && goal.timeframe.end_date;

          // Sessions this week
          const [weekStart, weekEnd] = (() => {
            const now = new Date();
            const day = now.getDay();
            const mon = new Date(now);
            mon.setDate(now.getDate() - ((day + 6) % 7));
            mon.setHours(0, 0, 0, 0);
            const sun = new Date(mon);
            sun.setDate(mon.getDate() + 6);
            return [mon.toLocaleDateString("en-CA"), sun.toLocaleDateString("en-CA")];
          })();
          const sessionsThisWeek = plan
            ?.filter(d => d.date >= weekStart && d.date <= weekEnd)
            .flatMap(d => d.time_blocks.filter(b => b.goal_id === goal.id))
            .length ?? 0;
          const totalExpected = goal.selected_days.length;

          return (
            <article
              key={goal.id}
              className={`rounded-[20px] border bg-white flex flex-col p-7 transition-all cursor-pointer relative min-h-[220px] ${
                isRegening ? "border-black/15 bg-black/[0.02]" : "border-black/8 hover:border-black/25 hover:-translate-y-px hover:shadow-[0_8px_24px_-12px_rgba(0,0,0,0.08)]"
              }`}
              style={{ boxShadow: "0 1px 0 rgba(0,0,0,0.02)", gap: 22 }}
            >
              {/* Top row: emoji + title + actions */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3.5">
                  <span
                    className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl shrink-0"
                    style={{ background: "#E8F1EC" }}
                  >
                    {emoji}
                  </span>
                  <div className="min-w-0">
                    <Link to={`/goals/${goal.id}`}>
                      <h3 className="text-[22px] font-bold tracking-tight leading-none text-black hover:text-black/70 transition-colors" style={{ letterSpacing: "-0.015em" }}>
                        {goal.title}
                      </h3>
                    </Link>
                    <span className="block mt-1 text-xs text-black/40 font-medium capitalize">
                      {goal.skill_level} · {goal.hours_per_week} hr{goal.hours_per_week !== 1 ? "s" : ""} / week
                    </span>
                  </div>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  {plan && plan.length > 0 && (
                    <button
                      onClick={() => setRegenModalGoalId(goal.id)}
                      disabled={regenGoalId !== null || loading || (limitsEnabled && isAuthenticated && !unlimited && usage.generations >= FREE_LIMITS.generations)}
                      title={limitsEnabled && isAuthenticated && !unlimited && usage.generations >= FREE_LIMITS.generations ? "Generation limit reached" : "Regenerate blocks for this goal"}
                      className="w-8 h-8 rounded-full border border-black/12 bg-white flex items-center justify-center text-black/50 hover:text-black hover:border-black/25 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      {isRegening ? (
                        <span className="w-3 h-3 border border-black/40 border-t-black rounded-full animate-spin" />
                      ) : (
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                        </svg>
                      )}
                    </button>
                  )}
                  <Link
                    to={`/goals/${goal.id}`}
                    className="w-8 h-8 rounded-full border border-black/12 bg-white flex items-center justify-center text-black/50 hover:text-black hover:border-black/25 transition-colors text-sm"
                    title="Edit goal"
                  >
                    ✎
                  </Link>
                </div>
              </div>

              {/* Progress */}
              {hasTimeframe && (
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between items-baseline text-xs text-black/50">
                    <span>{goal.timeframe.start_date} → {goal.timeframe.end_date}</span>
                    <span className="font-bold text-black tabular-nums text-[13px]">{progress}%</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(13,13,13,0.05)" }}>
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${progress}%`, background: "#2F7D5E" }}
                    />
                  </div>
                </div>
              )}

              {/* Footer: sessions + day dots */}
              <div className="flex items-center justify-between gap-3 mt-auto">
                <span className="text-xs tabular-nums" style={{ color: "rgba(13,13,13,0.4)" }}>
                  {totalExpected > 0 ? (
                    <><strong className="text-black font-bold">{sessionsThisWeek} of {totalExpected}</strong> sessions this week</>
                  ) : (
                    <span className="text-black/30">no days set</span>
                  )}
                </span>
                {goal.selected_days.length > 0 && (
                  <div className="flex gap-1" aria-label="scheduled days">
                    {ALL_DAYS_ORDER.map((day, i) => {
                      const isOn = goal.selected_days.includes(day);
                      return (
                        <span
                          key={day}
                          className="w-5 h-5 rounded-[6px] flex items-center justify-center text-[9px] font-bold uppercase tracking-wider"
                          style={isOn
                            ? { background: "#E8F1EC", color: "#1F5E46" }
                            : { background: "rgba(13,13,13,0.05)", color: "rgba(13,13,13,0.25)" }
                          }
                        >
                          {DAY_ABBR[i]}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>

              {hasError && (
                <p className="text-xs text-red-500">Failed to regenerate. Try again.</p>
              )}
            </article>
          );
        })}

        {/* Dashed add-goal card */}
        <Link
          to="/goals/new"
          data-tour="new-goal"
          className="rounded-[20px] min-h-[220px] flex flex-col items-center justify-center gap-2.5 text-center p-7 transition-all group"
          style={{ border: "1.5px dashed rgba(13,13,13,0.12)", background: "transparent" }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.borderColor = "#2F7D5E";
            (e.currentTarget as HTMLElement).style.background = "#E8F1EC";
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.borderColor = "rgba(13,13,13,0.12)";
            (e.currentTarget as HTMLElement).style.background = "transparent";
          }}
        >
          <span
            className="w-10 h-10 rounded-full flex items-center justify-center text-xl transition-colors"
            style={{ background: "rgba(13,13,13,0.05)" }}
          >
            +
          </span>
          <strong className="text-sm font-bold text-black/40 group-hover:text-[#1F5E46] transition-colors">add another goal</strong>
          <span className="text-xs text-black/30 group-hover:text-[#1F5E46]/70 transition-colors">one thing at a time is still best. but go on.</span>
        </Link>
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
