import { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import AuthModal from "../components/AuthModal";

// ── CSS vars (sage accent, warm cream bg) ───────────────────────────────────
const V = {
  bg:       "#FBFAF7",
  paper:    "#ffffff",
  ink:      "#0b0b0b",
  ink90:    "rgba(11,11,11,.90)",
  ink60:    "rgba(11,11,11,.60)",
  ink40:    "rgba(11,11,11,.40)",
  ink25:    "rgba(11,11,11,.25)",
  ink12:    "rgba(11,11,11,.12)",
  ink08:    "rgba(11,11,11,.08)",
  ink05:    "rgba(11,11,11,.05)",
  accent:   "oklch(0.72 0.06 150)",
  accentInk:"oklch(0.38 0.06 150)",
  accentBg: "oklch(0.94 0.03 150)",
};

// ── Hooks ────────────────────────────────────────────────────────────────────

function useReveal() {
  useEffect(() => {
    const els = document.querySelectorAll(".landing-reveal");
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -60px 0px" });
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}

function useInView(ref: React.RefObject<HTMLElement | null>, threshold = 0.25) {
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    if (!ref.current) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) setSeen(true); }, { threshold });
    io.observe(ref.current);
    return () => io.disconnect();
  }, []);
  return seen;
}

// ── Typewriter ───────────────────────────────────────────────────────────────

const GOALS = [
  "learn guitar 🎸",
  "run a half marathon 🏃",
  "speak spanish 🌍",
  "write every morning ✍︎",
  "get stronger 💪",
  "draw every day 🎨",
];

function Typewriter() {
  const [i, setI] = useState(0);
  const [sub, setSub] = useState("");
  const [phase, setPhase] = useState<"type"|"hold"|"erase">("type");

  useEffect(() => {
    const word = GOALS[i % GOALS.length];
    let t: ReturnType<typeof setTimeout>;
    if (phase === "type") {
      if (sub.length < word.length) t = setTimeout(() => setSub(word.slice(0, sub.length + 1)), 70);
      else t = setTimeout(() => setPhase("hold"), 50);
    } else if (phase === "hold") {
      t = setTimeout(() => setPhase("erase"), 1200);
    } else {
      if (sub.length > 0) t = setTimeout(() => setSub(sub.slice(0, -1)), 35);
      else { setPhase("type"); setI((v) => v + 1); }
    }
    return () => clearTimeout(t);
  }, [sub, phase, i]);

  return (
    <span style={{ display: "inline-flex", alignItems: "center" }}>
      <span>{sub}</span>
      <span style={{
        display: "inline-block", width: 2, height: "0.9em",
        background: V.accent, marginLeft: 4,
        animation: "blink 1s step-end infinite",
      }} />
    </span>
  );
}

// ── Wordmark ─────────────────────────────────────────────────────────────────

const LETTERS = [
  { ch: "O", cx: 54.73,  cy: 66.89, r: -24.25, sk: -4.01 },
  { ch: "N", cx: 85.15,  cy: 50.56, r: -17.66, sk: -3.05 },
  { ch: "T", cx: 129.68, cy: 44.33, r:   6.77, sk:  1.22 },
  { ch: "R", cx: 159.22, cy: 52.44, r:   6.77, sk:  1.22 },
  { ch: "A", cx: 189.69, cy: 53.98, r:   6.77, sk:  1.22 },
  { ch: "C", cx: 221.08, cy: 52.40, r:  -8.26, sk: -1.48 },
  { ch: "K", cx: 254.24, cy: 35.58, r: -27.61, sk: -4.43 },
];

function CurvedWordmark({ scale = 1 }: { scale?: number }) {
  return (
    <svg viewBox="0 0 280 100" height={62 * scale}
      style={{ width: "auto", display: "block", overflow: "visible", userSelect: "none" }}
      aria-label="ON TRACK"
    >
      {LETTERS.map(({ ch, cx, cy, r, sk }) => (
        <text key={ch} x="0" y="0" textAnchor="middle" dominantBaseline="central"
          fontFamily="Epilogue, sans-serif" fontWeight="700" fontSize="48"
          fill="currentColor" letterSpacing="-1.44"
          transform={`translate(${cx},${cy}) skewX(${sk}) rotate(${r})`}
        >{ch}</text>
      ))}
    </svg>
  );
}

// ── Nav ───────────────────────────────────────────────────────────────────────

