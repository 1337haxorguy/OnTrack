import { useState, useRef } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { useNavigate } from "react-router-dom";

// ── Slide mock-UIs (light theme to match cream bg) ────────────────────────────

function PlanPreview() {
  const blocks = [
    {
      time: "7:00 AM", label: "Guitar Practice",
      bgCls: "bg-violet-50 border-violet-200",
      dotCls: "border-violet-300",
      labelCls: "text-violet-800",
      taskCls: "text-violet-600",
      timeCls: "text-violet-400",
      tasks: ["Chord transitions · 20 min", "Fingerpicking pattern · 15 min"],
    },
    {
      time: "12:30 PM", label: "Spanish Listening",
      bgCls: "bg-emerald-50 border-emerald-200",
      dotCls: "border-emerald-300",
      labelCls: "text-emerald-800",
      taskCls: "text-emerald-600",
      timeCls: "text-emerald-400",
      tasks: ["Podcast episode · 25 min"],
    },
    {
      time: "6:00 PM", label: "Evening Run",
      bgCls: "bg-orange-50 border-orange-200",
      dotCls: "border-orange-300",
      labelCls: "text-orange-800",
      taskCls: "text-orange-600",
      timeCls: "text-orange-400",
      tasks: ["Easy 3km · 30 min", "Cool-down stretches · 10 min"],
    },
  ];
  return (
    <div className="w-full max-w-xs mx-auto">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-semibold text-black/30 uppercase tracking-widest">Today · Monday</span>
        <span className="text-[10px] text-black/20">Apr 14</span>
      </div>
      <div className="flex flex-col gap-2.5">
        {blocks.map((b) => (
          <div key={b.label} className={`rounded-xl border p-3 ${b.bgCls}`}>
            <div className="flex items-center justify-between mb-1.5">
              <span className={`text-xs font-semibold ${b.labelCls}`}>{b.label}</span>
              <span className={`text-[10px] ${b.timeCls}`}>{b.time}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              {b.tasks.map((t) => (
                <div key={t} className="flex items-center gap-1.5">
                  <div className={`w-3 h-3 rounded-full border shrink-0 ${b.dotCls}`} />
                  <span className={`text-[11px] ${b.taskCls}`}>{t}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function GoalsPreview() {
  const goals = [
    { emoji: "🎸", title: "Learn guitar",   tags: ["Intermediate", "4 hrs/wk", "Mon, Wed, Fri"] },
    { emoji: "🇪🇸", title: "Learn Spanish",  tags: ["Beginner", "3 hrs/wk", "Tue, Thu"]         },
    { emoji: "🏃", title: "Run a 5K",       tags: ["Beginner", "3 hrs/wk", "Weekends"]          },
  ];
  return (
    <div className="w-full max-w-xs mx-auto flex flex-col gap-2.5">
      {goals.map((g) => (
        <div key={g.title} className="rounded-xl border border-black/8 bg-white p-3.5 shadow-sm">
          <div className="flex items-center gap-2.5 mb-2">
            <span className="text-xl">{g.emoji}</span>
            <span className="text-sm font-semibold text-black">{g.title}</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {g.tags.map((t) => (
              <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-black/4 border border-black/8 text-black/40">
                {t}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function QuestionsPreview() {
  const questions = [
    { q: "Do you have access to a guitar right now?",  a: "Yes, acoustic at home"   },
    { q: "Any wrist or finger injuries to be aware of?", a: "No injuries"           },
    { q: "What style are you most excited to learn?",  a: "Fingerstyle / acoustic"  },
  ];
  return (
    <div className="w-full max-w-xs mx-auto flex flex-col gap-3">
      {questions.map((item, i) => (
        <div key={i} className="flex flex-col gap-1.5">
          <div className="self-start max-w-[80%] rounded-2xl rounded-tl-sm px-3.5 py-2.5 bg-white border border-black/8 shadow-sm">
            <p className="text-xs text-black/60 leading-relaxed">{item.q}</p>
          </div>
          <div className="self-end max-w-[75%] rounded-2xl rounded-tr-sm px-3.5 py-2.5 bg-black">
            <p className="text-xs text-white leading-relaxed">{item.a}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function SchedulePreview() {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const free  = new Set(["Mon", "Wed", "Fri", "Sat"]);
  const blocked = [
    { label: "Work",      time: "9 AM – 5 PM"  },
    { label: "Gym class", time: "Tue, Thu · 6 PM" },
  ];
  return (
    <div className="w-full max-w-xs mx-auto flex flex-col gap-4">
      <div>
        <p className="text-[10px] text-black/30 uppercase tracking-widest mb-2 font-medium">Free days for goals</p>
        <div className="flex gap-1.5">
          {days.map((d) => (
            <div
              key={d}
              className={`flex-1 py-2 rounded-lg flex items-center justify-center text-[10px] font-semibold ${
                free.has(d)
                  ? "bg-black text-white"
                  : "bg-white border border-black/8 text-black/25"
              }`}
            >
              {d[0]}
            </div>
          ))}
        </div>
      </div>
      <div>
        <p className="text-[10px] text-black/30 uppercase tracking-widest mb-2 font-medium">Blocked times (we skip these)</p>
        <div className="flex flex-col gap-2">
          {blocked.map((b) => (
            <div key={b.label} className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-white border border-black/8 shadow-sm">
              <span className="text-xs text-black/70 font-medium">{b.label}</span>
              <span className="text-[10px] text-black/30">{b.time}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Slides config ─────────────────────────────────────────────────────────────

const SLIDES = [
  {
    tag: "The result",
    headline: "A real plan for your week.",
    sub: "Not vague advice — specific sessions, exact times, tasks with estimated minutes, all built around your schedule.",
    visual: <PlanPreview />,
  },
  {
    tag: "Multiple goals",
    headline: "Track everything at once.",
    sub: "Guitar, running, a new language — add as many goals as you want. OnTrack keeps them from stepping on each other.",
    visual: <GoalsPreview />,
  },
  {
    tag: "It gets personal",
    headline: "AI that asks the right questions.",
    sub: "A quick back-and-forth to understand your starting point, constraints, and preferences. About 2 minutes per goal.",
    visual: <QuestionsPreview />,
  },
  {
    tag: "Your life stays intact",
    headline: "Fits around your real schedule.",
    sub: "Tell us your free time and regular commitments. We plan only inside the gaps — never against your calendar.",
    visual: <SchedulePreview />,
  },
];

// ── Main component ────────────────────────────────────────────────────────────

export default function Landing() {
  const { loginWithRedirect } = useAuth0();
  const navigate = useNavigate();
  const [slide, setSlide] = useState(0);
  const touchStartX = useRef<number | null>(null);

  const isLast = slide === SLIDES.length - 1;

  const next = () => {
    if (isLast) navigate("/goals/new");
    else setSlide((s) => s + 1);
  };

  const prev = () => setSlide((s) => Math.max(0, s - 1));

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const delta = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(delta) > 40) {
      if (delta > 0) next();
      else prev();
    }
    touchStartX.current = null;
  };

  const current = SLIDES[slide];

  return (
    <div
      className="min-h-screen bg-[#F9F9F9] text-black flex flex-col select-none"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* ── Header ── */}
      <header className="flex items-center justify-between px-6 py-5 shrink-0">
        <span className="text-sm font-bold tracking-tight text-black">OnTrack</span>
        <button
          onClick={() => loginWithRedirect()}
          className="px-4 py-2 text-sm font-semibold text-black border border-black/15 rounded-full bg-white hover:bg-black hover:text-white hover:border-black transition-colors shadow-sm"
        >
          Log in
        </button>
      </header>

      {/* ── Slide area ── */}
      <main className="flex-1 flex flex-col px-6 pt-2 pb-8">

        {/* Tag */}
        <div className="flex justify-center mb-6">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-black/40 px-3 py-1 rounded-full bg-black/5 border border-black/8">
            {current.tag}
          </span>
        </div>

        {/* Visual mockup */}
        <div className="mb-8">
          {current.visual}
        </div>

        {/* Text */}
        <div className="text-center mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold leading-tight tracking-tight mb-3 text-black">
            {current.headline}
          </h1>
          <p className="text-sm text-black/40 leading-relaxed max-w-xs mx-auto">
            {current.sub}
          </p>
        </div>

        {/* Dot indicators */}
        <div className="flex justify-center gap-1.5 mb-8">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              onClick={() => setSlide(i)}
              className={`h-1.5 rounded-full transition-all duration-200 ${
                i === slide ? "w-6 bg-black" : "w-1.5 bg-black/15"
              }`}
            />
          ))}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2.5 max-w-xs mx-auto w-full mt-auto">
          <button
            onClick={next}
            className="w-full py-4 bg-black text-white rounded-full text-sm font-semibold hover:bg-black/80 transition-colors"
          >
            {isLast ? "Get started →" : "Next →"}
          </button>

          {!isLast && (
            <button
              onClick={() => navigate("/goals/new")}
              className="w-full py-3 text-xs text-black/30 hover:text-black/60 transition-colors"
            >
              skip intro
            </button>
          )}

          {isLast && (
            <button
              onClick={() => loginWithRedirect()}
              className="w-full py-3 text-xs text-black/35 hover:text-black/60 transition-colors"
            >
              already have an account? log in
            </button>
          )}
        </div>
      </main>
    </div>
  );
}
