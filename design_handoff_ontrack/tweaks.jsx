/* Tweaks panel */

function TweaksPanel({ state, setState }) {
  const [active, setActive] = React.useState(false);

  React.useEffect(() => {
    const onMsg = (e) => {
      if (!e.data || typeof e.data !== "object") return;
      if (e.data.type === "__activate_edit_mode") setActive(true);
      if (e.data.type === "__deactivate_edit_mode") setActive(false);
    };
    window.addEventListener("message", onMsg);
    try { window.parent.postMessage({ type: "__edit_mode_available" }, "*"); } catch (e) {}
    return () => window.removeEventListener("message", onMsg);
  }, []);

  const persist = (next) => {
    try { window.parent.postMessage({ type: "__edit_mode_set_keys", edits: next }, "*"); } catch (e) {}
  };

  const update = (key, val) => {
    const next = { ...state, [key]: val };
    setState(next);
    persist({ [key]: val });
  };

  if (!active) return null;

  return (
    <div style={{
      position: "fixed", right: 20, bottom: 20, zIndex: 100,
      width: 300, padding: 18,
      background: "var(--paper)", border: "1px solid var(--ink-12)", borderRadius: 16,
      boxShadow: "0 20px 60px -20px rgba(0,0,0,.25)",
      fontFamily: "Epilogue, sans-serif",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase" }}>tweaks</div>
        <div style={{ width: 6, height: 6, borderRadius: 999, background: "var(--accent-solid)" }} />
      </div>

      {/* Accent */}
      <div style={{ marginBottom: 16 }}>
        <label style={lbl}>accent</label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {Object.entries(ACCENTS).map(([k, v]) => (
            <button key={k} onClick={() => update("accent", k)} title={k} style={{
              width: 32, height: 32, borderRadius: 999, border: state.accent === k ? "2px solid var(--ink)" : "1px solid var(--ink-12)",
              background: v.solid, cursor: "pointer", padding: 0, outline: "none",
              display: "inline-flex", alignItems: "center", justifyContent: "center",
            }}>
              {k === "none" && <span style={{ width: 14, height: 1, background: "var(--ink)", transform: "rotate(-45deg)" }} />}
            </button>
          ))}
        </div>
      </div>

      {/* Hero variant */}
      <div style={{ marginBottom: 16 }}>
        <label style={lbl}>hero layout</label>
        <div style={{ display: "flex", gap: 6, flexDirection: "column" }}>
          {[
            { k: "editorial", t: "editorial", d: "centered big type" },
            { k: "split", t: "split", d: "copy + plan card" },
            { k: "diary", t: "diary", d: "quiet note to self" },
          ].map((opt) => (
            <button key={opt.k} onClick={() => update("heroVariant", opt.k)} style={{
              textAlign: "left", padding: "10px 12px", borderRadius: 10,
              border: state.heroVariant === opt.k ? "1px solid var(--ink)" : "1px solid var(--ink-12)",
              background: state.heroVariant === opt.k ? "var(--ink-05)" : "var(--paper)",
              cursor: "pointer", fontFamily: "inherit",
            }}>
              <div style={{ fontSize: 12, fontWeight: 600 }}>{opt.t}</div>
              <div style={{ fontSize: 10, color: "var(--ink-40)", marginTop: 2 }}>{opt.d}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Headline */}
      <div>
        <label style={lbl}>headline</label>
        <textarea
          value={state.heroHeadline}
          onChange={(e) => update("heroHeadline", e.target.value)}
          rows={3}
          style={{
            width: "100%", padding: 10, borderRadius: 8, border: "1px solid var(--ink-12)",
            fontFamily: "inherit", fontSize: 12, resize: "vertical", background: "var(--bg)",
            color: "var(--ink)", lineHeight: 1.35,
          }}
        />
        <div style={{ fontSize: 10, color: "var(--ink-40)", marginTop: 6 }}>use \n for a line break.</div>
      </div>
    </div>
  );
}

const lbl = { display: "block", fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: "var(--ink-40)", marginBottom: 8 };

Object.assign(window, { TweaksPanel });