function Nav({ onSignIn, onSignUp }: { onSignIn: () => void; onSignUp: () => void }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    on(); window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  const navBtnBase: React.CSSProperties = {
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    padding: "9px 16px", borderRadius: 999, fontSize: 13, fontWeight: 500,
    textDecoration: "none", cursor: "pointer", border: "1px solid transparent",
    fontFamily: "Epilogue, sans-serif", transition: "all .2s ease",
    background: "transparent",
  };

  return (
    <nav style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 50,
      backdropFilter: scrolled ? "saturate(140%) blur(10px)" : "none",
      background: scrolled ? "rgba(251,250,247,.85)" : "transparent",
      borderBottom: scrolled ? `1px solid ${V.ink08}` : "1px solid transparent",
      transition: "all .3s ease",
    }}>
      <div style={{ maxWidth: 1320, margin: "0 auto", padding: "18px 32px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <CurvedWordmark scale={0.58} />
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <a href="#how" style={{ fontSize: 13, fontWeight: 500, color: V.ink60, textDecoration: "none", padding: "9px 14px", borderRadius: 999 }}>how it works</a>
          <a href="#who" style={{ fontSize: 13, fontWeight: 500, color: V.ink60, textDecoration: "none", padding: "9px 14px", borderRadius: 999 }}>who it's for</a>
          <button onClick={onSignIn} style={{ ...navBtnBase, color: V.ink90, borderColor: V.ink12 }}>log in</button>
          <button onClick={onSignUp} style={{ ...navBtnBase, background: V.ink, color: V.bg }}>sign up</button>
        </div>
      </div>
    </nav>
  );
}

// ── Hero (split) ──────────────────────────────────────────────────────────────

function HeroSplit({ onSignUp, onContinue }: { onSignUp: () => void; onContinue: () => void }) {
  return (
    <section id="top" style={{ paddingTop: 96, paddingBottom: 80, position: "relative", zIndex: 1 }}>
      <div style={{
        maxWidth: 1280, margin: "0 auto", padding: "0 32px",
        display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 64, alignItems: "center",
      }}>
        <div>
          <h1 className="landing-reveal" style={{
            fontSize: "clamp(48px, 6.6vw, 104px)", lineHeight: 0.92, fontWeight: 800,
            letterSpacing: "-0.045em", margin: 0, color: V.ink,
          }}>
            <div>your <UnderlinedWord>goals</UnderlinedWord></div>
            <div>your <UnderlinedWord>pace</UnderlinedWord></div>
          </h1>
          <p className="landing-reveal" style={{ marginTop: 24, fontSize: 18, lineHeight: 1.5, color: V.ink60, maxWidth: 420, fontWeight: 400 }}>
            a weekly plan for the thing you keep meaning to come back to.
          </p>
          <div className="landing-reveal" style={{ marginTop: 32, display: "flex", gap: 12, flexWrap: "wrap" }}>
            <button onClick={onSignUp} style={btnSolid}>start your plan →</button>
            <a href="#how" style={btnGhost}>see how it works</a>
          </div>
          <div className="landing-reveal" style={{ marginTop: 20, fontSize: 12, color: V.ink40, display: "inline-flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 6, height: 6, borderRadius: 999, background: V.accent, animation: "gentle-pulse 2.4s ease infinite" }} />
            free to try · <button onClick={onContinue} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: V.ink40, fontSize: 12, fontFamily: "inherit" }}>no signup required</button>
          </div>
        </div>

        <div className="landing-reveal" style={{ position: "relative" }}>
          <div style={{ position: "absolute", inset: -32, background: `radial-gradient(closest-side, ${V.accentBg} 0%, transparent 70%)`, borderRadius: "50%", opacity: .7 }} />
          <div style={{ position: "relative", animation: "float 8s ease-in-out infinite" }}>
            <GoalInputVisual />
          </div>
        </div>
      </div>
    </section>
  );
}

function UnderlinedWord({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ position: "relative", display: "inline-block" }}>
      {children}
      <span style={{
        position: "absolute", left: 0, right: 0, bottom: "0.06em",
        height: "0.14em", background: V.accent, borderRadius: 999, zIndex: -1,
      }} />
    </span>
  );
}

