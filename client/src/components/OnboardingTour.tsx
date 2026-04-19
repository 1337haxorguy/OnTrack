import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useApp } from "../context/AppContext";

const TOUR_KEY = "ontrack_tour_completed";

interface TourStep {
  target: string; // data-tour value
  title: string;
  description: string;
  // preferred tooltip placement — auto-adjusted if it would clip the viewport
  placement?: "top" | "bottom" | "left" | "right";
}

const STEPS: TourStep[] = [
  {
    target: "nav-goals",
    title: "Your Goals hub",
    description:
      "All your goals live here. Create new ones, edit existing ones, and generate your weekly plan.",
    placement: "bottom",
  },
  {
    target: "new-goal",
    title: "Create your first goal",
    description:
      "Tell OnTrack what you want to achieve — skill level, timeframe, hours per week, and more.",
    placement: "bottom",
  },
  {
    target: "nav-schedule",
    title: "Set your availability",
    description:
      "Add your free time slots and recurring commitments so the AI knows exactly when you're free.",
    placement: "bottom",
  },
  {
    target: "generate-plan",
    title: "Generate your plan",
    description:
      "Once you've added a goal, hit this to get a personalized AI-generated weekly schedule.",
    placement: "bottom",
  },
  {
    target: "nav-today",
    title: "Your daily view",
    description:
      "Check the Today tab each morning to see what's on your plate and tick off tasks as you go.",
    placement: "bottom",
  },
  {
    target: "nav-calendar",
    title: "Full week at a glance",
    description:
      "The Calendar gives you a complete week view — reschedule blocks or regenerate individual days.",
    placement: "bottom",
  },
];

const TOOLTIP_WIDTH = 280;
const TOOLTIP_HEIGHT_ESTIMATE = 160;
const SPOTLIGHT_PADDING = 8;

// Timing constants (ms)
const TOOLTIP_FADE_OUT = 150;
const SPOTLIGHT_MOVE = 300;
const TOOLTIP_DELAY_IN = 200; // delay after spotlight starts moving before fading tooltip back in
const OVERLAY_FADE = 300;
const EXIT_FADE = 250;

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface SpotlightState {
  top: number;
  left: number;
  width: number;
  height: number;
}

