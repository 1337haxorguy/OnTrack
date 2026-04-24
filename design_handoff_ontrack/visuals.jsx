/* Auto-playing product visuals */

function PlanCard({ dayLabel = "monday, apr 14" }) {
  const ref = React.useRef(null);
  const seen = useInView(ref);
  const [step, setStep] = React.useState(0);

  React.useEffect(() => {
    if (!seen) return;
    let alive = true;
    const run = async () => {
      const wait = (ms) => new Promise(r => setTimeout(r, ms));
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
    };
    run();
    return () => { alive = false; };
  }, [seen]);

  const rows = [
    { time: "7:00 am", label: "guitar practice", accent: true, tasks: [
      { t: "chord transitions · 20 min", done: true },
      { t: "fingerpicking · 15 min", done: false },
    ]},
    { time: "12:30 pm", label: "spanish listening", tasks: [
      { t: "podcast episode · 25 min", done: false },
    ]},
    { time: "6:00 pm", label: "evening run", tasks: [
      { t: "easy 3 km · 30 min", done: false },
      { t: "cool-down stretches · 10 min", done: false },
    ]},
  ];

  return (
    <div ref={ref} style={{
      width: "100%", maxWidth: 440, margin: "0 auto",
      background: "var(--paper)", border: "1px solid var(--ink-08)", borderRadius: 18,
      boxShadow: "0 1px 0 rgba(0,0,0,.02), 0 24px 60px -30px rgba(0,0,0,.15)",
      overflow: "hidden",
    }}>
      <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--ink-05)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--bg)" }}>
        <div style={{ fontSize: 12, fontWeight: 700 }}>{dayLabel}</div>
        <div style={{ fontSize: 10, color: "var(--ink-40)", letterSpacing: 1, textTransform: "uppercase" }}>today</div>
      </div>
      {rows.map((r, idx) => {
        const appearAt = idx * 2 + 1;
        const visible = step >= appearAt;
        const tasksVisible = step >= appearAt + 1;
        return (
          <div key={idx} style={{
            padding: "14px 18px", borderBottom: idx < rows.length - 1 ? "1px solid var(--ink-05)" : "none",
            display: "flex", gap: 14,
            opacity: visible ? 1 : 0,
            transform: visible ? "none" : "translateY(8px)",
            transition: "all .5s cubic-bezier(.2,.7,.2,1)",
          }}>
            <div style={{ fontSize: 10, color: "var(--ink-40)", width: 52, flexShrink: 0, paddingTop: 2, letterSpacing: 0.3 }}>{r.time}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
                {r.label}
                {r.accent && <span style={{ width: 6, height: 6, borderRadius: 999, background: "var(--accent-solid)", display: "inline-block" }} />}
              </div>
              <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 5 }}>
                {r.tasks.map((t, ti) => (
                  <div key={ti} style={{
                    display: "flex", alignItems: "center", gap: 8,
                    whiteSpace: "nowrap",
                    opacity: tasksVisible ? 1 : 0,
                    transform: tasksVisible ? "none" : "translateX(-4px)",
                    transition: `all .5s ease ${ti * 80}ms`,
                  }}>
                    <span style={{
                      width: 11, height: 11, borderRadius: 999,
                      border: t.done ? "none" : "1.2px solid var(--ink-25)",
                      background: t.done ? "var(--accent-solid)" : "transparent",
                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                      transition: "all .3s", flexShrink: 0,
                    }}>
                      {t.done && <svg width="7" height="7" viewBox="0 0 10 10"><path d="M2 5l2 2 4-4" stroke="var(--bg)" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                    </span>
                    <span style={{ fontSize: 11.5, color: t.done ? "var(--ink-40)" : "var(--ink-60)", textDecoration: t.done ? "line-through" : "none" }}>{t.t}</span>
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

/* AI chat visual */
function ChatVisual() {
  const ref = React.useRef(null);
  const seen = useInView(ref);
  const [step, setStep] = React.useState(0);
  const script = [
    { kind: "ai",     text: "how much time can you give guitar in a normal week?" },
    { kind: "me",     text: "maybe 3 short sessions? evenings mostly." },
    { kind: "typing" },
    { kind: "ai",     text: "got it. any songs you'd love to play by the end of the month?" },
    { kind: "me",     text: "landslide, and something fingerstyle." },
    { kind: "typing" },
    { kind: "ai",     text: "perfect — i'll build around chord changes and a fingerpicking warm-up." },
  ];

  React.useEffect(() => {
    if (!seen) return;
    let alive = true;
    const wait = (ms) => new Promise(r => setTimeout(r, ms));
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
    <div ref={ref} style={{
      width: "100%", maxWidth: 380, margin: "0 auto",
      display: "flex", flexDirection: "column", gap: 10,
      minHeight: 280,
    }}>
      {script.slice(0, step).map((msg, i) => {
        const isLast = i === step - 1;
        if (msg.kind === "typing") {
          if (!isLast) return null; // typing is transient — only render while it's the current step
          return (
            <div key={i} style={{
              alignSelf: "flex-start", padding: "12px 16px",
              background: "var(--paper)", border: "1px solid var(--ink-08)",
              borderRadius: "4px 16px 16px 16px", display: "flex", gap: 4,
              animation: "rise .4s ease both",
            }}>
              {[0,1,2].map(n => (
                <span key={n} style={{
                  width: 6, height: 6, borderRadius: 999, background: "var(--ink-25)",
                  animation: `gentle-pulse 1.1s ease ${n * 0.15}s infinite`,
                }} />
              ))}
            </div>
          );
        }
        const isMe = msg.kind === "me";
        return (
          <div key={i} style={{
            alignSelf: isMe ? "flex-end" : "flex-start",
            maxWidth: "82%",
            padding: "12px 16px",
            background: isMe ? "var(--ink)" : "var(--paper)",
            color: isMe ? "var(--bg)" : "var(--ink-90)",
            border: isMe ? "none" : "1px solid var(--ink-08)",
            borderRadius: isMe ? "16px 4px 16px 16px" : "4px 16px 16px 16px",
            fontSize: 13, lineHeight: 1.55,
            animation: "rise .5s cubic-bezier(.2,.7,.2,1) both",
          }}>
            {msg.text}
          </div>
        );
      })}
    </div>
  );
}

/* Goal input visual — type a goal, see tasks we'd generate for it */
const GOAL_PREVIEWS = [
  { goal: "learn guitar", emoji: "🎸", tasks: ["chord transitions · 20 min", "fingerpicking warm-up · 15 min", "practice 'wonderwall' · 10 min"] },
  { goal: "speak spanish", emoji: "🌍", tasks: ["duolingo streak · 15 min", "spanish podcast · 25 min", "journal in spanish · 10 min"] },
  { goal: "run a half marathon", emoji: "🏃", tasks: ["easy 5k run · 35 min", "interval workout · 25 min", "recovery stretches · 10 min"] },
  { goal: "write every morning", emoji: "✍︎", tasks: ["morning pages · 20 min", "draft a scene · 30 min", "re-read yesterday · 5 min"] },
  { goal: "get stronger", emoji: "💪", tasks: ["upper body lifts · 40 min", "core circuit · 15 min", "mobility work · 10 min"] },
];

function GoalInputVisual() {
  const ref = React.useRef(null);
  const seen = useInView(ref);
  const [i, setI] = React.useState(0);
  const [typed, setTyped] = React.useState("");
  const [phase, setPhase] = React.useState("type"); // type | show | clear

  React.useEffect(() => {
    if (!seen) return;
    const word = GOAL_PREVIEWS[i % GOAL_PREVIEWS.length].goal;
    let t;
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
    <div ref={ref} style={{
      width: "100%", maxWidth: 400, margin: "0 auto",
      background: "var(--paper)", border: "1px solid var(--ink-08)", borderRadius: 20,
      padding: 22,
      boxShadow: "0 24px 60px -30px rgba(0,0,0,.15)",
    }}>
      {/* eyebrow */}
      <div style={{ fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: "var(--accent-ink)", marginBottom: 12, display: "inline-flex", alignItems: "center", gap: 6 }}>
        <span style={{ width: 5, height: 5, borderRadius: 999, background: "var(--accent-solid)" }} />
        i want to…
      </div>

      {/* input */}
      <div style={{
        padding: "14px 16px", border: "1px solid var(--ink-12)", borderRadius: 12,
        fontSize: 18, fontWeight: 600, color: "var(--ink-90)", minHeight: 52,
        display: "flex", alignItems: "center", gap: 8,
        background: "var(--bg)",
      }}>
        <span style={{ fontSize: 18 }}>{cur.emoji}</span>
        <span style={{ display: "inline-flex", alignItems: "center" }}>
          {typed}
          <span style={{ display: "inline-block", width: 2, height: "1em", background: "var(--accent-solid)", marginLeft: 3, animation: "blink 1s step-end infinite" }} />
        </span>
      </div>

      {/* ontrack-would-plan preview */}
      <div style={{
        marginTop: 16, paddingTop: 16, borderTop: "1px dashed var(--ink-12)",
        minHeight: 168,
      }}>
        <div style={{ fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: "var(--ink-40)", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
          <span>here's the week</span>
          <span style={{ flex: 1, height: 1, background: "var(--ink-08)" }} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {cur.tasks.map((t, idx) => (
            <div key={cur.goal + idx} style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "10px 12px",
              background: "var(--bg)", border: "1px solid var(--ink-05)", borderRadius: 10,
              opacity: showTasks ? 1 : 0,
              transform: showTasks ? "translateY(0)" : "translateY(6px)",
              transition: `all .45s cubic-bezier(.2,.7,.2,1) ${idx * 120}ms`,
            }}>
              <span style={{
                width: 10, height: 10, borderRadius: 999,
                border: "1.2px solid var(--accent-solid)",
                background: "var(--accent-bg)",
                flexShrink: 0,
              }} />
              <span style={{ fontSize: 12.5, color: "var(--ink-60)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { PlanCard, ChatVisual, GoalInputVisual });
