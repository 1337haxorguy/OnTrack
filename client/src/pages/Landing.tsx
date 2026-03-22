import { useAuth0 } from "@auth0/auth0-react";

// ---- Mock week plan for the visual preview ----
const PREVIEW_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];

interface PreviewBlock {
  label: string;
  sub: string;
  topPct: number;
  heightPct: number;
  color: "indigo" | "violet" | "emerald";
}

const PREVIEW_COLUMNS: PreviewBlock[][] = [
  // Mon
  [{ label: "Guitar", sub: "Chord patterns", topPct: 12, heightPct: 22, color: "indigo" }],
  // Tue
  [{ label: "Run", sub: "Easy 3 km", topPct: 5, heightPct: 18, color: "emerald" }],
  // Wed
  [
    { label: "Guitar", sub: "Fingerstyle", topPct: 14, heightPct: 22, color: "indigo" },
    { label: "Spanish", sub: "Vocab review", topPct: 55, heightPct: 16, color: "violet" },
  ],
  // Thu
  [{ label: "Run", sub: "Intervals", topPct: 8, heightPct: 20, color: "emerald" }],
  // Fri
  [
    { label: "Guitar", sub: "Song practice", topPct: 10, heightPct: 22, color: "indigo" },
    { label: "Spanish", sub: "Listening", topPct: 50, heightPct: 16, color: "violet" },
  ],
];

const COLOR_MAP = {
  indigo:  { block: "bg-indigo-600/80 border-indigo-500/60",  label: "text-indigo-100", sub: "text-indigo-300/80" },
  violet:  { block: "bg-violet-600/80 border-violet-500/60",  label: "text-violet-100", sub: "text-violet-300/80" },
  emerald: { block: "bg-emerald-700/80 border-emerald-600/60", label: "text-emerald-100", sub: "text-emerald-300/80" },
};

