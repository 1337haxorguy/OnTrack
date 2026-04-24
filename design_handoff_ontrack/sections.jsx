/* Page sections */

function Hero({ variant, headline }) {
  const lines = headline.split("\n");
  if (variant === "split") return <HeroSplit headline={headline} />;
  if (variant === "diary") return <HeroDiary headline={headline} />;
  return <HeroEditorial headline={headline} lines={lines} />;
}

function HeroEditorial({ headline, lines }) {
  return (
    <section id="top" style={{ paddingTop: 140, paddingBottom: 140, position: "relative", zIndex: 1 }}>
      <div style={{ maxWidth: 1320, margin: "0 auto", padding: "0 32px", textAlign: "center" }}>
        <div className="reveal" style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 11, letterSpacing: 3, textTransform: "uppercase", color: "var(--accent-ink)", fontWeight: 700, marginBottom: 28, padding: "6px 14px", background: "var(--accent-bg)", borderRadius: 999 }}>
          <span style={{ width: 5, height: 5, borderRadius: 999, background: "var(--accent-solid)" }} />
          finally.
        </div>
        <h1 className="reveal" style={{
          fontSize: "clamp(48px, 8.4vw, 128px)",
          lineHeight: 0.94, fontWeight: 800, letterSpacing: -0.04,
          margin: "0 auto", maxWidth: 14 + "ch", textWrap: "balance",
          color: "var(--ink)",
        }}>
          {lines.map((l, i) => (
            <div key={i} style={{ display: "block" }}>
              {i === lines.length - 1 ? <span className="serif accent-underline" style={{ fontWeight: 300, letterSpacing: -0.02 }}>{l}</span> : l}
            </div>
          ))}
        </h1>
        <p className="reveal" style={{
          marginTop: 36, fontSize: 17, lineHeight: 1.55, color: "var(--ink-60)",
          maxWidth: 520, margin: "36px auto 0", textWrap: "pretty",
        }}>
          the guitar in the corner. the language app you abandoned. the gym membership collecting dust. ontrack turns what you want to become into a plan that actually fits your life.
        </p>

        <div className="reveal" style={{
          marginTop: 44, display: "inline-flex", alignItems: "center", gap: 10,
          padding: "10px 16px", background: "var(--paper)",
          border: "1px solid var(--ink-08)",
          borderRadius: 999, boxShadow: "0 0 0 4px var(--accent-bg), 0 1px 0 rgba(0,0,0,.02)",
        }}>
          <span style={{ width: 6, height: 6, borderRadius: 999, background: "var(--accent-solid)", display: "inline-block" }} />
          <span style={{ fontSize: 11, color: "var(--ink-40)" }}>i want to</span>
          <span style={{ fontSize: 15, fontWeight: 600, minWidth: 220, display: "inline-flex", justifyContent: "flex-start" }}>
            <Typewriter />
          </span>
        </div>

        <div className="reveal" style={{ marginTop: 36, display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <a href="#cta" className="btn btn--solid btn--lg">start your plan →</a>
          <a href="#how" className="btn btn--ghost btn--lg">see how it works</a>
        </div>
        <div className="reveal" style={{ marginTop: 24, fontSize: 12, color: "var(--ink-40)", display: "inline-flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 6, height: 6, borderRadius: 999, background: "var(--accent-solid)", animation: "gentle-pulse 2.4s ease infinite" }} />
          your goals, at your pace. · free to try, no signup required.
        </div>
      </div>
    </section>
  );
}

function HeroSplit({ headline }) {
  const lines = headline.split("\n").filter(l => l.trim().length);
  return (
    <section id="top" style={{ paddingTop: 96, paddingBottom: 80, position: "relative", zIndex: 1 }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 32px", display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 64, alignItems: "center" }}>
        <div>
          <h1 className="reveal" style={{
            fontSize: "clamp(48px, 6.6vw, 104px)", lineHeight: 0.92, fontWeight: 800, letterSpacing: -0.045,
            margin: 0, color: "var(--ink)",
            fontFamily: "Epilogue, sans-serif",
          }}>
            {lines.map((l, i) => {
              const parts = l.trim().split(/\s+/);
              const last = parts.pop();
              return (
                <div key={i} style={{ display: "block" }}>
                  {parts.length > 0 && <span>{parts.join(" ") + " "}</span>}
                  <span className="accent-underline-slab" style={{ fontWeight: 800 }}>{last}</span>
                </div>
              );
            })}
          </h1>
          <p className="reveal" style={{ marginTop: 24, fontSize: 18, lineHeight: 1.5, color: "var(--ink-60)", maxWidth: 460, fontWeight: 400 }}>
            ontrack plans your week around the skill or habit you actually want to build — so you practice on tuesday, not "someday."
          </p>
          <div className="reveal" style={{ marginTop: 32, display: "flex", gap: 12, flexWrap: "wrap" }}>
            <a href="#cta" className="btn btn--solid btn--lg">get started — it's free</a>
            <a href="#how" className="btn btn--ghost btn--lg">see how it works</a>
          </div>
          <div className="reveal" style={{ marginTop: 20, fontSize: 12, color: "var(--ink-40)", display: "inline-flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 6, height: 6, borderRadius: 999, background: "var(--accent-solid)", animation: "gentle-pulse 2.4s ease infinite" }} />
            no credit card. no signup to try.
          </div>
        </div>
        <div className="reveal" style={{ position: "relative" }}>
          <div style={{ position: "absolute", inset: -32, background: "radial-gradient(closest-side, var(--accent-bg) 0%, transparent 70%)", zIndex: 0, borderRadius: "50%", opacity: .7 }} />
          <div style={{ position: "relative", zIndex: 1, animation: "float 8s ease-in-out infinite" }}>
            <GoalInputVisual />
          </div>
        </div>
      </div>
    </section>
  );
}

function HeroDiary({ headline }) {
  return (
    <section id="top" style={{ paddingTop: 160, paddingBottom: 120, position: "relative", zIndex: 1 }}>
      <div style={{ maxWidth: 820, margin: "0 auto", padding: "0 32px" }}>
        <div className="reveal" style={{ fontSize: 12, color: "var(--ink-40)", marginBottom: 16 }}>
          — a note to yourself —
        </div>
        <h1 className="reveal serif" style={{
          fontSize: "clamp(40px, 6vw, 84px)", lineHeight: 1.05, fontWeight: 300, letterSpacing: -0.02,
          margin: 0, color: "var(--ink)", textWrap: "balance",
        }}>
          “{headline.replace("\n", " ")}”
        </h1>
        <div className="reveal" style={{
          marginTop: 40, paddingTop: 28, borderTop: "1px solid var(--ink-08)",
          display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16,
        }}>
          <p style={{ fontSize: 15, color: "var(--ink-60)", margin: 0, maxWidth: 440, lineHeight: 1.55 }}>
            ontrack takes what you want to become and quietly builds the week that gets you there.
          </p>
          <a href="#cta" className="btn btn--solid btn--lg">start your plan →</a>
        </div>
      </div>
    </section>
  );
}

/* Marquee of goals — reinforces the breadth */
function Marquee() {
  const items = ["learn guitar", "run a half marathon", "speak spanish", "write every morning", "get stronger", "draw every day", "learn to cook", "read more", "meditate", "pick up pottery", "build a website", "take cold showers"];
  const doubled = [...items, ...items];
  return (
    <section style={{ padding: "50px 0", borderTop: "1px solid var(--ink-08)", borderBottom: "1px solid var(--ink-08)", overflow: "hidden", background: "var(--accent-bg)" }}>
      <div style={{ display: "flex", gap: 48, animation: "marquee 42s linear infinite", whiteSpace: "nowrap", width: "max-content" }}>
        {doubled.map((t, i) => (
          <div key={i} style={{ display: "inline-flex", alignItems: "center", gap: 48 }}>
            <span style={{ fontSize: 28, fontWeight: 500, color: "var(--accent-ink)", letterSpacing: -0.01, opacity: .75 }}>{t}</span>
            <span style={{ color: "var(--accent-solid)", fontSize: 14 }}>✦</span>
          </div>
        ))}
      </div>
    </section>
  );
}

/* HOW IT WORKS — 3 steps, sticky-style scroll */
function HowItWorks() {
  const steps = [
    {
      n: "01",
      title: "tell us what you want to get good at.",
      body: "pick a skill or habit — guitar, running, spanish, writing. one thing at a time. no deadlines, no pressure.",
      visual: <GoalInputVisual />,
    },
    {
      n: "02",
      title: "share a bit about your week.",
      body: "a quick back-and-forth so ontrack knows your level, your schedule, and what you've already got on your plate.",
      visual: <ChatVisual />,
    },
    {
      n: "03",
      title: "get a plan you can actually do.",
      body: "a realistic weekly schedule with specific sessions and times. miss a day? ontrack reshuffles — no guilt trips.",
      visual: <PlanCard />,
    },
  ];
  return (
    <section id="how" style={{ padding: "120px 0", position: "relative", zIndex: 1 }}>
      <div style={{ maxWidth: 1320, margin: "0 auto", padding: "0 32px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 120 }}>
          {steps.map((s, i) => (
            <div key={i} className="reveal" style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 80,
              alignItems: "center",
              direction: i % 2 === 1 ? "rtl" : "ltr",
            }}>
              <div style={{ direction: "ltr" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, whiteSpace: "nowrap" }}>
                  <span style={{
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    width: 42, height: 42, borderRadius: 999,
                    background: "var(--accent-bg)", color: "var(--accent-ink)",
                    fontSize: 13, fontWeight: 800, letterSpacing: 0.5,
                    flexShrink: 0,
                  }}>{s.n}</span>
                  <span style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "var(--ink-40)", fontWeight: 700, whiteSpace: "nowrap" }}>step {i + 1}</span>
                </div>
                <h3 style={{
                  fontSize: "clamp(28px, 3.4vw, 44px)", lineHeight: 1.05, fontWeight: 800,
                  letterSpacing: -0.025, margin: 0, textWrap: "balance",
                }}>{s.title}</h3>
                <p style={{ marginTop: 16, fontSize: 16, lineHeight: 1.6, color: "var(--ink-60)", maxWidth: 440 }}>
                  {s.body}
                </p>
              </div>
              <div style={{ direction: "ltr", display: "flex", justifyContent: "center" }}>
                {s.visual}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* WHO IT'S FOR */
function UseCases() {
  const cases = [
    { emoji: "🎸", title: "learn an instrument.", body: "short, focused practice sessions that build real skill — not just mess-around time with a guitar in your lap.", pace: "2 hrs / week" },
    { emoji: "🌍", title: "learn a language.", body: "a daily rhythm you'll actually keep. speaking, listening, reading — spaced out so it sticks.", pace: "30 min / day" },
    { emoji: "🏃", title: "get in shape.", body: "workouts built around your week, your level, and your energy. progress without burning out.", pace: "4 sessions / week" },
    { emoji: "✍︎", title: "write more.", body: "a morning page habit, a draft schedule, or a novel plan. small commitments that compound fast.", pace: "20 min / day" },
    { emoji: "🧘", title: "build better habits.", body: "meditation, journaling, a real wind-down routine. paced to your evenings, not a wellness blog's.", pace: "10 min / night" },
    { emoji: "🎨", title: "pick up a craft.", body: "pottery, drawing, woodworking. weekly sessions you keep — because they fit, not because you're guilty.", pace: "1 session / week" },
  ];
  return (
    <section id="who" style={{ padding: "120px 0", position: "relative", zIndex: 1, background: "var(--paper)", borderTop: "1px solid var(--ink-08)", borderBottom: "1px solid var(--ink-08)" }}>
      <div style={{ maxWidth: 1320, margin: "0 auto", padding: "0 32px" }}>
        <div className="reveal" style={{ textAlign: "center", marginBottom: 80 }}>
          <div className="eyebrow" style={{ marginBottom: 20 }}>who it's for</div>
          <h2 style={{
            fontSize: "clamp(36px, 5vw, 64px)", lineHeight: 1.02, fontWeight: 800, letterSpacing: -0.035,
            margin: "0 auto", maxWidth: 780, textWrap: "balance",
            fontFamily: "Epilogue, sans-serif",
          }}>
            whatever you're trying to <span className="accent-underline-slab">get good at.</span>
          </h2>
          <p style={{ marginTop: 20, fontSize: 16, color: "var(--ink-60)", maxWidth: 560, margin: "20px auto 0", lineHeight: 1.55 }}>
            ontrack works for long-term skills and habits — the kind you build over months, not cram in a weekend.
          </p>
        </div>

        <div style={{
          display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1,
          background: "var(--ink-08)", border: "1px solid var(--ink-08)", borderRadius: 2, overflow: "hidden",
        }}>
          {cases.map((c, i) => (
            <div key={i} className="reveal" style={{
              background: "var(--paper)", padding: "40px 32px", display: "flex", flexDirection: "column",
              minHeight: 280, position: "relative",
            }}>
              <div style={{ fontSize: 28, marginBottom: 16, opacity: .85 }}>{c.emoji}</div>
              <h3 style={{
                fontSize: 22, lineHeight: 1.15, fontWeight: 700, letterSpacing: -0.02, margin: 0, textWrap: "balance",
              }}>{c.title}</h3>
              <p style={{ marginTop: 12, fontSize: 14, lineHeight: 1.6, color: "var(--ink-60)", flex: 1 }}>
                {c.body}
              </p>
              <div style={{
                marginTop: 20, paddingTop: 16, borderTop: "1px dashed var(--ink-12)",
                display: "flex", alignItems: "center", gap: 8,
              }}>
                <span style={{ width: 6, height: 6, borderRadius: 999, background: "var(--accent-solid)" }} />
                <span style={{ fontSize: 11, color: "var(--ink-60)", letterSpacing: 0.5 }}>{c.pace}</span>
              </div>
            </div>
          ))}
        </div>

        <p className="reveal" style={{ textAlign: "center", marginTop: 48, fontSize: 13, color: "var(--ink-40)", fontStyle: "italic" }}>
          not a fit for: cramming for an exam, project deadlines, one-off tasks.
        </p>
      </div>
    </section>
  );
}

/* FINAL CTA */
function FinalCTA() {
  return (
    <section id="cta" style={{ padding: "140px 0 120px", position: "relative", zIndex: 1, background: "linear-gradient(180deg, var(--bg) 0%, var(--accent-bg) 100%)" }}>
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "0 32px", textAlign: "center" }}>
        <h2 className="reveal" style={{
          fontSize: "clamp(40px, 7vw, 96px)", lineHeight: 0.98, fontWeight: 800, letterSpacing: -0.035,
          margin: 0, textWrap: "balance",
          fontFamily: "Epilogue, sans-serif",
        }}>
          your next week, <span className="accent-underline-slab">already planned.</span>
        </h2>
        <p className="reveal" style={{ marginTop: 28, fontSize: 17, color: "var(--ink-60)", lineHeight: 1.55, maxWidth: 520, margin: "28px auto 0" }}>
          tell ontrack what you're working on and get your first weekly plan in under two minutes. free, no credit card.
        </p>
        <div className="reveal" style={{ marginTop: 44, display: "flex", justifyContent: "center", gap: 12, flexWrap: "wrap" }}>
          <a href="#" className="btn btn--solid btn--lg">get started — it's free</a>
          <a href="#" className="btn btn--ghost btn--lg">continue without account</a>
        </div>
        <div className="reveal" style={{ marginTop: 18, fontSize: 12, color: "var(--ink-40)" }}>
          already have an account? <a href="#" style={{ color: "var(--ink-90)", textDecoration: "underline", textDecorationColor: "var(--ink-12)", textUnderlineOffset: 3 }}>log in</a>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer style={{ borderTop: "1px solid var(--ink-08)", padding: "36px 32px", position: "relative", zIndex: 1 }}>
      <div style={{
        maxWidth: 1320, margin: "0 auto", display: "flex", justifyContent: "space-between",
        alignItems: "center", fontSize: 12, color: "var(--ink-40)", flexWrap: "wrap", gap: 16,
      }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 12, color: "var(--ink-60)" }}>
          <CurvedWordmark scale={0.48} />
          <span>· stop starting over. start showing up.</span>
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

Object.assign(window, { Hero, Marquee, HowItWorks, UseCases, FinalCTA, Footer });