const btnSolid: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", justifyContent: "center",
  padding: "14px 24px", borderRadius: 999, fontSize: 14, fontWeight: 600,
  background: V.ink, color: V.bg, border: "none", cursor: "pointer",
  fontFamily: "Epilogue, sans-serif", textDecoration: "none", transition: "background .2s",
};
const btnGhost: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", justifyContent: "center",
  padding: "14px 24px", borderRadius: 999, fontSize: 14, fontWeight: 600,
  background: "transparent", color: V.ink, border: `1px solid ${V.ink12}`,
  cursor: "pointer", fontFamily: "Epilogue, sans-serif", textDecoration: "none",
};

// ── Marquee ───────────────────────────────────────────────────────────────────

function Marquee() {
  const items = ["learn guitar","run a half marathon","speak spanish","write every morning","get stronger","draw every day","learn to cook","read more","meditate","pick up pottery","build a website","take cold showers"];
  const doubled = [...items, ...items];
  return (
    <section style={{ padding: "50px 0", borderTop: `1px solid ${V.ink08}`, borderBottom: `1px solid ${V.ink08}`, overflow: "hidden", background: V.accentBg }}>
      <div style={{ display: "flex", gap: 48, animation: "marquee 42s linear infinite", whiteSpace: "nowrap", width: "max-content" }}>
        {doubled.map((t, i) => (
          <div key={i} style={{ display: "inline-flex", alignItems: "center", gap: 48 }}>
            <span style={{ fontSize: 28, fontWeight: 500, color: V.accentInk, letterSpacing: "-0.01em", opacity: .75 }}>{t}</span>
            <span style={{ color: V.accent, fontSize: 14 }}>✦</span>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── How it works ──────────────────────────────────────────────────────────────

function HowItWorks() {
  const steps = [
    {
      n: "01", label: "step 1",
      title: "tell us what you're building.",
      body: "pick a skill, a habit, a craft. not a deadline project — something you want to be genuinely good at, weeks and months from now.",
      visual: <GoalInputVisual />,
    },
    {
      n: "02", label: "step 2",
      title: "answer a few questions.",
      body: "a short back-and-forth so the plan knows where you're starting, what's in your way, and what you actually have time for.",
      visual: <ChatVisual />,
    },
    {
      n: "03", label: "step 3",
      title: "get a week that fits.",
      body: "specific sessions, exact times, real tasks — automatically blocked around your existing life. every week, ontrack shows up with you.",
      visual: <PlanCard />,
    },
  ];

  return (
    <section id="how" style={{ padding: "120px 0", position: "relative", zIndex: 1 }}>
      <div style={{ maxWidth: 1320, margin: "0 auto", padding: "0 32px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 120 }}>
          {steps.map((s, i) => (
            <div key={i} className="landing-reveal" style={{
              display: "grid", gridTemplateColumns: "1fr 1fr", gap: 80, alignItems: "center",
              direction: i % 2 === 1 ? "rtl" : "ltr",
            }}>
              <div style={{ direction: "ltr" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                  <span style={{
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    width: 42, height: 42, borderRadius: 999,
                    background: V.accentBg, color: V.accentInk,
                    fontSize: 13, fontWeight: 800, flexShrink: 0,
                  }}>{s.n}</span>
                  <span style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: V.ink40, fontWeight: 700 }}>{s.label}</span>
                </div>
                <h3 style={{ fontSize: "clamp(28px, 3.4vw, 44px)", lineHeight: 1.05, fontWeight: 800, letterSpacing: "-0.025em", margin: 0 }}>
                  {s.title}
                </h3>
                <p style={{ marginTop: 16, fontSize: 16, lineHeight: 1.6, color: V.ink60, maxWidth: 440 }}>{s.body}</p>
              </div>
              <div style={{ direction: "ltr", display: "flex", justifyContent: "center" }}>{s.visual}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Use cases ─────────────────────────────────────────────────────────────────

function UseCases() {
  const cases = [
    { emoji: "🎸", title: "the one collecting dust in the corner.", body: "that guitar you bought three years ago. the keyboard. the watercolor set. still wanting you to come back.", pace: "2 hrs / week" },
    { emoji: "🌍", title: "the language you keep almost learning.", body: "fourteen apps, three phrasebooks, still not ordering coffee in it. a quieter path that actually adds up.", pace: "30 min / day" },
    { emoji: "🏃", title: "the body you keep meaning to become.", body: "not a cut, not a bulk, not a reset. just the person who moves — on weeks that look like your weeks.", pace: "4 sessions / week" },
    { emoji: "✍︎", title: "the page you keep not writing on.", body: "the novel, the newsletter, the blog no one asked for. the one you will be glad you started.", pace: "morning pages" },
    { emoji: "🧘", title: "the quieter you you keep postponing.", body: "meditation, journaling, a real wind-down. built around the evenings you actually have, not the ones you don't.", pace: "10 min / night" },
    { emoji: "🎨", title: "the craft you secretly wish you'd picked up.", body: "pottery, woodworking, drawing. ontrack starts you honest and small — and keeps showing up on tuesday.", pace: "1 session / week" },
  ];

  return (
    <section id="who" style={{ padding: "120px 0", position: "relative", zIndex: 1, background: V.paper, borderTop: `1px solid ${V.ink08}`, borderBottom: `1px solid ${V.ink08}` }}>
      <div style={{ maxWidth: 1320, margin: "0 auto", padding: "0 32px" }}>
        <div className="landing-reveal" style={{ textAlign: "center", marginBottom: 80 }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "6px 14px", borderRadius: 999,
            fontSize: 11, letterSpacing: 3, textTransform: "uppercase",
            fontWeight: 700, color: V.accentInk, background: V.accentBg, marginBottom: 20,
          }}>
            <span style={{ width: 5, height: 5, borderRadius: 999, background: V.accent }} />
            who it's for
          </div>
          <h2 style={{ fontSize: "clamp(36px, 5vw, 64px)", lineHeight: 1, fontWeight: 800, letterSpacing: "-0.03em", margin: "0 auto", maxWidth: 780 }}>
            for the{" "}
            <span style={{ fontFamily: "Fraunces, Georgia, serif", fontStyle: "italic", fontWeight: 300 }}>
              things you keep not starting.
            </span>
          </h2>
          <p style={{ marginTop: 20, fontSize: 15, color: V.ink60, maxWidth: 540, margin: "20px auto 0" }}>
            ontrack is built for long-term growth — the weeks and months kind — not cramming, not deadlines, not one-off projects.
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1, background: V.ink08, border: `1px solid ${V.ink08}`, borderRadius: 2, overflow: "hidden" }}>
          {cases.map((c, i) => (
            <div key={i} className="landing-reveal" style={{ background: V.paper, padding: "40px 32px", display: "flex", flexDirection: "column", minHeight: 280 }}>
              <div style={{ fontSize: 28, marginBottom: 16, opacity: .85 }}>{c.emoji}</div>
              <h3 style={{ fontSize: 22, lineHeight: 1.15, fontWeight: 700, letterSpacing: "-0.02em", margin: 0 }}>{c.title}</h3>
              <p style={{ marginTop: 12, fontSize: 14, lineHeight: 1.6, color: V.ink60, flex: 1 }}>{c.body}</p>
              <div style={{ marginTop: 20, paddingTop: 16, borderTop: `1px dashed ${V.ink12}`, display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 6, height: 6, borderRadius: 999, background: V.accent }} />
                <span style={{ fontSize: 11, color: V.ink60, letterSpacing: 0.5 }}>{c.pace}</span>
              </div>
            </div>
          ))}
        </div>

        <p className="landing-reveal" style={{ textAlign: "center", marginTop: 48, fontSize: 13, color: V.ink40, fontStyle: "italic" }}>
          not built for: studying for the midterm, finishing the project, one-time tasks.
        </p>
      </div>
    </section>
  );
}

// ── Final CTA ─────────────────────────────────────────────────────────────────

function FinalCTA({ onSignUp, onSignIn, onContinue }: { onSignUp: () => void; onSignIn: () => void; onContinue: () => void }) {
  return (
    <section id="cta" style={{ padding: "140px 0 120px", position: "relative", zIndex: 1, background: `linear-gradient(180deg, ${V.bg} 0%, ${V.accentBg} 100%)` }}>
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "0 32px", textAlign: "center" }}>
        <div className="landing-reveal" style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          padding: "6px 14px", borderRadius: 999,
          fontSize: 11, letterSpacing: 3, textTransform: "uppercase",
          fontWeight: 700, color: V.accentInk, background: V.accentBg, marginBottom: 28,
        }}>
          <span style={{ width: 5, height: 5, borderRadius: 999, background: V.accent }} />
          finally.
        </div>
        <h2 className="landing-reveal" style={{ fontSize: "clamp(40px, 7vw, 96px)", lineHeight: 0.98, fontWeight: 800, letterSpacing: "-0.035em", margin: 0 }}>
          your goals,{" "}
          <span style={{ fontFamily: "Fraunces, Georgia, serif", fontStyle: "italic", fontWeight: 300 }}>
            <UnderlinedWord>at your pace.</UnderlinedWord>
          </span>
        </h2>
        <p className="landing-reveal" style={{ marginTop: 28, fontSize: 17, color: V.ink60, lineHeight: 1.55, maxWidth: 520, margin: "28px auto 0" }}>
          the guitar isn't going anywhere. neither is the language, the body, the book. start the week you've been meaning to start.
        </p>
        <div className="landing-reveal" style={{ marginTop: 44, display: "flex", justifyContent: "center", gap: 12, flexWrap: "wrap" }}>
          <button onClick={onSignUp} style={btnSolid}>start your plan →</button>
          <button onClick={onContinue} style={btnGhost}>continue without account</button>
        </div>
        <div className="landing-reveal" style={{ marginTop: 18, fontSize: 12, color: V.ink40 }}>
          already have an account?{" "}
          <button onClick={onSignIn} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: V.ink90, fontSize: 12, fontFamily: "inherit", textDecoration: "underline", textDecorationColor: V.ink12, textUnderlineOffset: 3 }}>log in</button>
        </div>
      </div>
    </section>
  );
}

// ── Footer ────────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer style={{ borderTop: `1px solid ${V.ink08}`, padding: "36px 32px", position: "relative", zIndex: 1 }}>
      <div style={{ maxWidth: 1320, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, color: V.ink40, flexWrap: "wrap", gap: 16 }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 12, color: V.ink60 }}>
          <CurvedWordmark scale={0.48} />
          <span>· your goals, at your pace.</span>
        </div>
        <div style={{ display: "flex", gap: 20 }}>
          <a href="#" style={{ color: "inherit", textDecoration: "none" }}>privacy</a>
          <a href="#" style={{ color: "inherit", textDecoration: "none" }}>terms</a>
          <a href="#" style={{ color: "inherit", textDecoration: "none" }}>contact</a>
        </div>
      </div>
    </footer>
  );
}