function getTargetRect(target: string): Rect | null {
  const el = document.querySelector<HTMLElement>(`[data-tour="${target}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

function computeTooltipPosition(
  rect: Rect,
  placement: TourStep["placement"],
  tooltipHeight: number,
): { top: number; left: number; actualPlacement: string } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const GAP = 12;
  const EDGE_MARGIN = 12;

  let top = 0;
  let left = 0;
  let actualPlacement = placement ?? "bottom";

  const placeBottom = () => {
    top = rect.top + rect.height + GAP;
    left = rect.left + rect.width / 2 - TOOLTIP_WIDTH / 2;
  };
  const placeTop = () => {
    top = rect.top - tooltipHeight - GAP;
    left = rect.left + rect.width / 2 - TOOLTIP_WIDTH / 2;
  };
  const placeRight = () => {
    top = rect.top + rect.height / 2 - tooltipHeight / 2;
    left = rect.left + rect.width + GAP;
  };
  const placeLeft = () => {
    top = rect.top + rect.height / 2 - tooltipHeight / 2;
    left = rect.left - TOOLTIP_WIDTH - GAP;
  };

  switch (placement) {
    case "top":
      placeTop();
      break;
    case "left":
      placeLeft();
      break;
    case "right":
      placeRight();
      break;
    default:
      placeBottom();
      break;
  }

  // Flip if it clips vertically
  if (top + tooltipHeight > vh - EDGE_MARGIN && placement !== "top") {
    placeTop();
    actualPlacement = "top";
  }
  if (top < EDGE_MARGIN && placement !== "bottom") {
    placeBottom();
    actualPlacement = "bottom";
  }

  // Clamp horizontally
  left = Math.max(EDGE_MARGIN, Math.min(left, vw - TOOLTIP_WIDTH - EDGE_MARGIN));
  // Clamp vertically
  top = Math.max(EDGE_MARGIN, Math.min(top, vh - tooltipHeight - EDGE_MARGIN));

  return { top, left, actualPlacement };
}

export default function OnboardingTour() {
  const { dataLoaded } = useApp();
  const location = useLocation();

  // Whether the tour is logically running
  const [active, setActive] = useState(false);
  // Controls the overlay opacity — starts false so it can fade in
  const [overlayVisible, setOverlayVisible] = useState(false);
  // Controls whether we're in the exit fade-out phase before unmounting
  const [exiting, setExiting] = useState(false);

  const [stepIndex, setStepIndex] = useState(0);

  // Tooltip visibility is managed separately from step so we can fade out,
  // move the spotlight, then fade back in.
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0 });

  // The spotlight position is kept in its own state so the <div> stays
  // mounted and CSS transitions on style properties actually fire.
  const [spotlight, setSpotlight] = useState<SpotlightState | null>(null);

  // Displayed step content — we only update this after the tooltip has faded
  // out, so the card never shows stale content while transitioning.
  const [displayedStep, setDisplayedStep] = useState(0);

  const tooltipRef = useRef<HTMLDivElement>(null);
  const transitionTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = () => {
    transitionTimers.current.forEach(clearTimeout);
    transitionTimers.current = [];
  };

  const shouldRun =
    dataLoaded &&
    location.pathname === "/" &&
    localStorage.getItem(TOUR_KEY) !== "true";

  // Kick the tour off after a short paint delay
  useEffect(() => {
    if (shouldRun) {
      const t = setTimeout(() => setActive(true), 600);
      return () => clearTimeout(t);
    }
  }, [shouldRun]);

  // Once active, fade the overlay in
  useEffect(() => {
    if (active) {
      // Next tick so the initial opacity:0 frame is committed before we flip to 1
      const t = setTimeout(() => setOverlayVisible(true), 16);
      return () => clearTimeout(t);
    }
  }, [active]);

  // Helper: measure a step's target and compute positions
  const measure = useCallback(
    (index: number): { spot: SpotlightState; tip: { top: number; left: number } } | null => {
      const step = STEPS[index];
      const rect = getTargetRect(step.target);
      if (!rect) return null;

      const spot: SpotlightState = {
        top: rect.top - SPOTLIGHT_PADDING,
        left: rect.left - SPOTLIGHT_PADDING,
        width: rect.width + SPOTLIGHT_PADDING * 2,
        height: rect.height + SPOTLIGHT_PADDING * 2,
      };

      const tooltipHeight =
        tooltipRef.current?.offsetHeight ?? TOOLTIP_HEIGHT_ESTIMATE;
      const { top, left } = computeTooltipPosition(rect, step.placement, tooltipHeight);

      return { spot, tip: { top, left } };
    },
    [],
  );

  // On first activation: immediately place spotlight + tooltip without any
  // fade-out/in cycle (there's nothing to fade out yet).
  useEffect(() => {
    if (!active) return;

    const frame = requestAnimationFrame(() => {
      const result = measure(0);
      if (!result) return;

      setSpotlight(result.spot);
      setTooltipPos(result.tip);
      setDisplayedStep(0);

      // Small extra delay so spotlight CSS transition (which starts from
      // wherever 0,0 would be) doesn't flash — we let the overlay fade in
      // first, then reveal the tooltip.
      const t = setTimeout(() => setTooltipVisible(true), OVERLAY_FADE);
      transitionTimers.current.push(t);
    });

    return () => cancelAnimationFrame(frame);
    // Only run once when active flips to true
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  // On step change (after first mount): orchestrate the transition sequence.
  // We skip index 0 here because the first mount effect above handles it.
  const prevStepRef = useRef(-1);
  useEffect(() => {
    if (!active) return;
    if (stepIndex === 0 && prevStepRef.current === -1) {
      // First render — handled by the activation effect above
      prevStepRef.current = 0;
      return;
    }
    if (stepIndex === prevStepRef.current) return;
    prevStepRef.current = stepIndex;

    clearTimers();

    // 1. Fade the tooltip out
    setTooltipVisible(false);

    // 2. After fade-out completes: update displayed content + move spotlight
    const t1 = setTimeout(() => {
      const result = measure(stepIndex);
      if (!result) return; // graceful skip handled elsewhere

      setDisplayedStep(stepIndex);
      setSpotlight(result.spot);
      setTooltipPos(result.tip);
    }, TOOLTIP_FADE_OUT);

    // 3. After spotlight has had time to animate: fade tooltip back in
    const t2 = setTimeout(() => {
      setTooltipVisible(true);
    }, TOOLTIP_FADE_OUT + TOOLTIP_DELAY_IN + SPOTLIGHT_MOVE);

    transitionTimers.current.push(t1, t2);
  }, [active, stepIndex, measure]);

  // Re-measure on window resize (no transition needed — just snap to new pos)
  useEffect(() => {
    if (!active) return;

    const onResize = () => {
      const result = measure(stepIndex);
      if (!result) return;
      setSpotlight(result.spot);
      setTooltipPos(result.tip);
    };

    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [active, stepIndex, measure]);

  // Graceful skip for steps whose target element isn't in the DOM
  useEffect(() => {
    if (!active) return;
    const step = STEPS[stepIndex];
    const el = document.querySelector(`[data-tour="${step.target}"]`);
    if (!el) {
      if (stepIndex < STEPS.length - 1) {
        setStepIndex((i) => i + 1);
      } else {
        // last step missing — just complete without animation
        localStorage.setItem(TOUR_KEY, "true");
        setActive(false);
      }
    }
  }, [active, stepIndex]);

  const exitTour = useCallback(() => {
    clearTimers();
    setTooltipVisible(false);
    setExiting(true);
    const t = setTimeout(() => {
      localStorage.setItem(TOUR_KEY, "true");
      setActive(false);
      setExiting(false);
    }, EXIT_FADE);
    transitionTimers.current.push(t);
  }, []);

  const complete = useCallback(() => exitTour(), [exitTour]);
  const skip = useCallback(() => exitTour(), [exitTour]);

  const goNext = useCallback(() => {
    const step = STEPS[stepIndex];
    const isLast = stepIndex === STEPS.length - 1;
    if (isLast) {
      complete();
    } else {
      // Check next step target exists; if not, keep advancing
      let next = stepIndex + 1;
      while (next < STEPS.length) {
        const el = document.querySelector(`[data-tour="${STEPS[next].target}"]`);
        if (el) break;
        next++;
      }
      if (next >= STEPS.length) {
        complete();
      } else {
        setStepIndex(next);
      }
    }
    void step; // suppress unused var lint
  }, [stepIndex, complete]);

  const goBack = useCallback(() => {
    if (stepIndex === 0) return;
    setStepIndex((i) => i - 1);
  }, [stepIndex]);

  // Cleanup on unmount
  useEffect(() => () => clearTimers(), []);

  if (!active && !exiting) return null;

  const step = STEPS[displayedStep];
  const isLast = displayedStep === STEPS.length - 1;

  // Spotlight CSS — transitions fire because this div stays mounted and we
  // update its style props rather than toggling its existence.
  const spotlightTransition = `top ${SPOTLIGHT_MOVE}ms cubic-bezier(0.4, 0, 0.2, 1), left ${SPOTLIGHT_MOVE}ms cubic-bezier(0.4, 0, 0.2, 1), width ${SPOTLIGHT_MOVE}ms cubic-bezier(0.4, 0, 0.2, 1), height ${SPOTLIGHT_MOVE}ms cubic-bezier(0.4, 0, 0.2, 1)`;

  const overlayOpacity = overlayVisible && !exiting ? 1 : 0;

  return (
    <>
      {/* Dark overlay — fades in on mount, fades out on exit */}
      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 9996,
          backgroundColor: "rgba(0,0,0,0.45)",
          opacity: overlayOpacity,
          transition: `opacity ${OVERLAY_FADE}ms ease`,
          pointerEvents: "none",
        }}
      />

      {/* Clickable backdrop — sits above the dim layer, below spotlight/tooltip */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 9997,
          opacity: overlayOpacity,
          transition: `opacity ${OVERLAY_FADE}ms ease`,
        }}
        onClick={skip}
        aria-hidden="true"
      />

      {/* Spotlight hole (box-shadow cutout) — always rendered, CSS transitions
          fire on position/size changes */}
      {spotlight && (
        <div
          aria-hidden="true"
          style={{
            position: "fixed",
            top: spotlight.top,
            left: spotlight.left,
            width: spotlight.width,
            height: spotlight.height,
            borderRadius: 12,
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.45)",
            pointerEvents: "none",
            zIndex: 9998,
            transition: spotlightTransition,
            opacity: overlayOpacity,
          }}
        />
      )}

      {/* White highlight ring — mirrors spotlight position */}
      {spotlight && (
        <div
          aria-hidden="true"
          style={{
            position: "fixed",
            top: spotlight.top,
            left: spotlight.left,
            width: spotlight.width,
            height: spotlight.height,
            borderRadius: 12,
            border: "2px solid rgba(255,255,255,0.7)",
            pointerEvents: "none",
            zIndex: 9999,
            transition: spotlightTransition,
            opacity: overlayOpacity,
          }}
        />
      )}

      {/* Tooltip card — fades out/in around step transitions */}
      <div
        ref={tooltipRef}
        role="dialog"
        aria-label={`Tour step ${displayedStep + 1} of ${STEPS.length}: ${step.title}`}
        style={{
          position: "fixed",
          top: tooltipPos.top,
          left: tooltipPos.left,
          width: TOOLTIP_WIDTH,
          zIndex: 10000,
          opacity: tooltipVisible && !exiting ? 1 : 0,
          transform: tooltipVisible && !exiting ? "translateY(0)" : "translateY(6px)",
          transition: `opacity ${TOOLTIP_FADE_OUT}ms ease, transform ${TOOLTIP_FADE_OUT}ms ease`,
          pointerEvents: tooltipVisible && !exiting ? "auto" : "none",
        }}
        className="bg-white rounded-2xl shadow-xl border border-black/8 p-4"
      >
        {/* Step counter */}
        <p className="text-xs text-black/35 mb-1.5 font-medium tabular-nums">
          {displayedStep + 1} of {STEPS.length}
        </p>

        {/* Title */}
        <p className="text-sm font-semibold text-black leading-snug mb-1">
          {step.title}
        </p>

        {/* Description */}
        <p className="text-xs text-black/55 leading-relaxed mb-4">
          {step.description}
        </p>

        {/* Actions */}
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={skip}
            className="text-xs text-black/30 hover:text-black/60 transition-colors"
          >
            Skip tour
          </button>

          <div className="flex items-center gap-2">
            {displayedStep > 0 && (
              <button
                onClick={goBack}
                className="text-xs text-black/40 hover:text-black/70 transition-colors px-3 py-1.5 border border-black/10 rounded-full"
              >
                ← Back
              </button>
            )}
            <button
              onClick={goNext}
              className="text-xs font-medium bg-black text-white rounded-full px-4 py-1.5 hover:bg-black/80 transition-colors"
            >
              {isLast ? "Done" : "Next →"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