function PlanPreview() {
  return (
    <div className="w-full max-w-xl mx-auto rounded-xl border border-gray-700/60 bg-gray-900/80 overflow-hidden shadow-2xl shadow-black/40">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-700/60 bg-gray-900">
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-gray-700" />
          <div className="w-2.5 h-2.5 rounded-full bg-gray-700" />
          <div className="w-2.5 h-2.5 rounded-full bg-gray-700" />
        </div>
        <div className="flex-1 flex items-center justify-center">
          <span className="text-xs text-gray-500 font-medium">Week of Mar 24 – Mar 28</span>
        </div>
        <div className="px-2 py-0.5 text-[10px] rounded border border-indigo-600/40 bg-indigo-600/10 text-indigo-400 font-medium">
          Week
        </div>
      </div>

      {/* Day headers */}
      <div className="grid border-b border-gray-700/60 bg-gray-900/60" style={{ gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr" }}>
        {PREVIEW_DAYS.map((d, i) => (
          <div key={d} className={`py-2 text-center ${i > 0 ? "border-l border-gray-700/40" : ""}`}>
            <div className="text-[9px] uppercase tracking-widest text-gray-500 font-semibold">{d}</div>
            <div className={`mx-auto mt-0.5 w-6 h-6 flex items-center justify-center rounded-full text-sm font-bold ${i === 0 ? "bg-indigo-600 text-white" : "text-gray-500"}`}>
              {24 + i}
            </div>
          </div>
        ))}
      </div>

      {/* Grid body */}
      <div className="grid relative" style={{ gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr", height: "200px" }}>
        {/* Hour lines */}
        {[0, 25, 50, 75].map((pct) => (
          <div
            key={pct}
            className="absolute left-0 right-0 border-t border-gray-800/60 pointer-events-none"
            style={{ top: `${pct}%` }}
          />
        ))}

        {PREVIEW_COLUMNS.map((blocks, ci) => (
          <div key={ci} className={`relative ${ci > 0 ? "border-l border-gray-700/40" : ""}`}>
            {blocks.map((b, bi) => {
              const c = COLOR_MAP[b.color];
              return (
                <div
                  key={bi}
                  className={`absolute inset-x-1 rounded border ${c.block} px-1.5 py-1 overflow-hidden`}
                  style={{ top: `${b.topPct}%`, height: `${b.heightPct}%` }}
                >
                  <div className={`text-[10px] font-semibold leading-tight ${c.label}`}>{b.label}</div>
                  <div className={`text-[9px] leading-tight mt-0.5 ${c.sub}`}>{b.sub}</div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Footer caption */}
      <div className="px-4 py-2 border-t border-gray-800/60 bg-gray-900/60 flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-sm bg-indigo-500/80" />
          <span className="text-[10px] text-gray-500">Guitar</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-sm bg-emerald-600/80" />
          <span className="text-[10px] text-gray-500">Running</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-sm bg-violet-600/80" />
          <span className="text-[10px] text-gray-500">Spanish</span>
        </div>
        <span className="ml-auto text-[10px] text-gray-600">AI-generated · updates as you go</span>
      </div>
    </div>
  );
}

// ---- How it works steps ----
const STEPS = [
  {
    n: "1",
    title: "Add your goals",
    description: "Tell OnTrack what you want to achieve and how much time you have. Guitar, running, a language — anything.",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    n: "2",
    title: "Set your schedule",
    description: "Mark when you're free and block out recurring commitments. OnTrack fits around your life, not the other way around.",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
      </svg>
    ),
  },
  {
    n: "3",
    title: "Follow your plan",
    description: "Get a personalised week of timed sessions and specific tasks. Regenerate any day that isn't working for you.",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" />
      </svg>
    ),
  },
];

// ---- Main component ----
export default function Landing() {
  const { loginWithRedirect } = useAuth0();

  return (
    <div className="flex flex-col items-center px-4 py-16 min-h-[calc(100vh-56px)]">

      {/* ---- Hero ---- */}
      <div className="flex flex-col items-center text-center relative w-full max-w-2xl">
        {/* Glow behind headline */}
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-64 pointer-events-none"
          style={{
            background: "radial-gradient(ellipse at center, rgba(99,102,241,0.15) 0%, transparent 70%)",
          }}
        />

        {/* Badge */}
        <div className="relative mb-6 inline-flex items-center gap-2 px-3 py-1 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-400 text-xs font-medium tracking-wide">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
          AI-powered planning
        </div>

        {/* Headline */}
        <h1 className="relative text-4xl sm:text-5xl font-bold tracking-tight text-white leading-tight mb-5">
          Your goals,{" "}
          <span className="text-indigo-400">your pace.</span>
        </h1>

        {/* Subtext */}
        <p className="relative text-gray-400 text-lg max-w-md mb-3 leading-relaxed">
          OnTrack turns your goals into a realistic week-by-week plan — built around your schedule, your constraints, and your level.
        </p>

        {/* Quick trust signals */}
        <div className="flex items-center gap-4 text-xs text-gray-600 mb-10">
          <span className="flex items-center gap-1">
            <svg className="w-3.5 h-3.5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
            Free to use
          </span>
          <span className="flex items-center gap-1">
            <svg className="w-3.5 h-3.5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
            Set up in 2 minutes
          </span>
          <span className="flex items-center gap-1">
            <svg className="w-3.5 h-3.5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
            Multiple goals at once
          </span>
        </div>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center gap-3 mb-4">
          <button
            onClick={() => loginWithRedirect()}
            className="px-7 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg text-base transition-colors shadow-lg shadow-indigo-600/25"
          >
            Get started — it&apos;s free
          </button>
          <button
            onClick={() => loginWithRedirect()}
            className="px-7 py-3 border border-gray-700 hover:border-gray-500 text-gray-300 hover:text-white font-medium rounded-lg text-base transition-colors"
          >
            Log in
          </button>
        </div>
      </div>

      {/* ---- Plan preview ---- */}
      <div className="w-full max-w-2xl mt-14">
        <p className="text-center text-xs text-gray-600 mb-4 uppercase tracking-widest font-medium">
          Your week — intelligently planned
        </p>
        <PlanPreview />
      </div>

      {/* ---- How it works ---- */}
      <div className="w-full max-w-2xl mt-20">
        <h2 className="text-center text-base font-semibold text-white mb-10">How it works</h2>

        <div className="relative grid grid-cols-1 sm:grid-cols-3 gap-8">
          {/* Connecting line (desktop only) */}
          <div className="hidden sm:block absolute top-6 left-[calc(16.67%+12px)] right-[calc(16.67%+12px)] h-px bg-gray-800 pointer-events-none" />

          {STEPS.map((step) => (
            <div key={step.n} className="flex flex-col items-center sm:items-start text-center sm:text-left gap-3 relative">
              <div className="w-12 h-12 rounded-xl border border-gray-700 bg-gray-900 flex items-center justify-center text-indigo-400 shrink-0 relative z-10">
                {step.icon}
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-widest text-gray-600 font-medium mb-1">Step {step.n}</div>
                <h3 className="text-sm font-semibold text-white mb-1">{step.title}</h3>
                <p className="text-xs text-gray-500 leading-relaxed">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ---- Bottom CTA ---- */}
      <div className="mt-20 flex flex-col items-center gap-4 text-center">
        <p className="text-gray-400 text-sm">Ready to actually make progress?</p>
        <button
          onClick={() => loginWithRedirect()}
          className="px-7 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg text-base transition-colors shadow-lg shadow-indigo-600/20"
        >
          Create your first goal
        </button>
      </div>

    </div>
  );
}
