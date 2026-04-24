function App() {
  const [state, setState] = React.useState(TWEAK_DEFAULTS);

  // Apply accent CSS variables
  React.useEffect(() => {
    const a = ACCENTS[state.accent] || ACCENTS.sage;
    document.documentElement.style.setProperty("--accent", a.solid);
    document.documentElement.style.setProperty("--accent-solid", a.solid);
    document.documentElement.style.setProperty("--accent-bg", a.bg);
    document.documentElement.style.setProperty("--accent-ink", a.ink);
  }, [state.accent]);

  useReveal();

  return (
    <>
      <Nav />
      <main style={{ position: "relative" }}>
        <Hero variant={state.heroVariant} headline={state.heroHeadline} />
        <Marquee />
        <HowItWorks />
        <UseCases />
        <FinalCTA />
      </main>
      <Footer />
      <TweaksPanel state={state} setState={setState} />
    </>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