// ── Product visuals ───────────────────────────────────────────────────────────

function PlanCard() {
  const ref = useRef<HTMLDivElement>(null);
  const seen = useInView(ref);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!seen) return;
    let alive = true;
    const wait = (ms: number) => new Promise<void>(r => setTimeout(r, ms));
    (async () => {
      while (alive) {
        for (let s = 0; s <= 6; s++) {
          if (!alive) return;
          setStep(s);
          await wait(s === 0 ? 600 : 800);
        }
        await wait(2500);
        setStep(0);
        await wait(600);
      }
    })();
    return () => { alive = false; };
  }, [seen]);

  const rows = [
    { time: "7:00 am", label: "guitar practice", accent: true, tasks: [{ t: "chord transitions · 20 min", done: true }, { t: "fingerpicking · 15 min", done: false }] },
    { time: "12:30 pm", label: "spanish listening", tasks: [{ t: "podcast episode · 25 min", done: false }] },
    { time: "6:00 pm", label: "evening run", tasks: [{ t: "easy 3 km · 30 min", done: false }, { t: "cool-down stretches · 10 min", done: false }] },
  ];

  return (
    <div ref={ref} style={{ width: "100%", maxWidth: 440, margin: "0 auto", background: V.paper, border: `1px solid ${V.ink08}`, borderRadius: 18, boxShadow: "0 24px 60px -30px rgba(0,0,0,.15)", overflow: "hidden" }}>
      <div style={{ padding: "14px 18px", borderBottom: `1px solid ${V.ink05}`, display: "flex", justifyContent: "space-between", alignItems: "center", background: V.bg }}>
        <div style={{ fontSize: 12, fontWeight: 700 }}>monday, apr 14</div>
        <div style={{ fontSize: 10, color: V.ink40, letterSpacing: 1, textTransform: "uppercase" }}>today</div>
      </div>
      {rows.map((r, idx) => {
        const appearAt = idx * 2 + 1;
        const visible = step >= appearAt;
        const tasksVisible = step >= appearAt + 1;
        return (
          <div key={idx} style={{ padding: "14px 18px", borderBottom: idx < rows.length - 1 ? `1px solid ${V.ink05}` : "none", display: "flex", gap: 14, opacity: visible ? 1 : 0, transform: visible ? "none" : "translateY(8px)", transition: "all .5s cubic-bezier(.2,.7,.2,1)" }}>
            <div style={{ fontSize: 10, color: V.ink40, width: 52, flexShrink: 0, paddingTop: 2, letterSpacing: 0.3 }}>{r.time}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
                {r.label}
                {r.accent && <span style={{ width: 6, height: 6, borderRadius: 999, background: V.accent, display: "inline-block" }} />}
              </div>
              <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 5 }}>
                {r.tasks.map((t, ti) => (
                  <div key={ti} style={{ display: "flex", alignItems: "center", gap: 8, whiteSpace: "nowrap", opacity: tasksVisible ? 1 : 0, transform: tasksVisible ? "none" : "translateX(-4px)", transition: `all .5s ease ${ti * 80}ms` }}>
                    <span style={{ width: 11, height: 11, borderRadius: 999, border: t.done ? "none" : `1.2px solid ${V.ink25}`, background: t.done ? V.accent : "transparent", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      {t.done && <svg width="7" height="7" viewBox="0 0 10 10"><path d="M2 5l2 2 4-4" stroke={V.bg} strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                    </span>
                    <span style={{ fontSize: 11.5, color: t.done ? V.ink40 : V.ink60, textDecoration: t.done ? "line-through" : "none" }}>{t.t}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ChatVisual() {
  const ref = useRef<HTMLDivElement>(null);
  const seen = useInView(ref);
  const [step, setStep] = useState(0);

  const script = [
    { kind: "ai",     text: "how much time can you give guitar in a normal week?" },
    { kind: "me",     text: "maybe 3 short sessions? evenings mostly." },
    { kind: "typing" },
    { kind: "ai",     text: "got it. any songs you'd love to play by the end of the month?" },
    { kind: "me",     text: "landslide, and something fingerstyle." },
    { kind: "typing" },
    { kind: "ai",     text: "perfect — i'll build around chord changes and a fingerpicking warm-up." },
  ];

  useEffect(() => {
    if (!seen) return;
    let alive = true;
    const wait = (ms: number) => new Promise<void>(r => setTimeout(r, ms));
    (async () => {
      for (let i = 0; i <= script.length; i++) {
        if (!alive) return;
        setStep(i);
        const cur = script[i - 1];
        if (cur?.kind === "typing") await wait(1100);
        else if (cur?.kind === "ai") await wait(1800);
        else await wait(1300);
      }
    })();
    return () => { alive = false; };
  }, [seen]);

  return (
    <div ref={ref} style={{ width: "100%", maxWidth: 380, margin: "0 auto", display: "flex", flexDirection: "column", gap: 10, minHeight: 280 }}>
      {script.slice(0, step).map((msg, i) => {
        const isLast = i === step - 1;
        if (msg.kind === "typing") {
          if (!isLast) return null;
          return (
            <div key={i} style={{ alignSelf: "flex-start", padding: "12px 16px", background: V.paper, border: `1px solid ${V.ink08}`, borderRadius: "4px 16px 16px 16px", display: "flex", gap: 4, animation: "rise .4s ease both" }}>
              {[0,1,2].map(n => <span key={n} style={{ width: 6, height: 6, borderRadius: 999, background: V.ink25, animation: `gentle-pulse 1.1s ease ${n * 0.15}s infinite` }} />)}
            </div>
          );
        }
        const isMe = msg.kind === "me";
        return (
          <div key={i} style={{ alignSelf: isMe ? "flex-end" : "flex-start", maxWidth: "82%", padding: "12px 16px", background: isMe ? V.ink : V.paper, color: isMe ? V.bg : V.ink90, border: isMe ? "none" : `1px solid ${V.ink08}`, borderRadius: isMe ? "16px 4px 16px 16px" : "4px 16px 16px 16px", fontSize: 13, lineHeight: 1.55, animation: "rise .5s cubic-bezier(.2,.7,.2,1) both" }}>
            {msg.text}
          </div>
        );
      })}
    </div>
  );
}

const GOAL_PREVIEWS = [
  { goal: "learn guitar", emoji: "🎸", tasks: ["chord transitions · 20 min", "fingerpicking warm-up · 15 min", "practice 'wonderwall' · 10 min"] },
  { goal: "speak spanish", emoji: "🌍", tasks: ["duolingo streak · 15 min", "spanish podcast · 25 min", "journal in spanish · 10 min"] },
  { goal: "run a half marathon", emoji: "🏃", tasks: ["easy 5k run · 35 min", "interval workout · 25 min", "recovery stretches · 10 min"] },
  { goal: "write every morning", emoji: "✍︎", tasks: ["morning pages · 20 min", "draft a scene · 30 min", "re-read yesterday · 5 min"] },
  { goal: "get stronger", emoji: "💪", tasks: ["upper body lifts · 40 min", "core circuit · 15 min", "mobility work · 10 min"] },
];

function GoalInputVisual() {
  const ref = useRef<HTMLDivElement>(null);
  const seen = useInView(ref);
  const [i, setI] = useState(0);
  const [typed, setTyped] = useState("");
  const [phase, setPhase] = useState<"type"|"show"|"clear">("type");

  useEffect(() => {
    if (!seen) return;
    const word = GOAL_PREVIEWS[i % GOAL_PREVIEWS.length].goal;
    let t: ReturnType<typeof setTimeout>;
    if (phase === "type") {
      if (typed.length < word.length) t = setTimeout(() => setTyped(word.slice(0, typed.length + 1)), 55);
      else t = setTimeout(() => setPhase("show"), 400);
    } else if (phase === "show") {
      t = setTimeout(() => setPhase("clear"), 3200);
    } else {
      if (typed.length > 0) t = setTimeout(() => setTyped(typed.slice(0, -1)), 25);
      else { setPhase("type"); setI((v) => v + 1); }
    }
    return () => clearTimeout(t);
  }, [typed, phase, i, seen]);

  const cur = GOAL_PREVIEWS[i % GOAL_PREVIEWS.length];
  const showTasks = phase === "show";

  return (
    <div ref={ref} style={{ width: "100%", maxWidth: 400, margin: "0 auto", background: V.paper, border: `1px solid ${V.ink08}`, borderRadius: 20, padding: 22, boxShadow: "0 24px 60px -30px rgba(0,0,0,.15)" }}>
      <div style={{ fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: V.accentInk, marginBottom: 12, display: "inline-flex", alignItems: "center", gap: 6 }}>
        <span style={{ width: 5, height: 5, borderRadius: 999, background: V.accent }} />
        i want to…
      </div>
      <div style={{ padding: "14px 16px", border: `1px solid ${V.ink12}`, borderRadius: 12, fontSize: 18, fontWeight: 600, color: V.ink90, minHeight: 52, display: "flex", alignItems: "center", gap: 8, background: V.bg }}>
        <span style={{ fontSize: 18 }}>{cur.emoji}</span>
        <span style={{ display: "inline-flex", alignItems: "center" }}>
          {typed}
          <span style={{ display: "inline-block", width: 2, height: "1em", background: V.accent, marginLeft: 3, animation: "blink 1s step-end infinite" }} />
        </span>
      </div>
      <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px dashed ${V.ink12}`, minHeight: 168 }}>
        <div style={{ fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: V.ink40, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
          <span>here's the week</span>
          <span style={{ flex: 1, height: 1, background: V.ink08 }} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {cur.tasks.map((t, idx) => (
            <div key={cur.goal + idx} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: V.bg, border: `1px solid ${V.ink05}`, borderRadius: 10, opacity: showTasks ? 1 : 0, transform: showTasks ? "translateY(0)" : "translateY(6px)", transition: `all .45s cubic-bezier(.2,.7,.2,1) ${idx * 120}ms` }}>
              <span style={{ width: 10, height: 10, borderRadius: 999, border: `1.2px solid ${V.accent}`, background: V.accentBg, flexShrink: 0 }} />
              <span style={{ fontSize: 12.5, color: V.ink60, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function Landing() {
  const { openAuthModal } = useAuth();
  const navigate = useNavigate();

  useReveal();

  const onSignUp   = () => openAuthModal("signup");
  const onSignIn   = () => openAuthModal("signin");
  const onContinue = () => navigate("/goals/new");

  return (
    <div style={{ background: V.bg, minHeight: "100vh", fontFamily: "Epilogue, sans-serif", color: V.ink }}>
      <Nav onSignIn={onSignIn} onSignUp={onSignUp} />
      <main style={{ position: "relative" }}>
        <HeroSplit onSignUp={onSignUp} onContinue={onContinue} />
        <Marquee />
        <HowItWorks />
        <UseCases />
        <FinalCTA onSignUp={onSignUp} onSignIn={onSignIn} onContinue={onContinue} />
      </main>
      <Footer />
      <AuthModal />
    </div>
  );
}
